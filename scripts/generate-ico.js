const fs = require('fs');
const path = require('path');

const png16 = fs.readFileSync(path.join(__dirname, '..', 'public', 'favicon-16.png'));
const png32 = fs.readFileSync(path.join(__dirname, '..', 'public', 'favicon-32.png'));

// ICO header: reserved(2) + type(2) + count(2) = 6 bytes
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type: ICO
icoHeader.writeUInt16LE(2, 4); // count: 2 images

// Directory entry: width, height, colors, reserved, planes, bpp, size, offset
function createDirEntry(pngBuf, w, h) {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(w, 0);     // width (0 = 256)
  entry.writeUInt8(h, 1);     // height (0 = 256)
  entry.writeUInt8(0, 2);     // color palette
  entry.writeUInt8(0, 3);     // reserved
  entry.writeUInt16LE(1, 4);  // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuf.length, 8); // size
  entry.writeUInt32LE(0, 12); // offset (placeholder)
  return entry;
}

const entry16 = createDirEntry(png16, 16, 16);
const entry32 = createDirEntry(png32, 32, 32);

// Calculate offsets
const headerSize = 6;
const dirSize = 16 * 2;
const offset16 = headerSize + dirSize;
const offset32 = offset16 + png16.length;

entry16.writeUInt32LE(offset16, 12);
entry32.writeUInt32LE(offset32, 12);

const icoBuffer = Buffer.concat([icoHeader, entry16, entry32, png16, png32]);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.ico'), icoBuffer);
console.log(`Generated favicon.ico (${icoBuffer.length} bytes)`);
