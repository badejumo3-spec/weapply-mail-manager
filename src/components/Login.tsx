import { useState, FormEvent } from "react";
import { Mail, Lock, Loader2, AlertCircle } from "lucide-react";

interface LoginProps {
  onSuccess: (token: string, user: any) => void;
  oauthError?: string | null;
}

export default function Login({ onSuccess, oauthError }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }

      const data = await res.json();
      onSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Redirect to Google OAuth
    window.location.href = "/api/oauth/google";
  };

  const displayError = error || oauthError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black p-4 selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl p-8 space-y-6 relative overflow-hidden group">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/15 transition-all duration-1000"></div>
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl group-hover:bg-rose-500/15 transition-all duration-1000"></div>
        
        <div className="text-center relative z-10">
          <div className="w-14 h-14 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">WeApplying4U</h1>
          <p className="text-[11px] font-mono font-bold tracking-widest text-indigo-400 uppercase mt-1">Mail Manager System</p>
        </div>

        {displayError && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs leading-normal animate-shake relative z-10">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-400 mt-0.5" />
            <span>{displayError}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-xs font-semibold text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200"
                placeholder="admin@weapplying4u.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Security Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-xs font-semibold text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : null}
            {loading ? "Authenticating session..." : "Access Control Sign In"}
          </button>
        </form>

        <div className="relative my-4 z-10 flex items-center">
          <div className="flex-1 border-t border-slate-800"></div>
          <span className="px-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-slate-900/0">or</span>
          <div className="flex-1 border-t border-slate-800"></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full h-11 bg-slate-950/40 hover:bg-slate-950/80 active:scale-[0.98] text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-800 hover:border-slate-700 flex items-center justify-center gap-2.5 shadow-sm cursor-pointer z-10 relative"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google Identity SSO
        </button>

        <p className="text-[10px] text-slate-500 text-center font-semibold uppercase tracking-wider relative z-10 pt-2 border-t border-slate-805/40">
          Admin Gateways Only • Secure AES-256 Auth
        </p>
      </div>
    </div>
  );
}