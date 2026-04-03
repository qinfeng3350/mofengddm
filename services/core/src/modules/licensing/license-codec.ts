import crypto from "crypto";

export type LicenseDuration = "month" | "halfYear" | "year";

export type LicenseLimits = {
  enabled: boolean;
  maxEnabledUsers?: number;
  maxForms?: number;
  maxRecords?: number;
};

export type LicensePayloadV1 = {
  v: 1;
  licenseId: string;
  tenantName?: string;
  issuedAt: number; // ms
  expiresAt: number; // ms
  limits: LicenseLimits;
};

function base64UrlEncode(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number" || t === "boolean") return String(value);
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(",")}}`;
  }
  // functions / undefined etc not expected for payload
  return JSON.stringify(value);
}

export function signLicensePayload(payload: LicensePayloadV1, secret: string): string {
  const payloadJson = stableStringify(payload);
  const payloadB64 = base64UrlEncode(Buffer.from(payloadJson, "utf8"));

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadJson, "utf8")
    .digest();
  const sigB64 = base64UrlEncode(signature);

  return `${payloadB64}.${sigB64}`;
}

export function verifyAndDecodeLicenseKey(input: string, secret: string): LicensePayloadV1 {
  const [payloadB64, sigB64] = input.split(".");
  if (!payloadB64 || !sigB64) {
    throw new Error("licenseKey 格式不正确");
  }

  let payloadJson: string;
  try {
    payloadJson = base64UrlDecode(payloadB64).toString("utf8");
  } catch {
    throw new Error("licenseKey payload 解码失败");
  }

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payloadJson, "utf8")
    .digest();

  let providedSig: Buffer;
  try {
    providedSig = base64UrlDecode(sigB64);
  } catch {
    throw new Error("licenseKey signature 解码失败");
  }

  if (providedSig.length !== expectedSig.length || !crypto.timingSafeEqual(providedSig, expectedSig)) {
    throw new Error("licenseKey 验签失败");
  }

  let payload: LicensePayloadV1;
  try {
    payload = JSON.parse(payloadJson) as LicensePayloadV1;
  } catch {
    throw new Error("licenseKey payload JSON 解析失败");
  }

  if (payload?.v !== 1) {
    throw new Error("不支持的 license 版本");
  }

  if (!payload?.limits || typeof payload.limits.enabled !== "boolean") {
    throw new Error("licenseKey limits 不完整");
  }

  return payload;
}

export function getExpiresAtByDuration(duration: LicenseDuration, nowMs = Date.now()): number {
  const d = new Date(nowMs);
  if (duration === "month") d.setMonth(d.getMonth() + 1);
  if (duration === "halfYear") d.setMonth(d.getMonth() + 6);
  if (duration === "year") d.setFullYear(d.getFullYear() + 1);
  return d.getTime();
}

