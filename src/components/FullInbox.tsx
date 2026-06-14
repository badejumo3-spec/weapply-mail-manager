import { useState, useEffect } from "react";
import { Mail, Shield, Trash, Clock, Check, Copy, ExternalLink, KeyRound, Lock, Eye } from "lucide-react";
import { Email } from "../types";
import { getTimeRemaining, formatCountdown } from "../utils/time";

// Countdown Ticker Component
function CountdownTicker({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      setRemaining(getTimeRemaining(expiresAt));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <span
      className={`font-mono text-xs font-bold leading-none ${
        remaining <= 0
          ? "text-rose-500 bg-rose-50 px-1.5 py-1 rounded-sm border border-rose-100"
          : "text-amber-500"
      }`}
    >
      {formatCountdown(remaining)}
    </span>
  );
}
interface FullInboxProps {
  emails: Email[];
  loading: boolean;
  onRefresh: () => void;
  onClassify: (id: number, action: "send_to_tier2" | "pull_back" | "admin_only") => Promise<void>;
  onSelectEmail: (email: Email) => void;
  token: string;
}

export default function FullInbox({ emails, loading, onRefresh, onClassify, onSelectEmail, token }: FullInboxProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredEmails = emails.filter((email) => {
    const query = filterText.toLowerCase();
    return (
      email.subject.toLowerCase().includes(query) ||
      email.sender.toLowerCase().includes(query) ||
      email.recipient_email.toLowerCase().includes(query) ||
      (email.otp_code && email.otp_code.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner and Filter input */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Mail className="h-4.5 w-4.5 text-indigo-600" />
            <span>Administrator Full Inbox View</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Comprehensive listings of incoming system sessions and logs</p>
        </div>

        <input
          id="inbox-search"
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter sender, recipient, subject, or OTP..."
          className="px-3.5 py-2 hover:border-slate-300 border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold rounded-lg text-slate-700 w-full md:max-w-xs focus:outline-hidden transition-all focus:ring-1 focus:ring-indigo-600"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="animate-spin inline-block h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full mb-2" />
          <p className="text-xs text-slate-400 font-medium font-mono">Synchronizing inboxes...</p>
        </div>
      ) : filteredEmails.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <Mail className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Emails Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">No emails are matching the filter, or no messages have been synced from linked mailboxes in the last hour.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-4">Sender & Receiver</th>
                  <th className="px-5 py-4">Subject</th>
                  <th className="px-5 py-4 text-center">Countdown</th>
                  <th className="px-5 py-4">Extracted Payload</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Overrides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmails.map((email) => (
                  <tr 
                    key={email.id}
                    className="hover:bg-slate-50/50 transition-colors group align-middle"
                  >
                    {/* Sender and Receiver information */}
                    <td className="px-5 py-4 max-w-[200px]">
                      <div className="text-xs font-bold text-slate-900 truncate" title={email.sender}>{email.sender}</div>
                      <div className="text-[10px] font-mono text-slate-450 truncate mt-0.5" title={email.recipient_email}>to: {email.recipient_email}</div>
                    </td>

                    {/* Subject */}
                    <td className="px-5 py-4 max-w-[220px]">
                      <div 
                        onClick={() => onSelectEmail(email)}
                        className="text-xs font-semibold text-slate-700 hover:text-indigo-600 font-sans cursor-pointer truncate flex items-center space-x-1.5"
                        title="Click to expand full message body"
                      >
                        <span className="truncate">{email.subject}</span>
                        <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-slate-400 shrink-0 transition-opacity" />
                      </div>
                      <div className="text-[9px] font-sans text-slate-400 font-semibold mt-0.5">{new Date(email.received_at).toLocaleTimeString()}</div>
                    </td>

                    {/* Countdown */}
                    <td className="px-5 py-4 text-center">
                      <CountdownTicker expiresAt={email.expires_at} />
                    </td>

                    {/* Extracted Artifacts */}
                    <td className="px-5 py-4 max-w-[240px]">
                      <div className="space-y-1.5">
                        {email.otp_code && (
                          <div className="inline-flex items-center px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded font-mono text-xs font-bold text-indigo-700 space-x-1.5 shrink-0 select-all">
                            <span className="tracking-widest">{email.otp_code}</span>
                            <button
                              id={`copy-otp-row-${email.id}`}
                              onClick={() => handleCopy(email.otp_code!, `otp-${email.id}`)}
                              className="text-indigo-400 hover:text-indigo-800 p-0.5 transition-colors cursor-pointer"
                              title="Copy Code"
                            >
                              {copiedId === `otp-${email.id}` ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        )}

                        {email.verification_link && (
                          <div className="flex items-center space-x-1.5">
                            <a
                              id={`go-link-row-${email.id}`}
                              href={email.verification_link}
                              target="_blank"
                              rel="noreferrer referrer"
                              className="inline-flex items-center space-x-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-805 bg-indigo-50/55 hover:bg-indigo-100/60 rounded py-0.5 px-2 select-none border border-indigo-100"
                            >
                              <span>Verification URL</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                            <button
                              id={`copy-link-row-${email.id}`}
                              onClick={() => handleCopy(email.verification_link!, `link-${email.id}`)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 transition-colors cursor-pointer"
                            >
                              {copiedId === `link-${email.id}` ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        )}

                        {!email.otp_code && !email.verification_link && (
                          <span className="text-[10px] text-slate-300 font-medium italic">No artifacts</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        email.classification_status === "sent_to_tier2" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                        email.classification_status === "auto_filtered" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                        email.classification_status === "pulled_back" ? "bg-indigo-600 text-white" :
                        "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        {email.classification_status === "sent_to_tier2" ? "SENT TO TIER2" :
                         email.classification_status === "auto_filtered" ? "AUTO FILTERED" :
                         email.classification_status === "pulled_back" ? "PULLED BACK" :
                         "ADMIN ONLY"}
                      </span>
                    </td>

                    {/* Manual action selectors */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5 opacity-85 group-hover:opacity-100 transition-opacity">
                        <button
                          id={`action-to-tier2-${email.id}`}
                          onClick={() => onClassify(email.id, "send_to_tier2")}
                          className="px-2 py-1 text-[10px] font-bold rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                          title="Forward verification payload directly to Tier 2 Worker OTP feeds"
                        >
                          Send Tier 2
                        </button>
                        
                        <button
                          id={`action-pull-back-${email.id}`}
                          onClick={() => onClassify(email.id, "pull_back")}
                          className="px-2 py-1 text-[10px] font-bold rounded bg-slate-905 text-white hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Revoke access from Tier 2 Workers feeds instantly"
                        >
                          Pull Back
                        </button>

                        <button
                          id={`action-strict-admin-${email.id}`}
                          onClick={() => onClassify(email.id, "admin_only")}
                          className="px-2 py-1 text-[10px] font-bold rounded bg-white hover:bg-slate-50 transition-colors border border-slate-200 text-slate-700 cursor-pointer"
                          title="Lock email strictly as administrator view only"
                        >
                          Strict
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
