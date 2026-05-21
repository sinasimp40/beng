import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  Link,
  Image,
  Quote,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Eye,
  Edit2,
} from "lucide-react";

interface BBCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

const BBCODE_BUTTONS = [
  { icon: Bold, tag: "b", label: "Bold" },
  { icon: Italic, tag: "i", label: "Italic" },
  { icon: Underline, tag: "u", label: "Underline" },
  { icon: Strikethrough, tag: "s", label: "Strikethrough" },
  { icon: Quote, tag: "quote", label: "Quote" },
  { icon: Code, tag: "code", label: "Code" },
  { icon: List, tag: "list", label: "List" },
  { icon: Link, tag: "url", label: "Link", hasArg: true, argPrompt: "Enter URL:" },
  { icon: Image, tag: "img", label: "Image" },
  { icon: AlignLeft, tag: "left", label: "Left" },
  { icon: AlignCenter, tag: "center", label: "Center" },
  { icon: AlignRight, tag: "right", label: "Right" },
];

const COLORS = [
  { name: "Red", value: "red" },
  { name: "Green", value: "green" },
  { name: "Blue", value: "blue" },
  { name: "Yellow", value: "yellow" },
  { name: "Orange", value: "orange" },
  { name: "Purple", value: "purple" },
];

const SIZES = [
  { name: "Small", value: "10" },
  { name: "Normal", value: "14" },
  { name: "Large", value: "18" },
  { name: "X-Large", value: "24" },
];

