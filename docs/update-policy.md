# pi Update Policy

- Status: Proposal
- Source: [Issue #5](https://github.com/bonsai/pi-tui/issues/5), RAW11-12 (2026-10-18)
- Goal: use mise as the single supported version-management path for pi itself.

## 1. Source of truth

- mise is the sole supported installer/version selector for the pi executable.
- Do not use pnpm global as a parallel update path.
- The migration must inventory the current executable path, version, mise configuration, and installed extensions before changing the active installation.
- Document a recovery path before removing or disabling the old path.

## 2. Update classes

Treat these as separate channels with separate policies:

1. **Core** — pi executable/runtime.
2. **Extensions** — individually versioned extensions and their compatibility.
3. **Models/providers** — configuration and provider metadata; not binary updates.

Do not bundle all three into one opaque automatic update.

## 3. Execution policy

MVP default: explicit/manual invocation with a reusable skill/command. Periodic automation remains an ADR decision and must not be enabled until rollback, logging, and stop controls are proven.

Each run records:
- start time and trigger
- current and target versions
- update source and change summary
- success/failure and smoke-test result
- rollback action, if any

## 4. Safe update sequence

1. Check current version and installation path.
2. Resolve target version and display the proposed change.
3. Record the current version and configuration snapshot.
4. Update through mise only.
5. Run version/help smoke tests and the repository's available checks.
6. If checks fail, restore the last known-good version and record the reason.
7. Report final state; never report success before verification.

## 5. Stop and rollback

- Provide a documented way to disable automation.
- Pin or select a known-good version using mise.
- Keep core, extension, and model/provider changes separately attributable.
- If rollback itself fails, stop further updates and report the exact observed state.

## 6. Acceptance criteria

- One documented install/update path based on mise.
- No supported pnpm-global update route remains in the instructions.
- Update targets, trigger/frequency, and stop mechanism are explicit.
- Previous version and change summary are recorded.
- Smoke test and logs exist.
- Failure recovery returns to a known-good version or clearly reports that recovery failed.
