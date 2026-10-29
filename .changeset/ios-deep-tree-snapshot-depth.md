---
'agent-device': patch
---

Fix iOS simulator snapshots dropping controls nested more than 64 accessibility levels deep, so `press` by label or ref could not find them. Regular snapshots now read up to 128 levels: each native request still reads at most 65 levels, and continuations deliver the rest. The continuation budget grows from 32 to 64 requests to cover the extra levels, so a wide deep screen that previously exhausted it and fell back to the slower runner capture now completes in the bridge.
