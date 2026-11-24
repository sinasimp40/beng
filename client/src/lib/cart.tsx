import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product, ProductWithVariants } from "@shared/schema";

const CART_STORAGE_KEY = "buybit_cart";
const MAX_LINE_QUANTITY = 100;

export interface CartItem {
  productId: string;
  name: string;
  variantLabel?: string;
  price: number;
  imageUrl?: string | null;
  category?: string | null;
  quantity: number;
  stock: number;
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  hasUnavailableItems: boolean;
  addItem: (product: Product, quantity?: number, variantLabel?: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  syncProducts: (products: ProductWithVariants[]) => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item): item is CartItem =>
      item &&
      typeof item.productId === "string" &&
      typeof item.name === "string" &&
      Number.isFinite(item.price) &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0,
    ).map(item => ({
      ...item,
      stock: Number.isInteger(item.stock) ? Math.max(0, item.stock) : 0,
      quantity: Math.min(MAX_LINE_QUANTITY, item.quantity),
    }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((product: Product, quantity = 1, variantLabel?: string) => {
    setItems(current => {
      const safeQuantity = Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.floor(quantity)));
      const existing = current.find(item => item.productId === product.id);
      const nextQuantity = Math.min(product.stock, MAX_LINE_QUANTITY, (existing?.quantity || 0) + safeQuantity);
      if (product.stock <= 0 || nextQuantity <= 0) return current;

      const nextItem: CartItem = {
        productId: product.id,
        name: product.name,
        variantLabel,
        price: product.price,
        imageUrl: product.imageUrl,
        category: product.category,
        quantity: nextQuantity,
        stock: product.stock,
      };
      return existing
        ? current.map(item => item.productId === product.id ? nextItem : item)
        : [...current, nextItem];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems(current => current.map(item => {
      if (item.productId !== productId) return item;
      const max = Math.min(MAX_LINE_QUANTITY, item.stock);
      return { ...item, quantity: Math.max(1, Math.min(max || 1, Math.floor(quantity))) };
    }));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(current => current.filter(item => item.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const syncProducts = useCallback((products: ProductWithVariants[]) => {
    const productMap = new Map<string, Product>();
    products.forEach(product => {
      productMap.set(product.id, product);
      product.variants?.forEach(variant => productMap.set(variant.id, variant));
    });

    setItems(current => current.map(item => {
      const product = productMap.get(item.productId);
      if (!product) return { ...item, stock: 0 };
      return {
        ...item,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        category: product.category,
        stock: product.stock,
        quantity: product.stock > 0 ? Math.min(item.quantity, product.stock, MAX_LINE_QUANTITY) : item.quantity,
      };
    }));
  }, []);

  const itemCount = useMemo(() => items.reduce((total, item) => total + item.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((total, item) => total + item.price * item.quantity, 0), [items]);
  const hasUnavailableItems = useMemo(() => items.some(item => item.stock < item.quantity || item.stock <= 0), [items]);

  return (
    <CartContext.Provider value={{ items, itemCount, subtotal, hasUnavailableItems, addItem, updateQuantity, removeItem, clearCart, syncProducts }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}