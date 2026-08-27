import { useState } from "react";
import { Minus, Plus, ShoppingBag, ShoppingCart, Trash2, X, PackageCheck, AlertTriangle } from "lucide-react";
import type { CartItem } from "@/lib/cart";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

interface CartDrawerProps {
  onCheckout: (items: CartItem[]) => void;
}

export function CartDrawer({ onCheckout }: CartDrawerProps) {
  const [open, setOpen] = useState(false);
  const { items, itemCount, subtotal, hasUnavailableItems, updateQuantity, removeItem, clearCart } = useCart();
  const { toast } = useToast();

  const handleCheckout = () => {
    if (hasUnavailableItems) {
      toast({
        title: "Update your cart",
        description: "One or more items are no longer available in the requested quantity.",
        variant: "destructive",
      });
      return;
    }
    if (items.length === 0) return;
    onCheckout(items);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="relative h-9 w-9 p-0 sm:w-auto sm:px-3 sm:py-2 gap-2 text-white/70 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
        data-testid="button-cart"
        aria-label={`Shopping cart with ${itemCount} item${itemCount === 1 ? "" : "s"}`}
      >
        <ShoppingCart className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Cart</span>
        {itemCount > 0 && (
          <span
            className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-[#0a0a0f]"
            data-testid="text-cart-count"
          >
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        )}
      </Button>

      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-background border-l border-primary/20">
        <div className="relative overflow-hidden px-5 pt-6 pb-5 border-b border-border/60">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/5 pointer-events-none" />
          <SheetHeader className="relative text-left">
            <SheetTitle className="flex items-center gap-3 text-xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
                <ShoppingBag className="w-5 h-5 text-primary" />
              </span>
              <span>Your cart <span className="text-sm font-normal text-muted-foreground">({itemCount})</span></span>
            </SheetTitle>
            <SheetDescription className="pl-[52px]">Review your items before secure checkout.</SheetDescription>
          </SheetHeader>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-5">
              <ShoppingBag className="w-8 h-8 text-primary/70" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Your cart is waiting</h3>
            <p className="text-sm text-muted-foreground max-w-xs">Add products from the shop and they’ll appear here for one easy checkout.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {items.map(item => {
                const unavailable = item.stock <= 0 || item.quantity > item.stock;
                return (
                  <div
                    key={item.productId}
                    className={`relative flex gap-3 rounded-xl border p-3 transition-colors ${unavailable ? "border-destructive/40 bg-destructive/5" : "border-border/70 bg-card/40"}`}
                    data-testid={`cart-item-${item.productId}`}
                  >
                    <div className="w-16 h-16 shrink-0 overflow-hidden rounded-lg bg-muted/60 border border-border/50 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <PackageCheck className="w-6 h-6 text-primary/40" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{item.name}</p>
                          {item.variantLabel && <p className="text-xs text-primary mt-0.5">{item.variantLabel}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label={`Remove ${item.name}`}
                          data-testid={`button-remove-cart-${item.productId}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-3">
                        <div className="flex items-center rounded-lg border border-border/80 bg-background/70">
                          <button
                            type="button"
                            className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                            onClick={() => item.quantity <= 1 ? removeItem(item.productId) : updateQuantity(item.productId, item.quantity - 1)}
                            aria-label={`Decrease ${item.name} quantity`}
                            data-testid={`button-decrease-cart-${item.productId}`}
                          >
                            {item.quantity <= 1 ? <Trash2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          </button>
                          <span className="min-w-7 text-center text-xs font-semibold tabular-nums" data-testid={`text-cart-quantity-${item.productId}`}>{item.quantity}</span>
                          <button
                            type="button"
                            className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            disabled={item.stock <= 0 || item.quantity >= Math.min(item.stock, 100)}
                            aria-label={`Increase ${item.name} quantity`}
                            data-testid={`button-increase-cart-${item.productId}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="font-bold text-sm tabular-nums">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      {unavailable ? (
                        <p className="flex items-center gap-1 text-[11px] text-destructive mt-2">
                          <AlertTriangle className="w-3 h-3" />
                          {item.stock > 0 ? `Only ${item.stock} left` : "Out of stock"}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground mt-2">${item.price.toFixed(2)} each</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border/70 bg-card/30 px-5 pt-4 pb-5 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-xl font-bold tabular-nums" data-testid="text-cart-subtotal">${subtotal.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Final payment total is verified against current product prices at checkout.</p>
              <Button
                size="lg"
                className="w-full gap-2 font-bold uppercase tracking-wider shadow-lg shadow-primary/20"
                onClick={handleCheckout}
                disabled={hasUnavailableItems}
                data-testid="button-cart-checkout"
              >
                <ShoppingCart className="w-4 h-4" />
                {hasUnavailableItems ? "Update unavailable items" : "Checkout all items"}
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive gap-2" onClick={clearCart} data-testid="button-clear-cart">
                <Trash2 className="w-3.5 h-3.5" />
                Clear cart
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}