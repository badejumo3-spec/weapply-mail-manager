import { useState } from "react";
import { Terminal, Shield, AlertCube, Calendar, Search } from "lucide-react";
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
    <div className="space-y-6">
      {/* Search and control banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Terminal className="h-4.5 w-4.5 text-indigo-600" />
            <span>Workspace Security Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time tracking of credentials logs, daemon syncs, and overrides</p>
        </div>

        <div className="relative w-full md:max-w-xs">
          <input
            id="audit-search"
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search action logs, admin actions..."
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 hover:border-slate-350 focus:bg-white text-xs font-semibold rounded-lg text-slate-700 focus:outline-hidden transition-all focus:ring-1 focus:ring-indigo-650"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="animate-spin inline-block h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full mb-2" />
          <p className="text-xs text-slate-400 font-medium font-mono">Loading trace streams...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 p-6 animate-fadeIn">
          <Terminal className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Trail Events Collected</h3>
          <p className="text-xs text-slate-450 max-w-sm mx-auto">No logs have matched your filters, or the database is currently unseeded with log records.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-4 font-mono">Timestamp</th>
                  <th className="px-5 py-4">Actor</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4">Trace Action</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px] font-medium text-slate-700">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900 break-all max-w-[130px] truncate">{log.actor}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                        log.role === "ADMIN" ? "bg-rose-50 text-rose-700 border-rose-100" :
                        log.role === "DAEMON" ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                        "bg-slate-50 text-slate-600 border-slate-200"
                      }`}>
                        {log.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 leading-normal break-all max-w-[320px]">{log.action}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                        log.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-400">{log.ip_address || "None"}</td>
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
