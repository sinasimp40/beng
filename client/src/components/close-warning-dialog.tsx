import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, X } from "lucide-react";

interface CloseWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "warning" | "danger";
}

export function CloseWarningDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  title = "Leave This Page?",
  description = "Are you sure you want to close? Any unsaved progress will be lost.",
  confirmText = "Yes, Close",
  cancelText = "Stay Here",
  variant = "warning",
}: CloseWarningDialogProps) {
  const gradientColors = variant === "danger" 
    ? "from-red-500/20 via-red-400/10 to-orange-500/20"
    : "from-primary/20 via-primary/10 to-accent/20";
  
  const iconBgGradient = variant === "danger"
    ? "from-red-500/30 to-orange-500/20"
    : "from-primary/30 to-accent/20";
  
  const iconColor = variant === "danger" ? "text-red-400" : "text-primary";
  const glowColor = variant === "danger" ? "bg-red-500/20" : "bg-primary/20";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[95vw] max-w-sm p-0 bg-white dark:bg-black border border-gray-200 dark:border-[hsl(0_0%_15%)] overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientColors} opacity-30 dark:opacity-50`} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-gradient-to-b from-primary/10 to-transparent blur-2xl" />
        
        <div className="relative p-6">
          <AlertDialogHeader className="space-y-4">
            <div className="flex flex-col items-center">
              <div className="relative mb-2">
                <div className={`absolute inset-0 ${glowColor} blur-xl animate-pulse`} />
                <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${iconBgGradient} border border-gray-200 dark:border-white/10 flex items-center justify-center backdrop-blur-sm`}>
                  <ShieldAlert className={`w-8 h-8 ${iconColor}`} />
                </div>
              </div>
              
              <AlertDialogTitle className="text-center text-xl font-bold text-gray-900 dark:text-white mt-2">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-gray-500 dark:text-[hsl(0_0%_55%)] text-sm mt-2 max-w-[260px]">
                {description}
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          
          <AlertDialogFooter className="flex-col sm:flex-row gap-3 mt-6">
            <AlertDialogCancel 
              onClick={onCancel}
              className="flex-1 h-11 bg-gray-100 dark:bg-[hsl(0_0%_10%)] border-gray-200 dark:border-[hsl(0_0%_20%)] text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-[hsl(0_0%_15%)] hover:text-gray-900 dark:hover:text-white font-medium transition-all duration-200"
              data-testid="button-cancel-close"
            >
              {cancelText}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={onConfirm}
              className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold border-0 shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-primary/30 gap-2"
              data-testid="button-confirm-close"
            >
              <X className="w-4 h-4" />
              {confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
