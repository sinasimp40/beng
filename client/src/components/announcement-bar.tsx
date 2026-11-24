import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

interface ShopSettings {
  announcementEnabled: boolean;
  announcementText: string;
}

export function AnnouncementBar() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");

  const { data: settings } = useQuery<ShopSettings>({
    queryKey: ["/api/settings/shop"],
  });

  const messages = useMemo(() => {
    if (!settings?.announcementText?.trim()) return [];
    return settings.announcementText.split("/n").map(m => m.trim()).filter(Boolean);
  }, [settings?.announcementText]);

  useEffect(() => {
    if (messages.length <= 1 && phase === "visible") return;

    if (phase === "enter") {
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPhase("visible");
        });
      });
      return () => cancelAnimationFrame(t);
    }
    if (phase === "visible") {
      const t = setTimeout(() => setPhase("exit"), 3000);
      return () => clearTimeout(t);
    }
    if (phase === "exit") {
      const t = setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % messages.length);
        setPhase("enter");
      }, 500);
      return () => clearTimeout(t);
    }
  }, [phase, messages.length]);

  const goToNext = useCallback(() => {
    if (messages.length <= 1 || phase === "exit") return;
    setPhase("exit");
  }, [messages.length, phase]);

  const goToPrev = useCallback(() => {
    if (messages.length <= 1 || phase === "exit") return;
    setPhase("exit");
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + messages.length) % messages.length);
      setPhase("enter");
    }, 500);
  }, [messages.length, phase]);

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/shop"] });
    };
    window.addEventListener("shopSettingsUpdated", handleUpdate);
    return () => window.removeEventListener("shopSettingsUpdated", handleUpdate);
  }, []);

  if (!settings?.announcementEnabled || messages.length === 0) {
    return null;
  }

  return (
    <div className="w-full mb-3 sm:mb-4" data-testid="announcement-bar">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative group">
          <div
            className="absolute -inset-[1px] rounded-xl opacity-75 blur-[2px] transition-all duration-500 group-hover:opacity-100 group-hover:blur-[3px]"
            style={{
              background: "linear-gradient(90deg, hsl(var(--primary) / 0.6), hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.6))",
              backgroundSize: "200% 100%",
              animation: "announcementGradientMove 3s linear infinite",
            }}
          />

          <div className="relative flex items-center rounded-xl bg-gradient-to-r from-background/95 via-card/90 to-background/95 backdrop-blur-md border border-primary/15 overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: "radial-gradient(circle at 20% 50%, hsl(var(--primary)), transparent 50%), radial-gradient(circle at 80% 50%, hsl(var(--primary)), transparent 50%)",
              }}
            />

            <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-16 flex items-center justify-center z-10">
              <div className="relative">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary/70" />
                <div className="absolute inset-0 animate-ping">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary/20" />
                </div>
              </div>
            </div>

            {messages.length > 1 && (
              <button
                onClick={goToPrev}
                className="relative z-10 flex-shrink-0 p-2 sm:p-2.5 ml-8 sm:ml-12 rounded-md text-primary/50 hover:text-primary hover:bg-primary/10 transition-all duration-200"
                data-testid="button-announcement-prev"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            <div className={`flex-1 overflow-hidden py-3 sm:py-3.5 ${messages.length <= 1 ? 'ml-12 sm:ml-16' : ''}`}>
              <div className="relative flex items-center justify-center min-h-[1.5rem]">
                <p
                  className={`text-sm sm:text-[0.9rem] text-foreground/90 font-medium tracking-wide text-center transition-all ease-in-out ${
                    phase === "enter"
                      ? "translate-x-[120%] opacity-0"
                      : phase === "visible"
                        ? "translate-x-0 opacity-100"
                        : "-translate-x-[120%] opacity-0"
                  }`}
                  style={{ transitionDuration: phase === "enter" ? "0ms" : "500ms" }}
                  data-testid="text-announcement-message"
                >
                  {messages[currentIndex]}
                </p>
              </div>
            </div>

            {messages.length > 1 && (
              <button
                onClick={goToNext}
                className="relative z-10 flex-shrink-0 p-2 sm:p-2.5 mr-8 sm:mr-12 rounded-md text-primary/50 hover:text-primary hover:bg-primary/10 transition-all duration-200"
                data-testid="button-announcement-next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-16 flex items-center justify-center z-10">
              <div className="relative">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary/70" />
                <div className="absolute inset-0 animate-ping" style={{ animationDelay: "1s" }}>
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary/20" />
                </div>
              </div>
            </div>

            {messages.length > 1 && (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                {messages.map((_, i) => (
                  <div
                    key={i}
                    className={`h-[3px] rounded-full transition-all duration-300 ${
                      i === currentIndex
                        ? "w-4 bg-primary/60"
                        : "w-1.5 bg-primary/20"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes announcementGradientMove {
          0% { background-position: 0% 0%; }
          100% { background-position: 200% 0%; }
        }
      `}</style>
    </div>
  );
}
