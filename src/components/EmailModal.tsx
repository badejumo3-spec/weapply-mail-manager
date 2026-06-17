import { useState, useEffect } from "react";
import { X, Copy, Mail, ShieldAlert, Check, RefreshCw, EyeOff, Clock, Key, Link as LinkIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Email } from "../types";
import { getTimeRemaining, formatCountdown } from "../utils/time";
import { useTheme } from "../context/ThemeContext";

interface EmailModalProps {
  email: Email;
  onClose: () => void;
  onClassify?: (action: "send_to_tier2" | "pull_back" | "admin_only") => Promise<void>;
  userRole: "ADMIN" | "WORKER";
}

export default function EmailModal({ email, onClose, onClassify, userRole }: EmailModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [copied, setCopied] = useState<"otp" | "link" | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // ✅ ESC closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Live countdown
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

  const getStatusBadge = (classification: string, visibility: string) => {
    if (classification === "sent_to_tier2") {
      return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold dark:bg-emerald-900/30 dark:text-emerald-400">SENT TO TIER2</span>;
    }
    if (classification === "pulled_back") {
      return <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold dark:bg-indigo-900/50">PULLED BACK</span>;
    }
    return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold dark:bg-slate-800 dark:text-slate-400">ADMIN ONLY</span>;
  };

  const styledHtmlDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { 
            font-family: system-ui, -apple-system, sRGB, Helvetica, Arial, sans-serif; 
            font-size: 14px; 
            padding: 16px; 
            color: ${isDark ? "#f1f5f9" : "#1e293b"}; 
            background-color: ${isDark ? "#1e293b" : "#ffffff"}; 
            line-height: 1.6; 
          }
          a { color: ${isDark ? "#818cf8" : "#4f46e5"}; text-decoration: underline; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>${email.full_body_html || email.full_body_text}</body>
    </html>
  `;

  return (
    <AnimatePresence>
      <motion.div
        key="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm p-4"
      >
        <motion.div
          key="modal-content"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex flex-col w-full max-w-4xl h-[90vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                <Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-lg">{email.subject}</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Expires in:{" "}
                  <span className={isExpired ? "text-rose-600 dark:text-rose-400 font-bold" : "text-amber-600 dark:text-amber-400 font-bold"}>
                    {timeLeft}
                  </span>
                </p>
              </div>
            </div>
            {/* ✅ Close button with ghost click prevention */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTimeout(() => onClose(), 50);
              }}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50/80 dark:bg-slate-800/40 backdrop-blur-sm p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/50">
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Sender</p>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">{email.sender}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Recipient</p>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">{email.recipient_email}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Classification</p>
                {getStatusBadge(email.classification_status, email.visibility_level)}
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Received</p>
                <p className="text-xs font-mono text-slate-900 dark:text-slate-200">{new Date(email.received_at).toLocaleString()}</p>
              </div>
            </div>

            {/* Extraction Panel */}
            {(email.otp_code || email.verification_link) && (
              <div className="bg-indigo-50/80 dark:bg-indigo-900/20 backdrop-blur-sm p-4 rounded-xl space-y-3 border border-indigo-100 dark:border-indigo-800/50">
                <h3 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Extracted Authentication Payload
                </h3>
                
                {email.otp_code && (
                  <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                      {/* ✅ ENHANCED: Better mono typography with letter-spacing */}
                      <p className="text-xl font-mono font-bold tracking-[0.15em] text-indigo-700 dark:text-indigo-400">{email.otp_code}</p>
                    </div>
                    {/* ✅ ENHANCED: Copy button with emerald success state */}
                    <button
                      onClick={() => handleCopy(email.otp_code!, "otp")}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        copied === "otp"
                          ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                          : "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 border border-transparent"
                      }`}
                    >
                      {copied === "otp" ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copied === "otp" ? "Copied!" : "Copy Code"}</span>
                    </button>
                  </div>
                )}

                {email.verification_link && (
                  <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <LinkIcon className="h-4 w-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400 truncate">{email.verification_link}</p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={email.verification_link}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 transition-colors"
                      >
                        Open Link
                      </a>
                      <button
                        onClick={() => handleCopy(email.verification_link!, "link")}
                        className={`p-1.5 rounded-lg border transition-all ${
                          copied === "link"
                            ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                            : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                        }`}
                        title="Copy Link"
                      >
                        {copied === "link" ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* HTML Body */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Email Content</h3>
              <iframe
                srcDoc={styledHtmlDoc}
                sandbox="allow-popups"
                referrerPolicy="no-referrer"
                className="w-full h-80 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                title="Email Content"
              />
            </div>

            {/* Plaintext Fallback */}
            <details className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <summary className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50 cursor-pointer">
                Plaintext Fallback
              </summary>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 font-mono text-xs max-h-48 overflow-y-auto text-slate-700 dark:text-slate-300">
                {email.full_body_text || "No plaintext available"}
              </div>
            </details>
          </div>

          {/* Footer - Admin Only */}
          {userRole === "ADMIN" && onClassify && (
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2">
              <button
                disabled={submitting}
                onClick={() => handleClassifyAction("send_to_tier2")}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {submitting ? "Processing..." : "Push Tier 2"}
              </button>
              <button
                disabled={submitting}
                onClick={() => handleClassifyAction("pull_back")}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                {submitting ? "Processing..." : "Pull Back"}
              </button>
              <button
                disabled={submitting}
                onClick={() => handleClassifyAction("admin_only")}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
              >
                {submitting ? "Processing..." : "Strict"}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}