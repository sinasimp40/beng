import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Product, InsertProduct } from "@shared/schema";
import { CATEGORIES, COUNTRIES } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BBCodeEditor } from "@/components/bbcode-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/country-flag";
import { Save, X, Search, Check, Flame, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";

const productFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().min(1, "Description is required"),
  price: z.coerce.number().min(0.01, "Price must be at least $0.01"),
  category: z.string().optional().default(""),
  customCategory: z.string().optional().default(""),
  stock: z.coerce.number().int().min(0, "Stock must be 0 or more"),
  imageUrl: z.string().url().optional().or(z.literal("")),
  countries: z.array(z.string()).optional().default([]),
  stockList: z.string().optional(),
  enabled: z.boolean().default(true),
  isHot: z.boolean().default(false),
});

type ProductFormData = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: InsertProduct) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  isCreate?: boolean;
}

export function ProductForm({
  product,
  onSubmit,
  onCancel,
  isSubmitting,
  isCreate,
}: ProductFormProps) {
  const [countrySearch, setCountrySearch] = useState("");
  const isCustomCategory = product?.category && !CATEGORIES.includes(product.category as any);
  
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      price: product?.price || 0,
      category: isCustomCategory ? "" : (product?.category || ""),
      customCategory: isCustomCategory ? (product?.category ?? "") : "",
      stock: product?.stock || 0,
      imageUrl: product?.imageUrl || "",
      countries: product?.countries || [],
      stockList: product?.stockList || "",
      enabled: product ? product.enabled === 1 : true,
      isHot: product ? product.isHot === 1 : false,
    },
  });

  const stockList = form.watch("stockList");
  const calculatedStock = stockList?.split('\n').filter(line => line.trim() !== '').length || 0;

  const handleSubmit = (data: ProductFormData) => {
    const rawLines = data.stockList?.split('\n') || [];
    const normalizedLines = rawLines
      .map(line => line.trim())
      .filter(line => line !== '');
    const uniqueLines = Array.from(new Set(normalizedLines));
    const normalizedStockList = uniqueLines.join('\n');
    
    const finalCategory = data.customCategory?.trim() || data.category || "";
    onSubmit({
      name: data.name,
      description: data.description,
      price: data.price,
      category: finalCategory,
      imageUrl: data.imageUrl || null,
      stockList: normalizedStockList || null,
      stock: uniqueLines.length,
      countries: data.countries || [],
      enabled: data.enabled ? 1 : 0,
      isHot: data.isHot ? 1 : 0,
    });
  };

  const categories = CATEGORIES.filter((c) => c !== "All");

  const filteredCountries = COUNTRIES.filter(country =>
    country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    country.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const getCountryName = (code: string) => {
    const country = COUNTRIES.find(c => c.code === code);
    return country?.name || code.toUpperCase();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter product name"
                      {...field}
                      data-testid="input-product-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (BBCode supported)</FormLabel>
                  <FormControl>
                    <BBCodeEditor
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Enter product description with BBCode formatting"
                      data-testid="input-product-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com/image.png"
                      {...field}
                      data-testid="input-product-image"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stockList"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock List (one item per line)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="email@example.com:password123&#10;user@domain.com:pass456&#10;account@site.com:key789"
                      className="resize-none min-h-[150px] font-mono text-sm"
                      {...field}
                      data-testid="input-product-stocklist"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter account credentials, one per line. Stock count will be auto-calculated.
                    Current items: {(field.value?.split('\n').filter((l: string) => l.trim() !== '') || []).length}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-product-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Stock (auto-calculated)</FormLabel>
                <Input
                  type="number"
                  value={calculatedStock}
                  disabled
                  className="bg-muted cursor-not-allowed"
                  data-testid="input-product-stock"
                />
                <p className="text-xs text-muted-foreground">
                  Calculated from stock list lines
                </p>
              </FormItem>
            </div>

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category (optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-product-category">
                        <SelectValue placeholder="Select a category or leave empty" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Category (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Or enter a custom category name"
                      {...field}
                      data-testid="input-custom-category"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    If filled, this overrides the dropdown selection
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        {field.value ? (
                          <Eye className="w-4 h-4 text-green-500" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        )}
                        <Label className="text-sm font-medium cursor-pointer">
                          {field.value ? "Enabled" : "Disabled"}
                        </Label>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-product-enabled"
                        />
                      </FormControl>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Hidden from storefront when disabled
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isHot"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Flame className={`w-4 h-4 ${field.value ? "text-orange-500" : "text-muted-foreground"}`} />
                        <Label className="text-sm font-medium cursor-pointer">
                          Hot Product
                        </Label>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-product-hot"
                        />
                      </FormControl>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Featured with special badge
                    </p>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="countries"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Available Countries (optional)</FormLabel>
                  
                  {(field.value || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(field.value || []).map((code) => (
                        <Badge
                          key={code}
                          variant="secondary"
                          className="gap-1 cursor-pointer"
                          onClick={() => {
                            field.onChange(field.value?.filter(c => c !== code) || []);
                          }}
                          data-testid={`badge-selected-country-${code}`}
                        >
                          <CountryFlag code={code} size="sm" />
                          <span className="text-xs">{getCountryName(code)}</span>
                          <X className="w-3 h-3" />
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Card className="bg-muted/30 border-card-border overflow-hidden">
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search countries..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className="pl-8 h-8 text-sm"
                          data-testid="input-country-search"
                        />
                      </div>
                    </div>
                    <ScrollArea className="h-[200px]">
                      <div className="p-2 space-y-1">
                        {filteredCountries.map((country) => {
                          const isChecked = (field.value || []).includes(country.code);
                          return (
                            <div
                              key={country.code}
                              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                                isChecked ? "bg-primary/10" : "hover-elevate"
                              }`}
                              onClick={() => {
                                const currentValue = field.value || [];
                                if (isChecked) {
                                  field.onChange(currentValue.filter((c) => c !== country.code));
                                } else {
                                  field.onChange([...currentValue, country.code]);
                                }
                              }}
                              data-testid={`option-country-${country.code}`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                isChecked ? "bg-primary border-primary" : "border-muted-foreground/30"
                              }`}>
                                {isChecked && <Check className="w-3 h-3 text-primary-foreground" />}
                              </div>
                              <CountryFlag code={country.code} size="sm" />
                              <span className="text-sm">{country.name}</span>
                            </div>
                          );
                        })}
                        {filteredCountries.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No countries found
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </Card>
                  <p className="text-xs text-muted-foreground">
                    Leave empty if product is available everywhere. Selected: {(field.value || []).length} countries
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="gap-2"
            data-testid="button-cancel"
          >
            <X className="w-4 h-4" />
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-2"
            data-testid="button-save-product"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Saving..." : (product && !isCreate) ? "Update Product" : "Create Product"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
