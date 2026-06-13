import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is not set in environment. Database connection will fail.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

export async function initDb() {
  console.log("Initializing database schema if not exists...");
  
  try {
    // 1. Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL, -- 'ADMIN' | 'WORKER'
        is_2fa_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create clients table
    await query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        client_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        provider VARCHAR(50) NOT NULL DEFAULT 'google',
        auth_type VARCHAR(50) NOT NULL DEFAULT 'oauth',
        imap_host VARCHAR(255),
        imap_port INTEGER,
        encrypted_password TEXT,
        iv VARCHAR(255),
        oauth_access_token TEXT,
        oauth_refresh_token TEXT,
        oauth_token_expiry VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'connected',
        connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_synced_at TIMESTAMP,
        total_emails_processed INTEGER DEFAULT 0
      );
    `);

    // 3. Create emails table
    await query(`
      CREATE TABLE IF NOT EXISTS emails (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        sender VARCHAR(255) NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        full_body_html TEXT NOT NULL,
        full_body_text TEXT NOT NULL,
        otp_code VARCHAR(255),
        verification_link TEXT,
        received_at TIMESTAMP NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        classification_status VARCHAR(100) NOT NULL DEFAULT 'admin_only',
        visibility_level VARCHAR(100) NOT NULL DEFAULT 'tier1_only'
      );
    `);

    // 4. Create audit_logs table
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        actor VARCHAR(255) NOT NULL,
        role VARCHAR(100) NOT NULL,
        action TEXT NOT NULL,
        status VARCHAR(50) NOT NULL,
        ip_address VARCHAR(100)
      );
    `);

    console.log("Database schema checked and verified.");

    // Seed default users if users table is empty
    const userCountResult = await query("SELECT COUNT(*) FROM users");
    const count = parseInt(userCountResult.rows[0].count, 10);
    
    if (count === 0) {
      console.log("Seeding default users...");
      const adminHash = await bcrypt.hash("admin123", 10);
      const workerHash = await bcrypt.hash("worker123", 10);

      await query(
        `INSERT INTO users (name, email, password_hash, role, is_2fa_enabled) 
         VALUES ($1, $2, $3, $4, $5)`,
        ["Admin User", "admin@weapply4u.com", adminHash, "ADMIN", false]
      );

      await query(
        `INSERT INTO users (name, email, password_hash, role, is_2fa_enabled) 
         VALUES ($1, $2, $3, $4, $5)`,
        ["Worker Tier2 User", "worker@weapply4u.com", workerHash, "WORKER", false]
      );

      console.log("Seeding complete: ");
      console.log(" - Admin: admin@weapply4u.com / admin123");
      console.log(" - Worker: worker@weapply4u.com / worker123");
    }
  } catch (error) {
    console.error("Error during database schema setup:", error);
    throw error;
  }
}

export async function logAudit(actor: string, role: string, action: string, status: string, ip: string | null = null) {
  try {
    await query(
      `INSERT INTO audit_logs (actor, role, action, status, ip_address) 
       VALUES ($1, $2, $3, $4, $5)`,
      [actor, role, action, status, ip]
    );
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
