import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Link2, Plus, Copy, Trash2, Loader2, Users, CalendarDays, CalendarRange, MousePointerClick } from "lucide-react";

type Referral = { id: string; code: string; label: string; destination: string; enabled: number; createdAt: string; total: number; daily: number; weekly: number; monthly: number };
const periodCards = [
  { key: "daily", label: "Today", icon: MousePointerClick },
  { key: "weekly", label: "This week", icon: CalendarDays },
  { key: "monthly", label: "This month", icon: CalendarRange },
  { key: "total", label: "All time", icon: Users },
] as const;

export function ReferralLinks() {
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [destination, setDestination] = useState("/");
  const { data: referrals = [], isLoading, isError } = useQuery<Referral[]>({ queryKey: ["/api/admin/referrals"], refetchInterval: 30_000 });
  const totals = useMemo(() => referrals.reduce((out, link) => ({ daily: out.daily + Number(link.daily || 0), weekly: out.weekly + Number(link.weekly || 0), monthly: out.monthly + Number(link.monthly || 0), total: out.total + Number(link.total || 0) }), { daily: 0, weekly: 0, monthly: 0, total: 0 }), [referrals]);

  const createMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/referrals", { label, destination }),
    onSuccess: () => { setLabel(""); setDestination("/"); queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] }); toast({ title: "Referral link created" }); },
    onError: (error: Error) => toast({ title: "Could not create link", description: error.message, variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => apiRequest("PATCH", `/api/admin/referrals/${id}`, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] }),
    onError: (error: Error) => toast({ title: "Could not update link", description: error.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/referrals/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] }); toast({ title: "Referral link deleted" }); },
    onError: (error: Error) => toast({ title: "Could not delete link", description: error.message, variant: "destructive" }),
  });

  const urlFor = (code: string) => `${window.location.origin}/r/${code}`;
  const copyUrl = async (code: string) => {
    await navigator.clipboard.writeText(urlFor(code));
    toast({ title: "Referral URL copied" });
  };

  return <div className="space-y-6">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {periodCards.map(({ key, label: title, icon: Icon }) => <Card key={key}><CardContent className="flex items-center justify-between gap-3 pt-5"><div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{totals[key].toLocaleString()}</p><p className="text-xs text-muted-foreground">redirect visits across all links</p></div><Icon className="h-5 w-5 shrink-0 text-primary" /></CardContent></Card>)}
    </div>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" />Create referral link</CardTitle><p className="text-sm text-muted-foreground">Each link gets a unique trackable URL. Visits count when someone opens the link and is redirected.</p></CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end" onSubmit={event => { event.preventDefault(); createMutation.mutate(); }}>
          <div className="space-y-2"><Label htmlFor="referral-label">Link label</Label><Input id="referral-label" value={label} onChange={event => setLabel(event.target.value)} placeholder="e.g. Telegram bio" maxLength={120} required /></div>
          <div className="space-y-2"><Label htmlFor="referral-destination">Destination path</Label><Input id="referral-destination" value={destination} onChange={event => setDestination(event.target.value)} placeholder="/ or /redeem-code" maxLength={500} /></div>
          <Button type="submit" disabled={!label.trim() || createMutation.isPending} className="gap-2">{createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create link</Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">Only paths on this site are allowed as destinations. Counts are raw redirect visits, not unique people, and are refreshed every 30 seconds.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Referral performance</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : isError ? <p className="py-10 text-center text-sm text-destructive">Could not load referral links.</p> : referrals.length === 0 ? <div className="rounded-lg border border-dashed py-12 text-center"><Link2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" /><p className="font-medium">No referral links yet</p><p className="mt-1 text-sm text-muted-foreground">Create a link above to start tracking visits.</p></div> : <div className="space-y-3">
          {referrals.map(link => <div key={link.id} className="grid gap-4 rounded-lg border p-4 xl:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1.4fr)_repeat(4,minmax(75px,.5fr))_auto] xl:items-center">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{link.label}</p><Badge variant={link.enabled ? "secondary" : "outline"}>{link.enabled ? "Active" : "Paused"}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">Destination: {link.destination}</p><p className="mt-1 text-xs text-muted-foreground">Created {new Date(link.createdAt).toLocaleDateString()}</p></div>
            <div className="flex min-w-0 items-center gap-2"><code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-2 text-xs" title={urlFor(link.code)}>{urlFor(link.code)}</code><Button size="icon" variant="outline" aria-label="Copy referral URL" title="Copy referral URL" onClick={() => void copyUrl(link.code)}><Copy className="h-4 w-4" /></Button></div>
            {periodCards.map(({ key, label: title }) => <div key={key} className="flex justify-between gap-2 text-sm xl:block"><span className="text-muted-foreground xl:text-xs">{title}</span><p className="font-semibold tabular-nums xl:mt-1">{Number(link[key] || 0).toLocaleString()}</p></div>)}
            <div className="flex items-center justify-end gap-3 border-t pt-3 xl:border-0 xl:pt-0"><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{link.enabled ? "On" : "Off"}</span><Switch checked={Boolean(link.enabled)} aria-label={`${link.enabled ? "Pause" : "Activate"} ${link.label}`} onCheckedChange={enabled => updateMutation.mutate({ id: link.id, enabled })} disabled={updateMutation.isPending} /></div><Button size="icon" variant="ghost" aria-label="Delete referral link" title="Delete referral link and its visit history" onClick={() => { if (window.confirm(`Delete "${link.label}" and its visit history?`)) deleteMutation.mutate(link.id); }} disabled={deleteMutation.isPending}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
          </div>)}
        </div>}
      </CardContent>
    </Card>
  </div>;
}