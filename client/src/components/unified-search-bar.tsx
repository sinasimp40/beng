import { useState, useMemo } from "react";
import { Search, X, ChevronDown, LayoutGrid, Globe, Tag, ArrowUpDown } from "lucide-react";
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
} from "lucide-react";
import type { SortOption } from "@/pages/home";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CountryFlag } from "@/components/country-flag";
import { CATEGORIES, COUNTRIES, type Product } from "@shared/schema";

const categoryIcons: Record<string, React.ReactNode> = {
  All: <LayoutGrid className="w-4 h-4" />,
  FLIGHTS: <Plane className="w-4 h-4" />,
  HOTELS: <Building2 className="w-4 h-4" />,
  SHOPPING: <ShoppingBag className="w-4 h-4" />,
  CASHOUTS: <CreditCard className="w-4 h-4" />,
  GIFTCARDS: <Gift className="w-4 h-4" />,
  FOOD: <UtensilsCrossed className="w-4 h-4" />,
  STREAMING: <Tv className="w-4 h-4" />,
  VPN: <Shield className="w-4 h-4" />,
  FUEL: <Fuel className="w-4 h-4" />,
  GAMES: <Gamepad2 className="w-4 h-4" />,
  MUSIC: <Music className="w-4 h-4" />,
  LUXURY: <Gem className="w-4 h-4" />,
  GROCERIES: <ShoppingCart className="w-4 h-4" />,
  RENT: <Home className="w-4 h-4" />,
};

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "price-low", label: "Price: Low → High" },
  { value: "price-high", label: "Price: High → Low" },
  { value: "name-az", label: "Name: A → Z" },
  { value: "name-za", label: "Name: Z → A" },
];

interface UnifiedSearchBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedCountry: string | null;
  onCountryChange: (country: string | null) => void;
  products: Product[];
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
}

