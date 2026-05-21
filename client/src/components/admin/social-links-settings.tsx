import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Save, Loader2, Plus, Trash2, Link2, ExternalLink, GripVertical } from "lucide-react";
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

const iconOptions = [
  { value: "telegram", label: "Telegram", icon: SiTelegram, color: "#0088cc" },
  { value: "instagram", label: "Instagram", icon: SiInstagram, color: "#E4405F" },
  { value: "twitter", label: "X (Twitter)", icon: SiX, color: "#000000" },
  { value: "discord", label: "Discord", icon: SiDiscord, color: "#5865F2" },
  { value: "youtube", label: "YouTube", icon: SiYoutube, color: "#FF0000" },
  { value: "whatsapp", label: "WhatsApp", icon: SiWhatsapp, color: "#25D366" },
  { value: "facebook", label: "Facebook", icon: SiFacebook, color: "#1877F2" },
  { value: "tiktok", label: "TikTok", icon: SiTiktok, color: "#000000" },
  { value: "linkedin", label: "LinkedIn", icon: SiLinkedin, color: "#0077B5" },
  { value: "reddit", label: "Reddit", icon: SiReddit, color: "#FF4500" },
  { value: "twitch", label: "Twitch", icon: SiTwitch, color: "#9146FF" },
  { value: "snapchat", label: "Snapchat", icon: SiSnapchat, color: "#FFFC00" },
  { value: "pinterest", label: "Pinterest", icon: SiPinterest, color: "#E60023" },
  { value: "github", label: "GitHub", icon: SiGithub, color: "#333333" },
  { value: "vouch", label: "Vouch", icon: ExternalLink, color: "#10b981" },
  { value: "contact", label: "Contact", icon: MessageCircle, color: "#8b5cf6" },
  { value: "link", label: "Custom Link", icon: Link2, color: "#06b6d4" },
];

export function SocialLinksSettings() {
  const { toast } = useToast();
  const [widgetEnabled, setWidgetEnabled] = useState(true);
  const [widgetTitle, setWidgetTitle] = useState("Connect With Us");
  const [widgetSubtitle, setWidgetSubtitle] = useState("Get in touch through our channels");
  const [links, setLinks] = useState<SocialLink[]>([]);

  const { data: settings, isLoading } = useQuery<SocialLinksSettings>({
    queryKey: ["/api/settings/social"],
  });

  useEffect(() => {
    if (settings) {
      setWidgetEnabled(settings.widgetEnabled ?? true);
      setWidgetTitle(settings.widgetTitle || "Connect With Us");
      setWidgetSubtitle(settings.widgetSubtitle || "Get in touch through our channels");
      setLinks(settings.links || []);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: SocialLinksSettings) => {
      return apiRequest("POST", "/api/settings/social", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/social"] });
      toast({
        title: "Settings saved",
        description: "Social links have been updated successfully",
      });
      window.dispatchEvent(new CustomEvent("socialLinksUpdated"));
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addLink = () => {
    const newLink: SocialLink = {
      id: crypto.randomUUID(),
      label: "",
      url: "",
      icon: "telegram",
    };
    setLinks([...links, newLink]);
  };

  const removeLink = (id: string) => {
    setLinks(links.filter(link => link.id !== id));
  };

  const updateLink = (id: string, field: keyof SocialLink, value: string) => {
    setLinks(links.map(link => 
      link.id === id ? { ...link, [field]: value } : link
    ));
  };

  const handleSave = () => {
    // Filter out incomplete links and warn user
    const completeLinks = links.filter(link => link.label?.trim() && link.url?.trim());
    const incompleteCount = links.length - completeLinks.length;
    
    if (incompleteCount > 0) {
      toast({
        title: "Note",
        description: `${incompleteCount} incomplete link(s) were excluded. Links need both a label and URL.`,
      });
    }
    
    saveMutation.mutate({ widgetEnabled, widgetTitle, widgetSubtitle, links: completeLinks });
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-card-border">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-card-border overflow-visible">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/20">
            <SiTelegram className="w-5 h-5 text-primary" />
          </div>
          Social Widget
        </CardTitle>
        <CardDescription>
          Configure the floating social widget that appears on your storefront. Add links to your Telegram channel, vouch page, or any custom links.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-primary/10">
          <div className="space-y-1">
            <Label className="text-base font-medium">Enable Widget</Label>
            <p className="text-sm text-muted-foreground">Show the floating widget on your storefront</p>
          </div>
          <Switch
            checked={widgetEnabled}
            onCheckedChange={setWidgetEnabled}
            data-testid="switch-widget-enabled"
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="widgetTitle">Widget Title</Label>
            <Input
              id="widgetTitle"
              value={widgetTitle}
              onChange={(e) => setWidgetTitle(e.target.value)}
              placeholder="Connect With Us"
              className="bg-background border-primary/20"
              data-testid="input-widget-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="widgetSubtitle">Widget Subtitle</Label>
            <Input
              id="widgetSubtitle"
              value={widgetSubtitle}
              onChange={(e) => setWidgetSubtitle(e.target.value)}
              placeholder="Get in touch through our channels"
              className="bg-background border-primary/20"
              data-testid="input-widget-subtitle"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Links</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLink}
              className="gap-1"
              data-testid="button-add-social-link"
            >
              <Plus className="w-4 h-4" />
              Add Link
            </Button>
          </div>

          {links.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed border-primary/20 rounded-lg">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No links added yet</p>
              <p className="text-sm">Click "Add Link" to add your first social link</p>
            </div>
          ) : (
            <div className="space-y-3">
              {links.map((link, index) => (
                <div
                  key={link.id}
                  className="group p-4 rounded-lg border border-primary/10 bg-muted/20 space-y-3 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <span className="text-sm font-medium text-muted-foreground">Link {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLink(link.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      data-testid={`button-remove-link-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Platform</Label>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const selectedOption = iconOptions.find(opt => opt.value === link.icon);
                          const IconComponent = selectedOption?.icon || Link2;
                          const iconColor = selectedOption?.color || "#06b6d4";
                          return (
                            <div 
                              className="flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center" 
                              style={{ backgroundColor: iconColor }}
                            >
                              <IconComponent className="w-5 h-5 text-white" />
                            </div>
                          );
                        })()}
                        <select
                          value={link.icon}
                          onChange={(e) => updateLink(link.id, "icon", e.target.value)}
                          className="w-full h-9 px-3 rounded-md border border-primary/20 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          data-testid={`select-link-type-${index}`}
                        >
                          {iconOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Label</Label>
                      <Input
                        value={link.label}
                        onChange={(e) => updateLink(link.id, "label", e.target.value)}
                        placeholder="e.g., Our Instagram"
                        className="bg-background border-primary/20"
                        data-testid={`input-link-label-${index}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">URL</Label>
                      <Input
                        value={link.url}
                        onChange={(e) => updateLink(link.id, "url", e.target.value)}
                        placeholder="https://..."
                        className="bg-background border-primary/20"
                        data-testid={`input-link-url-${index}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
          data-testid="button-save-social-settings"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}