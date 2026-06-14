import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { query, logAudit } from "./db.js";
import { decrypt } from "./crypto.js";
import { extractAuthArtifacts } from "./extraction.js";

/* -------------------------
   Backoff Management
------------------------- */

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
    errMsg.includes("EAI_AGAIN");

  if (isNetworkError) {
    state.current = Math.min(300000, state.current * 2);
    state.nextAllowedTime = Date.now() + state.current;
  } else {
    state.current = 60000;
    state.nextAllowedTime = Date.now() + 60000;
  }
}

/* -------------------------
   OAuth Refresh Logic
------------------------- */

async function refreshOAuthToken(client: any): Promise<string | null> {
  if (!client.oauth_refresh_token) return null;

  console.log(`[OAuth] Refreshing token for ${client.email}...`);

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
    console.error("[OAuth] Refresh failed:", await res.text());
    return null;
  }

  const data = await res.json();
  const newAccessToken = data.access_token;
  const expiresIn = data.expires_in || 3600;
  const newExpiryTime = String(Date.now() + expiresIn * 1000);

  await query(
    `UPDATE clients 
     SET oauth_access_token = $1, oauth_token_expiry = $2, status = 'connected'
     WHERE id = $3`,
    [newAccessToken, newExpiryTime, client.id]
  );

  return newAccessToken;
}

async function refreshOAuthTokenIfNeeded(client: any): Promise<string | null> {
  const expiry = parseInt(client.oauth_token_expiry || "0", 10);

  if (Date.now() + 300000 >= expiry) {
    return await refreshOAuthToken(client);
  }

  return client.oauth_access_token || null;
}

/* -------------------------
   Gmail Sync (With 401 Retry)
------------------------- */

function getGmailBody(payload: any): { html: string; text: string } {
  let html = "";
  let text = "";

  if (!payload) return { html, text };

  if (payload.body?.data) {
    const data = Buffer.from(payload.body.data, "base64").toString("utf-8");
    if (payload.mimeType === "text/html") html = data;
    else text = data;
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

async function syncGmailClient(client: any) {
  if (client.status === "unauthorized") {
    console.log(`[Polling] Skipping unauthorized client ${client.email}`);
    return;
  }

  let token = await refreshOAuthTokenIfNeeded(client);
  if (!token) throw new Error("No access token available.");

  const qStr = encodeURIComponent("newer_than:1h is:unread");
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${qStr}`;

  let res = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // ✅ Retry once if 401
  if (res.status === 401) {
    console.log(`[OAuth] 401 detected. Attempting forced refresh for ${client.email}...`);

    token = await refreshOAuthToken(client);

    if (!token) {
      await query(`UPDATE clients SET status = 'unauthorized' WHERE id = $1`, [client.id]);
      throw new Error("Refresh failed after 401.");
    }

    res = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  if (!res.ok) {
    throw new Error(`Gmail API List failed: ${res.status} ${await res.text()}`);
  }

  const listData = await res.json();
  const messages = listData.messages || [];
  let processedCount = 0;

  for (const msgSummary of messages) {
    const msgId = msgSummary.id;

    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!msgRes.ok) continue;

    const msg = await msgRes.json();
    const headers = msg.payload?.headers || [];

    const subject = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "(No Subject)";
    const sender = headers.find((h: any) => h.name?.toLowerCase() === "from")?.value || "Unknown Sender";
    const recipient = headers.find((h: any) => h.name?.toLowerCase() === "to")?.value || client.email;

    const dateStr = headers.find((h: any) => h.name?.toLowerCase() === "date")?.value;
    const receivedAt = dateStr ? new Date(dateStr) : new Date();
    const receivedISO = receivedAt.toISOString();

    const dupCheck = await query(
      `SELECT id FROM emails 
       WHERE sender = $1 AND recipient_email = $2 AND subject = $3 AND received_at = $4`,
      [sender, recipient, subject, receivedISO]
    );

    if (dupCheck.rows.length > 0) continue;

    const bodyParts = getGmailBody(msg.payload);
    const bodyHtml = bodyParts.html || bodyParts.text || "";
    const bodyText = bodyParts.text || bodyParts.html || "";

    const extract = extractAuthArtifacts(subject, bodyText);
    const expiresAt = new Date(receivedAt.getTime() + 60 * 60 * 1000).toISOString();

    await query(
      `INSERT INTO emails (client_id, sender, recipient_email, subject, full_body_html, full_body_text, otp_code, verification_link, received_at, expires_at, classification_status, visibility_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
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

    await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
      }
    );

    processedCount++;
  }

  await query(
    `UPDATE clients 
     SET last_synced_at = NOW(), total_emails_processed = total_emails_processed + $1, status = 'connected'
     WHERE id = $2`,
    [processedCount, client.id]
  );
}

