import { captionStyleAt } from "./caption-style";

/** Visual edits applied to a photo before it is uploaded. The story API stores the file, not these fields. */
export interface PhotoAdjust {
  rotation: 0 | 90 | 180 | 270;
  fit: "contain" | "cover";
  /** Percent, 100 leaves the photo unchanged. */
  brightness: number;
  contrast: number;
  /** Background blur in pixels. 0 leaves the backdrop sharp. */
  blur: number;
  /** Shifts a cover crop. 0 is centred. */
  panX: number;
  panY: number;
  background: "none" | "solid" | "gradient";
  /** Crop window as percentages of the 9:16 frame. 0,0,100,100 keeps the whole frame. */
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

export const DEFAULT_PHOTO_ADJUST: PhotoAdjust = {
  rotation: 0,
  fit: "contain",
  brightness: 100,
  contrast: 100,
  blur: 0,
  panX: 0,
  panY: 0,
  background: "none",
  cropX: 0,
  cropY: 0,
  cropW: 100,
  cropH: 100,
};

export const FRAME_WIDTH = 1080;
export const FRAME_HEIGHT = 1920;

export function isPlainPhoto(adjust: PhotoAdjust): boolean {
  return (
    adjust.rotation === DEFAULT_PHOTO_ADJUST.rotation &&
    adjust.fit === DEFAULT_PHOTO_ADJUST.fit &&
    adjust.brightness === DEFAULT_PHOTO_ADJUST.brightness &&
    adjust.contrast === DEFAULT_PHOTO_ADJUST.contrast &&
    adjust.blur === DEFAULT_PHOTO_ADJUST.blur &&
    adjust.panX === DEFAULT_PHOTO_ADJUST.panX &&
    adjust.panY === DEFAULT_PHOTO_ADJUST.panY &&
    adjust.background === DEFAULT_PHOTO_ADJUST.background &&
    isFullCrop(adjust)
  );
}

export function isFullCrop(adjust: PhotoAdjust): boolean {
  return adjust.cropX <= 0.5 && adjust.cropY <= 0.5 && adjust.cropW >= 99.5 && adjust.cropH >= 99.5;
}

export interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_CROP = 18;

/** Slides the crop window without changing its size. */
export function moveCropBox(box: CropBox, dx: number, dy: number): CropBox {
  return {
    x: clampPercent(box.x + dx, 0, 100 - box.w),
    y: clampPercent(box.y + dy, 0, 100 - box.h),
    w: box.w,
    h: box.h,
  };
}

/** Resizes from a corner. The opposite corner stays put. */
export function resizeCropBox(
  start: CropBox,
  corner: "nw" | "ne" | "sw" | "se",
  dx: number,
  dy: number,
): CropBox {
  let x = start.x;
  let y = start.y;
  let w = start.w;
  let h = start.h;
  if (corner === "nw" || corner === "sw") {
    x = clampPercent(start.x + dx, 0, start.x + start.w - MIN_CROP);
    w = start.w - (x - start.x);
  } else {
    w = clampPercent(start.w + dx, MIN_CROP, 100 - start.x);
  }
  if (corner === "nw" || corner === "ne") {
    y = clampPercent(start.y + dy, 0, start.y + start.h - MIN_CROP);
    h = start.h - (y - start.y);
  } else {
    h = clampPercent(start.h + dy, MIN_CROP, 100 - start.y);
  }
  return { x, y, w, h };
}

export interface PaintedCaption {
  text: string;
  color: string | null;
  x: number;
  y: number;
  w: number;
  styleIndex: number;
  backdrop: "none" | "solid" | "gradient";
  opacity: number;
}

export function nextRotation(current: PhotoAdjust["rotation"]): PhotoAdjust["rotation"] {
  if (current === 0) {
    return 90;
  }
  if (current === 90) {
    return 180;
  }
  if (current === 180) {
    return 270;
  }
  return 0;
}

export function photoCssFilter(adjust: PhotoAdjust): string {
  return `brightness(${adjust.brightness}%) contrast(${adjust.contrast}%)`;
}

/** Maps a -100..100 pan onto an object-position percentage. */
export function objectPosition(panX: number, panY: number): string {
  return `${50 + panX / 2}% ${50 + panY / 2}%`;
}

export function fittedSize(
  frameWidth: number,
  frameHeight: number,
  sourceWidth: number,
  sourceHeight: number,
  fit: PhotoAdjust["fit"],
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: frameWidth, height: frameHeight };
  }
  const scale =
    fit === "cover"
      ? Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight)
      : Math.min(frameWidth / sourceWidth, frameHeight / sourceHeight);
  return { width: sourceWidth * scale, height: sourceHeight * scale };
}

