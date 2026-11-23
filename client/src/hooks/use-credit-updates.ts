import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

export function useCreditUpdates() {
  const { token, refreshUser } = useAuth();
  const client = useQueryClient();
  const ref = useRef<WebSocket | null>(null);
  useEffect(() => {
    if (!token) return;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${location.host}/ws/credits`, [token]);
    ref.current = ws;
    ws.onmessage = event => {
      try {
        if (JSON.parse(event.data).type === "credit_updated") {
          ["/api/credit/activity", "/api/admin/credit-transactions", "/api/admin/registered-users", "/api/orders", "/api/auth/orders"].forEach(key => client.invalidateQueries({ queryKey: [key] }));
          void refreshUser();
        }
      } catch { /* Ignore malformed messages. */ }
    };
    return () => ws.close();
  }, [token, client, refreshUser]);
}