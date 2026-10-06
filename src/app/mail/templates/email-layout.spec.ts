import { contrastRatio } from './contrast.js';
import { EmailContent, renderEmail, renderText } from './email-layout.js';
import { EMAIL_TEXT_PAIRS, palette } from './palette.js';

const content: EmailContent = {
  title: 'New message from your portfolio',
  eyebrow: 'Get In Touch',
  heading: 'New message from',
  name: 'Ada <script>alert("x")</script>',
  details: [
    { label: 'Name', value: 'Ada <script>alert("x")</script>' },
    {
      label: 'Email',
      value: "ada&o'neil@example.com",
      href: "mailto:ada&o'neil@example.com",
    },
  ],
  language: 'en',
  messageLabel: 'Message',
  message: 'Hi <b>Marco</b> & team\nsecond line',
  replyTo: "ada&o'neil@example.com",
  footer: 'Sent from the contact form of',
};

describe('email layout', () => {
  const html = renderEmail(content);

  it('declares dark-only color scheme so clients do not invert it', () => {
    expect(html).toContain('<meta name="color-scheme" content="only dark">');
    expect(html).toContain(
      '<meta name="supported-color-schemes" content="dark">',
    );
    expect(html).toMatch(/:root\s*\{\s*color-scheme:\s*only dark;?\s*\}/);
  });

  it('gives every table cell an explicit bgcolor and background color', () => {
    const cells = html.match(/<td\b[^>]*>/g) ?? [];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell).toMatch(/bgcolor="#[0-9a-f]{6}"/);
      expect(cell).toMatch(/background-color:#[0-9a-f]{6}/);
    }
  });

  it('keeps every text and background pair at 4.5:1 or more', () => {
    expect(EMAIL_TEXT_PAIRS.length).toBeGreaterThan(0);
    for (const pair of EMAIL_TEXT_PAIRS) {
      expect(
        contrastRatio(pair.text, pair.background),
        pair.name,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('only uses colors from the palette', () => {
    const used = new Set(
      (html.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((c) => c.toLowerCase()),
    );
    const allowed = new Set<string>(Object.values(palette));
    for (const color of used) expect(allowed.has(color), color).toBe(true);
  });

  it('shows the logo, eyebrow, heading and italic name', () => {
    expect(html).toMatch(/MF<span[^>]*>\.<\/span>/);
    expect(html).toContain('Get In Touch');
    expect(html).toContain('New message from');
    expect(html).toMatch(
      /font-style:italic[^>]*>Ada &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;<\/span>/,
    );
  });

  it('shows the details on the card with a border, including the language', () => {
    expect(html).toContain(
      `bgcolor="${palette.card}" style="background-color:${palette.card};border:1px solid ${palette.border}`,
    );
    expect(html).toContain('>Name<');
    expect(html).toContain('>Email<');
    expect(html).toContain('>Language<');
    expect(html).toContain('>English<');
    expect(renderEmail({ ...content, language: 'es' })).toContain('>Spanish<');
  });

  it('renders the message with a primary left border and line breaks', () => {
    expect(html).toContain(`border-left:2px solid ${palette.primary}`);
    expect(html).toContain(
      'Hi &lt;b&gt;Marco&lt;/b&gt; &amp; team<br>second line',
    );
  });

  it('renders the reply button with the primary-foreground text color', () => {
    expect(html).toMatch(
      new RegExp(
        `<a href="mailto:ada&amp;o&#39;neil@example.com" style="[^"]*background-color:${palette.primary};color:${palette.primaryForeground};[^"]*">Reply to Ada &lt;script&gt;`,
      ),
    );
    expect(palette.primaryForeground).toBe('#0f1418');
  });

  it('links the footer to the site in the primary color', () => {
    expect(html).toMatch(
      new RegExp(
        `Sent from the contact form of <a href="https://marco.figueroa-sanchez.com" style="color:${palette.primary};[^"]*">marco.figueroa-sanchez.com</a>`,
      ),
    );
  });

  it('escapes every value and never contains raw markup from the input', () => {
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Marco</b>');
    expect(html).toContain('ada&amp;o&#39;neil@example.com');
  });

  it('uses no remote images or resources', () => {
    expect(html).not.toMatch(/<img\b/i);
    expect(html).not.toMatch(/url\(/i);
    expect(html).not.toMatch(/\ssrc=/i);
    expect(html).not.toMatch(/<link\b/i);
  });

  it('renders the plain-text version with the same content and language line', () => {
    expect(renderText(content)).toBe(
      [
        'New message from your portfolio',
        '',
        'Name: Ada <script>alert("x")</script>',
        "Email: ada&o'neil@example.com",
        'Language: English',
        '',
        'Hi <b>Marco</b> & team\nsecond line',
        '',
        '--',
        'Sent from the contact form of marco.figueroa-sanchez.com (https://marco.figueroa-sanchez.com)',
      ].join('\n'),
    );
    expect(renderText({ ...content, language: 'es' })).toContain(
      'Language: Spanish',
    );
  });
});
