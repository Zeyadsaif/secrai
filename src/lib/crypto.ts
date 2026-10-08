import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * AES-256-GCM envelope encryption for secrets we must store at rest
 * (e.g. a customer tenant's client secret / refresh token in the DB).
 * Output format: base64( iv[12] || authTag[16] || ciphertext ).
 *
 * SECURITY: the key lives only in SECRAI_ENCRYPTION_KEY (never in the DB).
 * Rotate by re-encrypting rows with a new key during a migration window.
 */

function key(): Buffer {
  const raw = Buffer.from(serverEnv().SECRAI_ENCRYPTION_KEY, "base64");
  if (raw.length !== 32) {
    throw new Error("SECRAI_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).");
  }
  return raw;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
