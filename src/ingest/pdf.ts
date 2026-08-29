import { inflateSync } from 'node:zlib';
import { KernelError } from '../kernel/identity.ts';

/**
 * Positioned text extraction from a PDF.
 *
 * Enough to read a table out of a government report, and no more. There is no
 * font handling, no encoding translation beyond PDFDocEncoding's ASCII range,
 * and no attempt at layout analysis — the CEA reports are generated from
 * spreadsheets and use plain literal strings, which is the easy case.
 *
 * Text is grouped by content stream and by vertical position, which is enough
 * to reconstruct rows. Streams are kept separate because a report's pages
 * frequently place different rows at identical y coordinates, and merging them
 * interleaves unrelated tables into rows that look plausible and are not.
 */

export type TextRun = { readonly x: number; readonly text: string };
export type TextRow = { readonly stream: number; readonly y: number; readonly cells: readonly string[] };

const STREAM = /stream\r?\n?/g;

/**
 * PDF content streams are scanned, not matched with a regular expression.
 *
 * A literal string may contain unescaped balanced parentheses, and a CID string
 * contains arbitrary bytes — parentheses and brackets among them. Any regex that
 * treats `(` and `)` as delimiters therefore ends a string early on some inputs
 * and swallows the rest of the stream on others, which is how an earlier version
 * of this reader turned a table into three rows of noise. Balanced scanning with
 * escape awareness is the only correct way to read them.
 */
type PdfString = {
  readonly bytes: string;
  /** Literal strings carry backslash escapes; hex strings are already bytes. */
  readonly escaped: boolean;
};

type Operand =
  | { readonly kind: 'string'; readonly value: PdfString }
  | { readonly kind: 'array'; readonly strings: readonly PdfString[] }
  | { readonly kind: 'number'; readonly value: number };

type Token = { readonly operand: Operand } | { readonly operator: string };

const isWhitespace = (c: string): boolean => c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === '\f' || c === '\0';
const isDelimiter = (c: string): boolean => '()<>[]{}/%'.includes(c);

/**
 * Reads a hex string starting at `<`, returning its bytes and the index after `>`.
 *
 * The CID-encoded reports write every glyph this way — `<004C>` rather than a
 * literal string — which is why a reader that only handles `(...)` finds no text
 * in them at all and reports an empty page rather than an error.
 */
function scanHexString(content: string, start: number): { bytes: string; next: number } {
  let i = start + 1;
  let hex = '';
  while (i < content.length && content[i] !== '>') {
    const c = content[i] as string;
    if (/[0-9A-Fa-f]/.test(c)) hex += c;
    i++;
  }
  if (hex.length % 2 === 1) hex += '0'; // an odd final digit is padded, per spec
  let bytes = '';
  for (let j = 0; j + 2 <= hex.length; j += 2) bytes += String.fromCharCode(parseInt(hex.slice(j, j + 2), 16));
  return { bytes, next: i + 1 };
}

/** Reads a literal string starting at `(`, returning its raw body and the index after `)`. */
function scanString(content: string, start: number): { body: string; next: number } {
  let i = start + 1;
  let depth = 1;
  let body = '';
  while (i < content.length) {
    const c = content[i] as string;
    if (c === '\\') {
      // Escapes are preserved verbatim and resolved once the encoding is known.
      body += c + (content[i + 1] ?? '');
      i += 2;
      continue;
    }
    if (c === '(') depth++;
    if (c === ')') {
      depth--;
      if (depth === 0) return { body, next: i + 1 };
    }
    body += c;
    i++;
  }
  return { body, next: i };
}

function* scanTokens(content: string): Generator<Token> {
  let i = 0;
  while (i < content.length) {
    const c = content[i] as string;
    if (isWhitespace(c)) {
      i++;
      continue;
    }
    if (c === '(') {
      const { body, next } = scanString(content, i);
      i = next;
      yield { operand: { kind: 'string', value: { bytes: body, escaped: true } } };
      continue;
    }
    if (c === '<' && content[i + 1] !== '<') {
      const { bytes, next } = scanHexString(content, i);
      i = next;
      yield { operand: { kind: 'string', value: { bytes, escaped: false } } };
      continue;
    }
    if (c === '[') {
      const strings: PdfString[] = [];
      i++;
      while (i < content.length && content[i] !== ']') {
        if (content[i] === '(') {
          const { body, next } = scanString(content, i);
          strings.push({ bytes: body, escaped: true });
          i = next;
          continue;
        }
        if (content[i] === '<') {
          const { bytes, next } = scanHexString(content, i);
          strings.push({ bytes, escaped: false });
          i = next;
          continue;
        }
        i++;
      }
      i++; // past ']'
      yield { operand: { kind: 'array', strings } };
      continue;
    }
    if (c === '%') {
      while (i < content.length && content[i] !== '\n') i++;
      continue;
    }
    if (/[-+.\d]/.test(c)) {
      let j = i;
      while (j < content.length && /[-+.\d]/.test(content[j] as string)) j++;
      const value = Number(content.slice(i, j));
      i = j;
      yield { operand: { kind: 'number', value: Number.isFinite(value) ? value : 0 } };
      continue;
    }
    if (isDelimiter(c)) {
      i++;
      continue;
    }
    let j = i;
    while (j < content.length && !isWhitespace(content[j] as string) && !isDelimiter(content[j] as string)) j++;
    yield { operator: content.slice(i, j) };
    i = j;
  }
}

