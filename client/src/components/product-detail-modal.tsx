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
  onAddToCart: (product: Product, quantity: number, variantLabel?: string) => void;
}

export function ProductDetailModal({
  product,
  open,
  onOpenChange,
  onProceedToPayment,
  onAddToCart,
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
      const firstInStockOption = allOptions.find(option => option.stock > 0);
      setSelectedVariantId(product.stock > 0 ? product.id : firstInStockOption?.id ?? product.id);
      setQuantity(1);
    }
  }, [open, product?.id, allOptions]);
  
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

  const handleAddToCart = () => {
    onAddToCart(activeProduct, quantity, hasVariants ? product.variantGroupTitle?.trim() || undefined : undefined);
    setQuantity(1);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-0 bg-white dark:bg-[hsl(0_0%_4%)] border border-gray-200 dark:border-[hsl(0_0%_15%)] gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{hasVariants ? product.variantGroupTitle?.trim() || "Choose your plan" : product.name}</DialogTitle>
        </DialogHeader>

        <button
          onClick={() => handleOpenChange(false)}
          className="absolute right-3 top-3 z-20 p-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/80 transition-colors dark:bg-black/60 dark:text-white/80"
          data-testid="button-close-modal"
        >
          <X className="w-4 h-4" />
        </button>

        {hasVariants ? (
          <div className="border-b border-gray-200 bg-gray-50/80 px-5 pb-4 pt-5 dark:border-white/[0.08] dark:bg-white/[0.02]">
            <div className="flex items-center gap-3 pr-9">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.1] dark:bg-white/[0.04]">
                {hasImage ? (
                  <img src={activeProduct.imageUrl!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <Package className="h-6 w-6 text-primary/50" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="mb-1 inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span className="truncate">{activeProduct.category}</span>
                </span>
                <h2
                  className="break-words [overflow-wrap:anywhere] text-lg font-bold leading-snug text-gray-900 dark:text-white"
                  data-testid="text-modal-product-name"
                >
                  {product.variantGroupTitle?.trim() || "Choose your plan"}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-white/50">Choose from {allOptions.length} options</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="relative w-full aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-[hsl(0_0%_8%)]">
              {hasImage ? (
                <img
                  src={activeProduct.imageUrl!}
                  alt={activeProduct.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-16 w-16 text-primary/30" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute left-3 top-3 max-w-[calc(100%-4rem)]">
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-black/55 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span className="truncate">{activeProduct.category}</span>
                </span>
              </div>
            </div>
            <div className="px-5 pt-4">
              <h2
                className="break-words text-xl font-bold leading-tight text-gray-900 dark:text-white"
                data-testid="text-modal-product-name"
              >
                {product.name}
              </h2>
            </div>
          </>
        )}

        <div className="relative z-10 px-5 pb-5 pt-4">
          {hasVariants && (
            <section aria-label="Choose a product option" className="mb-4 rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.025]">
              <div className="mb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-white/85">Choose an option</h3>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-white/45">Select the plan that works for you</p>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto overscroll-contain pr-1 thin-scrollbar">
                {allOptions.map((option) => {
                  const isSelected = option.id === selectedVariantId;
                  const outOfStock = option.stock === 0;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={outOfStock}
                      onClick={() => !outOfStock && handleVariantSelect(option.id)}
                      className={`relative flex w-full min-h-[68px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                        outOfStock
                          ? "cursor-not-allowed border-gray-200/60 bg-gray-100/70 dark:border-white/[0.05] dark:bg-white/[0.01]"
                          : isSelected
                            ? "border-primary bg-primary/10 shadow-sm shadow-primary/10 dark:bg-primary/15"
                            : "border-gray-200 bg-white hover:border-primary/40 hover:bg-primary/[0.04] dark:border-white/[0.08] dark:bg-white/[0.025] dark:hover:bg-primary/5"
                      }`}
                      data-testid={`button-variant-${option.id}`}
                    >
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${isSelected ? "border-primary bg-primary text-white" : "border-gray-300 text-transparent dark:border-white/20"}`} aria-hidden="true">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block break-words text-sm font-semibold leading-snug [overflow-wrap:anywhere] ${outOfStock ? "text-gray-400 dark:text-white/30" : "text-gray-900 dark:text-white/90"}`}>
                          {option.name}
                        </span>
                        <span className={`mt-1 block text-[10px] font-medium ${outOfStock ? "text-red-400/70" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {outOfStock ? "Out of stock" : `${option.stock.toLocaleString()} in stock`}
                        </span>
                      </span>
                      <span className={`shrink-0 text-sm font-bold tabular-nums ${isSelected ? "text-primary" : "text-gray-700 dark:text-white/75"}`}>
                        ${option.price.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <div 
            className="mb-4 max-h-[200px] overflow-y-auto break-words leading-relaxed [overflow-wrap:anywhere] text-sm text-gray-500 dark:text-[hsl(0_0%_55%)] thin-scrollbar [&_img]:max-w-full [&_img]:h-auto [&_img]:max-h-[150px] [&_img]:object-contain [&_img]:mx-auto [&_img]:block [&_img]:my-2 [&_div]:text-inherit"
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

              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className="gap-2 border-primary/30 text-primary hover:bg-primary/10 font-bold uppercase tracking-wider text-xs"
                  data-testid="button-add-to-cart"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Add to cart
                </Button>
                <Button
                  size="lg"
                  onClick={handleProceed}
                  disabled={!inStock}
                  className="gap-2.5 bg-primary text-white font-bold uppercase tracking-wider text-xs"
                  data-testid="button-proceed-to-payment"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {inStock ? "Buy Now" : "Out of Stock"}
                </Button>
              </div>
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
