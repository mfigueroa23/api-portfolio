// Smallest byte sequences each accepted format is recognised by, plus look-alikes.
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';

export const samples = {
  png: Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]),
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
  gif: Buffer.from('GIF89a\x01\x00\x01\x00', 'latin1'),
  gif87: Buffer.from('GIF87a\x01\x00\x01\x00', 'latin1'),
  webp: Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from('WEBPVP8 '),
  ]),
  pdf: Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n', 'latin1'),
  svg: Buffer.from(SVG),
  svgWithProlog: Buffer.from(
    `﻿<?xml version="1.0" encoding="UTF-8"?>\n<!-- made by hand -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n  ${SVG}`,
  ),
  svgWithScript: Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  ),
  text: Buffer.from('just some text\n'),
  html: Buffer.from('<!DOCTYPE html><html><body><svg></svg></body></html>'),
  zip: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]),
  svgNotUtf8: Buffer.concat([Buffer.from('<svg>'), Buffer.from([0xff, 0xfe])]),
  svgLookAlike: Buffer.from('<svgx></svgx>'),
};
