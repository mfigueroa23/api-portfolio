import { MarkdownService } from './markdown.service.js';

describe('MarkdownService', () => {
  const service = new MarkdownService();
  const html = (md: string) => service.render(md).html;

  describe('base rules', () => {
    it('renders GitHub-flavored tables', () => {
      const out = html('| a | b |\n|---|---|\n| 1 | 2 |');

      expect(out).toContain('<table>');
      expect(out).toContain('<th>a</th>');
      expect(out).toContain('<td>2</td>');
    });

    it('renders strikethrough', () => {
      expect(html('~~gone~~')).toContain('<s>gone</s>');
    });

    it('renders task lists as disabled checkboxes', () => {
      const out = html('- [ ] todo\n- [x] done');

      expect(out).toContain('<input type="checkbox" disabled> todo');
      expect(out).toContain('<input type="checkbox" disabled checked> done');
      expect(out).toContain('class="task-list-item"');
      expect(out).not.toContain('[ ]');
    });

    it('escapes raw HTML and scripts', () => {
      const out = html(
        '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">',
      );

      expect(out).not.toContain('<script');
      expect(out).not.toContain('<img src=x');
      expect(out).toContain('&lt;script&gt;');
      expect(out).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    });

    it('does not link javascript: URLs', () => {
      const out = html('[click](javascript:alert(1))');

      expect(out).not.toContain('href="javascript:');
      expect(out).not.toContain('<a');
    });

    it('opens external links in a new tab', () => {
      expect(html('[x](https://github.com/marco)')).toContain(
        '<a href="https://github.com/marco" target="_blank" rel="noopener noreferrer">x</a>',
      );
    });

    it('keeps links to the site and relative links in the same tab', () => {
      const own = html('[x](https://marco.figueroa-sanchez.com/blog)');
      const relative = html('[x](/projects)');

      expect(own).toContain(
        '<a href="https://marco.figueroa-sanchez.com/blog">x</a>',
      );
      expect(relative).toContain('<a href="/projects">x</a>');
    });

    it('marks linkified external URLs as external too', () => {
      expect(html('see https://example.com now')).toContain(
        '<a href="https://example.com" target="_blank" rel="noopener noreferrer">',
      );
    });

    it('lazy-loads images and keeps their alt text', () => {
      expect(
        html('![A diagram](https://api.figueroa-sanchez.com/files/1)'),
      ).toContain(
        '<img src="https://api.figueroa-sanchez.com/files/1" alt="A diagram" loading="lazy">',
      );
    });

    it('allows images from external URLs', () => {
      expect(html('![x](https://images.example.com/a.png)')).toContain(
        'src="https://images.example.com/a.png"',
      );
    });
  });

  describe('code blocks', () => {
    it('highlights fenced code tagged with a known language', () => {
      const out = html('```ts\nconst a = 1;\n```');

      expect(out).toContain('<pre><code class="hljs language-ts">');
      expect(out).toContain('<span class="hljs-keyword">const</span>');
    });

    it('escapes code of an unknown language without highlighting', () => {
      const out = html('```nope\n<b>x</b>\n```');

      expect(out).toContain('&lt;b&gt;x&lt;/b&gt;');
      expect(out).not.toContain('hljs-');
      expect(out).not.toContain('<b>');
    });

    it('escapes untagged fenced code', () => {
      expect(html('```\n<i>x</i>\n```')).toContain('&lt;i&gt;x&lt;/i&gt;');
    });

    it('wraps mermaid fences as escaped diagram source', () => {
      const out = html('```mermaid\ngraph TD\n  A-->B["<b>"]\n```');

      expect(out).toBe(
        '<figure class="md-mermaid"><pre class="mermaid-source"><code>graph TD\n  A--&gt;B[&quot;&lt;b&gt;&quot;]\n</code></pre></figure>\n',
      );
    });
  });

  describe('headings, table of contents and reading time', () => {
    it('gives h2 and h3 unique slug ids and lists them in the toc', () => {
      const result = service.render(
        '## Intro\n\n### Setup & Run\n\n## Intro\n\n## Intro',
      );

      expect(result.html).toContain('<h2 id="intro">Intro</h2>');
      expect(result.html).toContain('<h3 id="setup-run">Setup &amp; Run</h3>');
      expect(result.html).toContain('<h2 id="intro-2">Intro</h2>');
      expect(result.html).toContain('<h2 id="intro-3">Intro</h2>');
      expect(result.toc).toEqual([
        { level: 2, text: 'Intro', id: 'intro' },
        { level: 3, text: 'Setup & Run', id: 'setup-run' },
        { level: 2, text: 'Intro', id: 'intro-2' },
        { level: 2, text: 'Intro', id: 'intro-3' },
      ]);
    });

    it('uses the heading text only, without markup', () => {
      const result = service.render('## Use **bold** and `code`');

      expect(result.toc).toEqual([
        { level: 2, text: 'Use bold and code', id: 'use-bold-and-code' },
      ]);
    });

    it('skips empty headings and ignores h1 and h4', () => {
      const result = service.render('# Title\n\n##\n\n#### Deep\n\n## Real');

      expect(result.toc).toEqual([{ level: 2, text: 'Real', id: 'real' }]);
      expect(result.html).toContain('<h4>Deep</h4>');
    });

    it('transliterates accents in heading ids', () => {
      expect(service.render('## Diseño y Año').toc[0].id).toBe('diseno-y-ano');
    });

    it('computes reading time from words outside fences', () => {
      const words = Array.from({ length: 401 }, () => 'word').join(' ');
      const code = Array.from({ length: 1000 }, () => 'x').join(' ');

      const result = service.render(
        `${words}\n\n\`\`\`js\n${code}\n\`\`\`\n\n\`\`\`mermaid\n${code}\n\`\`\``,
      );

      expect(result.readingMinutes).toBe(3);
    });

    it('counts 200 words as one minute', () => {
      const words = Array.from({ length: 200 }, () => 'word').join(' ');

      expect(service.render(words).readingMinutes).toBe(1);
    });

    it('reports one minute for a body with only a diagram', () => {
      expect(
        service.render('```mermaid\ngraph TD\n  A-->B\n```').readingMinutes,
      ).toBe(1);
      expect(service.render('').readingMinutes).toBe(1);
    });
  });
});
