import { describe, it, expect } from "vitest";
import {
  encrypt,
  decrypt,
  reencrypt,
  generateMasterKey,
  validateMasterKey,
  type EncryptedData,
} from "./encryption";

describe("encryption", () => {
  describe("generateMasterKey", () => {
    it("should generate a valid 32-byte base64 key", () => {
      const key = generateMasterKey();
      expect(validateMasterKey(key)).toBe(true);

      const decoded = Buffer.from(key, "base64");
      expect(decoded.length).toBe(32);
    });

    it("should generate unique keys", () => {
      const key1 = generateMasterKey();
      const key2 = generateMasterKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe("validateMasterKey", () => {
    it("should accept valid 32-byte base64 keys", () => {
      const validKey = generateMasterKey();
      expect(validateMasterKey(validKey)).toBe(true);
    });

    it("should reject keys that are too short", () => {
      const shortKey = Buffer.alloc(16).toString("base64");
      expect(validateMasterKey(shortKey)).toBe(false);
    });

    it("should reject keys that are too long", () => {
      const longKey = Buffer.alloc(64).toString("base64");
      expect(validateMasterKey(longKey)).toBe(false);
    });

    it("should reject invalid base64", () => {
      expect(validateMasterKey("not-valid-base64!!!")).toBe(false);
    });
  });

  describe("encrypt/decrypt", () => {
    const masterKey = generateMasterKey();

    it("should encrypt and decrypt a simple string", () => {
      const plaintext = "my-secret-api-key-12345";
      const encrypted = encrypt(plaintext, masterKey);

      expect(encrypted.encryptedValue).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      // Encrypted value should be different from plaintext
      expect(encrypted.encryptedValue).not.toBe(plaintext);

      const decrypted = decrypt(encrypted, masterKey);
      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt and decrypt unicode strings", () => {
      const plaintext = "secret-with-emoji-🔐-and-日本語";
      const encrypted = encrypt(plaintext, masterKey);
      const decrypted = decrypt(encrypted, masterKey);
      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt and decrypt long strings", () => {
      const plaintext = "a".repeat(10000);
      const encrypted = encrypt(plaintext, masterKey);
      const decrypted = decrypt(encrypted, masterKey);
      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertexts for same plaintext (due to random IV)", () => {
      const plaintext = "same-secret";
      const encrypted1 = encrypt(plaintext, masterKey);
      const encrypted2 = encrypt(plaintext, masterKey);

      expect(encrypted1.encryptedValue).not.toBe(encrypted2.encryptedValue);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);

      // But both should decrypt to same value
      expect(decrypt(encrypted1, masterKey)).toBe(plaintext);
      expect(decrypt(encrypted2, masterKey)).toBe(plaintext);
    });

    it("should fail to decrypt with wrong master key", () => {
      const plaintext = "my-secret";
      const encrypted = encrypt(plaintext, masterKey);

      const wrongKey = generateMasterKey();
      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it("should fail to decrypt with tampered ciphertext", () => {
      const plaintext = "my-secret";
      const encrypted = encrypt(plaintext, masterKey);

      // Tamper with encrypted value
      const tampered: EncryptedData = {
        ...encrypted,
        encryptedValue: "dGFtcGVyZWQ=", // base64 of "tampered"
      };

      expect(() => decrypt(tampered, masterKey)).toThrow();
    });

    it("should fail to decrypt with tampered auth tag", () => {
      const plaintext = "my-secret";
      const encrypted = encrypt(plaintext, masterKey);

      // Tamper with auth tag
      const tampered: EncryptedData = {
        ...encrypted,
        authTag: Buffer.alloc(16).toString("base64"),
      };

      expect(() => decrypt(tampered, masterKey)).toThrow();
    });

    it("should throw for invalid master key on encrypt", () => {
      expect(() => encrypt("secret", "invalid-key")).toThrow(
        "Invalid master key",
      );
    });

    it("should throw for invalid master key on decrypt", () => {
      const encrypted = encrypt("secret", masterKey);
      expect(() => decrypt(encrypted, "invalid-key")).toThrow(
        "Invalid master key",
      );
    });
  });

  describe("reencrypt", () => {
    it("should re-encrypt data with a new key", () => {
      const oldKey = generateMasterKey();
      const newKey = generateMasterKey();
      const plaintext = "my-secret-value";

      const encryptedOld = encrypt(plaintext, oldKey);
      const encryptedNew = reencrypt(encryptedOld, oldKey, newKey);

      // Should be able to decrypt with new key
      expect(decrypt(encryptedNew, newKey)).toBe(plaintext);

      // Should NOT be able to decrypt old with new key
      expect(() => decrypt(encryptedOld, newKey)).toThrow();

      // Should NOT be able to decrypt new with old key
      expect(() => decrypt(encryptedNew, oldKey)).toThrow();
    });

    it("should produce different ciphertext after re-encryption", () => {
      const oldKey = generateMasterKey();
      const newKey = generateMasterKey();
      const plaintext = "my-secret-value";

      const encryptedOld = encrypt(plaintext, oldKey);
      const encryptedNew = reencrypt(encryptedOld, oldKey, newKey);

      expect(encryptedNew.encryptedValue).not.toBe(encryptedOld.encryptedValue);
      expect(encryptedNew.iv).not.toBe(encryptedOld.iv);
    });
  });
});
