import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Product } from "@shared/schema";

type ProductEventType = "product_created" | "product_updated" | "product_deleted" | "settings_updated";

interface ProductUpdateMessage {
  type: ProductEventType;
  product: Product;
}

interface SettingsUpdateMessage {
  type: "settings_updated";
  product: { type: string };
}

export function useProductUpdates() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === "settings_updated") {
        // Invalidate all settings queries based on the update type
        if (data.product?.type === "shop") {
          queryClient.invalidateQueries({ queryKey: ["/api/settings/shop"] });
        } else if (data.product?.type === "social") {
          queryClient.invalidateQueries({ queryKey: ["/api/settings/social"] });
        } else {
          // Default: invalidate payment and currency settings
          queryClient.invalidateQueries({ queryKey: ["/api/settings/payment"] });
          queryClient.invalidateQueries({ queryKey: ["/api/payments/currencies"] });
        }
        return;
      }
      
      const productData = data as ProductUpdateMessage;
      
      if (productData.type === "product_created") {
        queryClient.setQueryData<Product[]>(["/api/products"], (old) => {
          if (!old) return [productData.product];
          const exists = old.some(p => p.id === productData.product.id);
          if (exists) return old;
          return [...old, productData.product];
        });
      } else if (productData.type === "product_updated") {
        queryClient.setQueryData<Product[]>(["/api/products"], (old) => {
          if (!old) return old;
          return old.map(p => p.id === productData.product.id ? productData.product : p);
        });
        queryClient.setQueryData<Product>(["/api/products", productData.product.id], productData.product);
      } else if (productData.type === "product_deleted") {
        queryClient.setQueryData<Product[]>(["/api/products"], (old) => {
          if (!old) return old;
          return old.filter(p => p.id !== productData.product.id);
        });
        queryClient.removeQueries({ queryKey: ["/api/products", productData.product.id] });
      }
    } catch (e) {
      console.error("Error parsing product update:", e);
    }
  }, [queryClient]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/products`;
    
    try {
      const ws = new WebSocket(wsUrl);
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
        wsRef.current = null;
      }
    };
  }, [connect]);

  return null;
}
