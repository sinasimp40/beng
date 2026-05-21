import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Product, ProductWithVariants, InsertProduct, Order } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useProductUpdates } from "@/hooks/use-product-updates";
import { Header } from "@/components/header";
import { ProductForm } from "@/components/admin/product-form";
import { ProductTable, ProductTableSkeleton } from "@/components/admin/product-table";
import { OrdersTable, OrdersTableSkeleton } from "@/components/admin/orders-table";
import { PaymentSettings } from "@/components/admin/payment-settings";
import { RecaptchaSettings } from "@/components/admin/recaptcha-settings";
import { EmailTemplateEditor } from "@/components/admin/email-template-editor";
import { ForgotPasswordTemplateEditor } from "@/components/admin/forgot-password-template-editor";
import { ShopSettings } from "@/components/admin/shop-settings";
import { SmtpSettings } from "@/components/admin/smtp-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, DollarSign, BarChart3, Settings, ShoppingBag, ClipboardList, CheckCircle2, Clock, Mail, TrendingUp, Calendar, CalendarDays, Users, Database, Loader2, MessageCircle, Download } from "lucide-react";
import { UsersTable } from "@/components/admin/users-table";
import { DatabaseSettings } from "@/components/admin/database-settings";
import { SocialLinksSettings } from "@/components/admin/social-links-settings";
import { ThemeSettings } from "@/components/admin/theme-settings";
import { ReviewsSettings } from "@/components/admin/reviews-settings";
import { UpdateSettings } from "@/components/admin/update-settings";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Palette, Star } from "lucide-react";

type ViewMode = "list" | "create" | "edit";

const adminTabs = [
  { value: "statistics", label: "Statistics", icon: TrendingUp },
  { value: "products", label: "Products", icon: ShoppingBag },
  { value: "orders", label: "Orders", icon: ClipboardList },
  { value: "users", label: "Users", icon: Users },
  { value: "reviews", label: "Reviews", icon: Star },
  { value: "settings", label: "Settings", icon: Settings },
  { value: "theme", label: "Theme", icon: Palette },
  { value: "social", label: "Social", icon: MessageCircle },
  { value: "database", label: "Database", icon: Database },
  { value: "updates", label: "Updates", icon: Download },
];

