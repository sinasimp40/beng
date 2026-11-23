import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Database, Download, Upload, Send, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { BackupProgress, DatabaseBackupSettings } from "@shared/schema";

export function DatabaseSettings() {
  const { toast } = useToast();
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChannelId, setTelegramChannelId] = useState("");
  const [backupIntervalHours, setBackupIntervalHours] = useState(5);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: settings, isLoading: isLoadingSettings } = useQuery<{ settings: DatabaseBackupSettings }>({
    queryKey: ["/api/database/settings"],
  });

  useEffect(() => {
    if (settings?.settings) {
      setTelegramBotToken(settings.settings.telegramBotToken || "");
      setTelegramChannelId(settings.settings.telegramChannelId || "");
      setBackupIntervalHours(settings.settings.backupIntervalHours || 5);
      setAutoBackupEnabled(settings.settings.autoBackupEnabled || false);
    }
  }, [settings]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const authToken = localStorage.getItem("buybit_auth_token");
    if (!authToken) return;
    // Token sent via Sec-WebSocket-Protocol so it never lands in URL/proxy logs.
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/database`, [authToken]);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as BackupProgress;
        setProgress(data);
        
        if (data.phase === "completed") {
          setIsExporting(false);
          setIsImporting(false);
          toast({
            title: "Success",
            description: data.message,
          });
          setTimeout(() => setProgress(null), 3000);
        } else if (data.phase === "error") {
          setIsExporting(false);
          setIsImporting(false);
          toast({
            title: "Error",
            description: data.message,
            variant: "destructive",
          });
          setTimeout(() => setProgress(null), 5000);
        }
      } catch (e) {
        console.error("Error parsing WebSocket message:", e);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [toast]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: DatabaseBackupSettings) => {
      return apiRequest("POST", "/api/database/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/database/settings"] });
      toast({
        title: "Settings saved",
        description: "Database backup settings have been saved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExport = async () => {
    setIsExporting(true);
    setProgress({ jobId: "", phase: "preparing", percent: 0, message: "Starting export..." });
    
    try {
      const token = localStorage.getItem("buybit_auth_token");
      const response = await fetch("/api/database/export", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        const { parseErrorMessage } = await import("@/lib/queryClient");
        throw new Error(parseErrorMessage(errorText, "Export failed"));
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `buybit-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setIsExporting(false);
      setProgress({ jobId: "", phase: "completed", percent: 100, message: "Export downloaded successfully" });
    } catch (error) {
      setIsExporting(false);
      setProgress({ jobId: "", phase: "error", percent: 0, message: (error as Error).message });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setProgress({ jobId: "", phase: "preparing", percent: 0, message: "Reading import file..." });

    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      setProgress({ jobId: "", phase: "importing", percent: 50, message: "Importing data..." });
      
      const response = await apiRequest("POST", "/api/database/import", importData);
      
      if (response) {
        queryClient.invalidateQueries();
        setProgress({ jobId: "", phase: "completed", percent: 100, message: "Import completed successfully. Logging out..." });
        toast({
          title: "Success",
          description: "Database imported successfully. You will be logged out.",
        });
        
        // After successful import, log out the user since session data has changed
        setTimeout(async () => {
          await logout();
          setLocation("/");
        }, 2000);
      }
    } catch (error) {
      setProgress({ jobId: "", phase: "error", percent: 0, message: (error as Error).message });
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setTimeout(() => setProgress(null), 3000);
    }
  };

  const handleTestTelegram = async () => {
    const hasStoredToken = settings?.settings?.hasToken;
    const useStored = telegramBotToken === "********" && hasStoredToken;
    
    if (!useStored && (!telegramBotToken || !telegramChannelId)) {
      toast({
        title: "Missing credentials",
        description: "Please enter both Bot Token and Channel ID",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const res = await apiRequest("POST", "/api/database/telegram/test", useStored ? {
        useStored: true,
      } : {
        botToken: telegramBotToken,
        channelId: telegramChannelId,
      });
      const response = await res.json() as { success: boolean; message: string };
      
      toast({
        title: response.success ? "Success" : "Failed",
        description: response.message,
        variant: response.success ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendBackupNow = async () => {
    const hasStoredToken = settings?.settings?.hasToken;
    const useStored = telegramBotToken === "********" && hasStoredToken;
    
    if (!useStored && (!telegramBotToken || !telegramChannelId)) {
      toast({
        title: "Missing credentials",
        description: "Please configure Telegram settings first",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    setProgress({ jobId: "", phase: "preparing", percent: 0, message: "Creating backup for Telegram..." });

    try {
      setProgress({ jobId: "", phase: "uploading", percent: 50, message: "Sending backup to Telegram..." });
      
      await apiRequest("POST", "/api/database/telegram/send-backup", useStored ? {
        useStored: true,
      } : {
        botToken: telegramBotToken,
        channelId: telegramChannelId,
      });
      
      setProgress({ jobId: "", phase: "completed", percent: 100, message: "Backup sent to Telegram successfully" });
      toast({
        title: "Success",
        description: "Backup sent to Telegram successfully",
      });
    } catch (error) {
      setProgress({ jobId: "", phase: "error", percent: 0, message: (error as Error).message });
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setProgress(null), 3000);
    }
  };

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      telegramBotToken,
      telegramChannelId,
      backupIntervalHours,
      autoBackupEnabled,
    });
  };

  const getPhaseIcon = (phase: BackupProgress["phase"]) => {
    switch (phase) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Database Export / Import
          </CardTitle>
          <CardDescription>
            Export your database as JSON or import from a backup file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {progress && (
            <div className="space-y-2 p-4 bg-background/50 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                {getPhaseIcon(progress.phase)}
                <span className="text-sm font-medium">{progress.message}</span>
                {progress.phase !== "completed" && progress.phase !== "error" && (
                  <Badge variant="outline" className="ml-auto">
                    {progress.percent}%
                  </Badge>
                )}
              </div>
              <Progress value={progress.percent} className="h-2" />
              {progress.tableName && (
                <p className="text-xs text-muted-foreground">
                  Table: {progress.tableName}
                  {progress.totalRows && ` (${progress.processedRows}/${progress.totalRows} rows)`}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <Button
              onClick={handleExport}
              disabled={isExporting || isImporting}
              className="gap-2"
              data-testid="button-export-database"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export Database (JSON)
            </Button>

            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".json"
                className="hidden"
                data-testid="input-import-file"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isExporting || isImporting}
                className="gap-2"
                data-testid="button-import-database"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Import from JSON
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Telegram Backup
          </CardTitle>
          <CardDescription>
            Configure automatic backups to your Telegram channel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telegram-bot-token">Bot Token</Label>
              <Input
                id="telegram-bot-token"
                type="password"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                data-testid="input-telegram-bot-token"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegram-channel-id">Channel ID</Label>
              <Input
                id="telegram-channel-id"
                value={telegramChannelId}
                onChange={(e) => setTelegramChannelId(e.target.value)}
                placeholder="-1001234567890 or @channelname"
                data-testid="input-telegram-channel-id"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Button
              variant="outline"
              onClick={handleTestTelegram}
              disabled={isTesting || !telegramBotToken || !telegramChannelId}
              className="gap-2"
              data-testid="button-test-telegram"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Test Connection
            </Button>

            <Button
              onClick={handleSendBackupNow}
              disabled={isExporting || !telegramBotToken || !telegramChannelId}
              className="gap-2"
              data-testid="button-send-backup-telegram"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Backup Now
            </Button>
          </div>

          <div className="border-t border-border pt-4 mt-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-backup"
                  checked={autoBackupEnabled}
                  onCheckedChange={setAutoBackupEnabled}
                  data-testid="switch-auto-backup"
                />
                <Label htmlFor="auto-backup">Enable automatic backups</Label>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="backup-interval">Every</Label>
                <Input
                  id="backup-interval"
                  type="number"
                  min={1}
                  max={168}
                  value={backupIntervalHours}
                  onChange={(e) => setBackupIntervalHours(parseInt(e.target.value) || 5)}
                  className="w-20"
                  data-testid="input-backup-interval"
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSaveSettings}
            disabled={saveSettingsMutation.isPending}
            className="gap-2"
            data-testid="button-save-telegram-settings"
          >
            {saveSettingsMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Save Telegram Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
