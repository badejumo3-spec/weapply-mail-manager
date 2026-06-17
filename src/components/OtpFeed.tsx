import { useState, useEffect, useRef } from "react";
import { Copy, Check, ExternalLink, Flame, Search, Layers, Clock, ShieldCheck, Mail } from "lucide-react";
import { Email } from "../types";
import { getTimeRemaining } from "../utils/time";
import { motion, AnimatePresence } from "motion/react";

// Standard Real-time countdown ticker widget for OTP feeds
function FeedTicker({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const check = () => {
      const diff = getTimeRemaining(expiresAt);

      if (diff <= 0) {
        if (!expired) {
          setExpired(true);
          setTimeLeft("EXPIRED");
          onExpire();
        }
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}m ${secs}s`);
      setExpired(false);
    };

    check();
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  return (
    <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono border ${
      expired 
        ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800" 
        : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
    }`}>
      <Clock className="h-3 w-3 animate-pulse" />
      <span>{timeLeft}</span>
    </div>
  );
}

interface OtpFeedProps {
  emails: Email[];
  loading: boolean;
  onRefresh: () => void;
  onSelectEmail: (email: Email) => void;
}

export default function OtpFeed({ emails, loading, onRefresh, onSelectEmail }: OtpFeedProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tickerToggle, setTickerToggle] = useState(0);
  const [previousEmailIds, setPreviousEmailIds] = useState<Set<string>>(new Set());
  const [newEmailIds, setNewEmailIds] = useState<Set<string>>(new Set());
  
  // Preserve scroll position during refresh
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  // Track new emails when emails array changes
  useEffect(() => {
    if (emails.length > 0) {
      const currentIds = new Set(emails.map(e => e.id));
      const newIds = new Set(emails.filter(e => !previousEmailIds.has(e.id)).map(e => e.id));
      
      if (newIds.size > 0) {
        setNewEmailIds(newIds);
        setPreviousEmailIds(currentIds);
        
        // Clear animation flag after 1 second
        setTimeout(() => setNewEmailIds(new Set()), 1000);
      }
    }
  }, [emails]);

  // Force trigger list refresh if anything expires
  const handleExpired = () => {
    setTickerToggle((prev) => prev + 1);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter feeds based on search query
  const filteredFeed = emails.filter((email) => {
    const query = search.toLowerCase();
    return (
      email.subject.toLowerCase().includes(query) ||
      email.sender.toLowerCase().includes(query) ||
      email.recipient_email.toLowerCase().includes(query) ||
      (email.otp_code && email.otp_code.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6 bg-slate-100 dark:bg-slate-950 min-h-screen p-8">
      {/* Search and control banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/80 dark:bg-slate-900/40 backdrop-blur-md p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
            <ShieldCheck className="h-4.5 w-4.5 text-slate-500 dark:text-slate-400" />
            <span>Tier 2 Verification OTP Feed</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Secure, real-time list of unexpired credentials and login tokens</p>
        </div>

        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            id="feed-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search credential codes, origins..."
            className="w-full pl-8.5 pr-4 py-2 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-slate-900 dark:focus:border-slate-600 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 focus:outline-hidden transition-all focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-600"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 bg-white/80 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-xs">
          <div className="animate-spin inline-block h-6 w-6 border-2 border-slate-900 dark:border-slate-100 border-t-transparent rounded-full mb-2" />
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium font-mono">Synchronizing live stream feeds...</p>
        </div>
      ) : filteredFeed.length === 0 ? (
        <div className="text-center py-20 bg-white/80 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-700/50 border-dashed max-w-4xl mx-auto p-6 space-y-3">
          <Flame className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">OTP Feed is Clear</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">No unexpired authentication links or OTP verification codes exist for your level in the system right now.</p>
        </div>
      ) : (
        <div ref={feedContainerRef} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto p-1">
          <AnimatePresence>
            {filteredFeed.map((email, index) => (
              <motion.div
                key={email.id}
                initial={newEmailIds.has(email.id) ? { opacity: 0, y: -20, scale: 0.95 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ 
                  duration: 0.3,
                  delay: newEmailIds.has(email.id) ? index * 0.05 : 0
                }}
                className="bg-white/90 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-xs hover:shadow-md hover:border-indigo-300/40 dark:hover:border-indigo-700/40 transition-all duration-300 p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Meta Header block */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-2">
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Mailbox Source</span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{email.client_name || "Unknown client"}</h4>
                      <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 block truncate">{email.recipient_email}</span>
                    </div>

                    <FeedTicker expiresAt={email.expires_at} onExpire={handleExpired} />
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800" />

                  {/* Sender Title and email subject */}
                  <div 
                    onClick={() => onSelectEmail(email)}
                    className="space-y-1 block hover:bg-slate-50/75 dark:hover:bg-slate-800/50 p-2 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/50"
                  >
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Target Action Context</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-snug">{email.subject}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-medium">sender: {email.sender}</p>
                  </div>
                </div>

                {/* Extraction block */}
                <div className="bg-slate-50/80 dark:bg-slate-800/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/50 p-4 rounded-xl space-y-3">
                  {email.otp_code && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] tracking-wider uppercase font-bold text-slate-400 dark:text-slate-500 font-mono">One-Time OTP Code</p>
                        {/* ✅ ENHANCED: Better mono typography with letter-spacing */}
                        <p className="text-lg font-mono font-bold tracking-[0.2em] mt-0.5 text-indigo-700 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-900/30 px-4 py-1.5 rounded-lg border border-indigo-200/60 dark:border-indigo-800/50 select-all inline-block shadow-xs">
                          {email.otp_code}
                        </p>
                      </div>

                      {/* ✅ ENHANCED: Copy button with color change animation */}
                      <button
                        id={`copy-feed-otp-${email.id}`}
                        onClick={() => handleCopy(email.otp_code!, `feed-otp-${email.id}`)}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-95 ${
                          copiedId === `feed-otp-${email.id}`
                            ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 border border-transparent"
                        }`}
                      >
                        {copiedId === `feed-otp-${email.id}` ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>{copiedId === `feed-otp-${email.id}` ? "Copied!" : "Copy"}</span>
                      </button>
                    </div>
                  )}

                  {email.verification_link && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/50">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-[9px] tracking-wider uppercase font-bold text-slate-400 dark:text-slate-500 font-mono">Authentication Link</p>
                        <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate font-mono mt-0.5" title={email.verification_link}>{email.verification_link}</p>
                      </div>

                      <div className="flex space-x-1 shrink-0">
                        <a
                          id={`feed-launch-link-${email.id}`}
                          href={email.verification_link}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 px-2.5 text-[10px] font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white flex items-center space-x-1 transition-colors cursor-pointer select-none"
                        >
                          <span>Launch</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <button
                          id={`copy-feed-link-${email.id}`}
                          onClick={() => handleCopy(email.verification_link!, `feed-link-${email.id}`)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            copiedId === `feed-link-${email.id}`
                              ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                              : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                          }`}
                          title="Copy Address"
                        >
                          {copiedId === `feed-link-${email.id}` ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expand details button */}
                <button
                  id={`expand-feed-details-${email.id}`}
                  onClick={() => onSelectEmail(email)}
                  className="w-full py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <Mail className="h-3 w-3.5" />
                  <span>View Full Email Session</span>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}