import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { absoluteImageUrl, formatImageSize, IMAGE_ACCEPT, type HostedImage, uploadImageFile } from "@/lib/image-upload";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImagePlus, Copy, Trash2, Loader2, Images, ExternalLink } from "lucide-react";

export function ImageLibrary() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const { data: images = [], isLoading, isError } = useQuery<HostedImage[]>({ queryKey: ["/api/admin/images"] });

  const deleteMutation = useMutation({
    mutationFn: async (image: HostedImage) => {
      await apiRequest("DELETE", `/api/admin/images/${encodeURIComponent(image.name)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/images"] });
      toast({ title: "Image deleted" });
    },
    onError: (error: Error) => toast({ title: "Could not delete image", description: error.message, variant: "destructive" }),
  });

  const handleUpload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadImageFile(file);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/images"] });
      toast({ title: "Image uploaded", description: "The image is now hosted by BuyBit." });
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Could not upload image", variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const copyUrl = async (image: HostedImage) => {
    await navigator.clipboard.writeText(absoluteImageUrl(image.url));
    toast({ title: "Image URL copied", description: "The public URL is ready to paste." });
  };

  return <div className="space-y-6">
    <Card className="border-primary/15">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><Images className="h-5 w-5 text-primary" /></div>
          <div><CardTitle>Image library</CardTitle><p className="mt-1 text-sm text-muted-foreground">Upload product artwork and copy a public BuyBit URL.</p></div>
        </div>
        <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={event => void handleUpload(event.target.files?.[0])} />
        <Button onClick={() => inputRef.current?.click()} disabled={uploading} className="gap-2">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {uploading ? "Uploading..." : "Upload image"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : isError ? <p className="py-10 text-center text-sm text-destructive">Could not load the image library.</p> : images.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center"><ImagePlus className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" /><p className="font-medium">No hosted images yet</p><p className="mt-1 text-sm text-muted-foreground">Upload a PNG, JPEG, WebP, or GIF up to 5 MB.</p></div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {images.map(image => <div key={image.name} className="overflow-hidden rounded-xl border bg-card">
            <div className="aspect-square bg-muted/40 p-3"><img src={image.url} alt="" className="h-full w-full rounded-lg object-contain" loading="lazy" /></div>
            <div className="space-y-3 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium" title={image.name}>{image.name}</p><p className="mt-1 text-xs text-muted-foreground">{formatImageSize(image.size)} · {new Date(image.uploadedAt).toLocaleDateString()}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" className="min-w-0 flex-1 gap-1.5" onClick={() => void copyUrl(image)}><Copy className="h-3.5 w-3.5" />Copy URL</Button><Button size="icon" variant="ghost" aria-label="Open image" title="Open image" asChild><a href={image.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button><Button size="icon" variant="ghost" aria-label="Delete image" title="Delete image" onClick={() => { if (window.confirm("Delete this hosted image?")) deleteMutation.mutate(image); }} disabled={deleteMutation.isPending}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>
          </div>)}
        </div>}
      </CardContent>
    </Card>
  </div>;
}