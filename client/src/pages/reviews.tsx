import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Review } from "@shared/schema";
import { Header } from "@/components/header";
import { ParticleBackground } from "@/components/particle-background";
import { SocialWidget } from "@/components/social-widget";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, Quote, CheckCircle2, ThumbsUp, Send, ChevronLeft, ChevronRight, AlertCircle, Loader2, MessageSquarePlus, ShieldCheck, ArrowRight } from "lucide-react";
import { useReviewUpdates } from "@/hooks/use-review-updates";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const REVIEWS_PER_PAGE = 24;

function StarRating({ rating, size = "sm", animate = false }: { rating: number; size?: "sm" | "md"; animate?: boolean }) {
  const sizeClasses = { sm: "w-3.5 h-3.5", md: "w-5 h-5" };
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClasses[size]} transition-all duration-300 ${star <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`}
          style={animate && star <= rating ? { animation: `starPop 0.4s ease-out ${star * 0.1}s both` } : undefined}
        />
      ))}
    </div>
  );
}


function ReviewForm() {
  const [step, setStep] = useState<"order" | "review" | "success">("order");
  const [orderId, setOrderId] = useState("");
  const [verifiedOrderId, setVerifiedOrderId] = useState("");
  const [productName, setProductName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/reviews/verify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Verification failed");
      return json;
    },
    onSuccess: (data) => {
      setVerifiedOrderId(orderId.trim());
      setProductName(data.productName || "");
      setError("");
      setStep("review");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { orderId: string; rating: number; comment: string }) => {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit review");
      return json;
    },
    onSuccess: () => {
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      setTimeout(() => {
        setStep("order");
        setOrderId("");
        setVerifiedOrderId("");
        setRating(5);
        setComment("");
        setError("");
      }, 3000);
    },
    onError: (err: Error) => {
      toast({ title: "Unable to submit", description: err.message, variant: "destructive" });
    },
  });

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!orderId.trim()) {
      setError("Please enter your Order ID");
      return;
    }
    verifyMutation.mutate(orderId.trim());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim().length < 3) {
      setError("Please write at least 3 characters");
      return;
    }
    setError("");
    submitMutation.mutate({ orderId: verifiedOrderId, rating, comment: comment.trim() });
  };

  return (
    <Card className="relative overflow-hidden border border-primary/10 bg-card/80 backdrop-blur-sm mb-10" data-testid="review-form">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.05),transparent_60%)]" />
      </div>

      <div className="relative p-5 sm:p-6">
        {step === "success" ? (
          <div className="flex flex-col items-center justify-center py-4 gap-3" style={{ animation: "fadeInUp 0.4s ease-out" }}>
            <div className="relative">
              <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl scale-150 animate-pulse" />
              <div className="relative w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Review Submitted!</p>
              <p className="text-xs text-muted-foreground mt-0.5">Thank you for sharing your experience</p>
            </div>
          </div>
        ) : step === "review" ? (
          <div style={{ animation: "fadeInUp 0.35s ease-out" }} data-testid="review-form-step2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-green-500">Order Verified</p>
                  <p className="text-[11px] text-muted-foreground">{productName}</p>
                </div>
              </div>
              <button
                onClick={() => { setStep("order"); setError(""); }}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
                data-testid="button-back-to-order"
              >
                <ChevronLeft className="w-3 h-3" /> Change
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Your Rating</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      data-testid={`star-select-${star}`}
                      className="transition-all duration-200 hover:scale-125 active:scale-90"
                      onClick={() => setRating(star)}
                    >
                      <Star className={`w-6 h-6 transition-all duration-200 ${star <= rating ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.4)]" : "text-muted-foreground/20 hover:text-yellow-400/40"}`} />
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground ml-2">{rating}/5</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Your Review</label>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Share your experience..."
                      value={comment}
                      onChange={(e) => { setComment(e.target.value); setError(""); }}
                      maxLength={500}
                      className="bg-background/50 border-border h-10 text-sm"
                      data-testid="input-review-comment"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/30">{comment.length}/500</span>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitMutation.isPending}
                    className="h-10 px-4 gap-1.5 shrink-0"
                    data-testid="button-submit-review"
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <><Send className="w-3.5 h-3.5" /> Submit</>
                    )}
                  </Button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-destructive flex items-center gap-1" style={{ animation: "fadeInUp 0.2s ease-out" }}>
                  <AlertCircle className="w-3 h-3 shrink-0" /> {error}
                </p>
              )}
            </form>
          </div>
        ) : (
          <div data-testid="review-form-step1">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquarePlus className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Share Your Experience</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Purchased something? Enter your Order ID to leave a verified review.</p>
              </div>
            </div>

            <form onSubmit={handleVerify} className="flex gap-2 items-center">
              <Input
                placeholder="Paste your Order ID here..."
                value={orderId}
                onChange={(e) => { setOrderId(e.target.value); setError(""); }}
                className="bg-background/50 border-border h-10 text-sm flex-1"
                data-testid="input-order-id"
              />
              <Button
                type="submit"
                size="sm"
                disabled={verifyMutation.isPending}
                className="h-10 px-4 text-xs gap-1.5 shrink-0"
                data-testid="button-verify-order"
              >
                {verifyMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>Verify <ArrowRight className="w-3.5 h-3.5" /></>
                )}
              </Button>
            </form>

            {error && (
              <p className="text-xs text-destructive mt-3 flex items-center gap-1.5" style={{ animation: "fadeInUp 0.2s ease-out" }}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function ReviewCard({ review, index }: { review: Review; index: number }) {
  const timeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    const weeks = Math.floor(diffDays / 7);
    if (diffDays < 30) return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
    const months = Math.floor(diffDays / 30);
    if (diffDays < 365) return `${months} month${months !== 1 ? "s" : ""} ago`;
    const years = Math.floor(diffDays / 365);
    return `${years} year${years !== 1 ? "s" : ""} ago`;
  };

  return (
    <Card
      className="group relative overflow-hidden bg-card border border-border hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
      data-testid={`card-review-${review.id}`}
      style={{ animation: `fadeInUp 0.5s ease-out ${index * 0.04}s both` }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, hsl(var(--primary)), transparent 70%)' }} />
        <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, hsl(var(--primary)), transparent 70%)' }} />
      </div>

      <div className="relative p-5">
        <div className="mb-3">
          <span className="text-[11px] text-muted-foreground">{timeAgo(review.createdAt)}</span>
        </div>

        <p className="text-sm text-foreground leading-relaxed mb-4">
          {review.comment}
        </p>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <StarRating rating={review.rating} size="sm" animate />
          {review.verified === 1 && (
            <div className="flex items-center gap-1" data-testid={`badge-verified-${review.id}`}>
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/30 rounded-full blur-sm" style={{ animation: 'verifiedGlow 2s ease-in-out infinite' }} />
                <CheckCircle2 className="relative w-3.5 h-3.5 text-green-500" />
              </div>
              <span className="text-[10px] text-green-500 font-semibold uppercase tracking-wider">Verified</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1.5 mt-8" data-testid="pagination">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="h-8 w-8 p-0"
        data-testid="button-prev-page"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="px-1 text-muted-foreground text-sm">...</span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(p)}
            className="h-8 w-8 p-0 text-xs"
            data-testid={`button-page-${p}`}
          >
            {p}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="h-8 w-8 p-0"
        data-testid="button-next-page"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default function Reviews() {
  useReviewUpdates();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ reviews: Review[]; total: number }>({
    queryKey: ["/api/reviews", page],
    queryFn: async () => {
      const res = await fetch(`/api/reviews?page=${page}&limit=${REVIEWS_PER_PAGE}`);
      if (!res.ok) {
        const text = await res.text();
        const { parseErrorMessage } = await import("@/lib/queryClient");
        throw new Error(parseErrorMessage(text, "Failed to fetch reviews"));
      }
      return res.json();
    },
  });

  const reviews = data?.reviews ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / REVIEWS_PER_PAGE);

  return (
    <div className="min-h-screen bg-background animated-gradient relative">
      <ParticleBackground />
      <div className="relative" style={{ zIndex: 2 }}>
        <Header searchQuery="" onSearchChange={() => {}} showSearch={false} />

        <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 pb-20 sm:pb-12">
          <ReviewForm />

          {!isLoading && total > 0 && (
            <div className="flex items-center gap-3 mb-6">
              <ThumbsUp className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider" data-testid="text-review-count">
                {total} Review{total !== 1 ? "s" : ""}
              </h2>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="p-5 animate-pulse bg-card border border-border">
                  <div className="mb-3">
                    <div className="h-3 w-16 bg-muted rounded" />
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-3 w-full bg-muted rounded" />
                    <div className="h-3 w-3/4 bg-muted rounded" />
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-border">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, j) => (
                        <div key={j} className="w-3.5 h-3.5 rounded bg-muted" />
                      ))}
                    </div>
                    <div className="h-3 w-14 bg-muted rounded" />
                  </div>
                </Card>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Quote className="w-10 h-10 text-primary/50" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No Reviews Yet</h3>
              <p className="text-muted-foreground">Be the first to share your experience!</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {reviews.map((review, index) => (
                  <ReviewCard key={review.id} review={review} index={index} />
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </main>
      </div>
      <SocialWidget />

      <style>{`
        @keyframes starPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.3); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes verifiedGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.3); }
        }
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
