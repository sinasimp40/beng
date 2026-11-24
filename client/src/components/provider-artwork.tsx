import { Bot, Code2, Cpu, Sparkles, type LucideIcon } from "lucide-react";
import { useState } from "react";
import claudeAppImage from "../assets/ai-providers/claude-app.png";
import claudeImage from "../assets/ai-providers/claude.svg";
import codexImage from "../assets/ai-providers/codex-app.png";
import deepseekImage from "../assets/ai-providers/deepseek.svg";
import geminiImage from "../assets/ai-providers/gemini.svg";
import hermesImage from "../assets/ai-providers/hermes.png";
import kimiImage from "../assets/ai-providers/kimi.svg";
import openaiImage from "../assets/ai-providers/openai.svg";
import openclawImage from "../assets/ai-providers/openclaw.png";
import opencodeImage from "../assets/ai-providers/opencode.png";
import qwenImage from "../assets/ai-providers/qwen.svg";
import rooCodeImage from "../assets/ai-providers/roo-code.png";
import vietcodeImage from "../assets/ai-providers/vietcode.png";

type Mark = { name: string; Icon: LucideIcon; color: string; image?: string };

const marks: Record<string, Mark> = {
  claude: { name: "Claude", Icon: Bot, color: "#D97757", image: claudeAppImage },
  anthropic: { name: "Anthropic", Icon: Bot, color: "#D97757", image: claudeImage },
  "claude-code": { name: "Claude Code", Icon: Bot, color: "#D97757", image: claudeAppImage },
  codex: { name: "Codex", Icon: Code2, color: "#10A37F", image: codexImage },
  chatgpt: { name: "ChatGPT", Icon: Sparkles, color: "#10A37F", image: openaiImage },
  gpt: { name: "GPT", Icon: Sparkles, color: "#10A37F", image: openaiImage },
  openai: { name: "OpenAI", Icon: Sparkles, color: "#10A37F", image: openaiImage },
  gemini: { name: "Gemini", Icon: Sparkles, color: "#8B7CFF", image: geminiImage },
  deepseek: { name: "DeepSeek", Icon: Cpu, color: "#4A91F2", image: deepseekImage },
  qwen: { name: "Qwen", Icon: Cpu, color: "#615CED", image: qwenImage },
  kimi: { name: "Kimi", Icon: Sparkles, color: "#52A6FF", image: kimiImage },
  telegram: { name: "Telegram", Icon: Bot, color: "#2AABEE" },
  cline: { name: "Cline", Icon: Code2, color: "#8FBF3F" },
  roo: { name: "Roo Code", Icon: Code2, color: "#E2794A", image: rooCodeImage },
  opencode: { name: "OpenCode", Icon: Code2, color: "#F26D4F", image: opencodeImage },
  hermes: { name: "Hermes", Icon: Cpu, color: "#E8B44D", image: hermesImage },
  vietcode: { name: "VietCode", Icon: Code2, color: "#2FAE78", image: vietcodeImage },
  openclaw: { name: "OpenClaw", Icon: Bot, color: "#E66C59", image: openclawImage },
};

// Bundled artwork uses fingerprinted Vite URLs so deployments do not reuse stale cached image paths.
const setupArtwork: Record<string, { name: string; mark: Mark }> = {
  vietcode: { name: "VietCode CLI", mark: marks.vietcode },
  "claude-code": { name: "Claude Code", mark: marks["claude-code"] },
  "claude-desktop": { name: "Claude Desktop", mark: marks["claude-code"] },
  codex: { name: "Codex CLI", mark: marks.codex },
  "codex-app": { name: "Codex App", mark: marks.codex },
  openclaw: { name: "OpenClaw", mark: marks.openclaw },
  opencode: { name: "OpenCode", mark: marks.opencode },
  hermes: { name: "Hermes Agent", mark: marks.hermes },
  "roo-code": { name: "Roo Code", mark: marks.roo },
};

