import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Search, ReceiptText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
type CreditTransaction = { id: string; [key: string]: any };
type TelegramAlert = {
  id: string;
  userEmail: string;
  amountCents: number;
  payCurrency: string;
  paymentId: string | null;
  eventStatus: string;
  gatewayStatus: string | null;
  deliveryStatus: string;
  deliveryAttempts: number;
  deliveryAttemptedAt: string | null;
  deliveryLastError: string | null;
  createdAt: string;
};

const money = (cents: number) => `$${(Math.abs(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function CreditLogs() {
  const { token } = useAuth(); const { toast } = useToast(); const [search, setSearch] = useState(""); const [type, setType] = useState("all"); const [status, setStatus] = useState("all");
  const { data = [], isLoading } = useQuery<CreditTransaction[]>({ queryKey: ["/api/admin/credit-transactions"], enabled: !!token, refetchInterval: 10000 });
  const { data: telegramAlerts = [], isLoading: isLoadingTelegramAlerts } = useQuery<TelegramAlert[]>({
    queryKey: ["/api/admin/credit-telegram-events"],
    enabled: !!token,
    refetchInterval: 5000,
  });
  const retryTelegramAlert = useMutation({
    mutationFn: (eventId: string) => apiRequest("POST", `/api/admin/credit-telegram-events/${eventId}/retry`).then(response => response.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/credit-telegram-events"] });
      toast({ title: "Telegram alert queued", description: "The alert will be retried with the current Telegram settings." });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/credit-telegram-events"] });
      toast({ title: "Could not retry Telegram alert", description: error.message, variant: "destructive" });
    },
  });
  const rows = useMemo(() => data.filter((tx: any) => {
    const hay = [tx.userEmail, tx.actorEmail, tx.reason, tx.orderId, tx.topupId, tx.type].filter(Boolean).join(" ").toLowerCase();
    return (!search || hay.includes(search.toLowerCase())) && (type === "all" || tx.type === type) && (status === "all" || tx.status === status);
  }), [data, search, type, status]);
  const types = Array.from(new Set(data.map((x: any) => x.type).filter(Boolean)));
  return <div className="space-y-6">
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search user, order, actor, reason…" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-credit-logs" /></div>
          <Select value={type} onValueChange={setType}><SelectTrigger className="lg:w-48" data-testid="select-credit-type"><SelectValue placeholder="All types" /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{types.map(t => <SelectItem value={t} key={t}>{t.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="lg:w-40" data-testid="select-credit-status"><SelectValue placeholder="All status" /></SelectTrigger><SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="failed">Failed</SelectItem></SelectContent></Select>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Time</th><th className="p-3">User</th><th className="p-3">Change</th><th className="p-3">Balance after</th><th className="p-3">Actor / reason</th><th className="p-3">Relation</th><th className="p-3">Notification</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading credit ledger…</td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground"><ReceiptText className="mx-auto mb-2 h-8 w-8 opacity-40" />No matching credit transactions.</td></tr> : rows.map((tx: any) => <tr key={tx.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30"><td className="p-3 whitespace-nowrap text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</td><td className="p-3"><div className="font-medium">{tx.userEmail || tx.userId}</div><div className="text-xs text-muted-foreground">{tx.type}</div></td><td className={`p-3 font-semibold whitespace-nowrap ${tx.amountCents >= 0 ? "text-green-500" : "text-destructive"}`}>{tx.amountCents >= 0 ? "+" : "−"}{money(tx.amountCents)}</td><td className="p-3 tabular-nums">{money(tx.balanceAfterCents)}</td><td className="p-3 max-w-[230px]"><div>{tx.actorEmail || "System"}</div><div className="truncate text-xs text-muted-foreground">{tx.reason || "—"}</div></td><td className="p-3 text-xs">{tx.orderId ? `Order ${tx.orderId}` : tx.topupId ? `Top-up ${tx.topupId}` : "—"}</td><td className="p-3"><Badge variant="outline">{tx.notificationStatus || "not sent"}</Badge></td></tr>)}</tbody></table></div>
      </CardContent>
    </Card>

    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div><h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Exhausted Telegram alerts</h3><p className="text-sm text-muted-foreground mt-1">Top-up alerts that failed five delivery attempts. Retrying only sends the existing alert again.</p></div>
          <Badge variant="outline">{telegramAlerts.length}</Badge>
        </div>
        {isLoadingTelegramAlerts ? <div className="p-8 text-center text-muted-foreground">Loading exhausted alerts…</div> : telegramAlerts.length === 0 ? <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">No exhausted Telegram alerts.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Failed at</th><th className="p-3">User</th><th className="p-3">Top-up event</th><th className="p-3">Attempts</th><th className="p-3 min-w-[240px]">Last delivery error</th><th className="p-3 text-right">Action</th></tr></thead><tbody>{telegramAlerts.map(alert => <tr key={alert.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30"><td className="p-3 whitespace-nowrap text-muted-foreground">{new Date(alert.deliveryAttemptedAt || alert.createdAt).toLocaleString()}</td><td className="p-3"><div className="font-medium">{alert.userEmail}</div><div className="text-xs text-muted-foreground">{money(alert.amountCents)} {alert.payCurrency.toUpperCase()}</div></td><td className="p-3"><div>{alert.eventStatus.replaceAll("_", " ")}</div><div className="text-xs text-muted-foreground">{alert.gatewayStatus || "—"}</div></td><td className="p-3"><Badge variant="destructive">{alert.deliveryAttempts}/5</Badge></td><td className="p-3 max-w-[320px]"><span className="break-words text-destructive">{alert.deliveryLastError || "Unknown delivery error"}</span></td><td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => retryTelegramAlert.mutate(alert.id)} disabled={retryTelegramAlert.isPending}><RefreshCw className={`mr-2 h-4 w-4 ${retryTelegramAlert.isPending ? "animate-spin" : ""}`} />Retry</Button></td></tr>)}</tbody></table></div>}
      </CardContent>
    </Card>
  </div>;
}