import { inflateRawSync } from 'node:zlib';
import { KernelError } from '../kernel/identity.ts';

/**
 * A minimal ZIP reader, enough to open an .xlsx.
 *
 * Written rather than pulled in because this project's audit surface is part of
 * the product. Someone checking whether a published figure matches the source
 * document should be able to read every line between the two, and that argument
 * is weaker with a transitive dependency tree in the middle of it. Node's zlib
 * does the actual decompression.
 *
 * ZIP64 is not supported. CEA workbooks are tens of kilobytes; if one ever
 * arrives large enough to need it, that is a change worth noticing rather than
 * absorbing, so it raises.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

export type ZipEntry = { readonly name: string; readonly data: Buffer };

export function readZip(buffer: Buffer): Map<string, Buffer> {
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  const entries = new Map<string, Buffer>();
  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new KernelError(`Corrupt archive: bad central directory signature at entry ${i}.`);
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new KernelError(`${name}: ZIP64 archive. Not supported — the source format changed.`);
    }

    entries.set(name, readLocalEntry(buffer, localOffset, method, compressedSize, name));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readLocalEntry(
  buffer: Buffer,
  offset: number,
  method: number,
  compressedSize: number,
  name: string,
): Buffer {
  if (buffer.readUInt32LE(offset) !== LOCAL_SIGNATURE) {
    throw new KernelError(`Corrupt archive: bad local header for ${name}.`);
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(start, start + compressedSize);

  if (method === 0) return Buffer.from(raw);
  if (method === 8) return inflateRawSync(raw);
  throw new KernelError(`${name}: unsupported compression method ${method}.`);
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  // The EOCD sits at the end, after a comment of at most 65535 bytes.
  const earliest = Math.max(0, buffer.length - 65_557);
  for (let i = buffer.length - 22; i >= earliest; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new KernelError('Not a ZIP archive: no end-of-central-directory record found.');
}
