import type { IconType } from "react-icons";
import { SiAnthropic, SiClaude, SiGooglegemini, SiMoonshotai, SiQwen, SiTelegram } from "react-icons/si";
import { Bot, Code2, Cpu, Sparkles } from "lucide-react";

type Mark = { name: string; Icon: IconType; color: string; image?: string };

const marks: Record<string, Mark> = {
  claude: { name: "Claude", Icon: SiClaude, color: "#D97757", image: "/images/ai-providers/claude.svg" },
  anthropic: { name: "Anthropic", Icon: SiAnthropic, color: "#D97757", image: "/images/ai-providers/claude.svg" },
  "claude-code": { name: "Claude Code", Icon: SiClaude, color: "#D97757", image: "/images/ai-providers/claude.svg" },
  codex: { name: "Codex", Icon: Code2, color: "#10A37F", image: "/images/ai-providers/openai.svg" },
  chatgpt: { name: "ChatGPT", Icon: Sparkles, color: "#10A37F", image: "/images/ai-providers/openai.svg" },
  gpt: { name: "GPT", Icon: Sparkles, color: "#10A37F", image: "/images/ai-providers/openai.svg" },
  openai: { name: "OpenAI", Icon: Sparkles, color: "#10A37F", image: "/images/ai-providers/openai.svg" },
  gemini: { name: "Gemini", Icon: SiGooglegemini, color: "#8B7CFF", image: "/images/ai-providers/gemini.svg" },
  deepseek: { name: "DeepSeek", Icon: Cpu, color: "#4A91F2", image: "/images/ai-providers/deepseek.svg" },
  qwen: { name: "Qwen", Icon: SiQwen, color: "#615CED", image: "/images/ai-providers/qwen.svg" },
  kimi: { name: "Kimi", Icon: SiMoonshotai, color: "#52A6FF", image: "/images/ai-providers/kimi.svg" },
  telegram: { name: "Telegram", Icon: SiTelegram, color: "#2AABEE" },
  cline: { name: "Cline", Icon: Code2, color: "#8FBF3F" },
  roo: { name: "Roo Code", Icon: Code2, color: "#E2794A" },
  opencode: { name: "OpenCode", Icon: Code2, color: "#F26D4F" },
  hermes: { name: "Hermes", Icon: Cpu, color: "#E8B44D" },
  vietcode: { name: "VietCode", Icon: Code2, color: "#2FAE78" },
  openclaw: { name: "OpenClaw", Icon: Bot, color: "#E66C59" },
};

const modelFamilies = ["claude", "codex", "gpt", "gemini", "deepseek", "qwen", "kimi"] as const;

export function modelMarks(models: string[], group?: string): Mark[] {
  const text = `${group || ""} ${models.join(" ")}`.toLowerCase();
  const found = modelFamilies.filter(family => text.includes(family));
  return found.map(family => marks[family]);
}

function ArtworkImage({ mark, size }: { mark: Mark; size: "small" | "large" }) {
  const Icon = mark.Icon;
  const dimensions = size === "large" ? "h-7 w-7" : "h-5 w-5";
  return mark.image
    ? <img src={mark.image} alt="" aria-hidden="true" className={`${dimensions} object-contain drop-shadow-sm`} />
    : <Icon aria-hidden="true" className={`${dimensions} drop-shadow-sm`} />;
}

export function ProviderMark({ id, large = false }: { id: string; large?: boolean }) {
  const key = id.toLowerCase();
  const mark: Mark = marks[key] || (key.includes("claude") ? marks.claude : key.includes("codex") ? marks.codex : key.includes("open") ? marks.openai : key.includes("roo") ? marks.roo : key.includes("cline") ? marks.cline : key.includes("telegram") ? marks.telegram : marks.vietcode);
  return <span aria-label={mark.name} title={mark.name} className={`grid shrink-0 place-items-center rounded-xl border border-border bg-gradient-to-br from-white/20 via-white/5 to-black/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_0_-1px_rgba(0,0,0,0.12),0_8px_16px_-10px_currentColor] ${large ? "h-12 w-12" : "h-9 w-9"}`} style={{ color: mark.color, backgroundColor: `${mark.color}20` }}>
    <ArtworkImage mark={mark} size={large ? "large" : "small"} />
  </span>;
}

export function ModelArtwork({ models, group }: { models: string[]; group?: string }) {
  const artwork = modelMarks(models, group);
  return <div className="flex shrink-0 flex-wrap items-center gap-1.5" aria-label={`AI providers: ${artwork.map(mark => mark.name).join(", ")}`}>
    {artwork.map(mark => <span key={mark.name} title={mark.name} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-gradient-to-br from-white/20 to-black/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_3px_0_-1px_rgba(0,0,0,0.12)]" style={{ color: mark.color, backgroundColor: `${mark.color}20` }}>
      <ArtworkImage mark={mark} size="small" />
    </span>)}
  </div>;
}