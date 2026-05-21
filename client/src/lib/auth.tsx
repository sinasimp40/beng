import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import type { SafeUser } from "@shared/schema";

interface AuthContextType {
  user: SafeUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string, recaptchaToken: string) => Promise<void>;
  register: (email: string, password: string, recaptchaToken: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  sessionInvalidated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "buybit_auth_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);
  const [sessionInvalidated, setSessionInvalidated] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchSession = useCallback(async (authToken: string) => {
    try {
      const response = await fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (currentToken) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      } catch {
        // Ignore errors
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setSessionInvalidated(false);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // WebSocket connection for session invalidation
  useEffect(() => {
    if (!token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/session`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "session_invalidated") {
          setSessionInvalidated(true);
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
          // Force page refresh to ensure complete logout on old session
          window.location.reload();
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onerror = () => {
      // Silently handle errors
    };

    return () => {
      ws.close();
    };
  }, [token]);

  useEffect(() => {
    const init = async () => {
      if (token) {
        const valid = await fetchSession(token);
        if (!valid) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      }
      setIsLoading(false);
    };
    init();
  }, [token, fetchSession]);

  const login = async (email: string, password: string, recaptchaToken: string) => {
    setSessionInvalidated(false);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, recaptchaToken }),
    });

    if (!response.ok) {
      const ct = response.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await response.json();
        throw new Error(data.error || "Login failed");
      }
      throw new Error("Login failed - server error");
    }

    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (email: string, password: string, recaptchaToken: string) => {
    setSessionInvalidated(false);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, recaptchaToken }),
    });

    if (!response.ok) {
      const ct = response.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await response.json();
        throw new Error(data.error || "Registration failed");
      }
      throw new Error("Registration failed - server error");
    }

    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        isAdmin: user?.role === "admin",
        sessionInvalidated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
