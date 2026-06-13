export type UserRole = "ADMIN" | "WORKER";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_2fa_enabled: boolean;
  created_at: string;
}

export type ClientProvider = "google" | "microsoft";
export type ClientAuthType = "imap" | "oauth";
export type ClientStatus = "connected" | "error" | "unauthorized";

export interface Client {
  id: number;
  client_name: string;
  email: string;
  provider: ClientProvider;
  auth_type: ClientAuthType;
  imap_host?: string;
  imap_port?: number;
  encrypted_password?: string;
  iv?: string;
  oauth_access_token?: string;
  oauth_refresh_token?: string;
  oauth_token_expiry?: string; // Date or ISO string
  status: ClientStatus;
  connected_at: string;
  last_synced_at?: string;
  total_emails_processed: number;
}

export type ClassificationStatus = "auto_filtered" | "admin_only" | "sent_to_tier2" | "pulled_back";
export type VisibilityLevel = "tier1_only" | "tier2_allowed";

export interface Email {
  id: number;
  client_id?: number | null;
  sender: string;
  recipient_email: string;
  subject: string;
  full_body_html: string;
  full_body_text: string;
  otp_code?: string | null;
  verification_link?: string | null;
  received_at: string;
  expires_at: string;
  classification_status: ClassificationStatus;
  visibility_level: VisibilityLevel;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  status: string;
  ip_address?: string | null;
}
