import { Mail, Shield, LogOut, Terminal, Layers, RefreshCw, Key } from "lucide-react";
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
    <aside id="sidebar-container" className="w-72 bg-white flex flex-col justify-between border-r border-slate-200">
      <div className="flex-1 flex flex-col min-h-0">
        {/* Branding header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Mail className="h-4.5 w-4.5 stroke-[2]" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-lg text-slate-900 leading-tight">WeApply4U</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Mail Manager</p>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 mx-4 mt-6 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-100 text-indigo-700 font-bold h-9 w-9 rounded-lg flex items-center justify-center text-xs uppercase shadow-xs shrink-0">
              {user.name.substring(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5" title={user.email}>{user.email}</p>
            </div>
          </div>
          
          <div className="pt-2.5 border-t border-slate-200/65 flex items-center justify-between">
            <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md ${
              isAdmin ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-blue-50 text-blue-700 border border-blue-100"
            }`}>
              <Shield className="h-2.5 w-2.5 mr-1" />
              {isAdmin ? "Admin Root" : "Worker Scope"}
            </span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Navigation</div>
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
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-colors cursor-pointer group text-sm ${
                    isActive 
                      ? "bg-indigo-50 text-indigo-700 font-semibold" 
                      : "text-slate-600 hover:bg-slate-50 font-medium"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.id === "inbox" && (
                    <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-wide scale-90 border border-slate-200">Admin</span>
                  )}
                </button>
              );
            })}
        </nav>
      </div>

      {/* Polling Engine widget at bottom */}
      <div className="p-4 mx-4 mb-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Polling Engine</span>
          {isAdmin && (
            <button
              id="manual-sync-btn"
              disabled={syncing}
              onClick={onManualSync}
              className="px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 hover:bg-indigo-100/50 bg-indigo-50 font-sans border border-indigo-100 rounded-md transition-colors cursor-pointer flex items-center space-x-1"
              title="Instant Sync All Mailboxes"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${syncing ? "animate-spin text-amber-500" : ""}`} />
              <span>{syncing ? "Syncing" : "Sync"}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-bold text-slate-700">60s Auto Sync Active</span>
        </div>
        <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
          <div className="bg-indigo-600 h-full transition-all duration-1000" style={{ width: syncing ? "100%" : "65%" }}></div>
        </div>
        <div className="flex justify-between text-[9px] text-slate-400 font-mono">
          <span>Retention: 1 Hour</span>
          <span>SSL Secure</span>
        </div>
      </div>

      {/* Logout drawer */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <button
          id="logout-btn"
          onClick={onLogout}
          className="w-full h-9 flex items-center justify-between px-3.5 rounded-lg text-slate-550 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100/45 transition-colors text-xs font-semibold cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <LogOut className="h-4 w-4 group-hover:text-rose-500 shrink-0" />
            <span>Terminate Session</span>
          </div>
          <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-1 py-0.5 rounded-md group-hover:bg-rose-100/60 transition-colors">Exit</span>
        </button>
      </div>
    </aside>
  );
}
