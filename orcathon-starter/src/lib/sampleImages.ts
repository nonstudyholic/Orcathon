// Builds a matching before/after pair of synthetic "satellite" images in the
// browser, so the app can be demoed without uploading anything.
//
// The scene is forest with a river running through it. In the "after" image:
//   - a compact rectangle of forest is cleared (human-made),
//   - an irregular patch is burned (natural),
//   - the river spills over its lower bank (flood, natural),
//   - everything is a hair darker, to mimic a slightly different time of day.

const W = 640;
const H = 400;
const CELL = 3; // noise is blocky so the texture looks like imagery, not static

type Rgb = [number, number, number];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function riverY(x: number) {
  return 300 + 38 * Math.sin(x / 90);
}

// n is a noise value in [-1, 1] that is identical in both images.
function colorAt(x: number, y: number, n: number, after: boolean): Rgb {
  const ry = riverY(x);

  const flooded = after && x < 290 && y > ry + 14 && y < ry + 42;
  if (Math.abs(y - ry) < 14 || flooded) {
    return [38 + n * 8, 92 + n * 10, 152 + n * 12];
  }

  if (after && Math.abs(x - 175) < 55 + 4 * Math.sin(y / 6) && Math.abs(y - 115) < 45 + 4 * Math.sin(x / 7)) {
    return [142 + n * 12, 106 + n * 10, 68 + n * 8];
  }

  const dx = x - 465;
  const dy = y - 125;
  if (after && Math.hypot(dx, dy) < 58 + 18 * Math.sin(3 * Math.atan2(dy, dx))) {
    return [120 + n * 8, 116 + n * 8, 112 + n * 8];
  }

  return [30 + n * 10, 86 + n * 22, 46 + n * 10];
}

function clamp(v: number) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function render(after: boolean, noise: Float32Array): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const light = after ? 0.99 : 1;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const [r, g, b] = colorAt(x, y, noise[i], after);
      d[i * 4] = clamp(r * light);
      d[i * 4 + 1] = clamp(g * light);
      d[i * 4 + 2] = clamp(b * light);
      d[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function toFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(new File([blob], name, { type: "image/png" }));
      else reject(new Error("Could not create the sample image."));
    }, "image/png");
  });
}

export async function makeSamplePair(): Promise<{ before: File; after: File }> {
  const rand = mulberry32(2024);
  const cw = Math.ceil(W / CELL);
  const ch = Math.ceil(H / CELL);
  const grid = new Float32Array(cw * ch);
  for (let i = 0; i < grid.length; i++) grid[i] = rand() * 2 - 1;

  const noise = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      noise[y * W + x] = grid[Math.floor(y / CELL) * cw + Math.floor(x / CELL)];
    }
  }

  const [before, after] = await Promise.all([
    toFile(render(false, noise), "sample-before.png"),
    toFile(render(true, noise), "sample-after.png"),
  ]);
  return { before, after };
}