export function UnifiedSearchBar({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedCountry,
  onCountryChange,
  products,
  sortBy = "default",
  onSortChange,
}: UnifiedSearchBarProps) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const usedCategories = useMemo(() => {
    const cats = new Set(
      products
        .map((p) => p.category)
        .filter((c): c is string => !!c && c.trim() !== "")
    );
    const result: string[] = ["All"];
    CATEGORIES.filter((c) => c !== "All").forEach((cat) => {
      if (cats.has(cat)) result.push(cat);
    });
    cats.forEach((cat) => {
      if (!CATEGORIES.includes(cat as any)) result.push(cat);
    });
    return result;
  }, [products]);

  const availableCountries = useMemo(() => {
    const countryCodes = new Set<string>();
    products.forEach((p) => {
      if (p.countries && p.countries.length > 0) {
        p.countries.forEach((code) => countryCodes.add(code));
      }
    });
    return COUNTRIES.filter((c) => countryCodes.has(c.code));
  }, [products]);

  const hasCategories = usedCategories.length > 1;
  const hasCountries = availableCountries.length > 0;

  const selectedCountryData = selectedCountry
    ? COUNTRIES.find((c) => c.code === selectedCountry)
    : null;

  return (
    <div className="w-full max-w-3xl mx-auto relative z-30">
      <div className="relative group">
        <div className="absolute -inset-[1px] bg-gradient-to-r from-primary via-primary/80 to-primary rounded-xl opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute -inset-[2px] bg-gradient-to-r from-primary/30 via-primary/20 to-primary/30 rounded-xl blur-md opacity-0 group-hover:opacity-60 transition-opacity duration-500" />
        
        <div className="relative flex items-center bg-background rounded-xl overflow-hidden">
          {hasCategories && (
            <>
              <DropdownMenu open={categoryOpen} onOpenChange={setCategoryOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-primary/5 transition-colors border-r border-primary/10 shrink-0"
                    data-testid="dropdown-category"
                  >
                    <span className="text-primary">
                      {categoryIcons[selectedCategory] || <Tag className="w-4 h-4" />}
                    </span>
                    <span className="hidden sm:inline max-w-[80px] truncate">
                      {selectedCategory === "All" ? "Category" : selectedCategory}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-48 max-h-[300px] overflow-y-auto" collisionPadding={8}>
                  {usedCategories.map((category) => (
                    <DropdownMenuItem
                      key={category}
                      onClick={() => onCategoryChange(category)}
                      className={`flex items-center gap-2 cursor-pointer ${
                        selectedCategory === category ? "bg-primary/10 text-primary" : ""
                      }`}
                      data-testid={`menu-category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    >
                      <span className="text-primary/70">
                        {categoryIcons[category] || <Tag className="w-4 h-4" />}
                      </span>
                      <span className="uppercase text-xs font-semibold tracking-wide">{category}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <div className="flex-1 flex items-center min-w-0">
            <div className="flex items-center justify-center shrink-0 pl-3 sm:pl-4 text-primary">
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search products..."
              className="flex-1 border-0 bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 min-w-0"
              data-testid="input-search"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground h-8 w-8"
                onClick={() => onSearchChange("")}
                data-testid="button-clear-search"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {hasCountries && (
            <>
              <DropdownMenu open={countryOpen} onOpenChange={setCountryOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-primary/5 transition-colors border-l border-primary/10 shrink-0"
                    data-testid="dropdown-country"
                  >
                    {selectedCountryData ? (
                      <CountryFlag code={selectedCountryData.code} size="sm" />
                    ) : (
                      <Globe className="w-4 h-4 text-primary" />
                    )}
                    <span className="hidden sm:inline max-w-[80px] truncate">
                      {selectedCountryData ? selectedCountryData.name : "Region"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-56 max-h-[300px] overflow-y-auto" collisionPadding={8}>
                  <DropdownMenuItem
                    onClick={() => onCountryChange(null)}
                    className={`flex items-center gap-2 cursor-pointer ${
                      selectedCountry === null ? "bg-primary/10 text-primary" : ""
                    }`}
                    data-testid="menu-country-all"
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                      A
                    </div>
                    <span className="font-medium">All Regions</span>
                  </DropdownMenuItem>
                  {availableCountries.map((country) => (
                    <DropdownMenuItem
                      key={country.code}
                      onClick={() => onCountryChange(country.code)}
                      className={`flex items-center gap-2 cursor-pointer ${
                        selectedCountry === country.code ? "bg-primary/10 text-primary" : ""
                      }`}
                      data-testid={`menu-country-${country.code}`}
                    >
                      <CountryFlag code={country.code} size="sm" />
                      <span>{country.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {onSortChange && (
            <DropdownMenu open={sortOpen} onOpenChange={setSortOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-primary/5 transition-colors border-l border-primary/10 shrink-0"
                  data-testid="dropdown-sort"
                >
                  <ArrowUpDown className="w-4 h-4 text-primary" />
                  <span className="hidden sm:inline max-w-[100px] truncate">
                    {sortOptions.find(o => o.value === sortBy)?.label || "Sort"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-48" collisionPadding={8}>
                {sortOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => onSortChange(option.value)}
                    className={`flex items-center gap-2 cursor-pointer ${
                      sortBy === option.value ? "bg-primary/10 text-primary" : ""
                    }`}
                    data-testid={`menu-sort-${option.value}`}
                  >
                    <span className="text-sm">{option.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {(selectedCategory !== "All" || selectedCountry !== null || sortBy !== "default") && (
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          {selectedCategory !== "All" && (
            <button
              onClick={() => onCategoryChange("All")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
              data-testid="chip-category-active"
            >
              {categoryIcons[selectedCategory] || <Tag className="w-3 h-3" />}
              <span className="uppercase tracking-wide">{selectedCategory}</span>
              <X className="w-3 h-3" />
            </button>
          )}
          {selectedCountry !== null && selectedCountryData && (
            <button
              onClick={() => onCountryChange(null)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
              data-testid="chip-country-active"
            >
              <CountryFlag code={selectedCountryData.code} size="sm" />
              <span>{selectedCountryData.name}</span>
              <X className="w-3 h-3" />
            </button>
          )}
          {sortBy !== "default" && onSortChange && (
            <button
              onClick={() => onSortChange("default")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
              data-testid="chip-sort-active"
            >
              <ArrowUpDown className="w-3 h-3" />
              <span>{sortOptions.find(o => o.value === sortBy)?.label}</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