export function drawOffset(
  frameWidth: number,
  frameHeight: number,
  drawnWidth: number,
  drawnHeight: number,
  panX: number,
  panY: number,
): { x: number; y: number } {
  const extraX = drawnWidth - frameWidth;
  const extraY = drawnHeight - frameHeight;
  return {
    x: (frameWidth - drawnWidth) / 2 - (extraX * panX) / 200,
    y: (frameHeight - drawnHeight) / 2 - (extraY * panY) / 200,
  };
}

export async function renderAdjustedPhoto(
  sourceUrl: string,
  adjust: PhotoAdjust,
  overlays: readonly string[],
  caption: PaintedCaption | null = null,
): Promise<Blob> {
  const image = await loadImage(sourceUrl);
  const source = upright(image, adjust.rotation);
  const scratch = document.createElement("canvas");
  scratch.width = FRAME_WIDTH;
  scratch.height = FRAME_HEIGHT;
  const painted = scratch.getContext("2d");
  if (painted === null) {
    throw new Error("Could not prepare the photo");
  }
  paintBackdrop(painted, adjust.background);
  const filter = photoCssFilter(adjust);
  if (adjust.blur > 0) {
    painted.save();
    painted.filter = `blur(${adjust.blur * 2}px) ${filter}`;
    paintFitted(painted, source, { ...adjust, fit: "cover", panX: 0, panY: 0 });
    painted.restore();
  }
  painted.save();
  painted.filter = filter;
  paintFitted(painted, source, adjust);
  painted.restore();
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_WIDTH;
  canvas.height = FRAME_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new Error("Could not prepare the photo");
  }
  if (isFullCrop(adjust)) {
    ctx.drawImage(scratch, 0, 0);
  } else {
    const sx = (adjust.cropX / 100) * FRAME_WIDTH;
    const sy = (adjust.cropY / 100) * FRAME_HEIGHT;
    const sw = (adjust.cropW / 100) * FRAME_WIDTH;
    const sh = (adjust.cropH / 100) * FRAME_HEIGHT;
    ctx.drawImage(scratch, sx, sy, sw, sh, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  }
  paintOverlays(ctx, overlays);
  if (caption !== null && caption.text.trim().length > 0) {
    paintCaption(ctx, caption);
  }
  return canvasToJpeg(canvas);
}

function paintFitted(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource & { width: number; height: number },
  adjust: PhotoAdjust,
): void {
  const size = fittedSize(FRAME_WIDTH, FRAME_HEIGHT, source.width, source.height, adjust.fit);
  const offset = drawOffset(
    FRAME_WIDTH,
    FRAME_HEIGHT,
    size.width,
    size.height,
    adjust.panX,
    adjust.panY,
  );
  ctx.drawImage(source, offset.x, offset.y, size.width, size.height);
}

function paintBackdrop(ctx: CanvasRenderingContext2D, background: PhotoAdjust["background"]): void {
  if (background === "none") {
    ctx.fillStyle = readToken("--hasut-color-text");
    ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    return;
  }
  if (background === "solid") {
    ctx.fillStyle = readToken("--hasut-color-primary");
    ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    return;
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, FRAME_HEIGHT);
  gradient.addColorStop(0, readToken("--hasut-color-primary"));
  gradient.addColorStop(1, readToken("--hasut-color-secondary"));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
}

