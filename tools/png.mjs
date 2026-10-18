// Minimal PNG encoder (RGBA, no dependencies) for build tools.
import { deflateSync } from 'node:zlib';

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Encode an RGBA buffer (width*height*4 bytes) as a PNG file buffer. */
export function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A simple RGBA raster with helpers for blitting scaled pixel art. */
export class Raster {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }
  fill(x0, y0, w, h, hex) {
    const n = parseInt(hex.slice(1), 16);
    for (let y = Math.max(0, y0); y < Math.min(this.h, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(this.w, x0 + w); x++) {
        const i = (y * this.w + x) * 4;
        this.data[i] = (n >> 16) & 255;
        this.data[i + 1] = (n >> 8) & 255;
        this.data[i + 2] = n & 255;
        this.data[i + 3] = 255;
      }
    }
  }
  /** Draw a pixel list (array of hex or null, size*size) scaled by `s`. */
  blit(pixels, size, x0, y0, s) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const p = pixels[y * size + x];
        if (p) this.fill(x0 + x * s, y0 + y * s, s, s, p);
      }
    }
  }
  png() {
    return encodePNG(this.w, this.h, this.data);
  }
}
