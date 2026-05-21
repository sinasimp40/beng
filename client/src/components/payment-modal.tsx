import { useState, useEffect, useCallback, useRef } from "react";
import type { Product } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CloseWarningDialog } from "@/components/close-warning-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Clock,
  AlertCircle,
  ArrowLeft,
  Zap,
  PartyPopper,
  Wallet,
  Shield,
  Send,
} from "lucide-react";
import { SiBitcoin, SiEthereum, SiLitecoin, SiDogecoin, SiMonero, SiRipple, SiBinance, SiSolana } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import QRCode from "react-qr-code";

interface ExistingOrder {
  orderId: string;
  productName: string;
  totalAmount: number;
  quantity: number;
  status: string;
  paymentId?: string | null;
  payAddress?: string | null;
  payCurrency?: string | null;
  payAmount?: number | null;
  sentStock?: string | null;
  email?: string | null;
}

interface PaymentModalProps {
  product: Product | null;
  quantity: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentComplete: (paymentId: string) => void;
  existingOrder?: ExistingOrder | null;
}

type ModalStep = "form" | "processing" | "awaiting_payment" | "confirming" | "success" | "error" | "expired";
type CryptoOption = "btc" | "eth" | "ltc" | "usdt" | "doge" | "xmr" | "xrp" | "bnb" | "sol";

interface PaymentData {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  price_amount: number;
  price_currency: string;
  actually_paid?: number;
  order_id?: string;
}

