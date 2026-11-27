import { apiRequest } from "@/lib/queryClient";

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export type HostedImage = { name: string; url: string; size: number; uploadedAt: string };

export function formatImageSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function absoluteImageUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `${window.location.origin}${url}`;
}

export async function uploadImageFile(file: File): Promise<HostedImage> {
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    throw new Error("Choose a PNG, JPEG, WebP, or GIF image");
  }
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be 5 MB or smaller");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that image"));
    reader.readAsDataURL(file);
  });
  const response = await apiRequest("POST", "/api/admin/images", { fileName: file.name, dataUrl });
  return response.json();
}