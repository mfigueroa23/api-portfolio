const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// WCAG 2 relative luminance of an sRGB hex color.
const luminance = (hex: string): number => {
  if (!HEX.test(hex)) throw new Error(`Not a hex color: ${hex}`);
  let digits = hex.slice(1);
  if (digits.length === 3) digits = digits.replace(/./g, '$&$&');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(digits.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// WCAG contrast ratio, from 1 (equal colors) to 21 (black on white).
export const contrastRatio = (text: string, background: string): number => {
  const [light, dark] = [luminance(text), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (light + 0.05) / (dark + 0.05);
};
