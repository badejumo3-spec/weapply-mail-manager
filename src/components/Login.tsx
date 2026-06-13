import { useState } from "react";
import { KeyRound, Mail, AlertCircle, ShieldAlert, Sparkles } from "lucide-react";

interface LoginProps {
  onSuccess: (token: string, user: { id: number; name: string; email: string; role: "ADMIN" | "WORKER" }) => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill out all login credentials.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      onSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err?.message || "Inability to contact service database.");
    } finally {
      setLoading(false);
    }
  };

  // Pre-seed helper connections for fast verification
  const handleShortcutLogin = (role: "ADMIN" | "WORKER") => {
    if (role === "ADMIN") {
      setEmail("admin@weapply4u.com");
      setPassword("admin123");
    } else {
      setEmail("worker@weapply4u.com");
      setPassword("worker123");
    }
    setError(null);
  };

  return (
    <div id="login-container" className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div 
        id="login-wrapper" 
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 overflow-hidden"
      >
        <div className="px-8 py-8 text-center bg-slate-50/40 border-b border-slate-100">
          <div className="mx-auto h-11 w-11 bg-indigo-600 text-white flex items-center justify-center rounded-xl font-bold text-lg select-none">
            W4
          </div>
          <h1 className="mt-4 text-lg font-bold text-slate-900 tracking-tight">WeApply4U Mail Manager</h1>
          <p className="mt-1 text-xs text-slate-400 font-medium">Authentication portal for workspace credentials</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-100 animate-pulse italic">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <Mail className="h-4 w-4" />
              </span>
              <input
                id="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. admin@weapply4u.com"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-650 focus:bg-white rounded-lg text-xs font-semibold text-slate-800 transition-all focus:ring-1 focus:ring-indigo-650 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Security Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <KeyRound className="h-4 w-4" />
              </span>
              <input
                id="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-650 focus:bg-white rounded-lg text-xs font-semibold text-slate-800 transition-all focus:ring-1 focus:ring-indigo-650 focus:outline-hidden"
              />
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-all text-white disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {loading ? "Verifying Keys..." : "Access System"}
          </button>
        </form>

        {/* Shortcuts Panel for direct testing */}
        <div className="px-8 pb-8 pt-2 border-t border-slate-150/40 bg-slate-50/20 text-center space-y-3">
          <div className="flex items-center justify-center space-x-1.5 text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Security Sandbox Shortcuts</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              id="autologin-admin-btn"
              onClick={() => handleShortcutLogin("ADMIN")}
              className="px-3 py-2 text-left bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all cursor-pointer group"
            >
              <p className="text-[10px] font-bold text-slate-900 group-hover:text-indigo-600">Admin (Tier 1)</p>
              <p className="text-[9px] font-mono font-semibold text-slate-500 truncate">admin@weapply4u.com</p>
            </button>

            <button
              id="autologin-worker-btn"
              onClick={() => handleShortcutLogin("WORKER")}
              className="px-3 py-2 text-left bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all cursor-pointer group"
            >
              <p className="text-[10px] font-bold text-slate-900 group-hover:text-indigo-600">Worker (Tier 2)</p>
              <p className="text-[9px] font-mono font-semibold text-slate-500 truncate">worker@weapply4u.com</p>
            </button>
          </div>
          <span className="text-[9px] font-medium text-slate-400 block pb-1">Clicking shortcuts auto-fills form inputs.</span>
        </div>
      </div>
    </div>
  );
}
