import { ContactMessage } from '../interfaces/contact-message.interface.js';

// Same palette as src/styles.css
const colors = {
  background: '#0f1418',
  card: '#141a1f',
  surface: '#1a2329',
  border: '#242b32',
  primary: '#20b2a6',
  foreground: '#f0f2f5',
  muted: '#7a8491',
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const contactEmailSubject = ({ name }: ContactMessage): string =>
  `New portfolio message from ${name}`;

export const contactEmailText = ({
  name,
  email,
  message,
}: ContactMessage): string =>
  `New message from your portfolio\n\nName: ${name}\nEmail: ${email}\n\n${message}`;

export const contactEmailHtml = (contact: ContactMessage): string => {
  const name = escapeHtml(contact.name);
  const email = escapeHtml(contact.email);
  const message = escapeHtml(contact.message).replace(/\r?\n/g, '<br>');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>New portfolio message</title>
</head>
<body style="margin:0;padding:0;background-color:${colors.background};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:${colors.foreground};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${colors.background};padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <!-- Logo -->
          <tr>
            <td style="padding:0 0 24px;font-size:22px;font-weight:700;letter-spacing:-0.5px;color:${colors.foreground};">
              MF<span style="color:${colors.primary};">.</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:${colors.card};border:1px solid ${colors.border};border-radius:16px;padding:32px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${colors.primary};">Get In Touch</p>
              <h1 style="margin:0 0 24px;font-size:24px;line-height:1.3;font-weight:700;color:${colors.foreground};">
                New message from <span style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:400;">${name}</span>
              </h1>

              <!-- Sender -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${colors.surface};border-radius:12px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:${colors.muted};">Name</p>
                    <p style="margin:0 0 16px;font-size:15px;font-weight:500;color:${colors.foreground};">${name}</p>
                    <p style="margin:0 0 4px;font-size:12px;color:${colors.muted};">Email</p>
                    <a href="mailto:${email}" style="font-size:15px;font-weight:500;color:${colors.primary};text-decoration:none;">${email}</a>
                  </td>
                </tr>
              </table>

              <!-- Message -->
              <p style="margin:0 0 8px;font-size:12px;color:${colors.muted};">Message</p>
              <p style="margin:0 0 32px;padding:0 0 0 16px;border-left:2px solid ${colors.primary};font-size:15px;line-height:1.6;color:${colors.foreground};">${message}</p>

              <!-- Reply Button -->
              <a href="mailto:${email}" style="display:inline-block;padding:12px 24px;border-radius:999px;background-color:${colors.primary};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Reply to ${name}</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;font-size:12px;color:${colors.muted};text-align:center;">
              Sent from the contact form of figueroa-sanchez.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
