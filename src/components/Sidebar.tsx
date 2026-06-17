import { Mail, Shield, LogOut, Terminal, Layers, RefreshCw, Key, Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext"; // ✅ 1. Added Theme Hook
import { User } from "../types";

interface SidebarProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  syncing: boolean;
  onManualSync: () => Promise<void>;
}

export default function Sidebar({ user, activeTab, setActiveTab, onLogout, syncing, onManualSync }: SidebarProps) {
  const { theme, toggleTheme } = useTheme(); // ✅ 2. Initialize Hook
  const isAdmin = user.role === "ADMIN";

  const menuItems = [
    {
      id: "otps",
      label: "OTP Feed",
      icon: Key,
      description: "Real-time verification codes",
      roles: ["ADMIN", "WORKER"],
    },
    {
      id: "inbox",
      label: "Full Inbox",
      icon: Mail,
      description: "All incoming emails list",
      roles: ["ADMIN"],
    },
    {
      id: "mailboxes",
      label: "Mailbox Managers",
      icon: Layers,
      description: "Link and sync sources",
      roles: ["ADMIN"],
    },
    {
      id: "audit",
      label: "Security Audit Logs",
      icon: Terminal,
      description: "Trace system sessions",
      roles: ["ADMIN"],
    },
  ];

  return (
    <aside id="sidebar-container" className="w-72 bg-white dark:bg-slate-900 flex flex-col justify-between border-r border-slate-200/60 dark:border-slate-800/80 transition-colors duration-300">
      <div className="flex-1 flex flex-col min-h-0">
        {/* Branding header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800/65">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-indigo-700 to-indigo-500 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Mail className="h-4.5 w-4.5 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-extrabold tracking-tight text-base text-slate-900 dark:text-white leading-tight">WeApplying4U</h1>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-extrabold font-mono">Mail Manager</p>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 mx-4 mt-5 bg-gradient-to-b from-slate-50 to-slate-100/50 dark:from-slate-800/40 dark:to-slate-900/10 rounded-xl border border-slate-200/50 dark:border-slate-800/60 flex flex-col gap-3 transition-colors shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 text-white font-black h-9 w-9 rounded-xl flex items-center justify-center text-xs uppercase shadow-sm">
              {user.name.substring(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-550 font-mono truncate mt-0.5" title={user.email}>{user.email}</p>
            </div>
          </div>
          
          <div className="pt-2 border-t border-slate-200/65 dark:border-slate-800/50 flex items-center justify-between">
            <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest rounded-md border ${
              isAdmin 
                ? "bg-rose-50 text-rose-800 border-rose-200/50 dark:bg-rose-955/20 dark:text-rose-400 dark:border-rose-900/40" 
                : "bg-blue-50 text-blue-850 border-blue-200/50 dark:bg-blue-955/20 dark:text-blue-400 dark:border-blue-900/40"
            }`}>
              <Shield className="h-2.5 w-2.5 mr-1" />
              {isAdmin ? "Admin Root" : "Worker Scope"}
            </span>
          </div>
        </div>

        {/* THEME TOGGLE */}
        <div className="px-4 py-3 mt-4 border-t border-b border-slate-100 dark:border-slate-800/50">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-650 dark:text-slate-350 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border border-slate-100 dark:border-slate-805 transition-all text-xs font-bold group cursor-pointer active:scale-98"
          >
            <div className="flex items-center gap-2">
              {theme === "light" ? (
                <Moon className="h-4 w-4 text-slate-450 group-hover:text-indigo-600 transition-colors" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500 group-hover:text-amber-400 transition-colors" />
              )}
              <span>{theme === "light" ? "Dark Theme" : "Light Theme"}</span>
            </div>
            <span className="text-[10px] bg-slate-200/70 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono text-center">Toggle</span>
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-4 py-5 space-y-1">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5 px-2 font-mono">Navigation</div>
          {menuItems
            .filter((item) => item.roles.includes(user.role))
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  id={`nav-item-${item.id}`}
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer group text-xs active:scale-98 font-bold ${
                    isActive 
                      ? "bg-indigo-600 text-white font-extrabold shadow-sm shadow-indigo-600/10" 
                      : "text-slate-650 hover:bg-slate-100/60 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-white" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-650 dark:group-hover:text-slate-305"}`} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.id === "inbox" && (
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide border ${isActive ? "bg-indigo-700 text-indigo-100 border-indigo-500" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 border-slate-200"}`}>Admin</span>
                  )}
                </button>
              );
            })}
        </nav>
      </div>

      {/* Polling Engine widget at bottom */}
      <div className="p-4 mx-4 mb-4 bg-gradient-to-b from-slate-55/40 to-slate-100/30 dark:from-slate-800/20 dark:to-slate-900/10 rounded-xl border border-slate-200/50 dark:border-slate-800/60 space-y-2.5 transition-all shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-550 tracking-wider font-mono">Real-time daemon</span>
          {isAdmin && (
            <button
              id="manual-sync-btn"
              disabled={syncing}
              onClick={onManualSync}
              className="px-2 py-0.5 text-[9px] font-black text-indigo-600 hover:bg-indigo-100 active:scale-95 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:hover:bg-indigo-900/50 font-sans border border-indigo-100 rounded-md transition-all cursor-pointer flex items-center space-x-1"
              title="Instant Sync All Mailboxes"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${syncing ? "animate-spin text-amber-500" : ""}`} />
              <span>{syncing ? "Syncing" : "Sync"}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-555 animate-pulse shrink-0"></span>
          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-350">60s Auto Sync Active</span>
        </div>
        <div className="w-full bg-slate-200/70 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
          <div className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-1000 rounded-full" style={{ width: syncing ? "100%" : "65%" }}></div>
        </div>
        <div className="flex justify-between text-[9px] text-slate-400/80 dark:text-slate-500 font-mono">
          <span>Rentention: 1h</span>
          <span>SSL Encryption</span>
        </div>
      </div>

      {/* Logout drawer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/65 bg-white dark:bg-slate-900">
        <button
          id="logout-btn"
          onClick={onLogout}
          className="w-full h-10 flex items-center justify-between px-3.5 rounded-xl text-slate-550 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-455 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-transparent hover:border-rose-100/40 dark:hover:border-rose-900/30 transition-all text-xs font-bold cursor-pointer group active:scale-98"
        >
          <div className="flex items-center gap-2">
            <LogOut className="h-4 w-4 group-hover:text-rose-550 shrink-0 transition-colors" />
            <span>Terminate Session</span>
          </div>
          <span className="text-[9px] font-bold font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 dark:text-slate-550 px-1.5 py-0.5 rounded group-hover:bg-rose-100/60 dark:group-hover:bg-rose-900/30 transition-colors">Exit</span>
        </button>
      </div>
    </aside>
  );
}