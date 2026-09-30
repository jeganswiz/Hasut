const OBJECT_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function assertObjectKey(objectKey: string): void {
  if (
    objectKey.length === 0 ||
    objectKey.length > 512 ||
    objectKey.includes("..") ||
    objectKey.includes("\\") ||
    objectKey.startsWith("/") ||
    objectKey.endsWith("/") ||
    !OBJECT_KEY.test(objectKey)
  ) {
    throw new Error("Invalid object key");
  }
}
