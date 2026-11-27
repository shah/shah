# Maintaining the Workshop

Rules for a person or an AI agent changing anything in `workshop/`.

## Public repository

- github.com/shah/shah is public. Never commit secrets, tokens, personal
  email addresses, hostnames, IP addresses, network details or anything
  about a specific machine. Examples use `example.invalid` and placeholders.
- Personal values belong only in the private config
  (`$XDG_CONFIG_HOME/snshah/snshah.conf.ts`). Never read it into tests,
  screenshots, diagnostics or commits. Output paths with `~`, not a home
  directory that names an account.

## Design rules

- Keep behavior in `snshah.ts` and the self-test in `snshah.selftest.ts`.
  `bootstrap.sh` (POSIX `sh`) and `bootstrap.ps1` (Windows PowerShell 5.1
  and PowerShell 7) stay thin: get Bun, pin one commit, run `apply`.
- Model choices as tagged unions (`kind` fields) and handle them with
  exhaustive `switch` statements ending in `assertNever`.
- Every command must be idempotent. `plan` computes only the steps that
  differ from disk; `apply` writes them atomically; a second `apply`,
  bootstrap, `git` or `config set-secret` with the same input changes
  nothing. Never overwrite the private config after seeding it, and fill
  only unset keys in other tools' settings.
- Paths follow the XDG Base Directory spec strictly on every OS.
- Startup files get one marked block. Everything else comes from
  `snshah shell`, guarded so it never overrides what the user already has.
- Detect and advise; never install system packages or use `sudo`.
- Pin npm dependencies (`commander`, `chalk`, `@clack/prompts`) by exact
  version in `snshah.ts`. `snshah shell` and `snshah exec` must not load
  them.
- Install the CLI files last, so a failed apply keeps the old CLI working.

## Before every push

1. Bun 1.4.4 or newer: `bun fmt --check workshop ontology` passes (run
   `bun fmt` first if it doesn't).
2. `bun --no-env-file workshop/snshah.ts test` passes. It runs plan, apply
   and every command twice in a temporary HOME and fails if a second run
   changes anything. `SNSHAH_SHELLS=bash,zsh,fish,pwsh` forces all four
   startup files there.
3. `bun --no-env-file ontology/check.ts` passes. When you change the
   version, commands, shells, platforms, step kinds, paths or pinned
   dependencies, change `ontology/workshop.ttl` in the same commit.
4. Bump `cliVersion` in `snshah.ts` (semver: patch for fixes and docs,
   minor for features while 0.x) and the matching `ws:version` in
   `ontology/workshop.ttl`.
5. After pushing a branch, `snshah test --remote <branch>` installs it from
   GitHub with `bootstrap.sh`, twice.

The Windows bootstrap and the zsh, fish and pwsh init code are checked by
the self-test only as text unless those shells are installed. Test them on
a real Windows 11 machine when they change.
