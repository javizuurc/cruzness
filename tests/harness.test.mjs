import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const credentialName = /(?:api[_-]?key|access[_-]?token|client[_-]?secret|private[_-]?key|password|secret|token)/i;
const placeholder = /^(?:|your[-_].*|.*(?:example|placeholder|changeme|replace[-_ ]?me|todo).*)$/i;
const credentialPatterns = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/i,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bBearer\s+(?!\{env:)[A-Za-z0-9._~+/=-]{20,}/i,
];

function credentialLeaks(contents) {
  const leaks = credentialPatterns.filter((pattern) => pattern.test(contents)).map(String);
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s][^=]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, '');
    if (credentialName.test(key.trim()) && !placeholder.test(value)) {
      leaks.push(`credential-like key ${key.trim()}`);
    }
  }
  return leaks;
}

describe('environment configuration', () => {
  it('documents every environment variable referenced by the OpenCode config', async () => {
    const config = await readFile(new URL('../opencode.json', import.meta.url), 'utf8');
    const example = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
    const references = [...config.matchAll(/\{env:([A-Z_][A-Z0-9_]*)\}/g)].map((match) => match[1]);
    const documented = new Set(
      example
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=/)?.[1])
        .filter(Boolean),
    );

    for (const name of new Set(references)) {
      assert.ok(documented.has(name), `${name} is referenced by opencode.json but missing from .env.example`);
    }
  });

  it('rejects recognizable hard-coded credentials in the OpenCode config', async () => {
    const config = await readFile(new URL('../opencode.json', import.meta.url), 'utf8');
    assert.deepEqual(credentialLeaks(config), [], 'opencode.json contains a hard-coded credential');
  });

  it('detects credential-like keys generically without reading .env values', () => {
    assert.equal(credentialLeaks('GITHUB_PERSONAL_ACCESS_TOKEN=live-value-123\nSERVICE_API_KEY=private-value-456').length, 2);
  });
});
