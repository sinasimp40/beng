import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

interface ShopSettings {
  shopName: string;
  shopLogo: string;
}

const SETTINGS_CACHE_KEY = "shopx_settings_cache";

function getCachedSettings(): ShopSettings | null {
  try {
    const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { shopName: parsed.name || "", shopLogo: parsed.logo || "" };
    }
  } catch (e) {}
  return null;
}

function cacheSettings(name: string, logo: string) {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ name, logo }));
  } catch (e) {
  }
}

const CACHED_SETTINGS = getCachedSettings();

export function useShopSettings() {
  const query = useQuery<ShopSettings>({
    queryKey: ["/api/settings/shop"],
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/shop"] });
    };
    window.addEventListener("shopSettingsUpdated", handleUpdate);
    return () => window.removeEventListener("shopSettingsUpdated", handleUpdate);
  }, []);

  const shopName = query.data?.shopName || CACHED_SETTINGS?.shopName || "";
  const shopLogo = query.data?.shopLogo || CACHED_SETTINGS?.shopLogo || "";

  useEffect(() => {
    if (!query.isLoading && query.data !== undefined) {
      cacheSettings(shopName, shopLogo);
    }
  }, [query.isLoading, query.data, shopName, shopLogo]);

  useEffect(() => {
    if (shopName) {
      document.title = shopName;
      
      const titleEl = document.getElementById("page-title");
      if (titleEl) {
        titleEl.textContent = shopName;
      }

      const metaDesc = document.getElementById("meta-description");
      if (metaDesc) {
        metaDesc.setAttribute("content", `${shopName} - Your trusted shop for gift cards, rewards points, and premium digital products. Secure crypto payments accepted.`);
      }

      const ogTitle = document.getElementById("og-title");
      if (ogTitle) {
        ogTitle.setAttribute("content", shopName);
      }
    }
  }, [shopName]);

  useEffect(() => {
    let favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (shopLogo) {
      if (favicon) {
        favicon.href = shopLogo;
      } else {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        favicon.href = shopLogo;
        document.head.appendChild(favicon);
      }
    } else {
      if (favicon) {
        favicon.href = "";
      }
    }
  }, [shopLogo]);

  return {
    shopName,
    shopLogo,
    isLoading: query.isLoading,
  };
}
