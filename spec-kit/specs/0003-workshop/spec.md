# Feature Specification: Workshop

**Spec ID:** 0003-workshop
**Status:** Draft, second pass (v0.2.0: profile.d, first acceptance run)
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

### Session 2026-11-27 (profile.d)

- Q: Where do per-environment setups live? → A: In this repository's
  `workshop/profile.d/*.ts` ("for Omarchy do this", "for Fedora do that"),
  and per machine in the private `$XDG_CONFIG_HOME/snshah/profile.d/`. Both
  are picked up automatically and merged in a type-safe way.
- Q: What does each profile file export? → A: A typed `selector` as its core
  export.
- Q: Command hooks? → A: Allowed, with environment variables passed through
  from parent to child.
- Q: How is a machine identified? → A: Environment selectors first
  (platform, distro, has a command); a hashed machine fingerprint only when
  one machine truly needs it; hostnames allowed.
- Q: Hostname selectors in a public repository? → A: Only in the private
  profile.d (proposed by Claude, not objected to).

### Session 2026-11-27 (first acceptance run on Debian 13)

- Q: The prompt didn't change after install. → A: snshah installs a pinned,
  SHA-256 checked Oh My Posh into the user's account when none is on PATH.
- Q: shah/shah should be in `~/workspaces`. → A: It is a built-in registry
  entry, and the bootstraps clone it there.
- Q: Doctor and updates? → A: Run `snshah doctor` the first time snshah runs
  in an interactive shell, and `snshah update --check` at least once an
  hour, with typed state.
- Q: Install advice? → A: Distribution-specific, not generic.

### Session 2026-11-27 (developer tools and SSH)

- Q: Which tool manager? → A: mise, on by default, configurable, with the
  README explaining it and how to turn it off (`toolManager: { kind: "none" }`).
- Q: Install the tools? → A: Yes: gh, ripgrep, fd, bat, fzf, jq, yq, delta and
  direnv. `bwrap` and `socat` stay distribution-package advice.
- Q: GitHub? → A: Suggest `gh`, and after first login explain how to sign in
  before GitHub quietly stops working.
