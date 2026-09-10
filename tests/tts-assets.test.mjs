import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('every scripted line has a local, normalized WAV cache', () => {
  const manifest = JSON.parse(fs.readFileSync('public/audio/manifest.json', 'utf8'));
  assert.equal(manifest.items.length, 243);
  assert.equal(manifest.items.filter(item => item.status === 'error').length, 0);
  for (const item of manifest.items) {
    const file = item.path.slice(1);
    const bytes = fs.readFileSync(file);
    assert.ok(bytes.length > 44, file);
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF', file);
    assert.equal(bytes.subarray(8, 12).toString(), 'WAVE', file);
    assert.equal(bytes.readUInt32LE(4), bytes.length - 8, file);
    assert.equal(bytes.readUInt32LE(40), bytes.length - 44, file);
  }
});

test('the two opening cards have Chelsie narration clips', () => {
  const manifest = JSON.parse(fs.readFileSync('public/audio/manifest.json', 'utf8'));
  const opening = manifest.items.filter(item => item.segment === 'opening');
  assert.equal(opening.length, 2);
  assert.deepEqual(opening.map(item => item.parts[0].voice), ['Chelsie', 'Chelsie']);
});

test('narration plays at 1.15x while character dialogue keeps its original speed', () => {
  const manifest = JSON.parse(fs.readFileSync('public/audio/manifest.json', 'utf8'));
  assert.equal(manifest.narrator_speed, 1.15);
  for (const item of manifest.items) for (const part of item.parts ?? []) {
    assert.equal(part.speed, part.speaker === '旁白' ? 1.15 : 1.0);
  }
});

test('manifest keeps the three cloned teacher voices separate from system voices', () => {
  const manifest = JSON.parse(fs.readFileSync('public/audio/manifest.json', 'utf8'));
  const cloned = new Set(['陈应', '徐进', '吴国平']);
  for (const item of manifest.items) for (const part of item.parts ?? [item]) {
    if (cloned.has(part.speaker)) assert.match(part.voice, /^qwen-tts-vc-/);
    else assert.ok(['Cherry', 'Ethan', 'Moon', 'Kai', 'Serena', 'Chelsie'].includes(part.voice), `${part.speaker}: ${part.voice}`);
  }
});
