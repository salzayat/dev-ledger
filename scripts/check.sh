#!/bin/sh
set -eu

npm exec openspec -- validate --all --strict
./scripts/check-harness.sh
./scripts/check-hooks-current.sh
./scripts/check-openspec-archive.sh
./scripts/check-plan-freshness.sh
./scripts/check-dependencies.sh
./scripts/test-governance.sh
./scripts/test-pr-body.sh
./scripts/test-trailers.sh
./scripts/test-hooks-current.sh
./scripts/check-repository-conventions.sh
./scripts/check-agent-attribution.sh
./scripts/check-docs.sh
./scripts/check-secrets.sh
npm run format:check
./scripts/check-workspace-links.sh
npm run typecheck
npm run lint
npm run test
npm run build
