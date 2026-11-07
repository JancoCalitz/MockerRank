// Encryption for the question bank when the site is built with a password. The build encrypts
// with these functions, and the browser decrypts with them, using the Web Crypto API that both
// Node and browsers provide. The password itself is never stored in the site.

// Deliberately slow, so someone who copies the encrypted files cannot quickly try many passwords.
export const KEY_ITERATIONS = 600_000;
const IV_BYTES = 12;
const encoder = new TextEncoder();

// The salt comes from the password, so a device that remembers the key stays unlocked across new
// versions of the site until the password changes. Every guess still costs a full derivation.
async function saltFor(password: string): Promise<Uint8Array<ArrayBuffer>> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`MockerRank:${password}`));
  return new Uint8Array(digest).slice(0, 16);
}

export async function deriveKey(password: string, extractable = false): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: await saltFor(password), iterations: KEY_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt'],
  );
}

export function importKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
}

export async function exportKey(key: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}

// The result is a random IV followed by the encrypted data, which includes a check that fails
// for a wrong key or altered data.
export async function encrypt(key: CryptoKey, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const out = new Uint8Array(IV_BYTES + sealed.length);
  out.set(iv);
  out.set(sealed, IV_BYTES);
  return out;
}

// Throws if the key is wrong.
export async function decrypt(key: CryptoKey, data: ArrayBuffer): Promise<Uint8Array> {
  const bytes = new Uint8Array(data);
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) },
      key,
      bytes.slice(IV_BYTES),
    ),
  );
}

export const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
export const fromBase64 = (text: string) =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
