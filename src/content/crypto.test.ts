import { describe, expect, it } from 'vitest';
import { decrypt, deriveKey, encrypt, exportKey, importKey } from './crypto.ts';

const data = new TextEncoder().encode('{"mcqs":[]}');

describe('content encryption', () => {
  it('decrypts with the same password', async () => {
    const sealed = await encrypt(await deriveKey('correct horse'), data);
    const opened = await decrypt(await deriveKey('correct horse'), sealed.slice().buffer);
    expect(new TextDecoder().decode(opened)).toBe('{"mcqs":[]}');
  });

  it('refuses a wrong password', async () => {
    const sealed = await encrypt(await deriveKey('correct horse'), data);
    await expect(decrypt(await deriveKey('wrong horse'), sealed.slice().buffer)).rejects.toThrow();
  });

  it('does not contain the plain text', async () => {
    const sealed = await encrypt(await deriveKey('correct horse'), data);
    expect(new TextDecoder().decode(sealed)).not.toContain('mcqs');
  });

  it('decrypts with a remembered key', async () => {
    const key = await deriveKey('correct horse', true);
    const sealed = await encrypt(key, data);
    const remembered = await importKey(await exportKey(key));
    const opened = await decrypt(remembered, sealed.slice().buffer);
    expect(new TextDecoder().decode(opened)).toBe('{"mcqs":[]}');
  });
});
