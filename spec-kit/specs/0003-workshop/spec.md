# Feature Specification: Workshop

**Spec ID:** 0003-workshop
**Status:** Draft — first pass
**Created:** 2026-11-27
**Decision authority:** Shahid N. Shah
**Input:** "Create a new `workshop` directory in `shah/shah` with a
README.md explaining that it has my 'shell and creature comforts for all
work that I do at the CLI'." Built as a minimal, distro-independent setup
that keeps algebraically strongly typed TypeScript, Bun 1.4+, and minimal
shell pollution through a `shell` emit step. Every bootstrap and `snshah`
command must be safe to re-run.

## Why this document exists

[`workshop/`](../../../workshop/) is an artifact built on this Eidolon, in
the same Labor as Code sense as [`skills/`](../../../skills/) and
[`mcp/eidolon-server/`](../../../mcp/eidolon-server/) (spec 0001, FR-014):
it packages how Shahid works at a command line so any machine he uses can
be brought to the same state. This spec makes that checkable: what the
Workshop must and must not do, and how to tell. The machine-readable model
is [`ontology/workshop.ttl`](../../../ontology/workshop.ttl); this spec
and that file must agree.

It replaces an earlier, desktop-specific Workshop that is being retired.
Nothing here depends on that repository.

This is not an implementation plan.

## Clarifications

### Session 2026-11-27

- Q: Which npm libraries? → A: Keep `commander`, `chalk` and
  `@clack/prompts`, pinned.
- Q: Which platforms? → A: Any Linux distribution, WSL and macOS, and
  Windows 11+ as far as possible, with a companion `bootstrap.ps1`.
- Q: Which shells? → A: Independent of any one shell; `snshah shell`
  emits for bash, zsh, fish and PowerShell (`pwsh`).
- Q: Prompt? → A: Oh My Posh with the bundled `snshah.omp.json` theme.
- Q: System packages? → A: Detect and advise only; never install.
- Q: Private config? → A: Typed, under strict `$XDG` paths, never in the
  repository.
- Q: Secrets? → A: Command-scoped by default; a secret marked
  `scope: "shell"` is also exported into interactive shells.
- Q: Git checkout registry? → A: Keep it. The root is `$WORKSPACES_HOME`,
  defaulting to `~/workspaces`, or `~/Work` on Omarchy.
- Q: Claude Code and Codex user defaults? → A: Keep.
- Q: Updates? → A: Add `snshah update`.
- Q: Ontology? → A: This repository gets its own ontology; the Workshop
  has nothing to do with any other repository's ontology.
- Q: Re-runs? → A: Everything is idempotent; bootstraps and every
  `snshah` command are safe to re-run.

## Primary scenario

Shahid sits down at a new or rebuilt machine (any Linux, WSL, a Mac, or a
Windows 11 PC). He runs one bootstrap line. It gets Bun, pins one commit
of this repository, and brings his user account to the Workshop's desired
state: the CLI, his prompt, aliases and helpers in every shell he has, his
agent defaults, and his workspaces root. He restores his private config
from his own backup, runs `snshah git clone --all` to get his checkouts
back, and runs the bootstrap again later without fear, because a second
run changes nothing.

### Acceptance scenarios

1. **Given** a fresh user account, **when** the bootstrap runs, **then**
   `snshah` is installed and `snshah plan` reports no changes.
2. **Given** an installed Workshop, **when** the bootstrap or
   `snshah apply` runs again, **then** it reports "No changes needed." and
   no file changes.
3. **Given** a startup file with the user's own content, **when** `apply`
   runs any number of times, **then** that content is unchanged and the
   file holds exactly one snshah block.
4. **Given** the snshah block is deleted from a startup file, **when** a
   new shell starts, **then** nothing from the Workshop loads in it.
5. **Given** a command-scoped secret for `codex`, **when** `codex` runs
   through `snshah exec` or the generated wrapper, **then** it sees the
   secret, and no other process does.
6. **Given** a registered repository, **when** `snshah git clone --all`
   and `snshah git update --all` run twice, **then** the second runs
   report it present and up to date.
7. **Given** `snshah update` and the installed commit is current,
   **when** it runs, **then** it reports up to date and changes nothing.
8. **Given** this repository, **when** `ontology/check.ts` runs, **then**
   it passes only if `ontology/workshop.ttl` matches `workshop/snshah.ts`.

### Edge cases

- A startup file is a symlink (a dotfiles manager): the block is written
  to the link's target and the link stays.
- The user already has an alias or function with a Workshop name: theirs
  wins.
- A checkout has local changes or has diverged: `git update` skips it and
  says so.
- The private config has the wrong mode or owner: every command that reads
  it refuses until it is fixed.
- Windows 11 bootstrap and the zsh, fish and pwsh init code have not yet
  been exercised on real machines. [NEEDS CLARIFICATION: first run on a
  Windows 11 PC and on zsh, fish and pwsh shells.]

## Requirements

### Scope and safety

- **FR-001**: The Workshop MUST hold only generic defaults. It MUST NOT
  contain secrets, tokens, personal email addresses, hostnames, IP
  addresses or details of any specific network or machine.
- **FR-002**: Personal settings (aliases, paths, repositories, secrets)
  MUST live only in the private config, which MUST be a regular file the
  user owns with mode 0600, and which the Workshop MUST NOT overwrite once
  created.
