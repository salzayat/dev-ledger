# Agent Harness Map

The repository keeps agent instructions portable by separating canonical content from discovery paths. This
is an adapter pattern: integrations discover the same project guidance, but none becomes the source of
truth for application behavior.

```text
AGENTS.md                         repository rules
CLAUDE.md -> AGENTS.md            Claude-compatible rules
.agent/
  commands/                       canonical slash commands
  skills/                         canonical reusable skills
.agents -> .agent                 plural-agent discovery adapter
.opencode/
  command -> ../.agent/commands   OpenCode command adapter
  skills -> ../.agent/skills       OpenCode skill adapter
.claude/
  commands -> ../.agent/commands   Claude command adapter
  skills -> ../.agent/skills       Claude skill adapter
.github/workflows/                CI quality gates
scripts/                          local governance and automation
openspec/                         behavioral contracts and proposed changes
plans/                            teaching roadmap and workflow guides
```

## MCP Boundary

MCP configuration belongs in the agent/editor adapter layer, not in application packages. Keep capabilities
limited to repository-local, read-only inspection, Nx project graph and target discovery, and bounded Nx
task execution. Agent configuration does not grant permission to deploy, publish, mutate external systems,
or run arbitrary network operations.

Keep provider credentials, personal filesystem paths, unrestricted shell servers, and arbitrary network
servers out of repository configuration. The accepted governance spec under
`openspec/specs/dev-ledger-governance/` records the durable requirements.

`opencode.json` is the OpenCode adapter configuration. Its `$schema` declaration enables editor validation;
the configured Nx MCP server remains local and bounded by the repository governance policy.

## Teaching Rule

When adding another harness, add a discovery adapter and document it here. Do not copy commands or skills.
Run `./scripts/check-harness.sh` to verify the topology.
