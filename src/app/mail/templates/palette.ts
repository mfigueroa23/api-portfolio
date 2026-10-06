// The web's dark tokens (web/src/styles.css). `surface` is listed for
// completeness but not used: muted text on it is only 4.2:1 (plan D4).
export const palette = {
  background: '#0f1418',
  card: '#141a1f',
  surface: '#1a2329',
  border: '#242b32',
  primary: '#20b2a6',
  // Spec 003 RF-139: text on primary buttons.
  primaryForeground: '#0f1418',
  foreground: '#f0f2f5',
  muted: '#7a8491',
} as const;

export interface TextPair {
  name: string;
  text: string;
  background: string;
}

// Every text color the layout draws on each background; the layout spec
// asserts each pair reaches 4.5:1 (RF-105).
export const EMAIL_TEXT_PAIRS: readonly TextPair[] = [
  { name: 'logo', text: palette.foreground, background: palette.background },
  { name: 'logo dot', text: palette.primary, background: palette.background },
  { name: 'footer', text: palette.muted, background: palette.background },
  {
    name: 'footer link',
    text: palette.primary,
    background: palette.background,
  },
  { name: 'eyebrow', text: palette.primary, background: palette.card },
  { name: 'heading', text: palette.foreground, background: palette.card },
  { name: 'labels', text: palette.muted, background: palette.card },
  { name: 'values', text: palette.foreground, background: palette.card },
  { name: 'links', text: palette.primary, background: palette.card },
  {
    name: 'button',
    text: palette.primaryForeground,
    background: palette.primary,
  },
];
