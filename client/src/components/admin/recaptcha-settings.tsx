import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, EyeOff, Save, CheckCircle2, AlertCircle } from "lucide-react";

interface RecaptchaSettings {
  siteKeyConfigured: boolean;
  secretKeyConfigured: boolean;
  siteKey: string;
}

export function RecaptchaSettings() {
  const [siteKey, setSiteKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showSiteKey, setShowSiteKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<RecaptchaSettings>({
    queryKey: ["/api/settings/recaptcha"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { siteKey?: string; secretKey?: string }) => {
      return apiRequest("POST", "/api/settings/recaptcha", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/recaptcha"] });
      toast({
        title: "Settings saved",
        description: "Your reCAPTCHA settings have been updated successfully",
      });
      setSiteKey("");
      setSecretKey("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const data: { siteKey?: string; secretKey?: string } = {};
    if (siteKey.trim()) data.siteKey = siteKey.trim();
    if (secretKey.trim()) data.secretKey = secretKey.trim();

    if (Object.keys(data).length === 0) {
      toast({
        title: "No changes",
        description: "Please enter at least one value to update",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate(data);
  };

  return (
    <Card className="bg-card border-card-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          reCAPTCHA Settings
        </CardTitle>
        <CardDescription>
          Configure Google reCAPTCHA v2 to protect your login and registration forms from bots
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="siteKey">Site Key</Label>
              {settings?.siteKeyConfigured ? (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <CheckCircle2 className="w-3 h-3" />
                  Configured
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-yellow-500">
                  <AlertCircle className="w-3 h-3" />
                  Not configured
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="siteKey"
                  type={showSiteKey ? "text" : "password"}
                  placeholder={settings?.siteKeyConfigured ? "Enter new site key to update" : "Enter your reCAPTCHA site key"}
                  value={siteKey}
                  onChange={(e) => setSiteKey(e.target.value)}
                  className="pr-10"
                  data-testid="input-recaptcha-site-key"
                />
                <button
                  type="button"
                  onClick={() => setShowSiteKey(!showSiteKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSiteKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The public key used in your frontend to display the reCAPTCHA widget
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="secretKey">Secret Key</Label>
              {settings?.secretKeyConfigured ? (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <CheckCircle2 className="w-3 h-3" />
                  Configured
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-yellow-500">
                  <AlertCircle className="w-3 h-3" />
                  Not configured
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="secretKey"
                  type={showSecretKey ? "text" : "password"}
                  placeholder={settings?.secretKeyConfigured ? "Enter new secret key to update" : "Enter your reCAPTCHA secret key"}
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="pr-10"
                  data-testid="input-recaptcha-secret-key"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your keys from{" "}
              <a
                href="https://www.google.com/recaptcha/admin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google reCAPTCHA Admin Console
              </a>
            </p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending || (!siteKey.trim() && !secretKey.trim())}
          className="gap-2"
          data-testid="button-save-recaptcha-settings"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
