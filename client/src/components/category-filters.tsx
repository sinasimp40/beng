import { CATEGORIES, type Product } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Plane,
  Building2,
  ShoppingBag,
  CreditCard,
  Gift,
  UtensilsCrossed,
  Tv,
  Shield,
  Fuel,
  Gamepad2,
  Music,
  Gem,
  ShoppingCart,
  Home,
  LayoutGrid,
  Tag,
} from "lucide-react";

const categoryIcons: Record<string, React.ReactNode> = {
  All: <LayoutGrid className="w-3 h-3 sm:w-4 sm:h-4" />,
  FLIGHTS: <Plane className="w-3 h-3 sm:w-4 sm:h-4" />,
  HOTELS: <Building2 className="w-3 h-3 sm:w-4 sm:h-4" />,
  SHOPPING: <ShoppingBag className="w-3 h-3 sm:w-4 sm:h-4" />,
  CASHOUTS: <CreditCard className="w-3 h-3 sm:w-4 sm:h-4" />,
  GIFTCARDS: <Gift className="w-3 h-3 sm:w-4 sm:h-4" />,
  FOOD: <UtensilsCrossed className="w-3 h-3 sm:w-4 sm:h-4" />,
  STREAMING: <Tv className="w-3 h-3 sm:w-4 sm:h-4" />,
  VPN: <Shield className="w-3 h-3 sm:w-4 sm:h-4" />,
  FUEL: <Fuel className="w-3 h-3 sm:w-4 sm:h-4" />,
  GAMES: <Gamepad2 className="w-3 h-3 sm:w-4 sm:h-4" />,
  MUSIC: <Music className="w-3 h-3 sm:w-4 sm:h-4" />,
  LUXURY: <Gem className="w-3 h-3 sm:w-4 sm:h-4" />,
  GROCERIES: <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />,
  RENT: <Home className="w-3 h-3 sm:w-4 sm:h-4" />,
};

interface CategoryFiltersProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  products?: Product[];
}

export function CategoryFilters({
  selectedCategory,
  onCategoryChange,
  products = [],
}: CategoryFiltersProps) {
  // Get all unique categories from products
  const usedCategories = new Set(
    products
      .map((p) => p.category)
      .filter((c): c is string => !!c && c.trim() !== "")
  );

  // Build list of categories to show: "All" + known categories that are used + custom categories
  const categoriesToShow: string[] = ["All"];
  
  // Add known categories that products actually use
  CATEGORIES.filter((c) => c !== "All").forEach((cat) => {
    if (usedCategories.has(cat)) {
      categoriesToShow.push(cat);
    }
  });

  // Add custom categories (not in CATEGORIES list)
  usedCategories.forEach((cat) => {
    if (!CATEGORIES.includes(cat as any)) {
      categoriesToShow.push(cat);
    }
  });

  // If no products or only "All", show nothing besides All
  if (categoriesToShow.length <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 pb-3">
      {categoriesToShow.map((category) => {
        const isActive = selectedCategory === category;
        const icon = categoryIcons[category] || <Tag className="w-3 h-3 sm:w-4 sm:h-4" />;
        return (
          <Button
            key={category}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onCategoryChange(category)}
            className={`flex items-center gap-1 sm:gap-2 uppercase text-[10px] sm:text-xs tracking-wide font-semibold px-2 sm:px-3 ${
              isActive
                ? "bg-gradient-to-r from-primary to-accent border-primary/50"
                : "bg-transparent border-primary/20 hover:border-primary/40"
            }`}
            data-testid={`button-category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
          >
            {icon}
            <span>{category}</span>
          </Button>
        );
      })}
    </div>
  );
}
