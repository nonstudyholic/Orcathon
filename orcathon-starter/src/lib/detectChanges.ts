// Detection that runs in the browser.
//
// Pipeline: resize both images to the same grid -> light blur -> match the
// after image's brightness/contrast to the before image -> per-pixel color
// distance -> adaptive threshold -> morphological cleanup -> connected
// components -> bounding boxes with color statistics.

export type Sensitivity = "low" | "medium" | "high";

// How many standard deviations above the average difference counts as a change.
const SENSITIVITY_K: Record<Sensitivity, number> = { low: 3, medium: 2.2, high: 1.5 };

const ANALYSIS_SIZE = 512; // longest side, in pixels
const MIN_REGION_FRACTION = 0.004; // ignore blobs smaller than 0.4% of the image
const MAX_REGION_FRACTION = 0.6; // ignore blobs covering most of the image
const MAX_REGIONS = 10;

export type RGB = { r: number; g: number; b: number };

export type Region = {
  id: string;
  box: { x: number; y: number; w: number; h: number }; // percent of image
  fill: number; // 0-1, how much of the box is changed pixels (compact shapes score high)
  meanDiff: number; // 0-255 average color change inside the region
  before: RGB;
  after: RGB;
};

export type DetectionResult = {
  regions: Region[];
  width: number;
  height: number;
  coverage: number; // fraction of pixels above threshold before cleanup
  warning?: string;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read one of the images."));
    img.src = url;
  });
}

// Same "cover" fit the slider uses, so detected boxes line up with what is shown.
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function readChannels(img: HTMLImageElement, w: number, h: number): Float32Array[] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  drawCover(ctx, img, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    ch[0][i] = data[i * 4];
    ch[1][i] = data[i * 4 + 1];
    ch[2][i] = data[i * 4 + 2];
  }
  return ch;
}

function blur3(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += src[yy * w + xx];
          count++;
        }
      }
      out[y * w + x] = sum / count;
    }
  }
  return out;
}

function meanStd(a: Float32Array) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i];
  const mean = sum / a.length;
  let v = 0;
  for (let i = 0; i < a.length; i++) v += (a[i] - mean) ** 2;
  return { mean, std: Math.sqrt(v / a.length) };
}

function dilate(m: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let dy = -1; dy <= 1 && !on; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < w && m[yy * w + xx]) {
            on = 1;
            break;
          }
        }
      }
      out[y * w + x] = on;
    }
  }
  return out;
}

function erode(m: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let all = 1;
      for (let dy = -1; dy <= 1 && all; dy++) {
        const yy = y + dy;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (yy < 0 || yy >= h || xx < 0 || xx >= w || !m[yy * w + xx]) {
            all = 0;
            break;
          }
        }
      }
      out[y * w + x] = all;
    }
  }
  return out;
}

