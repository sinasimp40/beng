import type { IconType } from "react-icons";
import { SiAnthropic, SiClaude, SiGooglegemini, SiTelegram } from "react-icons/si";
import { Bot, Code2, Cpu, Sparkles } from "lucide-react";

type Mark = { name: string; Icon: IconType; color: string };

const marks: Record<string, Mark> = {
  claude: { name: "Claude", Icon: SiClaude, color: "#D97757" },
  anthropic: { name: "Anthropic", Icon: SiAnthropic, color: "#D97757" },
  "claude-code": { name: "Claude Code", Icon: SiClaude, color: "#D97757" },
  codex: { name: "Codex", Icon: Code2, color: "#64748B" },
  chatgpt: { name: "ChatGPT", Icon: Sparkles, color: "#10A37F" },
  gpt: { name: "GPT", Icon: Sparkles, color: "#10A37F" },
  openai: { name: "OpenAI", Icon: Sparkles, color: "#10A37F" },
  gemini: { name: "Gemini", Icon: SiGooglegemini, color: "#8B7CFF" },
  deepseek: { name: "DeepSeek", Icon: Cpu, color: "#4A91F2" },
  qwen: { name: "Qwen", Icon: Sparkles, color: "#615CED" },
  kimi: { name: "Kimi", Icon: Bot, color: "#52A6FF" },
  telegram: { name: "Telegram", Icon: SiTelegram, color: "#2AABEE" },
  cline: { name: "Cline", Icon: Code2, color: "#8FBF3F" },
  roo: { name: "Roo Code", Icon: Code2, color: "#E2794A" },
  opencode: { name: "OpenCode", Icon: Code2, color: "#F26D4F" },
  hermes: { name: "Hermes", Icon: Cpu, color: "#E8B44D" },
  vietcode: { name: "VietCode", Icon: Code2, color: "#2FAE78" },
  openclaw: { name: "OpenClaw", Icon: Bot, color: "#E66C59" },
};

const modelFamilies = ["claude", "codex", "gpt", "gemini", "deepseek", "qwen", "kimi"] as const;

export function modelMarks(models: string[], group?: string) {
  const text = `${group || ""} ${models.join(" ")}`.toLowerCase();
  const found = modelFamilies.filter(family => text.includes(family));
  return found.length ? found.map(family => marks[family]) : [{ name: "AI models", Icon: Cpu, color: "#64748B" }];
}

export function ProviderMark({ id, large = false }: { id: string; large?: boolean }) {
  const key = id.toLowerCase();
  const mark = marks[key] || (key.includes("claude") ? marks.claude : key.includes("codex") ? marks.codex : key.includes("open") ? marks.openai : key.includes("roo") ? marks.roo : key.includes("cline") ? marks.cline : key.includes("telegram") ? marks.telegram : marks.vietcode);
  const Icon = mark.Icon;
  return <span aria-label={mark.name} title={mark.name} className={`grid shrink-0 place-items-center rounded-xl border border-border bg-gradient-to-br from-white/20 via-white/5 to-black/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_0_-1px_rgba(0,0,0,0.12),0_8px_16px_-10px_currentColor] ${large ? "h-12 w-12" : "h-9 w-9"}`} style={{ color: mark.color, backgroundColor: `${mark.color}20` }}><Icon aria-hidden="true" className={`${large ? "h-7 w-7" : "h-5 w-5"} drop-shadow-sm`} /></span>;
}

export function ModelArtwork({ models, group }: { models: string[]; group?: string }) {
  const artwork = modelMarks(models, group);
  return <div className="flex shrink-0 flex-wrap items-center gap-1.5" aria-label={`AI providers: ${artwork.map(mark => mark.name).join(", ")}`}>
    {artwork.map(mark => {
      const Icon = mark.Icon;
      return <span key={mark.name} title={mark.name} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-gradient-to-br from-white/20 to-black/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_3px_0_-1px_rgba(0,0,0,0.12)]" style={{ color: mark.color, backgroundColor: `${mark.color}20` }}><Icon aria-hidden="true" className="h-5 w-5 drop-shadow-sm" /></span>;
    })}
  </div>;
}
