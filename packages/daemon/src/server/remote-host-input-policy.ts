import { AppError } from '@agent-device/kernel/errors';
import { INTERNAL_COMMANDS } from '@agent-device/command-registry/catalog';
import { validateAndNormalizeBatchSteps } from '@agent-device/command-registry/batch';
import { DEFAULT_BATCH_MAX_STEPS } from '@agent-device/contracts/command';
import type { DaemonRequest } from '../core/daemon-request.ts';

const HOST_PATH_FIELDS = [
  'saveScript',
  'sessionSaveScript',
  'launchConsole',
  'baseline',
  'stepsFile',
  'searchPath',
  'metroProjectRoot',
  'metroRuntimeFile',
  'iosXctestrunFile',
  'iosXctestDerivedDataPath',
  'iosXctestEnvDir',
  'iosSimulatorDeviceSet',
] as const;

/** Remote callers choose client destinations; only the daemon chooses host output paths. */
export function restrictRemoteHostInputs(request: DaemonRequest): DaemonRequest {
  if (!request.internal?.publicNetworkOnly) return request;
  const { cwd: _cwd, ...meta } = request.meta ?? {};
  const command = request.command;
  const fields = [request.flags, request.input, request.runtime];
  assertRemoteHostToolingInputs(request, fields);
  const { out: _out, artifactsDir: _artifactsDir, ...flags } = request.flags ?? {};
  const { artifactsDir: _inputArtifactsDir, ...input } = request.input ?? {};
  if (command === 'batch') return restrictRemoteBatchSteps({ ...request, flags, meta });
  if (command === 'test') {
    return { ...request, flags, ...(request.input ? { input } : {}), meta };
  }
  if (!['screenshot', 'record', 'perf', 'trace'].includes(command)) {
    if (fields.some((record) => record && Object.hasOwn(record, 'out'))) {
      throw remoteHostInputDenied('out');
    }
    if (fields.some((record) => record && Object.hasOwn(record, 'artifactsDir'))) {
      throw remoteHostInputDenied('artifactsDir');
    }
    return { ...request, meta };
  }
  return restrictRemoteCaptureOutput({
    ...request,
    flags,
    ...(request.input ? { input } : {}),
    meta,
  });
}

function assertRemoteHostToolingInputs(
  request: DaemonRequest,
  fields: Array<object | undefined>,
): void {
  const hostPath = HOST_PATH_FIELDS.find((field) =>
    fields.some((record) => record && Object.hasOwn(record, field)),
  );
  if (hostPath || request.command === INTERNAL_COMMANDS.sessionSaveScript) {
    throw remoteHostInputDenied(hostPath ?? 'command');
  }
}

function restrictRemoteBatchSteps(request: DaemonRequest): DaemonRequest {
  const flags = { ...request.flags };
  const steps = validateAndNormalizeBatchSteps(
    flags.batchSteps,
    flags.batchMaxSteps ?? DEFAULT_BATCH_MAX_STEPS,
  );
  flags.batchSteps = steps.map((step) => {
    const restricted = restrictRemoteHostInputs({ ...request, ...step });
    return {
      ...step,
      positionals: restricted.positionals,
      flags: restricted.flags,
      input: restricted.input,
    };
  });
  return { ...request, flags };
}

function restrictRemoteCaptureOutput(request: DaemonRequest): DaemonRequest {
  const { path: _path, out: _out, outPath: _outPath, ...input } = request.input ?? {};
  return {
    ...request,
    positionals: remoteCapturePositionals(request),
    ...(request.input ? { input } : {}),
  };
}

function remoteCapturePositionals(request: DaemonRequest): string[] {
  const positionals = [...(request.positionals ?? [])];
  switch (request.command) {
    case 'screenshot':
      return [];
    case 'record':
    case 'trace':
      return positionals.slice(0, 1);
    case 'perf':
      if (positionals[0]?.toLowerCase() === 'cpu') return positionals.slice(0, 5);
      if (positionals[0]?.toLowerCase() === 'trace') return positionals.slice(0, 4);
  }
  return positionals;
}

function remoteHostInputDenied(field: string): AppError {
  return new AppError('INVALID_ARGS', `Remote requests cannot supply the host input ${field}.`, {
    reason: 'REMOTE_HOST_INPUT_DENIED',
    field,
    retriable: false,
    hint: 'Omit host paths and download generated output artifacts by ID. Use a local daemon for host tooling or script publication.',
  });
}
