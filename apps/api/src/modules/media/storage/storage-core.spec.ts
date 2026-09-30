import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalMediaStorage } from "./local-media.storage";
import { decryptSecret, encryptSecret, storageCipherKey } from "./credential-cipher";
import { assertObjectKey } from "./storage-key";
import { decideStorageSwitch, transferObject } from "./storage-transfer";
import { publicObjectUrl, samePhysicalStore, type StorageConnection } from "./storage-url";
import { readUploadToken, signUploadToken } from "./upload-token";

const connection = (overrides: Partial<StorageConnection> = {}): StorageConnection => ({
  id: "11111111-1111-4111-8111-111111111111",
  provider: "local",
  label: "Server storage",
  endpoint: "",
  region: "",
  bucket: "local",
  accessKey: "",
  secretKey: "",
  forcePathStyle: false,
  publicBaseUrl: "",
  localRoot: "/var/media",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...overrides,
});

describe("storage credentials", () => {
  const key = storageCipherKey("", "hasut-dev-access-secret-32chars-min");

  it("round-trips a secret and leaves an empty value empty", () => {
    expect(decryptSecret(encryptSecret("super-secret", key), key)).toBe("super-secret");
    expect(encryptSecret("", key)).toBe("");
    expect(decryptSecret("", key)).toBe("");
  });

  it("rejects a tampered payload", () => {
    const sealed = encryptSecret("super-secret", key);
    const [iv, tag, data] = sealed.split(".");
    const flipped = `${data?.startsWith("A") === true ? "B" : "A"}${data?.slice(1) ?? ""}`;
    expect(() => decryptSecret(`${iv}.${tag}.${flipped}`, key)).toThrow(/could not be read/);
  });
});

describe("upload tokens", () => {
  it("accepts a signed token and rejects a bad signature or expiry", () => {
    const token = signUploadToken("secret", {
      objectKey: "story_image/member/file",
      profileId: "profile-1",
      expiresAtMs: 5_000,
    });
    expect(readUploadToken("secret", token, 4_000)).toEqual({
      objectKey: "story_image/member/file",
      profileId: "profile-1",
    });
    expect(readUploadToken("other", token, 4_000)).toBeNull();
    expect(readUploadToken("secret", token, 5_000)).toBeNull();
  });
});

describe("public object URLs", () => {
  it("serves local and private buckets through the API", () => {
    expect(
      publicObjectUrl(connection(), "story_image/a/b", "http://127.0.0.1:3001", "api/v1"),
    ).toBe("http://127.0.0.1:3001/api/v1/media/files/story_image/a/b");
  });

  it("uses a public bucket URL when one is configured", () => {
    expect(
      publicObjectUrl(
        connection({
          provider: "s3",
          bucket: "media",
          publicBaseUrl: "https://cdn.example/media",
        }),
        "story_image/a/b",
        "http://127.0.0.1:3001",
        "api/v1",
      ),
    ).toBe("https://cdn.example/media/story_image/a/b");
  });

  it("treats the same folder or bucket as one store", () => {
    expect(samePhysicalStore(connection({ localRoot: "/data/media" }), connection())).toBe(false);
    expect(
      samePhysicalStore(
        connection({ localRoot: "/data/media" }),
        connection({ localRoot: "/data/media" }),
      ),
    ).toBe(true);
    expect(
      samePhysicalStore(
        connection({
          provider: "r2",
          endpoint: "https://acct.r2.cloudflarestorage.com",
          bucket: "m",
          region: "auto",
        }),
        connection({
          provider: "r2",
          endpoint: "https://acct.r2.cloudflarestorage.com",
          bucket: "m",
          region: "auto",
        }),
      ),
    ).toBe(true);
  });
});

describe("storage switch decision", () => {
  it("asks before moving files, then follows the answer", () => {
    expect(decideStorageSwitch({ movableCount: 2, migrate: undefined })).toBe("confirm");
    expect(decideStorageSwitch({ movableCount: 2, migrate: true })).toBe("migrate");
    expect(decideStorageSwitch({ movableCount: 2, migrate: false })).toBe("switch");
    expect(decideStorageSwitch({ movableCount: 0, migrate: undefined })).toBe("switch");
  });
});

describe("local storage transfer", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "hasut-media-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes an http upload URL and round-trips the file", async () => {
    const storage = new LocalMediaStorage(
      join(root, "source"),
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3001",
      "api/v1",
      () => "token",
    );
    const presign = await storage.presignPut("story_image/member/file", "image/jpeg", 300);
    expect(presign.uploadUrl.startsWith("http://127.0.0.1:3001/api/v1/media/local-upload/")).toBe(
      true,
    );
    await storage.write("story_image/member/file", Buffer.from("jpeg"), "image/jpeg");
    await expect(storage.read("story_image/member/file")).resolves.toEqual(Buffer.from("jpeg"));
    await expect(storage.head("story_image/member/file")).resolves.toEqual({
      contentType: "image/jpeg",
      contentLength: 4,
    });
    expect(storage.publicUrl("story_image/member/file")).toBe(
      "http://127.0.0.1:3001/api/v1/media/files/story_image/member/file",
    );
    await expect(storage.write("../secret", Buffer.from("no"), "text/plain")).rejects.toThrow(
      /Invalid object key/,
    );
  });

  it("copies bytes to a second folder and skips a matching file", async () => {
    const source = new LocalMediaStorage(
      join(root, "a"),
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3001",
      "api/v1",
      () => "t",
    );
    const destination = new LocalMediaStorage(
      join(root, "b"),
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3001",
      "api/v1",
      () => "t",
    );
    await source.write(
      "story-hls/story/index.m3u8",
      Buffer.from("playlist"),
      "application/vnd.apple.mpegurl",
    );
    await expect(
      transferObject(source, destination, "story-hls/story/index.m3u8", ""),
    ).resolves.toEqual({ status: "copied", bytes: 8 });
    await expect(
      transferObject(source, destination, "story-hls/story/index.m3u8", ""),
    ).resolves.toEqual({ status: "skipped", bytes: 8 });
    await expect(
      transferObject(source, destination, "story_image/missing/file", ""),
    ).resolves.toEqual({
      status: "missing",
    });
    expect(assertObjectKey("story_image/member/file")).toBeUndefined();
  });
});
