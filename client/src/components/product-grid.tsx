import type { Product, ProductWithVariants } from "@shared/schema";
import { ProductCard } from "@/components/product-card";
import { Package } from "lucide-react";

interface ProductGridProps {
  products: ProductWithVariants[];
  isLoading?: boolean;
  onBuyNow: (product: ProductWithVariants) => void;
}

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col bg-[hsl(0_0%_6%)] border border-[hsl(0_0%_15%)] rounded-md animate-pulse">
      <div className="w-full aspect-[4/3] bg-[hsl(0_0%_10%)] rounded-t-md" />
      <div className="p-3 space-y-2">
        <div className="flex justify-between items-center">
          <div className="h-3 bg-[hsl(0_0%_15%)] rounded w-16" />
          <div className="h-3 bg-[hsl(0_0%_12%)] rounded w-12" />
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-[hsl(0_0%_15%)]">
          <div className="h-5 bg-primary/20 rounded w-14" />
          <div className="h-7 bg-primary/30 rounded w-16" />
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({ products, isLoading, onBuyNow }: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="flex flex-wrap justify-center gap-4 sm:gap-6 w-full">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]">
            <ProductCardSkeleton />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Package className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          No products found
        </h3>
        <p className="text-muted-foreground">
          Try adjusting your search or filter criteria
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap justify-center gap-4 sm:gap-6 w-full pt-[20px] pb-[20px]"
      data-testid="product-grid"
    >
      {products.map((product, index) => (
        <div key={product.id} className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]">
          <ProductCard product={product} onBuyNow={onBuyNow} index={index} />
        </div>
      ))}
    </div>
  );
}
