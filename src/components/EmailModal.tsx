import { useState, useEffect } from "react";
import { X, Copy, Mail, ShieldAlert, Check, RefreshCw, EyeOff } from "lucide-react";
import { Email } from "../types";
import { getTimeRemaining, formatCountdown } from "../utils/time";

interface EmailModalProps {
  email: Email;
  onClose: () => void;
  onClassify?: (action: "send_to_tier2" | "pull_back" | "admin_only") => Promise<void>;
  userRole: "ADMIN" | "WORKER";
}

export default function EmailModal({ email, onClose, onClassify, userRole }: EmailModalProps) {
  const [copied, setCopied] = useState<"otp" | "link" | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Live countdown timer check
  useEffect(() => {
  const updateCountdown = () => {
    const diff = getTimeRemaining(email.expires_at);

    if (diff <= 0) {
      setTimeLeft("EXPIRED");
      setIsExpired(true);
    } else {
      setTimeLeft(formatCountdown(diff));
      setIsExpired(false);
    }
  };

  updateCountdown();
  const interval = setInterval(updateCountdown, 1000);
  return () => clearInterval(interval);
}, [email.expires_at]);

  const handleCopy = (text: string, type: "otp" | "link") => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleClassifyAction = async (action: "send_to_tier2" | "pull_back" | "admin_only") => {
    if (!onClassify) return;
    setSubmitting(true);
    try {
      await onClassify(action);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Safe reset style injection for iframe doc
  const styledHtmlDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            line-height: 1.5;
            padding: 16px;
            margin: 0;
            background-color: #ffffff;
            font-size: 14px;
            word-wrap: break-word;
          }
          a {
            color: #2563eb;
            text-decoration: underline;
          }
          img {
            max-width: 100%;
            height: auto;
          }
        </style>
      </head>
      <body>
        ${email.full_body_html || email.full_body_text}
      </body>
    </html>
  `;

  return (
    <div id="email-detail-container" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div 
        id="email-detail-card" 
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col w-full max-w-4xl h-[90vh] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xl"
      >
        {/* Header toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/30">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight max-w-lg truncate">{email.subject}</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Expires in: <span className={`font-mono ${isExpired ? "text-rose-500 font-bold" : "text-amber-500 font-bold"}`}>{timeLeft}</span></p>
            </div>
          </div>
          <button 
            id="close-modal-btn"
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Details Grid container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Email metadata header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sender</p>
              <p className="text-xs font-bold text-slate-800 break-all">{email.sender}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recipient Inbox</p>
              <p className="text-xs font-bold text-slate-800 break-all">{email.recipient_email}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Classification</p>
              <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-bold uppercase ${
                email.classification_status === "sent_to_tier2" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                email.classification_status === "auto_filtered" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                email.classification_status === "pulled_back" ? "bg-indigo-600 text-white" :
                "bg-slate-100 text-slate-500 border border-slate-200"
              }`}>
                {email.classification_status.toUpperCase().replace(/_/g, " ")}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Received Time</p>
              <p className="text-xs font-mono font-semibold text-slate-600 mt-1">{new Date(email.received_at).toLocaleString()}</p>
            </div>
          </div>

          {/* Core Extraction Banner (Refined to be minimalist instead of pure black background) */}
          {(email.otp_code || email.verification_link) && (
            <div className="bg-white rounded-xl border border-indigo-150 p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center space-x-1.5">
                <ShieldAlert className="h-4 w-4 text-indigo-600 animate-pulse" />
                <span>Extracted Authentication Payload</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {email.otp_code && (
                  <div className="flex flex-col justify-between bg-indigo-50/30 p-4 rounded-lg border border-indigo-100">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider">OTP Safe Code</p>
                      <p className="text-2xl font-mono font-extrabold text-indigo-805 tracking-widest mt-1">{email.otp_code}</p>
                    </div>
                    <button
                      id="copy-otp-btn"
                      onClick={() => handleCopy(email.otp_code!, "otp")}
                      className="mt-3 inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded bg-indigo-650 hover:bg-indigo-700 text-white transition-all cursor-pointer"
                    >
                      {copied === "otp" ? <Check className="h-3 w-3 text-emerald-450" /> : <Copy className="h-3 w-3" />}
                      <span>{copied === "otp" ? "Copied Link" : "Copy Code"}</span>
                    </button>
                  </div>
                )}

                {email.verification_link && (
                  <div className="flex flex-col justify-between bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Verification URL Link</p>
                      <p className="text-xs text-slate-700 font-mono break-all line-clamp-2 mt-1.5 underline">{email.verification_link}</p>
                    </div>
                    <div className="mt-3 flex space-x-2">
                      <a
                        id="open-link-btn"
                        href={email.verification_link}
                        target="_blank"
                        rel="noreferrer referrer"
                        className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs text-center font-bold rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
                      >
                        Launch Link
                      </a>
                      <button
                        id="copy-link-btn"
                        onClick={() => handleCopy(email.verification_link!, "link")}
                        className="px-2.5 py-1.5 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 cursor-pointer"
                        title="Copy URL Address"
                      >
                        {copied === "link" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* HTML body secure sandboxed container */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-550 uppercase tracking-wide flex items-center space-x-1.5">
              <span>Primary HTML Viewport</span>
              <span className="text-[10px] font-bold text-slate-400 lowercase italic bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded">Sandboxed Frame</span>
            </h3>
            <iframe 
              srcDoc={styledHtmlDoc}
              sandbox="allow-popups"
              referrerPolicy="no-referrer"
              className="w-full h-80 border border-slate-200 rounded-xl bg-white focus:outline-hidden"
              title="HTML Sandbox Viewer"
            />
          </div>

          {/* Plain text Fallback */}
          <div className="space-y-2">
            <details className="group border border-slate-200 rounded-xl bg-white overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 hover:bg-slate-100/80 cursor-pointer select-none">
                <span>Plaintext Backing Fallback</span>
                <span className="text-slate-400 group-open:rotate-180 transform transition-transform">▼</span>
              </summary>
              <div className="p-4 bg-slate-50 text-slate-700 font-mono text-xs overflow-x-auto whitespace-pre-wrap rounded-b-xl border-t border-slate-200 max-h-48 scrollbar">
                {email.full_body_text || "No text payload extracted."}
              </div>
            </details>
          </div>
        </div>

        {/* Footer drawer controls (Admins override only) */}
        {userRole === "ADMIN" && onClassify && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-xs font-bold text-indigo-600 flex items-center space-x-1.5">
              <EyeOff className="h-3.5 w-3.5" />
              <span>Manual Admin Overrides:</span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                id="override-tier2-btn"
                disabled={submitting}
                onClick={() => handleClassifyAction("send_to_tier2")}
                className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-bold rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-50 cursor-pointer"
              >
                {submitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                <span>Push Tier 2</span>
              </button>

              <button
                id="override-pullback-btn"
                disabled={submitting}
                onClick={() => handleClassifyAction("pull_back")}
                className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-bold rounded bg-slate-900 hover:bg-slate-800 text-white transition-all disabled:opacity-50 cursor-pointer"
              >
                {submitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                <span>Pull Back</span>
              </button>

              <button
                id="override-strict-btn"
                disabled={submitting}
                onClick={() => handleClassifyAction("admin_only")}
                className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-bold rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all disabled:opacity-50 cursor-pointer"
              >
                {submitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                <span>Lock Strict Admin</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
