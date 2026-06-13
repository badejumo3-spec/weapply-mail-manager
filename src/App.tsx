import { useState, useEffect, useCallback } from "react";
import { User, Email, Client, AuditLog } from "./types";
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

  // Layout navigation state
  const [activeTab, setActiveTab] = useState<string>("otps");

  // Data layers
  const [emails, setEmailQueue] = useState<Email[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // Status spinner states
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  // Active email modal target
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  // Bootstrap user profile configuration
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
        // Force default tab for WORKER safety
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
    if (loggedUser.role === "ADMIN") {
      setActiveTab("otps");
    } else {
      setActiveTab("otps");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setEmailQueue([]);
    setClients([]);
    setLogs([]);
  };

  // 1. Load Emails
  const fetchEmails = useCallback(async () => {
    if (!token || !user) return;
    setLoadingEmails(true);
    setPanelError(null);
    try {
      // Direct correct endpoint depending on privileges
      const url = activeTab === "inbox" ? "/api/emails" : "/api/emails/otps";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load email indexes.");
      const data: Email[] = await res.json();
      setEmailQueue(data);

      // Re-hydrate the currently selected email modal details to show live updates if open
      if (selectedEmail) {
        const matchingEmail = data.find((e) => e.id === selectedEmail.id);
        if (matchingEmail) {
          setSelectedEmail(matchingEmail);
        }
      }
    } catch (err: any) {
      setPanelError(err?.message || "Communication failure fetching mail.");
    } finally {
      setLoadingEmails(false);
    }
  }, [token, user, activeTab, selectedEmail]);

  // 2. Load Clients
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

  // 3. Load Audit Logs
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

  // Dispatch data loading contextually depending on active view tab
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

  // Auto polling refresh (every 10 seconds on active screen tab)
  useEffect(() => {
    if (!token || !user) return;

    const interval = setInterval(() => {
      if (activeTab === "otps" || activeTab === "inbox") {
        fetchEmails();
      } else if (activeTab === "mailboxes") {
        fetchClients();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [activeTab, token, user, fetchEmails, fetchClients]);

  // Manual pull synced daemon processor
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

      // Re-hydrate queues
      await Promise.all([fetchEmails(), fetchClients()]);
    } catch (err: any) {
      setPanelError(err?.message || "Sync request server failed.");
    } finally {
      setSyncing(false);
    }
  };

  // Administrative classification action dispatch
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
      
      // Instantly trigger re-pull
      await fetchEmails();
    } catch (err) {
      console.error(err);
    }
  };

  // Render initialization loading screen
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

  // Render Login screen if no valid session
  if (!token || !user) {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex bg-slate-100 min-h-screen text-slate-800 font-sans antialiased">
      {/* Navigation sidebar */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        syncing={syncing}
        onManualSync={handleManualSync}
      />

      {/* Main dashboard content */}
      <main className="flex-1 p-8 overflow-y-auto h-screen relative scrollbar">
        {panelError && (
          <div className="mb-6 flex items-start space-x-2.5 p-4 rounded-xl bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <span>{panelError}</span>
          </div>
        )}

        {/* Tab Router Switch Panel */}
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

      {/* Modal overlays */}
      {selectedEmail && (
        <EmailModal
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
          onClassify={user.role === "ADMIN" ? (action) => handleClassify(selectedEmail.id, action) : undefined}
          userRole={user.role}
        />
      )}
    </div>
  );
}