function paintCaption(ctx: CanvasRenderingContext2D, caption: PaintedCaption): void {
  const look = captionStyleAt(caption.styleIndex);
  const fontSize = 72;
  const boxX = (caption.x / 100) * FRAME_WIDTH;
  const boxY = (caption.y / 100) * FRAME_HEIGHT;
  const boxW = Math.max(80, (caption.w / 100) * FRAME_WIDTH);
  const maxWidth = Math.max(40, boxW - 32);
  ctx.font = `${look.fontStyle} ${look.fontWeight} ${fontSize}px ${look.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const lines = wrapLines(ctx, caption.text.trim(), maxWidth);
  const lineHeight = fontSize * 1.2;
  const blockWidth = Math.min(
    maxWidth,
    Math.max(...lines.map((line) => ctx.measureText(line).width), 0) + 28,
  );
  const blockHeight = lines.length * lineHeight + 16;
  const left = boxX + (boxW - blockWidth) / 2;
  const top = boxY;
  if (caption.backdrop !== "none") {
    const alpha = Math.min(1, Math.max(0, caption.opacity / 100));
    if (caption.backdrop === "solid") {
      ctx.fillStyle = withAlpha(readToken("--hasut-color-text"), alpha);
    } else {
      const gradient = ctx.createLinearGradient(left, top, left + blockWidth, top);
      gradient.addColorStop(0, withAlpha(readToken("--hasut-color-primary"), alpha));
      gradient.addColorStop(1, withAlpha(readToken("--hasut-color-secondary"), alpha));
      ctx.fillStyle = gradient;
    }
    roundRect(ctx, left, top, blockWidth, blockHeight, 18);
    ctx.fill();
  }
  ctx.fillStyle = caption.color ?? readToken("--hasut-color-text-on-primary");
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = caption.backdrop === "none" ? 16 : 0;
  lines.forEach((line, index) => {
    ctx.fillText(line, boxX + boxW / 2, top + 8 + index * lineHeight, maxWidth);
  });
  ctx.shadowBlur = 0;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [];
  }
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line.length === 0 ? word : `${line} ${word}`;
    if (ctx.measureText(next).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line.length > 0) {
    lines.push(line);
  }
  return lines;
}

function paintOverlays(ctx: CanvasRenderingContext2D, overlays: readonly string[]): void {
  const ink = readToken("--hasut-color-text-on-primary");
  const chip = withAlpha(readToken("--hasut-color-text"), 0.55);
  ctx.font = "600 42px sans-serif";
  ctx.textBaseline = "middle";
  let y = 72;
  for (const line of overlays) {
    const text = line.trim();
    if (text.length === 0) {
      continue;
    }
    const width = Math.min(FRAME_WIDTH - 96, ctx.measureText(text).width + 56);
    ctx.fillStyle = chip;
    roundRect(ctx, 48, y, width, 72, 24);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.fillText(text, 76, y + 36, width - 56);
    y += 88;
  }
}

function upright(
  image: HTMLImageElement,
  rotation: PhotoAdjust["rotation"],
): HTMLCanvasElement | HTMLImageElement {
  if (rotation === 0) {
    return image;
  }
  const swapped = rotation === 90 || rotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swapped ? image.naturalHeight : image.naturalWidth;
  canvas.height = swapped ? image.naturalWidth : image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return image;
  }
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  return canvas;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that photo"));
    image.src = url;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error("Could not prepare the photo"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.92,
    );
  });
}

function clampPercent(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readToken(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : "canvastext";
}

function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-fA-F]{6})$/.exec(color);
  if (hex !== null) {
    const raw = hex[1] ?? "";
    const r = Number.parseInt(raw.slice(0, 2), 16);
    const g = Number.parseInt(raw.slice(2, 4), 16);
    const b = Number.parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  if (rgb !== null) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  }
  return color;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}
