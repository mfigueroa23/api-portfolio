import { palette } from './palette.js';

const SITE_URL = 'https://marco.figueroa-sanchez.com';
const SITE_NAME = 'marco.figueroa-sanchez.com';

export type EmailLanguage = 'en' | 'es';

const LANGUAGE_NAMES: Record<EmailLanguage, string> = {
  en: 'English',
  es: 'Spanish',
};

export interface EmailDetail {
  label: string;
  value: string;
  // Already a full URL (e.g. `mailto:`); escaped like every other value.
  href?: string;
}

export interface EmailContent {
  // Document title and first line of the plain-text version.
  title: string;
  eyebrow: string;
  // Text before the visitor's name, which is shown in italics.
  heading: string;
  name: string;
  details: EmailDetail[];
  // The visitor's language, shown as the last details line (RF-102).
  language: EmailLanguage;
  messageLabel: string;
  message: string;
  // Address the reply button writes to.
  replyTo: string;
  // Footer sentence; the linked site name is appended to it.
  footer: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Every cell carries both `bgcolor` and an inline background so clients that
// drop one of them still paint the dark palette instead of inverting it.
const cell = (background: string, style: string, content: string): string =>
  `<td bgcolor="${background}" style="background-color:${background};${style}">${content}</td>`;

const detailRow = ({ label, value, href }: EmailDetail): string => {
  const text = escapeHtml(value);
  const shown = href
    ? `<a href="${escapeHtml(href)}" style="color:${palette.primary};text-decoration:none;">${text}</a>`
    : text;
  return `<p style="margin:0 0 4px;font-size:12px;color:${palette.muted};">${escapeHtml(label)}</p>
                    <p style="margin:0 0 16px;font-size:15px;font-weight:500;color:${palette.foreground};">${shown}</p>`;
};

const allDetails = (content: EmailContent): EmailDetail[] => [
  ...content.details,
  { label: 'Language', value: LANGUAGE_NAMES[content.language] },
];

// One layout for every email to the owner (RF-101). `color-scheme: only dark`
// tells Apple Mail the colors are already meant for dark mode, so it does not
// re-color them in either appearance (RF-103, RF-104).
export const renderEmail = (content: EmailContent): string => {
  const name = escapeHtml(content.name);
  const replyTo = escapeHtml(content.replyTo);
  const message = escapeHtml(content.message).replace(/\r?\n/g, '<br>');
  const details = allDetails(content)
    .map(detailRow)
    .join('\n                    ');
  const table = (inner: string, style = ''): string =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${style}">${inner}</table>`;

  const logo = cell(
    palette.background,
    `padding:0 0 24px;font-size:22px;font-weight:700;letter-spacing:-0.5px;color:${palette.foreground};`,
    `MF<span style="color:${palette.primary};">.</span>`,
  );

  // Details sit on `card` with a `border` outline: muted text on `surface`
  // would fall below 4.5:1 (plan D4).
  const detailsPanel = table(
    `<tr>${cell(palette.card, `border:1px solid ${palette.border};border-radius:12px;padding:16px 20px 0;`, details)}</tr>`,
    'margin:0 0 24px;',
  );

  const card = cell(
    palette.card,
    `border:1px solid ${palette.border};border-radius:16px;padding:32px;`,
    `
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${palette.primary};">${escapeHtml(content.eyebrow)}</p>
              <h1 style="margin:0 0 24px;font-size:24px;line-height:1.3;font-weight:700;color:${palette.foreground};">${escapeHtml(content.heading)} <span style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:400;">${name}</span></h1>
              ${detailsPanel}
              <p style="margin:0 0 8px;font-size:12px;color:${palette.muted};">${escapeHtml(content.messageLabel)}</p>
              <p style="margin:0 0 32px;padding:0 0 0 16px;border-left:2px solid ${palette.primary};font-size:15px;line-height:1.6;color:${palette.foreground};">${message}</p>
              <a href="mailto:${replyTo}" style="display:inline-block;padding:12px 24px;border-radius:999px;background-color:${palette.primary};color:${palette.primaryForeground};font-size:14px;font-weight:600;text-decoration:none;">Reply to ${name}</a>
            `,
  );

  const footer = cell(
    palette.background,
    `padding:24px 0 0;font-size:12px;color:${palette.muted};text-align:center;`,
    `${escapeHtml(content.footer)} <a href="${SITE_URL}" style="color:${palette.primary};text-decoration:none;">${SITE_NAME}</a>`,
  );

  const column = table(
    `<tr>${logo}</tr><tr>${card}</tr><tr>${footer}</tr>`,
    'max-width:560px;margin:0 auto;',
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="only dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(content.title)}</title>
  <style>:root { color-scheme: only dark; }</style>
</head>
<body bgcolor="${palette.background}" style="margin:0;padding:0;background-color:${palette.background};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:${palette.foreground};">
  ${table(`<tr>${cell(palette.background, 'padding:40px 16px;', column)}</tr>`)}
</body>
</html>`;
};

// Plain-text part with the same content as the HTML (RF-43, RF-116).
export const renderText = (content: EmailContent): string =>
  [
    content.title,
    '',
    ...allDetails(content).map(({ label, value }) => `${label}: ${value}`),
    '',
    content.message,
    '',
    '--',
    `${content.footer} ${SITE_NAME} (${SITE_URL})`,
  ].join('\n');
