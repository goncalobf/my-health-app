import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const KEY_HEX = process.env.GARMIN_ENCRYPTION_KEY;

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length < 64) {
    throw new Error("GARMIN_ENCRYPTION_KEY must be a 64-hex-char (32-byte) value");
  }
  return Buffer.from(KEY_HEX, "hex");
}

interface EncryptedBlob {
  iv: string;
  ciphertext: string;
  authTag: string;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const blob: EncryptedBlob = {
    iv: iv.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
    authTag: authTag.toString("hex"),
  };
  return JSON.stringify(blob);
}

export function decrypt(encryptedData: string): string {
  const key = getKey();
  const blob = JSON.parse(encryptedData) as EncryptedBlob;
  const iv = Buffer.from(blob.iv, "hex");
  const ciphertext = Buffer.from(blob.ciphertext, "hex");
  const authTag = Buffer.from(blob.authTag, "hex");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
