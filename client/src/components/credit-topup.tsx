import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, CheckCircle2, Clock3, Copy, Loader2, ShieldCheck, WalletCards, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Topup = { id: string; status?: string; payment?: { payment_status?: string; pay_address?: string; pay_amount?: number; pay_currency?: string; price_amount?: number }; [key: string]: unknown };
const currencies = ["btc", "eth", "usdt", "ltc", "sol", "bnb", "xrp", "doge", "xmr"];
const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CreditTopup() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState("25");
  const [currency, setCurrency] = useState("btc");
  const [topup, setTopup] = useState<Topup | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const requestFingerprintRef = useRef<string | null>(null);
  const payment = topup?.payment;
  const status = String(payment?.payment_status || topup?.status || "waiting");
  const terminal = ["finished", "completed", "failed", "expired", "refunded"].includes(status);

  const { data: activity = [] } = useQuery<any[]>({
    queryKey: ["/api/credit/activity"],
    enabled: !!token,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!topup?.id || terminal) return;
    const timer = window.setInterval(async () => {
      const res = await fetch(`/api/credit/topups/${topup.id}`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" });
      if (res.ok) {
        const next = await res.json();
        setTopup(prev => ({ ...prev, ...next, payment: next.payment || { ...prev?.payment, ...next } }));
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [topup?.id, terminal, token]);

  const createTopup = async () => {
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars < 1 || dollars > 10000) {
      toast({ title: "Choose an amount between $1 and $10,000", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      const requestFingerprint = `${Math.round(dollars * 100)}:${currency.toLowerCase()}`;
      if (requestFingerprintRef.current !== requestFingerprint) {
        requestFingerprintRef.current = requestFingerprint;
        idempotencyKeyRef.current = crypto.randomUUID();
      }
      const idempotencyKey = idempotencyKeyRef.current!;
      const res = await apiRequest("POST", "/api/credit/topups", { amountCents: Math.round(dollars * 100), payCurrency: currency }, { "X-Idempotency-Key": idempotencyKey });
      const data = await res.json();
      setTopup({ ...data.topup, payment: data.payment });
    } catch (e) {
      const message = (e as Error).message;
      toast({
        title: /minimum|minimal/i.test(message) ? "Amount is below the crypto minimum" : "Top-up could not be created",
        description: message,
        variant: "destructive",
      });
    }
    finally { setSubmitting(false); }
  };
  const reset = () => { idempotencyKeyRef.current = null; requestFingerprintRef.current = null; setTopup(null); };
  const copy = (value: string) => { navigator.clipboard.writeText(value); toast({ title: "Copied to clipboard" }); };
  const label = status === "finished" || status === "completed" ? "Credit added" : status === "refunded" ? "Payment refunded" : status === "failed" ? "Payment failed" : status === "expired" ? "Payment expired" : status === "confirming" ? "Confirming payment" : "Waiting for payment";

  return <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
    <Card className="border-primary/20 overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-primary/[0.04]">
        <CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-primary" /> Add account credit</CardTitle>
        <p className="text-sm text-muted-foreground">Fund your balance with crypto. Credit is available only after the payment is completed.</p>
      </CardHeader>
      <CardContent className="p-5 space-y-5">
        {!topup ? <><div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="credit-amount">Amount in USD</Label><Input id="credit-amount" type="number" min="1" max="10000" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} data-testid="input-credit-topup-amount" /><p className="text-xs text-muted-foreground">Minimum $1.00 · Maximum $10,000.00</p></div>
          <div className="space-y-2"><Label>Pay with</Label><Select value={currency} onValueChange={setCurrency}><SelectTrigger data-testid="select-credit-currency"><SelectValue /></SelectTrigger><SelectContent>{currencies.map(c => <SelectItem value={c} key={c}>{c.toUpperCase()}</SelectItem>)}</SelectContent></Select></div>
        </div><Button onClick={createTopup} disabled={submitting} className="w-full gap-2" data-testid="button-create-credit-topup">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownLeft className="h-4 w-4" />} Create secure top-up</Button></> :
        <div className="space-y-5">
          <div className="flex items-center justify-between"><Badge variant="outline" className="gap-2"><Clock3 className="h-3.5 w-3.5" />{label}</Badge><Button variant="ghost" size="sm" onClick={reset} data-testid="button-new-credit-topup">New top-up</Button></div>
          {status === "finished" || status === "completed" ? <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 flex gap-3"><CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /><div><p className="font-medium">Your account credit is ready.</p><p className="text-sm text-muted-foreground">The balance will update automatically.</p></div></div> :
          status === "failed" || status === "expired" || status === "refunded" ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 flex gap-3"><XCircle className="h-5 w-5 text-destructive shrink-0" /><p className="text-sm">{status === "refunded" ? "The provider refunded this payment and the related account credit was reversed." : "No credit was added. Start a new top-up to try again."}</p></div> :
          <div className="space-y-3"><div className="rounded-lg bg-muted/50 p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Send exactly</p><div className="flex items-center justify-between gap-2 mt-1"><span className="font-mono font-semibold">{payment?.pay_amount} {payment?.pay_currency?.toUpperCase()}</span><Button size="icon" variant="ghost" onClick={() => payment?.pay_amount && copy(String(payment.pay_amount))} data-testid="button-copy-topup-amount"><Copy className="h-4 w-4" /></Button></div></div><div className="rounded-lg bg-muted/50 p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Payment address</p><div className="flex items-center gap-2 mt-1"><code className="text-xs break-all flex-1">{payment?.pay_address || "Preparing address..."}</code><Button size="icon" variant="ghost" onClick={() => payment?.pay_address && copy(payment.pay_address)} data-testid="button-copy-topup-address"><Copy className="h-4 w-4" /></Button></div></div><p className="text-xs text-muted-foreground">Keep this window open or return later. We never show spendable credit until the network confirms your payment.</p></div>}
        </div>}
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Credit activity</CardTitle></CardHeader><CardContent className="space-y-2">{activity.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No credit activity yet.</p> : activity.slice(0, 6).map((tx: any) => <div key={tx.id} className="flex items-center justify-between border-b border-border/60 py-3 last:border-0"><div><p className="text-sm font-medium">{String(tx.type).replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p></div><div className="text-right"><p className={tx.amountCents >= 0 ? "text-green-500 font-semibold" : "text-foreground font-semibold"}>{tx.amountCents >= 0 ? "+" : ""}{money(tx.amountCents)}</p><p className="text-xs text-muted-foreground">Balance {money(tx.balanceAfterCents)}</p></div></div>)}</CardContent></Card>
  </div>;
}