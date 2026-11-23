import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface UseOrderUpdatesOptions {
  email?: string | null;
  isAdmin?: boolean;
}

export function useOrderUpdates(emailOrOptions?: string | null | UseOrderUpdatesOptions) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;

  // Handle both old signature (email string) and new signature (options object)
  const options: UseOrderUpdatesOptions = typeof emailOrOptions === 'object' && emailOrOptions !== null
    ? emailOrOptions
    : { email: emailOrOptions };
  
  const { email, isAdmin = false } = options;

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === "order_created" || data.type === "order_updated") {
        const order = data.order;
        
        // Guard against missing payload
        if (!order) {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/orders"] });
          if (isAdmin) {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          }
          return;
        }
        
        // If email is provided and not admin, only process orders for this user
        if (email && !isAdmin && order.email !== email) {
          return;
        }
        
        // Invalidate the orders query to refetch
        queryClient.invalidateQueries({ queryKey: ["/api/auth/orders"] });
        
        // Also invalidate admin queries if in admin mode
        if (isAdmin) {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
          queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          // Also invalidate per-user order queries (for admin users tab view orders modal)
          if (order.email) {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users", order.email, "orders"] });
          }
        }
      }
    } catch (e) {
      console.error("WebSocket message parse error:", e);
    }
  }, [email, isAdmin, queryClient]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const authToken = localStorage.getItem("buybit_auth_token");
    if (!authToken) {
      return;
    }
    const wsUrl = `${protocol}//${window.location.host}/ws/orders`;

    try {
      // Send token via Sec-WebSocket-Protocol so it never lands in URL or proxy logs.
      const ws = new WebSocket(wsUrl, [authToken]);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts.current = 0;
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        // Will trigger onclose
      };

      ws.onclose = () => {
        wsRef.current = null;

        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };
    } catch (e) {
      console.error("WebSocket connection error:", e);
    }
  }, [handleMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return null;
}
