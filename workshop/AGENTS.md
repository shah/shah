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
  and PowerShell 7) stay thin: require git, get Bun, clone or fast-forward
  the shah/shah checkout, run `apply` from it.
- The checkout is the source and git is required: no tarball download, no
  fallback, no migration or backward-compatibility code for earlier install
  methods. `update` is fetch, preview from a worktree, `merge --ff-only`,
  `apply`, and refuses on a dirty, detached or diverged checkout. The
  installed CLI is a copy; there is no `dev on|off` symlink mode.
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
- Detect and advise; never install system packages or use `sudo`. Advice
  names the distribution and gives its exact command (and `su -c` when there
  is no `sudo`), never "use your package manager". The only binaries snshah
  installs itself are pinned releases verified by SHA-256 into the user's
  account: Bun (bootstraps), Oh My Posh and mise (`apply`, `download` steps).
  Bumping either means new checksums from the release and the matching
  `ontology/workshop.ttl` value.
- `workshop/profile.d/*.ts` holds environment setups only. Each file exports
  a typed `selector` and `config` and/or `hooks`, and optionally `commands`
  (a command group whose code lives in `workshop/ext/` and loads lazily; keep
  the profile file thin). A `service` selector is allowed only on a
  commands-only profile, never alongside `config` or `hooks`. Never use
  `hostname` or `machine` selectors, or `env.secrets`, here: they belong in
  the private profile.d. Every file is listed as a `ws:Profile` in
  `ontology/workshop.ttl` with its top-level selector kind.
- Runtime state lives in `$XDG_STATE_HOME/snshah/state.json`, typed by
  `State` and validated on read; damaged state is treated as empty. Shell
  greetings (`snshah shell <shell> --greet`) write only to stderr and must
  never fail a shell.
- mise owns the developer tools. snshah owns only
  `$XDG_CONFIG_HOME/mise/conf.d/snshah.toml`; never touch the user's
  `config.toml`. The `tools` step (`mise install`) runs last. Bumping
  `miseRelease` needs every target's SHA-256 from the release's
  `SHASUMS256.txt` and the ontology's mise version. The self-test uses a stub
  `mise`, so the first real run on a machine is the true test of installs.
- The `snshah ssh` commands never run `sshd` changes: `harden` only prints.
- `.snshah.profile.ts` runs only after `snshah profile allow` records its
  SHA-256 in `state.json`, and then with NO limits on purpose (the owner's
  decision): do not add sandboxing, key allow-lists beyond what
  `snshah apply` owns, or ownership and mode rules. Keep the 🚨 danger text in
  `allow`, the help and the README. The shell hook (`renderDirHookPosix`,
  `renderDirHookFish`) must stay cheap: it may only `[ -f ]` up the tree and
  call `snshah profile load` when the list changes. `profile load` must never
  fail a shell, and the file's own stdout must go to stderr.
- Pin npm dependencies (`commander`, `chalk`, `@clack/prompts`) by exact
  version in `snshah.ts`. `snshah shell` and `snshah exec` must not load
  them.
- `snshah.omp.json` is the coach theme from
  github.com/strategy-coach/workspaces-host
  (`dot_config/oh-my-posh/coach.omp.json`), kept byte-for-byte. Don't edit
  or reformat it; `.prettierignore` keeps `bun fmt` away from it.
- Every command has an entry in `commandEffects` (a `Record<CommandName, …>`,
  so the compiler insists). A `query` command MUST take `--json`; the
  self-test checks it. Exit codes: 0 success, 1 failure, 2 usage error.
- Agent mode (`runningUnderAgent`) keeps `snshah shell` output plain and
  silent. `profile allow` must keep refusing under `detectedAgent`, which
  `SNSHAH_AGENT=0` can't switch off. The self-test strips agent variables
  from its environment (`baseEnv`); keep that list in step with
  `agentVariables`.
- `snshah vscode` only fills unset keys and never rewrites a settings file
  it can't parse as strict JSON. `snshah wt prune` only removes clean
  worktrees under `<repo>.wt/` whose remote branch is gone (or, with
  `--merged`, that are merged).
- `snshah efss` never handles a secret: sign-in is rclone's, `--set` refuses
  secret-looking keys, `connect` refuses under an agent, and `push` sends
  only with `--yes` (never from an agent) and deletes only with `--max-delete`.
- `snshah share` only reads and prints. Never make it write a service's
  configuration, and keep `print` refusing a subnet that isn't private.
- `signin`, `vault` and `ollama pull` involve things only the owner can do:
  never read a token, never accept or store a passphrase, and keep refusing
  an agent where the owner must type (`vault`, `ollama pull`, `agent start`).
- `omarchy-workstation` may only hold what any Omarchy owner could use:
  no work accounts, tenants or private URLs, and no default-browser change
  (that is a private profile). Keep its hooks idempotent.
- Shell extras (zoxide, fzf, Atuin, zsh plugins, ble.sh, PSReadLine) never
  load for an agent, never run `atuin login` or `register`, and fill Atuin's
  config only where unset. Atuin loads after fzf so Ctrl-R stays Atuin's.
  zsh plugin and ble.sh paths live in `zshPlugins` and `bleFiles`; the shell
  init and `doctor` share them.
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

When bash, zsh, fish or pwsh is installed, the self-test starts it
interactively in the temporary HOME and checks that its startup entry
loads the helpers, exports and secret wrapper. With `pwsh` it also runs
`bootstrap.ps1` twice (and with `--remote`, `irm | iex` twice). Native
Windows paths (`snshah.cmd`, user PATH, Windows PowerShell 5.1) still need
a real Windows 11 machine when they change.
