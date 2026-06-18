import { useState, FormEvent } from "react";
import { Mail, Lock, Loader2, AlertCircle, User, UserPlus, ArrowLeft, CheckCircle } from "lucide-react";

interface LoginProps {
  onSuccess: (token: string, user: any) => void;
  oauthError?: string | null;
}

export default function Login({ onSuccess, oauthError }: LoginProps) {
  // Login standard state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Registration state
  const [isRegistering, setIsRegistering] = useState(false);
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [regEmail, setRegEmail] = useState("");
  const [regName, setRegName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");

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

  const handleVerifyEmail = async (e: FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError("");

    try {
      const res = await fetch("/api/auth/check-pre-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setRegName(data.name || "");
      setRegStep(2);
    } catch (err: any) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      setRegError("Passwords do not match.");
      return;
    }
    if (regPassword.length < 6) {
      setRegError("Password must be at least 6 characters.");
      return;
    }

    setRegLoading(true);
    setRegError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setRegSuccess("Registration completed successfully! You can now sign in.");
      // Auto fill login email
      setEmail(regEmail);
      // Reset registration state after 2.5 seconds
      setTimeout(() => {
        setIsRegistering(false);
        setRegStep(1);
        setRegEmail("");
        setRegName("");
        setRegPassword("");
        setRegConfirmPassword("");
        setRegSuccess("");
      }, 2500);
    } catch (err: any) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Redirect to Google OAuth
    window.location.href = "/api/oauth/google";
  };

  const displayError = error || oauthError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black p-4 text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl p-8 space-y-6 relative overflow-hidden group">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/15 transition-all duration-1000"></div>
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl group-hover:bg-rose-500/15 transition-all duration-1000"></div>
        
        <div className="text-center relative z-10">
          <div className="w-14 h-14 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
            {isRegistering ? (
              <UserPlus className="h-6 w-6 text-white" />
            ) : (
              <Mail className="h-6 w-6 text-white" />
            )}
          </div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">WeApplying4U</h1>
          <p className="text-[11px] font-mono font-bold tracking-widest text-indigo-400 uppercase mt-1">Mail Manager System</p>
        </div>

        {!isRegistering ? (
          /* LOGIN FORM MODE */
          <>
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
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer font-sans"
              >
                {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : null}
                {loading ? "Authenticating session..." : "Access Control Sign In"}
              </button>
            </form>

            <div className="flex flex-col gap-3 relative z-10 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(true);
                  setRegStep(1);
                  setRegError("");
                  setRegSuccess("");
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-all cursor-pointer hover:underline"
              >
                New user? Register security credentials
              </button>
            </div>

            <div className="relative my-4 z-10 flex items-center">
              <div className="flex-1 border-t border-slate-800"></div>
              <span className="px-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">or</span>
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
          </>
        ) : (
          /* REGISTER FORM MODE */
          <>
            {regError && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs leading-normal relative z-10">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-400 mt-0.5" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs leading-normal relative z-10">
                <CheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-400 mt-0.5" />
                <span>{regSuccess}</span>
              </div>
            )}

            {regStep === 1 ? (
              /* REG STEP 1: Enter corporate email to verify */
              <form onSubmit={handleVerifyEmail} className="space-y-4 relative z-10">
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Please verify your corporate email to set up your security credentials. Registration is strictly permitted for pre-authorized accounts.
                </p>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Authorized corporate email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-xs font-semibold text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200"
                      placeholder="washington.ade@oasek.com"
                      required
                      disabled={regLoading || regSuccess !== ""}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={regLoading || regSuccess !== ""}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer font-sans"
                >
                  {regLoading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : null}
                  {regLoading ? "Checking authorization..." : "Verify Corporate Email"}
                </button>
              </form>
            ) : (
              /* REG STEP 2: Fill out details and set secure password */
              <form onSubmit={handleRegisterSubmit} className="space-y-4 relative z-10">
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Email verified! Enter your details and configure a strong login password.
                </p>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                  <input
                    type="text"
                    value={regEmail}
                    disabled
                    className="w-full px-3.5 py-2.5 bg-slate-950/20 border border-slate-800/40 rounded-xl text-xs font-bold text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-xs font-semibold text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200"
                      placeholder="Jane Doe"
                      required
                      disabled={regLoading || regSuccess !== ""}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Choose secure Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-xs font-semibold text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200"
                      placeholder="••••••••"
                      required
                      disabled={regLoading || regSuccess !== ""}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-xs font-semibold text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200"
                      placeholder="••••••••"
                      required
                      disabled={regLoading || regSuccess !== ""}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={regLoading || regSuccess !== ""}
                  className="w-full h-11 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer font-sans"
                >
                  {regLoading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : null}
                  {regLoading ? "Completing registration..." : "Complete Registration"}
                </button>
              </form>
            )}

            <div className="flex justify-center relative z-10 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (regStep === 2 && !regSuccess) {
                    setRegStep(1);
                  } else {
                    setIsRegistering(false);
                  }
                  setRegError("");
                }}
                disabled={regLoading}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-all cursor-pointer hover:underline disabled:opacity-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {regStep === 2 && !regSuccess ? "Back to email input" : "Cancel & Sign In"}
              </button>
            </div>
          </>
        )}

        <p className="text-[10px] text-slate-500 text-center font-semibold uppercase tracking-wider relative z-10 pt-2 border-t border-slate-805/40">
          Admin Gateways Only • Secure AES-256 Auth
        </p>
      </div>
    </div>
  );
}