export default function Admin() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState("statistics");
  const { toast } = useToast();
  const { user, isAdmin, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Enable real-time product updates via WebSocket
  useProductUpdates();

  // Redirect to home if not admin
  useEffect(() => {
    if (!isAuthLoading && (!user || !isAdmin)) {
      setLocation("/");
    }
  }, [user, isAdmin, isAuthLoading, setLocation]);

  // Only enable queries after auth is resolved AND user is admin
  const canFetchData = !isAuthLoading && isAdmin;

  const { data: products = [], isLoading } = useQuery<ProductWithVariants[]>({
    queryKey: ["/api/products?admin=true"],
    enabled: canFetchData,
  });

  const { data: orders = [], isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    refetchInterval: 3000, // Poll every 3 seconds for near real-time updates
    enabled: canFetchData,
  });

  const invalidateProducts = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    queryClient.invalidateQueries({ queryKey: ["/api/products?admin=true"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      return apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      invalidateProducts();
      toast({
        title: "Product created",
        description: "The product has been created successfully",
      });
      setViewMode("list");
      setEditingProduct(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertProduct }) => {
      return apiRequest("PATCH", `/api/products/${id}`, data);
    },
    onSuccess: () => {
      invalidateProducts();
      toast({
        title: "Product updated",
        description: "The product has been updated successfully",
      });
      setViewMode("list");
      setEditingProduct(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      invalidateProducts();
      toast({
        title: "Product deleted",
        description: "The product has been deleted successfully",
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

  // After auth is resolved, if not admin, show nothing (redirect will happen in useEffect)
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setViewMode("edit");
  };

  const handleDuplicate = (product: Product) => {
    const duplicated = {
      ...product,
      id: "",
      name: `${product.name} (Copy)`,
      parentId: null,
    } as Product;
    if ("variants" in duplicated) {
      (duplicated as any).variants = undefined;
    }
    setEditingProduct(duplicated);
    setViewMode("create");
  };

  const handleSubmit = (data: InsertProduct) => {
    if (viewMode === "edit" && editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    setViewMode("list");
    setEditingProduct(null);
  };

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);

  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "confirming").length;
  const completedOrders = orders.filter((o) => o.status === "completed").length;

  // Sales statistics calculations
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const completedOrdersList = orders.filter((o) => o.status === "completed");
  
  const salesToday = completedOrdersList.filter((o) => {
    const orderDate = new Date(o.createdAt || 0);
    return orderDate >= startOfToday;
  });
  
  const salesThisWeek = completedOrdersList.filter((o) => {
    const orderDate = new Date(o.createdAt || 0);
    return orderDate >= startOfWeek;
  });
  
  const salesThisMonth = completedOrdersList.filter((o) => {
    const orderDate = new Date(o.createdAt || 0);
    return orderDate >= startOfMonth;
  });

  const revenueTodayAmount = salesToday.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const revenueWeekAmount = salesThisWeek.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const revenueMonthAmount = salesThisMonth.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  // Generate chart data for last 7 days
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfToday);
    date.setDate(date.getDate() - (6 - i));
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    
    const daySales = completedOrdersList.filter((o) => {
      const orderDate = new Date(o.createdAt || 0);
      return orderDate >= dayStart && orderDate < dayEnd;
    });
    
    const dayRevenue = daySales.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    
    return {
      name: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sales: daySales.length,
      revenue: dayRevenue,
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <Header searchQuery="" onSearchChange={() => {}} showSearch={false} />

      <main className="container mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground">
                Manage your products and settings
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Mobile: Dropdown selector */}
            <div className="sm:hidden mb-4">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="w-full" data-testid="select-admin-tab-mobile">
                  <SelectValue>
                    {(() => {
                      const tab = adminTabs.find(t => t.value === activeTab);
                      if (!tab) return null;
                      const Icon = tab.icon;
                      return (
                        <span className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {tab.label}
                        </span>
                      );
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {adminTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <SelectItem key={tab.value} value={tab.value} data-testid={`select-item-${tab.value}`}>
                        <span className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {tab.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Desktop: Regular tabs */}
            <div className="hidden sm:block mb-4">
              <TabsList className="inline-flex gap-1 p-1 bg-muted/50">
                {adminTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger 
                      key={tab.value}
                      value={tab.value} 
                      className="gap-2 px-3 py-1.5 text-sm data-[state=active]:bg-background" 
                      data-testid={`tab-${tab.value}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {tab.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <TabsContent value="statistics">
              <div className="flex flex-col gap-6">
                {/* Sales Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="bg-card border-card-border overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-2xl" />
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Sales Today
                      </CardTitle>
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Calendar className="w-4 h-4 text-primary" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-foreground" data-testid="stat-sales-today">
                        {salesToday.length}
                      </div>
                      <p className="text-sm text-primary mt-1">
                        ${revenueTodayAmount.toFixed(2)} revenue
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-card-border overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-2xl" />
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Sales This Week
                      </CardTitle>
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <CalendarDays className="w-4 h-4 text-green-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-foreground" data-testid="stat-sales-week">
                        {salesThisWeek.length}
                      </div>
                      <p className="text-sm text-green-400 mt-1">
                        ${revenueWeekAmount.toFixed(2)} revenue
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-card-border overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl" />
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Sales This Month
                      </CardTitle>
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        <BarChart3 className="w-4 h-4 text-purple-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-foreground" data-testid="stat-sales-month">
                        {salesThisMonth.length}
                      </div>
                      <p className="text-sm text-purple-400 mt-1">
                        ${revenueMonthAmount.toFixed(2)} revenue
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-card border-card-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Revenue (Last 7 Days)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis 
                              dataKey="name" 
                              stroke="#6b7280"
                              tick={{ fill: '#9ca3af', fontSize: 12 }}
                            />
                            <YAxis 
                              stroke="#6b7280"
                              tick={{ fill: '#9ca3af', fontSize: 12 }}
                              tickFormatter={(value) => `$${value}`}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#1f2937', 
                                border: '1px solid #374151',
                                borderRadius: '8px',
                                color: '#fff'
                              }}
                              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                              labelFormatter={(label) => chartData.find(d => d.name === label)?.date || label}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="revenue" 
                              stroke="hsl(var(--primary))" 
                              strokeWidth={2}
                              fillOpacity={1} 
                              fill="url(#colorRevenue)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-card-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-green-400" />
                        Orders (Last 7 Days)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis 
                              dataKey="name" 
                              stroke="#6b7280"
                              tick={{ fill: '#9ca3af', fontSize: 12 }}
                            />
                            <YAxis 
                              stroke="#6b7280"
                              tick={{ fill: '#9ca3af', fontSize: 12 }}
                              allowDecimals={false}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#1f2937', 
                                border: '1px solid #374151',
                                borderRadius: '8px',
                                color: '#fff'
                              }}
                              formatter={(value: number) => [value, 'Orders']}
                              labelFormatter={(label) => chartData.find(d => d.name === label)?.date || label}
                            />
                            <Bar 
                              dataKey="sales" 
                              fill="#22c55e" 
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Card className="bg-card border-card-border">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{totalProducts}</p>
                        <p className="text-sm text-muted-foreground mt-1">Total Products</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-card-border">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{totalStock.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground mt-1">Total Stock</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-card-border">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-400">{pendingOrders}</p>
                        <p className="text-sm text-muted-foreground mt-1">Pending Orders</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-card-border">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-400">{completedOrders}</p>
                        <p className="text-sm text-muted-foreground mt-1">Completed Orders</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="products">
              <div className="flex flex-col gap-6">
                {viewMode === "list" && (
                  <>
                    <div className="flex justify-end">
                      <Button
                        onClick={() => setViewMode("create")}
                        className="gap-2"
                        data-testid="button-add-product"
                      >
                        <Plus className="w-4 h-4" />
                        Add Product
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Card className="bg-card border-card-border">
                        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Products
                          </CardTitle>
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div
                            className="text-2xl font-bold text-foreground"
                            data-testid="stat-total-products"
                          >
                            {totalProducts}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-card border-card-border">
                        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Stock
                          </CardTitle>
                          <BarChart3 className="w-4 h-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div
                            className="text-2xl font-bold text-foreground"
                            data-testid="stat-total-stock"
                          >
                            {totalStock.toLocaleString()}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-card border-card-border">
                        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Inventory Value
                          </CardTitle>
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div
                            className="text-2xl font-bold text-foreground"
                            data-testid="stat-inventory-value"
                          >
                            ${totalValue.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="bg-card border-card-border">
                      <CardHeader>
                        <CardTitle>Products</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {isLoading ? (
                          <ProductTableSkeleton />
                        ) : (
                          <ProductTable
                            products={products}
                            onEdit={handleEdit}
                            onDelete={(id) => deleteMutation.mutate(id)}
                            onDuplicate={handleDuplicate}
                            isDeleting={deleteMutation.isPending}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}

                {(viewMode === "create" || viewMode === "edit") && (
                  <Card className="bg-card border-card-border">
                    <CardHeader>
                      <CardTitle>
                        {viewMode === "create" ? "Create New Product" : "Edit Product"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ProductForm
                        product={editingProduct || undefined}
                        onSubmit={handleSubmit}
                        onCancel={handleCancel}
                        isSubmitting={
                          createMutation.isPending || updateMutation.isPending
                        }
                        isCreate={viewMode === "create"}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="orders">
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="bg-card border-card-border">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Orders
                      </CardTitle>
                      <ClipboardList className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">
                        {totalOrders}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-card-border">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Pending
                      </CardTitle>
                      <Clock className="w-4 h-4 text-yellow-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-yellow-400">
                        {pendingOrders}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-card-border">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Completed
                      </CardTitle>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-400">
                        {completedOrders}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-card border-card-border">
                  <CardHeader>
                    <CardTitle>Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingOrders ? (
                      <OrdersTableSkeleton />
                    ) : (
                      <OrdersTable orders={orders} />
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="users">
              <UsersTable />
            </TabsContent>

            <TabsContent value="reviews">
              <ReviewsSettings />
            </TabsContent>

            <TabsContent value="settings">
              <div className="space-y-6">
                <ShopSettings />
                <PaymentSettings />
                <SmtpSettings />
                <RecaptchaSettings />
                <EmailTemplateEditor />
                <ForgotPasswordTemplateEditor />
              </div>
            </TabsContent>

            <TabsContent value="email">
              <div className="space-y-6">
                <EmailTemplateEditor />
                <ForgotPasswordTemplateEditor />
              </div>
            </TabsContent>

            <TabsContent value="theme">
              <ThemeSettings />
            </TabsContent>

            <TabsContent value="social">
              <SocialLinksSettings />
            </TabsContent>

            <TabsContent value="database">
              <DatabaseSettings />
            </TabsContent>

            <TabsContent value="updates">
              <UpdateSettings />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
