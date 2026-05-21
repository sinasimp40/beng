import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Product, ProductWithVariants } from "@shared/schema";
import { Header } from "@/components/header";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SupportBanner } from "@/components/support-banner";
import { FeaturesStrip } from "@/components/features-strip";
import { ProductGrid } from "@/components/product-grid";
import { ProductDetailModal } from "@/components/product-detail-modal";
import { PaymentModal } from "@/components/payment-modal";
import { ParticleBackground } from "@/components/particle-background";
import { UnifiedSearchBar } from "@/components/unified-search-bar";
import { SocialWidget } from "@/components/social-widget";
import { useProductUpdates } from "@/hooks/use-product-updates";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type SortOption = "default" | "price-low" | "price-high" | "name-az" | "name-za";

const PRODUCTS_PER_PAGE = 40;

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [sortBy, setSortBy] = useState<SortOption>("default");

  const [selectedProduct, setSelectedProduct] = useState<ProductWithVariants | null>(null);
  const [activeVariant, setActiveVariant] = useState<Product | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);

  // Enable real-time product updates via WebSocket
  useProductUpdates();

  const { data: products = [], isLoading: productsLoading } = useQuery<ProductWithVariants[]>({
    queryKey: ["/api/products"],
  });

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "All" || product.category === selectedCategory;
      const matchesCountry =
        !selectedCountry || (product.countries && product.countries.includes(selectedCountry));
      return matchesSearch && matchesCategory && matchesCountry;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      const hotDiff = (b.isHot || 0) - (a.isHot || 0);
      if (hotDiff !== 0) return hotDiff;
      if (sortBy === "price-low") return a.price - b.price;
      if (sortBy === "price-high") return b.price - a.price;
      if (sortBy === "name-az") return a.name.localeCompare(b.name);
      if (sortBy === "name-za") return b.name.localeCompare(a.name);
      return 0;
    });

    return sorted;
  }, [products, searchQuery, selectedCategory, selectedCountry, sortBy]);

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  // Reset to page 1 when filters change
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleCountryChange = (country: string | null) => {
    setSelectedCountry(country);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleBuyNow = (product: ProductWithVariants) => {
    setSelectedProduct(product);
    setActiveVariant(null);
    setDetailModalOpen(true);
  };

  const handleProceedToPayment = (product: Product, quantity: number) => {
    setActiveVariant(product);
    setPurchaseQuantity(quantity);
    setDetailModalOpen(false);
    setPaymentModalOpen(true);
  };

  const handlePaymentComplete = (paymentId: string) => {
    console.log("Payment completed:", paymentId);
    // Don't close modal - let the success screen show first
    // Modal will be closed when user clicks "Done" button
  };

  return (
    <div className="min-h-screen bg-background animated-gradient relative">
      <ParticleBackground />
      <div className="relative" style={{ zIndex: 2 }}>
        <Header searchQuery={searchQuery} onSearchChange={handleSearchChange} showSearch={false} />

        <main className="px-3 sm:px-4 md:px-6 py-4 sm:py-6 pb-20 sm:pb-6">
        <AnnouncementBar />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <FeaturesStrip />
        <SupportBanner />

        <div className="py-4 sm:py-6">
          <UnifiedSearchBar
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
            selectedCountry={selectedCountry}
            onCountryChange={handleCountryChange}
            products={products}
            sortBy={sortBy}
            onSortChange={(s) => { setSortBy(s); setCurrentPage(1); }}
          />
        </div>

        <ProductGrid
          products={paginatedProducts}
          isLoading={productsLoading}
          onBuyNow={handleBuyNow}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 sm:gap-4 mt-6 sm:mt-8 pb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="border-primary/20 disabled:opacity-50"
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Previous</span>
            </Button>
            <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md bg-card/50 border border-primary/10">
              <span className="text-xs sm:text-sm text-primary font-medium" data-testid="text-page-info">
                {currentPage}
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground">/</span>
              <span className="text-xs sm:text-sm text-muted-foreground">{totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="border-primary/20 disabled:opacity-50"
              data-testid="button-next-page"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
        </div>
      </main>
      </div>
      <ProductDetailModal
        product={selectedProduct}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onProceedToPayment={handleProceedToPayment}
      />
      <PaymentModal
        product={activeVariant || selectedProduct}
        quantity={purchaseQuantity}
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        onPaymentComplete={handlePaymentComplete}
      />
      <SocialWidget />
    </div>
  );
}
