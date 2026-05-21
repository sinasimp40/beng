import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CloseWarningDialog } from "@/components/close-warning-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Loader2, Mail, Lock, Eye, EyeOff, User, Shield, ArrowRight, ArrowLeft, KeyRound } from "lucide-react";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: "login" | "register";
}

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      render: (container: string | HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'expired-callback': () => void;
        'error-callback'?: () => void;
        theme?: string;
      }) => number;
      reset: (widgetId?: number) => void;
      getResponse: (widgetId?: number) => string;
    };
    onRecaptchaLoad?: () => void;
  }
}

let recaptchaScriptLoaded = false;
let recaptchaScriptLoading = false;

export function AuthModal({ open, onOpenChange, defaultMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [recaptchaKey, setRecaptchaKey] = useState(0); // Force re-mount of container
  
  const currentWidgetId = useRef<number | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  const { login, register } = useAuth();
  const { toast } = useToast();

  const handleClose = (newOpen: boolean) => {
    if (!newOpen && open) {
      // Only show warning if user has entered any data
      if (email || password || confirmPassword) {
        setShowCloseWarning(true);
      } else {
        onOpenChange(false);
      }
    } else {
      onOpenChange(newOpen);
    }
  };

  const handleConfirmClose = () => {
    setShowCloseWarning(false);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    onOpenChange(false);
  };

  const handleCancelClose = () => {
    setShowCloseWarning(false);
  };

  useEffect(() => {
    fetch("/api/settings/recaptcha")
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) throw new Error("Non-JSON response");
        return res.json();
      })
      .then(data => {
        if (data.siteKey) {
          setRecaptchaSiteKey(data.siteKey);
        }
      })
      .catch(() => {});
  }, []);

  // Load reCAPTCHA script
  useEffect(() => {
    if (!recaptchaSiteKey || recaptchaScriptLoaded || recaptchaScriptLoading) return;

    recaptchaScriptLoading = true;
    
    window.onRecaptchaLoad = () => {
      console.log("reCAPTCHA script loaded");
      recaptchaScriptLoaded = true;
      recaptchaScriptLoading = false;
    };
    
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit";
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.error("Failed to load reCAPTCHA script");
      recaptchaScriptLoading = false;
    };
    document.head.appendChild(script);
  }, [recaptchaSiteKey]);

  // Render reCAPTCHA when mode/key changes or modal opens
  useEffect(() => {
    if (!open || !recaptchaSiteKey) return;
    if (mode === "forgot" && forgotPasswordSent) return;

    let cancelled = false;
    let timeoutId: number;
    let retryCount = 0;
    const maxRetries = 20;

    const attemptRender = () => {
      if (cancelled) return;
      
      // Use unique ID to find the exact container for this render attempt
      const container = document.getElementById(`recaptcha-widget-${recaptchaKey}`) as HTMLElement;
      
      // Check if container exists and grecaptcha is ready
      if (!container || !window.grecaptcha || !window.grecaptcha.render) {
        retryCount++;
        if (retryCount < maxRetries) {
          timeoutId = window.setTimeout(attemptRender, 100);
        }
        return;
      }

      // Skip if already has a widget (check for children)
      if (container.children.length > 0) {
        console.log(`reCAPTCHA already rendered for ${mode}, skipping`);
        return;
      }

      try {
        console.log(`Rendering reCAPTCHA for ${mode}, attempt ${retryCount + 1}`);
        const id = window.grecaptcha.render(container, {
          sitekey: recaptchaSiteKey,
          callback: (token: string) => {
            if (!cancelled) setRecaptchaToken(token);
          },
          'expired-callback': () => {
            if (!cancelled) setRecaptchaToken("");
          },
          'error-callback': () => {
            if (!cancelled) {
              console.log(`reCAPTCHA challenge closed for ${mode}, resetting widget`);
              setRecaptchaToken("");
              // Reset the widget so user can try again
              if (currentWidgetId.current !== null && window.grecaptcha) {
                try {
                  window.grecaptcha.reset(currentWidgetId.current);
                } catch (e) {
                  // Ignore reset errors
                }
              }
            }
          },
          theme: 'dark'
        });
        currentWidgetId.current = id;
        console.log(`reCAPTCHA rendered for ${mode}, widget ID: ${id}`);
      } catch (e: any) {
        console.error("reCAPTCHA render error:", e?.message || e);
        // Retry on error (but not too many times)
        retryCount++;
        if (!cancelled && retryCount < maxRetries) {
          timeoutId = window.setTimeout(attemptRender, 200);
        }
      }
    };

    // Give React time to mount the new container element
    timeoutId = window.setTimeout(attemptRender, 150);

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [open, recaptchaSiteKey, mode, recaptchaKey, forgotPasswordSent]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!open) {
      setRecaptchaToken("");
      currentWidgetId.current = null;
      // Increment key so next open gets fresh container
      setRecaptchaKey(prev => prev + 1);
    }
  }, [open]);

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  const handleModeChange = (newMode: "login" | "register" | "forgot") => {
    // Increment the key to force React to create a new container element
    // This solves the reCAPTCHA re-render issue completely
    setRecaptchaKey(prev => prev + 1);
    currentWidgetId.current = null;
    setRecaptchaToken("");
    setForgotPasswordSent(false);
    setMode(newMode);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    if (recaptchaSiteKey && !recaptchaToken) {
      toast({
        title: "Please complete the reCAPTCHA",
        description: "Verify that you're not a robot.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          recaptchaToken: recaptchaSiteKey ? recaptchaToken : "no-recaptcha-configured",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reset email");
      }

      setForgotPasswordSent(true);
      toast({
        title: "Reset link sent",
        description: "Check your email for the password reset link.",
      });
    } catch (error) {
      toast({
        title: "Failed to send reset email",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      // Reset reCAPTCHA on error
      if (currentWidgetId.current !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(currentWidgetId.current);
        } catch (e) {
          console.error("reCAPTCHA reset error:", e);
        }
      }
      setRecaptchaToken("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "register" && password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (recaptchaSiteKey && !recaptchaToken) {
      toast({
        title: "Please complete the reCAPTCHA",
        description: "Verify that you're not a robot.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const tokenToSend = recaptchaSiteKey ? recaptchaToken : "no-recaptcha-configured";

      if (mode === "login") {
        await login(email, password, tokenToSend);
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
      } else {
        await register(email, password, tokenToSend);
        toast({
          title: "Account created!",
          description: "Welcome! Your account has been created.",
        });
      }

      onOpenChange(false);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRecaptchaToken("");
    } catch (error) {
      toast({
        title: mode === "login" ? "Login failed" : "Registration failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      // Reset reCAPTCHA on error
      if (currentWidgetId.current !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(currentWidgetId.current);
        } catch (e) {
          console.error("reCAPTCHA reset error:", e);
        }
      }
      setRecaptchaToken("");
    } finally {
      setIsLoading(false);
    }
  };

  // reCAPTCHA container - uses key to force fresh container on mode change
  const renderRecaptchaContainer = () => {
    if (!recaptchaSiteKey) return null;
    if (mode === "forgot" && forgotPasswordSent) return null;
    
    return (
      <div className="flex justify-center items-center py-3">
        <div 
          key={`recaptcha-${mode}-${recaptchaKey}`}
          ref={recaptchaContainerRef}
          data-recaptcha-key={recaptchaKey}
          data-testid={`recaptcha-container-${mode}`}
          id={`recaptcha-widget-${recaptchaKey}`}
          className="recaptcha-wrapper"
          style={{ minHeight: '78px', minWidth: '304px' }}
        />
      </div>
    );
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="w-[95vw] max-w-[420px] max-h-[90vh] overflow-y-auto p-0 border-primary/20 bg-white dark:bg-black/95 backdrop-blur-xl"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('iframe') || 
              target.closest('[title*="recaptcha"]') ||
              target.closest('div[style*="z-index"]')) {
            e.preventDefault();
          }
        }}
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('iframe') || 
              target.closest('[title*="recaptcha"]') ||
              target.closest('div[style*="z-index"]')) {
            e.preventDefault();
          }
        }}
      >
        {/* Header with gradient accent */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
          
          <div className="relative px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30">
                {mode === "login" ? (
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                ) : mode === "register" ? (
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                ) : (
                  <KeyRound className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                )}
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  {mode === "login" ? "Welcome Back" : mode === "register" ? "Create Account" : "Reset Password"}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {mode === "login" ? "Sign in to continue" : mode === "register" ? "Join our community" : "We'll send you a reset link"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="px-4 sm:px-8 pb-6 sm:pb-8">
          {/* Forgot Password Mode */}
          {mode === "forgot" ? (
            forgotPasswordSent ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Check Your Email</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  We've sent a password reset link to<br />
                  <span className="text-primary font-medium">{email}</span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="border-border bg-transparent text-foreground/70 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all"
                  onClick={() => handleModeChange("login")}
                  data-testid="button-back-to-login"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4 sm:space-y-5">
                {/* Email Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">Email Address</label>
                  <div className="relative group">
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 to-primary/20 opacity-0 group-focus-within:opacity-100 transition-opacity -m-px" />
                    <div className="relative flex items-center">
                      <Mail className="absolute left-3.5 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20 transition-all"
                        required
                        data-testid="input-forgot-email"
                      />
                    </div>
                  </div>
                </div>

                {/* reCAPTCHA above Submit Button */}
                {renderRecaptchaContainer()}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 transition-all duration-200 group"
                  disabled={isLoading || (!!recaptchaSiteKey && !recaptchaToken)}
                  data-testid="button-submit-forgot"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      Send Reset Link
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  )}
                </Button>

                {/* Back to Login */}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => handleModeChange("login")}
                  data-testid="button-back-to-login"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </form>
            )
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                {/* Email Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">Email Address</label>
                  <div className="relative group">
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 to-primary/20 opacity-0 group-focus-within:opacity-100 transition-opacity -m-px" />
                    <div className="relative flex items-center">
                      <Mail className="absolute left-3.5 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20 transition-all"
                        required
                        data-testid="input-email"
                      />
                    </div>
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground/80">Password</label>
                    {mode === "login" && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                        onClick={() => handleModeChange("forgot")}
                        data-testid="button-forgot-password"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 to-primary/20 opacity-0 group-focus-within:opacity-100 transition-opacity -m-px" />
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3.5 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-11 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20 transition-all"
                        required
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Confirm Password Field (Register Only) */}
                {mode === "register" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/80">Confirm Password</label>
                    <div className="relative group">
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 to-primary/20 opacity-0 group-focus-within:opacity-100 transition-opacity -m-px" />
                      <div className="relative flex items-center">
                        <Lock className="absolute left-3.5 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          placeholder="Confirm your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10 h-11 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20 transition-all"
                          required
                          data-testid="input-confirm-password"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* reCAPTCHA above Submit Button */}
                {renderRecaptchaContainer()}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 transition-all duration-200 group"
                  disabled={isLoading || (!!recaptchaSiteKey && !recaptchaToken)}
                  data-testid="button-submit-auth"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      {mode === "login" ? "Sign In" : "Create Account"}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white dark:bg-black/95 text-muted-foreground">
                    {mode === "login" ? "New here?" : "Already have an account?"}
                  </span>
                </div>
              </div>

              {/* Toggle Mode Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-border bg-transparent text-foreground/70 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => handleModeChange(mode === "login" ? "register" : "login")}
                data-testid="button-toggle-mode"
              >
                {mode === "login" ? "Create an Account" : "Sign In Instead"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <CloseWarningDialog
      open={showCloseWarning}
      onOpenChange={setShowCloseWarning}
      onConfirm={handleConfirmClose}
      onCancel={handleCancelClose}
      title="Leave Sign In?"
      description="You have unsaved information. Are you sure you want to close?"
    />
    </>
  );
}
