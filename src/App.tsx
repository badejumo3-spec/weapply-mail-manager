import { useState, useEffect, useCallback } from "react";
import { User, Email, Client, AuditLog } from "./types";
import { ThemeProvider } from "./context/ThemeContext";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import OtpFeed from "./components/OtpFeed";
import FullInbox from "./components/FullInbox";
import ClientManager from "./components/ClientManager";
import AuditLogger from "./components/AuditLogger";
import EmailModal from "./components/EmailModal";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("otps");
  const [emails, setEmailQueue] = useState<Email[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(90);

  // ✅ Handle OAuth Token from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthToken = urlParams.get("token");
    const oauthStatus = urlParams.get("oauth");

    if (oauthToken && !token) {
      localStorage.setItem("token", oauthToken);
      setToken(oauthToken);
      window.history.replaceState({}, document.title, "/");
    }

    if (oauthStatus === "denied") {
      setOauthError("Access denied. Only authorized admin emails can login.");
    } else if (oauthStatus === "error") {
      setOauthError("OAuth login failed. Please try again.");
    }
  }, []);

  // ✅ Validate Token and Fetch User
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setInitializing(false);
        return;
      }
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error("Session expired or token invalid.");
        }

        const me: User = await res.json();
        setUser(me);
        if (me.role !== "ADMIN") {
          setActiveTab("otps");
        }
      } catch (err) {
        console.warn(err);
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      } finally {
        setInitializing(false);
      }
    };

    fetchMe();
  }, [token]);

  const handleLoginSuccess = (newToken: string, loggedUser: User) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(loggedUser);
    setActiveTab("otps");
    setOauthError(null);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setEmailQueue([]);
    setClients([]);
    setLogs([]);
    setOauthError(null);
  };

  // ✅ FIX: Removed selectedEmail from dependencies and removed restore logic
  const fetchEmails = useCallback(async () => {
    if (!token || !user) return;
    setLoadingEmails(true);
    setPanelError(null);
    try {
      const url = activeTab === "inbox" ? "/api/emails" : "/api/emails/otps";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load email indexes.");
      const data: Email[] = await res.json();
      setEmailQueue(data);
      // ✅ REMOVED: No more selectedEmail restore logic (was causing reopen bug)
    } catch (err: any) {
      setPanelError(err?.message || "Communication failure fetching mail.");
    } finally {
      setLoadingEmails(false);
    }
  }, [token, user, activeTab]); // ✅ REMOVED: selectedEmail from dependencies

  const fetchClients = useCallback(async () => {
    if (!token || !user || user.role !== "ADMIN") return;
    setLoadingClients(true);
    try {
      const res = await fetch("/api/clients", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Credentials list blocked.");
      const data: Client[] = await res.json();
      setClients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClients(false);
    }
  }, [token, user]);

  const fetchLogs = useCallback(async () => {
    if (!token || !user || user.role !== "ADMIN") return;
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/logs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load history.");
      const data: AuditLog[] = await res.json();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (!token || !user) return;

    if (activeTab === "otps" || activeTab === "inbox") {
      fetchEmails();
    } else if (activeTab === "mailboxes") {
      fetchClients();
    } else if (activeTab === "audit") {
      fetchLogs();
    }
  }, [activeTab, token, user, fetchEmails, fetchClients, fetchLogs]);

  useEffect(() => {
    if (!token || !user) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger data reload on expiration
          if (activeTab === "otps" || activeTab === "inbox") {
            fetchEmails();
          } else if (activeTab === "mailboxes") {
            fetchClients();
          }
          return 90;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeTab, token, user, fetchEmails, fetchClients]);

  const handleManualSync = async () => {
    if (!token || !user || user.role !== "ADMIN") return;
    setSyncing(true);
    setPanelError(null);
    try {
      const res = await fetch("/api/clients/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Manual sync rejected.");
      }

      await Promise.all([fetchEmails(), fetchClients()]);
      setCountdown(90); // Reset the 90s countdown instantly on manual sync success!
    } catch (err: any) {
      setPanelError(err?.message || "Sync request server failed.");
    } finally {
      setSyncing(false);
    }
  };

  const handleClassify = async (id: number, action: "send_to_tier2" | "pull_back" | "admin_only") => {
    if (!token || !user || user.role !== "ADMIN") return;
    try {
      const res = await fetch(`/api/emails/${id}/classify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error("Sync classification override rejected.");
      
      await fetchEmails();
    } catch (err) {
      console.error(err);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-slate-400" />
          <p className="text-xs font-semibold font-mono tracking-widest text-slate-400 uppercase">Synchronizing Application Context...</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <Login onSuccess={handleLoginSuccess} oauthError={oauthError} />;
  }

  return (
    <ThemeProvider>
      <div className="flex bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-800 dark:text-slate-100 font-sans antialiased transition-colors duration-300">
        <Sidebar
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={handleLogout}
          syncing={syncing}
          onManualSync={handleManualSync}
          countdown={countdown}
          onResetCountdown={() => setCountdown(90)}
        />

        <main className="flex-1 p-8 overflow-y-auto h-screen relative scrollbar">
          {oauthError && (
            <div className="mb-6 flex items-start space-x-2.5 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800">
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              <span>{oauthError}</span>
              <button 
                onClick={() => setOauthError(null)}
                className="ml-auto text-rose-500 hover:text-rose-700"
              >
                ✕
              </button>
            </div>
          )}

          {panelError && (
            <div className="mb-6 flex items-start space-x-2.5 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-xs font-semibold border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              <span>{panelError}</span>
              <button 
                onClick={() => setPanelError(null)}
                className="ml-auto text-amber-500 hover:text-amber-700"
              >
                ✕
              </button>
            </div>
          )}

          {activeTab === "otps" && (
            <OtpFeed
              emails={emails}
              loading={loadingEmails}
              onRefresh={fetchEmails}
              onSelectEmail={setSelectedEmail}
            />
          )}

          {activeTab === "inbox" && user.role === "ADMIN" && (
            <FullInbox
              emails={emails}
              loading={loadingEmails}
              onRefresh={fetchEmails}
              onClassify={handleClassify}
              onSelectEmail={setSelectedEmail}
              token={token}
            />
          )}

          {activeTab === "mailboxes" && user.role === "ADMIN" && (
            <ClientManager
              clients={clients}
              loading={loadingClients}
              onRefresh={fetchClients}
              token={token}
            />
          )}

          {activeTab === "audit" && user.role === "ADMIN" && (
            <AuditLogger
              logs={logs}
              loading={loadingLogs}
            />
          )}
        </main>

        {selectedEmail && (
          <EmailModal
            email={selectedEmail}
            onClose={() => setSelectedEmail(null)}
            onClassify={user.role === "ADMIN" ? (action) => handleClassify(selectedEmail.id, action) : undefined}
            userRole={user.role}
          />
        )}
      </div>
    </ThemeProvider>
  );
}