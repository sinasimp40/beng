function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^\s*javascript:/i.test(trimmed) || /^\s*data:/i.test(trimmed) || /^\s*vbscript:/i.test(trimmed)) {
    return '#';
  }
  return trimmed;
}

function sanitizeColor(color: string): string {
  return /^[a-zA-Z]+$|^#[0-9a-fA-F]{3,8}$|^rgb\([\d,\s]+\)$|^rgba\([\d.,\s]+\)$/.test(color.trim())
    ? color.trim()
    : 'inherit';
}

export function renderBBCode(bbcode: string): string {
  if (!bbcode) return '';

  const linkClass = 'inline-flex items-center gap-1 text-primary font-medium underline decoration-primary/40 underline-offset-2 hover:decoration-primary hover:opacity-90 transition-all';
  const linkIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block flex-shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

  // Escape ALL HTML in the raw BBCode first so any <script>, <img onerror=...>,
  // or other tags the user typed are rendered as harmless text. BBCode tags
  // (square brackets) survive escaping and are then converted to safe HTML.
  let html = escapeHtml(bbcode)
    .replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div class="text-center">$1</div>')
    .replace(/\[left\]([\s\S]*?)\[\/left\]/gi, '<div class="text-left">$1</div>')
    .replace(/\[right\]([\s\S]*?)\[\/right\]/gi, '<div class="text-right">$1</div>')
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>')
    .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>')
    .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>')
    .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>')
    .replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote class="border-l-4 border-primary pl-4 italic opacity-80 my-2">$1</blockquote>')
    .replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono whitespace-pre-wrap">$1</code>')
    .replace(/\[url=(.*?)\]([\s\S]*?)\[\/url\]/gi, (_m, url, text) => {
      const safeUrl = escapeHtml(sanitizeUrl(url));
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="${linkClass}">${text} ${linkIcon}</a>`;
    })
    .replace(/\[url\](.*?)\[\/url\]/gi, (_m, url) => {
      const safeUrl = escapeHtml(sanitizeUrl(url));
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="${linkClass}">${safeUrl} ${linkIcon}</a>`;
    })
    .replace(/\[img\](.*?)\[\/img\]/gi, (_m, url) => {
      const safeUrl = escapeHtml(sanitizeUrl(url));
      return `<img src="${safeUrl}" alt="" class="inline-block max-w-full h-auto max-h-[150px] object-contain rounded my-2" />`;
    })
    .replace(/\[color=(.*?)\]([\s\S]*?)\[\/color\]/gi, (_m, color, text) => {
      return `<span style="color:${sanitizeColor(color)}">${text}</span>`;
    })
    .replace(/\[size=(\d+)\]([\s\S]*?)\[\/size\]/gi, (_m, size, text) => {
      const n = Math.min(72, Math.max(8, parseInt(size, 10) || 14));
      return `<span style="font-size:${n}px">${text}</span>`;
    })
    .replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_, content) => {
      const items = content.split(/\[\*\]/).filter((item: string) => item.trim()).map((item: string) => `<li>${item.trim()}</li>`).join('');
      return `<ul class="list-disc pl-5 space-y-1 my-2">${items}</ul>`;
    })
    .replace(/\n/g, '<br />');

  // Auto-link bare URLs the user typed (they were HTML-escaped above so
  // matching against the escaped string is safe).
  html = html.replace(
    /(?<!["'=])(https?:\/\/[^\s<>"']+)/gi,
    (match) => {
      let url = match;
      if (url.endsWith(')') || url.endsWith('.')) {
        url = url.slice(0, -1);
      }
      const safe = sanitizeUrl(url);
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="${linkClass}">${safe} ${linkIcon}</a>`;
    }
  );

  return html;
}
