const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "jpe",
  "jfif",
  "png",
  "webp",
  "gif",
  "bmp",
  "tif",
  "tiff",
  "heic",
  "heif",
  "heics",
  "avif",
]);

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "qt"]);

const PASS_THROUGH_IMAGE = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export const STORY_IMAGE_ACCEPT =
  "image/*,.heic,.heif,.heics,.avif,.bmp,.tif,.tiff,.gif,.jfif,.jpg,.jpeg,.png,.webp";

export const STORY_VIDEO_ACCEPT =
  "video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.mov,.m4v,.webm";

export function fileExtension(name: string): string {
  const slash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const base = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = base.lastIndexOf(".");
  return dot < 0 ? "" : base.slice(dot + 1).toLowerCase();
}

/** iPhone photos are HEIC/HEIF, and the picker often reports an empty type. */
export function isHeicLike(file: { name: string; type: string }): boolean {
  const type = file.type.toLowerCase();
  if (type.includes("heic") || type.includes("heif")) {
    return true;
  }
  const ext = fileExtension(file.name);
  return ext === "heic" || ext === "heif" || ext === "heics";
}

export function classifyStoryFile(file: { name: string; type: string }): "IMAGE" | "VIDEO" | null {
  const type = file.type.toLowerCase();
  if (type.startsWith("video/")) {
    return "VIDEO";
  }
  if (type.startsWith("image/")) {
    return "IMAGE";
  }
  const ext = fileExtension(file.name);
  if (VIDEO_EXTENSIONS.has(ext)) {
    return "VIDEO";
  }
  if (IMAGE_EXTENSIONS.has(ext)) {
    return "IMAGE";
  }
  return null;
}

/** JPEG, PNG, and WebP can upload as themselves. Everything else becomes JPEG. */
export function keepsOriginalImage(file: { name: string; type: string }): boolean {
  if (isHeicLike(file)) {
    return false;
  }
  const type = file.type.toLowerCase();
  if (PASS_THROUGH_IMAGE.has(type)) {
    return true;
  }
  const ext = fileExtension(file.name);
  return ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp";
}

export function videoMimeFor(file: { name: string; type: string }): string {
  const type = file.type.toLowerCase();
  if (type.startsWith("video/")) {
    return type;
  }
  const ext = fileExtension(file.name);
  if (ext === "webm") {
    return "video/webm";
  }
  if (ext === "mov" || ext === "qt") {
    return "video/quicktime";
  }
  return "video/mp4";
}

export function mediaKind(file: { name: string; type: string }): "IMAGE" | "VIDEO" | null {
  return classifyStoryFile(file);
}

export function uploadMime(file: { name: string; type: string }, kind: "IMAGE" | "VIDEO"): string {
  return kind === "VIDEO" ? videoMimeFor(file) : imageMimeFor(file);
}

function withMime(file: File, type: string): File {
  if (file.type === type) {
    return file;
  }
  return new File([file], file.name, { type, lastModified: file.lastModified });
}

function imageMimeFor(file: { name: string; type: string }): string {
  const type = file.type.toLowerCase();
  if (type === "image/png") {
    return "image/png";
  }
  if (type === "image/webp") {
    return "image/webp";
  }
  if (type === "image/jpeg" || type === "image/jpg") {
    return "image/jpeg";
  }
  const ext = fileExtension(file.name);
  if (ext === "png") {
    return "image/png";
  }
  if (ext === "webp") {
    return "image/webp";
  }
  return "image/jpeg";
}

/**
 * Turns any still the browser can open into a file the story upload accepts.
 * iPhone HEIC/HEIF is converted to JPEG because most browsers cannot decode it.
 */
export async function prepareStoryImage(file: File): Promise<File> {
  if (isHeicLike(file)) {
    return convertHeic(file);
  }
  const typed = withMime(file, imageMimeFor(file));
  if (keepsOriginalImage(typed) && (await canDecodeImage(typed))) {
    return typed;
  }
  if (await canDecodeImage(typed)) {
    return rasterizeToJpeg(typed);
  }
  try {
    return await convertHeic(file);
  } catch {
    throw new Error("Could not read that photo. Try a JPEG, PNG, WebP, or an iPhone photo.");
  }
}

export function prepareStoryVideo(file: File): File {
  return withMime(file, videoMimeFor(file));
}

export function prepareStoryAudio(file: File): File {
  return withMime(file, audioMimeFor(file));
}

async function convertHeic(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(result) ? result[0] : result;
  if (!(blob instanceof Blob)) {
    throw new Error("Could not read that iPhone photo.");
  }
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

function canDecodeImage(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image.naturalWidth > 0);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    image.src = url;
  });
}

function rasterizeToJpeg(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, image.naturalWidth);
      canvas.height = Math.max(1, image.naturalHeight);
      const ctx = canvas.getContext("2d");
      if (ctx === null) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that photo."));
        return;
      }
      const surface = getComputedStyle(document.documentElement)
        .getPropertyValue("--hasut-color-surface")
        .trim();
      ctx.fillStyle = surface.length > 0 ? surface : "canvas";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob === null) {
            reject(new Error("Could not read that photo."));
            return;
          }
          const base = file.name.replace(/\.[^.]+$/, "") || "photo";
          resolve(new File([blob], `${base}.jpg`, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo."));
    };
    image.src = url;
  });
}

export function audioMimeFor(file: { name: string; type: string }): string {
  const type = file.type.toLowerCase();
  if (type.startsWith("audio/")) {
    return type === "audio/x-wav" ? "audio/wav" : type;
  }
  const ext = fileExtension(file.name);
  if (ext === "wav") {
    return "audio/wav";
  }
  if (ext === "aac") {
    return "audio/aac";
  }
  if (ext === "m4a" || ext === "mp4") {
    return "audio/mp4";
  }
  if (ext === "webm") {
    return "audio/webm";
  }
  return "audio/mpeg";
}
