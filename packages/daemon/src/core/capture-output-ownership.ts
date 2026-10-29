import type { DaemonResponseData } from '@agent-device/kernel/contracts';

const CAPTURE_OUTPUT_OWNERSHIP = Symbol('captureOutputOwnership');
type CaptureOutputOwnership = 'daemon' | 'caller';
type CaptureOutputOwner = Readonly<{
  ownership: CaptureOutputOwnership;
  tenantId?: string;
}>;
type CaptureOutputData = DaemonResponseData & {
  [CAPTURE_OUTPUT_OWNERSHIP]?: CaptureOutputOwner;
};

/** Producer-owned capture facts stay private when the response is serialized. */
export function withCaptureOutputOwnership(
  data: DaemonResponseData,
  ownership: CaptureOutputOwnership,
  tenantId?: string,
): DaemonResponseData {
  return { ...data, [CAPTURE_OUTPUT_OWNERSHIP]: { ownership, tenantId } };
}

export function captureOutputOwnership(
  data: DaemonResponseData,
): CaptureOutputOwnership | undefined {
  const capture: CaptureOutputData = data;
  return capture[CAPTURE_OUTPUT_OWNERSHIP]?.ownership;
}

export function captureOutputTenantId(data: DaemonResponseData): string | undefined {
  const capture: CaptureOutputData = data;
  return capture[CAPTURE_OUTPUT_OWNERSHIP]?.tenantId;
}