const ESCAPES: Readonly<Record<string, string>> = {
  n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\',
};

/** PDF literal string: backslash escapes plus up to three octal digits. */
function unescapePdfString(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== '\\') {
      out += raw[i];
      continue;
    }
    const next = raw[++i];
    if (next === undefined) break;
    if (next in ESCAPES) {
      out += ESCAPES[next];
      continue;
    }
    const octal = /^[0-7]{1,3}/.exec(raw.slice(i));
    if (octal) {
      out += String.fromCharCode(parseInt(octal[0], 8) & 0xff);
      i += octal[0].length - 1;
      continue;
    }
    // A backslash before anything else is a line continuation; drop both.
  }
  return out;
}

/** Every FlateDecode stream that inflates. Others are fonts, images, metadata. */
function inflatedStreams(pdf: Buffer): Buffer[] {
  const out: Buffer[] = [];
  const text = pdf.toString('latin1');
  STREAM.lastIndex = 0;
  for (let m = STREAM.exec(text); m !== null; m = STREAM.exec(text)) {
    const start = m.index + m[0].length;
    const end = text.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      out.push(inflateSync(pdf.subarray(start, end)));
    } catch {
      // Not a deflate stream, or not one we can read. Skip: a report with no
      // readable stream at all is caught by the empty check in the caller.
    }
  }
  return out;
}

/**
 * Text runs grouped into rows, ordered top-to-bottom then left-to-right.
 *
 * PDF's origin is bottom-left, so rows sort by descending y.
 */
export type DecodeMode =
  /** Strings are characters. Reports from late 2025 onward. */
  | 'literal'
  /** Strings are two-byte glyph ids resolved through ToUnicode. Older reports. */
  | 'cid';

/**
 * Which decoding a document needs cannot be settled by looking for a CMap.
 *
 * Every report examined embeds at least one CID font, but the newer ones use it
 * only for incidental text and set the table in a literal font, so the presence
 * of a ToUnicode map says nothing about how the numbers are encoded. The caller
 * therefore tries both and keeps whichever produces a report that passes the
 * structural checks — a choice that is verified rather than sniffed.
 */
export function extractTextRows(pdf: Buffer, mode: DecodeMode = 'literal'): TextRow[] {
  if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new KernelError('Not a PDF: missing %PDF- header.');
  }
  const streams = inflatedStreams(pdf);
  if (streams.length === 0) {
    throw new KernelError('PDF contains no readable content streams.');
  }

  const cmap = mode === 'cid' ? buildToUnicodeMap(pdf) : new Map<number, string>();
  const decode = (s: PdfString): string => {
    const bytes = s.escaped ? unescapeBytes(s.bytes) : s.bytes;
    return mode === 'cid' ? decodeWithCMap(bytes, cmap) : bytes;
  };

  const rows: TextRow[] = [];

  streams.forEach((stream, index) => {
    const byLine = new Map<number, TextRun[]>();
    let x = 0;
    let y = 0;
    let leading = 12;
    let operands: Operand[] = [];

    const numberAt = (offset: number): number => {
      const operand = operands[operands.length - offset];
      return operand?.kind === 'number' ? operand.value : 0;
    };

    for (const token of scanTokens(stream.toString('latin1'))) {
      if ('operand' in token) {
        operands.push(token.operand);
        continue;
      }
      switch (token.operator) {
        case 'Tm':
          x = numberAt(2);
          y = numberAt(1);
          break;
        case 'Td':
        case 'TD':
          x += numberAt(2);
          y += numberAt(1);
          break;
        case 'TL':
          leading = numberAt(1);
          break;
        case 'T*':
          y -= leading;
          break;
        case 'TJ': {
          const last = operands[operands.length - 1];
          if (last?.kind === 'array') {
            const text = last.strings.map((raw) => decode(raw)).join('');
            if (text.trim()) push(byLine, y, { x, text });
          }
          break;
        }
        case 'Tj':
        case "'":
        case '"': {
          const last = operands[operands.length - 1];
          if (last?.kind === 'string') {
            const text = decode(last.value);
            if (text.trim()) push(byLine, y, { x, text });
          }
          break;
        }
        default:
          break;
      }
      operands = [];
    }

    for (const [line, runs] of byLine) {
      rows.push({
        stream: index,
        y: line,
        cells: [...runs].sort((a, b) => a.x - b.x).map((r) => r.text.trim()),
      });
    }
  });

  return rows.sort((a, b) => a.stream - b.stream || b.y - a.y);
}

