import { promises as fs } from 'node:fs';
import path from 'node:path';
import { AppError } from '@agent-device/kernel/errors';
import {
  invokeMaestroPublicOperation,
  type CreateDaemonMaestroRuntimeOperationsOptions,
} from './daemon-runtime-port-support.ts';

/** Copies a remote daemon capture into the comparison's private workspace and releases it. */
export async function captureMaestroComparisonScreenshot(
  options: CreateDaemonMaestroRuntimeOperationsOptions,
  comparisonPath: string,
): Promise<void> {
  const data = await invokeMaestroPublicOperation(options, {
    kind: 'screenshot',
    path: comparisonPath,
    stabilize: false,
    ...(options.platform === 'ios' ? { captureBackend: 'runner' as const } : {}),
  });
  if (!options.publicNetworkOnly) return;
  if (typeof data?.path !== 'string' || data.path.length === 0) {
    throw new AppError('COMMAND_FAILED', 'Maestro screenshot returned no capture path.');
  }
  try {
    await fs.copyFile(data.path, comparisonPath);
  } finally {
    await fs.rm(data.path, { force: true });
    // The capture owns this file. A nonempty parent can contain other artifacts and must remain.
    try {
      await fs.rmdir(path.dirname(data.path));
    } catch {}
  }
}
