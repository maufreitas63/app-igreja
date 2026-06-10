import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sourcePath = path.join(rootDir, 'logos', '4.jpeg');
const outputDir = path.join(rootDir, 'assets', 'images');

const ICON_SIZE = 1024;
const ICON_PADDING_RATIO = 0.1;
const BRAND_BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 };

const buildSquareIcon = async (size, paddingRatio = ICON_PADDING_RATIO) => {
  const innerSize = Math.round(size * (1 - paddingRatio * 2));
  const logo = await sharp(sourcePath)
    .resize(innerSize, innerSize, {
      fit: 'contain',
      background: BRAND_BACKGROUND,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_BACKGROUND,
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
};

await mkdir(outputDir, { recursive: true });

const iconBuffer = await buildSquareIcon(ICON_SIZE);

await sharp(iconBuffer).toFile(path.join(outputDir, 'icon.png'));
await sharp(iconBuffer).toFile(path.join(outputDir, 'android-icon-foreground.png'));
await sharp(iconBuffer).resize(48, 48).toFile(path.join(outputDir, 'favicon.png'));
await sharp(iconBuffer).resize(200, 200).toFile(path.join(outputDir, 'splash-icon.png'));

await sharp({
  create: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    channels: 3,
    background: BRAND_BACKGROUND,
  },
})
  .png()
  .toFile(path.join(outputDir, 'android-icon-background.png'));

await sharp(iconBuffer).greyscale().png().toFile(path.join(outputDir, 'android-icon-monochrome.png'));

console.log('Ícones gerados a partir de logos/4.jpeg (marca d\'água) em assets/images/');
