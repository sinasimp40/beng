import { useRef, useCallback, useState, useEffect } from "react";
import type { Product, ProductWithVariants } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CountryFlagsStacked } from "@/components/country-flag";
import { Package, ShoppingCart, Sparkles, Flame, Layers } from "lucide-react";
import { SiBitcoin, SiEthereum, SiLitecoin, SiDogecoin, SiMonero, SiRipple, SiBinance, SiSolana } from "react-icons/si";

const cryptoBadges = [
  { id: "usdt", name: "USDT", icon: <span className="text-green-500 font-bold text-[10px]">$</span>, color: "text-green-500" },
  { id: "ltc", name: "Litecoin", icon: <SiLitecoin className="w-3 h-3" />, color: "text-gray-400" },
  { id: "sol", name: "Solana", icon: <SiSolana className="w-3 h-3" />, color: "text-purple-400" },
  { id: "bnb", name: "BNB", icon: <SiBinance className="w-3 h-3" />, color: "text-yellow-500" },
  { id: "btc", name: "Bitcoin", icon: <SiBitcoin className="w-3 h-3" />, color: "text-orange-500" },
  { id: "eth", name: "Ethereum", icon: <SiEthereum className="w-3 h-3" />, color: "text-blue-400" },
  { id: "xrp", name: "XRP", icon: <SiRipple className="w-3 h-3" />, color: "text-blue-300" },
  { id: "doge", name: "Doge", icon: <SiDogecoin className="w-3 h-3" />, color: "text-yellow-400" },
  { id: "xmr", name: "Monero", icon: <SiMonero className="w-3 h-3" />, color: "text-orange-400" },
];

function useAnimatedCount(target: number, countDuration = 2000, holdDuration = 5000) {
  const [display, setDisplay] = useState(target);
  const [counting, setCounting] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timeout: ReturnType<typeof setTimeout>;

    function runCycle() {
      if (!mounted) return;
      setCounting(true);
      const start = performance.now();

      function step() {
        if (!mounted) return;
        const elapsed = performance.now() - start;
        const progress = Math.min(elapsed / countDuration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(eased * target));

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          setCounting(false);
          timeout = setTimeout(() => {
            if (mounted) {
              setDisplay(0);
              requestAnimationFrame(() => runCycle());
            }
          }, holdDuration);
        }
      }
      requestAnimationFrame(step);
    }

    runCycle();
    return () => { mounted = false; clearTimeout(timeout); };
  }, [target, countDuration, holdDuration]);

  return { display, counting };
}

interface ProductCardProps {
  product: ProductWithVariants;
  onBuyNow: (product: ProductWithVariants) => void;
  onAddToCart: (product: ProductWithVariants) => void;
  index?: number;
}

