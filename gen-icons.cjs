const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function createPNG(width, height, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const offset = y * rowSize;
    rawData[offset] = 0;
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 3;
      const rr = Math.min(255, r + Math.floor((x / width) * 50));
      const gg = Math.min(255, g + Math.floor((y / height) * 50));
      rawData[px] = rr;
      rawData[px + 1] = gg;
      rawData[px + 2] = b;
    }
  }
  const compressed = zlib.deflateSync(rawData);
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcData = Buffer.concat([typeBuf, data]);
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < crcData.length; i++) {
      crc ^= crcData[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
      }
    }
    crc = (crc ^ 0xFFFFFFFF) >>> 0;
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

const iconDir = path.join('src-tauri', 'icons');
fs.mkdirSync(iconDir, { recursive: true });

const sizes = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
];

for (const s of sizes) {
  const png = createPNG(s.size, s.size, 59, 130, 246);
  fs.writeFileSync(path.join(iconDir, s.name), png);
  console.log('Created:', s.name);
}

const png32 = fs.readFileSync(path.join(iconDir, '32x32.png'));
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);
const icoDir = Buffer.alloc(16);
icoDir[0] = 32;
icoDir[1] = 32;
icoDir.writeUInt16LE(1, 4);
icoDir.writeUInt16LE(32, 6);
icoDir.writeUInt32LE(png32.length, 8);
icoDir.writeUInt32LE(22, 12);
fs.writeFileSync(path.join(iconDir, 'icon.ico'), Buffer.concat([icoHeader, icoDir, png32]));
console.log('Created: icon.ico');

const png512 = fs.readFileSync(path.join(iconDir, 'icon.png'));
const icnsHeader = Buffer.from('icns', 'ascii');
const iconType = Buffer.from('ic09', 'ascii');
const iconDataLen = Buffer.alloc(4);
iconDataLen.writeUInt32BE(png512.length + 8, 0);
const totalLen = Buffer.alloc(4);
totalLen.writeUInt32BE(8 + 8 + png512.length, 0);
fs.writeFileSync(path.join(iconDir, 'icon.icns'), Buffer.concat([icnsHeader, totalLen, iconType, iconDataLen, png512]));
console.log('Created: icon.icns');
console.log('All icons generated!');
