import { useState, useEffect, useRef, useCallback } from "react";
import { WorldMap } from "./world-map";

const chatTopics = [
  { greeting: "Hey! How can I help?", question: "Need help with order", reply: "Sure! Checking now..." },
  { greeting: "Welcome back!", question: "Where's my gift card?", reply: "Delivered to your email!" },
  { greeting: "Hi there! What's up?", question: "Can I pay with BTC?", reply: "Yes! We accept 9 cryptos" },
  { greeting: "Hello! Need anything?", question: "Is this item in stock?", reply: "Yes, available now!" },
  { greeting: "Hey! Ready to help", question: "How fast is delivery?", reply: "Instant, fully automated" },
  { greeting: "Hi! Ask me anything", question: "Do you have refunds?", reply: "Of course! No worries" },
  { greeting: "Welcome! How's it going?", question: "My code didn't work", reply: "Let me fix that for you" },
  { greeting: "Hey! I'm here for you", question: "Any discount codes?", reply: "Check your email inbox!" },
  { greeting: "Hi! What do you need?", question: "Is payment secure?", reply: "100% encrypted & safe" },
];

type ChatMsg = { text: string; from: 'support' | 'user' };

export function FeaturesStrip() {
  const chatRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const topicRef = useRef(0);
  const stepRef = useRef(0);

  useEffect(() => {
    function addNext() {
      const topic = chatTopics[topicRef.current];
      const step = stepRef.current;

      if (step === 0) {
        setMessages(prev => [...prev, { text: topic.greeting, from: 'support' }]);
        stepRef.current = 1;
      } else if (step === 1) {
        setMessages(prev => [...prev, { text: topic.question, from: 'user' }]);
        stepRef.current = 2;
      } else {
        setMessages(prev => [...prev, { text: topic.reply, from: 'support' }]);
        stepRef.current = 0;
        topicRef.current = (topicRef.current + 1) % chatTopics.length;
      }
    }

    addNext();
    const interval = setInterval(addNext, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      requestAnimationFrame(() => {
        chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [messages]);

  return (
    <div className="relative py-1 sm:py-2" data-testid="features-strip">
      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2">

        {/* Instant Delivery */}
        <div
          className="group relative overflow-hidden rounded-lg border border-primary/10 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-[#0d0d14] dark:to-[#080810]"
          style={{ animation: 'cardReveal 0.7s cubic-bezier(0.16,1,0.3,1) 0s both' }}
          data-testid="feature-0"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-primary/[0.02] to-transparent dark:from-primary/[0.06] dark:via-primary/[0.02] pointer-events-none" />

          <div className="relative p-2 sm:p-2.5 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" style={{ animation: 'blink 2s ease-in-out infinite' }} />
                <span className="text-[7px] sm:text-[8px] text-primary/80 font-semibold uppercase tracking-widest">Live</span>
              </div>
              <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/15">
                <svg viewBox="0 0 12 12" className="w-1.5 h-1.5 text-primary"><path d="M6 1l-4 6h3l-1 4 4-6H5l1-4z" fill="currentColor" /></svg>
                <span className="text-[6px] sm:text-[7px] text-primary font-bold">~12s</span>
              </div>
            </div>
            <h3 className="text-[10px] sm:text-xs font-bold text-foreground mb-1.5">Instant Delivery</h3>

            <div className="flex items-center justify-between gap-0.5 px-1 sm:px-2 mt-2 sm:mt-3">
              <div className="flex flex-col items-center gap-0.5 flex-1">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center" style={{ animation: 'stepGlow 3s ease-in-out 0s infinite' }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                </div>
                <span className="text-[5px] sm:text-[7px] text-muted-foreground/60">Pay</span>
              </div>

              <div className="flex-1 h-[1.5px] bg-foreground/[0.06] relative overflow-hidden rounded-full -mt-2">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/80 to-primary/50 rounded-full" style={{ animation: 'lineFill 3s ease-in-out infinite' }} />
              </div>

              <div className="flex flex-col items-center gap-0.5 flex-1">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center" style={{ animation: 'stepGlow 3s ease-in-out 0.6s infinite' }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary/80 origin-center" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 2s linear infinite' }}><path d="M12 2a10 10 0 0110 10" /><path d="M12 6v6l4 2" /></svg>
                </div>
                <span className="text-[5px] sm:text-[7px] text-muted-foreground/60">Process</span>
              </div>

              <div className="flex-1 h-[1.5px] bg-foreground/[0.06] relative overflow-hidden rounded-full -mt-2">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/50 to-primary/80 rounded-full" style={{ animation: 'lineFill 3s ease-in-out 0.6s infinite' }} />
              </div>

              <div className="flex flex-col items-center gap-0.5 flex-1">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center" style={{ animation: 'stepGlow 3s ease-in-out 1.2s infinite' }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
                </div>
                <span className="text-[5px] sm:text-[7px] text-muted-foreground/60">Done</span>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Checked */}
        <div
          className="group relative overflow-hidden rounded-lg border border-primary/10 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-[#0d0d14] dark:to-[#080810]"
          style={{ animation: 'cardReveal 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}
          data-testid="feature-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-primary/[0.02] to-transparent dark:from-primary/[0.06] dark:via-primary/[0.02] pointer-events-none" />

          <div className="relative p-2 sm:p-2.5 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" style={{ animation: 'blink 1.5s ease-in-out infinite' }} />
                <span className="text-[7px] sm:text-[8px] text-primary/80 font-semibold uppercase tracking-widest">Scanning</span>
              </div>
              <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/15">
                <span className="text-[6px] sm:text-[7px] text-primary font-bold">100%</span>
              </div>
            </div>
            <h3 className="text-[10px] sm:text-xs font-bold text-foreground mb-1">Daily Checked</h3>

            <div className="flex flex-col gap-[3px]">
              {[
                { label: "Stock", delay: 0 },
                { label: "Access", delay: 0.7 },
                { label: "Login", delay: 1.4 },
                { label: "Quality", delay: 2.1 },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1">
                  <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded flex items-center justify-center flex-shrink-0 overflow-hidden border border-border/30">
                    <div style={{ animation: `scanPop 3.5s ease-in-out ${item.delay}s infinite` }}>
                      <svg viewBox="0 0 12 12" className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-primary"><path d="M3 6l2.5 2.5L9 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  </div>
                  <span className="text-[8px] sm:text-[9px] text-muted-foreground/70 flex-1">{item.label}</span>
                  <div className="w-6 sm:w-10 h-1 rounded-full bg-foreground/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60" style={{ animation: `barSlide 3.5s ease-out ${item.delay}s infinite` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Worldwide Store */}
        <div
          className="group relative overflow-hidden rounded-lg border border-primary/10 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-[#0d0d14] dark:to-[#080810]"
          style={{ animation: 'cardReveal 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both' }}
          data-testid="feature-2"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-primary/[0.02] to-transparent dark:from-primary/[0.06] dark:via-primary/[0.02] pointer-events-none" />

          <div className="relative p-2 sm:p-2.5 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" style={{ animation: 'blink 2s ease-in-out infinite' }} />
                <span className="text-[7px] sm:text-[8px] text-primary/80 font-semibold uppercase tracking-widest">Global</span>
              </div>
              <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/15">
                <div className="w-1 h-1 rounded-full bg-primary" style={{ animation: 'blink 2s ease-in-out infinite' }} />
                <span className="text-[6px] sm:text-[7px] text-primary font-bold">50+</span>
              </div>
            </div>
            <h3 className="text-[10px] sm:text-xs font-bold text-foreground mb-1">Worldwide Store</h3>

            <div className="flex items-center justify-center relative h-[70px] sm:h-[80px] overflow-hidden">
              <WorldMap />
            </div>
          </div>
        </div>

        {/* 24/7 Support */}
        <div
          className="group relative overflow-hidden rounded-lg border border-primary/10 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-[#0d0d14] dark:to-[#080810]"
          style={{ animation: 'cardReveal 0.7s cubic-bezier(0.16,1,0.3,1) 0.3s both' }}
          data-testid="feature-3"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-primary/[0.02] to-transparent dark:from-primary/[0.06] dark:via-primary/[0.02] pointer-events-none" />

          <div className="relative p-2 sm:p-2.5 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" style={{ animation: 'blink 2s ease-in-out infinite' }} />
                <span className="text-[7px] sm:text-[8px] text-primary/80 font-semibold uppercase tracking-widest">Online</span>
              </div>
              <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/15">
                <div className="w-1 h-1 rounded-full bg-primary" style={{ animation: 'blink 2s ease-in-out infinite' }} />
                <span className="text-[6px] sm:text-[7px] text-primary font-bold">~2 min</span>
              </div>
            </div>
            <h3 className="text-[10px] sm:text-xs font-bold text-foreground mb-1">24/7 Support</h3>

            <div className="rounded-md border border-border/30 bg-background/50 dark:bg-black/30 overflow-hidden flex flex-col h-[70px] sm:h-[80px]">
              <div className="flex items-center gap-1 px-1.5 py-0.5 border-b border-border/20 bg-muted/30">
                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <span className="text-[5px] font-bold text-white">S</span>
                </div>
                <span className="text-[7px] sm:text-[8px] text-muted-foreground font-medium">Support</span>
                <div className="ml-auto flex items-center gap-0.5">
                  <div className="w-1 h-1 rounded-full bg-primary" />
                  <span className="text-[5px] text-primary/70">Active</span>
                </div>
              </div>

              <div ref={chatRef} className="px-1.5 py-1 flex flex-col gap-0.5 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={msg.from === 'user' ? 'self-end max-w-[80%]' : 'self-start max-w-[85%]'}
                    style={{ animation: 'msgSlideIn 0.3s ease-out both' }}
                  >
                    <div className={
                      msg.from === 'user'
                        ? 'px-1 py-0.5 rounded-md rounded-tr-sm bg-primary/15 border border-primary/10'
                        : 'px-1 py-0.5 rounded-md rounded-tl-sm bg-muted/50'
                    }>
                      <p className={
                        msg.from === 'user'
                          ? 'text-[6px] sm:text-[7px] text-primary/80'
                          : 'text-[6px] sm:text-[7px] text-muted-foreground'
                      }>{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes cardReveal {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes stepGlow {
          0%, 100% { box-shadow: 0 0 0 0 transparent; transform: scale(1); }
          50% { box-shadow: 0 0 12px 2px hsl(var(--primary) / 0.12); transform: scale(1.08); }
        }
        @keyframes lineFill {
          0%, 5% { width: 0%; }
          25%, 75% { width: 100%; }
          95%, 100% { width: 0%; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes scanPop {
          0%, 8% { opacity: 0; transform: scale(0) rotate(-30deg); }
          14%, 80% { opacity: 1; transform: scale(1) rotate(0deg); }
          88%, 100% { opacity: 0; transform: scale(0) rotate(30deg); }
        }
        @keyframes barSlide {
          0%, 8% { width: 0%; }
          18%, 80% { width: 100%; }
          88%, 100% { width: 0%; }
        }
        @keyframes msgSlideIn {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0% { transform: translateY(0); }
          100% { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}