/* -------------------------
   IMAP Sync (unchanged)
------------------------- */

async function syncImapClient(client: any) {
  if (!client.imap_host || !client.imap_port || !client.encrypted_password || !client.iv) {
    throw new Error("Incomplete IMAP credentials config.");
  }

  const decryptedPassword = decrypt(client.encrypted_password, client.iv);
  const imapClient = new ImapFlow({
    host: client.imap_host,
    port: client.imap_port,
    secure: client.imap_port === 993,
    auth: { user: client.email, pass: decryptedPassword },
  });

  await imapClient.connect();
  const lock = await imapClient.getMailboxLock("INBOX");
  let processedCount = 0;

  try {
    const searchResult = await imapClient.search({ seen: false });

    for (const uid of searchResult) {
      const fetchResult = await imapClient.fetchOne(uid, { source: true });
      if (!fetchResult?.source) continue;

      const parsed = await simpleParser(fetchResult.source);

      const subject = parsed.subject || "(No Subject)";
      const sender = parsed.from?.text || "Unknown Sender";
      const receivedAt = parsed.date ? new Date(parsed.date) : new Date();
      const receivedISO = receivedAt.toISOString();

      const extract = extractAuthArtifacts(subject, parsed.text || "");

      await query(
        `INSERT INTO emails (client_id, sender, recipient_email, subject, full_body_html, full_body_text, otp_code, verification_link, received_at, expires_at, classification_status, visibility_level)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          client.id,
          sender,
          client.email,
          subject,
          parsed.html || "",
          parsed.text || "",
          extract.otp_code,
          extract.verification_link,
          receivedISO,
          new Date(receivedAt.getTime() + 3600000).toISOString(),
          extract.classification_status,
          extract.visibility_level,
        ]
      );

      await imapClient.messageFlagsAdd(uid, ["\\Seen"]);
      processedCount++;
    }
  } finally {
    lock.release();
    await imapClient.logout();
  }

  await query(
    `UPDATE clients SET last_synced_at = NOW(), total_emails_processed = total_emails_processed + $1 WHERE id = $2`,
    [processedCount, client.id]
  );
}

/* -------------------------
   Polling Tick
------------------------- */

export async function runPollingTick() {
  try {
    await query("DELETE FROM emails WHERE expires_at < NOW()");

    const clientsResult = await query("SELECT * FROM clients");
    const clients = clientsResult.rows;

    for (const client of clients) {
      const state = getBackoffState(client.id);

      if (Date.now() < state.nextAllowedTime) continue;

      try {
        if (client.auth_type === "oauth" && client.provider === "google") {
          await syncGmailClient(client);
        } else if (client.auth_type === "imap") {
          await syncImapClient(client);
        }
        handleSuccess(client.id);
      } catch (err: any) {
        console.error(`[Polling] Failed polling for Client ${client.id}:`, err?.message || err);
        handleFailure(client.id, err);
      }
    }
  } catch (err) {
    console.error("[Polling] Global error:", err);
  }
}

let pollingInterval: NodeJS.Timeout | null = null;

export function startPollingDaemon() {
  runPollingTick();
  pollingInterval = setInterval(runPollingTick, 10000);
}

export function stopPollingDaemon() {
  if (pollingInterval) clearInterval(pollingInterval);
}