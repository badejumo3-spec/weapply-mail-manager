import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query, logAudit } from "./db.js";
import { encrypt } from "./crypto.js";
import { runPollingTick } from "./polling.js";

export const apiRouter = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_value_for_weapply4u_64_chars_long";

// ✅ Admin Email Whitelist for OAuth Login
const ADMIN_EMAILS = [
  "badejumo3@gmail.com",
  "wadejumo3@gmail.com",
  "admin@weapplying4u.com",
];

function serializeEmailRows(rows: any[]) {
  return rows.map((email) => ({
    ...email,
    received_at: email.received_at
      ? new Date(email.received_at).toISOString()
      : null,
    expires_at: email.expires_at
      ? new Date(email.expires_at).toISOString()
      : null,
  }));
}

// Helper middleware for JWT token verification
export function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token is required" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: "Session expired or invalid token" });
    }
    req.user = user;
    next();
  });
}

// Middleware to restrict endpoint to ADMIN only
export function requireAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Access denied. Administrator privileges required." });
  }
  next();
}

// --- AUTHENTICATION ---

// ✅ User Login OAuth Initiation (LOGIN ONLY - Minimal Scopes)
apiRouter.get("/oauth/google", (req, res) => {
  // ✅ LOGIN SCOPES ONLY - No Gmail access, no user cap
  const scopes = [
    "openid",
    "email",
    "profile",
  ];

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      redirect_uri: process.env.GOOGLE_LOGIN_REDIRECT_URI || "", // ✅ User Login Redirect
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    }).toString();

  res.redirect(authUrl);
});

// ✅ User Login OAuth Callback
apiRouter.get("/oauth/google/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code is missing from Google redirect query parameters.");
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: process.env.GOOGLE_LOGIN_REDIRECT_URI || "", // ✅ User Login Redirect
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      return res.status(400).send(`Google JWT Exchange Token request failed: ${tokenResponse.status} ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileResponse.ok) {
      return res.status(400).send("Failed to retrieve profile info for authorization email identifier.");
    }

    const profileData = await profileResponse.json();
    const email = profileData.email;
    const name = profileData.name || email.split("@")[0];

    // ✅ Determine Role Based on Whitelist
    const isAdmin = ADMIN_EMAILS.includes(email);
    const role = isAdmin ? "ADMIN" : "WORKER";

    // ✅ Check if user exists in DB
    const existingUser = await query("SELECT * FROM users WHERE email = $1", [email]);

    let user;
    if (existingUser.rows.length === 0) {
      const prefix = isAdmin ? "admin" : "worker";
      const maxIdResult = await query(`SELECT id FROM users WHERE id LIKE '${prefix}_%' ORDER BY id DESC LIMIT 1`);
      let nextIdNum = 1;
      
      if (maxIdResult.rows.length > 0) {
        const lastId = maxIdResult.rows[0].id;
        const lastNum = parseInt(lastId.split('_')[1], 10);
        nextIdNum = lastNum + 1;
      }
      
      const generatedId = `${prefix}_${nextIdNum}`;
      
      const result = await query(
        `INSERT INTO users (id, name, email, password_hash, role, is_2fa_enabled) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [generatedId, name, email, "", role, false]
      );
      user = result.rows[0];
      console.log(`[OAuth] Created new ${role} user: ${email}`);
    } else {
      user = existingUser.rows[0];
      console.log(`[OAuth] Existing ${user.role} user: ${email}`);
    }

    // ✅ Generate JWT for app session
    const appToken = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    await logAudit(email, user.role, `Logged in via Google OAuth 2.0 as ${role}.`, "SUCCESS");

    // ✅ Redirect to app with token
    res.redirect(`/?token=${appToken}&oauth=success`);
  } catch (err: any) {
    console.error("OAuth Exchange failed:", err);
    await logAudit("unknown", "UNKNOWN", `OAuth error: ${err?.message || err}`, "FAILED");
    res.redirect("/?oauth=error");
  }
});

