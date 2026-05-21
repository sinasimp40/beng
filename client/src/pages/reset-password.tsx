import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Eye, EyeOff, CheckCircle, XCircle, ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token");
    
    if (!tokenParam) {
      setError("Invalid or missing reset token");
      setIsValidating(false);
      return;
    }

    setToken(tokenParam);

    fetch(`/api/auth/verify-reset-token?token=${tokenParam}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setIsValidToken(true);
        } else {
          setError(data.error || "Invalid or expired reset token");
        }
      })
      .catch(() => {
        setError("Failed to verify reset token");
      })
      .finally(() => {
        setIsValidating(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
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

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      setResetSuccess(true);
      toast({
        title: "Password reset successful",
        description: "You can now sign in with your new password.",
      });
    } catch (error) {
      toast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 dot-pattern" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/20 rounded-2xl blur-xl" />
        
        <div className="relative bg-black/90 backdrop-blur-xl border border-primary/20 rounded-2xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
          
          <div className="relative px-8 pt-8 pb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30">
                <KeyRound className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Reset Password</h1>
                <p className="text-sm text-gray-400">Create your new password</p>
              </div>
            </div>
          </div>

          <div className="px-8 pb-8">
            {isValidating ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-gray-400">Verifying reset link...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
                  <XCircle className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Invalid Reset Link</h3>
                <p className="text-gray-400 text-sm mb-6 max-w-xs">{error}</p>
                <Button
                  variant="outline"
                  className="border-gray-800 bg-transparent text-gray-300 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all"
                  onClick={() => setLocation("/")}
                  data-testid="button-back-home"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </div>
            ) : resetSuccess ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Password Reset Complete</h3>
                <p className="text-gray-400 text-sm mb-6 max-w-xs">
                  Your password has been successfully reset. You can now sign in with your new password.
                </p>
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 transition-all duration-200"
                  onClick={() => setLocation("/")}
                  data-testid="button-go-signin"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Go to Sign In
                </Button>
              </div>
            ) : isValidToken ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">New Password</label>
                  <div className="relative group">
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 to-primary/20 opacity-0 group-focus-within:opacity-100 transition-opacity -m-px" />
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3.5 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-11 bg-gray-900/50 border-gray-800 text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20 transition-all"
                        required
                        minLength={6}
                        data-testid="input-new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 text-gray-500 hover:text-primary transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Confirm Password</label>
                  <div className="relative group">
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 to-primary/20 opacity-0 group-focus-within:opacity-100 transition-opacity -m-px" />
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3.5 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 h-11 bg-gray-900/50 border-gray-800 text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20 transition-all"
                        required
                        minLength={6}
                        data-testid="input-confirm-new-password"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 transition-all duration-200"
                    disabled={isLoading}
                    data-testid="button-submit-reset"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-primary transition-colors"
                  onClick={() => setLocation("/")}
                  data-testid="button-back-home"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </form>
            ) : null}
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>
      </div>
    </div>
  );
}
