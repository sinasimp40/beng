import { useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ThemeColors {
  primaryHue: number;
  primarySaturation: number;
  primaryLightness: number;
}

const DEFAULT_THEME: ThemeColors = {
  primaryHue: 185,
  primarySaturation: 80,
  primaryLightness: 50,
};

const THEME_CACHE_KEY = "shopx_theme_cache";

// Get cached theme from localStorage immediately (no flash)
function getCachedTheme(): ThemeColors | null {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached) {
      const { h, s, l } = JSON.parse(cached);
      return { primaryHue: h, primarySaturation: s, primaryLightness: l };
    }
  } catch (e) {
    // localStorage unavailable
  }
  return null;
}

// Initialize from cache immediately to prevent flash
const INITIAL_THEME = getCachedTheme() ?? DEFAULT_THEME;

export function useThemeColors() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: settings } = useQuery<ThemeColors>({
    queryKey: ["/api/settings/theme"],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const applyThemeValues = useCallback((h: number, s: number, l: number, saveToCache = true) => {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    
    const lightModeL = Math.max(30, Math.min(50, l - 10));
    const darkModeL = Math.max(40, Math.min(60, l));
    const currentL = isDark ? darkModeL : lightModeL;

    root.style.setProperty("--primary", `${h} ${s}% ${currentL}%`);
    root.style.setProperty("--ring", `${h} ${s}% ${currentL}%`);
    root.style.setProperty("--sidebar-primary", `${h} ${s}% ${currentL}%`);
    root.style.setProperty("--sidebar-ring", `${h} ${s}% ${currentL}%`);
    
    root.style.setProperty("--chart-1", `${h} ${s}% ${currentL}%`);
    root.style.setProperty("--chart-2", `${(h + 10) % 360} ${Math.max(50, s - 10)}% ${currentL + 5}%`);
    root.style.setProperty("--chart-3", `${(h - 10 + 360) % 360} ${Math.max(40, s - 20)}% ${currentL - 5}%`);
    root.style.setProperty("--chart-4", `${(h + 15) % 360} ${Math.max(45, s - 15)}% ${currentL}%`);
    root.style.setProperty("--chart-5", `${(h - 15 + 360) % 360} ${Math.max(50, s - 10)}% ${currentL + 3}%`);
    
    const accentL = isDark ? 18 : 92;
    const accentS = Math.max(30, s - 30);
    root.style.setProperty("--accent", `${h} ${accentS}% ${accentL}%`);
    root.style.setProperty("--sidebar-accent", `${h} ${Math.max(20, s - 40)}% ${isDark ? 15 : 90}%`);

    if (saveToCache) {
      try {
        localStorage.setItem(THEME_CACHE_KEY, JSON.stringify({ h, s, l }));
      } catch (e) {
        // localStorage might be unavailable
      }
    }
  }, []);

  useEffect(() => {
    const applyTheme = () => {
      const h = settings?.primaryHue ?? INITIAL_THEME.primaryHue;
      const s = settings?.primarySaturation ?? INITIAL_THEME.primarySaturation;
      const l = settings?.primaryLightness ?? INITIAL_THEME.primaryLightness;
      applyThemeValues(h, s, l, !!settings);
    };

    applyTheme();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          applyTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const handleThemeUpdate = () => applyTheme();
    window.addEventListener("themeSettingsUpdated", handleThemeUpdate);

    return () => {
      observer.disconnect();
      window.removeEventListener("themeSettingsUpdated", handleThemeUpdate);
    };
  }, [settings, applyThemeValues]);

  // WebSocket connection for real-time theme updates
  useEffect(() => {
    const connectWebSocket = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/theme`;
      
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "theme_updated" && data.theme) {
              const { primaryHue, primarySaturation, primaryLightness } = data.theme;
              
              // Apply theme immediately
              applyThemeValues(primaryHue, primarySaturation, primaryLightness);
              
              // Update the query cache so React Query stays in sync
              queryClient.setQueryData(["/api/settings/theme"], {
                primaryHue,
                primarySaturation,
                primaryLightness,
              });
            }
          } catch (e) {
            console.error("Error parsing theme WebSocket message:", e);
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
          // Reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (e) {
        console.error("Failed to connect to theme WebSocket:", e);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [applyThemeValues, queryClient]);

  return settings ?? INITIAL_THEME;
}