export function ProductCard({ product, onBuyNow, onAddToCart, index = 0 }: ProductCardProps) {
  const hasImage = product.imageUrl && product.imageUrl.length > 0;
  const hasVariants = product.variants && product.variants.length > 0;
  const minPrice = hasVariants
    ? Math.min(product.price, ...product.variants!.map(v => v.price))
    : product.price;
  const totalStock = hasVariants
    ? product.stock + product.variants!.reduce((sum, v) => sum + v.stock, 0)
    : product.stock;
  const { display: animatedStock, counting: stockCounting } = useAnimatedCount(totalStock);
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  const applyGlow = useCallback((clientX: number, clientY: number) => {
    if (!bottomRef.current || !glowRef.current || !gridRef.current) return;
    const rect = bottomRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    glowRef.current.style.opacity = '1';
    glowRef.current.style.background = `radial-gradient(circle 100px at ${x}px ${y}px, rgba(255,255,255,0.08), transparent 70%)`;
    gridRef.current.style.opacity = '1';
    gridRef.current.style.maskImage = `radial-gradient(circle 120px at ${x}px ${y}px, black 20%, transparent 70%)`;
    gridRef.current.style.webkitMaskImage = `radial-gradient(circle 120px at ${x}px ${y}px, black 20%, transparent 70%)`;
  }, []);

  const clearGlow = useCallback(() => {
    if (glowRef.current) glowRef.current.style.opacity = '0';
    if (gridRef.current) gridRef.current.style.opacity = '0';
  }, []);

  return (
    <div className="group relative">
      <Card
        ref={cardRef}
        className="relative overflow-hidden flex flex-col bg-gradient-to-b from-gray-50 to-gray-100 dark:from-[#0f0f0f] dark:to-[#080808] border border-gray-200/80 dark:border-white/[0.06] group-hover:border-primary/30 transition-all duration-300 shadow-lg shadow-black/10 dark:shadow-black/40"
        data-testid={`card-product-${product.id}`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-white/[0.01] pointer-events-none" />
        
        <div className="relative w-full aspect-[4/3] overflow-hidden rounded-t-md">
          {hasImage ? (
            <img
              src={product.imageUrl!}
              alt={product.name}
              className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:brightness-110"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#0f0f0f] dark:to-[#050505]">
              <Package className="w-8 h-8 text-primary/20" />
            </div>
          )}
          
          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
            {hasVariants && product.variants!.length > 0 ? (
              <div className="relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded blur opacity-60" />
                <span className="relative inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-primary to-purple-600 text-white rounded shadow-lg shadow-primary/30">
                  <Layers className="w-2.5 h-2.5" />
                  {product.variants!.length + 1} Options
                </span>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded blur opacity-60" />
                <span className="relative inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-primary to-purple-600 text-white rounded shadow-lg shadow-primary/30">
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                  {product.category}
                </span>
              </div>
            )}
          </div>
          {product.isHot === 1 && (
            <div className="absolute top-2.5 right-2.5">
              <div className="relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-red-500 rounded blur opacity-70" style={{ animation: 'hotPulse 2s ease-in-out infinite' }} />
                <span className="relative inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-orange-500 to-red-500 text-white rounded shadow-lg shadow-orange-500/40">
                  <Flame className="w-2.5 h-2.5 text-white" />
                  HOT
                </span>
              </div>
            </div>
          )}
        </div>
        
        <div className="relative overflow-hidden py-1.5 px-3">
          <div className="absolute inset-0 bg-primary/20" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.1)_0%,transparent_50%)]" />
          <div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/50 to-transparent"
            style={{ animation: 'glowSwipe 2.5s ease-in-out infinite' }}
          />
          <div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm"
            style={{ animation: 'glowSwipe 2.5s ease-in-out infinite', animationDelay: '0.3s' }}
          />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          
          <h3
            className="relative font-bold text-foreground text-sm sm:text-base line-clamp-2 leading-tight text-center"
            data-testid={`text-product-name-${product.id}`}
          >
            {product.name}
          </h3>
        </div>

        <div className="relative overflow-hidden px-3 pt-2 pb-1">
          <div className="relative overflow-hidden" style={{ maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)" }}>
            <div
              className="flex gap-1.5 w-max"
              style={{ animation: `cryptoMarquee ${cryptoBadges.length * 2}s linear infinite` }}
            >
              {[...cryptoBadges, ...cryptoBadges].map((crypto, i) => (
                <div
                  key={`${crypto.id}-${i}`}
                  className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.04] ${crypto.color}`}
                  data-testid={i < cryptoBadges.length ? `badge-crypto-${crypto.id}-${product.id}` : undefined}
                >
                  {crypto.icon}
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-300">{crypto.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div
          ref={bottomRef}
          onMouseMove={(e) => applyGlow(e.clientX, e.clientY)}
          onMouseLeave={clearGlow}
          onTouchMove={(e) => { if (e.touches.length > 0) applyGlow(e.touches[0].clientX, e.touches[0].clientY); }}
          onTouchEnd={clearGlow}
          className="relative flex flex-col gap-2.5 p-3 pt-1.5"
        >
          <div
            ref={glowRef}
            className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-300 rounded-b-xl"
            style={{ opacity: 0 }}
          />
          <div
            ref={gridRef}
            className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-500 rounded-b-xl"
            style={{
              opacity: 0,
              backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)`,
              backgroundSize: '20px 20px',
            }}
          />
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CountryFlagsStacked countries={product.countries || []} size="sm" />
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div className="relative flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
                <div className="relative flex items-center justify-center w-2 h-2">
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-50 transition-colors duration-300 ${stockCounting ? 'bg-red-400' : 'bg-green-400'}`} style={{ animation: 'stockPulse 2s ease-in-out infinite' }} />
                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 transition-colors duration-300 ${stockCounting ? 'bg-red-500' : 'bg-green-500'}`} />
                </div>
                <span className="text-muted-foreground font-medium">{stockCounting ? 'Counting' : 'Stocked'}</span>
                <span className="font-medium tabular-nums" data-testid={`text-stock-${product.id}`}>
                  {animatedStock.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200 dark:border-white/[0.06]">
            <span
              className="text-lg font-bold"
              data-testid={`text-price-${product.id}`}
            >
              {hasVariants && <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mr-1">from</span>}
              <span className="text-muted-foreground">$</span>
              <span className="text-foreground">
                {minPrice.toFixed(2)}
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onAddToCart(product)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/30 bg-primary/5 hover:bg-primary/15 transition-colors"
                data-testid={`button-add-to-cart-${product.id}`}
              >
                <ShoppingCart className="w-3 h-3" />
                <span>Cart</span>
              </button>
              <button
                onClick={() => onBuyNow(product)}
                className="relative group/btn overflow-hidden flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider text-white transition-all duration-300"
                data-testid={`button-buy-${product.id}`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-primary rounded-md" />
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-white/20 to-primary opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"
                />
                <div className="absolute inset-[1px] rounded-[5px] bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                <span className="relative">Buy</span>
              </button>
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </Card>

      <style>{`
        @keyframes cryptoMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes stockPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes hotPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
