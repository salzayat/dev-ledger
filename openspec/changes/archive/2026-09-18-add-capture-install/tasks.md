# Tasks: Add Capture Install

- [x] 1.1 ~2 `scripts/telemetry.sh` and `scripts/harness/claude-code.sh` resolve the tool root from their own
      path; the adapter reads plan and provider from git configuration first.
- [x] 1.2 ~3 `scripts/install-capture.sh`: shims, git configuration, `telemetry.config.json`, `--claude`,
      existing hooks kept, `core.hooksPath` refused.
- [x] 1.3 ~1 README for adopters; CONTRIBUTING, package description, roadmap.
- [x] 2.1 ~2 `scripts/test-capture-install.sh` in `npm run check`: a session recorded in another repository
      through its own hooks, an existing hook kept and run first, a routed repository refused.
- [x] 2.2 ~1 `npm run check`.
