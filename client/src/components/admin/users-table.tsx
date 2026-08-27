import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useOrderUpdates } from "@/hooks/use-order-updates";
import { Search, Users, Eye, Package, Globe, Calendar, Ban, Key, Mail, MoreHorizontal, CheckCircle, Trash2, WalletCards } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Order, SafeUser } from "@shared/schema";

interface AdminUser {
  email: string;
  orderCount: number;
  totalSpent: number;
  lastOrder: string;
  ips: string[];
}

export function UsersTable() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [editDialog, setEditDialog] = useState<"password" | "email" | "ban" | "delete" | "credit" | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const creditIdempotencyRef = useRef<string | null>(null);

  // WebSocket for real-time order updates
  useOrderUpdates({ isAdmin: true });

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    refetchInterval: 3000,
  });

  const { data: registeredUsers = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/admin/registered-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/registered-users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        const { parseErrorMessage } = await import("@/lib/queryClient");
        throw new Error(parseErrorMessage(text, "Failed to fetch registered users"));
      }
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 5000,
  });

  const { data: userOrders = [], isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ["/api/admin/users", selectedUser, "orders"],
    queryFn: async () => {
      if (!selectedUser) return [];
      const res = await fetch(`/api/admin/users/${encodeURIComponent(selectedUser)}/orders`);
      if (!res.ok) {
        const text = await res.text();
        const { parseErrorMessage } = await import("@/lib/queryClient");
        throw new Error(parseErrorMessage(text, "Failed to fetch orders"));
      }
      return res.json();
    },
    enabled: !!selectedUser,
    refetchInterval: 3000,
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: string; updates: { email?: string; newPassword?: string; banned?: boolean } }) => {
      const res = await fetch(`/api/admin/users/${data.userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data.updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: variables.updates.banned !== undefined
          ? (variables.updates.banned ? "User has been banned" : "User has been unbanned")
          : variables.updates.newPassword
          ? "Password updated successfully"
          : "Email updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/registered-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditDialog(null);
      setEditingUser(null);
      setNewPassword("");
      setNewEmail("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  const creditMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) throw new Error("Select a user");
      const amount = Number(creditAmount);
      if (!Number.isInteger(amount) || amount === 0) throw new Error("Enter a non-zero whole number of cents");
      if (!creditReason.trim()) throw new Error("A reason is required");
      const idempotencyKey = creditIdempotencyRef.current ||= crypto.randomUUID();
      const res = await fetch(`/api/admin/users/${editingUser.id}/credit`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Idempotency-Key": idempotencyKey }, credentials: "include", body: JSON.stringify({ amountCents: amount, reason: creditReason.trim() }) });
      if (!res.ok) throw new Error((await res.json()).error || "Balance adjustment failed");
      return res.json();
    },
    onSuccess: async () => { toast({ title: "Balance adjusted", description: "The credit ledger has been updated." }); await queryClient.refetchQueries({ queryKey: ["/api/admin/registered-users"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/credit-transactions"] }); creditIdempotencyRef.current = null; setEditDialog(null); setEditingUser(null); setCreditAmount(""); setCreditReason(""); },
    onError: (e: Error) => toast({ title: "Adjustment failed", description: e.message, variant: "destructive" }),
  });

  const getRegisteredUser = (email: string): SafeUser | undefined => {
    return registeredUsers.find(u => u.email === email);
  };

  const handleBanUser = (user: SafeUser) => {
    setEditingUser(user);
    setEditDialog("ban");
  };

  const handleChangePassword = (user: SafeUser) => {
    setEditingUser(user);
    setNewPassword("");
    setEditDialog("password");
  };

  const handleChangeEmail = (user: SafeUser) => {
    setEditingUser(user);
    setNewEmail(user.email);
    setEditDialog("email");
  };

  const confirmBan = () => {
    if (!editingUser) return;
    updateUserMutation.mutate({
      userId: editingUser.id,
      updates: { banned: editingUser.banned === 0 },
    });
  };

  const confirmPasswordChange = () => {
    if (!editingUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }
    updateUserMutation.mutate({
      userId: editingUser.id,
      updates: { newPassword },
    });
  };

  const confirmEmailChange = () => {
    if (!editingUser || !newEmail) return;
    if (!newEmail.includes("@")) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }
    updateUserMutation.mutate({
      userId: editingUser.id,
      updates: { email: newEmail },
    });
  };

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete user");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "User Deleted",
        description: `User and ${data.deletedOrders} order(s) have been removed.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/registered-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setEditDialog(null);
      setEditingUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteUser = (user: SafeUser) => {
    setEditingUser(user);
    setEditDialog("delete");
  };

  const confirmDeleteUser = () => {
    if (!editingUser) return;
    deleteUserMutation.mutate(editingUser.id);
  };

  const [guestToDelete, setGuestToDelete] = useState<string | null>(null);

  const deleteGuestMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch(`/api/admin/guest-users/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete guest user");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Guest Deleted",
        description: `${data.deletedOrders} order(s) have been removed.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setGuestToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteGuest = (email: string) => {
    setGuestToDelete(email);
  };

  const confirmDeleteGuest = () => {
    if (!guestToDelete) return;
    deleteGuestMutation.mutate(guestToDelete);
  };

  // Merge order-based users with registered users
  const mergedUsers = useMemo(() => {
    const userMap = new Map<string, AdminUser>();
    
    // First add all users from orders
    users.forEach(u => {
      userMap.set(u.email, u);
    });
    
    // Then add registered users who haven't placed orders
    registeredUsers.forEach(ru => {
      if (!userMap.has(ru.email)) {
        userMap.set(ru.email, {
          email: ru.email,
          orderCount: 0,
          totalSpent: 0,
          lastOrder: ru.createdAt || "",
          ips: [],
        });
      }
    });
    
    return Array.from(userMap.values());
  }, [users, registeredUsers]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return mergedUsers;
    const q = searchQuery.toLowerCase();
    return mergedUsers.filter(u => 
      u.email.toLowerCase().includes(q) || 
      u.ips.some(ip => ip.includes(q))
    );
  }, [mergedUsers, searchQuery]);

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
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (isLoading) {
    return <UsersTableSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or IP address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>
        <Badge variant="outline" className="gap-1">
          <Users className="w-3 h-3" />
          {filteredUsers.length} users
        </Badge>
      </div>

      {/* Mobile: Card-based layout */}
      <div className="sm:hidden space-y-3">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              No users found
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((user) => {
            const registeredUser = getRegisteredUser(user.email);
            return (
              <Card key={user.email} data-testid={`card-user-${user.email}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {registeredUser ? (
                          registeredUser.banned === 1 ? (
                            <Badge variant="destructive" className="gap-1 text-xs">
                              <Ban className="w-3 h-3" />
                              Banned
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 border-green-500/30 text-green-400 text-xs">
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </Badge>
                          )
                        ) : (
                          <Badge variant="secondary" className="text-xs">Guest</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedUser(user.email)}
                        data-testid={`button-view-user-mobile-${user.email}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {registeredUser && <Button size="icon" variant="ghost" title="Adjust balance" onClick={() => { creditIdempotencyRef.current = null; setEditingUser(registeredUser); setCreditAmount(""); setCreditReason(""); setEditDialog("credit"); }} data-testid={`button-adjust-credit-${registeredUser.id}`}><WalletCards className="w-4 h-4" /></Button>}
                      {registeredUser ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`button-manage-user-mobile-${user.email}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleBanUser(registeredUser)}>
                              <Ban className="w-4 h-4 mr-2" />
                              {registeredUser.banned === 1 ? "Unban User" : "Ban User"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleChangePassword(registeredUser)}>
                              <Key className="w-4 h-4 mr-2" />
                              Change Password
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleChangeEmail(registeredUser)}>
                              <Mail className="w-4 h-4 mr-2" />
                              Change Email
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteUser(registeredUser)} className="text-red-500 focus:text-red-500">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDeleteGuest(user.email)}
                          data-testid={`button-delete-guest-mobile-${user.email}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Orders</span>
                      <p className="font-medium">{user.orderCount}</p>
                    </div>
                      <div>
                      <span className="text-muted-foreground text-xs">Total Spent</span>
                      <p className="font-semibold text-primary">${user.totalSpent.toFixed(2)}</p>
                    </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Credit balance</span>
                        <p className="font-semibold">${((registeredUser?.creditBalanceCents || 0) / 100).toFixed(2)}</p>
                      </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Last Order</span>
                      <p>{new Date(user.lastOrder).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">IPs</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {user.ips.slice(0, 1).map((ip) => (
                          <span key={ip} className="text-xs font-mono text-muted-foreground">{ip}</span>
                        ))}
                        {user.ips.length > 1 && (
                          <span className="text-xs text-muted-foreground">+{user.ips.length - 1} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop: Table layout */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 font-medium text-muted-foreground">Email</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Orders</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Total Spent</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Credit</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden lg:table-cell">Last Order</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden xl:table-cell">IPs</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const registeredUser = getRegisteredUser(user.email);
                  return (
                    <tr key={user.email} className="border-b border-border last:border-0" data-testid={`row-user-${user.email}`}>
                      <td className="p-4 font-medium">{user.email}</td>
                      <td className="p-4">
                        {registeredUser ? (
                          registeredUser.banned === 1 ? (
                            <Badge variant="destructive" className="gap-1">
                              <Ban className="w-3 h-3" />
                              Banned
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 border-green-500/30 text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </Badge>
                          )
                        ) : (
                          <Badge variant="secondary">Guest</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary">{user.orderCount}</Badge>
                      </td>
                      <td className="p-4 text-primary font-semibold">${user.totalSpent.toFixed(2)}</td>
                      <td className="p-4 font-semibold" data-testid={`credit-balance-${registeredUser?.id || user.email}`}>
                        ${((registeredUser?.creditBalanceCents || 0) / 100).toFixed(2)}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground hidden lg:table-cell">
                        {new Date(user.lastOrder).toLocaleDateString()}
                      </td>
                      <td className="p-4 hidden xl:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {user.ips.slice(0, 2).map((ip) => (
                            <Badge key={ip} variant="outline" className="text-xs font-mono">
                              {ip}
                            </Badge>
                          ))}
                          {user.ips.length > 2 && (
                            <Badge variant="outline" className="text-xs">+{user.ips.length - 2}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedUser(user.email)}
                            data-testid={`button-view-user-${user.email}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Orders
                          </Button>
                          {registeredUser ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" data-testid={`button-manage-user-${user.email}`}>
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { creditIdempotencyRef.current = null; setEditingUser(registeredUser); setCreditAmount(""); setCreditReason(""); setEditDialog("credit"); }}><WalletCards className="w-4 h-4 mr-2" />Adjust balance</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleBanUser(registeredUser)} data-testid={`menu-ban-${user.email}`}>
                                  <Ban className="w-4 h-4 mr-2" />
                                  {registeredUser.banned === 1 ? "Unban User" : "Ban User"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleChangePassword(registeredUser)} data-testid={`menu-password-${user.email}`}>
                                  <Key className="w-4 h-4 mr-2" />
                                  Change Password
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleChangeEmail(registeredUser)} data-testid={`menu-email-${user.email}`}>
                                  <Mail className="w-4 h-4 mr-2" />
                                  Change Email
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteUser(registeredUser)} className="text-red-500 focus:text-red-500" data-testid={`menu-delete-${user.email}`}>
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleDeleteGuest(user.email)}
                              title="Delete guest and orders"
                              data-testid={`button-delete-guest-${user.email}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Orders for {selectedUser}
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingOrders ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : userOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              No orders found
            </div>
          ) : (
            <div className="space-y-3">
              {userOrders.map((order) => (
                <Card key={order.id} data-testid={`order-detail-${order.orderId}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{order.productName}</p>
                          <p className="text-sm text-muted-foreground font-mono">{order.orderId}</p>
                        </div>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Amount:</span>
                          <p className="font-semibold text-primary">${order.totalAmount.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />Date:
                          </span>
                          <p>{new Date(order.createdAt).toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Globe className="w-3 h-3" />IP Address:
                          </span>
                          <p className="font-mono text-xs">{order.ipAddress || "Unknown"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Currency:</span>
                          <p>{order.payCurrency?.toUpperCase() || "N/A"}</p>
                        </div>
                      </div>
                      {order.sentStock && (
                        <div className="pt-2 border-t border-border">
                          <span className="text-sm text-muted-foreground">Stock Sent:</span>
                          <p className="text-xs font-mono bg-muted/50 p-2 rounded mt-1 whitespace-pre-wrap break-all">
                            {order.sentStock}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog === "credit"} onOpenChange={(open) => { if (!open) { creditIdempotencyRef.current = null; setEditDialog(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><WalletCards className="w-5 h-5 text-primary" />Adjust account credit</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Adjusting <span className="font-medium text-foreground">{editingUser?.email}</span>. Enter cents as a signed integer.</p>
            <div className="space-y-2"><Label htmlFor="credit-adjustment">Amount in cents</Label><Input id="credit-adjustment" type="number" step="1" placeholder="e.g. 2500 or -500" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} data-testid="input-credit-adjustment" /></div>
            <div className="space-y-2"><Label htmlFor="credit-reason">Reason</Label><Input id="credit-reason" placeholder="Required audit note" value={creditReason} onChange={e => setCreditReason(e.target.value)} data-testid="input-credit-reason" /></div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">This changes the customer’s spendable balance immediately and is recorded in the ledger.</div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { creditIdempotencyRef.current = null; setEditDialog(null); }} data-testid="button-cancel-credit-adjustment">Cancel</Button><Button onClick={() => creditMutation.mutate()} disabled={creditMutation.isPending} data-testid="button-confirm-credit-adjustment">{creditMutation.isPending ? "Saving…" : "Confirm adjustment"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog === "ban"} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5" />
              {editingUser?.banned === 1 ? "Unban User" : "Ban User"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {editingUser?.banned === 1
              ? `Are you sure you want to unban ${editingUser?.email}? They will be able to log in again.`
              : `Are you sure you want to ban ${editingUser?.email}? They will be logged out immediately and unable to log in.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)} data-testid="button-cancel-ban">Cancel</Button>
            <Button
              variant={editingUser?.banned === 1 ? "default" : "destructive"}
              onClick={confirmBan}
              disabled={updateUserMutation.isPending}
              data-testid="button-confirm-ban"
            >
              {updateUserMutation.isPending ? "Processing..." : editingUser?.banned === 1 ? "Unban User" : "Ban User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog === "password"} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Change Password for {editingUser?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-new-password">New Password</Label>
              <Input
                id="admin-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                data-testid="input-admin-new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)} data-testid="button-cancel-password-admin">Cancel</Button>
            <Button onClick={confirmPasswordChange} disabled={updateUserMutation.isPending || !newPassword} data-testid="button-confirm-password-admin">
              {updateUserMutation.isPending ? "Saving..." : "Change Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog === "email"} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Change Email for {editingUser?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-new-email">New Email</Label>
              <Input
                id="admin-new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email address"
                data-testid="input-admin-new-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)} data-testid="button-cancel-email-admin">Cancel</Button>
            <Button onClick={confirmEmailChange} disabled={updateUserMutation.isPending || !newEmail} data-testid="button-confirm-email-admin">
              {updateUserMutation.isPending ? "Saving..." : "Change Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog === "delete"} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Trash2 className="w-5 h-5" />
              Delete User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to permanently delete <span className="font-medium text-foreground">{editingUser?.email}</span>?
            </p>
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-sm text-red-500">
              This will permanently remove the user account and all their orders from the database. This action cannot be undone.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)} data-testid="button-cancel-delete">Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteUser}
              disabled={deleteUserMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!guestToDelete} onOpenChange={(open) => !open && setGuestToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Trash2 className="w-5 h-5" />
              Delete Guest User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to permanently delete all orders for <span className="font-medium text-foreground">{guestToDelete}</span>?
            </p>
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-sm text-red-500">
              This will permanently remove all orders associated with this guest email from the database. This action cannot be undone.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGuestToDelete(null)} data-testid="button-cancel-delete-guest">Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteGuest}
              disabled={deleteGuestMutation.isPending}
              data-testid="button-confirm-delete-guest"
            >
              {deleteGuestMutation.isPending ? "Deleting..." : "Delete Guest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function UsersTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full max-w-md" />
      <Card>
        <CardContent className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    </div>
  );
}
