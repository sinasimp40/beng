import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Mail, Server, Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

interface SmtpSettingsResponse {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  passwordConfigured: boolean;
  fromEmail: string;
  fromName: string;
}

export function SmtpSettings() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    host: "",
    port: "587",
    secure: false,
    user: "",
    password: "",
    fromEmail: "",
    fromName: "",
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const { data: settings, isLoading } = useQuery<SmtpSettingsResponse>({
    queryKey: ["/api/settings/smtp"],
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (settings && !isInitialized) {
      setFormData({
        host: settings.host || "",
        port: settings.port?.toString() || "587",
        secure: settings.secure ?? false,
        user: settings.user || "",
        password: "",
        fromEmail: settings.fromEmail || "",
        fromName: settings.fromName || "",
      });
      setIsInitialized(true);
    }
  }, [settings, isInitialized]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/settings/smtp", {
        host: data.host,
        port: parseInt(data.port) || 587,
        secure: data.secure,
        user: data.user,
        password: data.password || undefined,
        fromEmail: data.fromEmail,
        fromName: data.fromName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/smtp"] });
      toast({
        title: "Settings saved",
        description: "SMTP settings have been saved successfully",
      });
      setFormData(prev => ({ ...prev, password: "" }));
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/settings/smtp/test");
    },
    onSuccess: () => {
      toast({
        title: "Test successful",
        description: "SMTP connection test passed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-card-border">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-card-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          SMTP Email Settings
        </CardTitle>
        <CardDescription>
          Configure your SMTP server to send order confirmation emails to customers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host" className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                SMTP Host
              </Label>
              <Input
                id="smtp-host"
                data-testid="input-smtp-host"
                placeholder="smtp.gmail.com"
                value={formData.host}
                onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-port">SMTP Port</Label>
              <Input
                id="smtp-port"
                data-testid="input-smtp-port"
                type="number"
                placeholder="587"
                value={formData.port}
                onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="smtp-secure"
              data-testid="switch-smtp-secure"
              checked={formData.secure}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, secure: checked }))}
            />
            <Label htmlFor="smtp-secure" className="cursor-pointer">
              Use SSL/TLS (enable for port 465)
            </Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-user">SMTP Username</Label>
              <Input
                id="smtp-user"
                data-testid="input-smtp-user"
                placeholder="your-email@gmail.com"
                value={formData.user}
                onChange={(e) => setFormData(prev => ({ ...prev, user: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-password" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                SMTP Password
              </Label>
              <div className="relative">
                <Input
                  id="smtp-password"
                  data-testid="input-smtp-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={settings?.passwordConfigured ? "••••••••" : "Enter password"}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {settings?.passwordConfigured && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  Password is configured (leave blank to keep current)
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-from-email">From Email</Label>
              <Input
                id="smtp-from-email"
                data-testid="input-smtp-from-email"
                type="email"
                placeholder="noreply@yourstore.com"
                value={formData.fromEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, fromEmail: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-from-name">From Name</Label>
              <Input
                id="smtp-from-name"
                data-testid="input-smtp-from-name"
                placeholder="Your Store Name"
                value={formData.fromName}
                onChange={(e) => setFormData(prev => ({ ...prev, fromName: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              data-testid="button-save-smtp"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !settings?.host}
              data-testid="button-test-smtp"
            >
              {testMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
