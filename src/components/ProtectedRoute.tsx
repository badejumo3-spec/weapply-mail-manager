import React from "react";
import { useAuth } from "./AuthContext";
import { UserRole } from "../types";
import { Lock, ShieldAlert } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, navigate } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-mono tracking-widest text-indigo-400 font-bold uppercase">
            Verifying Core Identity Claims...
          </span>
        </div>
      </div>
    );
  }

  // Redirect to login if user not authenticated
  if (!user) {
    React.useEffect(() => {
      navigate("/login");
    }, [navigate]);
    return null;
  }

  // Handle role restrictions (e.g., workers visiting admin-only pages)
  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-xl p-8 text-center shadow-xs">
          <div className="inline-flex p-3 bg-rose-50 rounded-full text-rose-600 mb-4 border border-rose-100">
            <ShieldAlert className="h-6 w-6 animate-pulse" />
          </div>
          <h2 className="text-base font-bold text-gray-900 tracking-tight">Access Restrictions Enforced</h2>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            Your active session token belongs to a <strong className="font-semibold text-rose-700">Tier 2 Worker</strong>. 
            Standard corporate policy restricts your privilege group from accessing this administrative operational panel.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Return to Authorized Workspace
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
