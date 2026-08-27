import { useState } from "react";
import type { Order } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShoppingCart, Clock, CheckCircle2, XCircle, Loader2, Copy, Search, Filter, RefreshCw, Trash2, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface OrdersTableProps {
  orders: Order[];
  isLoading?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: <Clock className="w-3 h-3" /> },
  confirming: { label: "Confirming", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed: { label: "Completed", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { label: "Failed", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: <XCircle className="w-3 h-3" /> },
  fulfilling: { label: "Fulfilling", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  fulfillment_failed: { label: "Fulfillment failed", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: <XCircle className="w-3 h-3" /> },
  expired: { label: "Expired", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: <XCircle className="w-3 h-3" /> },
};

const MAX_MANUAL_DELIVERY_RETRIES = 3;

export function OrdersTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 bg-muted/50 rounded-md animate-pulse"
        >
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-1/4" />
          </div>
          <div className="h-8 bg-muted rounded w-20" />
        </div>
      ))}
    </div>
  );
}

export function OrdersTable({ orders, isLoading }: OrdersTableProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [retryOrder, setRetryOrder] = useState<Order | null>(null);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/orders/sync-status", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      const updated = data.results?.filter((r: any) => r.previousStatus !== r.newStatus).length || 0;
      toast({
        title: "Sync Complete",
        description: `Synced ${data.synced} pending orders. ${updated} orders updated.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync order statuses",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/orders"] });
      toast({
        title: "Order deleted",
        description: "The order has been permanently deleted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete order",
        variant: "destructive",
      });
    },
  });
  const refundMutation = useMutation({
    mutationFn: async () => {
      if (!refundOrder || !refundReason.trim()) throw new Error("A refund reason is required");
      const res = await apiRequest("POST", `/api/admin/orders/${refundOrder.id}/refund-credit`, { reason: refundReason.trim() });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/orders"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/registered-users"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/credit-transactions"] }); toast({ title: "Refund issued", description: "The order total was returned as account credit." }); setRefundOrder(null); setRefundReason(""); },
    onError: (e: Error) => toast({ title: "Refund failed", description: e.message, variant: "destructive" }),
  });
  const retryDeliveryMutation = useMutation({
    mutationFn: async () => {
      if (!retryOrder) throw new Error("No order selected");
      const res = await apiRequest("POST", `/api/admin/orders/${retryOrder.orderId}/retry-delivery`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Delivery retry started", description: "The order has been queued for another bounded email delivery attempt." });
      setRetryOrder(null);
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Could not retry delivery", description: error.message, variant: "destructive" });
    },
  });

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} copied`,
      description: `${label} copied to clipboard`,
    });
  };

  if (isLoading) {
    return <OrdersTableSkeleton />;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredOrders = orders.filter((order) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === "" || 
      order.orderId.toLowerCase().includes(searchLower) ||
      (order.productName && order.productName.toLowerCase().includes(searchLower)) ||
      (order.email && order.email.toLowerCase().includes(searchLower)) ||
      (order.sentStock && order.sentStock.toLowerCase().includes(searchLower));
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search orders by ID, product, email, or stock sent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-orders"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirming">Confirming</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
               <SelectItem value="failed">Failed</SelectItem>
               <SelectItem value="fulfillment_failed">Fulfillment failed</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          data-testid="button-sync-orders"
        >
          {syncMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Sync Status
        </Button>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShoppingCart className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {orders.length === 0 ? "No orders yet" : "No matching orders"}
          </h3>
          <p className="text-muted-foreground">
            {orders.length === 0 
              ? "Orders will appear here when customers make purchases"
              : "Try adjusting your search or filter criteria"
            }
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-card-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Order ID</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead className="hidden xl:table-cell">Sent Stock</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const status = statusConfig[order.status] || statusConfig.pending;
                const canRefund = (order.status === "completed" || order.status === "finished") && !!(order as any).userId && !(order as any).refundedAt;
                const deliveryStatus = order.deliveryStatus || "pending";
                const canRetryDelivery =
                  order.status === "fulfillment_failed" &&
                  deliveryStatus === "exhausted" &&
                  order.deliveryRetryCount < MAX_MANUAL_DELIVERY_RETRIES;
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-primary truncate max-w-[120px]">
                          {order.orderId}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyText(order.orderId, "Order ID")}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground text-sm truncate max-w-[150px] block">
                        {order.productName || "Unknown Product"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Qty: {order.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                        {order.email || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium text-foreground">
                        ${order.totalAmount.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {order.payCurrency ? (
                        <Badge variant="outline" className="uppercase text-xs">
                          {order.payCurrency}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${status.color} border gap-1 text-xs`}>
                        {status.icon}
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge
                          variant="outline"
                          className={
                            deliveryStatus === "exhausted"
                              ? "border-red-500/40 text-red-400"
                              : deliveryStatus === "sent"
                                ? "border-green-500/40 text-green-400"
                                : deliveryStatus === "sending"
                                  ? "border-blue-500/40 text-blue-400"
                                  : "text-muted-foreground"
                          }
                        >
                          {deliveryStatus === "exhausted"
                            ? "Delivery exhausted"
                            : deliveryStatus === "sent"
                              ? "Delivery sent"
                              : deliveryStatus === "sending"
                                ? "Email sending"
                                : deliveryStatus === "failed"
                                  ? "Delivery retrying"
                                  : "Delivery queued"}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          {order.deliveryAttempts} automatic attempt{order.deliveryAttempts === 1 ? "" : "s"}
                          {order.deliveryRetryCount > 0 ? ` · ${order.deliveryRetryCount}/${MAX_MANUAL_DELIVERY_RETRIES} manual reset${order.deliveryRetryCount === 1 ? "" : "s"}` : ""}
                        </div>
                        {order.deliveryLastError && (
                          <div className="max-w-[220px] truncate text-xs text-red-400" title={order.deliveryLastError}>
                            {order.deliveryLastError}
                          </div>
                        )}
                        {order.deliveryLastRetriedAt && (
                          <div className="text-xs text-muted-foreground" title={order.deliveryLastRetriedByEmail || undefined}>
                            Last reset {formatDate(order.deliveryLastRetriedAt)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {order.sentStock ? (
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-green-400 truncate max-w-[150px]">
                            {order.sentStock}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyText(order.sentStock!, "Stock")}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {canRetryDelivery && (
                        <AlertDialog open={retryOrder?.id === order.id} onOpenChange={(open) => !open && setRetryOrder(null)}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mr-2 gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10"
                              onClick={() => setRetryOrder(order)}
                              data-testid={`button-retry-delivery-${order.id}`}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Retry delivery
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Retry order delivery?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This resets the exhausted email delivery for order "{order.orderId}" and starts another bounded attempt window. It does not charge the customer or restore stock. The action will be recorded with your admin identity.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid="button-cancel-retry-delivery">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={(e) => { e.preventDefault(); retryDeliveryMutation.mutate(); }}
                                disabled={retryDeliveryMutation.isPending}
                                data-testid="button-confirm-retry-delivery"
                              >
                                {retryDeliveryMutation.isPending ? "Starting…" : "Start retry"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {order.status === "fulfillment_failed" && deliveryStatus === "exhausted" && !canRetryDelivery && (
                        <span className="mr-2 text-xs text-muted-foreground">Manual retry limit reached</span>
                      )}
                      {canRefund && <Button variant="outline" size="sm" className="mr-2 gap-1" onClick={() => { setRefundOrder(order); setRefundReason(""); }} data-testid={`button-refund-credit-${order.id}`}><WalletCards className="h-3.5 w-3.5" />Refund</Button>}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive h-7 w-7"
                            data-testid={`button-delete-order-${order.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Order</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete order "{order.orderId}"? This will permanently remove it from the database and cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-cancel-delete-order">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(order.id)}
                              disabled={deleteMutation.isPending}
                              className="bg-destructive text-destructive-foreground"
                              data-testid="button-confirm-delete-order"
                            >
                              {deleteMutation.isPending ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <AlertDialog open={!!refundOrder} onOpenChange={(open) => !open && setRefundOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Refund to account credit</AlertDialogTitle><AlertDialogDescription>This returns {refundOrder ? `$${refundOrder.totalAmount.toFixed(2)}` : ""} to the customer’s account balance. Product credentials are not restored. Enter a reason for the audit log.</AlertDialogDescription></AlertDialogHeader>
          <Input placeholder="Refund reason (required)" value={refundReason} onChange={e => setRefundReason(e.target.value)} data-testid="input-refund-reason" />
          <AlertDialogFooter><AlertDialogCancel data-testid="button-cancel-refund">Cancel</AlertDialogCancel><AlertDialogAction onClick={(e) => { e.preventDefault(); refundMutation.mutate(); }} disabled={refundMutation.isPending || !refundReason.trim()} data-testid="button-confirm-refund">{refundMutation.isPending ? "Issuing…" : "Confirm refund"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
