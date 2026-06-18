import React, { useState, useEffect, useRef } from "react";
import { EmailMessage } from "../types";
import EmailModal from "./EmailModal";
import { useAuth } from "./AuthContext";
import { getTimeRemaining, formatCountdown } from "../utils/time";
import { playNotificationSound } from "../utils/audio";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mail, Inbox, Clock, Key, Link as LinkIcon, ShieldAlert, ShieldCheck, 
  RefreshCw, CheckCircle, Shield, Search
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
    if (tableContainerRef.current) {
      scrollPositionRef.current = tableContainerRef.current.scrollTop;
    }

    if (showSpinner) setIsSyncing(true);
    
    try {
      const res = await apiFetch("/api/emails");
      if (res.ok) {
        const data = await res.json();
        
        const currentIds = new Set(data.map((e: EmailMessage) => e.id));
        const newIds = new Set(data.filter((e: EmailMessage) => !previousEmailIds.has(e.id)).map((e: EmailMessage) => e.id));
        
        setEmails(data);
        setPreviousEmailIds(currentIds);
        setNewEmailIds(newIds);
        
        if (newIds.size > 0 && user?.role === "ADMIN") {
          playNotificationSound();
        }
        
        setTimeout(() => setNewEmailIds(new Set()), 1000);
      }
    } catch (err) {
      console.error("Failed to fetch full inbox:", err);
    } finally {
      if (isInitialLoad.current) {
        setLoading(false);
        isInitialLoad.current = false;
      }
      setIsSyncing(false);
      
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
        setSelectedEmail(null);
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
          <ShieldCheck className="h-3 w-3" /> Auto-Filter • Tier 2 Allowed
        </span>
      );
    }
    if (classification === "sent_to_tier2") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800">
          <CheckCircle className="h-3 w-3" /> Sent to Tier 2
        </span>
      );
    }
    if (classification === "pulled_back") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100 font-mono dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
          <ShieldAlert className="h-3 w-3" /> Pulled Back
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 font-mono dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
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
    <div className="space-y-6 bg-slate-100 dark:bg-slate-950 min-h-screen p-8">
      
      {/* Page Title Panel */}
      <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl border border-slate-800 dark:border-slate-700 p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            <p className="text-xs text-slate-300 dark:text-slate-400 max-w-xl mt-0.5">
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
      <div className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-450 dark:text-slate-500">
            <Search className="h-4 w-4 text-gray-400 dark:text-slate-500" />
          </span>
          <input
            type="text"
            placeholder="Search sender, recipient, subject, or OTP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50/80 dark:bg-slate-800/50 border border-gray-250 dark:border-slate-700 rounded-lg text-xs font-sans outline-hidden focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-600 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-600 dark:focus:ring-indigo-500 transition-all font-medium text-gray-900 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-sans font-bold text-gray-500 dark:text-slate-400 hidden md:inline shrink-0">Filter Level:</span>
          <div className="bg-gray-100 dark:bg-slate-800/50 p-0.5 rounded-lg border border-gray-200 dark:border-slate-700 flex w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={`flex-1 sm:flex-none px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                statusFilter === "all" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              All Messages
            </button>
            <button
              onClick={() => setStatusFilter("tier2")}
              className={`flex-1 sm:flex-none px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                statusFilter === "tier2" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Tier 2 Feed
            </button>
            <button
              onClick={() => setStatusFilter("tier1")}
              className={`flex-1 sm:flex-none px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                statusFilter === "tier1" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Admin Restricted
            </button>
          </div>
        </div>
      </div>

      {/* Email Grid - Transformed from Table to Cards */}
      <div className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <span className="text-xs font-mono tracking-wider font-bold text-slate-500 dark:text-slate-400 uppercase">
              Loading Secure Data Feeds...
            </span>
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="p-16 text-center text-gray-500 dark:text-slate-400">
            <Inbox className="h-10 w-10 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-slate-200">No Emails Found</h3>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 max-w-sm mx-auto mt-1">
              Either no recent emails have been processed in the last 30 minutes, or none match your selected search criteria.
            </p>
          </div>
        ) : (
          <div ref={tableContainerRef} className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto p-4">
            <AnimatePresence>
              {filteredEmails.map((email, index) => (
                <motion.div
                  key={email.id}
                  initial={newEmailIds.has(email.id) ? { opacity: 0, y: -20, scale: 0.95 } : { opacity: 1, y: 0, scale: 1 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ 
                    duration: 0.25,
                    delay: newEmailIds.has(email.id) ? index * 0.03 : 0
                  }}
                  onClick={() => setSelectedEmail(email)}
                  className="bg-white/90 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-200/60 dark:border-slate-700/50 p-4 hover:shadow-md hover:border-indigo-300/40 dark:hover:border-indigo-700/40 transition-all duration-300 cursor-pointer group"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{email.subject}</p>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{email.sender}</p>
                      {email.recipient_email && (
                        <p className="text-[9px] font-mono text-indigo-600 dark:text-indigo-400 truncate mt-0.5">
                          To: {email.recipient_email}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(email.classification_status, email.visibility_level)}
                      <div className={`flex items-center gap-1 text-[9px] font-mono font-bold ${
                        calculateExpiresIn(email.expires_at) === "Expired" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                      }`}>
                        <Clock className="h-2.5 w-2.5" />
                        <span>{calculateExpiresIn(email.expires_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payload Preview */}
                  <div className="flex items-center gap-2 mb-3">
                    {email.otp_code && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-50/80 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-mono text-[10px] font-bold border border-indigo-200/60 dark:border-indigo-800/50">
                        <Key className="h-3 w-3 text-indigo-500" />
                        <span className="tracking-wider">{email.otp_code}</span>
                      </div>
                    )}
                    {!email.otp_code && email.verification_link && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-teal-50/80 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-mono text-[10px] font-semibold border border-teal-200/60 dark:border-teal-800/50">
                        <LinkIcon className="h-3 w-3 text-teal-500 shrink-0" />
                        <span className="truncate max-w-[150px]">Verify Link</span>
                      </div>
                    )}
                    {!email.otp_code && !email.verification_link && (
                      <span className="text-gray-400 dark:text-slate-500 text-[10px] italic">No active tokens</span>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/50">
                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">UID: {email.id}</span>
                    {user?.role === "ADMIN" && (
                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {email.visibility_level === "tier1_only" ? (
                          <button
                            onClick={() => handleUpdateStatus(email.id, "send_to_tier2")}
                            className="px-2 py-1 text-[9px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors cursor-pointer shadow-xs"
                          >
                            Send to Tier 2
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(email.id, "pull_back")}
                            className="px-2 py-1 text-[9px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors cursor-pointer shadow-xs"
                          >
                            Pull Back
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Email Modal */}
      {selectedEmail && (
        <EmailModal
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
          onClassify={(action) => handleUpdateStatus(selectedEmail.id.toString(), action)}
          userRole={user?.role || "WORKER"}
        />
      )}
    </div>
  );
}