export function BBCodeEditor({
  value,
  onChange,
  placeholder,
  className,
  "data-testid": testId,
}: BBCodeEditorProps) {
  const [activeTab, setActiveTab] = useState<string>("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const handleSelect = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      setSelection({ start: textarea.selectionStart, end: textarea.selectionEnd });
    }
  }, []);

  const insertTag = useCallback((tag: string, hasArg?: boolean, argPrompt?: string) => {
    const { start, end } = selection;
    const selectedText = value.substring(start, end);
    let newText: string;

    if (tag === "list") {
      const items = selectedText ? selectedText.split("\n").map(item => `[*]${item}`).join("\n") : "[*]Item 1\n[*]Item 2";
      newText = value.substring(0, start) + `[list]\n${items}\n[/list]` + value.substring(end);
    } else if (hasArg) {
      const arg = prompt(argPrompt || "Enter value:");
      if (!arg) return;
      newText = value.substring(0, start) + `[${tag}=${arg}]${selectedText}[/${tag}]` + value.substring(end);
    } else {
      newText = value.substring(0, start) + `[${tag}]${selectedText}[/${tag}]` + value.substring(end);
    }

    onChange(newText);
  }, [value, onChange, selection]);

  const insertColorTag = useCallback((color: string) => {
    const { start, end } = selection;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + `[color=${color}]${selectedText}[/color]` + value.substring(end);
    onChange(newText);
  }, [value, onChange, selection]);

  const insertSizeTag = useCallback((size: string) => {
    const { start, end } = selection;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + `[size=${size}]${selectedText}[/size]` + value.substring(end);
    onChange(newText);
  }, [value, onChange, selection]);

  const renderPreview = useCallback((bbcode: string) => {
    // Escape raw HTML so <script>/<img onerror=...> typed by the user are
    // rendered as plain text instead of executing in the preview.
    const escaped = bbcode
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    let html = escaped
      // Multiline alignment tags first (use [\s\S] for multiline matching)
      .replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div class="text-center">$1</div>')
      .replace(/\[left\]([\s\S]*?)\[\/left\]/gi, '<div class="text-left">$1</div>')
      .replace(/\[right\]([\s\S]*?)\[\/right\]/gi, '<div class="text-right">$1</div>')
      // Text formatting
      .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>')
      .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>')
      .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>')
      .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>')
      .replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote class="border-l-4 border-primary pl-4 italic opacity-80">$1</blockquote>')
      .replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono whitespace-pre-wrap">$1</code>')
      // Links and images — block javascript:/data:/vbscript: pseudo URLs.
      .replace(/\[url=(.*?)\]([\s\S]*?)\[\/url\]/gi, (_m, url, text) => {
        const safe = /^\s*(javascript|data|vbscript):/i.test(url) ? '#' : url;
        return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="text-primary underline">${text}</a>`;
      })
      .replace(/\[url\](.*?)\[\/url\]/gi, (_m, url) => {
        const safe = /^\s*(javascript|data|vbscript):/i.test(url) ? '#' : url;
        return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="text-primary underline">${safe}</a>`;
      })
      .replace(/\[img\](.*?)\[\/img\]/gi, (_m, url) => {
        const safe = /^\s*(javascript|data|vbscript):/i.test(url) ? '#' : url;
        return `<img src="${safe}" alt="" class="inline-block max-w-full h-auto max-h-[150px] object-contain rounded my-2" />`;
      })
      // Colors and sizes
      .replace(/\[color=(.*?)\]([\s\S]*?)\[\/color\]/gi, '<span style="color:$1">$2</span>')
      .replace(/\[size=(\d+)\]([\s\S]*?)\[\/size\]/gi, '<span style="font-size:$1px">$2</span>')
      // Lists
      .replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_, content) => {
        const items = content.split(/\[\*\]/).filter((item: string) => item.trim()).map((item: string) => `<li>${item.trim()}</li>`).join('');
        return `<ul class="list-disc pl-5 space-y-1">${items}</ul>`;
      })
      .replace(/\n/g, '<br />');

    return html;
  }, []);

  return (
    <div className={`border rounded-md bg-background ${className || ''}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/50">
          <div className="flex flex-wrap gap-1 flex-1">
            {BBCODE_BUTTONS.map(({ icon: Icon, tag, label, hasArg, argPrompt }) => (
              <Button
                key={tag}
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => insertTag(tag, hasArg, argPrompt)}
                title={label}
                data-testid={`button-bbcode-${tag}`}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
            
            <select
              className="h-8 px-2 text-sm bg-background border rounded cursor-pointer"
              onChange={(e) => { 
                if (e.target.value) {
                  insertColorTag(e.target.value);
                }
                e.target.selectedIndex = 0;
              }}
              data-testid="select-bbcode-color"
            >
              <option value="">Color</option>
              {COLORS.map(({ name, value }) => (
                <option key={value} value={value}>{name}</option>
              ))}
            </select>

            <select
              className="h-8 px-2 text-sm bg-background border rounded cursor-pointer"
              onChange={(e) => { 
                if (e.target.value) {
                  insertSizeTag(e.target.value);
                }
                e.target.selectedIndex = 0;
              }}
              data-testid="select-bbcode-size"
            >
              <option value="">Size</option>
              {SIZES.map(({ name, value }) => (
                <option key={value} value={value}>{name}</option>
              ))}
            </select>
          </div>

          <TabsList className="h-8">
            <TabsTrigger value="edit" className="h-7 px-2 text-xs gap-1">
              <Edit2 className="h-3 w-3" /> Edit
            </TabsTrigger>
            <TabsTrigger value="preview" className="h-7 px-2 text-xs gap-1">
              <Eye className="h-3 w-3" /> Preview
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="edit" className="m-0">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onSelect={handleSelect}
            onMouseUp={handleSelect}
            onKeyUp={handleSelect}
            placeholder={placeholder}
            className="w-full border-0 rounded-none rounded-b-md focus-visible:ring-0 focus:outline-none min-h-[150px] resize-y p-3 bg-background text-foreground"
            data-testid={testId}
          />
        </TabsContent>

        <TabsContent value="preview" className="m-0">
          <div 
            className="min-h-[150px] max-h-[300px] overflow-y-auto p-4 bg-card/50 rounded-b-md thin-scrollbar"
            dangerouslySetInnerHTML={{ __html: renderPreview(value) || '<span class="text-muted-foreground">Nothing to preview</span>' }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