export function SetupAppArtwork({ id }: { id: string }) {
  const artwork = setupArtwork[id.toLowerCase()];
  if (!artwork) return null;
  return <span aria-label={artwork.name} title={artwork.name} className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-black/10 bg-white p-1.5 shadow-sm" style={{ color: artwork.mark.color }}>
    <ArtworkImage key={artwork.mark.image ?? artwork.mark.name} mark={artwork.mark} size="setup" />
  </span>;
}
export function modelMarks(models: string[], group?: string): Mark[] {
  const text = `${group || ""} ${models.join(" ")}`.toLowerCase();
  const ordered = ["vietcode", "openclaw", "opencode", "hermes", "roo", "claude", "codex", "gemini", "deepseek", "qwen", "kimi", "gpt"] as const;
  const found = ordered.filter(family => {
    if (family === "roo") return /\broo(?:\s|-)?code\b/i.test(text);
    if (family === "gpt") return /\b(?:gpt|chatgpt|openai)\b/i.test(text);
    return text.includes(family);
  });
  return found.map(family => marks[family]);
}

function ArtworkImage({ mark, size }: { mark: Mark; size: "small" | "large" | "setup" }) {
  const [imageFailed, setImageFailed] = useState(false);
  const Icon = mark.Icon;
  const dimensions = size === "setup" ? "h-11 w-11" : size === "large" ? "h-7 w-7" : "h-6 w-6";
  const monogram = mark.name.split(/[\s/-]+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  if (mark.image && !imageFailed) {
    return <img src={mark.image} alt="" aria-hidden="true" width={size === "setup" ? 44 : undefined} height={size === "setup" ? 44 : undefined} decoding="async" className={`${dimensions} object-contain drop-shadow-sm`} onError={() => setImageFailed(true)} />;
  }
  // If a file is ever unavailable, use the brand's own initials instead of a broken-image box.
  return mark.image
    ? <span aria-hidden="true" className={`grid ${dimensions} place-items-center font-bold leading-none tracking-tight text-current ${size === "setup" ? "text-base" : "text-[10px]"}`}>{monogram}</span>
    : <Icon aria-hidden="true" className={`${dimensions} drop-shadow-sm`} />;
}

export function ProviderMark({ id, large = false }: { id: string; large?: boolean }) {
  const key = id.toLowerCase();
  const mark: Mark = marks[key] || (key.includes("claude") ? marks.claude : key.includes("codex") ? marks.codex : key.includes("openclaw") ? marks.openclaw : key.includes("opencode") ? marks.opencode : key.includes("open") ? marks.openai : key.includes("roo") ? marks.roo : key.includes("hermes") ? marks.hermes : key.includes("vietcode") ? marks.vietcode : key.includes("cline") ? marks.cline : key.includes("telegram") ? marks.telegram : marks.vietcode);
  return <span aria-label={mark.name} title={mark.name} className={`grid shrink-0 place-items-center rounded-xl border border-border bg-gradient-to-br from-white/20 via-white/5 to-black/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_0_-1px_rgba(0,0,0,0.12),0_8px_16px_-10px_currentColor] ${large ? "h-12 w-12" : "h-9 w-9"}`} style={{ color: mark.color, backgroundColor: mark.image ? "#ffffff" : `${mark.color}20` }}>
    <ArtworkImage key={mark.image ?? mark.name} mark={mark} size={large ? "large" : "small"} />
  </span>;
}

export function ModelArtwork({ models, group }: { models: string[]; group?: string }) {
  const artwork = modelMarks(models, group);
  return <div className="flex shrink-0 flex-wrap items-center gap-1.5" aria-label={`AI providers: ${artwork.map(mark => mark.name).join(", ")}`}>
    {artwork.map(mark => <span key={mark.name} title={mark.name} className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-border bg-white p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_3px_0_-1px_rgba(0,0,0,0.12)]" style={{ color: mark.color, backgroundColor: mark.image ? "#ffffff" : `${mark.color}20` }}>
      <ArtworkImage key={mark.image ?? mark.name} mark={mark} size="small" />
    </span>)}
  </div>;
}