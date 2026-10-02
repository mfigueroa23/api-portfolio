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

  it('keeps the literal content in the text version', () => {
    expect(contactEmailText(visitor)).toBe(
      `New message from your portfolio\n\nName: ${visitor.name}\nEmail: ${visitor.email}\n\n${visitor.message}`,
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
