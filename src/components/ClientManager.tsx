import { useState, useEffect } from "react";
import { Plus, Trash2, KeyRound, Globe, Wifi, AlertTriangle, Layers, Calendar, ChevronRight, Check } from "lucide-react";
import { Client } from "../types";

interface ClientManagerProps {
  clients: Client[];
  loading: boolean;
  onRefresh: () => void;
  token: string;
}

export default function ClientManager({ clients, loading, onRefresh, token }: ClientManagerProps) {
  const [showImapForm, setShowImapForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [email, setEmail] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleOAuthConnect = async () => {
    setOauthLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clients/oauth-link", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to retrieve OAuth authorization URL.");
      
      // Redirect host window directly
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || "OAuth redirection failure.");
      setOauthLoading(false);
    }
  };

  const handleImapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !email || !imapHost || !password) {
      setError("Please fill in all requested IMAP credentials.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/clients/imap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          client_name: clientName,
          email,
          imap_host: imapHost,
          imap_port: parseInt(imapPort, 10),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "IMAP client connection rejected.");

      // Clear fields
      setClientName("");
      setEmail("");
      setImapHost("");
      setImapPort("993");
      setPassword("");
      setShowImapForm(false);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || "Server rejected registration.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async (id: number) => {
    if (!window.confirm("Are you sure you want to stop syncing this inbox? All associated emails will be permanently removed.")) {
      return;
    }

    setError(null);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete client mailbox.");

      onRefresh();
    } catch (err: any) {
      setError(err?.message || "Removal unsuccessful.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview stats & actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Layers className="h-4.5 w-4.5 text-indigo-600" />
            <span>Target Mailbox Connections</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Linked Gmail (OAuth 2.0) and corporate fallback sources</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Gmail OAuth button */}
          <button
            id="oauth-connect-btn"
            disabled={oauthLoading}
            onClick={handleOAuthConnect}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>{oauthLoading ? "Redirecting..." : "Connect Google API"}</span>
          </button>

          {/* IMAP toggle button */}
          <button
            id="imap-form-toggle-btn"
            onClick={() => setShowImapForm(!showImapForm)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Connect IMAP Fallback</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start space-x-2.5 p-4 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-150 italic animate-fadeIn">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Error details: {error}</span>
        </div>
      )}

      {/* Manual IMAP Setup Panel Form */}
      {showImapForm && (
        <form onSubmit={handleImapSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <KeyRound className="h-4 w-4 text-indigo-600" />
              <span>Link New Fallback IMAP Mailbox</span>
            </h3>
            <button 
              type="button" 
              onClick={() => setShowImapForm(false)} 
              className="text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              Cancel Form
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Client Name Reference</label>
              <input
                id="imap-client-name"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Acme Corp Inc"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg text-xs font-medium text-slate-800 transition-all focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Email Address (Login)</label>
              <input
                id="imap-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. sync@acme.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg text-xs font-medium text-slate-800 transition-all focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">IMAP Host Address</label>
              <input
                id="imap-host"
                type="text"
                value={imapHost}
                onChange={(e) => setImapHost(e.target.value)}
                placeholder="e.g. imap.gmail.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg text-xs font-medium text-slate-800 transition-all focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">IMAP Port</label>
                <input
                  id="imap-port"
                  type="number"
                  value={imapPort}
                  onChange={(e) => setImapPort(e.target.value)}
                  placeholder="993"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg text-xs font-medium text-slate-800 transition-all focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Security Password</label>
                <input
                  id="imap-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg text-xs font-medium text-slate-800 transition-all focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              id="imap-submit-btn"
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
            >
              {submitting ? "Testing Connection..." : "Register Fallback Connection"}
            </button>
          </div>
        </form>
      )}

      {/* Directory Grid of connected sources */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <div className="animate-spin inline-block h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full mb-2" />
          <p className="text-xs text-slate-400 font-medium font-mono">Synchronizing mailbox list...</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 border-dashed max-w-4xl mx-auto p-6 space-y-3 animate-fadeIn">
          <Layers className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Mailbox Sources Connected</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">Authorize the system to pull incoming emails securely by linking a Google Gmail Inbox via Google OAuth 2.0 API or custom IMAP fallback passwords.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((client) => (
            <div 
              key={client.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 truncate max-w-[140px] sm:max-w-xs">{client.client_name}</h4>
                    <span className="text-[10px] font-mono font-medium text-slate-450 block mt-0.5">{client.email}</span>
                  </div>

                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                    client.status === "connected" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                  }`}>
                    {client.status === "connected" ? (
                      <Wifi className="h-2.5 w-2.5 mr-1 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-2.5 w-2.5 mr-1 text-rose-600" />
                    )}
                    <span>{client.status}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs font-medium text-slate-700">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Method</p>
                    <p className="text-slate-800 uppercase mt-0.5">{client.auth_type}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Processed</p>
                    <p className="text-indigo-600 font-bold mt-0.5">{client.total_emails_processed} emails</p>
                  </div>
                </div>

                {client.last_synced_at && (
                  <div className="flex items-center space-x-1 text-[10px] text-slate-450">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    <span>Last Synced: {new Date(client.last_synced_at).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[9px] font-mono text-slate-400">IDRef: {client.id}</span>
                <button
                  id={`delete-client-btn-${client.id}`}
                  onClick={() => handleDeleteClient(client.id)}
                  className="p-1 px-2.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-transparent hover:border-rose-100 rounded-lg transition-all text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                  title="Remove Connection"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
