import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { ParticleBackground } from "@/components/particle-background";
import { useShopSettings } from "@/hooks/use-shop-settings";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  Server, 
  CreditCard, 
  Database, 
  Mail, 
  Wifi,
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Settings2,
  Clock
} from "lucide-react";

interface ServiceStatus {
  status: "operational" | "degraded" | "down" | "unconfigured";
  message: string;
  configured?: boolean;
}

interface StatusData {
  overall: string;
  services: Record<string, ServiceStatus>;
  timestamp: number;
}

const SERVICE_CONFIG: Record<string, { label: string; icon: typeof Server; description: string }> = {
  server: { label: "Application Server", icon: Server, description: "Core application server handling all requests" },
  payment: { label: "Payment Gateway", icon: CreditCard, description: "Cryptocurrency payment processing service" },
  database: { label: "Database", icon: Database, description: "PostgreSQL database for data storage" },
  email: { label: "Email Service", icon: Mail, description: "SMTP email delivery service" },
  websocket: { label: "Live Updates", icon: Wifi, description: "Real-time WebSocket connections" },
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string; dotClass: string }> = {
    operational: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", label: "Operational", dotClass: "bg-emerald-500 status-dot-pulse-green" },
    degraded: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-600 dark:text-amber-400", label: "Degraded", dotClass: "bg-amber-400 status-dot-pulse-amber" },
    down: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-600 dark:text-red-400", label: "Maintenance", dotClass: "bg-red-400 status-dot-pulse-red" },
    unconfigured: { bg: "bg-gray-500/10 border-gray-500/20 dark:bg-white/[0.03] dark:border-white/10", text: "text-gray-500 dark:text-white/40", label: "Not Configured", dotClass: "bg-gray-400 dark:bg-white/30" },
  };
  const c = config[status] || config.unconfigured;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dotClass}`} />
      {c.label}
    </span>
  );
}

function LiveTimeDisplay({ timestamp }: { timestamp: number }) {
  const display = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 mt-1">
      <Clock className="w-3 h-3" />
      <span>Last checked: <span className="tabular-nums">{display}</span></span>
    </div>
  );
}

function OverallStatusBanner({ status, timestamp }: { status: string; timestamp: number }) {
  const isOk = status === "operational";
  const isDegraded = status === "degraded";
  return (
    <div className={`relative rounded-2xl overflow-hidden border status-banner-enter ${
      isOk ? "border-primary/20" : isDegraded ? "border-amber-500/20" : "border-red-500/20"
    }`}>
      <div className={`absolute inset-0 ${
        isOk ? "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" : 
        isDegraded ? "bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent" :
        "bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent"
      }`} />
      <div className="absolute inset-0 status-shimmer" />
      <div className="relative px-6 py-8 flex flex-col items-center text-center gap-3">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center status-icon-enter ${
          isOk ? "bg-primary/15" : isDegraded ? "bg-amber-500/15" : "bg-red-500/15"
        }`}>
          {isOk ? (
            <CheckCircle2 className="w-8 h-8 text-primary" />
          ) : isDegraded ? (
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          ) : (
            <XCircle className="w-8 h-8 text-red-400" />
          )}
        </div>
        <div className="status-text-enter">
          <h2 className={`text-xl font-bold ${isOk ? "text-primary" : isDegraded ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
            {isOk ? "All Systems Operational" : isDegraded ? "Some Systems Degraded" : "System Under Maintenance"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isOk ? "Everything is working as expected" : isDegraded ? "Some services may be experiencing issues" : "One or more services are currently under maintenance"}
          </p>
        </div>
        <LiveTimeDisplay timestamp={timestamp} />
      </div>
    </div>
  );
}

export default function StatusPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { shopName } = useShopSettings();
  const [liveStatus, setLiveStatus] = useState<StatusData | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const { data: initialStatus, isLoading, isError, refetch } = useQuery<StatusData>({
    queryKey: ["/api/status"],
    refetchInterval: 60000,
    retry: 3,
    retryDelay: 2000,
  });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/status`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        setWsConnected(true);
        reconnectAttempts.current = 0;
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "status_update") {
            setLiveStatus({ overall: data.overall, services: data.services, timestamp: data.timestamp });
          }
        } catch (e) {}
      };
      
      ws.onerror = () => {};
      
      ws.onclose = () => {
        wsRef.current = null;
        setWsConnected(false);
        
        if (reconnectAttempts.current < 10) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };
    } catch (e) {}
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const statusData = liveStatus || initialStatus;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ParticleBackground />
      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} showSearch={false} />
      
      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-status-title">System Status</h1>
              <p className="text-sm text-muted-foreground">{shopName} service health</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wsConnected && (
              <span className="flex items-center gap-1.5 text-[10px] text-primary uppercase tracking-wider font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" style={{ animation: 'statusLivePing 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                Live
              </span>
            )}
          </div>
        </div>

        {isLoading && !statusData ? (
          <div className="space-y-4">
            <div className="h-40 rounded-2xl bg-muted/50 animate-pulse" />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        ) : isError || !statusData ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Unable to load status</p>
              <p className="text-xs text-muted-foreground mt-1">The status service may be starting up</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2" data-testid="button-retry-status">
              <Activity className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <OverallStatusBanner status={statusData.overall} timestamp={statusData.timestamp} />

            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground/60 font-medium px-1">Services</h3>
              {Object.entries(statusData.services).map(([key, service], index) => {
                const config = SERVICE_CONFIG[key];
                if (!config) return null;
                const Icon = config.icon;
                return (
                  <div
                    key={key}
                    className="relative rounded-xl border border-border bg-card transition-all duration-300 overflow-hidden status-card-enter group/card hover:shadow-md hover:shadow-primary/5 hover:-translate-y-[1px]"
                    style={{ animationDelay: `${(index + 1) * 100}ms` }}
                    data-testid={`status-service-${key}`}
                  >
                    <div className="px-5 py-4 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 status-icon-bounce bg-primary/10 ring-1 ring-primary/20 group-hover/card:bg-primary/15 group-hover/card:ring-primary/30 group-hover/card:scale-110`}
                        style={{ animationDelay: `${(index + 1) * 150}ms` }}>
                        <Icon className="w-5 h-5 text-primary transition-colors duration-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground" data-testid={`text-service-name-${key}`}>
                            {config.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{service.message}</p>
                      </div>
                      <StatusBadge status={service.status} />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                      <div className="status-light-sweep" style={{ animationDelay: `${index * 0.8}s` }} />
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </main>

      <style>{`
        @keyframes statusLivePing {
          0% { transform: scale(1); opacity: 0.75; }
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes statusBannerEnter {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes statusIconEnter {
          0% { opacity: 0; transform: scale(0.5); }
          60% { transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes statusTextEnter {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes statusCardEnter {
          0% { opacity: 0; transform: translateY(16px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes statusIconBounce {
          0% { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          60% { transform: scale(1.15) rotate(3deg); }
          80% { transform: scale(0.95) rotate(-1deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes statusShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes statusDotPulseGreen {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          50% { box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); }
        }
        @keyframes statusDotPulseAmber {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          50% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0); }
        }
        @keyframes statusDotPulseRed {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
        }
        .status-banner-enter {
          animation: statusBannerEnter 0.5s ease-out both;
        }
        .status-icon-enter {
          animation: statusIconEnter 0.6s ease-out 0.2s both;
        }
        .status-text-enter {
          animation: statusTextEnter 0.5s ease-out 0.4s both;
        }
        .status-card-enter {
          animation: statusCardEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .status-icon-bounce {
          animation: statusIconBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .status-shimmer::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, transparent, hsl(var(--primary) / 0.04), transparent);
          animation: statusShimmer 3s ease-in-out infinite;
        }
        .status-dot-pulse-green {
          animation: statusDotPulseGreen 2s ease-in-out infinite;
        }
        .status-dot-pulse-amber {
          animation: statusDotPulseAmber 2s ease-in-out infinite;
        }
        .status-dot-pulse-red {
          animation: statusDotPulseRed 2s ease-in-out infinite;
        }
        @keyframes statusLightSweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .status-light-sweep {
          position: absolute;
          top: 0;
          left: 0;
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, transparent, hsl(var(--primary) / 0.06), hsl(var(--primary) / 0.03), transparent);
          animation: statusLightSweep 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
