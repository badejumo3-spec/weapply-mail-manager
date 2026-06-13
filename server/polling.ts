import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { query, logAudit } from "./db.js";
import { decrypt } from "./crypto.js";
import { extractAuthArtifacts } from "./extraction.js";

// Keep track of exponential backoffs per client in milliseconds
// backoff levels: 60s -> 120s -> 240s -> max 300s (300,000ms)
const backoffStates: Record<number, { current: number; nextAllowedTime: number }> = {};

function getBackoffState(clientId: number) {
  if (!backoffStates[clientId]) {
    backoffStates[clientId] = {
      current: 60000,
      nextAllowedTime: 0,
    };
  }
  return backoffStates[clientId];
}

function handleSuccess(clientId: number) {
  const state = getBackoffState(clientId);
  state.current = 60000;
  state.nextAllowedTime = Date.now() + 60000;
}

function handleFailure(clientId: number, error: any) {
  const state = getBackoffState(clientId);
  const errMsg = error?.message || String(error);
  const isNetworkError =
    errMsg.includes("ENOTFOUND") ||
    errMsg.includes("ECONNRESET") ||
    errMsg.includes("ETIMEDOUT") ||
    errMsg.includes("EAI_AGAIN") ||
    error?.code === "ENOTFOUND" ||
    error?.code === "ECONNRESET" ||
    error?.code === "ETIMEDOUT" ||
    error?.code === "EAI_AGAIN";

  if (isNetworkError) {
    console.log(`[Polling] Network error detected for client ${clientId}. Increasing backoff...`);
    // Backoff transitions: 60s (60000) -> 120s (120000) -> 240s (240000) -> max 300s (300000)
    state.current = Math.min(300000, state.current * 2);
    state.nextAllowedTime = Date.now() + state.current;
    console.log(`[Polling] Next sync allowed for client ${clientId} in ${state.current / 1000}s`);
  } else {
    // If it's a authorization error, keep it at 60s but mark client with proper status
    state.current = 60000;
    state.nextAllowedTime = Date.now() + 60000;
    console.warn(`[Polling] Authentication or processing error for client ${clientId}:`, error);
  }
}

