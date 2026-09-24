import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const PROJECT_ID = 'demo-wedding-rules';

export function readRules(name: 'firestore.rules' | 'storage.rules'): string {
  return readFileSync(resolve(process.cwd(), name), 'utf8');
}

export async function createEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readRules('firestore.rules') },
    storage: { rules: readRules('storage.rules') },
  });
}

export function bytes(size: number): Uint8Array {
  return new Uint8Array(size);
}

export const MB = 1024 * 1024;
