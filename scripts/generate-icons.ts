import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import png2icons from "png2icons";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const resources = join(repoRoot, "resources");
const iconsDir = join(resources, "icons");

const SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];

async function main(): Promise<void> {
  const svg = await readFile(join(resources, "icon.svg"));
  await mkdir(iconsDir, { recursive: true });

  const pngs: { size: number; buffer: Buffer }[] = [];
  for (const size of SIZES) {
    const buffer = await sharp(svg).resize(size, size).png().toBuffer();
    const outPath = join(iconsDir, `icon-${size}.png`);
    await writeFile(outPath, buffer);
    pngs.push({ size, buffer });
    console.log(`✓ ${outPath}`);
  }

  const main512 = pngs.find((p) => p.size === 512)!.buffer;
  await writeFile(join(resources, "icon.png"), main512);
  console.log(`✓ ${join(resources, "icon.png")}`);

  const main1024 = pngs.find((p) => p.size === 1024)!.buffer;

  const ico = png2icons.createICO(main1024, png2icons.BICUBIC, 0, false, true);
  if (!ico) throw new Error("createICO returned null");
  await writeFile(join(resources, "icon.ico"), ico);
  console.log(`✓ ${join(resources, "icon.ico")}`);

  const icns = png2icons.createICNS(main1024, png2icons.BICUBIC, 0);
  if (!icns) throw new Error("createICNS returned null");
  await writeFile(join(resources, "icon.icns"), icns);
  console.log(`✓ ${join(resources, "icon.icns")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
