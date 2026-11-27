import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const generatedImageName = /^[a-f0-9-]{36}\.(?:png|jpe?g|webp|gif)$/i;

export type UploadedImage = { name: string; url: string; size: number; uploadedAt: string };

export function getUploadDir() { return path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads")); }
function imageType(buffer: Buffer): "png" | "jpg" | "webp" | "gif" | null {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pngEnd = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  if (buffer.length >= 45 && buffer.subarray(0, 8).equals(pngSignature) && buffer.subarray(12, 16).toString("ascii") === "IHDR" && buffer.subarray(-8).equals(pngEnd)) return "png";
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && buffer.subarray(-2).equals(Buffer.from([0xff, 0xd9]))) return "jpg";
  if (buffer.length >= 7 && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a") && buffer[buffer.length - 1] === 0x3b) return "gif";
  if (buffer.length >= 16 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    const declaredSize = buffer.readUInt32LE(4) + 8;
    if (declaredSize === buffer.length) return "webp";
  }
  return null;
}
export function isGeneratedImageName(name: string) { return generatedImageName.test(name); }
export async function ensureUploadDir() { await fs.mkdir(getUploadDir(), { recursive: true }); }
export async function saveUploadedImage(dataUrl: string): Promise<UploadedImage> {
  const match = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error("Upload a PNG, JPEG, WebP, or GIF image");
  const buffer = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("Image must be 5 MB or smaller");
  const type = imageType(buffer);
  if (!type) throw new Error("The uploaded file is not a supported image");
  await ensureUploadDir();
  const name = `${randomUUID()}.${type}`;
  const filePath = path.join(getUploadDir(), name);
  await fs.writeFile(filePath, buffer, { flag: "wx" });
  const stat = await fs.stat(filePath);
  return { name, url: `/uploads/${name}`, size: stat.size, uploadedAt: stat.mtime.toISOString() };
}
export async function listUploadedImages(): Promise<UploadedImage[]> {
  await ensureUploadDir();
  const entries = await fs.readdir(getUploadDir(), { withFileTypes: true });
  const images = await Promise.all(entries.filter(entry => entry.isFile() && isGeneratedImageName(entry.name)).map(async entry => {
    const stat = await fs.stat(path.join(getUploadDir(), entry.name));
    return { name: entry.name, url: `/uploads/${entry.name}`, size: stat.size, uploadedAt: stat.mtime.toISOString() };
  }));
  return images.sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt));
}
export async function deleteUploadedImage(name: string) {
  if (!isGeneratedImageName(name)) throw new Error("Invalid image name");
  await fs.unlink(path.join(getUploadDir(), path.basename(name)));
}