// Auto-refresh OAuth tokens if near expiry
async function refreshOAuthTokenIfNeeded(client: any): Promise<string> {
  const expiry = parseInt(client.oauth_token_expiry || "0", 10);
  // If token expires in less than 5 minutes (300,000 ms), refresh it
  if (Date.now() + 300000 >= expiry && client.oauth_refresh_token) {
    console.log(`[OAuth] Refreshing token for client ${client.id} (${client.email})...`);
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          refresh_token: client.oauth_refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google token refresh failed: ${res.status} ${errText}`);
      }

      const data = await res.json();
      const newAccessToken = data.access_token;
      const expiresIn = data.expires_in || 3600;
      const newExpiryTime = String(Date.now() + expiresIn * 1000);

      // Update in db
      await query(
        `UPDATE clients 
         SET oauth_access_token = $1, oauth_token_expiry = $2, status = 'connected' 
         WHERE id = $3`,
        [newAccessToken, newExpiryTime, client.id]
      );

      console.log(`[OAuth] Successfully refreshed token for client ${client.id}.`);
      return newAccessToken;
    } catch (err: any) {
      console.error(`[OAuth] Error refreshing token for client ${client.id}:`, err);
      await query(
        `UPDATE clients SET status = 'error' WHERE id = $1`,
        [client.id]
      );
      throw err;
    }
  }

  return client.oauth_access_token || "";
}

// Recursively find Gmail body content
function getGmailBody(payload: any): { html: string; text: string } {
  let html = "";
  let text = "";

  if (!payload) return { html, text };

  if (payload.body && payload.body.data) {
    const data = Buffer.from(payload.body.data, "base64").toString("utf-8");
    if (payload.mimeType === "text/html") {
      html = data;
    } else {
      text = data;
    }
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const parsed = getGmailBody(part);
      if (parsed.html) html += parsed.html;
      if (parsed.text) text += parsed.text;
    }
  }

  return { html, text };
}

// Fetch via Gmail API
async function syncGmailClient(client: any) {
  const token = await refreshOAuthTokenIfNeeded(client);
  if (!token) {
    throw new Error("No access token available for Gmail OAuth synchronization.");
  }

  // Get unread emails in the last 1 hour
  // Query: newer_than:1h is:unread
  const qStr = encodeURIComponent("newer_than:1h is:unread");
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${qStr}`;
  
  const res = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      await query("UPDATE clients SET status = 'unauthorized' WHERE id = $1", [client.id]);
    }
    const errText = await res.text();
    throw new Error(`Gmail API List failed: ${res.status} ${errText}`);
  }

  const listData = await res.json();
  const messages = listData.messages || [];
  let processedCount = 0;

  for (const msgSummary of messages) {
    const msgId = msgSummary.id;

    // Fetch message details
    const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!msgRes.ok) continue;

    const msg = await msgRes.json();
    const headers = msg.payload?.headers || [];
    
    const subject = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "(No Subject)";
    const sender = headers.find((h: any) => h.name?.toLowerCase() === "from")?.value || "Unknown Sender";
    const recipient = headers.find((h: any) => h.name?.toLowerCase() === "to")?.value || client.email;
    const dateStr = headers.find((h: any) => h.name?.toLowerCase() === "date")?.value;
    
    const receivedAt = dateStr ? new Date(dateStr) : new Date();
    // In force, format to clean ISO
    const receivedISO = receivedAt.toISOString();

    // Prevent duplicate entries
    const dupCheck = await query(
      `SELECT id FROM emails 
       WHERE sender = $1 AND recipient_email = $2 AND subject = $3 AND received_at = $4`,
      [sender, recipient, subject, receivedISO]
    );

    if (dupCheck.rows.length > 0) {
      continue; // Row already ingested in previous polls
    }

    const bodyParts = getGmailBody(msg.payload);
    const bodyHtml = bodyParts.html || bodyParts.text || "No HTML content";
    const bodyText = bodyParts.text || bodyParts.html || "No plaintext content";

    // Run extraction logic
    const extract = extractAuthArtifacts(subject, bodyText);

    // Calculate expiration: 1 hour since email received
    const expiresAt = new Date(receivedAt.getTime() + 60 * 60 * 1000).toISOString();

    // Insert into db
    await query(
      `INSERT INTO emails (client_id, sender, recipient_email, subject, full_body_html, full_body_text, otp_code, verification_link, received_at, expires_at, classification_status, visibility_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        client.id,
        sender,
        recipient,
        subject,
        bodyHtml,
        bodyText,
        extract.otp_code,
        extract.verification_link,
        receivedISO,
        expiresAt,
        extract.classification_status,
        extract.visibility_level,
      ]
    );

    // Modify Gmail message, mark as read (remove UNREAD label)
    // The requirement is that we query is:unread, so we should optionally remove 'UNREAD' label or not.
    // Let's modify it to remove 'UNREAD' to avoid re-fetching, satisfying "newer_than:1h is:unread".
    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/modify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        removeLabelIds: ["UNREAD"],
      }),
    });

    processedCount++;
  }

  // Update client last synchronized stats
  await query(
    `UPDATE clients 
     SET last_synced_at = NOW(), total_emails_processed = total_emails_processed + $1, status = 'connected' 
     WHERE id = $2`,
    [processedCount, client.id]
  );

  if (processedCount > 0) {
    await logAudit(
      "SYSTEM",
      "DAEMON",
      `Engine synchronized Google Client ${client.email}: processed ${processedCount} new emails.`,
      "SUCCESS"
    );
  }
}

// Fetch via IMAP Fallback
async function syncImapClient(client: any) {
  if (!client.imap_host || !client.imap_port || !client.encrypted_password || !client.iv) {
    throw new Error("Incomplete IMAP credentials config details.");
  }

  const decryptedPassword = decrypt(client.encrypted_password, client.iv);
  if (!decryptedPassword) {
    throw new Error("Failed to decrypt client password for IMAP connection.");
  }

  console.log(`[IMAP] Connecting to ${client.imap_host}:${client.imap_port} for ${client.email}...`);

  const imapClient = new ImapFlow({
    host: client.imap_host,
    port: client.imap_port,
    secure: client.imap_port === 993,
    auth: {
      user: client.email,
      pass: decryptedPassword,
    },
    logger: false,
    connectionTimeout: 10000,
    greetingTimeout: 5000,
  });

  await imapClient.connect();
  const lock = await imapClient.getMailboxLock("INBOX");
  let processedCount = 0;

  try {
    // Search unread messages in INBOX
    // Fetch unseen messages
    const searchResult = await imapClient.search({ seen: false });
    
    for (const uid of searchResult) {
      const fetchResult = await imapClient.fetchOne(uid, { source: true, envelope: true });
      if (!fetchResult || !fetchResult.source) continue;

      const parsed = await simpleParser(fetchResult.source);
      
      const subject = parsed.subject || "(No Subject)";
      const senderObj = parsed.from?.value?.[0];
      const sender = senderObj ? `${senderObj.name || ""} <${senderObj.address || ""}>`.trim() : "Unknown Sender";
      const recipient = client.email;
      const receivedAt = parsed.date
       ? new Date(parsed.date)
       : new Date();
      const receivedISO = receivedAt.toISOString();

      // Duplicate prevention
      const dupCheck = await query(
        `SELECT id FROM emails 
         WHERE sender = $1 AND recipient_email = $2 AND subject = $3 AND received_at = $4`,
        [sender, recipient, subject, receivedISO]
      );

      if (dupCheck.rows.length > 0) {
        // Mark as seen so we don't fetch it next time even if we skip inserting it
        await imapClient.messageFlagsAdd(uid, ["\\Seen"]);
        continue;
      }

      const bodyHtml = parsed.html || parsed.text || "No HTML content";
      const bodyText = parsed.text || parsed.html || "No plaintext content";

      // Perform extraction
      const extract = extractAuthArtifacts(subject, bodyText);
      const expiresAt = new Date(receivedAt.getTime() + 60 * 60 * 1000).toISOString();

      // Insert
      await query(
        `INSERT INTO emails (client_id, sender, recipient_email, subject, full_body_html, full_body_text, otp_code, verification_link, received_at, expires_at, classification_status, visibility_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          client.id,
          sender,
          recipient,
          subject,
          bodyHtml,
          bodyText,
          extract.otp_code,
          extract.verification_link,
          receivedISO,
          expiresAt,
          extract.classification_status,
          extract.visibility_level,
        ]
      );

      // Add \Seen flag to mark as read
      await imapClient.messageFlagsAdd(uid, ["\\Seen"]);
      processedCount++;
    }
  } finally {
    lock.release();
    await imapClient.logout();
  }

  // Update client status
  await query(
    `UPDATE clients 
     SET last_synced_at = NOW(), total_emails_processed = total_emails_processed + $1, status = 'connected' 
     WHERE id = $2`,
    [processedCount, client.id]
  );

  if (processedCount > 0) {
    await logAudit(
      "SYSTEM",
      "DAEMON",
      `Engine synchronized IMAP client ${client.email}: processed ${processedCount} emails.`,
      "SUCCESS"
    );
  }
}