- Q: SSH helpers? → A: `snshah ssh` shows keys, shows how to copy a key from
  Linux, macOS or Windows (only the client's OS when it can be told), and
  covers common cases. A password login gets a colored hint using the same
  text as `snshah ssh copy`.

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
9. **Given** a fresh Debian 13 account with no `oh-my-posh`, **when** the
   bootstrap runs and a new shell opens, **then** the snshah prompt shows,
   shah/shah is at `~/workspaces/github.com/shah/shah`, and that first
   shell prints `snshah doctor` once.
10. **Given** profiles in both profile.d directories, **when**
    `snshah plan --explain` runs, **then** it lists which profiles match
    this machine and which layer set each overridden value.

### Edge cases

- A startup file is a symlink (a dotfiles manager): the block is written
  to the link's target and the link stays.
- The user already has an alias or function with a Workshop name: theirs
  wins.
- A checkout has local changes or has diverged: `git update` skips it and
  says so.
- The private config has the wrong mode or owner: every command that reads
  it refuses until it is fixed.
- bash, zsh, fish and PowerShell 7 are exercised by the self-test, and
  `bootstrap.ps1` runs twice under PowerShell 7 on Linux. Native Windows
  behavior has not yet been exercised. [NEEDS CLARIFICATION: first run on
  a Windows 11 PC.]

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

### Profiles (profile.d)

- **FR-018**: snshah MUST load every `*.ts` file in `workshop/profile.d/`
  and `$XDG_CONFIG_HOME/snshah/profile.d/`, in name order. Each MUST export
  a typed `selector` and MAY export `config` and `hooks`; any other export
  MUST be refused. A private profile MUST be a regular file the user owns
  that is not group- or world-writable.
- **FR-019**: Layers MUST merge in this order, later winning: built-in
  defaults, matching repository profiles, `snshah.conf.ts`, matching
  private profiles. Secrets MUST come only from `snshah.conf.ts`.
- **FR-020**: `hostname` and `machine` selectors, and secrets in hook
  environments, MUST be refused in repository profiles.
- **FR-021**: A `command` hook MUST declare `unless`; it MUST run only while
  `unless` fails, and apply MUST fail if `unless` still fails after it runs.
  Its child gets a minimal environment plus the variables it lists.
- **FR-022**: `snshah whoami` MUST print the facts selectors match;
  `plan --explain` MUST show matches and overrides; `plan --as` MUST plan
  for given facts without reading this machine.

### First run on a machine

- **FR-023**: When the prompt is Oh My Posh and no `oh-my-posh` is on PATH,
  `apply` MUST install the pinned release, verified by SHA-256, into
  `$XDG_DATA_HOME/snshah/bin/` without `sudo`, unless the config sets
  `install: false`.
- **FR-024**: This repository MUST be a built-in registry entry, and the
  bootstraps MUST clone it to `$WORKSPACES_HOME/github.com/shah/shah` when
  `git` is present.
- **FR-025**: The first interactive shell after each install or upgrade MUST
  run `snshah doctor`, and interactive shells MUST start a background
  `snshah update --check` when the last check is over an hour old. Both MUST
  write only to stderr, MUST NOT fail a shell, and MUST record their state in
  the typed `$XDG_STATE_HOME/snshah/state.json`.
- **FR-026**: Install advice (doctor, the end of `apply`, the bootstraps)
  MUST name the distribution and give its exact command, using `su -c` when
  there is no `sudo`.

### Developer tools, GitHub and SSH

- **FR-027**: Unless the config sets `toolManager: { kind: "none" }`,
  `apply` MUST make mise available (the pinned, SHA-256 checked release in
  `$XDG_DATA_HOME/snshah/bin/` when none is on PATH, no `sudo`), write the
  tool list to `$XDG_CONFIG_HOME/mise/conf.d/snshah.toml`, run `mise install`
  last, and fail if a listed tool is still missing. A user's own mise
  `config.toml` wins. `tools: { name: false }` leaves a tool out.
- **FR-028**: The default tools MUST be gh, ripgrep, fd, bat, fzf, jq, yq,
  delta and direnv; `snshah shell` MUST activate mise and hook direnv for
  each supported shell.
- **FR-029**: `snshah doctor` MUST report whether GitHub is signed in and, if
  not, give the exact next step (`gh auth login --web --git-protocol https`
  then `gh auth setup-git`); interactive shells MUST remind at most once a
  day until signed in.
- **FR-030**: `snshah ssh` MUST provide status (default), keys, new, copy,
  authorize (file, stdin or `--github <user>`), authorized, test, harden and
  host add|list|remove. Every change MUST be idempotent, and `harden` MUST
  only print advice.
- **FR-031**: `ssh copy` MUST show only the client's OS when known (from
  `LC_SNSHAH_OS`, `SNSHAH_CLIENT_OS` or iTerm2's `LC_TERMINAL`), otherwise
  Linux, macOS and Windows, using the address from `SSH_CONNECTION`.
- **FR-032**: A login that used a password (from `SSH_USER_AUTH`, else the
  sshd log for that client address and port, else no authorized keys) MUST
  show a colored hint once per connection with the output of
  `snshah ssh copy`; `SNSHAH_SSH_HINT=0` MUST silence it.

### Model of record

- **FR-017**: `ontology/workshop.ttl` MUST state the Workshop's version,
  commands, platforms, shells, secret scopes, step kinds, selector and hook
  kinds, repository profiles, package managers, pinned dependencies and
  binaries, XDG paths, update-check interval and pinned Bun version, and
  `ontology/check.ts` MUST fail when any of them disagrees with the code.

## Key entities

- **Workshop** — `workshop/`: the CLI (`snshah.ts`), its self-test, the
  two bootstraps, the theme. Modeled as `ws:snshah`.
- **Profiles** — `workshop/profile.d/*.ts` (environment setups, public) and
  `$XDG_CONFIG_HOME/snshah/profile.d/*.ts` (this machine, private). Modeled
  as `ws:Profile`.
- **State** — `$XDG_STATE_HOME/snshah/state.json`: which version already
  ran doctor, and the last update check.
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

- [NEEDS CLARIFICATION: first run on a Windows 11 PC.]

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
| FR-018, FR-019, FR-021 | Shahid N. Shah, direct statement, 2026-11-27 (profile.d, type-safe merge, command hooks with env passthrough) |
| FR-020, FR-022 | Shahid N. Shah, direct statement, 2026-11-27 (environment selectors first, fingerprint when needed, hostnames allowed); private-only rule proposed by Claude |
| FR-023 | Shahid N. Shah, decision, 2026-11-27 ("Yes, pinned and checksummed") |
| FR-027 to FR-032 | Shahid N. Shah, direct statements, 2026-11-27 (mise, tools, GitHub sign-in, `snshah ssh`) |
| FR-024 to FR-026 | Shahid N. Shah, direct statements, 2026-11-27 (Debian 13 acceptance run) |
