import { Globe } from "lucide-react";

interface CountryFlagProps {
  code: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export function CountryFlag({ code, size = "sm", className = "" }: CountryFlagProps) {
  if (code.toLowerCase() === "ww") {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center border-2 border-card shrink-0 ${className}`}>
        <Globe className="w-3 h-3 text-primary-foreground" />
      </div>
    );
  }
  
  const flagUrl = `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
  
  return (
    <img
      src={flagUrl}
      alt={code.toUpperCase()}
      className={`${sizeClasses[size]} rounded-full object-cover border-2 border-card shrink-0 ${className}`}
      loading="lazy"
    />
  );
}

interface CountryFlagsProps {
  countries: string[];
  size?: "sm" | "md" | "lg";
  maxDisplay?: number;
}

export function CountryFlags({ countries, size = "sm", maxDisplay = 4 }: CountryFlagsProps) {
  const displayCountries = countries.slice(0, maxDisplay);
  const remaining = countries.length - maxDisplay;

  return (
    <div className="flex items-center gap-1">
      {displayCountries.map((code) => (
        <CountryFlag
          key={code}
          code={code}
          size={size}
        />
      ))}
      {remaining > 0 && (
        <span className="ml-1 text-xs text-muted-foreground">+{remaining}</span>
      )}
    </div>
  );
}

export function CountryFlagsStacked({ countries, size = "sm", maxDisplay = 5 }: CountryFlagsProps) {
  const displayCountries = countries.slice(0, maxDisplay);
  const remaining = countries.length - maxDisplay;

  return (
    <div className="flex items-center">
      {displayCountries.map((code, i) => (
        <div key={code} className="relative" style={{ marginLeft: i === 0 ? 0 : -6, zIndex: maxDisplay - i }}>
          <CountryFlag
            code={code}
            size={size}
            className="ring-1 ring-black/50"
          />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className="relative flex items-center justify-center w-5 h-5 rounded-full bg-white/[0.06] border border-white/[0.1] text-[8px] font-bold text-gray-400"
          style={{ marginLeft: -6, zIndex: 0 }}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
