import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Palette, Save, Loader2, RotateCcw, Check } from "lucide-react";

interface ThemeColors {
  primaryHue: number;
  primarySaturation: number;
  primaryLightness: number;
}

const PRESET_THEMES = [
  // Reds
  { name: "Rose", hue: 350, saturation: 90, lightness: 55, color: "#f43f5e" },
  { name: "Red", hue: 0, saturation: 85, lightness: 55, color: "#ef4444" },
  { name: "Crimson", hue: 348, saturation: 83, lightness: 47, color: "#dc143c" },
  { name: "Ruby", hue: 337, saturation: 90, lightness: 40, color: "#c22050" },
  // Oranges
  { name: "Orange", hue: 25, saturation: 95, lightness: 55, color: "#f97316" },
  { name: "Amber", hue: 38, saturation: 92, lightness: 50, color: "#f59e0b" },
  { name: "Tangerine", hue: 30, saturation: 100, lightness: 50, color: "#ff8c00" },
  { name: "Coral", hue: 16, saturation: 100, lightness: 66, color: "#ff7f50" },
  // Yellows
  { name: "Yellow", hue: 45, saturation: 95, lightness: 50, color: "#eab308" },
  { name: "Gold", hue: 51, saturation: 100, lightness: 50, color: "#ffd700" },
  { name: "Lime", hue: 84, saturation: 80, lightness: 45, color: "#84cc16" },
  { name: "Chartreuse", hue: 75, saturation: 75, lightness: 50, color: "#b4d429" },
  // Greens
  { name: "Green", hue: 142, saturation: 70, lightness: 45, color: "#22c55e" },
  { name: "Emerald", hue: 155, saturation: 80, lightness: 40, color: "#10b981" },
  { name: "Forest", hue: 140, saturation: 60, lightness: 35, color: "#228b22" },
  { name: "Mint", hue: 150, saturation: 60, lightness: 55, color: "#3eb489" },
  { name: "Jade", hue: 158, saturation: 55, lightness: 42, color: "#00a86b" },
  // Teals & Cyans
  { name: "Teal", hue: 160, saturation: 70, lightness: 45, color: "#14b8a6" },
  { name: "Cyan", hue: 185, saturation: 80, lightness: 50, color: "#17a2b8" },
  { name: "Aqua", hue: 180, saturation: 100, lightness: 50, color: "#00ffff" },
  { name: "Turquoise", hue: 174, saturation: 72, lightness: 56, color: "#40e0d0" },
  // Blues
  { name: "Sky", hue: 199, saturation: 95, lightness: 53, color: "#0ea5e9" },
  { name: "Blue", hue: 217, saturation: 91, lightness: 60, color: "#3b82f6" },
  { name: "Azure", hue: 210, saturation: 100, lightness: 50, color: "#0080ff" },
  { name: "Cobalt", hue: 215, saturation: 100, lightness: 40, color: "#0047ab" },
  { name: "Navy", hue: 225, saturation: 75, lightness: 40, color: "#1e3a8a" },
  { name: "Royal", hue: 225, saturation: 85, lightness: 50, color: "#4169e1" },
  // Indigos
  { name: "Indigo", hue: 239, saturation: 84, lightness: 67, color: "#6366f1" },
  { name: "Electric", hue: 245, saturation: 100, lightness: 60, color: "#6b4cff" },
  // Violets & Purples
  { name: "Violet", hue: 258, saturation: 90, lightness: 66, color: "#8b5cf6" },
  { name: "Purple", hue: 270, saturation: 75, lightness: 55, color: "#a855f7" },
  { name: "Amethyst", hue: 280, saturation: 50, lightness: 50, color: "#9966cc" },
  { name: "Grape", hue: 288, saturation: 65, lightness: 45, color: "#9932cc" },
  { name: "Orchid", hue: 302, saturation: 59, lightness: 65, color: "#da70d6" },
  // Pinks & Magentas
  { name: "Fuchsia", hue: 292, saturation: 84, lightness: 61, color: "#d946ef" },
  { name: "Magenta", hue: 300, saturation: 100, lightness: 50, color: "#ff00ff" },
  { name: "Pink", hue: 330, saturation: 75, lightness: 55, color: "#ec4899" },
  { name: "Hot Pink", hue: 340, saturation: 100, lightness: 50, color: "#ff1493" },
  { name: "Salmon", hue: 6, saturation: 93, lightness: 71, color: "#fa8072" },
  // Neutrals with color
  { name: "Slate", hue: 215, saturation: 20, lightness: 50, color: "#64748b" },
  { name: "Stone", hue: 25, saturation: 10, lightness: 50, color: "#78716c" },
  { name: "Zinc", hue: 240, saturation: 5, lightness: 50, color: "#71717a" },
];

const DEFAULT_THEME: ThemeColors = {
  primaryHue: 185,
  primarySaturation: 80,
  primaryLightness: 50,
};

