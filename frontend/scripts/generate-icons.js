const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const pngToIcoFn = typeof pngToIco === 'function' ? pngToIco : pngToIco.default;

const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const svgPath = path.join(publicDir, 'favicon.svg');

if (!fs.existsSync(svgPath)) {
    console.error('favicon.svg not found in public directory.');
    process.exit(1);
}

const pngTargets = [
    { size: 64, filename: 'favicon-64.png' },
    { size: 192, filename: 'logo192.png' },
    { size: 512, filename: 'logo512.png' }
];

async function generatePngs() {
    const svgBuffer = fs.readFileSync(svgPath);

    await Promise.all(
        pngTargets.map(async ({ size, filename }) => {
            const outputPath = path.join(publicDir, filename);
            await sharp(svgBuffer)
                .resize(size, size, { fit: 'contain' })
                .png()
                .toFile(outputPath);
            console.log(`Generated ${filename}`);
        })
    );
}

async function generateFaviconIco() {
    const tempPngDir = path.join(publicDir, '.temp-icons');
    if (!fs.existsSync(tempPngDir)) {
        fs.mkdirSync(tempPngDir);
    }

    const icoSizes = [16, 32, 48, 64];
    const svgBuffer = fs.readFileSync(svgPath);

    const tempPngPaths = [];

    for (const size of icoSizes) {
        const tempPath = path.join(tempPngDir, `icon-${size}.png`);
        await sharp(svgBuffer)
            .resize(size, size, { fit: 'contain' })
            .png()
            .toFile(tempPath);
        tempPngPaths.push(tempPath);
    }

    const icoBuffer = await pngToIcoFn(tempPngPaths);
    const faviconPath = path.join(publicDir, 'favicon.ico');
    fs.writeFileSync(faviconPath, icoBuffer);
    console.log('Generated favicon.ico');

    // Cleanup temp files
    for (const tempPath of tempPngPaths) {
        fs.unlinkSync(tempPath);
    }
    fs.rmdirSync(tempPngDir);
}

async function main() {
    try {
        await generatePngs();
        await generateFaviconIco();
        console.log('Icon generation complete.');
    } catch (error) {
        console.error('Error generating icons:', error);
        process.exit(1);
    }
}

main();
