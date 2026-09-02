import { createCipheriv, randomBytes } from 'node:crypto';

export interface EncryptedIntegrationSecret {
  readonly ciphertext: string;
  readonly iv: string;
  readonly tag: string;
}

export function generateWebhookSigningSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function encryptWebhookSigningSecret(
  secret: string,
  encodedKey = process.env.NEXORA_INTEGRATION_SECRET_KEY,
): EncryptedIntegrationSecret {
  const key = decodeIntegrationSecretKey(encodedKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decodeIntegrationSecretKey(encodedKey: string | undefined): Buffer {
  if (!encodedKey) {
    throw new Error('NEXORA_INTEGRATION_SECRET_KEY is not configured');
  }
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) {
    throw new Error('NEXORA_INTEGRATION_SECRET_KEY must be a base64-encoded 32-byte key');
  }
  return key;
}
