import { db } from "./db";
import { settings } from "@shared/schema";
import { eq } from "drizzle-orm";

interface ThemeSettings {
  primaryHue: number;
  primarySaturation: number;
  primaryLightness: number;
}

const DEFAULT_THEME: ThemeSettings = {
  primaryHue: 185,
  primarySaturation: 80,
  primaryLightness: 50,
};

let cachedTheme: ThemeSettings | null = null;
let cacheTime = 0;
const CACHE_TTL = 5000;

async function getThemeSettings(): Promise<ThemeSettings> {
  const now = Date.now();
  if (cachedTheme && now - cacheTime < CACHE_TTL) {
    return cachedTheme;
  }

  try {
    const [hueRow, satRow, lightRow] = await Promise.all([
      db.select().from(settings).where(eq(settings.key, "theme_primary_hue")).limit(1),
      db.select().from(settings).where(eq(settings.key, "theme_primary_saturation")).limit(1),
      db.select().from(settings).where(eq(settings.key, "theme_primary_lightness")).limit(1),
    ]);

    cachedTheme = {
      primaryHue: hueRow[0]?.value ? parseInt(hueRow[0].value, 10) : DEFAULT_THEME.primaryHue,
      primarySaturation: satRow[0]?.value ? parseInt(satRow[0].value, 10) : DEFAULT_THEME.primarySaturation,
      primaryLightness: lightRow[0]?.value ? parseInt(lightRow[0].value, 10) : DEFAULT_THEME.primaryLightness,
    };
    cacheTime = now;
    return cachedTheme;
  } catch (e) {
    return DEFAULT_THEME;
  }
}

export function clearThemeCache() {
  cachedTheme = null;
  cacheTime = 0;
}

export async function injectThemeIntoHtml(html: string): Promise<string> {
  const theme = await getThemeSettings();
  const { primaryHue: h, primarySaturation: s, primaryLightness: l } = theme;

  const darkL = Math.max(40, Math.min(60, l));
  const lightL = Math.max(30, Math.min(50, l - 10));
  const accentSDark = Math.max(30, s - 30);
  const accentSLight = Math.max(30, s - 30);
  const sidebarAccentSDark = Math.max(20, s - 40);
  const sidebarAccentSLight = Math.max(20, s - 40);

  const chartDark2 = `${(h + 10) % 360} ${Math.max(50, s - 10)}% ${darkL + 5}%`;
  const chartDark3 = `${(h - 10 + 360) % 360} ${Math.max(40, s - 20)}% ${darkL - 5}%`;
  const chartDark4 = `${(h + 15) % 360} ${Math.max(45, s - 15)}% ${darkL}%`;
  const chartDark5 = `${(h - 15 + 360) % 360} ${Math.max(50, s - 10)}% ${darkL + 3}%`;
  const chartLight2 = `${(h + 10) % 360} ${Math.max(50, s - 10)}% ${lightL + 5}%`;
  const chartLight3 = `${(h - 10 + 360) % 360} ${Math.max(40, s - 20)}% ${lightL - 5}%`;
  const chartLight4 = `${(h + 15) % 360} ${Math.max(45, s - 15)}% ${lightL}%`;
  const chartLight5 = `${(h - 15 + 360) % 360} ${Math.max(50, s - 10)}% ${lightL + 3}%`;

  const themeStyle = `<style id="server-injected-theme">
html:root {
  --primary: ${h} ${s}% ${lightL}%;
  --ring: ${h} ${s}% ${lightL}%;
  --sidebar-primary: ${h} ${s}% ${lightL}%;
  --sidebar-ring: ${h} ${s}% ${lightL}%;
  --chart-1: ${h} ${s}% ${lightL}%;
  --chart-2: ${chartLight2};
  --chart-3: ${chartLight3};
  --chart-4: ${chartLight4};
  --chart-5: ${chartLight5};
  --accent: ${h} ${accentSLight}% 92%;
  --sidebar-accent: ${h} ${sidebarAccentSLight}% 90%;
}
html.dark {
  --primary: ${h} ${s}% ${darkL}%;
  --ring: ${h} ${s}% ${darkL}%;
  --sidebar-primary: ${h} ${s}% ${darkL}%;
  --sidebar-ring: ${h} ${s}% ${darkL}%;
  --chart-1: ${h} ${s}% ${darkL}%;
  --chart-2: ${chartDark2};
  --chart-3: ${chartDark3};
  --chart-4: ${chartDark4};
  --chart-5: ${chartDark5};
  --accent: ${h} ${accentSDark}% 18%;
  --sidebar-accent: ${h} ${sidebarAccentSDark}% 15%;
}
</style>`;

  const cacheScript = `<script>
try{localStorage.setItem('shopx_theme_cache',JSON.stringify({h:${h},s:${s},l:${l}}));}catch(e){}
</script>`;

  return html.replace('</head>', `${themeStyle}${cacheScript}</head>`);
}
