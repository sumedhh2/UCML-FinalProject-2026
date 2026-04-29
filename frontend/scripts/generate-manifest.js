import fs from 'fs';
import path from 'path';

const imagesDir = '../pinterest_images';
const aesthetics = fs.readdirSync(imagesDir).filter(f => fs.statSync(path.join(imagesDir, f)).isDirectory());

const manifest = [];

aesthetics.forEach(aesthetic => {
    const aestheticDir = path.join(imagesDir, aesthetic);
    const files = fs.readdirSync(aestheticDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
    
    files.forEach(file => {
        manifest.push({
            id: `${aesthetic}_${file}`,
            url: `/images/${aesthetic}/${file}`,
            aesthetic: aesthetic
        });
    });
});

// Shuffle manifest
for (let i = manifest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [manifest[i], manifest[j]] = [manifest[j], manifest[i]];
}

const outputPath = './src/data/images.js';
if (!fs.existsSync('./src/data')) fs.mkdirSync('./src/data');

fs.writeFileSync(outputPath, `export const IMAGES = ${JSON.stringify(manifest.slice(0, 50), null, 2)};`);
console.log(`Generated manifest with ${manifest.length} images. Saved 50 to ${outputPath}`);
