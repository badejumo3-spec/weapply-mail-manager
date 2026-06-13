import { google } from "googleapis";
import { DBCleintAccount, createDatabase } from "./db";
const db = createDatabase();
import { decrypt } from "./crypto";

const { OAuth2 } = google.auth;

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/oauth/google/callback";
  
  return new OAuth2(clientId, clientSecret, redirectUri);
}

function decodeBase64(baseStr: string): string {
  // Convert URL-safe base64 to standard base64 then decode to utf8 string
  const standard = baseStr.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(standard, "base64").toString("utf8");
}

export function getBodyTextFromMessage(payload: any): string {
  if (!payload) return "";
  
  let bodyPlain = "";
  let bodyHtml = "";

  const findParts = (part: any) => {
    if (part.mimeType === "text/plain" && part.body?.data) {
      bodyPlain += " " + decodeBase64(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data) {
      bodyHtml += " " + decodeBase64(part.body.data);
    }
    
    if (part.parts) {
      for (const p of part.parts) {
        findParts(p);
      }
    }
  };

  // Check standard root body data
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    bodyPlain += " " + decodeBase64(payload.body.data);
  } else if (payload.mimeType === "text/html" && payload.body?.data) {
    bodyHtml += " " + decodeBase64(payload.body.data);
  }

  // Recurse over nested sub-parts
  if (payload.parts) {
    for (const p of payload.parts) {
      findParts(p);
    }
  }

  return bodyPlain.trim() || bodyHtml.trim() || "";
}

export async function refreshAccessTokenIfNeeded(client: DBCleintAccount) {
  const oauth2Client = getOAuth2Client();
  
  if (!client.oauth_refresh_token || !client.iv) {
    throw new Error("Missing encrypted OAuth refresh token credentials or IV");
  }
  
  // Decrypt secured refresh token using same AES-256 process
  const decryptedRefreshToken = decrypt(client.oauth_refresh_token, client.iv);
  
  oauth2Client.setCredentials({
    access_token: client.oauth_access_token || undefined,
    refresh_token: decryptedRefreshToken,
  });

  // Check if token is expired or close to it
  const isExpired = client.oauth_token_expiry 
    ? new Date(client.oauth_token_expiry).getTime() <= Date.now() + 60000 // 1 minute safety buffer
    : true;

  if (isExpired) {
    console.log(`Access token expired or about to expire for ${client.email}. Querying fresh OAuth credentials...`);
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      const newAccessToken = credentials.access_token;
      
      if (!newAccessToken) {
        throw new Error("Google OAuth did not yield a fresh access_token");
      }
      
      // Calculate token expiration timestamp
      let expiryDate: string;
      const exp = credentials.expiry_date;
      if (exp) {
        if (exp > Date.now()) {
          expiryDate = new Date(exp).toISOString();
        } else {
          expiryDate = new Date(Date.now() + exp * 1000).toISOString();
        }
      } else {
        expiryDate = new Date(Date.now() + 3600 * 1000).toISOString();
      }
      
      // Update database safely
      await db.updateClientOAuthTokens(client.id, newAccessToken, expiryDate);
      
      // Also update client fields locally for any fast consecutive uses
      client.oauth_access_token = newAccessToken;
      client.oauth_token_expiry = expiryDate;
      
      oauth2Client.setCredentials({
        access_token: newAccessToken,
        refresh_token: decryptedRefreshToken
      });
      
      console.log(`Security token refreshed successfully for client: ${client.email}`);
    } catch (refreshErr: any) {
      console.error(`Failed to negotiate OAuth refresh for ${client.email}:`, refreshErr?.message || refreshErr);
      throw new Error("OAuth delegation was revoked by Google or configuration is bad.");
    }
  }

  return google.gmail({ version: "v1", auth: oauth2Client });
}

export async function getAuthenticatedGmailClient(client: DBCleintAccount) {
  return refreshAccessTokenIfNeeded(client);
}

export function getEmailParts(payload: any): { text: string; html: string } {
  if (!payload) return { text: "", html: "" };
  
  let text = "";
  let html = "";

  const findParts = (part: any) => {
    if (part.mimeType === "text/plain" && part.body?.data) {
      text += "\n" + decodeBase64(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data) {
      html += "\n" + decodeBase64(part.body.data);
    }
    
    if (part.parts) {
      for (const p of part.parts) {
        findParts(p);
      }
    }
  };

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    text += "\n" + decodeBase64(payload.body.data);
  } else if (payload.mimeType === "text/html" && payload.body?.data) {
    html += "\n" + decodeBase64(payload.body.data);
  }

  if (payload.parts) {
    for (const p of payload.parts) {
      findParts(p);
    }
  }

  return { text: text.trim(), html: html.trim() };
}

export interface UnreadGmailMessage {
  id: string;
  subject: string;
  sender: string;
  recipientEmail?: string | null;
  bodyText: string;
  bodyHtml: string;
  snippet: string;
  dateRec: string;
}

export async function fetchUnreadMessages(gmail: any): Promise<UnreadGmailMessage[]> {
  const response = await gmail.users.messages.list({
    userId: "me",
    q: "newer_than:1h is:unread"
  });
  
  const messages = response.data.messages || [];
  const results: UnreadGmailMessage[] = [];
  
  for (const msg of messages) {
    if (!msg.id) continue;
    
    try {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full"
      });
      
      const payload = detail.data.payload;
      const headers = payload?.headers || [];
      const subject = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "(No Subject)";
      const fromHeader = headers.find((h: any) => h.name?.toLowerCase() === "from")?.value || "unknown@sender.com";
      
      const toHeader = headers.find((h: any) => h.name?.toLowerCase() === "to")?.value || "";
      const emailMatch = toHeader.match(/<([^>]+)>/);
      const recipientEmail = emailMatch ? emailMatch[1] : toHeader.trim();

      // Parse multi-part body or fall back to pre-rendered metadata snippet
      const { text, html } = getEmailParts(payload);
      const snippet = detail.data.snippet || "";
      
      results.push({
        id: msg.id,
        subject,
        sender: fromHeader,
        recipientEmail,
        bodyText: text || snippet,
        bodyHtml: html || `<div>${text || snippet}</div>`,
        snippet: snippet,
        dateRec: detail.data.internalDate 
          ? new Date(parseInt(detail.data.internalDate)).toISOString() 
          : new Date().toISOString()
      });
    } catch (err) {
      console.error(`Failed loading envelope for Gmail message UID ${msg.id}:`, err);
    }
  }
  
  return results;
}

export async function markMessageAsRead(gmail: any, messageId: string): Promise<void> {
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: ["UNREAD"]
    }
  });
}
