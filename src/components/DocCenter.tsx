import React, { useState } from "react";
import { 
  Database, Code, Network, FolderTree, ShieldCheck, ClipboardList, 
  ChevronRight, ChevronDown, Check, Info, Server, Sparkles, Send, Copy 
} from "lucide-react";
import { DrizzleSchemaTable } from "../types";
import { motion, AnimatePresence } from "motion/react";

const schemaTables: DrizzleSchemaTable[] = [
  {
    name: "client_accounts",
    description: "Stores connected OAuth integrations and authorization metadata for clients' corporate inboxes.",
    columns: [
      { name: "id", type: "uuid", constraints: "PRIMARY KEY DEFAULT gen_random_uuid()", description: "Unique identifier for the connected email account." },
      { name: "client_name", type: "varchar(255)", constraints: "NOT NULL", description: "Designated billing/identity name of the tenant client." },
      { name: "email", type: "varchar(255)", constraints: "UNIQUE NOT NULL", description: "Target monitoring email address (Gmail or Microsoft Office account)." },
      { name: "provider", type: "varchar(50)", constraints: "NOT NULL", description: "Identity provider. Options: 'google' | 'microsoft'." },
      { name: "encrypted_access_token", type: "text", constraints: "NOT NULL", description: "AES-256-GCM encrypted short-lived OAuth bearer credential." },
      { name: "encrypted_refresh_token", type: "text", constraints: "NOT NULL", description: "AES-256-GCM encrypted durable credential used to negotiate new access tokens." },
      { name: "encryption_iv", type: "varchar(24)", constraints: "NOT NULL", description: "Cryptographic initial token vector matching the encryption pass." },
      { name: "status", type: "varchar(50)", constraints: "DEFAULT 'connected'", description: "State: 'connected' | 'syncing' | 'expired' | 'disconnected'." },
      { name: "connected_at", type: "timestamp", constraints: "DEFAULT now()", description: "Datetime tracking client integration creation." },
      { name: "last_synced_at", type: "timestamp", constraints: "DEFAULT now()", description: "Timestamp tracking the last check for incoming correspondence." }
    ]
  },
  {
    name: "users",
    description: "Database accounts representing employees, distinguishing Tier 1 Administrators from Tier 2 Workers.",
    columns: [
      { name: "id", type: "uuid", constraints: "PRIMARY KEY DEFAULT gen_random_uuid()", description: "Unique identifier for the console employee." },
      { name: "name", type: "varchar(255)", constraints: "NOT NULL", description: "Full worker name." },
      { name: "email", type: "varchar(255)", constraints: "UNIQUE NOT NULL", description: "Corporate corporate login email address." },
      { name: "role", type: "varchar(30)", constraints: "DEFAULT 'WORKER'", description: "Access level configuration: 'ADMIN' | 'WORKER'." },
      { name: "password_hash", type: "varchar(255)", constraints: "NOT NULL", description: "Securely salted BCrypt credential hash." },
      { name: "is_2fa_enabled", type: "boolean", constraints: "DEFAULT FALSE", description: "Safety flag indicating mandatory Time-based One-Time Password verification status." },
      { name: "totp_secret", type: "varchar(128)", constraints: "NULL", description: "Encrypted TOTP secret keys used for authenticator validation." },
      { name: "created_at", type: "timestamp", constraints: "DEFAULT now()", description: "User record initialization datetime." }
    ]
  },
  {
    name: "worker_inbox_assignments",
    description: "Many-to-many relationship mapping Tier 2 Workers to the specific clients whose filtered OTPs they are authorized to capture.",
    columns: [
      { name: "id", type: "serial", constraints: "PRIMARY KEY", description: "Internal row serial auto-increment key." },
      { name: "worker_id", type: "uuid", constraints: "REFERENCES users(id) ON DELETE CASCADE", description: "Target Tier 2 Worker ID." },
      { name: "account_id", type: "uuid", constraints: "REFERENCES client_accounts(id) ON DELETE CASCADE", description: "The client inbox source assigned." },
      { name: "assigned_by", type: "uuid", constraints: "REFERENCES users(id)", description: "The Tier 1 Admin who initialized this authorization." },
      { name: "assigned_at", type: "timestamp", constraints: "DEFAULT now()", description: "Datetime tracking when assignment became active." }
    ]
  },
  {
    name: "filtered_otps",
    description: "Security filtered database storage containing ONLY extracted authentication tokens. Strictly isolated from the client's outer inbox body flows.",
    columns: [
      { name: "id", type: "uuid", constraints: "PRIMARY KEY DEFAULT gen_random_uuid()", description: "Filtered OTP identifier." },
      { name: "account_id", type: "uuid", constraints: "REFERENCES client_accounts(id) ON DELETE CASCADE", description: "Associated email inbox source." },
      { name: "sender", type: "varchar(255)", constraints: "NOT NULL", description: "Sender address (e.g. security@linkedin.com)." },
      { name: "subject", type: "varchar(500)", constraints: "NOT NULL", description: "Email subject line containing token references." },
      { name: "extracted_otp", type: "varchar(32)", constraints: "NOT NULL", description: "The clean numeric or alphanumeric verification code extracted via regex." },
      { name: "source_brand", type: "varchar(100)", constraints: "NOT NULL", description: "Extracted service context (e.g. 'Stripe', 'Google', 'WhatsApp')." },
      { name: "safeguard_snippet", type: "text", constraints: "NOT NULL", description: "Redacted surrounding context. Absolute raw body content is discarded post-processing to avoid GDPR violations." },
      { name: "timestamp", type: "timestamp", constraints: "DEFAULT now()", description: "Incoming mail timestamp registered by SMTP layers." },
      { name: "created_at", type: "timestamp", constraints: "DEFAULT now()", description: "Database entry creation time." }
    ]
  },
  {
    name: "activity_audit_logs",
    description: "Immutable, chronological register tracking console activities for legal audit compliance.",
    columns: [
      { name: "id", type: "uuid", constraints: "PRIMARY KEY DEFAULT gen_random_uuid()", description: "Audit serial key." },
      { name: "actor_id", type: "varchar(255)", description: "Identifier of the actor or system daemon triggering the audit log." },
      { name: "action_type", type: "varchar(100)", description: "Operation class (e.g. 'AUTH_OAUTH_EXCHANGE', 'OTP_DECRYPT', 'OTP_COPY_EVENT', 'ACCESS_VIOLATION')" },
      { name: "details", type: "text", description: "Descriptive string explaining context, targets, and signature headers." },
      { name: "status", type: "varchar(50)", description: "System level response status: 'success' | 'warning' | 'error'." },
      { name: "ip_address", type: "varchar(45)", description: "IP of client terminal initiating request." },
      { name: "user_agent", type: "text", description: "Navigator user agent string." },
      { name: "created_at", type: "timestamp", constraints: "DEFAULT now()", description: "Chronological ledger stamp." }
    ]
  }
];