export async function detectChanges(
  beforeUrl: string,
  afterUrl: string,
  sensitivity: Sensitivity
): Promise<DetectionResult> {
  const [beforeImg, afterImg] = await Promise.all([loadImage(beforeUrl), loadImage(afterUrl)]);

  // Both images are resampled to the BEFORE image's proportions.
  const scale = ANALYSIS_SIZE / Math.max(beforeImg.naturalWidth, beforeImg.naturalHeight);
  const w = Math.max(16, Math.round(beforeImg.naturalWidth * scale));
  const h = Math.max(16, Math.round(beforeImg.naturalHeight * scale));
  const n = w * h;

  const beforeCh = readChannels(beforeImg, w, h).map((c) => blur3(c, w, h));
  const afterRaw = readChannels(afterImg, w, h).map((c) => blur3(c, w, h));

  // Match the after image's brightness and contrast to the before image, so a
  // different time of day or sensor does not look like a surface change.
  const afterNorm = afterRaw.map((c, k) => {
    const a = meanStd(beforeCh[k]);
    const b = meanStd(c);
    const gain = b.std > 1e-3 ? Math.min(2, Math.max(0.5, a.std / b.std)) : 1;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = (c[i] - b.mean) * gain + a.mean;
    return out;
  });

  // Per-pixel color distance, 0-255.
  const diff = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const dr = beforeCh[0][i] - afterNorm[0][i];
    const dg = beforeCh[1][i] - afterNorm[1][i];
    const db = beforeCh[2][i] - afterNorm[2][i];
    diff[i] = Math.sqrt((dr * dr + dg * dg + db * db) / 3);
  }

  const { mean, std } = meanStd(diff);
  const threshold = Math.max(mean + SENSITIVITY_K[sensitivity] * std, 20);

  let mask: Uint8Array = new Uint8Array(n);
  let above = 0;
  for (let i = 0; i < n; i++) {
    if (diff[i] > threshold) {
      mask[i] = 1;
      above++;
    }
  }
  const coverage = above / n;

  // Close small gaps, then remove speckle.
  mask = erode(dilate(mask, w, h), w, h);
  mask = dilate(erode(mask, w, h), w, h);

  // Connected components (4-neighbour flood fill).
  const visited = new Uint8Array(n);
  const stack = new Int32Array(n);
  const found: (Region & { score: number })[] = [];

  for (let start = 0; start < n; start++) {
    if (!mask[start] || visited[start]) continue;

    let sp = 0;
    stack[sp++] = start;
    visited[start] = 1;

    let count = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    let sumDiff = 0;
    const sb = [0, 0, 0];
    const sa = [0, 0, 0];

    while (sp > 0) {
      const p = stack[--sp];
      const x = p % w;
      const y = (p - x) / w;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sumDiff += diff[p];
      for (let k = 0; k < 3; k++) {
        sb[k] += beforeCh[k][p];
        sa[k] += afterRaw[k][p];
      }

      if (x > 0 && mask[p - 1] && !visited[p - 1]) { visited[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !visited[p + 1]) { visited[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && !visited[p - w]) { visited[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && !visited[p + w]) { visited[p + w] = 1; stack[sp++] = p + w; }
    }

    if (count < MIN_REGION_FRACTION * n || count > MAX_REGION_FRACTION * n) continue;

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const meanDiff = sumDiff / count;

    found.push({
      id: "",
      box: {
        x: (minX / w) * 100,
        y: (minY / h) * 100,
        w: (bw / w) * 100,
        h: (bh / h) * 100,
      },
      fill: count / (bw * bh),
      meanDiff,
      before: { r: sb[0] / count, g: sb[1] / count, b: sb[2] / count },
      after: { r: sa[0] / count, g: sa[1] / count, b: sa[2] / count },
      score: count * meanDiff,
    });
  }

  const regions = found
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_REGIONS)
    .map(({ score: _score, ...r }, i) => ({ ...r, id: `r${i + 1}` }));

  let warning: string | undefined;
  if (coverage > 0.45) {
    warning =
      "More than 45% of the image changed. The photos may differ in lighting, season, or alignment, so these results may be unreliable.";
  }

  return { regions, width: w, height: h, coverage, warning };
}

export type RegionCrop = { id: string; before: string; after: string }; // base64 JPEG, no prefix

// Cuts a padded close-up of each region from both images, for the AI step.
export async function makeRegionCrops(
  beforeUrl: string,
  afterUrl: string,
  regions: Region[]
): Promise<RegionCrop[]> {
  const [beforeImg, afterImg] = await Promise.all([loadImage(beforeUrl), loadImage(afterUrl)]);

  const scale = 1024 / Math.max(beforeImg.naturalWidth, beforeImg.naturalHeight);
  const W = Math.max(16, Math.round(beforeImg.naturalWidth * Math.min(1, scale)));
  const H = Math.max(16, Math.round(beforeImg.naturalHeight * Math.min(1, scale)));

  const draw = (img: HTMLImageElement) => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    drawCover(c.getContext("2d")!, img, W, H);
    return c;
  };
  const bc = draw(beforeImg);
  const ac = draw(afterImg);

  const crop = (src: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number) => {
    const k = Math.min(3, 224 / Math.max(sw, sh));
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw * k));
    out.height = Math.max(1, Math.round(sh * k));
    out.getContext("2d")!.drawImage(src, sx, sy, sw, sh, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.8).split(",")[1];
  };

  return regions.map((r) => {
    const padX = (r.box.w / 100) * W * 0.2;
    const padY = (r.box.h / 100) * H * 0.2;
    const sx = Math.max(0, (r.box.x / 100) * W - padX);
    const sy = Math.max(0, (r.box.y / 100) * H - padY);
    const ex = Math.min(W, ((r.box.x + r.box.w) / 100) * W + padX);
    const ey = Math.min(H, ((r.box.y + r.box.h) / 100) * H + padY);
    const sw = Math.max(4, ex - sx);
    const sh = Math.max(4, ey - sy);
    return { id: r.id, before: crop(bc, sx, sy, sw, sh), after: crop(ac, sx, sy, sw, sh) };
  });
}
