import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search products...",
}: SearchBarProps) {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative group">
        <div className="absolute -inset-[1px] bg-gradient-to-r from-primary via-primary/80 to-primary rounded-lg opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="absolute -inset-[2px] bg-gradient-to-r from-primary/30 via-primary/20 to-primary/30 rounded-lg blur-md opacity-0 group-hover:opacity-60 transition-opacity duration-500" />
        
        <div className="relative flex items-center bg-background rounded-lg">
          <div className="flex items-center justify-center shrink-0 pl-4 text-primary">
            <Search className="w-5 h-5" />
          </div>
          
          <Input
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 border-0 bg-transparent text-base text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
            data-testid="input-search"
          />
          
          {value && (
            <Button
              variant="ghost"
              size="icon"
              className="mr-2 shrink-0 text-muted-foreground"
              onClick={() => onChange("")}
              data-testid="button-clear-search"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
