import React, { useState, useEffect, useRef } from "react";
import { EmailMessage } from "../types";
import EmailModal from "./EmailModal";
import { useAuth } from "./AuthContext";
import { getTimeRemaining, formatCountdown } from "../utils/time";
import { 
  Mail, Inbox, Eye, Clock, Key, Link as LinkIcon, ShieldAlert, ShieldCheck, 
  RefreshCw
} from "lucide-react";

export function FullInboxPage() {
  const { apiFetch, user } = useAuth();
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [previousEmailIds, setPreviousEmailIds] = useState<Set<string>>(new Set());
  const [newEmailIds, setNewEmailIds] = useState<Set<string>>(new Set());
  
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const isInitialLoad = useRef(true);

  const fetchEmails = async (showSpinner = false) => {
    // Save scroll position
    if (tableContainerRef.current) {
      scrollPositionRef.current = tableContainerRef.current.scrollTop;
    }

    if (showSpinner) setIsSyncing(true);
    try {
      const res = await apiFetch("/api/emails");
      if (res.ok) {
        const data = await res.json();
        
        // Track new emails for animation
        const currentIds = new Set(data.map((e: EmailMessage) => e.id));
        const newIds = new Set(data.filter((e: EmailMessage) => !previousEmailIds.has(e.id)).map((e: EmailMessage) => e.id));
        
        setEmails(data);
        setPreviousEmailIds(currentIds);
        setNewEmailIds(newIds);
        
        // Clear animation flag after 1 second
        setTimeout(() => setNewEmailIds(new Set()), 1000);
      } else {
        console.error("API returned error:", res.status);
      }
    } catch (err) {
      console.error("Failed to fetch full inbox:", err);
    } finally {
      // Only set loading false on initial load
      if (isInitialLoad.current) {
        setLoading(false);
        isInitialLoad.current = false;
      }
      setIsSyncing(false);
      
      // Restore scroll position
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = scrollPositionRef.current;
      }
    }
  };

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(() => fetchEmails(false), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (
    emailId: string,
    action: "send_to_tier2" | "pull_back" | "admin_only"
  ) => {
    try {
      const res = await apiFetch(`/api/emails/${emailId}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });

      if (res.ok) {
        await fetchEmails(false);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const calculateExpiresIn = (expiresAtStr: string) => {
    const diff = getTimeRemaining(expiresAtStr);
    return formatCountdown(diff);
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
      (email.otp_code && email.otp_code.includes(searchTerm)) ||
      (email.verification_link && email.verification_link.toLowerCase().includes(searchTerm.toLowerCase()));

    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "tier2") return matchesSearch && email.visibility_level === "tier2_allowed";
    if (statusFilter === "tier1") return matchesSearch && email.visibility_level === "tier1_only";
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
            placeholder="Search sender, recipient, subject, or OTP..."
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

      {/* Email Table */}
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
              Either no recent emails have been processed in the last 30 minutes, or none match your selected search criteria.
            </p>
          </div>
        ) : (
          <div ref={tableContainerRef} className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b border-gray-200 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider">
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
                    onClick={() => setSelectedEmail(email)}
                    className={`hover:bg-indigo-50/20 transition-colors group cursor-pointer ${
                      newEmailIds.has(email.id) ? "animate-fade-in" : ""
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate max-w-xs">
                        {email.sender}
                      </div>
                      {email.recipient_email && (
                        <div className="text-[10px] text-indigo-600 font-mono mt-0.5 max-w-xs truncate" title={email.recipient_email}>
                          To: {email.recipient_email}
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
                        <span>{new Date(email.received_at).toLocaleTimeString()}</span>
                      </div>
                      <div className={`text-[10px] font-mono mt-0.5 font-bold ${
                        calculateExpiresIn(email.expires_at) === "Expired" ? "text-rose-600" : "text-amber-600"
                      }`}>
                        {calculateExpiresIn(email.expires_at)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {email.otp_code && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-indigo-50 text-indigo-700 font-mono text-[10px] font-semibold border border-indigo-100">
                          <Key className="h-3 w-3 text-indigo-500" />
                          <span>Code: {email.otp_code}</span>
                        </div>
                      )}
                      {!email.otp_code && email.verification_link && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-teal-50 text-teal-700 font-mono text-[10px] font-semibold border border-teal-100 max-w-[200px] truncate">
                          <LinkIcon className="h-3 w-3 text-teal-500 shrink-0" />
                          <span>Has Verify Link</span>
                        </div>
                      )}
                      {!email.otp_code && !email.verification_link && (
                        <span className="text-gray-400 text-[10px] italic">No active tokens</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {getStatusBadge(email.classification_status, email.visibility_level)}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        {email.visibility_level === "tier1_only" ? (
                          <button
                            onClick={() => handleUpdateStatus(email.id, "send_to_tier2")}
                            className="px-2.5 py-1 text-[10px] font-bold bg-indigo-650 hover:bg-indigo-700 text-white rounded transition-colors cursor-pointer shadow-xs"
                          >
                            Send to Tier 2
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(email.id, "pull_back")}
                            className="px-2.5 py-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors cursor-pointer shadow-xs"
                          >
                            Pull Back
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateStatus(email.id, "admin_only")}
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

      {/* ✅ USE EmailModal COMPONENT INSTEAD OF INLINE MODAL */}
      {selectedEmail && (
        <EmailModal
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
          onClassify={handleUpdateStatus}
          userRole={user?.role || "WORKER"}
        />
      )}
    </div>
  );
}