const cryptoOptions: { id: CryptoOption; name: string; icon: React.ReactNode; uriPrefix: string }[] = [
  { id: "btc", name: "Bitcoin", icon: <SiBitcoin className="w-5 h-5 text-orange-500" />, uriPrefix: "bitcoin" },
  { id: "eth", name: "Ethereum", icon: <SiEthereum className="w-5 h-5 text-blue-400" />, uriPrefix: "ethereum" },
  { id: "usdt", name: "USDT", icon: <span className="text-green-500 font-bold text-sm">$</span>, uriPrefix: "usdt" },
  { id: "ltc", name: "Litecoin", icon: <SiLitecoin className="w-5 h-5 text-gray-400" />, uriPrefix: "litecoin" },
  { id: "sol", name: "Solana", icon: <SiSolana className="w-5 h-5 text-purple-400" />, uriPrefix: "solana" },
  { id: "bnb", name: "BNB", icon: <SiBinance className="w-5 h-5 text-yellow-500" />, uriPrefix: "bnb" },
  { id: "xrp", name: "XRP", icon: <SiRipple className="w-5 h-5 text-blue-300" />, uriPrefix: "ripple" },
  { id: "doge", name: "Dogecoin", icon: <SiDogecoin className="w-5 h-5 text-yellow-400" />, uriPrefix: "dogecoin" },
  { id: "xmr", name: "Monero", icon: <SiMonero className="w-5 h-5 text-orange-400" />, uriPrefix: "monero" },
];

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  waiting: { label: "Waiting for payment", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: <Clock className="w-4 h-4" /> },
  pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: <Clock className="w-4 h-4" /> },
  confirming: { label: "Confirming", color: "bg-primary/20 text-primary border-primary/30", icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  confirmed: { label: "Confirmed", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: <CheckCircle2 className="w-4 h-4" /> },
  sending: { label: "Processing", color: "bg-primary/20 text-primary border-primary/30", icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  partially_paid: { label: "Partially paid", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: <AlertCircle className="w-4 h-4" /> },
  finished: { label: "Complete", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: <CheckCircle2 className="w-4 h-4" /> },
  completed: { label: "Complete", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: <CheckCircle2 className="w-4 h-4" /> },
  failed: { label: "Failed", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: <XCircle className="w-4 h-4" /> },
  expired: { label: "Expired", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: <XCircle className="w-4 h-4" /> },
  refunded: { label: "Refunded", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: <AlertCircle className="w-4 h-4" /> },
};

export function PaymentModal({
  product,
  quantity,
  open,
  onOpenChange,
  onPaymentComplete,
  existingOrder,
}: PaymentModalProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoOption>("btc");
  const [step, setStep] = useState<ModalStep>("form");
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [orderId, setOrderId] = useState("");
  const [sentStock, setSentStock] = useState<string | null>(null);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && user?.email && !email) {
      setEmail(user.email);
    }
  }, [open, user?.email]);

  const resumePaymentIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      stopPolling();
      resumePaymentIdRef.current = null;
      return;
    }
    if (open && existingOrder) {
      stopPolling();
      setOrderId(existingOrder.orderId);
      setEmail(existingOrder.email || "");
      setSentStock(existingOrder.sentStock || null);
      if (existingOrder.payAddress && existingOrder.payAmount && existingOrder.payCurrency) {
        setPaymentData({
          payment_id: existingOrder.paymentId || "",
          payment_status: existingOrder.status,
          pay_address: existingOrder.payAddress,
          pay_amount: existingOrder.payAmount,
          pay_currency: existingOrder.payCurrency,
          price_amount: existingOrder.totalAmount,
          price_currency: "usd",
          order_id: existingOrder.orderId,
        });
      } else {
        setPaymentData(null);
      }
      const s = existingOrder.status;
      if (s === "finished" || s === "completed") {
        setStep("success");
      } else if (s === "confirming" || s === "sending" || s === "confirmed") {
        setStep("confirming");
        if (existingOrder.paymentId) {
          resumePaymentIdRef.current = existingOrder.paymentId;
        }
      } else if (s === "failed") {
        setStep("error");
        setErrorMessage("Payment failed.");
      } else if (s === "expired") {
        setStep("expired");
      } else if (s === "refunded") {
        setStep("expired");
      } else if (s === "waiting" || s === "pending") {
        setStep("awaiting_payment");
        if (existingOrder.paymentId) {
          resumePaymentIdRef.current = existingOrder.paymentId;
        }
      } else {
        setStep("awaiting_payment");
      }
    } else if (open && !existingOrder) {
      setStep("form");
      setPaymentData(null);
      setErrorMessage("");
      setOrderId("");
      setSentStock(null);
    }
  }, [open, existingOrder]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const totalAmount = existingOrder ? existingOrder.totalAmount : (product ? product.price * quantity : 0);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const fetchOrderStock = useCallback(async (orderIdToFetch: string) => {
    try {
      // Poll a few times to allow backend to process and send stock
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const response = await fetch(`/api/orders/${encodeURIComponent(orderIdToFetch)}`);
        if (response.ok) {
          const data = await response.json();
          // Handle both wrapped { order: {...} } and direct order response
          const orderData = data.order || data;
          if (orderData.sentStock) {
            setSentStock(orderData.sentStock);
            return;
          }
        }
      }
    } catch (error) {
      console.error("Error fetching order stock:", error);
    }
  }, []);

  const handleStatusUpdate = useCallback((status: PaymentData) => {
    setPaymentData(prev => {
      if (!prev) return status;
      return {
        ...prev,
        ...status,
        order_id: prev.order_id,
      };
    });
    
    const paymentStatus = status.payment_status;
    
    if (paymentStatus === "finished") {
      setStep("success");
      stopPolling();
      if (status.payment_id) {
        onPaymentComplete(status.payment_id.toString());
      }
      // Fetch the order to get the sent stock
      if (status.order_id) {
        fetchOrderStock(status.order_id);
      }
    } else if (paymentStatus === "confirming" || paymentStatus === "sending" || paymentStatus === "confirmed") {
      setStep("confirming");
    } else if (paymentStatus === "failed") {
      setStep("error");
      setErrorMessage("Payment failed. Please try again.");
      stopPolling();
    } else if (paymentStatus === "expired") {
      setStep("expired");
      stopPolling();
    }
  }, [onPaymentComplete, stopPolling, fetchOrderStock]);

  const pollPaymentStatus = useCallback(async (paymentId: string) => {
    try {
      const response = await fetch(`/api/payments/${paymentId}/poll`);
      if (response.ok) {
        const status = await response.json();
        handleStatusUpdate(status);
      }
    } catch (error) {
      console.error("Error polling payment status:", error);
    }
  }, [handleStatusUpdate]);

  const startPolling = useCallback((paymentId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    pollingRef.current = setInterval(() => {
      pollPaymentStatus(paymentId);
    }, 5000);
    
    pollPaymentStatus(paymentId);
  }, [pollPaymentStatus]);

  const connectWebSocket = useCallback((paymentId: string) => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/payments`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "subscribe", paymentId }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "payment_status" && data.status) {
            handleStatusUpdate(data.status);
          }
        } catch (e) {
          console.error("WebSocket message parse error:", e);
        }
      };
      
      ws.onerror = () => {
        startPolling(paymentId);
      };
      
      ws.onclose = () => {
        if (step === "awaiting_payment" || step === "confirming") {
          startPolling(paymentId);
        }
      };
    } catch (e) {
      startPolling(paymentId);
    }
  }, [handleStatusUpdate, startPolling, step]);

  useEffect(() => {
    if (resumePaymentIdRef.current && open) {
      const pid = resumePaymentIdRef.current;
      resumePaymentIdRef.current = null;
      connectWebSocket(pid);
    }
  }, [open, step, connectWebSocket]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const isResumedOrder = !!existingOrder;
  const getFullProductName = () => {
    if (existingOrder?.productName) return existingOrder.productName;
    if (!product) return "";
    if (product.parentId && product.category?.trim()) {
      return `${product.name} - ${product.category.trim()}`;
    }
    return product.name;
  };
  const displayName = getFullProductName();
  const displayQuantity = existingOrder?.quantity || quantity;

  if (!product && !existingOrder) return null;

  const handleCreatePayment = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setStep("processing");

    try {
      const newOrderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setOrderId(newOrderId);
      
      const response = await apiRequest("POST", "/api/payments/create", {
        amount: totalAmount,
        currency: selectedCrypto,
        orderId: newOrderId,
        email,
        productName: displayName,
        productId: product?.id,
        quantity,
      });

      const payment = await response.json();
      setPaymentData({ ...payment, order_id: newOrderId });
      setStep("awaiting_payment");
      
      connectWebSocket(payment.payment_id);
      startPolling(payment.payment_id);
      
    } catch (error: any) {
      console.error("Payment creation error:", error);
      setStep("error");
      const msg = error.message || "Failed to create payment. Please try again.";
      setErrorMessage(msg.includes("<") || msg.length > 300 ? "Failed to create payment. Please try again." : msg);
    }
  };

  const copyAddress = () => {
    if (paymentData?.pay_address) {
      navigator.clipboard.writeText(paymentData.pay_address);
      toast({
        title: "Address copied",
        description: "Payment address copied to clipboard",
      });
    }
  };

  const copyAmount = () => {
    if (paymentData?.pay_amount) {
      navigator.clipboard.writeText(paymentData.pay_amount.toString());
      toast({
        title: "Amount copied",
        description: "Payment amount copied to clipboard",
      });
    }
  };

  const resetModal = () => {
    stopPolling();
    setStep("form");
    setEmail("");
    setPaymentData(null);
    setErrorMessage("");
    setOrderId("");
    setSentStock(null);
    onOpenChange(false);
  };

  const copyOrderId = () => {
    if (orderId) {
      navigator.clipboard.writeText(orderId);
      toast({
        title: "Order ID copied",
        description: "Order ID copied to clipboard",
      });
    }
  };

  const handleClose = () => {
    // Allow immediate close for success, error, expired states
    if (step === "success" || step === "error" || step === "expired") {
      resetModal();
      return;
    }
    // Show warning for other states
    setShowCloseWarning(true);
  };

  const handleConfirmClose = () => {
    setShowCloseWarning(false);
    if (step === "awaiting_payment" || step === "confirming") {
      toast({
        title: "Payment in progress",
        description: "Your payment is being processed. You can close this window and check your email for confirmation.",
      });
    }
    resetModal();
  };

  const handleCancelClose = () => {
    setShowCloseWarning(false);
  };

  const selectedCryptoInfo = cryptoOptions.find(c => c.id === selectedCrypto);
  const currentStatus = paymentData?.payment_status
    ? (statusConfig[paymentData.payment_status] || statusConfig.waiting)
    : statusConfig.waiting;

  // Generate crypto URI with address and amount
  const generateCryptoUri = () => {
    if (!paymentData?.pay_address || !paymentData?.pay_amount) {
      return paymentData?.pay_address || "";
    }
    const cryptoInfo = cryptoOptions.find(c => c.id === selectedCrypto);
    const prefix = cryptoInfo?.uriPrefix || selectedCrypto;
    return `${prefix}:${paymentData.pay_address}?amount=${paymentData.pay_amount}`;
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-black border border-gray-200 dark:border-primary/20 p-0 shadow-lg shadow-primary/10">
        {step === "form" && (
          <>
            <div className="relative overflow-hidden p-5 sm:p-6 border-b border-gray-100 dark:border-white/[0.06]">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-transparent to-purple-600/[0.04]" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <DialogHeader className="relative">
                <DialogTitle className="flex items-center gap-3 text-lg text-gray-900 dark:text-white">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-primary/20 rounded-xl blur-sm" />
                    <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                      <Wallet className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <div>
                    <span className="block">Secure Checkout</span>
                    <DialogDescription className="text-gray-500 dark:text-[hsl(0_0%_45%)] flex items-center gap-1.5 mt-0.5 text-xs font-normal">
                      <Shield className="w-3 h-3 text-primary/70" />
                      Fast, secure cryptocurrency payment
                    </DialogDescription>
                  </div>
                </DialogTitle>
              </DialogHeader>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <div className="relative rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-[hsl(0_0%_9%)] dark:to-[hsl(0_0%_6%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_0%,hsl(var(--primary)/0.06),transparent_60%)]" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
                <div className="absolute inset-0 border border-gray-200 dark:border-white/[0.06] rounded-xl pointer-events-none" />
                <div className="relative p-4 space-y-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 dark:text-[hsl(0_0%_40%)] uppercase tracking-widest font-medium mb-1">Product</p>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight truncate">{displayName}</p>
                    </div>
                    <div className="flex-shrink-0 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
                      <span className="text-xs font-bold text-primary tabular-nums">x{displayQuantity}</span>
                    </div>
                  </div>
                  <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/[0.06] to-transparent" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 dark:text-[hsl(0_0%_45%)]">Total Amount</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-primary/60 font-medium">$</span>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums" data-testid="text-payment-total">
                        {totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-gray-500 dark:text-[hsl(0_0%_60%)] font-medium">Email Address</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/[0.08] focus:border-primary/40 focus:ring-primary/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[hsl(0_0%_30%)]"
                    data-testid="input-email"
                  />
                </div>
                <p className="text-[11px] text-gray-400 dark:text-[hsl(0_0%_35%)]">Order confirmation will be sent here</p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm text-gray-500 dark:text-[hsl(0_0%_60%)] font-medium">Payment Method</Label>
                <div className="grid grid-cols-3 gap-2">
                  {cryptoOptions.map((crypto) => (
                    <button
                      key={crypto.id}
                      onClick={() => setSelectedCrypto(crypto.id)}
                      className={`
                        relative flex flex-col items-center gap-2 py-3 px-2 rounded-xl border transition-all duration-200
                        ${selectedCrypto === crypto.id 
                          ? "bg-primary/[0.08] border-primary/30 shadow-[0_0_20px_-4px] shadow-primary/20" 
                          : "bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] hover-elevate"
                        }
                      `}
                      data-testid={`button-crypto-${crypto.id}`}
                    >
                      {selectedCrypto === crypto.id && (
                        <div className="absolute top-1.5 right-1.5">
                          <div className="relative flex items-center justify-center w-2.5 h-2.5">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-40 animate-ping" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                          </div>
                        </div>
                      )}
                      <div className={`transition-transform duration-200 ${selectedCrypto === crypto.id ? "scale-110" : ""}`}>
                        {crypto.icon}
                      </div>
                      <span className={`text-[11px] font-medium transition-colors ${selectedCrypto === crypto.id ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-[hsl(0_0%_45%)]"}`}>
                        {crypto.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleCreatePayment}
                size="lg"
                className="w-full gap-2.5 bg-primary text-white font-bold uppercase tracking-wider text-sm shadow-lg shadow-primary/25"
                data-testid="button-create-payment"
              >
                <Send className="w-4 h-4" />
                Create Payment
              </Button>
            </div>
          </>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
              <Loader2 className="w-14 h-14 text-primary animate-spin relative" />
            </div>
            <p className="text-gray-900 dark:text-white font-semibold mt-6 text-lg">Creating Payment</p>
            <p className="text-gray-500 text-center text-sm mt-2">
              Generating your secure payment address...
            </p>
          </div>
        )}

        {(step === "awaiting_payment" || step === "confirming") && paymentData && (
          <>
            {/* Minimal Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 flex items-center justify-center">
                  {selectedCryptoInfo?.icon}
                </div>
                <div>
                  <h3 className="text-gray-900 dark:text-white font-semibold text-lg">Send {selectedCrypto.toUpperCase()}</h3>
                  <button 
                    onClick={copyOrderId}
                    className="text-xs text-gray-500 hover:text-gray-400 font-mono transition-colors"
                  >
                    {orderId}
                  </button>
                </div>
              </div>
              <Badge className={`${currentStatus.color} border gap-1.5 px-2.5 py-1 text-xs`}>
                {currentStatus.icon}
                <span className="hidden sm:inline">{currentStatus.label}</span>
              </Badge>
            </div>

            {/* Main Content - Two Column Layout */}
            <div className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                {/* Left Column - QR Code */}
                <div className="flex flex-col items-center mx-auto sm:mx-0">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-2xl blur-sm opacity-75 group-hover:opacity-100 transition-opacity" />
                    <div className="relative p-3 rounded-xl bg-white">
                      <QRCode 
                        value={generateCryptoUri()} 
                        size={130}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#000000"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-2 text-center">Scan with wallet</p>
                </div>

                {/* Right Column - Amount Details */}
                <div className="flex-1 flex flex-col justify-center space-y-4">
                  {/* Amount */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Amount</span>
                      <button 
                        onClick={copyAmount}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {paymentData.pay_amount}
                      </span>
                      <span className="text-base font-medium text-primary">
                        {paymentData.pay_currency?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      ≈ ${paymentData.price_amount?.toFixed(2)} USD
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800" />

                  {/* Status */}
                  {step === "confirming" ? (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                        <div className="relative w-2 h-2 rounded-full bg-primary" />
                      </div>
                      <span className="text-xs text-primary font-medium">Confirming payment...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-yellow-400/30 animate-pulse" />
                        <div className="relative w-2 h-2 rounded-full bg-yellow-400" />
                      </div>
                      <span className="text-xs text-yellow-400 font-medium">Waiting for payment</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Address Section - Full Width Below */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Wallet Address</span>
                  <button 
                    onClick={copyAddress}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative px-3 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800/80">
                    <code className="text-[11px] break-all text-gray-400 font-mono block leading-relaxed select-all">
                      {paymentData.pay_address}
                    </code>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-center gap-1.5 mt-5 pt-4 border-t border-gray-200 dark:border-gray-800/50">
                <Zap className="w-3 h-3 text-primary/70" />
                <span className="text-[10px] text-gray-600">Auto-updates when payment received</span>
              </div>
            </div>
          </>
        )}

        {step === "success" && (
          <div className="p-8 text-center space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-green-500/20 blur-xl animate-pulse" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-500/30 to-green-500/10 border border-green-500/30 flex items-center justify-center">
                  <PartyPopper className="w-10 h-10 text-green-400" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">
                Payment Successful
              </h3>
              <p className="text-gray-400 mt-2">
                Your order has been confirmed
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-5 text-left space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Order ID</span>
                <span className="text-primary font-mono text-xs">{orderId}</span>
              </div>
              <div className="h-px bg-gray-200 dark:bg-gray-800" />
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Product</span>
                <span className="text-gray-900 dark:text-white font-medium text-right max-w-[180px] truncate">{displayName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Quantity</span>
                <span className="text-gray-900 dark:text-white font-medium">{displayQuantity}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount Paid</span>
                <span className="text-primary font-medium">
                  {paymentData?.pay_amount} {paymentData?.pay_currency?.toUpperCase()}
                </span>
              </div>
              <div className="h-px bg-gray-200 dark:bg-gray-800" />
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Email</span>
                <span className="text-gray-900 dark:text-white font-medium">{email}</span>
              </div>
              {sentStock && (
                <>
                  <div className="h-px bg-gray-200 dark:bg-gray-800" />
                  <div className="space-y-2">
                    <span className="text-xs text-green-400 uppercase tracking-wider font-medium">Your Item</span>
                    <div className="bg-gray-100 dark:bg-gray-950/80 border border-primary/20 rounded-lg p-3">
                      <code className="text-primary font-mono text-sm whitespace-pre-wrap break-all block">
                        {sentStock}
                      </code>
                    </div>
                  </div>
                </>
              )}
            </div>

            <p className="text-xs text-gray-500">
              Order confirmation has been sent to your email
            </p>

            <Button
              onClick={resetModal}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              size="lg"
              data-testid="button-done"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Done
            </Button>
          </div>
        )}

        {step === "error" && (
          <div className="p-8 text-center space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500/30 to-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-red-400" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">
                Payment Failed
              </h3>
              <p className="text-gray-400 mt-2">
                {errorMessage}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={resetModal}
                className="flex-1 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setStep("form")}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        )}

        {step === "expired" && (
          <div className="p-8 text-center space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gray-500/20 blur-xl" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-gray-500/30 to-gray-500/10 border border-gray-500/30 flex items-center justify-center">
                  <Clock className="w-10 h-10 text-gray-400" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mt-6">
                {existingOrder?.status === "refunded" ? "Payment Refunded" : "Payment Expired"}
              </h3>
              <p className="text-gray-400 mt-2">
                {existingOrder?.status === "refunded"
                  ? "This payment has been refunded. No further action is available."
                  : "This payment has expired. No further action is available."}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={resetModal}
                className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <CloseWarningDialog
      open={showCloseWarning}
      onOpenChange={setShowCloseWarning}
      onConfirm={handleConfirmClose}
      onCancel={handleCancelClose}
      title={step === "awaiting_payment" || step === "confirming" ? "Cancel Payment?" : "Leave Checkout?"}
      description={step === "awaiting_payment" || step === "confirming" 
        ? "Your payment is being processed. You can close and check your email for confirmation."
        : "Are you sure you want to close? Your checkout progress will be lost."
      }
    />
    </>
  );
}
