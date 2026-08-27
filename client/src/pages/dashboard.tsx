import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { User, Package, ShoppingBag, LogOut, ArrowLeft, Search, Filter, Eye, EyeOff, Copy, Check, Key, AlertTriangle, Loader2, ChevronRight } from "lucide-react";
import { useOrderUpdates } from "@/hooks/use-order-updates";
import { useToast } from "@/hooks/use-toast";
import { PaymentModal } from "@/components/payment-modal";
import { CreditTopup } from "@/components/credit-topup";
import { useCreditUpdates } from "@/hooks/use-credit-updates";
import type { Order, OrderItem } from "@shared/schema";

type DashboardOrder = Order & { items?: OrderItem[] };

export default function Dashboard() {
  const { user, token, logout, isAdmin, sessionInvalidated, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [visibleStock, setVisibleStock] = useState<Record<string, boolean>>({});
  const [copiedStock, setCopiedStock] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<DashboardOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();
  useCreditUpdates();

  // Handle session invalidation
  useEffect(() => {
    if (sessionInvalidated) {
      toast({
        title: "Session Ended",
        description: "You've been logged out because you signed in from another device.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [sessionInvalidated, setLocation, toast]);

  // Redirect to home if not logged in
  useEffect(() => {
    if (!isAuthLoading && !user) {
      setLocation("/");
    }
  }, [user, isAuthLoading, setLocation]);

  const toggleStockVisibility = (orderId: string) => {
    setVisibleStock(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const copyStock = async (orderId: string, stock: string) => {
    await navigator.clipboard.writeText(stock);
    setCopiedStock(orderId);
    setTimeout(() => setCopiedStock(null), 2000);
  };

  useOrderUpdates(user?.email);

  const { data: orders, isLoading } = useQuery<DashboardOrder[]>({
    queryKey: ["/api/auth/orders"],
    queryFn: async () => {
      const response = await fetch("/api/auth/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const text = await response.text();
        const { parseErrorMessage } = await import("@/lib/queryClient");
        throw new Error(parseErrorMessage(text, "Failed to fetch orders"));
      }
      return response.json();
    },
    enabled: !!token,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (selectedOrder && orders) {
      const updated = orders.find(o => o.id === selectedOrder.id);
      if (updated && (
        updated.status !== selectedOrder.status ||
        updated.sentStock !== selectedOrder.sentStock ||
        updated.payAddress !== selectedOrder.payAddress ||
        updated.payAmount !== selectedOrder.payAmount ||
        updated.payCurrency !== selectedOrder.payCurrency
      )) {
        setSelectedOrder(updated);
      }
    }
  }, [orders, selectedOrder]);

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to change password");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
      });
      setShowPasswordDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) => {
      const productName = order.productName || "";
      const lineNames = order.items?.map(item => item.productName).join(" ") || "";
      const orderId = order.orderId || "";
      const matchesSearch = 
        productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lineNames.toLowerCase().includes(searchQuery.toLowerCase()) ||
        orderId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const [checkingStock, setCheckingStock] = useState<string | null>(null);

  const handleOrderClick = async (order: DashboardOrder) => {
    const noPayStatuses = ["expired", "refunded"];
    if (noPayStatuses.includes(order.status)) {
      setSelectedOrder(order);
      setShowOrderModal(true);
      return;
    }

    const checkableStatuses = ["waiting", "pending", "new"];
    if (checkableStatuses.includes(order.status) && !order.sentStock) {
      setCheckingStock(order.id);
      try {
        const res = await fetch(`/api/products/${order.productId}`);
        if (!res.ok) {
          toast({
            title: "Product Unavailable",
            description: "This product no longer exists. Payment is not available.",
            variant: "destructive",
          });
          setCheckingStock(null);
          return;
        }
        const product = await res.json();
        const availableStock = product.stock ?? 0;
        if (availableStock < order.quantity) {
          toast({
            title: "Out of Stock",
            description: availableStock === 0
              ? "This product is currently out of stock. Payment is not available."
              : `Only ${availableStock} item(s) in stock, but your order requires ${order.quantity}.`,
            variant: "destructive",
          });
          setCheckingStock(null);
          return;
        }
      } catch {
      }
      setCheckingStock(null);
    }
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  // Show loading state while checking authentication
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // After auth is resolved, if not logged in, show nothing (redirect will happen in useEffect)
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "finished":
      case "completed":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "pending":
      case "waiting":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "confirming":
      case "sending":
      case "partially_paid":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "failed":
      case "expired":
      case "refunded":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      waiting: "Waiting for Payment",
      pending: "Pending",
      confirming: "Confirming",
      sending: "Sending",
      partially_paid: "Partially Paid",
      finished: "Completed",
      completed: "Completed",
      failed: "Failed",
      expired: "Expired",
      refunded: "Refunded",
    };
    return labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header searchQuery="" onSearchChange={() => {}} showSearch={false} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          className="mb-6 gap-2"
          onClick={() => setLocation("/")}
          data-testid="button-back-shop"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Shop
        </Button>

        <div className="grid gap-6">
          <Card className="border-primary/20">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg sm:text-xl truncate">{user.email}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="outline" className={isAdmin ? "border-primary text-primary" : ""}>
                      {isAdmin ? "Admin" : "User"}
                    </Badge>
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      Member since {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowPasswordDialog(true)} className="gap-2" data-testid="button-change-password">
                  <Key className="w-4 h-4" />
                  Change Password
                </Button>
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => setLocation("/admin")} data-testid="button-admin-panel">
                    Admin Panel
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2" data-testid="button-logout">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </div>
            </CardHeader>
          </Card>

          <CreditTopup />

          <Card className="border-primary/20">
            <CardHeader className="flex flex-col gap-4 pb-4">
              <div className="flex flex-row items-center gap-2 flex-wrap">
                <ShoppingBag className="w-5 h-5 text-primary" />
                <CardTitle>Purchase History</CardTitle>
                <Badge variant="outline" className="ml-auto">
                  {orders ? `${filteredOrders.length} of ${orders.length}` : "0"}
                </Badge>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by product or order ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-orders"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status-filter">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirming">Confirming</SelectItem>
                    <SelectItem value="sending">Sending</SelectItem>
                    <SelectItem value="partially_paid">Partially Paid</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="finished">Finished</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : filteredOrders.length > 0 ? (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-4 rounded-md bg-muted/50 border border-border hover:border-primary/30 hover:bg-muted/80 transition-colors cursor-pointer group"
                      data-testid={`order-item-${order.id}`}
                      onClick={() => handleOrderClick(order)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                            <Package className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            {order.items && order.items.length > 1 ? (
                              <div className="space-y-0.5">
                                {order.items.map(item => (
                                  <p key={item.id} className="font-medium truncate">
                                    {item.productName} <span className="text-primary text-sm">×{item.quantity}</span>
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="font-medium">{order.productName}</p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              Order: {order.orderId}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString()} at{" "}
                              {new Date(order.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col sm:items-end gap-2">
                            <Badge className={getStatusColor(order.status)}>
                              {getStatusLabel(order.status)}
                            </Badge>
                            <span className="font-semibold text-primary">
                              ${order.totalAmount.toFixed(2)}
                            </span>
                          </div>
                          {checkingStock === order.id ? (
                            <Loader2 className="w-4 h-4 text-primary animate-spin hidden sm:block" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                          )}
                        </div>
                      </div>
                      {order.sentStock && (order.status === "completed" || order.status === "finished") && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-sm font-medium text-green-400">Your Purchased Items:</span>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); toggleStockVisibility(order.id); }}
                                data-testid={`button-toggle-stock-${order.id}`}
                              >
                                {visibleStock[order.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); copyStock(order.id, order.sentStock!); }}
                                data-testid={`button-copy-stock-${order.id}`}
                              >
                                {copiedStock === order.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                          <div className="bg-background/50 rounded-md p-3 font-mono text-sm whitespace-pre-wrap break-all">
                            {visibleStock[order.id] ? order.sentStock : "••••••••••••••••"}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : orders && orders.length > 0 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No orders match your search</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                    data-testid="button-clear-filters"
                  >
                    Clear Filters
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No purchases yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setLocation("/")}
                    data-testid="button-browse-products"
                  >
                    Browse Products
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PaymentModal
        product={null}
        quantity={1}
        open={showOrderModal}
        onOpenChange={(open) => {
          setShowOrderModal(open);
          if (!open) setSelectedOrder(null);
        }}
        onPaymentComplete={() => {}}
        existingOrder={selectedOrder ? {
          orderId: selectedOrder.orderId,
          productName: selectedOrder.productName || "",
          totalAmount: selectedOrder.totalAmount,
          quantity: selectedOrder.quantity,
          status: selectedOrder.status,
          paymentId: selectedOrder.paymentId,
          payAddress: selectedOrder.payAddress,
          payCurrency: selectedOrder.payCurrency,
          payAmount: selectedOrder.payAmount,
          sentStock: selectedOrder.sentStock,
          email: selectedOrder.email,
          items: selectedOrder.items?.map(item => ({
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        } : null}
      />

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Change Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                data-testid="input-current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                data-testid="input-confirm-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)} data-testid="button-cancel-password">
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={changePasswordMutation.isPending} data-testid="button-save-password">
              {changePasswordMutation.isPending ? "Saving..." : "Save Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