// Single database cleanup and synchronization tick
export async function runPollingTick() {
  try {
    // 1. Retention policy cleanup:
    // DELETE FROM emails WHERE expires_at < NOW()
    const deleteRes = await query("DELETE FROM emails WHERE expires_at < NOW()");
    if (deleteRes.rowCount && deleteRes.rowCount > 0) {
      console.log(`[Retention] Hard deleted ${deleteRes.rowCount} expired emails from system.`);
    }

    // 2. Fetch all clients
    const clientsResult = await query("SELECT * FROM clients");
    const clients = clientsResult.rows;

    for (const client of clients) {
      const state = getBackoffState(client.id);
      
      // Verify if client is allowed to be synchronized based on backoff
      if (Date.now() < state.nextAllowedTime) {
        continue; // Backed off right now
      }

      console.log(`[Polling] Synchronizing Client ${client.id} (${client.email})...`);

      try {
        if (client.auth_type === "oauth" && client.provider === "google") {
          await syncGmailClient(client);
        } else if (client.auth_type === "imap") {
          await syncImapClient(client);
        }
        
        // Reset backoff on successful execution
        handleSuccess(client.id);
      } catch (err: any) {
        console.error(`[Polling] Failed polling for Client ${client.id}:`, err?.message || err);
        handleFailure(client.id, err);
      }
    }
  } catch (globalErr) {
    console.error("[Polling] Critical global error during polling tick:", globalErr);
  }
}

let pollingInterval: NodeJS.Timeout | null = null;

export function startPollingDaemon() {
  console.log("[Daemon] Starting WeApply4U Mail Manager Polling Daemon (60s tick interval with exponential backoff)...");
  
  // Trigger immediately on startup
  runPollingTick().catch(err => console.error("Initial polling tick failed:", err));

  // Run subsequent ticks every 10 seconds to respond quickly to backoffs and schedule due syncing,
  // but clients will restrict themselves to their specified backoff window (60s initially)
  pollingInterval = setInterval(() => {
    runPollingTick().catch(err => console.error("Scheduling tick error:", err));
  }, 10000); 
}

export function stopPollingDaemon() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[Daemon] Polling daemon stopped.");
  }
}
