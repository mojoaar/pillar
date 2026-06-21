const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const svgPath = path.join(rootDir, 'public', 'favicon.svg');
const publicDir = path.join(rootDir, 'public');

const sizes = [
  { name: 'apple-touch-icon.png', size: 180, bg: '#282a36' },
  { name: 'icon-192.png', size: 192, bg: '#282a36' },
  { name: 'icon-512.png', size: 512, bg: '#282a36' },
  { name: 'favicon-32.png', size: 32, bg: null },
  { name: 'favicon-16.png', size: 16, bg: null },
];

async function generate() {
  const svgBuffer = fs.readFileSync(svgPath);

  for (const { name, size, bg } of sizes) {
    let pipeline = sharp(svgBuffer).resize(size, size);
    
    if (bg) {
      // Add solid background for Apple/Android icons (prevents iOS gloss overlay issues)
      pipeline = pipeline.flatten({ background: bg });
    }
    
    await pipeline.png().toFile(path.join(publicDir, name));
    console.log(`Generated ${name} (${size}x${size})`);
  }
}

generate().catch(console.error);
