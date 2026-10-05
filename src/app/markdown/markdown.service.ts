import { Injectable } from '@nestjs/common';
import hljs from 'highlight.js';
import markdownIt, {
  type Env,
  type MarkdownIt,
  type StateCore,
  type Token,
} from 'markdown-it';

// Links to any other host open in a new tab.
const SITE_HOST = 'marco.figueroa-sanchez.com';
const WORDS_PER_MINUTE = 200;
const TASK_PATTERN = /^\[([ xX])\]\s+/;

export interface TocEntry {
  level: 2 | 3;
  text: string;
  id: string;
}

export interface RenderedMarkdown {
  html: string;
  toc: TocEntry[];
  readingMinutes: number;
}

interface RenderEnv extends Env {
  toc: TocEntry[];
}

// Lowercase, accents and ñ transliterated, other characters as single hyphens.
export function slugifyHeading(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inlineText(inline: Token | undefined): string {
  return (inline?.children ?? [])
    .filter((child) => child.type === 'text' || child.type === 'code_inline')
    .map((child) => child.content)
    .join('')
    .trim();
}

function isExternal(href: string): boolean {
  try {
    const url = new URL(href);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname !== SITE_HOST
    );
  } catch {
    // Relative URLs and anchors stay on the site.
    return false;
  }
}

// h2/h3 get unique ids (`-2`, `-3` for repeats) and feed the table of
// contents; empty headings get neither.
function headingAnchors(state: StateCore): void {
  const env = state.env as RenderEnv;
  const used = new Set<string>();
  state.tokens.forEach((token, index) => {
    if (token.type !== 'heading_open') return;
    if (token.tag !== 'h2' && token.tag !== 'h3') return;
    const text = inlineText(state.tokens[index + 1]);
    if (!text) return;
    const base = slugifyHeading(text) || 'section';
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    token.attrSet('id', id);
    env.toc.push({ level: token.tag === 'h2' ? 2 : 3, text, id });
  });
}

// GitHub task lists: `- [ ] item` / `- [x] item` become disabled checkboxes.
function taskLists(state: StateCore): void {
  const tokens = state.tokens;
  tokens.forEach((token, index) => {
    if (token.type !== 'inline') return;
    if (tokens[index - 1]?.type !== 'paragraph_open') return;
    if (tokens[index - 2]?.type !== 'list_item_open') return;
    const first = token.children?.[0];
    const match = first?.type === 'text' && TASK_PATTERN.exec(first.content);
    if (!first || !match) return;

    first.content = first.content.slice(match[0].length);
    const checkbox = new state.Token('html_inline', '', 0);
    checkbox.content =
      match[1] === ' '
        ? '<input type="checkbox" disabled> '
        : '<input type="checkbox" disabled checked> ';
    token.children?.unshift(checkbox);
    tokens[index - 2].attrJoin('class', 'task-list-item');
  });
}

function countWords(tokens: Token[]): number {
  let words = 0;
  for (const token of tokens) {
    // Fenced and indented code (including diagrams) is not read as prose.
    if (token.type !== 'inline') continue;
    for (const child of token.children ?? []) {
      if (child.type === 'text' || child.type === 'code_inline') {
        words += child.content.split(/\s+/).filter(Boolean).length;
      }
    }
  }
  return words;
}

// The single Markdown renderer of the site (plan D5): the web shows its HTML
// as is and the panel preview calls POST /markdown/render. Raw HTML is never
// rendered (`html: false`), so bodies cannot inject markup or scripts.
@Injectable()
export class MarkdownService {
  private readonly md = this.createRenderer();

  render(markdown: string): RenderedMarkdown {
    const env: RenderEnv = { toc: [] };
    const tokens = this.md.parse(markdown, env);
    const html = this.md.renderer.render(tokens, this.md.options, env);
    const readingMinutes = Math.max(
      1,
      Math.ceil(countWords(tokens) / WORDS_PER_MINUTE),
    );
    return { html, toc: env.toc, readingMinutes };
  }

  private createRenderer(): MarkdownIt {
    const md = markdownIt({
      html: false,
      linkify: true,
      typographer: false,
    });
    const { escapeHtml } = md.utils;

    md.core.ruler.push('task_lists', taskLists);
    md.core.ruler.push('heading_anchors', headingAnchors);

    md.renderer.rules.fence = (tokens, index) => {
      const token = tokens[index];
      const lang = token.info.trim().split(/\s+/)[0] ?? '';
      if (lang === 'mermaid') {
        // Drawn in the browser by the web and the panel; the escaped source
        // stays readable without JavaScript.
        return `<figure class="md-mermaid"><pre class="mermaid-source"><code>${escapeHtml(token.content)}</code></pre></figure>\n`;
      }
      if (lang && hljs.getLanguage(lang)) {
        const highlighted = hljs.highlight(token.content, {
          language: lang,
          ignoreIllegals: true,
        }).value;
        return `<pre><code class="hljs language-${escapeHtml(lang)}">${highlighted}</code></pre>\n`;
      }
      const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      return `<pre><code${langClass}>${escapeHtml(token.content)}</code></pre>\n`;
    };

    const renderToken = md.renderer.renderToken.bind(md.renderer);

    md.renderer.rules.link_open = (tokens, index, options) => {
      const token = tokens[index];
      if (isExternal(String(token.attrGet('href') ?? ''))) {
        token.attrSet('target', '_blank');
        token.attrSet('rel', 'noopener noreferrer');
      }
      return renderToken(tokens, index, options);
    };

    const image = md.renderer.rules.image!;
    md.renderer.rules.image = (tokens, index, options, env, self) => {
      tokens[index].attrSet('loading', 'lazy');
      return image(tokens, index, options, env, self);
    };

    return md;
  }
}
