/**
 * Encryption utilities for user secrets
 *
 * Uses AES-256-GCM for authenticated encryption of secrets at rest.
 * The master key should be stored in Doppler or another secrets manager.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

export interface EncryptedData {
  encryptedValue: string; // Base64 encoded
  iv: string; // Base64 encoded
  authTag: string; // Base64 encoded
}

export interface EncryptionConfig {
  masterKey: string; // Base64-encoded 32-byte key
}

/**
 * Generate a new random master key (32 bytes for AES-256)
 */
export function generateMasterKey(): string {
  return randomBytes(32).toString("base64");
}

/**
 * Validate that a master key is the correct format
 */
export function validateMasterKey(key: string): boolean {
  try {
    const decoded = Buffer.from(key, "base64");
    return decoded.length === 32;
  } catch {
    return false;
  }
}

/**
 * Encrypt a secret value using AES-256-GCM
 */
export function encrypt(plaintext: string, masterKey: string): EncryptedData {
  if (!validateMasterKey(masterKey)) {
    throw new Error("Invalid master key: must be 32 bytes base64-encoded");
  }

  const key = Buffer.from(masterKey, "base64");
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    encryptedValue: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * Decrypt a secret value using AES-256-GCM
 */
export function decrypt(
  encryptedData: EncryptedData,
  masterKey: string,
): string {
  if (!validateMasterKey(masterKey)) {
    throw new Error("Invalid master key: must be 32 bytes base64-encoded");
  }

  const key = Buffer.from(masterKey, "base64");
  const iv = Buffer.from(encryptedData.iv, "base64");
  const authTag = Buffer.from(encryptedData.authTag, "base64");
  const encrypted = Buffer.from(encryptedData.encryptedValue, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Re-encrypt a secret with a new master key (for key rotation)
 */
export function reencrypt(
  encryptedData: EncryptedData,
  oldMasterKey: string,
  newMasterKey: string,
): EncryptedData {
  const plaintext = decrypt(encryptedData, oldMasterKey);
  return encrypt(plaintext, newMasterKey);
}
