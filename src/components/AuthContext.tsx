import React, { createContext, useContext, useState, useEffect } from "react";
import { UserRole } from "../types";

export interface DecodedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  token: string | null;
  user: DecodedUser | null;
  loading: boolean;
  currentPath: string;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  navigate: (path: string) => void;
  verifyToken: () => Promise<boolean>;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("authToken"));
  const [user, setUser] = useState<DecodedUser | null>(() => {
    const cachedUser = localStorage.getItem("authUser");
    if (cachedUser) {
      try {
        return JSON.parse(cachedUser);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Monitor browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Sync route and tokens
  const navigate = (path: string) => {
    window.history.pushState(null, "", path);
    setCurrentPath(path);
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    setToken(null);
    setUser(null);
    navigate("/login");
  };

  const verifyToken = async (tokenToCheck = token): Promise<boolean> => {
    if (!tokenToCheck) {
      return false;
    }
    try {
      const response = await fetch("/api/auth/verify", {
        headers: {
          "Authorization": `Bearer ${tokenToCheck}`,
          "Content-Type": "application/json"
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid && data.user) {
          setUser(data.user);
          localStorage.setItem("authUser", JSON.stringify(data.user));
          return true;
        }
      }
      // If unauthorized (401/403) or token invalid, trigger logout
      logout();
      return false;
    } catch {
      // Offline fallback: keep cached session if valid network check failed (don't force logout on simple network glitch unless 401/403 received)
      return tokenToCheck !== null;
    }
  };

  // Initial token validation sweep
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem("authToken");
      if (storedToken) {
        const isValid = await verifyToken(storedToken);
        if (isValid) {
          // Default redirect from root to dashboard
          if (window.location.pathname === "/" || window.location.pathname === "/login") {
            navigate("/dashboard");
          }
        } else {
          navigate("/login");
        }
      } else {
        localStorage.removeItem("authUser");
        setUser(null);
        navigate("/login");
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const currentToken = token || localStorage.getItem("authToken");
    const headers = new Headers(init?.headers);
    if (currentToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${currentToken}`);
    }

    const response = await fetch(input, {
      ...init,
      headers
    });

    if (response.status === 401) {
      logout();
    }
    return response;
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("authUser", JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        
        // Push user safely into dashboard pane
        navigate("/dashboard");
        return { success: true };
      } else {
        return { success: false, error: data.error || "Authentication failed." };
      }
    } catch (err) {
      return { success: false, error: "Network communication failure. Please check your connection." };
    }
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, currentPath, login, logout, navigate, verifyToken, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
