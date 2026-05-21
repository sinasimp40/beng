import { useState, useMemo, useEffect } from "react";
import type { Product, ProductWithVariants } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CloseWarningDialog } from "@/components/close-warning-dialog";
import { Button } from "@/components/ui/button";
import { CountryFlags } from "@/components/country-flag";
import { Package, Minus, Plus, ShoppingCart, X, Sparkles, Check } from "lucide-react";
import { renderBBCode } from "@/lib/bbcode";

interface ProductDetailModalProps {
  product: ProductWithVariants | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceedToPayment: (product: Product, quantity: number) => void;
}

export function ProductDetailModal({
  product,
  open,
  onOpenChange,
  onProceedToPayment,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const hasVariants = product?.variants && product.variants.length > 0;
  const allOptions = useMemo(() => {
    if (!product) return [];
    if (!hasVariants) return [product];
    return [product, ...product.variants!];
  }, [product, hasVariants]);

  const activeProduct = useMemo(() => {
    if (!product) return null;
    if (!hasVariants) return product;
    if (selectedVariantId) {
      const found = allOptions.find(p => p.id === selectedVariantId);
      return found || product;
    }
    return product;
  }, [product, hasVariants, selectedVariantId, allOptions]);

  useEffect(() => {
    if (open && product) {
      setSelectedVariantId(product.id);
      setQuantity(1);
    }
  }, [open, product?.id]);
  
  const renderedDescription = useMemo(() => {
    return renderBBCode(activeProduct?.description || '');
  }, [activeProduct?.description]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && open) {
      setShowCloseWarning(true);
    } else {
      onOpenChange(newOpen);
    }
  };

  const handleConfirmClose = () => {
    setShowCloseWarning(false);
    setQuantity(1);
    onOpenChange(false);
  };

  const handleCancelClose = () => {
    setShowCloseWarning(false);
  };

  if (!product || !activeProduct) return null;

  const hasImage = activeProduct.imageUrl && activeProduct.imageUrl.length > 0;
  const maxQuantity = Math.min(activeProduct.stock, 100);
  const totalPrice = activeProduct.price * quantity;
  const inStock = activeProduct.stock > 0;

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(maxQuantity, prev + delta)));
  };

  const handleVariantSelect = (variantId: string) => {
    setSelectedVariantId(variantId);
    setQuantity(1);
  };

  const handleProceed = () => {
    onProceedToPayment(activeProduct, quantity);
    setQuantity(1);
  };

  const getOptionLabel = (option: Product) => {
    if (option.category && option.category.trim()) return option.category;
    return option.name;
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-0 bg-white dark:bg-[hsl(0_0%_4%)] border border-gray-200 dark:border-[hsl(0_0%_15%)] gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <button
          onClick={() => handleOpenChange(false)}
          className="absolute right-3 top-3 z-20 p-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/80 transition-colors dark:bg-black/60 dark:text-white/80"
          data-testid="button-close-modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative w-full aspect-[16/10] overflow-hidden">
          {hasImage ? (
            <img
              src={activeProduct.imageUrl!}
              alt={activeProduct.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-[hsl(0_0%_8%)]">
              <Package className="w-16 h-16 text-primary/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[hsl(0_0%_4%)] via-transparent to-transparent" />
          
          <div className="absolute top-3 left-3">
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-md blur opacity-60" />
              <span className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-primary to-purple-600 text-white rounded-md shadow-lg shadow-primary/30">
                <Sparkles className="w-3 h-3" />
                {activeProduct.category}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 -mt-8 relative z-10">
          <h2
            className="text-xl font-bold text-gray-900 dark:text-white mb-3 leading-tight"
            data-testid="text-modal-product-name"
          >
            {product.name}
          </h2>

          {hasVariants && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
                <span className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold">Choose Plan</span>
                <div className="h-px flex-1 bg-gradient-to-l from-primary/30 to-transparent" />
              </div>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(allOptions.length, 3)}, 1fr)` }}>
                {allOptions.map((option) => {
                  const isSelected = option.id === selectedVariantId;
                  const label = getOptionLabel(option);
                  const outOfStock = option.stock === 0;
                  return (
                    <button
                      key={option.id}
                      onClick={() => !outOfStock && handleVariantSelect(option.id)}
                      className={`relative flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg text-center transition-all duration-200 ${
                        outOfStock
                          ? "border border-gray-200/40 dark:border-white/[0.04] bg-gray-50 dark:bg-white/[0.01] cursor-not-allowed"
                          : isSelected
                            ? "border-2 border-primary bg-primary/10 dark:bg-primary/15"
                            : "border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/5 cursor-pointer"
                      }`}
                      data-testid={`button-variant-${option.id}`}
                    >
                      {isSelected && (
                        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-white dark:border-[hsl(0_0%_4%)]">
                          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                        </div>
                      )}
                      <span className={`text-xs font-semibold leading-tight ${
                        outOfStock ? "text-gray-300 dark:text-white/20" : isSelected ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-white/60"
                      }`}>
                        {label}
                      </span>
                      <span className={`text-sm font-bold ${
                        outOfStock ? "text-gray-300 dark:text-white/15" : isSelected ? "text-primary" : "text-gray-500 dark:text-white/40"
                      }`}>
                        ${option.price.toFixed(2)}
                      </span>
                      <span className={`text-[9px] uppercase tracking-wider font-medium ${
                        outOfStock ? "text-red-300 dark:text-red-400/40" : isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-white/25"
                      }`}>
                        {option.stock > 0 ? `${option.stock} in stock` : "out of stock"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div 
            className="text-sm text-gray-500 dark:text-[hsl(0_0%_55%)] mb-4 leading-relaxed max-h-[200px] overflow-y-auto thin-scrollbar [&_img]:max-w-full [&_img]:h-auto [&_img]:max-h-[150px] [&_img]:object-contain [&_img]:mx-auto [&_img]:block [&_img]:my-2 [&_div]:text-inherit"
            dangerouslySetInnerHTML={{ __html: renderedDescription }}
          />

          <div className="flex items-center justify-between py-3 border-y border-gray-200 dark:border-[hsl(0_0%_12%)] mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-[hsl(0_0%_45%)] uppercase tracking-wide font-medium">Available in</span>
              <CountryFlags countries={activeProduct.countries || []} size="sm" maxDisplay={6} />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08]">
                <div className="relative flex items-center justify-center w-2.5 h-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-[modalStockPulse_2s_ease-in-out_infinite]" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </div>
                <span className="text-[10px] text-gray-500 dark:text-[hsl(0_0%_45%)] font-medium">Stock</span>
                <span className="text-[11px] font-semibold text-gray-900 dark:text-white/90" data-testid="text-modal-stock">
                  {activeProduct.stock.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-[hsl(0_0%_9%)] dark:to-[hsl(0_0%_6%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.06),transparent_60%)]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="absolute inset-0 border border-gray-200 dark:border-white/[0.06] rounded-xl pointer-events-none" />
            
            <div className="relative p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-[hsl(0_0%_50%)] font-medium">Quantity</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="bg-gray-100 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.1] text-gray-600 dark:text-white/70"
                    data-testid="button-decrease-quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </Button>
                  <div className="flex items-center justify-center min-w-[3rem] rounded-md bg-gray-100 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.1] min-h-9 px-3">
                    <span className="text-gray-900 dark:text-white font-bold text-sm tabular-nums">
                      {quantity}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= maxQuantity}
                    className="bg-gray-100 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.1] text-gray-600 dark:text-white/70"
                    data-testid="button-increase-quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/[0.08] to-transparent" />

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-[hsl(0_0%_50%)] font-medium">Total</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-primary/60 font-medium">$</span>
                  <span
                    className="text-2xl font-bold text-gray-900 dark:text-white"
                    data-testid="text-total-price"
                  >
                    {totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              <Button
                size="lg"
                onClick={handleProceed}
                disabled={!inStock}
                className="w-full gap-2.5 bg-primary text-white font-bold uppercase tracking-wider text-sm"
                data-testid="button-proceed-to-payment"
              >
                <ShoppingCart className="w-4 h-4" />
                {inStock ? "Buy Now" : "Out of Stock"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <CloseWarningDialog
      open={showCloseWarning}
      onOpenChange={setShowCloseWarning}
      onConfirm={handleConfirmClose}
      onCancel={handleCancelClose}
      title="Leave Product View?"
      description="Are you sure you want to close? Your selected quantity will be reset."
    />

    <style>{`
      @keyframes modalStockPulse {
        0%, 100% { transform: scale(1); opacity: 0.4; }
        50% { transform: scale(2); opacity: 0; }
      }
    `}</style>
    </>
  );
}
