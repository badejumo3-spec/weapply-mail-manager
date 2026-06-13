import React, { useState } from "react";
import { 
  Key, Mail, Copy, Check, Filter, Search, ShieldAlert, AlertCircle, 
  ChevronRight, RefreshCw, Eye, EyeOff, Sparkles, HelpCircle, ArrowRight
} from "lucide-react";
import { OtpEmail } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface DashboardWorkerProps {
  otps: OtpEmail[];
  onCopyOtp: (id: string, otpCode: string, clientName: string, source: string) => void;
  onRefresh: () => void;
  isSyncing: boolean;
}

export function DashboardWorker({
  otps,
  onCopyOtp,
  onRefresh,
  isSyncing
}: DashboardWorkerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedOtp, setSelectedOtp] = useState<OtpEmail | null>(null);
  const [showBodyAccessDenied, setShowBodyAccessDenied] = useState(false);

  const handleCopy = (otp: OtpEmail) => {
    if (!otp.otpCode) return;
    navigator.clipboard.writeText(otp.otpCode);
    setCopiedId(otp.id + "-code");
    onCopyOtp(otp.id, otp.otpCode, otp.clientName, otp.source);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleCopyLink = (otp: OtpEmail) => {
    if (!otp.verificationLink) return;
    navigator.clipboard.writeText(otp.verificationLink);
    setCopiedId(otp.id + "-link");
    onCopyOtp(otp.id, "LINK_COPIED", otp.clientName, otp.source);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Get distinct sources for helper filters
  const sources = ["all", ...Array.from(new Set(otps.map(o => o.source)))];

  // Filter OTPs
  const filteredOtps = otps.filter(otp => {
    const codeMatch = otp.otpCode ? otp.otpCode.includes(searchTerm) : false;
    const linkMatch = otp.verificationLink ? otp.verificationLink.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const matchesSearch = 
      otp.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      codeMatch || 
      linkMatch ||
      otp.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      otp.subject.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = sourceFilter === "all" || otp.source === sourceFilter;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      
      {/* Privacy compliance badge header */}
      <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-lg shrink-0 mt-0.5">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-display font-semibold flex items-center gap-2">
              Tier 2 Restricted View Mode Active
              <span className="text-[10px] bg-amber-500/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold">
                Compliant
              </span>
            </h3>
            <p className="text-xs text-slate-300 max-w-xl mt-0.5 font-sans">
              To guarantee GDPR and security posture covenants, Workers may only interact with isolated credentials. Full client email body downloads, attachments, and non-authentication correspondence are hard-blocked.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-left font-mono text-[11px] text-slate-400">
            <div>Current IP: <span className="text-slate-200">192.168.1.102</span></div>
            <div>Auditor Token: <span className="text-emerald-500">hf82h9...</span></div>
          </div>
          <button 
            id="worker-btn-refresh"
            onClick={onRefresh}
            disabled={isSyncing}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900/50 text-white font-sans text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            Sync Feeds
          </button>
        </div>
      </div>

      {/* Grid: Search and Feed Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
        
        {/* Table Header Filter controls */}
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
          <div>
            <h3 className="text-base font-display font-semibold text-gray-950 flex items-center gap-2">
              <Key id="icon-otp-feed" className="h-4.5 w-4.5 text-indigo-500" />
              Live One-Time Password Filter Log
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Continuous auto-polling for AWS, LinkedIn, GitHub, Stripe verification envelopes.</p>
          </div>
          
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-gray-400 flex items-center gap-1 font-mono">
              <Filter className="h-3 w-3" /> Filter by:
            </span>
            <div className="flex flex-wrap gap-1">
              {sources.map(src => (
                <button
                  key={src}
                  onClick={() => setSourceFilter(src)}
                  className={`px-2.5 py-1 text-[11px] font-sans font-semibold rounded-md uppercase border transition-all cursor-pointer ${
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

        {/* Search Input */}
        <div className="p-4 border-b border-gray-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search OTP logs by service source, client tenant, verification code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-sans"
            />
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Tenant Client</th>
                <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Platform Source</th>
                <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">One-Time Password</th>
                <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Ingested Timestamp</th>
                <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase text-center">Safety Review</th>
                <th className="px-5 py-3 text-xs font-mono font-semibold text-gray-400 uppercase text-right">Instant Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOtps.map((otp) => (
                <tr key={otp.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-sans font-bold text-gray-900 text-sm">{otp.clientName}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase font-mono font-semibold ${
                        otp.provider === "google" 
                          ? "text-red-600 bg-red-50 px-1 rounded" 
                          : "text-blue-600 bg-blue-50 px-1 rounded"
                      }`}>
                        {otp.provider === "google" ? "Gmail" : "MS Exchange"}
                      </span>
                      <span className="text-gray-400 text-[10px] font-mono">Mail ID: msg_{otp.id}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-900 text-white text-xs font-sans font-medium rounded-md">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {otp.source}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1.5 justify-center">
                      {otp.otpCode && (
                        <div className="font-mono text-sm font-bold tracking-wider text-indigo-700 bg-indigo-50/50 px-2.5 py-1 rounded border border-indigo-100/50 w-fit inline-flex items-center gap-1.5">
                          {otp.otpCode}
                        </div>
                      )}
                      {otp.verificationLink && (
                        <a
                          href={otp.verificationLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-semibold rounded border border-indigo-200/50 flex items-center gap-1 transition-colors w-fit"
                          title="Open Link"
                        >
                          <ArrowRight className="h-3 w-3" />
                          Open Link
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-xs text-gray-700 font-mono">
                      {new Date(otp.timestamp).toLocaleDateString()}
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(otp.timestamp).toLocaleTimeString()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => setSelectedOtp(otp)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 text-[11px] font-sans font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye className="h-3 w-3 text-indigo-500" />
                      Inspect Raw Context
                    </button>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      {otp.otpCode && (
                        <button
                          id={`btn-copy-code-${otp.id}`}
                          onClick={() => handleCopy(otp)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold font-sans cursor-pointer transition-all ${
                            copiedId === otp.id + "-code" 
                              ? "bg-emerald-600 text-white" 
                              : "bg-slate-900 text-white hover:bg-slate-800"
                          }`}
                          title="Copy Code"
                        >
                          {copiedId === otp.id + "-code" ? (
                            <>
                              <Check className="h-3 w-3 animate-bounce" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy Code
                            </>
                          )}
                        </button>
                      )}

                      {otp.verificationLink && (
                        <button
                          id={`btn-copy-link-${otp.id}`}
                          onClick={() => handleCopyLink(otp)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold font-sans cursor-pointer transition-all ${
                            copiedId === otp.id + "-link" 
                              ? "bg-emerald-600 text-white" 
                              : "bg-slate-900 text-white hover:bg-slate-800"
                          }`}
                          title="Copy Link Action URL"
                        >
                          {copiedId === otp.id + "-link" ? (
                            <>
                              <Check className="h-3 w-3 animate-bounce" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy Link
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOtps.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400 text-xs">
                    No isolated OTP records found. Make sure client mail sync is active.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSPECT DETAIL CONTEXT MODAL */}
      <AnimatePresence>
        {selectedOtp && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl border border-gray-100 max-w-2xl w-full overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h4 className="font-display font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                    Isolated Security Review Envelope
                    <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded font-mono font-normal">
                      Post-Ingest Filter
                    </span>
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-0.5 font-mono">ID: envelope_filtered_msg_{selectedOtp.id}</p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedOtp(null);
                    setShowBodyAccessDenied(false);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-150 cursor-pointer text-xs"
                >
                  Close
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-0.5">Sender Source</span>
                    <strong className="font-sans text-gray-800">{selectedOtp.sender}</strong>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-0.5">Registered Client Tenant</span>
                    <strong className="font-sans text-gray-800">{selectedOtp.clientName}</strong>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1 block">Subject Header Line</span>
                  <div className="p-2.5 bg-gray-50 rounded-lg text-xs font-semibold text-gray-900 border border-gray-100">
                    {selectedOtp.subject}
                  </div>
                </div>

                {/* Secure OTP / Link view box */}
                <div className="p-5 bg-indigo-50/50 border border-indigo-100/50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" /> Extracted Authentication Credentials
                    </span>
                    <span className="text-[10px] text-indigo-500 font-mono font-medium">Automatic Filter Ingestion</span>
                  </div>

                  {selectedOtp.otpCode && (
                    <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-indigo-100 gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-450 uppercase">Code:</span>
                        <div id="inspector-otp-code" className="text-2xl font-mono font-black text-indigo-800 tracking-widest pl-1">
                          {selectedOtp.otpCode}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(selectedOtp)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-sans font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Copy className="h-3 w-3" /> Copy Code
                        </button>
                        {copiedId === selectedOtp.id + "-code" && (
                          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-0.5 whitespace-nowrap">
                            <Check className="h-3.5 w-3.5 animate-bounce" /> Copied
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedOtp.verificationLink && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded-lg border border-indigo-100 gap-3">
                      <div className="flex flex-col gap-1 max-w-full sm:max-w-[60%]">
                        <span className="text-[10px] font-mono text-slate-450 uppercase">Verification URL:</span>
                        <span className="font-mono text-[10px] text-indigo-950 truncate block" title={selectedOtp.verificationLink}>
                          {selectedOtp.verificationLink}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={selectedOtp.verificationLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-sans font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <ArrowRight className="h-3 w-3" /> Open Link
                        </a>
                        <button
                          onClick={() => handleCopyLink(selectedOtp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-sans font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Copy className="h-3 w-3" /> Copy Link
                        </button>
                        {copiedId === selectedOtp.id + "-link" && (
                          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-0.5 whitespace-nowrap">
                            <Check className="h-3.5 w-3.5 animate-bounce" /> Copied
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Excised Email Body section */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Email Body Snippet Framework</span>
                    <span className="text-[10px] text-amber-600 font-mono font-medium">Excised Segment Isolation Rule</span>
                  </div>
                  <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 text-xs font-mono text-stone-300 space-y-3 relative overflow-hidden">
                    <div className="text-[9px] text-slate-500 border-b border-gray-800 pb-1.5 text-right uppercase tracking-widest">
                      Ingested Body Payload Segment (GDPR Filter v1.2)
                    </div>
                    
                    <p className="bg-slate-800/20 p-2 border border-slate-700/50 rounded text-slate-300 leading-relaxed italic">
                      "...{selectedOtp.snippet}..."
                    </p>

                    {/* REDACTED CONTENT NOTIFICATION */}
                    <div className="border border-dashed border-gray-800 rounded bg-stone-950 p-3 flex items-center justify-between gap-3 text-[11px] text-stone-500">
                      <span className="flex items-center gap-1.5">
                        <EyeOff className="h-4 w-4 text-amber-500" />
                        Raw non-OTP body contents excised. Direct raw email access blocked.
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setShowBodyAccessDenied(true)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-semibold font-sans cursor-pointer"
                      >
                        Request Original Body
                      </button>
                    </div>

                    {showBodyAccessDenied && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-rose-950/90 text-rose-200 border border-rose-800/50 rounded-lg text-xs space-y-1"
                      >
                        <p className="font-bold flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 text-rose-400" /> 
                          TIER 2 SECURITY POLICIES: 403 Forbidden
                        </p>
                        <p className="text-[10px] leading-relaxed text-rose-300/80 font-sans">
                          A direct inbox view or original .eml payload acquisition violates GDPR compliance statute G-492. Only administrators with validated business purposes can audit tokens. Transaction logs recorded for IP 192.168.1.102.
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      alert("SECURITY NOTICE: Raw EML downloads are blocked on this node of the WeApply4U secure mail network (Tier-2 Compliance Boundary).");
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-sans font-medium hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                  >
                    Download Raw EML (.eml)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOtp(null);
                      setShowBodyAccessDenied(false);
                    }}
                    className="px-4 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-sans text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    Done Reviewing
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
