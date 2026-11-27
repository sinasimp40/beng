import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchBar } from "@/components/search-bar";
import { AuthModal } from "@/components/auth-modal";
import { CartDrawer } from "@/components/cart-drawer";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { CartItem } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useShopSettings } from "@/hooks/use-shop-settings";
import { Store, Settings, LogIn, UserPlus, User, LogOut, Sparkles, MessageSquareQuote, Activity, KeyRound, Menu } from "lucide-react";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showSearch?: boolean;
  onCartCheckout?: (items: CartItem[]) => void;
}

const navButtonClass = "h-9 w-9 shrink-0 p-0 md:w-9 md:px-0 xl:w-auto xl:px-3 xl:py-2 gap-2 text-white/70 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10";

export function Header({ searchQuery, onSearchChange, showSearch = true, onCartCheckout }: HeaderProps) {
  const [location] = useLocation();
  const isAdminPage = location.startsWith("/admin");
  const { user, isAdmin, isLoading, logout } = useAuth();
  const { shopName, shopLogo } = useShopSettings();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [navOpen, setNavOpen] = useState(false);

  const openLogin = () => { setAuthMode("login"); setAuthModalOpen(true); };
  const openRegister = () => { setAuthMode("register"); setAuthModalOpen(true); };
  const closeNav = () => setNavOpen(false);

  return <>
    <div className="sticky top-0 z-50 w-full px-2.5 pt-2.5 sm:px-4 sm:pt-4 md:px-6">
      <header className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl shadow-[inset_1px_1px_2px_rgba(255,255,255,0.1),inset_-1px_-1px_2px_rgba(0,0,0,0.5),0_0_30px_-5px_hsl(var(--primary)/0.2),0_4px_12px_-2px_rgba(0,0,0,0.4)]">
        <div className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-2xl" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10" />
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
        <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="relative px-3 sm:px-4 md:px-5 xl:px-6">
          <div className="flex h-14 items-center justify-between gap-1.5 sm:h-16 sm:gap-3">
            <Link href="/">
              <div className="group flex shrink-0 cursor-pointer items-center gap-1.5 sm:gap-2.5" data-testid="link-home">
                <div className="relative shrink-0">
                  <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-primary/40 to-primary/20 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
                  {shopLogo ? <img src={shopLogo} alt={shopName} className="relative h-7 w-7 rounded-lg object-cover shadow-lg shadow-primary/20 ring-1 ring-white/10 sm:h-9 sm:w-9 xl:h-10 xl:w-10" /> : <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary via-primary/80 to-primary/60 shadow-lg shadow-primary/30 ring-1 ring-white/20 sm:h-9 sm:w-9 xl:h-10 xl:w-10"><Store className="h-4 w-4 text-primary-foreground drop-shadow-sm sm:h-5 sm:w-5" /></div>}
                </div>
                <span className="glitch-text hidden max-w-[9rem] truncate text-sm font-bold tracking-tight min-[420px]:inline md:max-w-[11rem] md:text-base xl:max-w-none xl:text-xl" data-text={shopName}><span className="bg-gradient-to-r from-primary to-white bg-clip-text text-transparent">{shopName}</span></span>
              </div>
            </Link>

            {showSearch && !isAdminPage && <div className="mx-2 hidden max-w-xl flex-1 justify-center lg:flex"><SearchBar value={searchQuery} onChange={onSearchChange} /></div>}

            <div className="flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-1 md:gap-1.5">
              <ThemeToggle />
              {onCartCheckout && <CartDrawer onCheckout={onCartCheckout} />}

              <Link href="/reviews"><Button variant="ghost" className={`${navButtonClass} hidden md:inline-flex`} data-testid="link-reviews"><MessageSquareQuote className="h-4 w-4 shrink-0" /><span className="hidden xl:inline">Reviews</span></Button></Link>
              <Link href="/status"><Button variant="ghost" className={`${navButtonClass} hidden md:inline-flex`} data-testid="link-status"><Activity className="h-4 w-4 shrink-0" /><span className="hidden xl:inline">Status</span></Button></Link>
              <Link href="/redeem-code"><Button variant="ghost" className={`${navButtonClass} hidden md:inline-flex`} data-testid="link-redeem-code"><KeyRound className="h-4 w-4 shrink-0" /><span className="hidden xl:inline">Redeem Code</span></Button></Link>

              {!isLoading && user && <>
                <Link href="/dashboard"><Button variant="ghost" className={`${navButtonClass} hidden md:inline-flex`} data-testid="link-dashboard"><User className="h-4 w-4 shrink-0" /><span className="hidden xl:inline">Account</span></Button></Link>
                <Button variant="ghost" className={`${navButtonClass} hidden md:inline-flex`} onClick={logout} data-testid="button-signout"><LogOut className="h-4 w-4 shrink-0" /><span className="hidden xl:inline">Logout</span></Button>
                {isAdmin && !isAdminPage && <Link href="/admin"><Button variant="ghost" className="hidden h-9 w-9 shrink-0 border border-primary/20 p-0 text-primary hover:border-primary/40 hover:bg-primary/10 hover:text-primary md:inline-flex md:px-0 xl:w-auto xl:px-3 xl:py-2" data-testid="link-admin"><Settings className="h-4 w-4 shrink-0" /><span className="hidden xl:inline">Admin</span></Button></Link>}
                {isAdminPage && <Link href="/"><Button variant="ghost" className={`${navButtonClass} hidden md:inline-flex`} data-testid="link-shop"><Store className="h-4 w-4 shrink-0" /><span className="hidden xl:inline">Shop</span></Button></Link>}
              </>}
              {!isLoading && !user && <>
                <Button variant="ghost" className={`${navButtonClass} hidden md:inline-flex`} onClick={openLogin} data-testid="button-login"><LogIn className="h-4 w-4 shrink-0" /><span className="hidden xl:inline">Sign In</span></Button>
                <Button className="hidden h-9 w-9 shrink-0 bg-gradient-to-r from-primary to-purple-600 p-0 text-white shadow-lg shadow-primary/25 hover:from-primary/90 hover:to-purple-500 md:inline-flex md:px-0 xl:w-auto xl:px-3 xl:py-2" onClick={openRegister} data-testid="button-register"><Sparkles className="h-4 w-4 shrink-0" /><span className="hidden xl:inline">Sign Up</span></Button>
              </>}

              <Sheet open={navOpen} onOpenChange={setNavOpen}>
                <SheetTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 border border-white/10 text-white hover:bg-white/10 md:hidden" aria-label="Open navigation menu" data-testid="button-mobile-nav"><Menu className="h-5 w-5" /></Button></SheetTrigger>
                <SheetContent side="right" className="w-[min(22rem,calc(100vw-1rem))] overflow-y-auto border-l border-primary/20 bg-background p-0">
                  <SheetHeader className="border-b border-border px-5 py-5 text-left"><SheetTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" />{shopName}</SheetTitle></SheetHeader>
                  <nav className="space-y-1 p-3" aria-label="Mobile navigation">
                    <SheetClose asChild><Link href="/"><Button variant="ghost" className="w-full justify-start gap-3" onClick={closeNav}><Store className="h-4 w-4" />Shop</Button></Link></SheetClose>
                    <SheetClose asChild><Link href="/reviews"><Button variant="ghost" className="w-full justify-start gap-3" onClick={closeNav}><MessageSquareQuote className="h-4 w-4" />Reviews</Button></Link></SheetClose>
                    <SheetClose asChild><Link href="/status"><Button variant="ghost" className="w-full justify-start gap-3" onClick={closeNav}><Activity className="h-4 w-4" />Status</Button></Link></SheetClose>
                    <SheetClose asChild><Link href="/redeem-code"><Button variant="ghost" className="w-full justify-start gap-3" onClick={closeNav}><KeyRound className="h-4 w-4" />Redeem code</Button></Link></SheetClose>
                    {!isLoading && user && <>
                      <SheetClose asChild><Link href="/dashboard"><Button variant="ghost" className="w-full justify-start gap-3" onClick={closeNav}><User className="h-4 w-4" />Account</Button></Link></SheetClose>
                      {isAdmin && !isAdminPage && <SheetClose asChild><Link href="/admin"><Button variant="ghost" className="w-full justify-start gap-3 text-primary hover:text-primary" onClick={closeNav}><Settings className="h-4 w-4" />Admin</Button></Link></SheetClose>}
                      {isAdminPage && <SheetClose asChild><Link href="/"><Button variant="ghost" className="w-full justify-start gap-3" onClick={closeNav}><Store className="h-4 w-4" />Shop</Button></Link></SheetClose>}
                      <SheetClose asChild><Button variant="ghost" className="w-full justify-start gap-3" onClick={() => { closeNav(); logout(); }}><LogOut className="h-4 w-4" />Logout</Button></SheetClose>
                    </>}
                    {!isLoading && !user && <div className="mt-3 grid gap-2 border-t border-border pt-3"><SheetClose asChild><Button variant="outline" className="w-full gap-2" onClick={() => { closeNav(); openLogin(); }}><LogIn className="h-4 w-4" />Sign in</Button></SheetClose><SheetClose asChild><Button className="w-full gap-2 bg-gradient-to-r from-primary to-purple-600" onClick={() => { closeNav(); openRegister(); }}><UserPlus className="h-4 w-4" />Create account</Button></SheetClose></div>}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
    </div>
    <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} defaultMode={authMode} />
    <style>{`.glitch-text { position: relative; } .glitch-text::before, .glitch-text::after { content: attr(data-text); position: absolute; top: 0; left: 0; width: 100%; height: 100%; font-weight: bold; letter-spacing: inherit; pointer-events: none; } .glitch-text::before { background: linear-gradient(to right, hsl(var(--primary)), white); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: glitch1 4s infinite linear; } .glitch-text::after { background: linear-gradient(to right, hsl(var(--primary)), white); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: glitch2 4s infinite linear; } @keyframes glitch1 { 0%,87%,91%,93%,95%,100% { clip-path: inset(0); transform: translate(0); opacity: 0; } 88% { clip-path: inset(20% 0 40% 0); transform: translate(-3px,-1px); opacity: 1; } 89% { clip-path: inset(60% 0 10% 0); transform: translate(3px,1px); opacity: 1; } 90% { clip-path: inset(10% 0 70% 0); transform: translate(-1px,2px); opacity: 1; } 92% { clip-path: inset(50% 0 20% 0); transform: translate(2px,-1px); opacity: 1; } 94% { clip-path: inset(30% 0 50% 0); transform: translate(-2px,1px); opacity: 1; } } @keyframes glitch2 { 0%,86%,90%,92%,94%,96%,100% { clip-path: inset(0); transform: translate(0); opacity: 0; } 87% { clip-path: inset(70% 0 5% 0); transform: translate(2px,1px); opacity: 1; } 89% { clip-path: inset(5% 0 60% 0); transform: translate(-3px,-1px); opacity: 1; } 91% { clip-path: inset(40% 0 30% 0); transform: translate(1px,2px); opacity: 1; } 93% { clip-path: inset(15% 0 55% 0); transform: translate(-2px,-1px); opacity: 1; } 95% { clip-path: inset(65% 0 15% 0); transform: translate(3px,-1px); opacity: 1; } }`}</style>
  </>;
}
