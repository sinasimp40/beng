import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchBar } from "@/components/search-bar";
import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/lib/auth";
import { useShopSettings } from "@/hooks/use-shop-settings";
import { Store, Settings, LogIn, UserPlus, User, LogOut, Sparkles, MessageSquareQuote, Activity } from "lucide-react";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showSearch?: boolean;
}

export function Header({
  searchQuery,
  onSearchChange,
  showSearch = true,
}: HeaderProps) {
  const [location, setLocation] = useLocation();
  const isAdminPage = location.startsWith("/admin");
  const { user, isAdmin, isLoading, logout } = useAuth();
  const { shopName, shopLogo } = useShopSettings();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const openLogin = () => {
    setAuthMode("login");
    setAuthModalOpen(true);
  };

  const openRegister = () => {
    setAuthMode("register");
    setAuthModalOpen(true);
  };

  return (
    <>
      <div className="sticky top-0 z-50 w-full px-3 sm:px-4 md:px-6 pt-3 sm:pt-4">
        <header className="relative mx-auto max-w-7xl rounded-2xl overflow-hidden shadow-[inset_1px_1px_2px_rgba(255,255,255,0.1),inset_-1px_-1px_2px_rgba(0,0,0,0.5),0_0_30px_-5px_hsl(var(--primary)/0.2),0_4px_12px_-2px_rgba(0,0,0,0.4)]">
          <div className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-2xl" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
          <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          <div className="relative px-4 sm:px-6">
            <div className="flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4">
            <Link href="/">
              <div
                className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer group shrink-0"
                data-testid="link-home"
              >
                <div className="relative shrink-0">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary/40 to-primary/20 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  {shopLogo ? (
                    <img 
                      src={shopLogo} 
                      alt={shopName} 
                      className="relative w-7 h-7 sm:w-10 sm:h-10 rounded-lg object-cover ring-1 ring-white/10 shadow-lg shadow-primary/20" 
                    />
                  ) : (
                    <div className="relative w-7 h-7 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center ring-1 ring-white/20 shadow-lg shadow-primary/30">
                      <Store className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground drop-shadow-sm" />
                    </div>
                  )}
                </div>
                <span className="relative text-sm sm:text-xl font-bold tracking-tight whitespace-nowrap glitch-text" data-text={shopName}>
                  <span className="bg-gradient-to-r from-primary to-white bg-clip-text text-transparent">
                    {shopName}
                  </span>
                </span>
              </div>
            </Link>

            {showSearch && !isAdminPage && (
              <div className="flex-1 flex justify-center max-w-md sm:max-w-xl mx-2">
                <SearchBar value={searchQuery} onChange={onSearchChange} />
              </div>
            )}

            <div className="flex items-center gap-0.5 sm:gap-2">
              <ThemeToggle />
              <Link href="/reviews">
                <Button 
                  variant="ghost" 
                  className="h-9 w-9 p-0 sm:w-auto sm:px-3 sm:py-2 gap-2 text-white/70 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10" 
                  data-testid="link-reviews"
                >
                  <MessageSquareQuote className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Reviews</span>
                </Button>
              </Link>
              <Link href="/status">
                <Button 
                  variant="ghost" 
                  className="h-9 w-9 p-0 sm:w-auto sm:px-3 sm:py-2 gap-2 text-white/70 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10" 
                  data-testid="link-status"
                >
                  <Activity className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Status</span>
                </Button>
              </Link>
              
              {!isLoading && (
                <>
                  {user ? (
                    <>
                      <Link href="/dashboard">
                        <Button 
                          variant="ghost" 
                          className="h-9 w-9 p-0 sm:w-auto sm:px-3 sm:py-2 gap-2 text-white/70 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10" 
                          data-testid="link-dashboard"
                        >
                          <User className="w-4 h-4 shrink-0" />
                          <span className="hidden sm:inline">Account</span>
                        </Button>
                      </Link>
                      <Button 
                        variant="ghost" 
                        className="h-9 w-9 p-0 sm:w-auto sm:px-3 sm:py-2 gap-2 text-white/70 hover:text-white hover:bg-white/5"
                        onClick={logout}
                        data-testid="button-signout"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">Logout</span>
                      </Button>
                      {isAdmin && !isAdminPage && (
                        <Link href="/admin">
                          <Button 
                            variant="ghost" 
                            className="h-9 w-9 p-0 sm:w-auto sm:px-3 sm:py-2 gap-2 text-primary hover:text-primary hover:bg-primary/10 border border-primary/20 hover:border-primary/40" 
                            data-testid="link-admin"
                          >
                            <Settings className="w-4 h-4 shrink-0" />
                            <span className="hidden sm:inline">Admin</span>
                          </Button>
                        </Link>
                      )}
                      {isAdminPage && (
                        <Link href="/">
                          <Button 
                            variant="ghost" 
                            className="h-9 w-9 p-0 sm:w-auto sm:px-3 sm:py-2 gap-2 text-white/70 hover:text-white hover:bg-white/5 border border-white/10 hover:border-white/20" 
                            data-testid="link-shop"
                          >
                            <Store className="w-4 h-4 shrink-0" />
                            <span className="hidden sm:inline">Shop</span>
                          </Button>
                        </Link>
                      )}
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        className="h-9 w-9 p-0 sm:w-auto sm:px-3 sm:py-2 gap-2 text-white/70 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
                        onClick={openLogin}
                        data-testid="button-login"
                      >
                        <LogIn className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">Sign In</span>
                      </Button>
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-lg blur opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                        <Button
                          className="relative gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-500 text-white font-semibold shadow-lg shadow-primary/25 border-0"
                          onClick={openRegister}
                          data-testid="button-register"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span className="hidden sm:inline">Sign Up</span>
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            </div>
          </div>
        </header>
      </div>

      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        defaultMode={authMode}
      />

      <style>{`
        .glitch-text {
          position: relative;
        }
        .glitch-text::before,
        .glitch-text::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          font-weight: bold;
          letter-spacing: inherit;
        }
        .glitch-text::before {
          background: linear-gradient(to right, hsl(var(--primary)), white);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: glitch1 4s infinite linear;
          clip-path: inset(0 0 0 0);
        }
        .glitch-text::after {
          background: linear-gradient(to right, hsl(var(--primary)), white);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: glitch2 4s infinite linear;
          clip-path: inset(0 0 0 0);
        }
        @keyframes glitch1 {
          0%, 87%, 91%, 93%, 95%, 100% {
            clip-path: inset(0 0 0 0);
            transform: translate(0);
            opacity: 0;
          }
          88% {
            clip-path: inset(20% 0 40% 0);
            transform: translate(-3px, -1px);
            opacity: 1;
            text-shadow: 2px 0 hsl(var(--primary)), -1px 0 rgba(0,255,255,0.4);
          }
          89% {
            clip-path: inset(60% 0 10% 0);
            transform: translate(3px, 1px);
            opacity: 1;
            text-shadow: -2px 0 hsl(var(--primary)), 1px 0 rgba(255,0,100,0.3);
          }
          90% {
            clip-path: inset(10% 0 70% 0);
            transform: translate(-1px, 2px);
            opacity: 1;
            text-shadow: 1px 0 rgba(0,255,255,0.5);
          }
          92% {
            clip-path: inset(50% 0 20% 0);
            transform: translate(2px, -1px);
            opacity: 1;
            text-shadow: -1px 0 hsl(var(--primary));
          }
          94% {
            clip-path: inset(30% 0 50% 0);
            transform: translate(-2px, 1px);
            opacity: 1;
            text-shadow: 2px 0 rgba(255,0,100,0.4);
          }
        }
        @keyframes glitch2 {
          0%, 86%, 90%, 92%, 94%, 96%, 100% {
            clip-path: inset(0 0 0 0);
            transform: translate(0);
            opacity: 0;
          }
          87% {
            clip-path: inset(70% 0 5% 0);
            transform: translate(2px, 1px);
            opacity: 1;
            text-shadow: -2px 0 rgba(0,255,255,0.5), 1px 0 hsl(var(--primary));
          }
          89% {
            clip-path: inset(5% 0 60% 0);
            transform: translate(-3px, -1px);
            opacity: 1;
            text-shadow: 2px 0 rgba(255,0,100,0.3);
          }
          91% {
            clip-path: inset(40% 0 30% 0);
            transform: translate(1px, 2px);
            opacity: 1;
            text-shadow: -1px 0 hsl(var(--primary)), 2px 0 rgba(0,255,255,0.4);
          }
          93% {
            clip-path: inset(15% 0 55% 0);
            transform: translate(-2px, -1px);
            opacity: 1;
            text-shadow: 1px 0 rgba(255,0,100,0.5);
          }
          95% {
            clip-path: inset(65% 0 15% 0);
            transform: translate(3px, 1px);
            opacity: 1;
            text-shadow: -2px 0 hsl(var(--primary));
          }
        }
      `}</style>
    </>
  );
}
