import React, { useState, useEffect } from "react";
import { EmailMessage } from "../types";
import { useAuth } from "./AuthContext";
import { 
  Mail, Inbox, Eye, Clock, Key, Link as LinkIcon, ShieldAlert, ShieldCheck, 
  ArrowRight, Shield, CheckCircle, RefreshCw, AlertCircle, ExternalLink, X, HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function FullInboxPage() {
  const { apiFetch } = useAuth();
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchEmails = async (showSpinner = false) => {
    if (showSpinner) setIsSyncing(true);
    try {
      const res = await apiFetch("/api/emails");
      if (res.ok) {
        const data = await res.json();
        setEmails(data);
      }
    } catch (err) {
      console.error("Failed to fetch full inbox:", err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(() => fetchEmails(false), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (emailId: string, status: "auto_filtered" | "admin_only" | "sent_to_tier2" | "pulled_back", visibility: "tier1_only" | "tier2_allowed") => {
    try {
      const res = await apiFetch(`/api/emails/${emailId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classificationStatus: status, visibilityLevel: visibility })
      });
      if (res.ok) {
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, classificationStatus: status, visibilityLevel: visibility } : e));
        if (selectedEmail && selectedEmail.id === emailId) {
          setSelectedEmail(prev => prev ? { ...prev, classificationStatus: status, visibilityLevel: visibility } : null);
        }
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const calculateExpiresIn = (expiresAtStr: string) => {
    const expiresAt = new Date(expiresAtStr).getTime();
    const diff = expiresAt - Date.now();
    if (diff <= 0) return "Expired";
    const mins = Math.floor(diff / (60 * 1000));
    if (mins < 1) return "Expiring now";
    return `${mins}m left`;
  };

  const getStatusBadge = (classification: string, visibility: string) => {
    if (classification === "auto_filtered") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono">
          <ShieldCheck className="h-3 w-3" /> Auto-Filter • Tier 2 Allowed
        </span>
      );
    }
    if (classification === "sent_to_tier2") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
          <CheckCircle className="h-3 w-3" /> Sent to Tier 2
        </span>
      );
    }
    if (classification === "pulled_back") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100 font-mono">
          <ShieldAlert className="h-3 w-3" /> Pulled Back
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 font-mono">
        <Shield className="h-3 w-3" /> Admin Only
      </span>
    );
  };

  const filteredEmails = emails.filter(email => {
    const matchesSearch = 
      email.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (email.otpCode && email.otpCode.includes(searchTerm)) ||
      (email.verificationLink && email.verificationLink.toLowerCase().includes(searchTerm.toLowerCase()));

    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "tier2") return matchesSearch && email.visibilityLevel === "tier2_allowed";
    if (statusFilter === "tier1") return matchesSearch && email.visibilityLevel === "tier1_only";
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Page Title Panel */}
      <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-lg shrink-0 mt-0.5 border border-indigo-500/10">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-display font-semibold flex items-center gap-2 tracking-tight">
              Full Inbox
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-mono uppercase font-bold">
                Level 1 Authorization
              </span>
            </h1>
            <p className="text-xs text-slate-300 max-w-xl mt-0.5">
              Comprehensive role-based messaging stream. Access full email body content, check autogenerated security boundaries, and override operational access parameters.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          <button 
            onClick={() => fetchEmails(true)}
            disabled={isSyncing}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-gray-300 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-indigo-400" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-450">
            <Mail className="h-4 w-4 text-gray-400" />
          </span>
          <input
            type="text"
            placeholder="Search sender, subject, extracted codes or verification links..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-250 rounded-lg text-xs font-sans outline-hidden focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all font-medium text-gray-900 placeholder:text-gray-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-sans font-bold text-gray-500 hidden md:inline shrink-0">Filter Level:</span>
          <div className="bg-gray-100 p-0.5 rounded-lg border border-gray-200 flex w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={`flex-1 sm:flex-none px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                statusFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-gray-500 hover:text-slate-900"
              }`}
            >
              All Messages
            </button>
            <button
              onClick={() => setStatusFilter("tier2")}
              className={`flex-1 sm:flex-none px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                statusFilter === "tier2" ? "bg-white text-slate-900 shadow-xs" : "text-gray-500 hover:text-slate-900"
              }`}
            >
              Tier 2 Feed
            </button>
            <button
              onClick={() => setStatusFilter("tier1")}
              className={`flex-1 sm:flex-none px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                statusFilter === "tier1" ? "bg-white text-slate-900 shadow-xs" : "text-gray-500 hover:text-slate-900"
              }`}
            >
              Admin Restricted
            </button>
          </div>
        </div>
      </div>

      {/* Email Table Collection */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <span className="text-xs font-mono tracking-wider font-bold text-slate-500 uppercase">
              Loading Secure Data Feeds...
            </span>
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <Inbox className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <h3 className="text-xs font-bold text-gray-900">No Emails Found</h3>
            <p className="text-[11px] text-gray-400 max-w-sm mx-auto mt-1">
              Either no recent emails have been processed in the last hour, or none match your selected search criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Sender & Recipient</th>
                  <th className="px-5 py-3">Subject line</th>
                  <th className="px-5 py-3">Temporal Status</th>
                  <th className="px-5 py-3">Decoded payload</th>
                  <th className="px-5 py-3">Visibility Level</th>
                  <th className="px-5 py-3 text-right">Administrative Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 text-xs font-sans text-gray-900">
                {filteredEmails.map((email) => (
                  <tr 
                    key={email.id} 
                    className="hover:bg-indigo-50/20 transition-colors group cursor-pointer"
                    onClick={() => setSelectedEmail(email)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate max-w-xs">
                        {email.sender}
                      </div>
                      {email.recipientEmail && (
                        <div className="text-[10px] text-indigo-600 font-mono mt-0.5 max-w-xs truncate" title={email.recipientEmail}>
                          To: {email.recipientEmail}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        UID: {email.id}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-800 truncate max-w-xs">
                        {email.subject}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-slate-700">
                        <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span>{new Date(email.receivedAt).toLocaleTimeString()}</span>
                      </div>
                      <div className={`text-[10px] font-mono mt-0.5 font-bold ${
                        calculateExpiresIn(email.expiresAt) === "Expired" ? "text-rose-600" : "text-amber-600"
                      }`}>
                        {calculateExpiresIn(email.expiresAt)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {email.otpCode && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-indigo-50 text-indigo-700 font-mono text-[10px] font-semibold border border-indigo-100">
                          <Key className="h-3 w-3 text-indigo-500" />
                          <span>Code: {email.otpCode}</span>
                        </div>
                      )}
                      {!email.otpCode && email.verificationLink && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-teal-50 text-teal-700 font-mono text-[10px] font-semibold border border-teal-100 max-w-[200px] truncate">
                          <LinkIcon className="h-3 w-3 text-teal-500 shrink-0" />
                          <span>Has Verify Link</span>
                        </div>
                      )}
                      {!email.otpCode && !email.verificationLink && (
                        <span className="text-gray-400 text-[10px] italic">No active tokens</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {getStatusBadge(email.classificationStatus, email.visibilityLevel)}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        {email.visibilityLevel === "tier1_only" ? (
                          <button
                            onClick={() => handleUpdateStatus(email.id, "sent_to_tier2", "tier2_allowed")}
                            className="px-2.5 py-1 text-[10px] font-bold bg-indigo-650 hover:bg-indigo-700 text-white rounded transition-colors cursor-pointer shadow-xs"
                          >
                            Send to Tier 2
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(email.id, "pulled_back", "tier1_only")}
                            className="px-2.5 py-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors cursor-pointer shadow-xs"
                          >
                            Pull Back
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateStatus(email.id, "admin_only", "tier1_only")}
                          className="px-2 py-1 text-[10px] font-bold border border-gray-300 hover:bg-gray-55 text-slate-700 rounded transition-colors cursor-pointer bg-white"
                        >
                          Strict Admin Only
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Safe HTML Custom rendering email View Modal */}
      <AnimatePresence>
        {selectedEmail && (
          <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden max-w-4xl w-full flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-400/20 rounded-md">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">{selectedEmail.subject}</h2>
                    <p className="text-[10px] text-slate-350 mt-0.5 font-sans">
                      From: <span className="text-white font-medium">{selectedEmail.sender}</span>
                      {selectedEmail.recipientEmail && (
                        <span className="ml-2 pl-2 border-l border-slate-700">
                          To: <span className="text-indigo-300 font-mono font-bold">{selectedEmail.recipientEmail}</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedEmail(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body Container */}
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                
                {/* Visual Metadata Summary Block */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 rounded-xl p-4 border border-gray-200">
                  <div>
                    <span className="text-[9px] uppercase font-mono font-bold text-gray-400 block">Received At</span>
                    <span className="text-xs font-semibold text-slate-800">{new Date(selectedEmail.receivedAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-mono font-bold text-gray-400 block">Data Lifecycle Limits</span>
                    <span className="text-xs font-semibold text-amber-600 font-mono flex items-center gap-1 mt-0.5">
                      <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      Hard Delete in: {calculateExpiresIn(selectedEmail.expiresAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-mono font-bold text-gray-400 block">Clearance status</span>
                    <div className="mt-0.5">
                      {getStatusBadge(selectedEmail.classificationStatus, selectedEmail.visibilityLevel)}
                    </div>
                  </div>
                </div>

                {/* Extracted payload Highlights */}
                {(selectedEmail.otpCode || selectedEmail.verificationLink) && (
                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-125 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedEmail.otpCode && (
                      <div className="bg-white p-3 rounded-lg border border-indigo-100 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-mono font-bold font-semibold text-indigo-500">Auto-Extracted OTP CODE</span>
                          <div className="text-2xl font-mono tracking-wider font-extrabold text-indigo-700 mt-1">{selectedEmail.otpCode}</div>
                        </div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(selectedEmail.otpCode || "");
                            alert("OTP copied safely.");
                          }}
                          className="px-2.5 py-1.5 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors cursor-pointer shadow-xs"
                        >
                          Copy Code
                        </button>
                      </div>
                    )}

                    {selectedEmail.verificationLink && (
                      <div className="bg-white p-3 rounded-lg border border-indigo-100 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-mono font-bold font-semibold text-indigo-400">Extracted verification link</span>
                          <div className="text-xs font-mono font-semibold text-blue-600 truncate mt-1">{selectedEmail.verificationLink}</div>
                        </div>
                        <a 
                          href={selectedEmail.verificationLink}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-750 inline-flex items-center gap-1 hover:underline"
                        >
                          Follow verification link <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Email Body Displays */}
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-slate-600 uppercase">Sanitized HTML Render (Safe Sandbox)</span>
                    </div>
                    {/* Render raw HTML securely in srcDoc iFrame */}
                    <div className="h-64 bg-white relative">
                      <iframe
                        srcDoc={`
                          <!DOCTYPE html>
                          <html>
                          <head>
                            <style>
                              body {
                                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                font-size: 13px;
                                line-height: 1.6;
                                color: #1e293b;
                                padding: 16px;
                                margin: 0;
                              }
                              a { color: #4f46e5; text-decoration: underline; }
                              pre { background: #f1f5f9; padding: 8px; border-radius: 4px; overflow: auto; }
                            </style>
                          </head>
                          <body>
                            ${selectedEmail.fullBodyHtml}
                          </body>
                          </html>
                        `}
                        className="w-full h-full border-none"
                        title="Secure Render sandbox"
                        referrerPolicy="no-referrer"
                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                      />
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 border-b border-gray-200">
                      <span className="text-[10px] font-mono font-bold text-slate-600 uppercase">Raw plain text fallback</span>
                    </div>
                    <div className="p-4 bg-slate-50 text-slate-800 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap selection:bg-indigo-125">
                      {selectedEmail.fullBodyText ? selectedEmail.fullBodyText : "No plain text fallback content available."}
                    </div>
                  </div>
                </div>

                {/* Overriding Administrative Actions Block */}
                <div className="border border-gray-200 rounded-xl p-4 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-start gap-2 max-w-md">
                    <HelpCircle className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">Manual Re-Classification Handlers</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-normal">
                        Override the automated filtering status. Setting to Tier 2 will immediately propagate this email's core OTP elements to worker streams. Pulling back restricts visibility to authorized admins only.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-center">
                    {selectedEmail.visibilityLevel === "tier1_only" ? (
                      <button
                        onClick={() => handleUpdateStatus(selectedEmail.id, "sent_to_tier2", "tier2_allowed")}
                        className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                      >
                        Send to Tier 2
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(selectedEmail.id, "pulled_back", "tier1_only")}
                        className="px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                      >
                        Pull Back / Redact From Tier 2
                      </button>
                    )}
                    <button
                      onClick={() => handleUpdateStatus(selectedEmail.id, "admin_only", "tier1_only")}
                      className="px-3 py-2 text-xs font-bold border border-gray-300 hover:bg-gray-100 text-slate-700 rounded-lg transition-colors cursor-pointer bg-white"
                    >
                      Strict Admin Restriction
                    </button>
                  </div>
                </div>

              </div>
              
              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-gray-200 px-6 py-4 flex justify-end">
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                >
                  Close Message Explorer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
