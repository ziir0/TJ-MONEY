// Preconfigured storage helpers for Manus WebDev templates
// Uploads via Forge Server presigned URL to S3 (PUT direct).
// Downloads return /manus-storage/{key} paths served via 307 redirect.

import { ENV } from "./_core/env.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TRADE_SCREENSHOT_BUCKET = "trade-screenshots";
const SCREENSHOT_URL_LIFETIME = 60 * 60 * 24;
const SCREENSHOT_PREVIEW_TRANSFORM = {
  width: 640,
  height: 360,
  resize: "contain" as const,
  quality: 72,
};
let tradeScreenshotStorageClient: SupabaseClient | null = null;

function getTradeScreenshotStorage() {
  if (tradeScreenshotStorageClient) return tradeScreenshotStorageClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase Storage requires SUPABASE_URL and SUPABASE_SECRET_KEY");
  }

  tradeScreenshotStorageClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return tradeScreenshotStorageClient;
}

export async function uploadTradeScreenshot(
  objectPath: string,
  data: Buffer,
  contentType: string,
) {
  const { data: uploaded, error } = await getTradeScreenshotStorage()
    .storage
    .from(TRADE_SCREENSHOT_BUCKET)
    .upload(objectPath, data, { contentType, upsert: false });

  if (error) throw error;
  return uploaded.path;
}

export async function getTradeScreenshotSignedUrls(
  objectPaths: string[],
  variant: "thumbnail" | "original",
) {
  if (objectPaths.length === 0) return {};

  const bucket = getTradeScreenshotStorage().storage.from(TRADE_SCREENSHOT_BUCKET);

  if (variant === "thumbnail") {
    try {
      const signedUrls = await Promise.all(objectPaths.map(async (objectPath) => {
        const { data, error } = await bucket.createSignedUrl(
          objectPath,
          SCREENSHOT_URL_LIFETIME,
          { transform: SCREENSHOT_PREVIEW_TRANSFORM },
        );
        if (error) throw error;
        return [objectPath, data.signedUrl] as const;
      }));
      return Object.fromEntries(signedUrls);
    } catch (error) {
      console.warn("[TJ Storage] Image transformation unavailable; using original screenshots", {
        message: error instanceof Error ? error.message : "Unknown storage error",
      });
    }
  }

  const { data, error } = await bucket.createSignedUrls(objectPaths, SCREENSHOT_URL_LIFETIME);
  if (error) throw error;

  return Object.fromEntries(
    data.flatMap((item) => item.path && item.signedUrl && !item.error
      ? [[item.path, item.signedUrl]]
      : []),
  );
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY",
    );
  }

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));

  // 1. Get presigned PUT URL from Forge
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  // 2. PUT file directly to S3
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);

  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}
