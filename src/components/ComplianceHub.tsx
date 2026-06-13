import React, { useState } from "react";
import { 
  Shield, Key, KeySquare, HelpCircle, Eye, EyeOff, RotateCw, CheckCircle, 
  AlertTriangle, Lock, Unlock, Database, Clipboard, Info, Server, Activity
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function ComplianceHub() {
  // Token simulator state
  const [plainToken, setPlainToken] = useState("ya29.a0AfB_byBuO109_v82n9h49fH83nfj4982nd_mock_google_refresh_token");
  const [encryptedHex, setEncryptedHex] = useState("");
  const [saltIv, setSaltIv] = useState("");
  const [authTag, setAuthTag] = useState("");
  const [showTokenSimDetails, setShowTokenSimDetails] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);

  // 2FA state
  const [totpCode, setTotpCode] = useState("");
  const [is2faActivated, setIs2faActivated] = useState(false);
  const [twoFaError, setTwoFaError] = useState("");

  // Rate limiter stats
  const [rateLimitLogs, setRateLimitLogs] = useState([
    { path: "/api/v1/auth/token-exchange", limit: 30, remaining: 28, window: "60s" },
    { path: "/api/v1/emails/otps", limit: 500, remaining: 489, window: "60s" },
    { path: "/api/v1/clients/connect", limit: 10, remaining: 10, window: "60s" }
  ]);

  const handleEncryptSimulation = () => {
    if (!plainToken) return;
    setIsEncrypting(true);
    setTimeout(() => {
      // Simulate real cryptographic outcome (AES-256 GCM)
      // Standard output blocks: ciphertext, iv, auth tag
      // For presentation purposes, we generate some realistic hex blocks
      const mockCipher = Array.from({ length: 48 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      const mockIV = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      const mockTag = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      
      setEncryptedHex(mockCipher);
      setSaltIv(mockIV);
      setAuthTag(mockTag);
      setIsEncrypting(false);
      setShowTokenSimDetails(true);
    }, 800);
  };

  const handleActivate2FA = (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6 || isNaN(Number(totpCode))) {
      setTwoFaError("Invalid format. Passcodes must be exactly 6 digits.");
      return;
    }
    setTwoFaError("");
    setIs2faActivated(true);
    setTimeout(() => {
      const audio = new Audio();
    }, 1);
  };

  return (
    <div className="space-y-6">
      
      {/* Introduction */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-xs">
        <h2 className="text-xl font-display font-bold text-gray-950 flex items-center gap-1.5">
          <Shield className="h-5.5 w-5.5 text-indigo-600" />
          Security Architecture & Regulation Gateways
        </h2>
        <p className="text-xs text-gray-500 mt-1 max-w-3xl leading-relaxed">
          At WeApply4U Mail Manager, data transport and access rules are governed by strict compliance boundaries. This helper station simulates token encryption, 2FA setup, and rate limiting buckets.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Token Cryptography Simulation */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-display font-semibold text-gray-900 flex items-center gap-2">
              <KeySquare className="h-4.5 w-4.5 text-indigo-600" />
              AES-256-GCM Token Encryption Simulation
            </h3>
            <p className="text-xs text-gray-500 mt-1 mb-4 leading-relaxed">
              We encryption-protect all API tokens. Raw OAuth secrets are never persisted in Postgres tables without passing through a custom cryptographic envelope with localized Initialization Vectors (IV).
            </p>

            <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">
                  Raw Bearer Refresh Token Inputs (Simulates incoming client credentials)
                </label>
                <input
                  type="text"
                  value={plainToken}
                  onChange={(e) => setPlainToken(e.target.value)}
                  placeholder="Enter token string to test..."
                  className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={handleEncryptSimulation}
                  disabled={isEncrypting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white font-sans text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isEncrypting ? (
                    <>
                      <RotateCw className="h-3.5 w-3.5 animate-spin" />
                      Encrypting...
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      Encrypt and Package
                    </>
                  )}
                </button>
                <span className="text-[10px] text-gray-400 font-mono">Algo: AES-256-GCM / PBKDF2</span>
              </div>
            </div>

            <AnimatePresence>
              {showTokenSimDetails && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 pt-4 border-t border-gray-150 space-y-3 font-mono text-xs overflow-hidden"
                >
                  <div className="p-3 bg-slate-900 text-slate-300 rounded-lg border border-slate-800 space-y-2">
                    <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest border-b border-gray-800 pb-1 flex items-center justify-between">
                      <span>Cryptographic Output Envelope</span>
                      <span className="bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded text-[8px]">Secured</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">CIPHERTEXT (Stored in `encrypted_refresh_token` table column):</span>
                      <div className="bg-stone-950 p-2 rounded text-stone-200 break-all text-[11px] select-all mt-0.5 border border-stone-850">
                        {encryptedHex}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[10px] text-gray-400 block uppercase">IV (Initialization Vector):</span>
                        <div className="bg-stone-950 p-1.5 rounded text-stone-200 mt-0.5 break-all border border-stone-850">
                          {saltIv}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block uppercase">AUTH TAG (GCM integrity tag):</span>
                        <div className="bg-stone-950 p-1.5 rounded text-stone-200 mt-0.5 break-all border border-stone-850">
                          {authTag}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 italic">
                    * The database stores the IV alongside the cyphertext, which allows safe decryption on-the-fly inside the Sync Engine using a node server-level master key (`TOKEN_ENCRYPTION_SECRET`), ensuring database leaks reveal zero plain text refresh keys.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-5 p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg text-xs flex gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-emerald-950 font-sans block mb-0.5">GDPR Article 17 Compliant Purge</strong>
              When an administrator deletes a client email connection, our system deletes the associated encryption parameter rows, making historical encrypted records unreadable under key erasure.
            </div>
          </div>
        </div>

        {/* 2FA Authenticator Simulator */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-display font-semibold text-gray-900 flex items-center gap-2">
              <Lock className="h-4.5 w-4.5 text-indigo-600" />
              Tier 2 Worker 2FA Authenticator Enrollment
            </h3>
            <p className="text-xs text-gray-500 mt-1 mb-4 leading-relaxed">
              We apply strict multi-factor rules. Workers cannot interact with OTP tables without enrolling in an Authenticator application (Google Authenticator, Duo).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
              
              {/* Fake Enrollment QR Code */}
              <div className="flex flex-col items-center justify-center p-3.5 bg-white border border-gray-200 rounded-lg">
                <div className="w-28 h-28 bg-stone-100 border-2 border-dashed border-stone-300 relative flex items-center justify-center rounded">
                  {/* Grid of black and white squares mimicking QR code */}
                  <div className="grid grid-cols-4 gap-1 p-2 w-full h-full opacity-70">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div key={i} className={`rounded-xs ${i % 3 === 0 || i % 7 === 1 ? "bg-slate-900" : "bg-transparent"}`}></div>
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 select-none text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest shrink-0">
                    Sec. QR Core
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 font-mono mt-2 select-all">
                  Secret: K7NW3X9J2PA
                </span>
              </div>

              {/* Activation Form */}
              <form onSubmit={handleActivate2FA} className="flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block">
                    1. Scan QR and scan TOTP Code
                  </span>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={(e) => {
                      setTotpCode(e.target.value.replace(/\D/g, ""));
                      setTwoFaError("");
                    }}
                    placeholder="e.g. 521094"
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-center font-mono letter-spacing-lg tracking-widest font-bold"
                  />
                  {twoFaError && (
                    <p className="text-[10px] font-mono font-medium text-rose-500 flex items-center gap-1">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {twoFaError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-950 hover:bg-slate-900 text-white font-sans py-2 rounded text-xs font-semibold cursor-pointer"
                >
                  Activate Enrolled 2FA
                </button>

                {is2faActivated && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-100 text-[10px] leading-relaxed">
                    <strong className="block font-semibold">2FA Activated!</strong>
                    JWT sessions now enforce multi-factor claims matching Postgres keys.
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Secure Headers & Rate Limit metrics */}
          <div className="mt-5 space-y-3">
            <h4 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Activity className="h-3.5 w-3.5 text-indigo-500" /> Active Rate Limiting Windows
            </h4>
            <div className="grid grid-cols-1 gap-2 text-xs font-mono">
              {rateLimitLogs.map((log, index) => (
                <div key={index} className="flex items-center justify-between p-2.5 border border-gray-100 rounded-lg">
                  <div>
                    <span className="font-semibold text-slate-800">{log.path}</span>
                    <span className="block text-[10px] text-gray-400">Window: {log.window}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-indigo-600">{log.remaining}</span>
                    <span className="text-gray-400"> / {log.limit} Left</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
