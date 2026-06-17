import { useState } from "react";
import { Terminal, Shield, Calendar, Search } from "lucide-react";
import { AuditLog } from "../types";

interface AuditLoggerProps {
  logs: AuditLog[];
  loading: boolean;
}

export default function AuditLogger({ logs, loading }: AuditLoggerProps) {
  const [filter, setFilter] = useState("");

  const filteredLogs = logs.filter((log) => {
    const q = filter.toLowerCase();
    return (
      log.actor.toLowerCase().includes(q) ||
      log.role.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.status.toLowerCase().includes(q) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 bg-slate-105 dark:bg-slate-950 min-h-screen p-8 animate-fadeIn">
      {/* Search and control banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-905 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
            <Terminal className="h-4.5 w-4.5 text-indigo-650 dark:text-indigo-400" />
            <span>Workspace Security Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Real-time tracking of credentials logs, daemon syncs, and overrides</p>
        </div>

        <div className="relative w-full md:max-w-xs animate-fadeIn">
          <input
            id="audit-search"
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search action logs, admin actions..."
            className="w-full px-3.5 py-2 hover:border-slate-350 dark:hover:border-slate-650 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 focus:bg-white dark:focus:bg-slate-800 text-xs font-semibold rounded-xl text-slate-750 dark:text-slate-200 focus:outline-hidden transition-all focus:ring-1 focus:ring-indigo-550"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="animate-spin inline-block h-6 w-6 border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full mb-2" />
          <p className="text-xs text-slate-400 dark:text-slate-505 font-medium font-mono">Loading trace streams...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-6 animate-fadeIn shadow-xs">
          <Terminal className="h-10 w-10 text-slate-300 dark:text-slate-650 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Trail Events Collected</h3>
          <p className="text-xs text-slate-450 dark:text-slate-450 max-w-sm mx-auto leading-relaxed">No logs have matched your filters, or the database is currently unseeded with log records.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-700/50 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-4 font-mono">Timestamp</th>
                  <th className="px-5 py-4">Actor</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4">Trace Action</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right font-mono">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 font-mono text-[11px] font-medium text-slate-700 dark:text-slate-300">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-400 dark:text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-slate-100 break-all max-w-[130px] truncate">{log.actor}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${
                        log.role === "ADMIN" ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50" :
                        log.role === "DAEMON" ? "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50" :
                        "bg-slate-50 text-slate-605 border-slate-205 dark:bg-slate-805 dark:text-slate-400 dark:border-slate-705"
                      }`}>
                        {log.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 leading-normal break-all max-w-[320px]">{log.action}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${
                        log.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50" : "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-400 dark:text-slate-500">{log.ip_address || "None"}</td>
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