/**
 * Escape processing happens before glyph decoding, never instead of it.
 *
 * A CID string still uses PDF's backslash escapes for bytes that collide with
 * delimiters, so `\(` inside a two-byte glyph id must become `(` before the
 * pair is read, or the byte stream shifts by one and every glyph after it is
 * wrong.
 */
function unescapeIfLiteral(raw: string, isCid: boolean): string {
  return isCid ? unescapeBytes(raw) : raw;
}

/** Backslash escapes only, leaving all other bytes untouched. */
function unescapeBytes(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== '\\') {
      out += raw[i];
      continue;
    }
    const next = raw[++i];
    if (next === undefined) break;
    if (next in ESCAPES) {
      out += ESCAPES[next];
      continue;
    }
    const octal = /^[0-7]{1,3}/.exec(raw.slice(i));
    if (octal) {
      out += String.fromCharCode(parseInt(octal[0], 8) & 0xff);
      i += octal[0].length - 1;
      continue;
    }
    out += next;
  }
  return out;
}

function push(byLine: Map<number, TextRun[]>, y: number, run: TextRun): void {
  const key = Math.round(y);
  const existing = byLine.get(key);
  if (existing) existing.push(run);
  else byLine.set(key, [run]);
}

/**
 * The document's ToUnicode maps, merged.
 *
 * Reports up to mid-2025 embed subset fonts and show text as two-byte glyph
 * ids, so the bytes in a string are not characters and reading them as such
 * produces the mojibake that made these files look unparseable. Each font
 * carries a ToUnicode CMap giving glyph id to character; merged, they decode
 * the document.
 *
 * Merging is safe here only because it is checked: a glyph id that maps to two
 * different characters in two fonts raises rather than silently picking one.
 * Reports from late 2025 onward carry no CMap at all and their strings are
 * literal, which is why this returns an empty map rather than failing — an
 * empty map means "these are already characters".
 */
export function buildToUnicodeMap(pdf: Buffer): Map<number, string> {
  const sources = [pdf.toString('latin1'), ...inflatedStreams(pdf).map((s) => s.toString('latin1'))];
  const map = new Map<number, string>();

  const put = (code: number, value: string): void => {
    const existing = map.get(code);
    if (existing !== undefined && existing !== value) {
      throw new KernelError(
        `PDF: glyph ${code} maps to both ${JSON.stringify(existing)} and ${JSON.stringify(value)}. ` +
          'Refusing to guess which font applies — the text would be silently wrong.',
      );
    }
    map.set(code, value);
  };

  const hexToString = (hex: string): string => {
    let out = '';
    for (let i = 0; i + 4 <= hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
    return out;
  };

  for (const source of sources) {
    for (const block of source.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const pair of (block[1] ?? '').matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) {
        put(parseInt(pair[1] as string, 16), hexToString(pair[2] ?? ''));
      }
    }
    for (const block of source.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      const body = block[1] ?? '';
      for (const r of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
        const from = parseInt(r[1] as string, 16);
        const to = parseInt(r[2] as string, 16);
        const base = parseInt((r[3] as string).slice(-4), 16);
        for (let c = from; c <= to && c - from < 65_536; c++) put(c, String.fromCharCode(base + (c - from)));
      }
      for (const r of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g)) {
        const from = parseInt(r[1] as string, 16);
        const items = [...(r[3] ?? '').matchAll(/<([0-9A-Fa-f]*)>/g)];
        items.forEach((item, i) => put(from + i, hexToString(item[1] ?? '')));
      }
    }
  }
  return map;
}

/** Two-byte glyph ids through the document's map. */
function decodeWithCMap(raw: string, cmap: ReadonlyMap<number, string>): string {
  let out = '';
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const code = (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1);
    out += cmap.get(code) ?? '';
  }
  return out;
}

/** All text in the document, for locating notes and headings. */
export const allText = (rows: readonly TextRow[]): string =>
  rows.map((r) => r.cells.join(' ')).join('\n');
