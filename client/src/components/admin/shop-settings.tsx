import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Store, Upload, Save, Loader2, Image, Link, Megaphone } from "lucide-react";

interface ShopSettings {
  shopName: string;
  shopLogo: string;
  bannerUrl: string;
  announcementEnabled: boolean;
  announcementText: string;
}

export function ShopSettings() {
  const { toast } = useToast();
  const [shopName, setShopName] = useState("");
  const [shopLogo, setShopLogo] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState(false);
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");

  const { data: settings, isLoading } = useQuery<ShopSettings>({
    queryKey: ["/api/settings/shop"],
  });

  useEffect(() => {
    if (settings) {
      setShopName(settings.shopName || "");
      setShopLogo(settings.shopLogo || "");
      setBannerUrl(settings.bannerUrl || "");
      setAnnouncementEnabled(settings.announcementEnabled || false);
      setAnnouncementText(settings.announcementText || "");
      if (settings.shopLogo) {
        setLogoPreview(settings.shopLogo);
      }
      if (settings.bannerUrl) {
        setBannerPreview(settings.bannerUrl);
      }
    }
  }, [settings]);

  const announcementMessages = useMemo(() => {
    if (!announcementText.trim()) return [];
    return announcementText.split("/n").map(m => m.trim()).filter(Boolean);
  }, [announcementText]);

  const saveMutation = useMutation({
    mutationFn: async (data: ShopSettings) => {
      return apiRequest("POST", "/api/settings/shop", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/shop"] });
      toast({
        title: "Settings saved",
        description: "Shop settings have been updated successfully",
      });
      window.dispatchEvent(new CustomEvent("shopSettingsUpdated"));
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 2MB",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setShopLogo(base64);
        setLogoPreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };


  const handleSave = () => {
    saveMutation.mutate({ shopName, shopLogo, bannerUrl, announcementEnabled, announcementText });
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
    <Card className="bg-card border-card-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          Shop Branding
        </CardTitle>
        <CardDescription>
          Customize your shop name, logo, and banner. Changes will update in real-time across the site.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="shopName">Shop Name</Label>
          <Input
            id="shopName"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Enter shop name"
            className="bg-background border-primary/20"
            data-testid="input-shop-name"
          />
        </div>

        <div className="space-y-2">
          <Label>Shop Logo</Label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden border border-primary/20">
              {logoPreview ? (
                <img 
                  src={logoPreview} 
                  alt="Shop logo" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store className="w-8 h-8 text-primary-foreground" />
              )}
            </div>
            <div className="flex-1">
              <Input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
                data-testid="input-shop-logo"
              />
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <Button variant="outline" className="gap-2" asChild>
                  <span>
                    <Upload className="w-4 h-4" />
                    Upload Logo
                  </span>
                </Button>
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: Square image, max 2MB
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Logo URL (Alternative)</Label>
          <Input
            value={shopLogo}
            onChange={(e) => {
              setShopLogo(e.target.value);
              setLogoPreview(e.target.value);
            }}
            placeholder="https://example.com/logo.png"
            className="bg-background border-primary/20"
            data-testid="input-shop-logo-url"
          />
          <p className="text-xs text-muted-foreground">
            Enter a URL to use an external image, or upload a file above
          </p>
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Link className="w-5 h-5 text-primary" />
            <Label className="text-base font-semibold">Homepage Banner</Label>
          </div>
          
          {bannerPreview && !bannerError && (
            <div className="w-full rounded-md overflow-hidden border border-primary/20">
              <img 
                src={bannerPreview} 
                alt="Banner preview" 
                className="w-full h-auto max-h-32 object-cover"
                onError={() => setBannerError(true)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Banner URL</Label>
            <Input
              value={bannerUrl}
              onChange={(e) => {
                setBannerUrl(e.target.value);
                setBannerPreview(e.target.value);
                setBannerError(false);
              }}
              placeholder="https://example.com/banner.gif"
              className="bg-background border-primary/20"
              data-testid="input-banner-url"
            />
            <p className="text-xs text-muted-foreground">
              Enter a URL to an image or GIF for the homepage banner
            </p>
          </div>
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            <Label className="text-base font-semibold">Announcement Bar</Label>
          </div>

          <Card className="bg-background/50 border-primary/10">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Enable Announcement</Label>
                  <p className="text-xs text-muted-foreground">Show an announcement bar at the top of the homepage</p>
                </div>
                <Switch
                  checked={announcementEnabled}
                  onCheckedChange={setAnnouncementEnabled}
                  data-testid="switch-announcement-enabled"
                />
              </div>

              <div className="space-y-2">
                <Label>Announcement Text</Label>
                <Textarea
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="Welcome to our store /n Thank you for your purchase /n New items available!"
                  className="bg-background border-primary/20 min-h-[80px] resize-none"
                  data-testid="input-announcement-text"
                />
                <div className="space-y-1">
                  <p className="text-xs text-primary">Rotating Messages:</p>
                  <p className="text-xs text-muted-foreground">
                    Use <span className="text-primary font-bold">/n</span> to separate multiple messages. They will rotate every 2 seconds with a smooth pan transition.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Example: <span className="text-foreground font-medium">Welcome to our store /n Thank you for your purchase /n New items available!</span>
                  </p>
                </div>
              </div>

              {announcementMessages.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Preview:</Label>
                  <div className="rounded-md border border-primary/20 bg-background px-4 py-3 text-center overflow-hidden">
                    <p className="text-sm text-foreground font-medium" data-testid="text-announcement-preview">
                      {announcementMessages.join("  /n  ")}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saveMutation.isPending}
          className="w-full gap-2"
          data-testid="button-save-shop-settings"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Shop Settings
        </Button>
      </CardContent>
    </Card>
  );
}