// ✅ Client OAuth Callback (FOR MAILBOX CONNECTIONS)
apiRouter.get("/clients/oauth/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code missing from Google redirect.");
  }

  // ✅ Validate state parameter to verify admin user
  let adminEmail;
  try {
    const decoded = Buffer.from(state as string, 'base64').toString('utf-8');
    const [userId, email] = decoded.split(':');
    
    const userResult = await query("SELECT role FROM users WHERE id = $1 AND email = $2", [userId, email]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'ADMIN') {
      throw new Error("Invalid or non-admin user");
    }
    adminEmail = email;
  } catch (err) {
    console.error("State validation failed:", err);
    return res.redirect("/?oauth-client=error&message=Unauthorized");
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: process.env.GOOGLE_CLIENT_REDIRECT_URI || "",
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;
    const expiryTimestamp = new Date(Date.now() + expiresIn * 1000);

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const profileData = await profileResponse.json();
    const email = profileData.email;
    const name = profileData.name || email.split("@")[0];

    const existingClient = await query("SELECT id FROM clients WHERE email = $1", [email]);

    if (existingClient.rows.length > 0) {
      await query(
        `UPDATE clients 
         SET oauth_access_token = $1, oauth_refresh_token = $2, oauth_token_expiry = $3, status = 'connected', last_synced_at = NOW()
         WHERE email = $4`,
        [accessToken, refreshToken, expiryTimestamp, email]
      );
      console.log(`[Client OAuth] Updated existing client: ${email}`);
    } else {
      await query(
        `INSERT INTO clients (client_name, email, provider, auth_type, oauth_access_token, oauth_refresh_token, oauth_token_expiry, status)
         VALUES ($1, $2, 'google', 'oauth', $3, $4, $5, 'connected')`,
        [name, email, accessToken, refreshToken, expiryTimestamp]
      );
      console.log(`[Client OAuth] Created new client: ${email}`);
    }

    await logAudit(adminEmail, "ADMIN", `Connected client mailbox via OAuth: ${email}`, "SUCCESS");
    res.redirect("/?oauth-client=success");
  } catch (err: any) {
    console.error("Client OAuth callback failed:", err);
    await logAudit(adminEmail, "ADMIN", `Failed to connect client mailbox: ${err.message}`, "FAILED");
    res.redirect("/?oauth-client=error");
  }
});
    
// Register standard users (email/password users)
apiRouter.post("/auth/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Missing required fields for user creation." });
  }

  if (role !== "ADMIN" && role !== "WORKER") {
    return res.status(400).json({ error: "Valid role is required (ADMIN or WORKER)." });
  }

  try {
    const checkUser = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: "A user with this email address already exists." });
    }

    const hash = await bcrypt.hash(password, 10);
    
    // ✅ GENERATE STRING ID for new users
    const maxIdResult = await query(`SELECT id FROM users WHERE id LIKE '${role.toLowerCase()}_%' ORDER BY id DESC LIMIT 1`);
    let nextIdNum = 1;
    
    if (maxIdResult.rows.length > 0) {
      const lastId = maxIdResult.rows[0].id;
      const lastNum = parseInt(lastId.split('_')[1], 10);
      nextIdNum = lastNum + 1;
    }
    
    const generatedId = `${role.toLowerCase()}_${nextIdNum}`;
    
    const result = await query(
      `INSERT INTO users (id, name, email, password_hash, role, is_2fa_enabled) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, is_2fa_enabled`,
      [generatedId, name, email, hash, role, false]
    );

    const newUser = result.rows[0];
    await logAudit(
      newUser.email,
      newUser.role,
      `User self-registered successfully under account name ${newUser.name}.`,
      "SUCCESS",
      req.ip
    );

    res.status(201).json({ user: newUser });
  } catch (err: any) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Server error during registration." });
  }
});

