import { contrastRatio } from './contrast.js';

describe('contrastRatio', () => {
  it('is 21 for black on white in either order', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });

  it('is 1 for equal colors', () => {
    expect(contrastRatio('#20b2a6', '#20b2a6')).toBe(1);
  });

  it('matches a known WCAG pair', () => {
    // #777777 on white is the classic 4.48:1 borderline case.
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('rejects values that are not hex colors', () => {
    expect(() => contrastRatio('red', '#000')).toThrow();
  });
});
