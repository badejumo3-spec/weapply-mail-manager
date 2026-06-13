import React, { useState } from "react";
import { 
  Mail, Users, Shield, RefreshCw, Plus, Trash2, Search, CheckCircle, 
  AlertTriangle, ExternalLink, Key, KeySquare, HelpCircle, Check, X, ShieldAlert 
} from "lucide-react";
import { EmailAccount, WorkerInfo, SystemLog, UserRole } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface DashboardAdminProps {
  accounts: EmailAccount[];
  workers: WorkerInfo[];
  logs: SystemLog[];
  otps?: any[];
  onAddAccount: (accountPayload: any) => Promise<boolean>;
  onDisconnectAccount: (id: string) => void;
  onAssignWorker: (accountId: string, workerId: string) => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
  onRefreshData?: () => void;
}

export function DashboardAdmin({
  accounts,
  workers,
  logs,
  otps = [],
  onAddAccount,
  onDisconnectAccount,
  onAssignWorker,
  onTriggerSync,
  isSyncing,
  onRefreshData
}: DashboardAdminProps) {
  // Local state for modal
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"google" | "microsoft" | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [password, setPassword] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState(993);
  const [oauthStep, setOauthStep] = useState<"setup" | "approving" | "success">("setup");
  const [connectionMethod, setConnectionMethod] = useState<"oauth" | "imap">("oauth");

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        setOauthStep("success");
        if (onRefreshData) {
          onRefreshData();
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onRefreshData]);
  
  // Search and filter for logs
  const [logFilter, setLogFilter] = useState<"all" | "actions" | "warnings">("all");
  const [logSearch, setLogSearch] = useState("");

  // Search for accounts
  const [accountSearch, setAccountSearch] = useState("");

  // Handle OAuth client addition setup
  const handleStartOAuth = (provider: "google" | "microsoft") => {
    setSelectedProvider(provider);
    setImapHost(provider === "google" ? "imap.gmail.com" : "outlook.office365.com");
    setImapPort(993);
    setPassword("");
    setOauthStep("setup");
    setShowOAuthModal(true);
    setConnectionMethod("oauth");
  };

  const handleOAuthClick = () => {
    if (!newClientName) {
      alert("Billing / Tenant Client Name is required before opening the identity gateway.");
      return;
    }
    setOauthStep("approving");
    
    const width = 600;
    const height = 750;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const popup = window.open(
      `/api/oauth/google/initiate?clientName=${encodeURIComponent(newClientName)}&token=${encodeURIComponent(localStorage.getItem("authToken") || "")}`,
      "google_oauth_popup",
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
    );
    
    if (!popup) {
      alert("Popup blocker active! Please allow popups to initiate Google connection.");
      setOauthStep("setup");
    }
  };

  const executeMockOAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientEmail || !password || !imapHost) {
      alert("All security parameters are required to configure an ingestion connection.");
      return;
    }
    
    // Switch to approving mode
    setOauthStep("approving");
    
    const success = await onAddAccount({
      clientName: newClientName,
      email: newClientEmail,
      provider: selectedProvider || "google",
      password: password,
      imapHost: imapHost,
      imapPort: Number(imapPort)
    });

    if (success) {
      setOauthStep("success");
    } else {
      setOauthStep("setup");
    }
  };

  const closeOAuthModal = () => {
    setShowOAuthModal(false);
    setSelectedProvider(null);
    setNewClientName("");
    setNewClientEmail("");
    setPassword("");
    setImapHost("");
    setImapPort(993);
    setOauthStep("setup");
    setConnectionMethod("oauth");
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    // search filter
    if (logSearch) {
      const searchLower = logSearch.toLowerCase();
      const matchSearch = log.action.toLowerCase().includes(searchLower) || log.actor.toLowerCase().includes(searchLower);
      if (!matchSearch) return false;
    }
    // log level filter
    if (logFilter === "actions") {
      return log.status === "success" && (log.action.includes("copied") || log.action.includes("connect"));
    }
    if (logFilter === "warnings") {
      return log.status === "warning" || log.status === "error";
    }
    return true;
  });

  const activeAccountsCount = accounts.filter(a => a.status === "connected").length;
  const expiredAccountsCount = accounts.filter(a => a.status === "expired").length;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div id="admin-overview" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Connected inbox count */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono font-medium text-gray-400 uppercase tracking-widest">Connected Inboxes</p>
              <h2 className="text-3xl font-display font-bold text-gray-900 mt-2">
                {activeAccountsCount}
                <span className="text-sm font-sans font-medium text-gray-400 ml-1">/ {accounts.length}</span>
              </h2>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Mail className="h-6 w-6" id="icon-connected-inboxes" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Auto-Sync Active
          </div>
        </div>

        {/* Workers count */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono font-medium text-gray-400 uppercase tracking-widest">Workers Count</p>
              <h2 className="text-3xl font-display font-bold text-gray-900 mt-2">
                {workers.length}
              </h2>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <Users className="h-6 w-6" id="icon-active-workers" />
            </div>
          </div>
          <div className="mt-4 text-xs font-medium text-gray-500">
            {workers.filter(w => w.status === "active").length} active now
          </div>
        </div>

        {/* Total OTPs today */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono font-medium text-gray-400 uppercase tracking-widest">Total OTPs Today</p>
              <h2 className="text-3xl font-display font-bold text-gray-900 mt-2">
                {workers.reduce((acc, curr) => acc + curr.otpCountToday, 0) || otps.length}
              </h2>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <Key className="h-6 w-6" id="icon-total-otps" />
            </div>
          </div>
          <div className="mt-4 text-xs font-medium text-gray-500">
            Passcode envelopes filtered today
          </div>
        </div>
      </div>

      {/* Main Grid: Client Connections & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Connected Client List */}
        <div className="bg-white rounded-xl border border-gray-100 lg:col-span-2 shadow-xs flex flex-col overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 bg-gray-50/50">
            <div>
              <h3 className="text-lg font-display font-semibold text-gray-900">Client Email Integrations</h3>
              <p className="text-xs text-gray-500 mt-0.5">Securely link inboxes with enterprise access tags.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-trigger-sync"
                onClick={onTriggerSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin text-indigo-600" : ""}`} />
                {isSyncing ? "Syncing..." : "Sync Now"}
              </button>
              
              <div className="relative">
                <button
                  id="btn-connect-new"
                  className="bg-indigo-600 hover:bg-indigo-700 font-sans inline-flex items-center gap-1 px-4 py-2 text-xs font-medium text-white rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  onClick={() => handleStartOAuth("google")}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Connect Client
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-gray-100 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search connected clients by name or email Address..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs text-gray-900 bg-gray-50 placeholder-gray-400 border border-gray-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all font-sans"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Tenant Client</th>
                  <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Integration</th>
                  <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Token Status</th>
                  <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Assigned Workers</th>
                  <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accounts
                  .filter(acc => {
                    if (!accountSearch) return true;
                    return acc.clientName.toLowerCase().includes(accountSearch.toLowerCase()) || acc.email.toLowerCase().includes(accountSearch.toLowerCase());
                  })
                  .map((account) => (
                    <motion.tr 
                      key={account.id}
                      layoutId={account.id}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="font-sans font-semibold text-gray-900 text-sm">{account.clientName}</div>
                        <div className="font-mono text-xs text-gray-400 mt-0.5">{account.email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          account.provider === "google" 
                            ? "bg-slate-100 text-slate-800"
                            : "bg-blue-50 text-blue-700"
                        }`}>
                          {account.provider === "google" ? "Gmail API" : "MS Graph"}
                          <span className="text-[10px] text-gray-400">OAuth 2.0</span>
                        </span>
                        <div className="text-[10px] text-gray-400 mt-1 font-mono">
                          Mails Check: {account.totalEmailsProcessed} total
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {account.status === "connected" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Active GCM
                          </span>
                        ) : account.status === "syncing" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Syncing
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100">
                            <AlertTriangle className="h-3 w-3" />
                            Token Expired
                          </span>
                        )}
                        <div className="text-[10px] text-gray-400 mt-1 font-mono">
                          Synced: {new Date(account.lastSyncedAt).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap gap-1">
                            {account.assignedWorkers.map(wId => {
                              const worker = workers.find(w => w.id === wId);
                              return (
                                <span key={wId} className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-sm text-[11px] font-sans">
                                  {worker ? worker.name : "Unknown"}
                                </span>
                              );
                            })}
                          </div>
                          {/* Assign Worker Select Trigger */}
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                onAssignWorker(account.id, e.target.value);
                                e.target.value = "";
                              }
                            }}
                            className="bg-white border border-gray-200 text-gray-500 rounded-sm px-1 py-0.5 text-[10px] font-sans focus:ring-1 focus:ring-indigo-500 w-full max-w-[130px]"
                          >
                            <option value="">+ Assign Worker</option>
                            {workers
                              .filter(w => !account.assignedWorkers.includes(w.id))
                              .map(w => (
                                <option key={w.id} value={w.id}>
                                  {w.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => onDisconnectAccount(account.id)}
                          className="hover:text-red-700 text-gray-400 p-1.5 hover:bg-rose-50 rounded-lg transition-colors inline-flex justify-center items-center cursor-pointer"
                          title="Revoke and Delete OAuth Access Token"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
              </tbody>
            </table>
            {accounts.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-xs">
                No active corporate integrations detected. Connect one above.
              </div>
            )}
          </div>
        </div>

        {/* Worker Roster Sidepanel */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-xs h-fit">
          <h3 className="text-lg font-display font-semibold text-gray-900">Worker Access Groups</h3>
          <p className="text-xs text-gray-500 mt-1">Tier 2 personnel restricted strictly to filtered security OTP envelopes.</p>
          
          <div className="mt-4 divide-y divide-gray-100">
            {workers.map((worker) => (
              <div key={worker.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-sans font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                    {worker.name}
                    {worker.status === "active" ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Active"></span>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-300" title="Offline"></span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-gray-400">{worker.email}</div>
                  
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-sm font-mono text-slate-700 font-medium uppercase">
                      Tier 2 Worker
                    </span>
                    {worker.twoFactorEnabled ? (
                      <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                        <Shield className="h-2.5 w-2.5" /> 2FA Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" /> 2FA Missing
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 font-mono">
                    {worker.activeInboxes} Inboxes
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {worker.otpCountToday} OTPs today
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-indigo-50/50 border border-indigo-100/30 rounded-lg text-xs leading-relaxed text-indigo-900/80">
            <h4 className="font-display font-semibold text-indigo-900 flex items-center gap-1 mb-1">
              <Shield className="h-3.5 w-3.5" /> Role-Based Constraint
            </h4>
            Tier-2 Workers do not have credentials inside the OAuth systems. They query filtered database schemas populated purely by matching regex filters.
          </div>
        </div>

      </div>

      {/* Activity Logs Ledger */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-display font-semibold text-gray-900">Audit Ledger & Activity Logs</h3>
            <p className="text-xs text-gray-500 mt-0.5">Immutable system trails tracking every token check, regex hit, and worker copy event.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
              <button 
                onClick={() => setLogFilter("all")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${logFilter === "all" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"}`}
              >
                All System
              </button>
              <button 
                onClick={() => setLogFilter("actions")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${logFilter === "actions" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"}`}
              >
                Actions
              </button>
              <button 
                onClick={() => setLogFilter("warnings")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${logFilter === "warnings" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"}`}
              >
                Warnings/Errors
              </button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Find in logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="pl-8 pr-3 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-sans focus:outline-hidden focus:border-indigo-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 max-h-[300px] overflow-y-auto font-mono text-xs divide-y divide-gray-50">
          {filteredLogs.map((log) => (
            <div key={log.id} className="py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-gray-50/50 px-2 transition-colors">
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 inline-block h-2 w-2 rounded-full flex-shrink-0 ${
                  log.status === "success" 
                    ? "bg-emerald-400" 
                    : log.status === "warning" 
                    ? "bg-amber-400" 
                    : "bg-rose-500"
                }`}></span>
                <div>
                  <span className="text-gray-400 mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className="font-semibold text-gray-800 mr-2">{log.actor} ({log.role}):</span>
                  <span className="text-gray-600">{log.action}</span>
                </div>
              </div>
              <div className="text-right text-[10px] text-gray-400 self-end md:self-center">
                IP: {log.ipAddress}
              </div>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No matching activity files found in this window.
            </div>
          )}
        </div>
      </div>

      {/* COMPACT INTERACTIVE OAUTH SIMULATION MODAL */}
      <AnimatePresence>
        {showOAuthModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl border border-gray-100 max-w-lg w-full overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-indigo-600 animate-pulse" />
                  <span className="font-display font-bold text-gray-900 text-base">
                    Secure Client OAuth Integration Gateway
                  </span>
                </div>
                <button 
                  onClick={closeOAuthModal}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Step Render */}
              {oauthStep === "setup" && (
                <div className="p-5 space-y-4">
                  {/* Scope Selection Method Tabs */}
                  <div className="bg-gray-100 p-1 rounded-lg flex">
                    <button
                      type="button"
                      onClick={() => {
                        setConnectionMethod("oauth");
                        setSelectedProvider("google");
                      }}
                      className={`flex-1 text-center py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        connectionMethod === "oauth"
                          ? "bg-white text-gray-900 shadow-xs"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Method 1: Google OAuth (Rec.)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConnectionMethod("imap");
                        setSelectedProvider("google");
                      }}
                      className={`flex-1 text-center py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        connectionMethod === "imap"
                          ? "bg-white text-gray-900 shadow-xs"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Method 2: IMAP Fallback
                    </button>
                  </div>

                  {connectionMethod === "oauth" ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-emerald-50 border border-emerald-100/30 rounded-lg text-xs text-emerald-900">
                        <p className="font-semibold flex items-center gap-1 mb-1 text-emerald-800">
                          <Shield className="h-3.5 w-3.5 text-emerald-600" />
                          Recommended Connection Protocol
                        </p>
                        Secure OAuth 2.0 delegates transient email readonly access tokens. Credentials or permanent app passwords are never processed. Encrypted refresh tokens are locked with AES-256.
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
                          Billing / Tenant Client Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Acme Corp Inc."
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      <div className="pt-4 pb-2 text-center border-t border-gray-100">
                        <button
                          type="button"
                          onClick={handleOAuthClick}
                          className="inline-flex items-center gap-2.5 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-md transition-colors border border-slate-800"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          Connect with Google Account
                        </button>
                        <p className="text-[10px] text-gray-400 mt-2.5 max-w-xs mx-auto leading-relaxed">
                          Launches secure Google authentication sequence to verify client credentials and retrieve Gmail access tokens.
                        </p>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex justify-end">
                        <button
                          type="button"
                          onClick={closeOAuthModal}
                          className="px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg shadow-2xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={executeMockOAuth} className="space-y-4">
                      <div className="p-3 bg-amber-50 border border-amber-100/30 rounded-lg text-xs text-amber-900">
                        <p className="font-semibold flex items-center gap-1 mb-1 text-amber-800">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          Legacy Integration Protocol
                        </p>
                        Requires active Google App Password or MS App validation tokens. Passwords must be encrypted using 256-bit AES algorithms.
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
                          Authentication Provider
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProvider("google");
                              setImapHost("imap.gmail.com");
                            }}
                            className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer h-20 ${
                              selectedProvider === "google" 
                                ? "border-slate-800 bg-slate-50 text-slate-900" 
                                : "border-gray-200 hover:bg-gray-50 text-gray-600"
                            }`}
                          >
                            <span className="text-xs font-mono font-bold">Google API</span>
                            <span className="text-[10px] text-gray-400">IMAP Gmail Server</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProvider("microsoft");
                              setImapHost("outlook.office365.com");
                            }}
                            className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer h-20 ${
                              selectedProvider === "microsoft" 
                                ? "border-blue-600 bg-blue-50/30 text-blue-900" 
                                : "border-gray-200 hover:bg-gray-50 text-gray-600"
                            }`}
                          >
                            <span className="text-xs font-mono font-bold">MS Graph API</span>
                            <span className="text-[10px] text-gray-400">Microsoft Exchange</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
                          Billing / Tenant Client Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Acme Corp Inc."
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
                          Principal Corporate Email Address
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. administrator@acme.com"
                          value={newClientEmail}
                          onChange={(e) => setNewClientEmail(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
                          IMAP Connection App Password
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="Enter 16-character SMTP/IMAP App Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                        />
                        <span className="text-[10px] text-gray-400 mt-0.5 block italic leading-snug">
                          Requires a standard 16-digit Google or Microsoft external app authentication credentials.
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
                            IMAP Host
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. imap.gmail.com"
                            value={imapHost}
                            onChange={(e) => setImapHost(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
                            IMAP Port
                          </label>
                          <input
                            type="number"
                            required
                            value={imapPort}
                            onChange={(e) => setImapPort(Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                          />
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={closeOAuthModal}
                          className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                        >
                          Initialize Auth Handshake
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {oauthStep === "approving" && (
                <div className="p-8 text-center space-y-4">
                  <div className="inline-flex p-3 bg-indigo-50 rounded-full text-indigo-600 animate-spin">
                    <RefreshCw className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-display font-semibold text-gray-900">Polling Identity Consent Callback</h4>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      Negotiating client authorization code, establishing key agreement parameters, and generating AES-256 crypt envelope in secure transient storage...
                    </p>
                  </div>
                </div>
              )}

              {oauthStep === "success" && (
                <div className="p-6 text-center space-y-4">
                  <div className="inline-flex p-3 bg-emerald-50 text-emerald-600 rounded-full">
                    <Check className="h-8 w-8" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-display font-semibold text-gray-900">Integration Connected Sucessfully!</h4>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      Client <strong className="text-gray-900">{newClientName}</strong> was authenticated securely. We have catalogued their refresh tokens and mapped ingestion channels.
                    </p>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 max-w-xs mx-auto text-[10px] font-mono text-left text-slate-600">
                      IV: <span className="text-emerald-600">ae21f3fa10d02...</span><br />
                      Cipher: <span className="text-indigo-600">f94b8e219011af...</span>
                    </div>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={closeOAuthModal}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-lg text-xs font-medium cursor-pointer"
                    >
                      Return to Dashboard
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
