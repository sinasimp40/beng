import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Activity, KeyRound, RefreshCw, Save, WalletCards } from "lucide-react";

interface MiraiStatus {
  configured: boolean;
  balance?: { balance_vnd: number; discount_bps?: number; tier?: string };
  products?: unknown[];
  error?: string;
  vndPerUsd?: number;
  activity?: { id: string; action: "redeem_new" | "redeem_renew"; code: string; apiKey?: string; createdAt: string }[];
}

export function MiraiSettings() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [vndPerUsd, setVndPerUsd] = useState("26000");
  const { data, isLoading } = useQuery<MiraiStatus>({ queryKey: ["/api/admin/mirai"], refetchInterval: 60_000 });

  useEffect(() => {
    if (data?.error) toast({ title: "Mirai connection error", description: data.error, variant: "destructive" });
    if (data?.vndPerUsd) setVndPerUsd(String(data.vndPerUsd));
  }, [data?.error, data?.vndPerUsd, toast]);

  const invalidate = async () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/mirai"] });
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    await queryClient.refetchQueries({ queryKey: ["/api/products?admin=true"] });
  };
  const save = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/mirai", { apiKey, vndPerUsd: Number(vndPerUsd) }),
    onSuccess: async response => { const result = await response.json() as MiraiStatus; setApiKey(""); await invalidate(); toast({ title: "Mirai catalog synchronized", description: `${result.products?.length || 0} product(s) are ready for your pricing and content edits.` }); },
    onError: (error: Error) => toast({ title: "Mirai setup failed", description: error.message, variant: "destructive" }),
  });
  const sync = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/mirai/sync", { vndPerUsd: Number(vndPerUsd) }),
    onSuccess: async () => { await invalidate(); toast({ title: "Mirai catalog updated", description: "Balance, stock, and availability were refreshed. Your product edits were kept." }); },
    onError: (error: Error) => toast({ title: "Sync failed", description: error.message, variant: "destructive" }),
  });

  return <div className="space-y-6">
    <Card className="bg-card border-card-border">
      <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Mirai reseller</CardTitle><p className="text-sm text-muted-foreground">Only administrators can see balance and sync details. Manual product prices, names, images, and descriptions are never overwritten by refresh.</p></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[1fr_190px]"><div className="space-y-2"><Label htmlFor="mirai-api-key">Reseller API key</Label><div className="flex gap-2"><Input id="mirai-api-key" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={data?.configured ? "Enter a new key to rotate it" : "MR-..."} autoComplete="new-password" /><Button onClick={() => save.mutate()} disabled={!apiKey.trim() || save.isPending}><Save className="h-4 w-4" />Save & sync</Button></div></div><div className="space-y-2"><Label htmlFor="mirai-rate">VND per USD</Label><Input id="mirai-rate" inputMode="numeric" value={vndPerUsd} onChange={e => setVndPerUsd(e.target.value.replace(/[^0-9]/g, ""))} /><p className="text-xs text-muted-foreground">For new imported default prices only.</p></div></div>
        {isLoading ? <p className="text-sm text-muted-foreground">Checking connection...</p> : data?.configured && data.balance ? <div className="flex flex-wrap items-center gap-3 border-t pt-4"><Badge variant="outline" className="gap-2"><WalletCards className="h-3.5 w-3.5" />Balance: {data.balance.balance_vnd.toLocaleString()} VND</Badge>{data.balance.tier && <Badge variant="secondary">{data.balance.tier}</Badge>}<Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}><RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />Refresh balance & catalog</Button></div> : <p className="text-sm text-muted-foreground">No reseller key configured.</p>}
      </CardContent>
    </Card>
    <Card className="bg-card border-card-border"><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Redeem activity</CardTitle><p className="text-sm text-muted-foreground">Creates and renewals completed through the customer redeem page. Secret values are masked.</p></CardHeader><CardContent>{data?.activity?.length ? <div className="max-h-72 overflow-auto rounded-lg border"><table className="w-full min-w-[620px] text-sm"><thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Time</th><th className="p-3">Action</th><th className="p-3">Code</th><th className="p-3">API key</th></tr></thead><tbody>{data.activity.map(entry => <tr className="border-t" key={entry.id}><td className="p-3 text-xs">{new Date(entry.createdAt).toLocaleString()}</td><td className="p-3">{entry.action === "redeem_new" ? "Create new key" : "Add to existing key"}</td><td className="p-3 font-mono text-xs">{entry.code}</td><td className="p-3 font-mono text-xs">{entry.apiKey || "-"}</td></tr>)}</tbody></table></div> : <p className="py-6 text-center text-sm text-muted-foreground">No redeem activity recorded yet.</p>}</CardContent></Card>
  </div>;
}