// Login user and sign JWT
apiRouter.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const result = await query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = result.rows[0];
    const isMatched = await bcrypt.compare(password, user.password_hash);
    if (!isMatched) {
      await logAudit(email, "UNKNOWN", "Failed login attempt (mismatched password).", "FAILED", req.ip);
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    await logAudit(user.email, user.role, "Logged into the system session.", "SUCCESS", req.ip);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_2fa_enabled: user.is_2fa_enabled,
      },
    });
  } catch (err: any) {
    console.error("Login endpoint error:", err);
    res.status(500).json({ error: "Network/database error during login verification." });
  }
});

// Get currently authenticated profile details
apiRouter.get("/auth/me", authenticateToken, async (req: any, res) => {
  try {
    const result = await query(
      "SELECT id, name, email, role, is_2fa_enabled, created_at FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User session profiles not found." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error querying session user configuration." });
  }
});

// --- CLIENTS MANAGEMENT (ADMINS ONLY) ---

apiRouter.get("/clients", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query("SELECT id, client_name, email, provider, auth_type, imap_host, imap_port, status, connected_at, last_synced_at, total_emails_processed FROM clients ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load directory clients." });
  }
});

// Trigger a manual poll sync across all registered mailboxes
apiRouter.post("/clients/sync", authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    await runPollingTick();
    await logAudit(req.user.email, req.user.role, "Triggered manual inbox sync engine tick.", "SUCCESS", req.ip);
    res.json({ message: "Engine sync cycle completed successfully." });
  } catch (err: any) {
    console.error("Manual sync failed:", err);
    res.status(500).json({ error: `Manual synchronization trigger failed: ${err?.message || err}` });
  }
});

// Connect client with manual IMAP fallback credentials
apiRouter.post("/clients/imap", authenticateToken, requireAdmin, async (req: any, res) => {
  const { client_name, email, imap_host, imap_port, password } = req.body;

  if (!client_name || !email || !imap_host || !imap_port || !password) {
    return res.status(400).json({ error: "All IMAP connection credentials are required." });
  }

  const { encryptedText, iv } = encrypt(password);

  try {
    const checkClient = await query("SELECT id FROM clients WHERE email = $1", [email]);
    if (checkClient.rows.length > 0) {
      return res.status(400).json({ error: "A client inbox with this email has already been registered." });
    }

    const result = await query(
      `INSERT INTO clients (client_name, email, provider, auth_type, imap_host, imap_port, encrypted_password, iv, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id, client_name, email, provider, auth_type, imap_host, imap_port, status, connected_at`,
      [client_name, email, "google", "imap", imap_host, parseInt(imap_port, 10), encryptedText, iv, "connected"]
    );

    const client = result.rows[0];

    await logAudit(
      req.user.email,
      req.user.role,
      `Manually linked IMAP account fallback: client ${client_name} (${email}).`,
      "SUCCESS",
      req.ip
    );

    res.status(201).json(client);
  } catch (err: any) {
    console.error("IMAP client addition failed:", err);
    res.status(500).json({ error: "Database error registering IMAP credentials." });
  }
});

// ✅ Client Mailbox Connection (KEEPS Gmail Scopes)
apiRouter.get("/clients/oauth-link", authenticateToken, requireAdmin, (req, res) => {
  const scopes = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  // ✅ Create state with user info (for callback validation)
  const state = Buffer.from(req.user.id + ":" + req.user.email).toString('base64');

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      redirect_uri: process.env.GOOGLE_CLIENT_REDIRECT_URI || "",
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state: state, // ✅ Pass user info
    }).toString();

  res.json({ url: authUrl });
});

