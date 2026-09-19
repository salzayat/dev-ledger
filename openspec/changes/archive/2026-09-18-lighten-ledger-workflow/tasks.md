# Tasks: Lighten Ledger Workflow

- [x] 1.1 ~2 `ledger.yml`: cache `.telemetry/mirrors` keyed on the commit; cache the last deployed hash;
      skip the Pages upload and the deploy when the hash is unchanged.
- [x] 1.2 ~1 `ledger.yml`: `paths-ignore` for prose on `pull_request`; `push` unchanged.
- [x] 1.3 ~1 `check.yml`: the declared-work gate runs there on every pull request.
- [x] 2.1 ~1 Specs, README, roadmap.
- [x] 3.1 ~1 Verified on the pull request that opens this change: its run restores or saves the mirror
      cache, and the check workflow's declared gate passes.
