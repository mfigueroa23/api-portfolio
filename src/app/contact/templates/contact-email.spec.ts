import { palette } from '../../mail/templates/palette.js';
import {
  contactEmailHtml,
  contactEmailSubject,
  contactEmailText,
} from './contact-email.js';

const visitor = {
  name: 'Ada <script>alert("x")</script>',
  email: "ada&o'neil@example.com",
  message: 'Hi <b>Marco</b> & team\nsecond line',
};

describe('contact email template', () => {
  it('builds the subject from the visitor name', () => {
    expect(contactEmailSubject({ ...visitor, name: 'Ada' })).toBe(
      'New portfolio message from Ada',
    );
  });

  it('keeps the literal content in the text version with the language line and footer', () => {
    expect(contactEmailText(visitor)).toBe(
      `New message from your portfolio\n\nName: ${visitor.name}\nEmail: ${visitor.email}\nLanguage: English\n\n${visitor.message}\n\n--\nSent from the contact form of marco.figueroa-sanchez.com (https://marco.figueroa-sanchez.com)`,
    );
  });

  it('keeps the eyebrow, heading, labels and button text', () => {
    const html = contactEmailHtml({ ...visitor, name: 'Ada' });

    expect(html).toContain('Get In Touch');
    expect(html).toMatch(/New message from <span[^>]*>Ada<\/span>/);
    expect(html).toContain('>Name<');
    expect(html).toContain('>Email<');
    expect(html).toContain('>Message<');
    expect(html).toContain('>Reply to Ada</a>');
  });

  it('shows the language line and the contact form footer', () => {
    const html = contactEmailHtml(visitor);

    expect(html).toContain('>Language<');
    expect(html).toContain('>English<');
    expect(html).toContain(
      `Sent from the contact form of <a href="https://marco.figueroa-sanchez.com" style="color:${palette.primary};`,
    );
  });

  it('uses the shared dark layout', () => {
    expect(contactEmailHtml(visitor)).toContain(
      '<meta name="color-scheme" content="only dark">',
    );
  });

  it('escapes HTML in name, email and message', () => {
    const html = contactEmailHtml(visitor);

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Marco</b>');
    expect(html).toContain(
      'Ada &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    expect(html).toContain('ada&amp;o&#39;neil@example.com');
    expect(html).toContain(
      'Hi &lt;b&gt;Marco&lt;/b&gt; &amp; team<br>second line',
    );
  });
});