// Delete client inbox credential
apiRouter.delete("/clients/:id", authenticateToken, requireAdmin, async (req: any, res) => {
  const { id } = req.params;

  try {
    const checkClient = await query("SELECT email, client_name FROM clients WHERE id = $1", [id]);
    if (checkClient.rows.length === 0) {
      return res.status(404).json({ error: "Client matching requested ID could not be found." });
    }

    const client = checkClient.rows[0];
    await query("DELETE FROM clients WHERE id = $1", [id]);

    await logAudit(
      req.user.email,
      req.user.role,
      `De-linked connected client inbox matching ${client.client_name} (${client.email}).`,
      "SUCCESS",
      req.ip
    );

    res.json({ message: "Client inbox connection was deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: "Database error during client inbox removal." });
  }
});

// --- EMAILS MANAGEMENT ---

apiRouter.get("/emails", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT e.id, e.client_id, e.sender, e.recipient_email, e.subject, e.full_body_html, e.full_body_text, e.otp_code, e.verification_link, e.received_at, e.expires_at, e.classification_status, e.visibility_level, c.client_name
       FROM emails e
       LEFT JOIN clients c ON e.client_id = c.id
       ORDER BY e.received_at DESC`
    );
    res.json(serializeEmailRows(result.rows));
  } catch (err) {
    res.status(500).json({ error: "Database failure loading server mail." });
  }
});

apiRouter.get("/emails/otps", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role === "ADMIN") {
      const result = await query(
        `SELECT e.id, e.client_id, e.sender, e.recipient_email, e.subject, e.full_body_html, e.full_body_text, e.otp_code, e.verification_link, e.received_at, e.expires_at, e.classification_status, e.visibility_level, c.client_name
         FROM emails e
         LEFT JOIN clients c ON e.client_id = c.id
         WHERE (e.otp_code IS NOT NULL OR e.verification_link IS NOT NULL)
         ORDER BY e.received_at DESC`
      );
      return res.json(serializeEmailRows(result.rows));
    } else {
      const result = await query(
        `SELECT e.id, e.client_id, e.sender, e.recipient_email, e.subject, e.full_body_html, e.full_body_text, e.otp_code, e.verification_link, e.received_at, e.expires_at, e.classification_status, e.visibility_level, c.client_name
         FROM emails e
         LEFT JOIN clients c ON e.client_id = c.id
         WHERE e.visibility_level = 'tier2_allowed' AND e.expires_at > NOW()
         ORDER BY e.received_at DESC`
      );
      return res.json(serializeEmailRows(result.rows));
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to render credentials feed list." });
  }
});

apiRouter.post("/emails/:id/classify", authenticateToken, requireAdmin, async (req: any, res) => {
  const { id } = req.params;
  const { action } = req.body;

  if (!action || !["send_to_tier2", "pull_back", "admin_only"].includes(action)) {
    return res.status(400).json({ error: "Invalid classification override action requested." });
  }

  let classification_status = "admin_only";
  let visibility_level = "tier1_only";

  if (action === "send_to_tier2") {
    classification_status = "sent_to_tier2";
    visibility_level = "tier2_allowed";
  } else if (action === "pull_back") {
    classification_status = "pulled_back";
    visibility_level = "tier1_only";
  } else if (action === "admin_only") {
    classification_status = "admin_only";
    visibility_level = "tier1_only";
  }

  try {
    const details = await query("SELECT subject, sender, recipient_email FROM emails WHERE id = $1", [id]);
    if (details.rows.length === 0) {
      return res.status(404).json({ error: "The selected email identifier does not exist." });
    }

    const emailItem = details.rows[0];

    await query(
      `UPDATE emails 
       SET classification_status = $1, visibility_level = $2 
       WHERE id = $3`,
      [classification_status, visibility_level, id]
    );

    await logAudit(
      req.user.email,
      req.user.role,
      `Manually classified email '${emailItem.subject}' from ${emailItem.sender} as status: ${classification_status}.`,
      "SUCCESS",
      req.ip
    );

    res.json({
      id,
      classification_status,
      visibility_level,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Database error during classification update." });
  }
});

// --- AUDIT LOGS ---

apiRouter.get("/logs", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve audit log listings." });
  }
});