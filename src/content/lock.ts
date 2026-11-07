import { contentLock } from 'virtual:content-lock';
import { decrypt, deriveKey, exportKey, fromBase64, importKey, toBase64 } from './crypto.ts';
import type { CodingProblem, Exam, Mcq } from './schema.ts';

// When the site is built with a password, the question bank and the large test files are
// published encrypted. Someone must enter the password before the app can load them. A build
// without a password, such as `npm start`, is not locked, and none of this applies.

export interface LockedBank {
  mcqs: Mcq[];
  problems: CodingProblem[];
  exams: Exam[];
  code: Record<string, CodingProblem['languages']>;
}

const REMEMBER_KEY = 'mockerrank.unlock';

export const contentLocked = contentLock.locked;

let key: CryptoKey | null = null;
let bank: LockedBank | null = null;

async function open(candidate: CryptoKey): Promise<void> {
  const response = await fetch(new URL(contentLock.file, document.baseURI));
  if (!response.ok) throw new Error('Could not download the questions. Check your connection.');
  const data = await decrypt(candidate, await response.arrayBuffer());
  bank = JSON.parse(new TextDecoder().decode(data)) as LockedBank;
  key = candidate;
}

export class WrongPasswordError extends Error {}

// Throws WrongPasswordError for a wrong password.
export async function unlock(password: string, remember: boolean): Promise<void> {
  const candidate = await deriveKey(password, remember);
  try {
    await open(candidate);
  } catch (failure) {
    if (failure instanceof DOMException && failure.name === 'OperationError') {
      throw new WrongPasswordError('That password is not right.');
    }
    throw failure;
  }
  if (remember) {
    try {
      localStorage.setItem(REMEMBER_KEY, toBase64(await exportKey(candidate)));
    } catch {
      // Unlocked for this visit only, if the browser's storage is full.
    }
  }
}

// Unlocks with a key this device saved earlier. False if there is none, or it no longer works
// because the password changed.
export async function unlockRemembered(): Promise<boolean> {
  const saved = localStorage.getItem(REMEMBER_KEY);
  if (!saved) return false;
  try {
    await open(await importKey(fromBase64(saved)));
    return true;
  } catch {
    localStorage.removeItem(REMEMBER_KEY);
    return false;
  }
}

export function forgetDevice() {
  localStorage.removeItem(REMEMBER_KEY);
}

// The decrypted bank, for virtual:question-bank. The app only loads after unlocking.
export function unlockedBank(): LockedBank {
  if (!bank) throw new Error('The question bank is still locked.');
  return bank;
}

// A large test file's text, decrypting it when the site is locked.
export async function readTestFile(response: Response): Promise<string> {
  if (!contentLocked) return response.text();
  if (!key) throw new Error('The question bank is still locked.');
  return new TextDecoder().decode(await decrypt(key, await response.arrayBuffer()));
}
