import { palette } from '../../../mail/templates/palette.js';
import {
  testimonialEmailHtml,
  testimonialEmailSubject,
  testimonialEmailText,
} from './testimonial-email.js';

const submission = {
  name: 'Ada',
  role: 'Engineer at Acme',
  email: 'ada@example.com',
  testimonial: 'A pleasure\nto work with.',
  language: 'en' as const,
};

describe('testimonial email template', () => {
  it('builds the subject from the visitor name', () => {
    expect(testimonialEmailSubject(submission)).toBe(
      'New testimonial from Ada',
    );
  });

  it('shows the eyebrow, heading, details, quote and reply button', () => {
    const html = testimonialEmailHtml(submission);

    expect(html).toContain('New Testimonial');
    expect(html).toMatch(/Testimonial from <span[^>]*>Ada<\/span>/);
    for (const label of ['Name', 'Role', 'Email', 'Language', 'Testimonial']) {
      expect(html).toContain(`>${label}<`);
    }
    expect(html).toContain('>Engineer at Acme<');
    expect(html).toContain('>English<');
    expect(html).toContain('href="mailto:ada@example.com"');
    expect(html).toContain(
      `border-left:2px solid ${palette.primary};font-size:15px;line-height:1.6;color:${palette.foreground};">A pleasure<br>to work with.</p>`,
    );
    expect(html).toContain('>Reply to Ada</a>');
  });

  it('uses the testimonial form footer and the shared dark layout', () => {
    const html = testimonialEmailHtml(submission);

    expect(html).toContain(
      `Sent from the testimonial form of <a href="https://marco.figueroa-sanchez.com" style="color:${palette.primary};`,
    );
    expect(html).toContain('<meta name="color-scheme" content="only dark">');
  });

  it('shows Spanish as the language of a Spanish submission', () => {
    const spanish = { ...submission, language: 'es' as const };

    expect(testimonialEmailHtml(spanish)).toContain('>Spanish<');
    expect(testimonialEmailText(spanish)).toContain('Language: Spanish');
  });

  it('has a plain-text version with the same content', () => {
    expect(testimonialEmailText(submission)).toBe(
      [
        'New testimonial from your portfolio',
        '',
        'Name: Ada',
        'Role: Engineer at Acme',
        'Email: ada@example.com',
        'Language: English',
        '',
        'A pleasure\nto work with.',
        '',
        '--',
        'Sent from the testimonial form of marco.figueroa-sanchez.com (https://marco.figueroa-sanchez.com)',
      ].join('\n'),
    );
  });

  it('escapes HTML in every submitted field', () => {
    const html = testimonialEmailHtml({
      name: '<b>Ada</b>',
      role: '<i>role</i>',
      email: "a&o'n@example.com",
      testimonial: '<script>alert(1)</script>',
      language: 'en',
    });

    expect(html).not.toMatch(/<b>Ada|<i>role|<script>/);
    expect(html).toContain('&lt;b&gt;Ada&lt;/b&gt;');
    expect(html).toContain('&lt;i&gt;role&lt;/i&gt;');
    expect(html).toContain('a&amp;o&#39;n@example.com');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
