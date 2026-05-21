import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryClient, apiRequest, getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCw, Github, CheckCircle2, AlertCircle, Loader2, ArrowUpCircle, Clock, Shield, Zap } from "lucide-react";

interface UpdateProgress {
  jobId: string;
  type: "checking" | "downloading" | "applying" | "rebuilding" | "complete" | "error";
  progress: number;
  message: string;
  details?: string;
}

interface UpdateSettings {
  connected: boolean;
  repoDisplay: string;
  currentCommit: string;
  lastChecked: string;
  lastUpdated: string;
}

interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  changedFiles: number;
}

export function UpdateSettings() {
  const [repoUrl, setRepoUrl] = useState("");
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<UpdateSettings>({
    queryKey: ["/api/admin/update/settings"],
  });

  useEffect(() => {
    if (settings?.connected) {
      setRepoUrl("");
    }
  }, [settings?.connected]);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failCountRef = useRef(0);

  const startPolling = () => {
    if (pollingRef.current) return;
    failCountRef.current = 0;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/update/progress", { credentials: "include", headers: getAuthHeaders() });
        if (!res.ok) {
          failCountRef.current++;
          if (failCountRef.current > 20) {
            stopPolling();
            setProgress({ jobId: "timeout", type: "error", progress: 0, message: "Lost connection to server. The update may still be running — please refresh the page." });
          }
          return;
        }
        failCountRef.current = 0;
        const data = await res.json();
        if (data.type === "idle") return;
        setProgress(data as UpdateProgress);
        if (data.type === "complete" || data.type === "error") {
          stopPolling();
          if (data.type === "complete") {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/update/settings"] });
            setUpdateInfo(null);
            setTimeout(() => {
              window.location.reload();
            }, 5000);
          }
        }
      } catch {
        failCountRef.current++;
        if (failCountRef.current > 20) {
          stopPolling();
          setProgress({ jobId: "timeout", type: "error", progress: 0, message: "Lost connection to server. The update may still be running — please refresh the page." });
        }
      }
    }, 500);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const setRepoMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/admin/update/set-repo", { githubUrl: url });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Repository connected", description: "Your repository has been linked successfully." });
      setRepoUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/update/settings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Invalid repository", description: err.message, variant: "destructive" });
    },
  });

  const checkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/update/check");
      return res.json();
    },
    onSuccess: (data: UpdateInfo) => {
      setUpdateInfo(data);
      if (!data.hasUpdate) {
        toast({ title: "You're up to date!", description: `Running version ${data.currentVersion}` });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Check failed", description: err.message, variant: "destructive" });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      setProgress({ jobId: "", type: "checking", progress: 0, message: "Starting update..." });
      const res = await apiRequest("POST", "/api/admin/update/apply");
      startPolling();
      return res.json();
    },
    onError: (err: Error) => {
      stopPolling();
      setProgress(null);
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSetRepo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      toast({ title: "Enter a URL", description: "Paste your GitHub repository link", variant: "destructive" });
      return;
    }
    setRepoMutation.mutate(repoUrl.trim());
  };

  const isUpdating = progress && progress.type !== "complete" && progress.type !== "error";
  const timeAgo = (dateStr: string) => {
    if (!dateStr) return "Never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Github className="w-5 h-5" />
            Repository Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSetRepo} className="flex gap-2">
            <Input
              type="password"
              placeholder={settings?.connected ? "Enter new repository URL to change..." : "Enter repository URL to connect..."}
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="flex-1"
              autoComplete="off"
              data-testid="input-github-url"
            />
            <Button type="submit" disabled={setRepoMutation.isPending || !repoUrl.trim()} data-testid="button-set-repo">
              {setRepoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : settings?.connected ? "Update" : "Connect"}
            </Button>
          </form>

          {settings?.connected && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>Connected</span>
              </div>
              {settings.lastChecked && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Checked {timeAgo(settings.lastChecked)}</span>
                </div>
              )}
              {settings.lastUpdated && (
                <div className="flex items-center gap-1">
                  <ArrowUpCircle className="w-3 h-3" />
                  <span>Updated {timeAgo(settings.lastUpdated)}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {settings?.connected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <RefreshCw className="w-5 h-5" />
                Check for Updates
              </CardTitle>
              <Button
                onClick={() => checkMutation.mutate()}
                disabled={checkMutation.isPending || !!isUpdating}
                variant="outline"
                size="sm"
                data-testid="button-check-updates"
              >
                {checkMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Checking...</>
                ) : (
                  <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Check Now</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {updateInfo ? (
              updateInfo.hasUpdate ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/15">
                    <ArrowUpCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Update Available</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-mono">{updateInfo.currentVersion}</span>
                        {" → "}
                        <span className="font-mono text-primary">{updateInfo.latestVersion}</span>
                        {updateInfo.changedFiles > 0 && ` · ${updateInfo.changedFiles} files changed`}
                      </p>
                    </div>
                    <Button
                      onClick={() => applyMutation.mutate()}
                      disabled={!!isUpdating}
                      size="sm"
                      data-testid="button-apply-update"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Apply Update
                    </Button>
                  </div>

                  <div className="flex gap-6 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Config files preserved</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Zero-downtime patching</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/5 border border-green-500/15">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">You're up to date</p>
                    <p className="text-xs text-muted-foreground">Running version <span className="font-mono">{updateInfo.currentVersion}</span></p>
                  </div>
                </div>
              )
            ) : !checkMutation.isPending && (
              <p className="text-sm text-muted-foreground">Click "Check Now" to see if a new version is available.</p>
            )}
          </CardContent>
        </Card>
      )}

      {(isUpdating || progress?.type === "complete" || progress?.type === "error") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Download className="w-5 h-5" />
              Update Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{progress?.message}</span>
                <span className="font-mono text-xs text-primary">{progress?.progress}%</span>
              </div>

              <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ease-linear ${
                    progress?.type === "error"
                      ? "bg-destructive"
                      : progress?.type === "complete"
                      ? "bg-green-500"
                      : "bg-primary"
                  }`}
                  style={{ width: `${progress?.progress || 0}%` }}
                />
              </div>

              {progress?.details && (
                <p className="text-xs text-muted-foreground">{progress.details}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {progress?.type === "complete" ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-500 font-medium">Update applied successfully</span>
                </>
              ) : progress?.type === "error" ? (
                <>
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive font-medium">Update failed</span>
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {progress?.type === "checking" && "Verifying repository..."}
                    {progress?.type === "downloading" && "Downloading files..."}
                    {progress?.type === "applying" && "Applying changes..."}
                    {progress?.type === "rebuilding" && "Rebuilding application..."}
                  </span>
                </>
              )}
            </div>

            {progress?.type === "complete" && (
              <p className="text-xs text-muted-foreground">
                Update applied successfully. The server will restart and this page will reload automatically in a few seconds...
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
