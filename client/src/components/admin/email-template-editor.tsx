import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { EmailTemplate } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, Mail, Code } from "lucide-react";

export function EmailTemplateEditor() {
  const { toast } = useToast();
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("editor");

  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  const defaultTemplate = templates.find((t) => t.isDefault === 1) || templates[0];

  const [editingSubject, setEditingSubject] = useState<string>("");
  const [editingContent, setEditingContent] = useState<string>("");

  useState(() => {
    if (defaultTemplate) {
      setEditingSubject(defaultTemplate.subject);
      setEditingContent(defaultTemplate.htmlContent);
    }
  });

  if (defaultTemplate && editingSubject === "" && editingContent === "") {
    setEditingSubject(defaultTemplate.subject);
    setEditingContent(defaultTemplate.htmlContent);
  }

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EmailTemplate> }) => {
      return apiRequest("PATCH", `/api/email-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({
        title: "Template saved",
        description: "Email template has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/email-templates/${id}/preview`, {});
      return response.json();
    },
    onSuccess: (data: { subject: string; html: string }) => {
      setPreviewSubject(data.subject);
      setPreviewHtml(data.html);
      setActiveTab("preview");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!defaultTemplate) return;
    updateMutation.mutate({
      id: defaultTemplate.id,
      data: {
        subject: editingSubject,
        htmlContent: editingContent,
      },
    });
  };

  const handlePreview = () => {
    if (!defaultTemplate) return;
    if (editingSubject !== defaultTemplate.subject || editingContent !== defaultTemplate.htmlContent) {
      updateMutation.mutate(
        {
          id: defaultTemplate.id,
          data: {
            subject: editingSubject,
            htmlContent: editingContent,
          },
        },
        {
          onSuccess: () => {
            previewMutation.mutate(defaultTemplate.id);
          },
        }
      );
    } else {
      previewMutation.mutate(defaultTemplate.id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-muted rounded w-1/3" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-card-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Email Template
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Customize the email sent to customers after successful payment
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={previewMutation.isPending}
              className="gap-2 flex-1 sm:flex-none"
              data-testid="button-preview-template"
            >
              <Eye className="w-4 h-4" />
              Preview
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="gap-2 flex-1 sm:flex-none"
              data-testid="button-save-template"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="editor" className="gap-2" data-testid="tab-template-editor">
                <Code className="w-4 h-4" />
                Editor
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2" data-testid="tab-template-preview">
                <Eye className="w-4 h-4" />
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  value={editingSubject}
                  onChange={(e) => setEditingSubject(e.target.value)}
                  placeholder="Your Order is Complete - {{productName}}"
                  data-testid="input-email-subject"
                />
                <p className="text-xs text-muted-foreground">
                  Available variables: {"{{orderId}}"}, {"{{productName}}"}, {"{{totalAmount}}"}, {"{{stockItem}}"}, {"{{shopName}}"}, {"{{themeColor}}"}, {"{{themeRgba}}"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">HTML Content</Label>
                <Textarea
                  id="content"
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  placeholder="Enter HTML email template..."
                  className="font-mono text-sm min-h-[400px] resize-none"
                  data-testid="input-email-content"
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{{orderId}}"}, {"{{productName}}"}, {"{{totalAmount}}"}, {"{{stockItem}}"}, {"{{shopName}}"}, {"{{themeColor}}"}, {"{{themeRgba}}"} as placeholders
                </p>
              </div>
            </TabsContent>

            <TabsContent value="preview">
              {previewHtml ? (
                <div className="space-y-4">
                  <div className="p-3 bg-muted/50 rounded-md">
                    <span className="text-sm text-muted-foreground">Subject: </span>
                    <span className="font-medium">{previewSubject}</span>
                  </div>
                  <div className="border border-card-border rounded-md overflow-hidden bg-white">
                    <iframe
                      srcDoc={previewHtml}
                      title="Email Preview"
                      className="w-full h-[500px] border-0"
                      sandbox="allow-same-origin"
                      data-testid="iframe-email-preview"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Eye className="w-16 h-16 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    No preview available
                  </h3>
                  <p className="text-muted-foreground">
                    Click the "Preview" button to see how the email will look
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="text-base">Template Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
              <code className="text-primary">{"{{orderId}}"}</code>
              <span className="text-muted-foreground">The unique order identifier</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
              <code className="text-primary">{"{{productName}}"}</code>
              <span className="text-muted-foreground">Name of the purchased product</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
              <code className="text-primary">{"{{totalAmount}}"}</code>
              <span className="text-muted-foreground">Total order amount in USD</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
              <code className="text-primary">{"{{stockItem}}"}</code>
              <span className="text-muted-foreground">The account credentials sent to customer</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
              <code className="text-primary">{"{{shopName}}"}</code>
              <span className="text-muted-foreground">Your shop name from settings</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
              <code className="text-primary">{"{{themeColor}}"}</code>
              <span className="text-muted-foreground">Your theme accent color (hex, e.g. #e63946)</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
              <code className="text-primary">{"{{themeRgba}}"}</code>
              <span className="text-muted-foreground">Theme color with transparency (for borders/backgrounds)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
