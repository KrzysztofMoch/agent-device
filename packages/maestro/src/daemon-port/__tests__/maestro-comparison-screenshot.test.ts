import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { captureMaestroComparisonScreenshot } from '../maestro-comparison-screenshot.ts';
import { mkdtempForTestSync } from '../../tmp-dir.fixtures.ts';
import { makeDependencies, makeRuntimeEnvelope } from './daemon-runtime-port-fixtures.ts';
import type { CreateDaemonMaestroRuntimeOperationsOptions } from '../daemon-runtime-port-support.ts';

function options(
  invoke: CreateDaemonMaestroRuntimeOperationsOptions['invoke'],
): CreateDaemonMaestroRuntimeOperationsOptions {
  return {
    ...makeRuntimeEnvelope({ publicNetworkOnly: true }),
    platform: 'ios',
    dependencies: makeDependencies(),
    invoke,
  };
}

test.each([false, true])(
  'copies the returned capture and preserves unrelated siblings: %s',
  async (sibling) => {
    const root = mkdtempForTestSync('maestro-comparison-');
    const captureRoot = path.join(root, 'capture');
    fs.mkdirSync(captureRoot);
    const actual = path.join(captureRoot, 'screenshot.png');
    const comparison = path.join(root, 'comparison.png');
    const unrelated = path.join(captureRoot, 'unrelated.txt');
    fs.writeFileSync(actual, 'capture-bytes');
    if (sibling) fs.writeFileSync(unrelated, 'keep');

    await captureMaestroComparisonScreenshot(
      options(async (request) => {
        expect(request.positionals).toEqual([]);
        return { ok: true, data: { path: actual } };
      }),
      comparison,
    );

    expect(fs.readFileSync(comparison, 'utf8')).toBe('capture-bytes');
    expect(fs.existsSync(actual)).toBe(false);
    expect(fs.existsSync(captureRoot)).toBe(sibling);
    if (sibling) expect(fs.readFileSync(unrelated, 'utf8')).toBe('keep');
  },
);

test('releases the returned capture when copying into the comparison workspace fails', async () => {
  const root = mkdtempForTestSync('maestro-comparison-copy-error-');
  const actual = path.join(root, 'screenshot.png');
  fs.writeFileSync(actual, 'capture-bytes');
  await expect(
    captureMaestroComparisonScreenshot(
      options(async () => ({ ok: true, data: { path: actual } })),
      path.join(root, 'missing', 'comparison.png'),
    ),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  expect(fs.existsSync(actual)).toBe(false);
  expect(fs.existsSync(root)).toBe(false);
});

test('a remote capture without a returned path cannot masquerade as a successful comparison capture', async () => {
  const root = mkdtempForTestSync('maestro-comparison-no-path-');
  const comparison = path.join(root, 'comparison.png');
  await expect(
    captureMaestroComparisonScreenshot(
      options(async () => ({ ok: true, data: {} })),
      comparison,
    ),
  ).rejects.toMatchObject({ code: 'COMMAND_FAILED' });
  expect(fs.existsSync(comparison)).toBe(false);
});

test('preserves typed daemon cancellation without creating comparison evidence', async () => {
  const root = mkdtempForTestSync('maestro-comparison-canceled-');
  const comparison = path.join(root, 'comparison.png');
  await expect(
    captureMaestroComparisonScreenshot(
      options(async () => ({
        ok: false,
        error: {
          code: 'COMMAND_FAILED',
          message: 'Canceled',
          details: { reason: 'request_canceled' },
        },
      })),
      comparison,
    ),
  ).rejects.toMatchObject({ details: { reason: 'request_canceled' } });
  expect(fs.existsSync(comparison)).toBe(false);
});
