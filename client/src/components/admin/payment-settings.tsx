import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, Eye, EyeOff, Save, CheckCircle2, AlertCircle } from "lucide-react";

interface PaymentSettings {
  apiKeyConfigured: boolean;
  ipnSecretConfigured: boolean;
}

export function PaymentSettings() {
  const [apiKey, setApiKey] = useState("");
  const [ipnSecret, setIpnSecret] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showIpnSecret, setShowIpnSecret] = useState(false);
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<PaymentSettings>({
    queryKey: ["/api/settings/payment"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { apiKey?: string; ipnSecret?: string }) => {
      return apiRequest("POST", "/api/settings/payment", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/payment"] });
      toast({
        title: "Settings saved",
        description: "Your payment settings have been updated successfully",
      });
      setApiKey("");
      setIpnSecret("");
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
    const data: { apiKey?: string; ipnSecret?: string } = {};
    if (apiKey.trim()) data.apiKey = apiKey.trim();
    if (ipnSecret.trim()) data.ipnSecret = ipnSecret.trim();

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
          <Settings className="w-5 h-5 text-primary" />
          Payment Settings
        </CardTitle>
        <CardDescription>
          Configure your crypto payment gateway API credentials for accepting cryptocurrency payments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="apiKey">API Key</Label>
              {settings?.apiKeyConfigured ? (
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
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  placeholder={settings?.apiKeyConfigured ? "Enter new API key to update" : "Enter your payment gateway API key"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                  data-testid="input-api-key"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your API key from your crypto payment provider dashboard
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ipnSecret">IPN Secret</Label>
              {settings?.ipnSecretConfigured ? (
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
                  id="ipnSecret"
                  type={showIpnSecret ? "text" : "password"}
                  placeholder={settings?.ipnSecretConfigured ? "Enter new IPN secret to update" : "Enter your IPN secret key"}
                  value={ipnSecret}
                  onChange={(e) => setIpnSecret(e.target.value)}
                  className="pr-10"
                  data-testid="input-ipn-secret"
                />
                <button
                  type="button"
                  onClick={() => setShowIpnSecret(!showIpnSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showIpnSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Used to verify payment notifications (IPN callbacks)
            </p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending || (!apiKey.trim() && !ipnSecret.trim())}
          className="gap-2"
          data-testid="button-save-settings"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