- **FR-003**: The Workshop MUST NOT install system packages or require
  `sudo` or administrator rights. `snshah doctor` MUST report missing tools
  with the install command for the detected package manager.

### Idempotence

- **FR-004**: `snshah plan` MUST be read-only.
- **FR-005**: A second `snshah apply`, bootstrap, `git` or
  `config set-secret` with the same input MUST change nothing and say so.
- **FR-006**: Files the user owns (startup files, agent settings) MUST be
  changed only inside one marked block or by adding keys that are unset.

### Platforms and paths

- **FR-007**: The Workshop MUST run on Linux (any distribution), WSL,
  macOS and Windows 11+, with Bun 1.4 or newer.
- **FR-008**: The bootstraps MUST install Bun only from a pinned release
  whose SHA-256 they verify, into the user's account.
- **FR-009**: Paths MUST follow the XDG Base Directory spec on every OS,
  including macOS and Windows, ignoring relative `XDG_*` values.

### Shell emit

- **FR-010**: A startup file MUST receive at most one marked block, which
  evaluates `snshah shell <shell>`; everything else MUST come from that
  output at shell start.
- **FR-011**: `snshah shell` MUST support bash, zsh, fish and pwsh, MUST
  NOT override an existing alias or function of the same name, and MUST
  NOT output command-scoped secret values.
- **FR-012**: The prompt MUST be Oh My Posh with the bundled theme by
  default, loaded only when `oh-my-posh` is installed.

### Secrets, checkouts, agents, updates

- **FR-013**: A secret MUST be command-scoped unless the config marks it
  `scope: "shell"`. Secret values MUST NOT appear in command lines,
  diagnostics or `config check` output.
- **FR-014**: Registered checkouts MUST default to
  `$WORKSPACES_HOME/<host>/<owner>/<repo>`; `$WORKSPACES_HOME` MUST default
  to `~/workspaces`, or `~/Work` on Omarchy.
- **FR-015**: Claude Code and Codex user-level defaults MAY be filled when
  those tools are present, and MUST NOT override any value the user set.
- **FR-016**: `snshah update` MUST pin one commit of this repository,
  preview its changes, and replace the CLI only after the rest of the
  apply succeeds.

### Model of record

- **FR-017**: `ontology/workshop.ttl` MUST state the Workshop's version,
  commands, platforms, shells, secret scopes, step kinds, package managers,
  pinned dependencies, XDG paths and pinned Bun version, and
  `ontology/check.ts` MUST fail when any of them disagrees with the code.

## Key entities

- **Workshop** — `workshop/`: the CLI (`snshah.ts`), its self-test, the
  two bootstraps, the theme. Modeled as `ws:snshah`.
- **Private config** — `$XDG_CONFIG_HOME/snshah/snshah.conf.ts`, typed by
  the generated `snshah.auto.d.ts`. Never in any repository.
- **Ontology** — [`ontology/`](../../../ontology/): the vocabulary, the
  Eidolon index ([spec 0001](../0001-shahid-shah/spec.md)), and the
  Workshop model.

## Success criteria

- **SC-001**: `bun --no-env-file workshop/snshah.ts test` passes, running
  every command twice in a temporary HOME.
- **SC-002**: `bun --no-env-file ontology/check.ts` passes.
- **SC-003**: A bootstrap from GitHub, run twice in a fresh account,
  reports "No changes needed." the second time.

## Out of scope

- Desktop integrations (menus, status bars, web-app launchers, cloud drive
  mounts): the Workshop is CLI-only.
- Anything about a particular network or fleet of machines: those belong
  in their own private repositories.

## Open questions

- [NEEDS CLARIFICATION: first run on a Windows 11 PC and on zsh, fish and
  pwsh shells.]

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / MAY), not aspirational
- [x] No implementation detail beyond the behavior Shahid specified
- [x] Every requirement traces to Shahid's direct statements of 2026-11-27
- [x] Ambiguities are marked `[NEEDS CLARIFICATION]`, not silently resolved
- [x] Public-safe: no confidential or unverifiable information

## Traceability

| Requirement | Source |
| --- | --- |
| FR-001, FR-002 | Shahid N. Shah, direct statement, 2026-11-27 (repository is public; config never in the repo) |
| FR-003 | Shahid N. Shah, direct statement, 2026-11-27 ("detect and advise only") |
| FR-004 to FR-006 | Shahid N. Shah, direct statement, 2026-11-27 ("make sure everything you do is idempotent") |
| FR-007, FR-008 | Shahid N. Shah, direct statements, 2026-11-27 (platforms; Bun 1.4+) |
| FR-009 | Shahid N. Shah, direct statement, 2026-11-27 ("be strict `$XDG`") |
| FR-010 to FR-012 | Shahid N. Shah, direct statements, 2026-11-27 (`shell` emit; bash, zsh, fish, pwsh; Oh My Posh) |
| FR-013 | Shahid N. Shah, direct statement, 2026-11-27 (secrets clarification) |
| FR-014 | Shahid N. Shah, direct statement, 2026-11-27 (`$WORKSPACES_HOME`) |
| FR-015, FR-016 | Shahid N. Shah, direct statements, 2026-11-27 (keep agent defaults; add `snshah update`) |
| FR-017 | Shahid N. Shah, direct statement, 2026-11-27 (add an ontology to this repository) |
