import React, { useState, useEffect } from "react";
import { OtpEmail } from "../types";
import { useAuth } from "./AuthContext";
import { 
  Key, RefreshCw, Copy, Check, Search, Calendar, ShieldAlert,
  Inbox, ShieldCheck, Mail, ArrowRight, Filter, Eye, Clock,
  Link as LinkIcon, ExternalLink, X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function OtpsPage() {
  const { apiFetch, user } = useAuth();
  const [otps, setOtps] = useState<OtpEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [selectedOtp, setSelectedOtp] = useState<OtpEmail | null>(null);
  
  // Clean OTP Fetch operation
  const fetchOtps = async (showSpinner = false) => {
    if (showSpinner) {
      setIsSyncing(true);
    }
    try {
      const response = await apiFetch("/api/otps");
      if (response.ok) {
        const data = await response.json();
        setOtps(data);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error("Failed to query live OTP payload:", err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchOtps();
  }, []);

  // 1 minute Auto-Refresh Timer
  useEffect(() => {
    const timer = setInterval(() => {
      fetchOtps(false);
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const calculateExpiresIn = (expiresAtStr?: string) => {
    if (!expiresAtStr) return "1h left";
    const expiresAt = new Date(expiresAtStr).getTime();
    const diff = expiresAt - Date.now();
    if (diff <= 0) return "Expired";
    const mins = Math.floor(diff / (60 * 1000));
    if (mins < 1) return "Expiring now";
    return `${mins}m left`;
  };

  const safeFormatDate = (timestamp?: string) => {
    if (!timestamp) return "Unknown date";
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return "Unknown date";
      return d.toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "medium"
      });
    } catch {
      return "Unknown date";
    }
  };

  const handleCopy = async (otp: OtpEmail) => {
    if (!otp || !otp.otpCode) return;
    try {
      await navigator.clipboard.writeText(otp.otpCode);
      setCopiedId(otp.id + "-code");
      
      // Call copy endpoint to trigger activity logs / audit trails
      await apiFetch(`/api/otps/${otp.id}/copy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          otpCode: otp.otpCode, 
          clientName: otp.clientName ?? "Unknown Client", 
          source: otp.source ?? "External" 
        })
      });

      // Update state locally
      setOtps(prev => prev.map(o => o.id === otp.id ? { ...o, status: "copied" } : o));

      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (err) {
      console.error("Clipboard write or API logging failed:", err);
    }
  };

  const handleCopyLink = async (otp: OtpEmail) => {
    if (!otp || !otp.verificationLink) return;
    try {
      await navigator.clipboard.writeText(otp.verificationLink);
      setCopiedId(otp.id + "-link");
      
      // Call copy endpoint to trigger activity logs / audit trails
      await apiFetch(`/api/otps/${otp.id}/copy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          otpCode: "LINK_COPIED", 
          clientName: otp.clientName ?? "Unknown Client", 
          source: otp.source ?? "External" 
        })
      });

      // Update state locally
      setOtps(prev => prev.map(o => o.id === otp.id ? { ...o, status: "copied" } : o));

      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (err) {
      console.error("Clipboard write or API logging failed:", err);
    }
  };

  // Extract unique sources for filter tabs, filtered from null/undefined
  const sources = [
    "all", 
    ...Array.from(new Set(otps.map(o => o?.source || "External").filter(Boolean)))
  ];

  // Search & Filter
  const filteredOtps = otps.filter(otp => {
    if (!otp) return false;
    
    const searchTermLower = (searchTerm ?? "").toLowerCase();
    const clientNameLower = (otp.clientName ?? "").toLowerCase();
    const sourceLower = (otp.source ?? "External").toLowerCase();
    const senderLower = (otp.sender ?? "").toLowerCase();
    const subjectLower = (otp.subject ?? "").toLowerCase();
    
    const codeMatch = otp.otpCode ? otp.otpCode.includes(searchTerm) : false;
    const linkMatch = otp.verificationLink ? (otp.verificationLink ?? "").toLowerCase().includes(searchTermLower) : false;
    
    const matchesSearch = 
      clientNameLower.includes(searchTermLower) ||
      codeMatch ||
      linkMatch ||
      sourceLower.includes(searchTermLower) ||
      senderLower.includes(searchTermLower) ||
      subjectLower.includes(searchTermLower);
      
    const matchesFilter = sourceFilter === "all" || (otp.source ?? "External") === sourceFilter;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-lg shrink-0 mt-0.5 border border-indigo-500/10">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-display font-semibold flex items-center gap-2 tracking-tight">
              OTP Feed
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono uppercase font-bold">
                Live Stream
              </span>
            </h1>
            <p className="text-xs text-slate-300 max-w-xl mt-0.5">
              Secure stream of filtered passcodes and authentication codes. Re-verified compliance filter strictly isolating keys from full context bodies.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 self-end md:self-center">
          <div className="text-right font-mono text-[10px] text-slate-400 hidden sm:block">
            <div>Last update: {lastRefreshed.toLocaleTimeString()}</div>
            <div className="text-indigo-400 font-medium">Automatic sync interval: 1 minute</div>
          </div>
          <button 
            id="otp-feed-refresh"
            onClick={() => fetchOtps(true)}
            disabled={isSyncing}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900/50 text-white font-sans text-xs font-semibold rounded-lg shadow-md flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            Refresh Feed
          </button>
        </div>
      </div>

      {/* Interactive Logs Shell */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        
        {/* Filter bar */}
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
          <div>
            <h3 className="text-sm font-sans font-bold text-gray-950">
              One-Time Passcode Ledger
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Filter by integrated source tags</p>
          </div>
          
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-gray-400 flex items-center gap-1 font-mono">
              <Filter className="h-3 w-3" /> Source:
            </span>
            <div className="flex flex-wrap gap-1">
              {sources.map(src => (
                <button
                  key={src}
                  onClick={() => setSourceFilter(src)}
                  className={`px-2.5 py-1 text-[10px] font-sans font-semibold rounded-md uppercase border transition-all cursor-pointer ${
                    sourceFilter === src 
                      ? "bg-slate-950 text-white border-slate-950 shadow-xs" 
                      : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search Input bar */}
        <div className="p-4 border-b border-gray-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search OTP keys by tenant name, sender address, code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-sans text-slate-800 placeholder-slate-400 transition-all bg-slate-50/50"
            />
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
              <div className="h-7 w-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-slate-500 font-mono">Synchronizing real-time OTP table...</span>
            </div>
          ) : (
            <>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-gray-100">
                    <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Tenant Client</th>
                    <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Provider</th>
                    <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Sender / Application</th>
                    <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Recipient</th>
                    <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Verification Code</th>
                    <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Timestamp</th>
                    <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase whitespace-nowrap">Status</th>
                    <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <AnimatePresence mode="popLayout">
                    {filteredOtps.map((otp) => (
                      <motion.tr 
                        key={otp.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-indigo-50/10 cursor-pointer transition-colors"
                        onClick={() => setSelectedOtp(otp)}
                      >
                        {/* Tenant Client */}
                        <td className="px-5 py-4">
                          <span className="font-sans font-bold text-gray-900 text-sm block">
                            {otp.clientName}
                          </span>
                        </td>

                        {/* Provider */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            otp.provider === "google" 
                              ? "bg-slate-50 text-slate-700 border-slate-200"
                              : "bg-blue-50 text-blue-700 border-blue-100"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${otp.provider === "google" ? "bg-slate-400" : "bg-blue-500"}`}></span>
                            {otp.provider === "google" ? "Google Dev" : "Microsoft Azure"}
                          </span>
                        </td>

                        {/* Sender */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-mono text-slate-600 block max-w-[180px] truncate" title={otp.sender}>
                              {otp.sender}
                            </span>
                            <span className="inline-flex mt-1 uppercase font-mono tracking-wider font-bold text-[9px] bg-slate-100 text-slate-700 w-fit px-1.5 py-0.5 rounded-sm">
                              {otp.source}
                            </span>
                          </div>
                        </td>

                        {/* Recipient */}
                        <td className="px-5 py-4">
                          <span className="text-xs font-mono text-slate-700 font-semibold block max-w-[180px] truncate" title={otp.recipientEmail || "Unknown Recipient"}>
                            {otp.recipientEmail || "—"}
                          </span>
                        </td>

                        {/* OTP Code / Verification Link (prominent) */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-2">
                            {/* Render Code if exists */}
                            {otp.otpCode && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-slate-400 uppercase w-10 shrink-0">Code:</span>
                                <div className="font-mono text-base font-extrabold text-slate-950 tracking-wider bg-slate-100/80 px-3 py-1 rounded-lg border border-slate-200/50 min-w-[100px] text-center">
                                  {otp.otpCode}
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCopy(otp); }}
                                  className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                                    copiedId === otp.id + "-code"
                                      ? "bg-emerald-50 text-emerald-600 border-emerald-200 scale-105"
                                      : "bg-white hover:bg-slate-50 text-slate-500 border-slate-200"
                                  }`}
                                  title="Copy Verification Key Code"
                                >
                                  {copiedId === otp.id + "-code" ? (
                                    <Check className="h-3.5 w-3.5 animate-bounce" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Render Link if exists */}
                            {otp.verificationLink && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-slate-400 uppercase w-10 shrink-0">Link:</span>
                                <a
                                  href={otp.verificationLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200/50 flex items-center gap-1 transition-colors justify-center"
                                  title="Open Authentication Action Link"
                                >
                                  <ArrowRight className="h-3.5 w-3.5" />
                                  Open Link
                                </a>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCopyLink(otp); }}
                                  className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                                    copiedId === otp.id + "-link"
                                      ? "bg-emerald-50 text-emerald-600 border-emerald-200 scale-105"
                                      : "bg-white hover:bg-slate-50 text-slate-500 border-slate-200"
                                  }`}
                                  title="Copy Verification Action URL"
                                >
                                  {copiedId === otp.id + "-link" ? (
                                    <Check className="h-3.5 w-3.5 animate-bounce" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Timestamp */}
                        <td className="px-5 py-4">
                          <span className="text-xs text-slate-500 font-sans block">
                            {safeFormatDate(otp.timestamp || otp.receivedAt)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {otp.status === "copied" ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200 font-sans">
                              <ShieldCheck className="h-3 w-3 text-emerald-500" />
                              Copied / Audited
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 font-sans animate-pulse">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span>
                              En Route
                            </span>
                          )}
                        </td>

                        {/* Actions details triggering */}
                        <td className="px-5 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedOtp(otp)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="h-3 w-3 text-indigo-500" />
                            View Email
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>

              {filteredOtps.length === 0 && (
                <div className="p-16 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-2">
                  <Inbox className="h-8 w-8 text-slate-300" />
                  <span>No filtered passcode envelopes match your cursor layout.</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Safe HTML Custom rendering email View Modal for Workers & Admins alike */}
      <AnimatePresence>
        {selectedOtp && (
          <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
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
                    <h2 className="text-sm font-bold tracking-tight">{selectedOtp.subject || "No Subject"}</h2>
                    <p className="text-[10px] text-slate-350 mt-0.5 font-sans">
                      From: <span className="text-white font-medium">{selectedOtp.sender || "Unknown Sender"}</span>
                      {selectedOtp.recipientEmail && (
                        <span className="ml-2 pl-2 border-l border-slate-700">
                          To: <span className="text-indigo-300 font-mono font-bold">{selectedOtp.recipientEmail}</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedOtp(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body Container */}
              <div className="p-6 overflow-y-auto flex-grow space-y-5">
                
                {/* Visual Metadata Summary Block */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 rounded-xl p-4 border border-gray-200">
                  <div>
                    <span className="text-[9px] uppercase font-mono font-bold text-gray-400 block">Received At</span>
                    <span className="text-xs font-semibold text-slate-800">
                      {safeFormatDate(selectedOtp.timestamp || selectedOtp.receivedAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-mono font-bold text-gray-400 block">Data Lifecycle Limits</span>
                    <span className="text-xs font-semibold text-amber-600 font-mono flex items-center gap-1 mt-0.5">
                      <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      Hard Delete in: {calculateExpiresIn(selectedOtp.expiresAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-mono font-bold text-gray-400 block">Authorization Level</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono mt-0.5">
                      <ShieldCheck className="h-3 w-3" /> Tier 2 Allowed Feed
                    </span>
                  </div>
                </div>

                {/* Extracted payload Highlights */}
                {(selectedOtp.otpCode || selectedOtp.verificationLink) && (
                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedOtp.otpCode && (
                      <div className="bg-white p-3 rounded-lg border border-indigo-100 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-mono font-semibold text-indigo-500">Auto-Extracted OTP CODE</span>
                          <div className="text-2xl font-mono tracking-wider font-extrabold text-indigo-700 mt-1">{selectedOtp.otpCode}</div>
                        </div>
                        <button 
                          onClick={() => handleCopy(selectedOtp)}
                          className="px-2.5 py-1.5 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors cursor-pointer shadow-xs"
                        >
                          {copiedId === selectedOtp.id + "-code" ? "Copied!" : "Copy Code"}
                        </button>
                      </div>
                    )}

                    {selectedOtp.verificationLink && (
                      <div className="bg-white p-3 rounded-lg border border-indigo-100 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-mono font-semibold text-indigo-400">Extracted verification link</span>
                          <div className="text-xs font-mono font-semibold text-blue-600 truncate mt-1">{selectedOtp.verificationLink}</div>
                        </div>
                        <a 
                          href={selectedOtp.verificationLink}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 hover:underline"
                        >
                          Follow verification link <ExternalLink className="h-3 w-3" style={{ display: "inline" }} />
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
                            ${selectedOtp.fullBodyHtml || `<div>${selectedOtp.fullBodyText || selectedOtp.snippet}</div>`}
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
                    <div className="p-4 bg-slate-50 text-slate-800 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap selection:bg-indigo-100">
                      {selectedOtp.fullBodyText ? selectedOtp.fullBodyText : "No plain text fallback content available."}
                    </div>
                  </div>
                </div>

              </div>
              
              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-gray-200 px-6 py-4 flex justify-end">
                <button
                  onClick={() => setSelectedOtp(null)}
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
