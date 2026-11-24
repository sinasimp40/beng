import type { Statistics } from "@shared/schema";
import { Package, Users, Star } from "lucide-react";

interface StatisticsDisplayProps {
  statistics: Statistics;
}

export function StatisticsDisplay({ statistics }: StatisticsDisplayProps) {
  const stats = [
    {
      label: "PRODUCTS SOLD",
      value: statistics.productsSold.toLocaleString(),
      icon: <Package className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />,
    },
    {
      label: "CUSTOMERS",
      value: statistics.customers.toLocaleString(),
      icon: <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />,
    },
    {
      label: "REVIEWS",
      value: statistics.averageRating.toFixed(1),
      icon: <Star className="w-5 h-5 sm:w-6 sm:h-6 text-primary fill-primary" />,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-6 py-6 sm:py-8 mb-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col items-center gap-1 sm:gap-2 p-3 sm:p-4 rounded-lg bg-card/50 backdrop-blur border border-primary/10 violet-glow"
          data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <div className="flex items-center gap-1 sm:gap-2">
            {stat.icon}
            <span className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground">
              {stat.value}
            </span>
          </div>
          <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}
