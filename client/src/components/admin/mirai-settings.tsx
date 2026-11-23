import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KeyRound, RefreshCw, Save, WalletCards } from "lucide-react";

interface MiraiStatus {
  configured: boolean;
  balance?: { balance_vnd: number; discount_bps?: number; tier?: string };
  products?: unknown[];
  error?: string;
}

export function MiraiSettings() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const { data, isLoading } = useQuery<MiraiStatus>({ queryKey: ["/api/admin/mirai"] });

  useEffect(() => {
    if (data?.error) toast({ title: "Mirai connection error", description: data.error, variant: "destructive" });
  }, [data?.error, toast]);

  const save = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/mirai", { apiKey }),
    onSuccess: (result: MiraiStatus) => {
      setApiKey("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mirai"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Mirai catalog synchronized", description: `${result.products?.length || 0} product(s) are ready for your pricing and content edits.` });
    },
    onError: (error: Error) => toast({ title: "Mirai setup failed", description: error.message, variant: "destructive" }),
  });

  const sync = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/mirai/sync"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mirai"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Mirai catalog updated", description: "Availability was refreshed without changing your product content or prices." });
    },
    onError: (error: Error) => toast({ title: "Sync failed", description: error.message, variant: "destructive" }),
  });

  return (
    <Card className="bg-card border-card-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" />Mirai Reseller</CardTitle>
        <p className="text-sm text-muted-foreground">Connect your reseller account and import the live package catalog. Prices, images, and descriptions remain yours to edit.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="mirai-api-key">Reseller API key</Label>
          <div className="flex gap-2">
            <Input id="mirai-api-key" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={data?.configured ? "Enter a new key to rotate it" : "MR-..."} autoComplete="new-password" />
            <Button onClick={() => save.mutate()} disabled={!apiKey.trim() || save.isPending} className="gap-2"><Save className="w-4 h-4" />Save & sync</Button>
          </div>
        </div>
        {isLoading ? <p className="text-sm text-muted-foreground">Checking connection...</p> : data?.configured && data.balance ? (
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Badge variant="outline" className="gap-2"><WalletCards className="w-3.5 h-3.5" />Balance: {data.balance.balance_vnd.toLocaleString()} VND</Badge>
            {data.balance.tier && <Badge variant="secondary">{data.balance.tier}</Badge>}
            <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending} className="gap-2"><RefreshCw className={`w-4 h-4 ${sync.isPending ? "animate-spin" : ""}`} />Refresh catalog</Button>
          </div>
        ) : <p className="text-sm text-muted-foreground">No reseller key configured.</p>}
      </CardContent>
    </Card>
  );
}
