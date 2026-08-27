import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { useThemeColors } from "@/hooks/use-theme-colors";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import Dashboard from "@/pages/dashboard";
import ResetPassword from "@/pages/reset-password";
import Reviews from "@/pages/reviews";
import StatusPage from "@/pages/status";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={Admin} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/reviews" component={Reviews} />
      <Route path="/status" component={StatusPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ThemeColorsProvider({ children }: { children: React.ReactNode }) {
  useThemeColors();
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeColorsProvider>
          <AuthProvider>
            <CartProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </CartProvider>
          </AuthProvider>
        </ThemeColorsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