export function DocCenter() {
  const [activeTab, setActiveTab] = useState<"diagram" | "schema" | "api" | "folder" | "security" | "plan">("diagram");
  const [expandedTable, setExpandedTable] = useState<string | null>("client_accounts");

  // Checklist state
  const [checklist, setChecklist] = useState([
    { id: "c1", text: "Store OAuth tokens in encrypted text blocks via AES-256-GCM (No plain text store)", category: "Storage", checked: true },
    { id: "c2", text: "Integrate Google G Suite & Microsoft Azure Active Directory under scoped client credentials Only", category: "Auth", checked: true },
    { id: "c3", text: "Enforce JSON Web Tokens (JWT) signed using modern SHA-256 signatures with 15-minute expirations", category: "Auth", checked: true },
    { id: "c4", text: "Require TOTP Multi-factor validation for Tier 2 personnel to bypass OTP-extract access boards", category: "Auth", checked: true },
    { id: "c5", text: "Implement automatic regex extraction to prevent storing redundant non-OTP corporate emails (GDPR Art. 5)", category: "GDPR", checked: true },
    { id: "c6", text: "Log audit ledger trails inside immutable database structures with recorded client header IPs", category: "Compliance", checked: true },
    { id: "c7", text: "Expose Express routes behind sliding window rate-limiter layers (express-rate-limit)", category: "Infrastructure", checked: false },
    { id: "c8", text: "Wipe associated tokens, OTP feeds, and audit keys completely upon Tenant Client delete requests", category: "GDPR", checked: false }
  ]);

  const toggleChecklist = (id: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const checklistProgress = Math.round((checklist.filter(c => c.checked).length / checklist.length) * 100);

  // API Tester State
  const [selectedApiCode, setSelectedApiCode] = useState<string>("auth_exchange");
  const [testPayload, setTestPayload] = useState(
    JSON.stringify({ code: "4/0AdQt8qi...", provider: "google" }, null, 2)
  );
  const [testResponse, setTestResponse] = useState<any>(null);
  const [apiTesting, setApiTesting] = useState(false);

  const apiEndpoints = [
    {
      id: "auth_exchange",
      name: "Token Exchange Handshake",
      method: "POST",
      path: "/api/v1/auth/token-exchange",
      desc: "Exchanges OAuth code from provider redirects with dynamic AES-256 tokenization.",
      payload: { code: "4/0AdQt8qi128hf8g9h389g8h", provider: "google" },
      response: {
        status: "success",
        account_id: "acc_901aef",
        email: "jane.m@millergrowth.com",
        scopes_validated: ["https://www.googleapis.com/auth/gmail.readonly"],
        token_cipher: "encrypted_hex_block_gcm"
      }
    },
    {
      id: "get_otps",
      name: "Retrieve OTP Feed (Tier 2)",
      method: "GET",
      path: "/api/v1/emails/otps",
      desc: "Fetches security-filtered verification codes assigned to the active worker. Raw bodies strictly redacted.",
      payload: {},
      response: {
        status: "success",
        count: 2,
        tokens_captured: [
          {
            id: "otp_8920",
            source: "LinkedIn",
            otp: "492049",
            ingested_at: "2026-06-09T18:43:10Z"
          }
        ]
      }
    },
    {
      id: "disconnect",
      name: "Revoke Integration (Tier 1)",
      method: "POST",
      path: "/api/v1/clients/disconnect",
      desc: "Deletes OAuth integration records, scrubs tokens from Postgres, and triggers complete erasure across filtered tables.",
      payload: { account_id: "acc_1" },
      response: {
        status: "success",
        message: "Account disconnected successfully. Safe-wipe client triggers verified completed under GDPR regulations."
      }
    }
  ];

  const handleRunApiTest = () => {
    setApiTesting(true);
    setTimeout(() => {
      const activeApi = apiEndpoints.find(api => api.id === selectedApiCode);
      if (activeApi) {
        setTestResponse(activeApi.response);
      }
      setApiTesting(false);
    }, 600);
  };

  const handleSelectApi = (apiId: string) => {
    setSelectedApiCode(apiId);
    const activeApi = apiEndpoints.find(api => api.id === apiId);
    if (activeApi) {
      setTestPayload(JSON.stringify(activeApi.payload, null, 2));
      setTestResponse(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Interactive Tabs Menu */}
      <div className="flex flex-wrap border-b border-gray-100 gap-1 bg-white p-2 rounded-xl border">
        <button
          onClick={() => setActiveTab("diagram")}
          className={`px-4 py-2 text-xs font-sans font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "diagram" ? "bg-indigo-600 text-white shadow-sm" : "hover:bg-gray-50 text-gray-600"
          }`}
        >
          <Network className="h-4 w-4" />
          System Diagram
        </button>
        <button
          onClick={() => setActiveTab("schema")}
          className={`px-4 py-2 text-xs font-sans font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "schema" ? "bg-indigo-600 text-white shadow-sm" : "hover:bg-gray-50 text-gray-600"
          }`}
        >
          <Database className="h-4 w-4" />
          Database Schema
        </button>
        <button
          onClick={() => setActiveTab("api")}
          className={`px-4 py-2 text-xs font-sans font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "api" ? "bg-indigo-600 text-white shadow-sm" : "hover:bg-gray-50 text-gray-600"
          }`}
        >
          <Code className="h-4 w-4" />
          API Route Structure
        </button>
        <button
          onClick={() => setActiveTab("folder")}
          className={`px-4 py-2 text-xs font-sans font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "folder" ? "bg-indigo-600 text-white shadow-sm" : "hover:bg-gray-50 text-gray-600"
          }`}
        >
          <FolderTree className="h-4 w-4" />
          Folder Structure
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`px-4 py-2 text-xs font-sans font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "security" ? "bg-indigo-600 text-white shadow-sm" : "hover:bg-gray-50 text-gray-600"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Security Checklist
        </button>
        <button
          onClick={() => setActiveTab("plan")}
          className={`px-4 py-2 text-xs font-sans font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "plan" ? "bg-indigo-600 text-white shadow-sm" : "hover:bg-gray-50 text-gray-600"
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Implementation Plan
        </button>
      </div>

      {/* Primary Panels */}
      <div id="docs-content" className="bg-white rounded-xl border border-gray-100 p-6 min-h-[450px]">
        
        {/* TAB 1: SYSTEM ARCHITECTURE DIAGRAM */}
        {activeTab === "diagram" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-display font-bold text-gray-950">WeApply4U Secure Cryptographic Ingestion Architecture</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
                The diagram models least-privilege compartmentalization. Corporate inboxes pass credentials through stateful token exchanges, storing keys encrypted via AES-256. Tier 2 workers reside strictly in filtered boundaries.
              </p>
            </div>

            {/* Rendered Flow diagram */}
            <div className="border border-gray-200 rounded-xl p-6 bg-slate-950 text-stone-200 flex flex-col items-center">
              
              <div className="grid grid-cols-1 md:grid-cols-3 w-full gap-6 relative">
                
                {/* Column 1: Client Email Servers */}
                <div className="flex flex-col items-center gap-4 border border-teal-800/40 p-4 rounded-lg bg-teal-950/20 relative">
                  <span className="text-[10px] font-mono font-bold bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded uppercase">
                    Provider layer
                  </span>
                  <div className="space-y-2.5 w-full text-center">
                    <div className="bg-slate-900 border border-slate-800 p-2.5 rounded text-xs">
                      <strong className="block text-slate-200">Gmail IMAP servers</strong>
                      <code className="text-[9px] text-teal-400 mt-0.5 font-mono block">Scope: gmail.readonly</code>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-2.5 rounded text-xs">
                      <strong className="block text-slate-200">Microsoft Graph Outlook</strong>
                      <code className="text-[9px] text-teal-400 mt-0.5 font-mono block">Scope: Mail.Read</code>
                    </div>
                  </div>
                  <div className="text-[10px] text-teal-300 italic max-w-[180px] text-center font-sans">
                    OAuth 2.0 Identity Consent Flow (No passwords)
                  </div>
                </div>

                {/* Column 2: Ingest Sync Worker & Token Decrypt */}
                <div className="flex flex-col items-center gap-4 border border-indigo-800/40 p-4 rounded-lg bg-indigo-950/20">
                  <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded uppercase flex items-center gap-1 animate-pulse">
                    <span className="h-1.5 w-1.5 bg-indigo-400 rounded-full"></span>
                    Secure Ingestion Node
                  </span>
                  
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded text-xs w-full text-center space-y-2">
                    <strong className="text-indigo-300 block">WeApply4U Sync Engine</strong>
                    <div className="text-[10px] text-stone-400 text-left bg-stone-950 p-1.5 rounded space-y-1 font-mono">
                      <div>1. Pull encrypted ref-key from Postgres.</div>
                      <div>2. Decrypt key using master KMS secret.</div>
                      <div>3. Request new short-lived access bearer.</div>
                      <div>4. Fetch inbox envelopes via IMAP API.</div>
                      <div>5. Run Regex filter for code isolation.</div>
                    </div>
                  </div>

                  <div className="bg-rose-950/40 border border-rose-800/40 p-2 rounded text-[10px] text-rose-300 text-center font-mono w-full">
                    CRYPT MASTER Key Storage (AES-256GCM)
                  </div>
                </div>

                {/* Column 3: Postgres DB Schemas / Client Views */}
                <div className="flex flex-col items-center gap-4 border border-purple-805/40 p-4 rounded-lg bg-purple-950/20">
                  <span className="text-[10px] font-mono font-bold bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded uppercase">
                    PostgreSQL Isolation
                  </span>
                  <div className="space-y-2.5 w-full text-center">
                    <div className="bg-slate-900 border border-rose-500/30 p-2.5 rounded text-xs">
                      <strong className="text-rose-400 block flex items-center justify-center gap-1">
                        🔒 Admin Schema
                      </strong>
                      <span className="text-[9px] text-slate-400">Stores Encrypted OAuth Tokens, Worker Auth, Audit Logs</span>
                    </div>
                    <div className="bg-slate-900 border border-emerald-500/30 p-2.5 rounded text-xs">
                      <strong className="text-emerald-400 block flex items-center justify-center gap-1">
                        ✔️ Isolated OTP Schema
                      </strong>
                      <span className="text-[9px] text-slate-400">Stores Plain Regex OTP values post-filtering. Raw headers deleted!</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-stone-400 italic max-w-[180px] text-center font-sans">
                    Tier 2 workers only queries Isolated OTP Schema! No access to decrypted tokens or Raw email bodies.
                  </div>
                </div>

              </div>

              {/* Connecting Legend */}
              <div className="mt-6 border-t border-slate-800 pt-4 w-full text-center text-xs text-stone-400 leading-relaxed font-sans max-w-2xl">
                <strong className="text-stone-200">Legal Posture Compliance Summary (GDPR and SOC2):</strong>
                <p className="mt-1">
                  By discarding non-OTP email records immediately after compilation and isolating the raw text content inside our cryptographically-shielded Sync Engine, WeApply4U prevents corporate mail caching and protects sensitive client files from leakage.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: POSTGRESQL / DATABASE SCHEMA */}
        {activeTab === "schema" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-display font-bold text-gray-950">PostgreSQL (Drizzle ORM) Schema Outlines</h3>
              <p className="text-xs text-gray-500 mt-1">
                Expand each model node below to analyze the relational keys, datatypes, and column-level encryptions.
              </p>
            </div>

            <div className="space-y-3">
              {schemaTables.map((table) => (
                <div key={table.name} className="border border-gray-100 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
                    className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100/75 flex items-center justify-between transition-colors font-sans focus:outline-hidden"
                  >
                    <div>
                      <span className="font-mono font-bold text-sm text-indigo-700">{table.name}</span>
                      <p className="text-[11px] text-gray-500 mt-0.5">{table.description}</p>
                    </div>
                    {expandedTable === table.name ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </button>

                  <AnimatePresence>
                    {expandedTable === table.name && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-gray-100 overflow-x-auto bg-white"
                      >
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 font-mono">
                              <th className="px-4 py-2.5 font-semibold">Column</th>
                              <th className="px-4 py-2.5 font-semibold">Data Type</th>
                              <th className="px-4 py-2.5 font-semibold">Constraints</th>
                              <th className="px-4 py-2.5 font-semibold">Security / Purpose</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {table.columns.map((col, index) => (
                              <tr key={index} className="hover:bg-gray-50/30">
                                <td className="px-4 py-2.5 font-mono font-semibold text-gray-900">{col.name}</td>
                                <td className="px-4 py-2.5 font-mono text-indigo-600 font-medium">{col.type}</td>
                                <td className="px-4 py-2.5 font-mono text-gray-500 text-[11px]">{col.constraints || "-"}</td>
                                <td className="px-4 py-2.5 font-sans text-gray-600 text-[11px]">{col.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: API ROUTE STRUCTURE & DEMO */}
        {activeTab === "api" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-display font-bold text-gray-950">Secure RESTful API Infrastructure Node</h3>
              <p className="text-xs text-gray-500 mt-1 mb-4 leading-relaxed">
                Interact with our mock API console below. Choose a safe service endpoint, supply simulation payloads, and review the structural telemetry returned by the secure server cluster.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 border border-gray-200 rounded-xl overflow-hidden bg-gray-50 p-4">
              
              {/* Endpoint selection */}
              <div className="lg:col-span-4 space-y-2">
                <span className="text-[10px] font-mono text-gray-450 uppercase tracking-widest font-bold">API Endpoints Ledger</span>
                {apiEndpoints.map((api) => (
                  <button
                    key={api.id}
                    onClick={() => handleSelectApi(api.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-xs flex flex-col gap-1 cursor-pointer ${
                      selectedApiCode === api.id 
                        ? "bg-slate-900 border-slate-900 text-white shadow-xs" 
                        : "bg-white border-gray-150 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className={`px-1 rounded text-[9px] font-bold uppercase ${
                        api.method === "POST" ? "bg-amber-500 text-slate-950" : "bg-emerald-500 text-white"
                      }`}>
                        {api.method}
                      </span>
                      <span className="font-semibold text-[10px] truncate">{api.path}</span>
                    </div>
                    <span className="font-sans font-bold text-[11px] leading-tight block">{api.name}</span>
                  </button>
                ))}
              </div>

              {/* Console & JSON editor */}
              <div className="lg:col-span-8 flex flex-col bg-white rounded-lg border border-gray-200 p-4 shadow-xs justify-between min-h-[340px]">
                <div>
                  <div className="flex items-center justify-between border-b border-gray-150 pb-2 mb-3">
                    <span className="text-[11px] text-gray-500 font-mono uppercase tracking-widest">
                      Endpoint Telemetry Workspace
                    </span>
                    <button
                      onClick={handleRunApiTest}
                      disabled={apiTesting}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 text-white text-xs font-semibold rounded font-sans transition-colors cursor-pointer"
                    >
                      <Send className="h-3 w-3" />
                      {apiTesting ? "Polling..." : "Simulate Endpoint"}
                    </button>
                  </div>

                  {/* Endpoint desc */}
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                    <strong>Description:</strong> {apiEndpoints.find(a => a.id === selectedApiCode)?.desc}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Request editor */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-gray-400 block uppercase">JSON Request Payload</span>
                      <textarea
                        value={testPayload}
                        onChange={(e) => setTestPayload(e.target.value)}
                        rows={7}
                        className="w-full bg-slate-950 text-emerald-400 p-2.5 rounded font-mono text-[10px] border border-gray-200 focus:outline-hidden"
                      />
                    </div>

                    {/* Response viewer */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-gray-400 block uppercase">Response JSON Spectrum</span>
                      <pre className="bg-slate-900 text-slate-200 p-2.5 rounded font-mono text-[10px] overflow-x-auto border border-gray-200 h-[142px] max-h-[142px] select-all">
                        {testResponse 
                          ? JSON.stringify(testResponse, null, 2)
                          : "// Click \"Simulate Endpoint\" to read responses"
                        }
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Micro-snippet */}
                <div className="pt-3 border-t border-gray-150 mt-3 font-mono text-[10px] text-gray-400">
                  Authentication Headers Required: <code className="bg-gray-50 text-gray-600 px-1 py-0.5 border border-gray-150 rounded">Authorization: Bearer &lt;JWT&gt;</code>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 4: FOLDER STRUCTURE */}
        {activeTab === "folder" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-display font-bold text-gray-950">Production Repository Workspace Tree</h3>
              <p className="text-xs text-gray-500 mt-1">
                Below is the standard, production-grade folder structure for the full-stack architecture of WeApply4U Mail Manager.
              </p>
            </div>

            <div className="p-4 bg-slate-950 text-stone-300 rounded-xl font-mono text-xs overflow-x-auto border border-slate-900 space-y-1.5">
              <div>weapply4u-mail-manager/</div>
              <div className="pl-4 text-stone-500">├── dist/ <span className="text-stone-500 font-sans italic">// Compiled Node server CJS bundles & static client distributables</span></div>
              <div className="pl-4">├── src/ <span className="text-stone-500 font-sans italic">// Main source code folder</span></div>
              <div className="pl-8">├── db/ <span className="text-indigo-400 font-sans italic">// Drizzle database configurations</span></div>
              <div className="pl-12">├── schema.ts <span className="text-emerald-400 font-sans italic">// Tables, relations, columns maps definitions</span></div>
              <div className="pl-12">└── index.ts <span className="text-stone-400 font-sans italic">// Postgres node pools integrations</span></div>
              <div className="pl-8">├── server/ <span className="text-indigo-400 font-sans italic">// Node Express server backend controllers</span></div>
              <div className="pl-12">├── middlewares/ <span className="text-stone-400 font-sans italic">// Auth validation, 2FA checking files, Rate-limit parameters</span></div>
              <div className="pl-12">├── controllers/ <span className="text-stone-400 font-sans italic">// Route processors, OAuth code validation logics</span></div>
              <div className="pl-12">├── services/ <span className="text-stone-400 font-sans italic">// IMAP sync background workers, regex processing algorithms</span></div>
              <div className="pl-12">└── routes/ <span className="text-stone-400 font-sans italic">// Route registrations (auth, clients, filter)</span></div>
              <div className="pl-8">└── client/ <span className="text-indigo-400 font-sans italic">// Front-end modern React application code</span></div>
              <div className="pl-12">├── components/ <span className="text-stone-400 font-sans italic">// Component layers (Dashboards, Doc-center hubs...)</span></div>
              <div className="pl-12">└── App.tsx <span className="text-stone-400 font-sans italic">// Central routing control console</span></div>
              <div className="pl-4 text-stone-500">├── drizzle.config.ts <span className="text-stone-500 font-sans italic">// Database migration maps configs</span></div>
              <div className="pl-4 text-stone-500">├── package.json <span className="text-stone-500 font-sans italic">// System scripts and manifest</span></div>
              <div className="pl-4 text-stone-500">└── tsconfig.json <span className="text-stone-500 font-sans italic">// Strict TypeScript declarations declarations</span></div>
            </div>
          </div>
        )}

        {/* TAB 5: SECURITY AUDIT CHECKLIST */}
        {activeTab === "security" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-display font-bold text-gray-950">Security & GDPR Compliance Checklist</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Review and interaction-toggle security compliance covenants required under WeApply4U regulations.
                </p>
              </div>

              {/* Progress bar */}
              <div className="text-right shrink-0">
                <span className="text-xs font-mono font-bold text-indigo-650 uppercase tracking-widest block mb-1">
                  Covenant Progress: {checklistProgress}%
                </span>
                <div className="w-[180px] bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${checklistProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {checklist.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => toggleChecklist(item.id)}
                  className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                    item.checked 
                      ? "bg-indigo-50/40 border-indigo-100 text-gray-800" 
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <div className={`mt-0.5 rounded border h-4.5 w-4.5 flex-shrink-0 flex items-center justify-center transition-all ${
                    item.checked ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-300"
                  }`}>
                    {item.checked && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                  <div>
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-1 py-0.5 rounded-sm mr-2">
                      {item.category}
                    </span>
                    <p className="text-xs font-sans mt-1 font-semibold leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: IMPLEMENTATION PLAN */}
        {activeTab === "plan" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-display font-bold text-gray-950">Step-by-Step Production Integration Schedule</h3>
              <p className="text-xs text-gray-500 mt-1">
                Follow this 6-Phase development schedule to initialize, build, and ship modern mail filter applications on Google Cloud and PostgreSQL.
              </p>
            </div>

            <div className="relative border-l border-indigo-150 pl-5 ml-2.5 space-y-6 py-1">
              
              <div className="relative">
                <div className="absolute -left-7.5 h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center border-4 border-white text-[9px] font-mono font-bold">
                  1
                </div>
                <h4 className="font-display font-bold text-slate-900 text-sm">Phase 1: Database & Migrations Bootstrapping</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Generate database layers using Drizzle schema files. Install Postgres nodes and provision tables for <code className="bg-gray-50 px-1 border border-gray-200">client_accounts</code>, <code className="bg-gray-50 px-1 border border-gray-200">filtered_otps</code>, and <code className="bg-gray-50 px-1 border border-gray-200">activity_audit_logs</code>. Confirm constraints and foreign reference integrity.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-7.5 h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center border-4 border-white text-[9px] font-mono font-bold">
                  2
                </div>
                <h4 className="font-display font-bold text-slate-900 text-sm">Phase 2: Scoped Provider Registers (OAuth 2.0 Client Credentials)</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Configure corporate redirect credentials inside Google Cloud Console and Microsoft App Registration portals. Force scope limitations. Establish server-side callbacks to exchange auth codes for persistent refresh tokens.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-7.5 h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center border-4 border-white text-[9px] font-mono font-bold">
                  3
                </div>
                <h4 className="font-display font-bold text-slate-900 text-sm">Phase 3: AES-256GCM Envelope Cryptography Layer</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Write encryption and decryption helper classes in Node.js server directories utilizing the default <code className="bg-gray-50 px-1 border border-gray-200">crypto</code> standard framework. Apply unique Salt vectors for every client token generated, hashing secrets against <code className="bg-gray-50 px-1 border border-gray-200">process.env.TOKEN_ENCRYPTION_SECRET</code>.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-7.5 h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center border-4 border-white text-[9px] font-mono font-bold">
                  4
                </div>
                <h4 className="font-display font-bold text-slate-900 text-sm">Phase 4: Sync Engine Ingest & Regular Expression Extractor</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Write background cron loops that fetch messages from inboxes using decrypted tokens. Standardize a Regex processor targeting numeric configurations (e.g. <code className="bg-gray-50 px-1 border border-gray-200">/\b\d{"{6}"}\b/g</code>). Build context strings, filter OTPs, write matching code blocks to DB, then release original mail content.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-7.5 h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center border-4 border-white text-[9px] font-mono font-bold">
                  5
                </div>
                <h4 className="font-display font-bold text-slate-900 text-sm">Phase 5: Secure Express Routers & Role Access Claims</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Configure REST middleware validating JWT tokens. Read token payload attributes to determine employee roles. Restrict <code className="bg-gray-50 px-1 border border-gray-200">/api/v1/emails/otps</code> such that Tier 2 Workers are only fetched isolated, regex-extracted OTP records assigned by Admins.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-7.5 h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center border-4 border-white text-[9px] font-mono font-bold">
                  6
                </div>
                <h4 className="font-display font-bold text-slate-900 text-sm">Phase 6: Multi-Factor Authentication Enforcements</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Mandate Employee 2FA. Integrate authenticators using TOTP generator modules. Require verification on first-phase login schemas and when copier audit trails trigger on critical verification records.
                </p>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