export function ThemeSettings() {
  const { toast } = useToast();
  const [hue, setHue] = useState(DEFAULT_THEME.primaryHue);
  const [saturation, setSaturation] = useState(DEFAULT_THEME.primarySaturation);
  const [lightness, setLightness] = useState(DEFAULT_THEME.primaryLightness);

  const { data: settings, isLoading } = useQuery<ThemeColors>({
    queryKey: ["/api/settings/theme"],
  });

  const savedHue = settings?.primaryHue ?? DEFAULT_THEME.primaryHue;
  const savedSaturation = settings?.primarySaturation ?? DEFAULT_THEME.primarySaturation;
  const savedLightness = settings?.primaryLightness ?? DEFAULT_THEME.primaryLightness;

  useEffect(() => {
    if (settings) {
      setHue(savedHue);
      setSaturation(savedSaturation);
      setLightness(savedLightness);
    }
  }, [settings, savedHue, savedSaturation, savedLightness]);

  useEffect(() => {
    applyThemePreview(hue, saturation, lightness);
    
    return () => {
      applyThemePreview(savedHue, savedSaturation, savedLightness);
    };
  }, [hue, saturation, lightness, savedHue, savedSaturation, savedLightness]);

  const saveMutation = useMutation({
    mutationFn: async (data: ThemeColors) => {
      return apiRequest("POST", "/api/settings/theme", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/theme"] });
      toast({
        title: "Theme saved",
        description: "Your theme colors have been updated successfully",
      });
      window.dispatchEvent(new CustomEvent("themeSettingsUpdated"));
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const applyThemePreview = (h: number, s: number, l: number) => {
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
  };

  const handleSave = () => {
    saveMutation.mutate({
      primaryHue: hue,
      primarySaturation: saturation,
      primaryLightness: lightness,
    });
  };

  const handleReset = () => {
    setHue(DEFAULT_THEME.primaryHue);
    setSaturation(DEFAULT_THEME.primarySaturation);
    setLightness(DEFAULT_THEME.primaryLightness);
  };

  const handlePresetSelect = (preset: typeof PRESET_THEMES[0]) => {
    setHue(preset.hue);
    setSaturation(preset.saturation);
    setLightness(preset.lightness);
  };

  const getCurrentColor = () => {
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const isPresetSelected = (preset: typeof PRESET_THEMES[0]) => {
    return preset.hue === hue && preset.saturation === saturation && preset.lightness === lightness;
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-card-border">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Theme Colors
          </CardTitle>
          <CardDescription>
            Customize the primary color used throughout your site. Changes apply to buttons, links, accents, and more.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <Label className="text-base font-medium">Preset Themes</Label>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {PRESET_THEMES.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePresetSelect(preset)}
                  className={`relative w-full aspect-square rounded-lg border-2 transition-all hover:scale-110 ${
                    isPresetSelected(preset)
                      ? "border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "border-transparent hover:border-muted-foreground/50"
                  }`}
                  style={{ backgroundColor: preset.color }}
                  title={preset.name}
                  data-testid={`preset-${preset.name.toLowerCase()}`}
                >
                  {isPresetSelected(preset) && (
                    <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow-md" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <Label className="text-base font-medium">Custom Color</Label>
            
            <div className="flex items-center gap-6">
              <div
                className="w-24 h-24 rounded-xl border-2 border-border shadow-lg shrink-0"
                style={{ backgroundColor: getCurrentColor() }}
              />
              
              <div className="flex-1 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Hue</Label>
                    <span className="text-sm font-mono text-muted-foreground">{hue}</span>
                  </div>
                  <div
                    className="h-3 rounded-full"
                    style={{
                      background: `linear-gradient(to right, 
                        hsl(0, ${saturation}%, ${lightness}%),
                        hsl(60, ${saturation}%, ${lightness}%),
                        hsl(120, ${saturation}%, ${lightness}%),
                        hsl(180, ${saturation}%, ${lightness}%),
                        hsl(240, ${saturation}%, ${lightness}%),
                        hsl(300, ${saturation}%, ${lightness}%),
                        hsl(360, ${saturation}%, ${lightness}%)
                      )`,
                    }}
                  />
                  <Slider
                    value={[hue]}
                    onValueChange={(value) => setHue(value[0])}
                    max={360}
                    step={1}
                    className="cursor-pointer"
                    data-testid="slider-hue"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Saturation</Label>
                    <span className="text-sm font-mono text-muted-foreground">{saturation}%</span>
                  </div>
                  <div
                    className="h-3 rounded-full"
                    style={{
                      background: `linear-gradient(to right, 
                        hsl(${hue}, 0%, ${lightness}%),
                        hsl(${hue}, 50%, ${lightness}%),
                        hsl(${hue}, 100%, ${lightness}%)
                      )`,
                    }}
                  />
                  <Slider
                    value={[saturation]}
                    onValueChange={(value) => setSaturation(value[0])}
                    max={100}
                    step={1}
                    className="cursor-pointer"
                    data-testid="slider-saturation"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Lightness</Label>
                    <span className="text-sm font-mono text-muted-foreground">{lightness}%</span>
                  </div>
                  <div
                    className="h-3 rounded-full"
                    style={{
                      background: `linear-gradient(to right, 
                        hsl(${hue}, ${saturation}%, 20%),
                        hsl(${hue}, ${saturation}%, 50%),
                        hsl(${hue}, ${saturation}%, 80%)
                      )`,
                    }}
                  />
                  <Slider
                    value={[lightness]}
                    onValueChange={(value) => setLightness(value[0])}
                    min={20}
                    max={80}
                    step={1}
                    className="cursor-pointer"
                    data-testid="slider-lightness"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <Label className="text-base font-medium">Preview</Label>
            <div className="flex flex-wrap gap-3">
              <Button data-testid="preview-primary">Primary Button</Button>
              <Button variant="secondary" data-testid="preview-secondary">Secondary</Button>
              <Button variant="outline" data-testid="preview-outline">Outline</Button>
              <Button variant="ghost" data-testid="preview-ghost">Ghost</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-primary text-primary-foreground">
                Primary Badge
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-accent text-accent-foreground">
                Accent Badge
              </span>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={handleReset}
              data-testid="button-reset-theme"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Default
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-theme"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Theme
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
