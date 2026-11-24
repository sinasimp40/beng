import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, KeyRound, Code } from "lucide-react";

interface ForgotPasswordTemplate {
  subject: string;
  htmlContent: string;
}

const DEFAULT_TEMPLATE = {
  subject: "Reset Your Password",
  htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%; background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%); border-radius: 16px; border: 1px solid rgba(6, 182, 212, 0.2); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(90deg, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0.05) 100%); padding: 32px 40px; border-bottom: 1px solid rgba(6, 182, 212, 0.1);">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #06b6d4; letter-spacing: -0.5px;">
                {{shopName}}
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 32px;">
                <div style="width: 80px; height: 80px; margin: 0 auto 24px; background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0.1) 100%); border-radius: 50%; border: 1px solid rgba(6, 182, 212, 0.3); display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 32px; color: #06b6d4;">🔑</span>
                </div>
                <h2 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #ffffff;">
                  Password Reset Request
                </h2>
                <p style="margin: 0; font-size: 14px; color: #9ca3af;">
                  We received a request to reset your password
                </p>
              </div>
              
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #d1d5db;">
                Hello,<br><br>
                We received a request to reset your password for your account. Click the button below to create a new password.
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="{{resetLink}}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #000000; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(6, 182, 212, 0.4);">
                  Reset Password
                </a>
              </div>
              
              <p style="margin: 24px 0; font-size: 14px; line-height: 1.6; color: #9ca3af;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; padding: 16px; background: rgba(6, 182, 212, 0.1); border-radius: 8px; font-size: 12px; color: #06b6d4; word-break: break-all; border: 1px solid rgba(6, 182, 212, 0.2);">
                {{resetLink}}
              </p>
              
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                  <strong style="color: #9ca3af;">Security Notice:</strong><br>
                  This link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you have concerns.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background: rgba(0, 0, 0, 0.3); border-top: 1px solid rgba(255, 255, 255, 0.05);">
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                This is an automated message, please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
};

export function ForgotPasswordTemplateEditor() {
  const { toast } = useToast();
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("editor");
  const [editingSubject, setEditingSubject] = useState<string>("");
  const [editingContent, setEditingContent] = useState<string>("");

  const { data: template, isLoading } = useQuery<ForgotPasswordTemplate>({
    queryKey: ["/api/settings/forgot-password-template"],
  });

  useEffect(() => {
    if (template) {
      setEditingSubject(template.subject);
      setEditingContent(template.htmlContent);
    } else if (!isLoading) {
      setEditingSubject(DEFAULT_TEMPLATE.subject);
      setEditingContent(DEFAULT_TEMPLATE.htmlContent);
    }
  }, [template, isLoading]);

  const updateMutation = useMutation({
    mutationFn: async (data: ForgotPasswordTemplate) => {
      return apiRequest("POST", "/api/settings/forgot-password-template", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/forgot-password-template"] });
      toast({
        title: "Template saved",
        description: "Forgot password email template has been updated successfully",
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

  const handleSave = () => {
    updateMutation.mutate({
      subject: editingSubject,
      htmlContent: editingContent,
    });
  };

  const handlePreview = () => {
    const sampleData = {
      resetLink: "https://yourshop.com/reset-password?token=abc123xyz",
    };

    let previewHtmlContent = editingContent;
    let previewSubjectContent = editingSubject;
    
    for (const [key, value] of Object.entries(sampleData)) {
      previewHtmlContent = previewHtmlContent.replace(new RegExp(`{{${key}}}`, "g"), value);
      previewSubjectContent = previewSubjectContent.replace(new RegExp(`{{${key}}}`, "g"), value);
    }

    setPreviewSubject(previewSubjectContent);
    setPreviewHtml(previewHtmlContent);
    setActiveTab("preview");
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
              <KeyRound className="w-5 h-5 text-primary" />
              Forgot Password Email Template
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Customize the email sent when users request a password reset
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handlePreview}
              className="gap-2 flex-1 sm:flex-none"
              data-testid="button-preview-forgot-template"
            >
              <Eye className="w-4 h-4" />
              Preview
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="gap-2 flex-1 sm:flex-none"
              data-testid="button-save-forgot-template"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="editor" className="gap-2" data-testid="tab-forgot-template-editor">
                <Code className="w-4 h-4" />
                Editor
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2" data-testid="tab-forgot-template-preview">
                <Eye className="w-4 h-4" />
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-subject">Email Subject</Label>
                <Input
                  id="forgot-subject"
                  value={editingSubject}
                  onChange={(e) => setEditingSubject(e.target.value)}
                  placeholder="Reset Your Password"
                  data-testid="input-forgot-email-subject"
                />
                <p className="text-xs text-muted-foreground">
                  Available variables: {"{{resetLink}}"}, {"{{shopName}}"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="forgot-content">HTML Content</Label>
                <Textarea
                  id="forgot-content"
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  placeholder="Enter HTML email template..."
                  className="font-mono text-sm min-h-[400px] resize-none"
                  data-testid="input-forgot-email-content"
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{{resetLink}}"} for the password reset URL, {"{{shopName}}"} for your shop name
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
                      title="Forgot Password Email Preview"
                      className="w-full h-[500px] border-0"
                      sandbox="allow-same-origin"
                      data-testid="iframe-forgot-email-preview"
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
              <code className="text-primary">{"{{resetLink}}"}</code>
              <span className="text-muted-foreground">The password reset URL with token</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
