export type FileMime =
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/webp'
  | 'image/svg+xml'
  | 'application/pdf';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

function startsWith(
  bytes: Buffer,
  signature: number[] | string,
  at = 0,
): boolean {
  const expected =
    typeof signature === 'string'
      ? Buffer.from(signature, 'latin1')
      : Buffer.from(signature);
  return (
    bytes.length >= at + expected.length &&
    bytes.subarray(at, at + expected.length).equals(expected)
  );
}

// Skips what may precede the root element of an XML document: whitespace, the
// XML declaration, comments, processing instructions and the doctype.
const XML_PREAMBLE =
  /^(?:\s+|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE(?:[^[>]|\[[\s\S]*?\])*>)*/i;

function isSvg(bytes: Buffer): boolean {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return false;
  }
  if (text.startsWith('﻿')) text = text.slice(1);
  const rest = text.slice(XML_PREAMBLE.exec(text)?.[0].length ?? 0);
  return /^<svg[\s>/]/.test(rest);
}

// Detects the type from the content only (magic bytes); the file name and the
// request Content-Type are never trusted. Anything else is refused.
export function sniff(bytes: Buffer): FileMime | null {
  if (startsWith(bytes, PNG)) return 'image/png';
  if (startsWith(bytes, JPEG)) return 'image/jpeg';
  if (startsWith(bytes, 'GIF87a') || startsWith(bytes, 'GIF89a')) {
    return 'image/gif';
  }
  if (startsWith(bytes, 'RIFF') && startsWith(bytes, 'WEBP', 8)) {
    return 'image/webp';
  }
  if (startsWith(bytes, '%PDF-')) return 'application/pdf';
  if (isSvg(bytes)) return 'image/svg+xml';
  return null;
}
