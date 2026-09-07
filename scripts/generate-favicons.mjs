import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

function createIco(pngEntries) {
  const count = pngEntries.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // 1 = ICO format
  header.writeUInt16LE(count, 4); // Number of images

  const entries = [];
  for (const item of pngEntries) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(item.width >= 256 ? 0 : item.width, 0);
    entry.writeUInt8(item.height >= 256 ? 0 : item.height, 1);
    entry.writeUInt8(0, 2); // 0 = no color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(item.buffer.length, 8); // Size of image data
    entry.writeUInt32LE(offset, 12); // Offset of image data
    entries.push(entry);
    offset += item.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...pngEntries.map(p => p.buffer)]);
}

async function generate() {
  const root = process.cwd();
  const publicDir = path.join(root, 'public');
  const appDir = path.join(root, 'app');

  // Vector SVG with official Skillshot squircle brand mark and bold white "S"
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="skillshotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1c18"/>
      <stop offset="100%" stop-color="#32302a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#skillshotGrad)"/>
  <text x="252" y="380" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="360" letter-spacing="-0.02em">S</text>
</svg>`;

  const svgBuffer = Buffer.from(svgContent);

  // Write SVGs
  await fs.writeFile(path.join(publicDir, 'favicon.svg'), svgBuffer);
  await fs.writeFile(path.join(appDir, 'icon.svg'), svgBuffer);

  // Render high quality PNGs
  const p16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
  const p32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  const p48 = await sharp(svgBuffer).resize(48, 48).png().toBuffer();
  const p180 = await sharp(svgBuffer).resize(180, 180).png().toBuffer();
  const p192 = await sharp(svgBuffer).resize(192, 192).png().toBuffer();
  const p512 = await sharp(svgBuffer).resize(512, 512).png().toBuffer();

  // Multi-size ICO (16, 32, 48)
  const icoBuffer = createIco([
    { width: 16, height: 16, buffer: p16 },
    { width: 32, height: 32, buffer: p32 },
    { width: 48, height: 48, buffer: p48 },
  ]);

  // Save to public/
  await fs.writeFile(path.join(publicDir, 'favicon.ico'), icoBuffer);
  await fs.writeFile(path.join(publicDir, 'favicon-16x16.png'), p16);
  await fs.writeFile(path.join(publicDir, 'favicon-32x32.png'), p32);
  await fs.writeFile(path.join(publicDir, 'apple-touch-icon.png'), p180);
  await fs.writeFile(path.join(publicDir, 'icon-192.png'), p192);
  await fs.writeFile(path.join(publicDir, 'icon-512.png'), p512);

  // Save to app/ (Next.js App Router conventions)
  await fs.writeFile(path.join(appDir, 'favicon.ico'), icoBuffer);
  await fs.writeFile(path.join(appDir, 'icon.png'), p32);
  await fs.writeFile(path.join(appDir, 'apple-icon.png'), p180);

  console.log('Successfully generated all Skillshot favicon assets:');
  console.log(' - public/favicon.svg');
  console.log(' - public/favicon.ico (16x16, 32x32, 48x48)');
  console.log(' - public/favicon-16x16.png');
  console.log(' - public/favicon-32x32.png');
  console.log(' - public/apple-touch-icon.png (180x180)');
  console.log(' - public/icon-192.png');
  console.log(' - public/icon-512.png');
  console.log(' - app/favicon.ico');
  console.log(' - app/icon.png');
  console.log(' - app/apple-icon.png');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
