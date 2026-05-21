import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, ExternalLink, Link2, ChevronRight } from "lucide-react";
import { SiTelegram, SiInstagram, SiX, SiDiscord, SiYoutube, SiWhatsapp, SiFacebook, SiTiktok, SiLinkedin, SiReddit, SiTwitch, SiSnapchat, SiPinterest, SiGithub } from "react-icons/si";

interface SocialLink {
  id: string;
  label: string;
  url: string;
  icon: string;
}

interface SocialLinksSettings {
  widgetEnabled: boolean;
  widgetTitle: string;
  widgetSubtitle: string;
  links: SocialLink[];
}

const getIcon = (iconType: string) => {
  switch (iconType) {
    case "telegram":
      return SiTelegram;
    case "instagram":
      return SiInstagram;
    case "twitter":
      return SiX;
    case "discord":
      return SiDiscord;
    case "youtube":
      return SiYoutube;
    case "whatsapp":
      return SiWhatsapp;
    case "facebook":
      return SiFacebook;
    case "tiktok":
      return SiTiktok;
    case "linkedin":
      return SiLinkedin;
    case "reddit":
      return SiReddit;
    case "twitch":
      return SiTwitch;
    case "snapchat":
      return SiSnapchat;
    case "pinterest":
      return SiPinterest;
    case "github":
      return SiGithub;
    case "vouch":
      return ExternalLink;
    case "contact":
      return MessageCircle;
    default:
      return Link2;
  }
};

const getIconGradient = (iconType: string) => {
  switch (iconType) {
    case "telegram":
      return "from-[#0088cc] to-[#00b4d8]";
    case "instagram":
      return "from-[#833ab4] via-[#fd1d1d] to-[#fcb045]";
    case "twitter":
      return "from-[#000000] to-[#333333]";
    case "discord":
      return "from-[#5865F2] to-[#7289da]";
    case "youtube":
      return "from-[#FF0000] to-[#cc0000]";
    case "whatsapp":
      return "from-[#25D366] to-[#128C7E]";
    case "facebook":
      return "from-[#1877F2] to-[#3b5998]";
    case "tiktok":
      return "from-[#000000] to-[#69C9D0]";
    case "linkedin":
      return "from-[#0077B5] to-[#00a0dc]";
    case "reddit":
      return "from-[#FF4500] to-[#ff5700]";
    case "twitch":
      return "from-[#9146FF] to-[#6441a5]";
    case "snapchat":
      return "from-[#FFFC00] to-[#ffeb3b]";
    case "pinterest":
      return "from-[#E60023] to-[#bd081c]";
    case "github":
      return "from-[#333333] to-[#24292e]";
    case "vouch":
      return "from-green-500 to-emerald-400";
    case "contact":
      return "from-purple-500 to-pink-500";
    default:
      return "from-primary to-primary/80";
  }
};

const getWidgetButtonIcon = (iconType: string) => {
  switch (iconType) {
    case "telegram":
      return SiTelegram;
    case "instagram":
      return SiInstagram;
    case "twitter":
      return SiX;
    case "discord":
      return SiDiscord;
    case "youtube":
      return SiYoutube;
    case "whatsapp":
      return SiWhatsapp;
    case "facebook":
      return SiFacebook;
    case "tiktok":
      return SiTiktok;
    case "linkedin":
      return SiLinkedin;
    case "reddit":
      return SiReddit;
    case "twitch":
      return SiTwitch;
    case "snapchat":
      return SiSnapchat;
    case "pinterest":
      return SiPinterest;
    case "github":
      return SiGithub;
    default:
      return MessageCircle;
  }
};

export function SocialWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(true);

  const { data: settings } = useQuery<SocialLinksSettings>({
    queryKey: ["/api/settings/social"],
  });

  useEffect(() => {
    const handleUpdate = () => {
      // Refetch settings when updated in admin panel
      queryClient.invalidateQueries({ queryKey: ["/api/settings/social"] });
    };
    window.addEventListener("socialLinksUpdated", handleUpdate);
    return () => window.removeEventListener("socialLinksUpdated", handleUpdate);
  }, []);

  // Filter out invalid links (must have both label and url)
  const validLinks = useMemo(() => {
    if (!settings?.links) return [];
    return settings.links.filter(link => link.label?.trim() && link.url?.trim());
  }, [settings?.links]);

  // Use a generic message icon for the floating button
  const FloatingIcon = MessageCircle;
  const floatingGradient = "from-primary to-primary/80";

  // Don't render if widget is disabled or no valid links
  if (!settings?.widgetEnabled) return null;
  if (validLinks.length === 0) return null;

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => {
          setIsOpen(true);
          setHasNewMessage(false);
        }}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 group"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 1 }}
        data-testid="button-open-social-widget"
      >
        {/* Main button */}
        <div className={`relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br ${floatingGradient} shadow-lg group-hover:scale-105 transition-all duration-300`}>
          <FloatingIcon className="w-7 h-7 text-white" />
          
          {/* Notification dot */}
          {hasNewMessage && (
            <motion.div
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-background"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
            >
              <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
            </motion.div>
          )}
        </div>
      </motion.button>

      {/* Widget Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none sm:pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100%-2rem)] sm:w-96"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="relative bg-card/95 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="relative px-6 py-5 bg-muted/30 border-b border-primary/10">
                  <div className="relative flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {/* Avatar with first link's icon */}
                      <div className="relative">
                        <div className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${floatingGradient} flex items-center justify-center shadow-lg`}>
                          <FloatingIcon className="w-6 h-6 text-white" />
                        </div>
                        {/* Online indicator */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-card" />
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-foreground text-lg">
                          {settings.widgetTitle || "Connect With Us"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {settings.widgetSubtitle || "Get in touch through our channels"}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
                      data-testid="button-close-social-widget"
                    >
                      <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Links */}
                <div className="p-4 space-y-2">
                  {validLinks.map((link, index) => {
                    const Icon = getIcon(link.icon);
                    const gradient = getIconGradient(link.icon);
                    
                    return (
                      <motion.a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-transparent hover:border-primary/20 hover:bg-muted/50 transition-all duration-300"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        data-testid={`link-social-${index}`}
                      >
                        {/* Icon with gradient background */}
                        <div className={`relative flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {link.label || "Link"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {link.url}
                          </p>
                        </div>
                        
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </motion.a>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-primary/10 bg-muted/20">
                  <p className="text-xs text-center text-muted-foreground">
                    We typically respond within a few hours
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}