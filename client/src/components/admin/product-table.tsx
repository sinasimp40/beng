import { useState } from "react";
import type { Product, ProductWithVariants } from "@shared/schema";
import { CATEGORIES } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountryFlags } from "@/components/country-flag";
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
import { Package, Pencil, Trash2, Search, Filter, Flame, EyeOff, Eye, X, Link2, Unlink, GitBranch, Copy } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProductTableProps {
  products: ProductWithVariants[];
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
  onDuplicate: (product: Product) => void;
  isDeleting?: boolean;
}

function ProductTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 bg-muted/50 rounded-md animate-pulse"
        >
          <div className="w-12 h-12 bg-muted rounded" />
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

export function ProductTable({
  products,
  onEdit,
  onDelete,
  onDuplicate,
  isDeleting,
}: ProductTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hotFilter, setHotFilter] = useState<string>("all");
  const [linkingParentId, setLinkingParentId] = useState<string | null>(null);
  const { toast } = useToast();

  const filteredProducts = (() => {
    const filtered = products.filter((product) => {
      const matchesSearch = searchQuery === "" || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
      
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "enabled" && product.enabled === 1) ||
        (statusFilter === "disabled" && product.enabled === 0);
      
      const matchesHot = hotFilter === "all" ||
        (hotFilter === "hot" && product.isHot === 1) ||
        (hotFilter === "not_hot" && product.isHot === 0);
      
      return matchesSearch && matchesCategory && matchesStatus && matchesHot;
    });

    const parents = filtered.filter(p => !p.parentId).sort((a, b) => (b.isHot || 0) - (a.isHot || 0));
    const result: typeof filtered = [];
    for (const parent of parents) {
      result.push(parent);
      const children = filtered.filter(p => p.parentId === parent.id);
      result.push(...children);
    }
    const orphanChildren = filtered.filter(p => p.parentId && !parents.some(parent => parent.id === p.parentId));
    result.push(...orphanChildren);
    return result;
  })();

  const categories = CATEGORIES.filter((c) => c !== "All");

  const getParentName = (parentId: string | null) => {
    if (!parentId) return null;
    const parent = products.find(p => p.id === parentId);
    return parent?.name || null;
  };

  const handleLinkVariant = async (childId: string) => {
    if (!linkingParentId) return;
    try {
      await apiRequest("POST", `/api/products/${linkingParentId}/variants`, { childIds: [childId] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products?admin=true"] });
      toast({ title: "Variant linked", description: "Product added as variant" });
      setLinkingParentId(null);
    } catch (e) {
      toast({ title: "Error", description: "Failed to link variant", variant: "destructive" });
    }
  };

  const handleUnlinkVariant = async (childId: string) => {
    const child = products.find(p => p.id === childId);
    if (!child?.parentId) return;
    try {
      await apiRequest("DELETE", `/api/products/${child.parentId}/variants/${childId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products?admin=true"] });
      toast({ title: "Variant unlinked", description: "Product removed from variant group" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to unlink variant", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-products"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-filter-category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]" data-testid="select-filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="enabled">
                <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-emerald-500" /> Enabled</span>
              </SelectItem>
              <SelectItem value="disabled">
                <span className="flex items-center gap-1.5"><EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> Disabled</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={hotFilter} onValueChange={setHotFilter}>
            <SelectTrigger className="w-[130px]" data-testid="select-filter-hot">
              <SelectValue placeholder="Hot" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="hot">
                <span className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-orange-500" /> Hot Only</span>
              </SelectItem>
              <SelectItem value="not_hot">
                <span className="flex items-center gap-1.5">Not Hot</span>
              </SelectItem>
            </SelectContent>
          </Select>
          {(statusFilter !== "all" || hotFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStatusFilter("all"); setHotFilter("all"); }}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              data-testid="button-clear-filters"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {linkingParentId && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-primary/10 border border-primary/20">
          <GitBranch className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm text-primary">
            Click the <Link2 className="w-3.5 h-3.5 inline" /> icon on a product to add it as a variant of <strong>{getParentName(linkingParentId) || 'selected product'}</strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLinkingParentId(null)}
            className="ml-auto text-xs"
            data-testid="button-cancel-linking"
          >
            Cancel
          </Button>
        </div>
      )}

      {filteredProducts.length !== products.length && filteredProducts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {filteredProducts.length} of {products.length} products
        </p>
      )}

      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {products.length === 0 ? "No products yet" : "No matching products"}
          </h3>
          <p className="text-muted-foreground">
            {products.length === 0 
              ? "Create your first product to get started"
              : "Try adjusting your search or filters"
            }
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-card-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Stock</TableHead>
                <TableHead className="hidden lg:table-cell">Countries</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                  <TableCell>
                    <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium ${product.enabled === 0 ? "text-muted-foreground line-through" : "text-foreground"}`}
                          data-testid={`text-table-name-${product.id}`}
                        >
                          {product.name}
                        </span>
                        {product.isHot === 1 && (
                          <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        )}
                        {product.enabled === 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground gap-1">
                            <EyeOff className="w-3 h-3" />
                            Hidden
                          </Badge>
                        )}
                      </div>
                      {product.parentId && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <GitBranch className="w-3 h-3" />
                          <span>Variant of <span className="text-primary font-medium">{getParentName(product.parentId)}</span></span>
                        </div>
                      )}
                      {product.variants && product.variants.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <GitBranch className="w-3 h-3" />
                          <span>{product.variants.length} variant{product.variants.length > 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="secondary">
                      {product.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${product.price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    {product.stock.toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <CountryFlags countries={product.countries || []} size="sm" maxDisplay={4} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {linkingParentId && linkingParentId !== product.id && !product.parentId && !(product.variants && product.variants.length > 0) ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleLinkVariant(product.id)}
                          className="text-primary"
                          title="Link as variant"
                          data-testid={`button-link-variant-${product.id}`}
                        >
                          <Link2 className="w-4 h-4" />
                        </Button>
                      ) : product.parentId ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUnlinkVariant(product.id)}
                          className="text-orange-500"
                          title="Unlink variant"
                          data-testid={`button-unlink-variant-${product.id}`}
                        >
                          <Unlink className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setLinkingParentId(linkingParentId === product.id ? null : product.id)}
                          className={linkingParentId === product.id ? "text-primary bg-primary/10" : "text-muted-foreground"}
                          title={linkingParentId === product.id ? "Cancel linking" : "Add variants to this product"}
                          data-testid={`button-start-link-${product.id}`}
                        >
                          <GitBranch className="w-4 h-4" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDuplicate(product)}
                        className="text-blue-400"
                        title="Duplicate product"
                        data-testid={`button-duplicate-${product.id}`}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(product)}
                        data-testid={`button-edit-${product.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            data-testid={`button-delete-${product.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Product</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{product.name}"? This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-cancel-delete">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDelete(product.id)}
                              disabled={isDeleting}
                              className="bg-destructive text-destructive-foreground"
                              data-testid="button-confirm-delete"
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export { ProductTableSkeleton };
