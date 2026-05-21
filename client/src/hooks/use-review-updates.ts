import { useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

export function useReviewUpdates() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/reviews`;

      try {
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log("Reviews WebSocket connected");
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "review_created" || data.type === "review_updated" || data.type === "review_deleted") {
              queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
            }
          } catch (error) {
            console.error("Error parsing reviews WebSocket message:", error);
          }
        };

        wsRef.current.onclose = () => {
          console.log("Reviews WebSocket disconnected, reconnecting in 3s...");
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        };

        wsRef.current.onerror = (error) => {
          console.error("Reviews WebSocket error:", error);
        };
      } catch (error) {
        console.error("Failed to create Reviews WebSocket:", error);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
}
