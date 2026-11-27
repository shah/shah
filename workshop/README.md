# Workshop

My shell and "creature comforts" for all work that I do at the CLI.

`snshah` is one strongly typed TypeScript file run by [Bun](https://bun.sh)
1.4+. It works on any Linux distribution, WSL, macOS and Windows 11+, and it
installs only in your user account (no `sudo`, no admin). Every command is
safe to re-run: `plan` is read-only, and a second `apply` or bootstrap
reports **No changes needed.**

The specification is
[`spec-kit/specs/0003-workshop/spec.md`](../spec-kit/specs/0003-workshop/spec.md)
and the model of record is [`ontology/workshop.ttl`](../ontology/workshop.ttl).

## Install

Linux, WSL or macOS:

```sh
curl -fsSL https://raw.githubusercontent.com/shah/shah/main/workshop/bootstrap.sh | sh
```

Windows 11+ (PowerShell):

```powershell
irm https://raw.githubusercontent.com/shah/shah/main/workshop/bootstrap.ps1 | iex
```

From a checkout, run `sh workshop/bootstrap.sh` or `.\workshop\bootstrap.ps1`.

The bootstrap needs `curl` or `wget`, `tar`, and `unzip` (macOS and Linux)
or the tools that ship with Windows. If one is missing it prints the install
command for your distribution (for example
`sudo apt-get update && sudo apt-get install -y unzip` on Debian, or
`su -c '…'` when you have no `sudo`). It:

1. Uses Bun 1.4 or newer if you have it. Otherwise it downloads the pinned
   Bun 1.4.4 release for your OS and CPU, checks its SHA-256, and installs
   it to `~/.bun`.
2. Resolves `main` (or `$SNSHAH_REF`) to one commit and downloads only that
   commit.
3. When `git` is present, clones shah/shah to
   `$WORKSPACES_HOME/github.com/shah/shah` (skip with `SNSHAH_CLONE=0`).
   If that checkout is clean and at the same commit, it installs from it.
4. Runs `snshah apply`, which ends by listing any missing tools with the
   install command for your distribution and package manager.

Open a new shell afterwards. The first interactive shell runs
`snshah doctor` once. snshah never installs system packages; the only
binaries it installs itself are pinned, checksummed user-space releases
(Bun from the bootstrap, Oh My Posh from `apply`).

## What `apply` sets up

| What                                           | Where                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| The CLI and its launcher                       | `$XDG_DATA_HOME/snshah/`, `~/.local/bin/snshah` (plus `snshah.cmd` on Windows)                                           |
| Private typed config (mode 0600, never in Git) | `$XDG_CONFIG_HOME/snshah/snshah.conf.ts` and its generated `snshah.auto.d.ts`                                            |
| Oh My Posh theme                               | `$XDG_DATA_HOME/snshah/snshah.omp.json`, from [`snshah.omp.json`](snshah.omp.json) (the coach theme, unmodified)         |
| Oh My Posh 33.4.1, only if none is on PATH     | `$XDG_DATA_HOME/snshah/bin/oh-my-posh`, SHA-256 checked (turn off with `prompt: { kind: "oh-my-posh", install: false }`) |
| mise 2026.11.14, only if none is on PATH       | `$XDG_DATA_HOME/snshah/bin/mise`, SHA-256 checked (see [Developer tools](#developer-tools-mise))                         |
| Your developer tools                           | `$XDG_CONFIG_HOME/mise/conf.d/snshah.toml`, installed by `mise install` as the last step                                 |
| Profiles from this repository                  | `$XDG_DATA_HOME/snshah/profile.d/`, from [`profile.d/`](profile.d/)                                                      |
| Install receipt, lock and `state.json`         | `$XDG_STATE_HOME/snshah/`                                                                                                |
| Download cache                                 | `$XDG_CACHE_HOME/snshah/`                                                                                                |
| Workspaces root and this repository's checkout | `$WORKSPACES_HOME`, default `~/workspaces` (`~/Work` on Omarchy); `snshah git clone shah`                                |
| One marked startup block per shell             | `~/.bashrc`, `${ZDOTDIR:-~}/.zshrc`, your PowerShell profile, and `$XDG_CONFIG_HOME/fish/conf.d/snshah.fish`             |
| Claude Code and Codex user defaults            | Fills only unset keys in `~/.claude/settings.json` and `~/.codex/config.toml`, plus a short guidance block               |

Paths follow the XDG Base Directory spec strictly, on every OS including
macOS and Windows: an unset or relative `XDG_*` variable falls back to
`~/.config`, `~/.local/share`, `~/.local/state` and `~/.cache`, never to
`~/Library` or `%APPDATA%`.

## Developer tools (mise)

[mise](https://mise.jdx.dev) is on by default. It installs developer tools
into your account (no `sudo`) and keeps them current, on every OS. `apply`
installs mise if it is missing, writes the tool list to
`$XDG_CONFIG_HOME/mise/conf.d/snshah.toml` (your own `config.toml` wins), and
runs `mise install`. It fails loudly if a tool is still missing.

Default tools: `gh`, `ripgrep`, `fd`, `bat`, `fzf`, `jq`, `yq`, `delta`,
`direnv` and `eza`. `snshah shell` activates mise and hooks direnv, so a `.envrc` in
a project just works (`direnv allow` once). Change it in your private config:

```ts
export default {
  tools: { delta: false, node: "lts" }, // drop one, add one
  // toolManager: { kind: "none" },     // turn mise and the tool list off
};
```

`bwrap` and `socat` (needed by Claude Code's sandbox) are system packages, so
`snshah doctor` advises them for your distribution instead. mise and direnv
are not yet tested on native Windows.

### `eza`: `ls` and `tree` with colors and icons

`eza` is the maintained fork of `exa`, so `exa` is an alias for it. When it is
installed, `ls`, `ll`, `la` and `tree` use it with colors, git status, folders
first and icons (`tree` skips what `.gitignore` skips; add `-L 2` to limit the
depth). Icons need a [Nerd Font](#prompt-icons-nerd-fonts): say
`snshah ux fonts missing` and they drop out. An alias you set yourself in
`aliases` is never replaced, and `tools: { eza: false }` turns it all off.

### GitHub sign-in

`gh` is installed, but it can't sign in for you. After your first login run:

```sh
gh auth login --web --git-protocol https && gh auth setup-git
```

Do it before `git clone` or `git push` over HTTPS quietly fails. `snshah
doctor` shows whether you are signed in, and your shell reminds you once a
day until you are.

## Prompt icons: Nerd Fonts

The prompt draws icons from a [Nerd Font](https://www.nerdfonts.com). If your
terminal shows boxes or `?` where they belong, it is using a font without
them. A program can't ask a terminal which font it has, so `snshah doctor`
shows **unknown** until you say otherwise, or it finds evidence on its own
(Windows' font list and Windows Terminal's settings, also from WSL; `fc-list`
and the font folders on Linux and macOS).

| Command                                 | What it does                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `snshah ux fonts`                       | Show the state and how snshah knows.                                          |
| `snshah ux fonts installed` / `missing` | Record what you see. `reset` forgets it.                                      |
| `snshah ux fonts install [--run]`       | Show (or run) `oh-my-posh font install Meslo`; then pick it in your terminal. |

Run `installed` on the machine whose terminal you look at. Its shell then
sends `LC_SNSHAH_FONTS` over SSH, so servers you log in to know too.

## SSH helpers

| Command                                       | What it does                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| `snshah ssh [status]`                         | How you logged in, from where, and the keys involved.                          |
| `snshah ssh keys` / `new`                     | List your public keys with fingerprints / create an ed25519 key.               |
| `snshah ssh copy [target] [--os OS] [--run]`  | How to copy a key to this machine from Linux, macOS or Windows.                |
| `snshah ssh authorize [file] [--github USER]` | Add a public key to `authorized_keys`, once.                                   |
| `snshah ssh authorized`                       | Which keys can log in here.                                                    |
| `snshah ssh test <target>`                    | Check key login to a target.                                                   |
| `snshah ssh harden`                           | Prints the sshd changes that turn off passwords. Advice only; never runs them. |
| `snshah ssh host add\|list\|remove`           | Manage marked `Host` blocks in `~/.ssh/config`.                                |

`copy` shows only the client's OS when it knows it. snshah's shell init exports
`LC_SNSHAH_OS`, which default `ssh` and `sshd` configs already send and accept;
otherwise it shows all three. If you log in with a password, the shell shows a
short colored hint, once per connection, that points to `snshah ssh copy` for the per-OS steps.
Detection uses `SSH_USER_AUTH` (`ExposeAuthInfo yes` makes it exact; `snshah doctor` prints the exact `sudo` line when the method is unknown), else the
sshd log, else "no authorized keys". `SNSHAH_SSH_HINT=0` silences the hint, and
`SNSHAH_GREET=0` silences all greetings.

## Minimal shell pollution: `snshah shell`

Your startup file gets exactly one marked block that runs
`snshah shell <bash|zsh|fish|pwsh>` and evaluates what it prints. Everything
else is generated at shell start:

- PATH entries for `~/.local/bin`, `~/.bun/bin` and your configured `path`,
  added only when missing.
- `WORKSPACES_HOME`, exported only when unset.
- Aliases (`ll`, `gs`, `gd`, `gds`, `gl` and your own) and a `mkcd`
  function, each defined only if you don't already have one by that name.
- Wrapper functions for commands that have command-scoped secrets.
- Shell-scoped secrets as exports.
- The Oh My Posh prompt: the `oh-my-posh` on your PATH if you have one,
  otherwise the copy `apply` installed.

The startup block passes `--greet`, which adds two things on stderr only.
The first interactive shell after each install or upgrade runs
`snshah doctor`. And at most once an hour a shell starts
`snshah update --check --quiet` in the background; the next shell says when
an update is available. Both are recorded in
`$XDG_STATE_HOME/snshah/state.json`, a typed file that snshah validates on
read and treats as empty if it is damaged. Set `SNSHAH_GREET=0` to turn this
off.

Delete the block and your shell is back to how it was. `snshah shell` and
`snshah exec` load no npm packages, so shell start stays fast.

## Profiles: `profile.d`

Setups for an environment ("on Omarchy do this", "on Fedora do that") live
in [`profile.d/`](profile.d/) in this repository. Setups for one machine,
or anything personal, live in `$XDG_CONFIG_HOME/snshah/profile.d/`. snshah
picks up every `*.ts` file in both, in name order. Each file exports a typed
`selector` and a `config` contribution, `hooks`, or both:

```ts
// $XDG_CONFIG_HOME/snshah/profile.d/50-this-machine.ts
import type { Contribution, Hook, Selector } from "../snshah.auto.d.ts";

export const selector = {
  kind: "all",
  of: [
    { kind: "distro", id: "debian" },
    { kind: "has", command: "docker" },
  ],
} satisfies Selector;

export const config = { aliases: { dps: "docker ps" } } satisfies Contribution;

export const hooks = [
  {
    kind: "command",
    phase: "after-apply",
    run: ["systemctl", "--user", "enable", "--now", "podman.socket"],
    unless: ["systemctl", "--user", "is-enabled", "podman.socket"],
    env: { pass: ["DBUS_SESSION_BUS_ADDRESS"] },
  },
] satisfies Hook[];
```

- **Selectors** are `always`, `platform`, `distro`, `omarchy`, `has`
  (a command on PATH), `env`, `hostname`, `machine` (a hashed machine
  fingerprint, see `snshah whoami`), and `all`, `any`, `not` to combine
  them. `hostname` and `machine` are allowed only in the private
  directory, because this repository is public.
- **Merge order**, later wins: built-in defaults, matching repository
  profiles, `snshah.conf.ts`, matching private profiles. Aliases and agents
  merge by key, `path` is concatenated without duplicates, repositories
  merge by name. Secrets come only from `snshah.conf.ts`.
- **Hooks** are a `file` the profile owns, a marked `block` in a file you
  own, or a `command` that runs before or after apply only while its
  required `unless` check fails. A command gets a minimal environment plus
  the variables it lists in `pass`, `set` and (private profiles only)
  `secrets`.
- `snshah whoami` prints the facts selectors match against.
  `snshah plan --explain` shows which profiles match and which layer set
  each value. `snshah plan --as facts.json` plans as if on another machine.

## Per-directory profiles: `.snshah.path.ts`

Drop a `.snshah.path.ts` in a project (or any directory) to set aliases,
environment variables and PATH entries **while your shell is in that
directory or below**. Leaving puts back what it replaced. Nearer files beat
farther ones.

```ts
export const selector = { kind: "always" }; // optional: platform, distro, has, env, all, any, not
export const config = {
  aliases: { t: "bun test" },
  env: { APP_ENV: "development" },
  path: ["node_modules/.bin"], // relative to this file's directory
};
```

It is code, so snshah ignores it until you trust it, as direnv does:

| Command                                         | What it does                                                  |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `snshah profile init`                           | Create a starter file here (never overwrites).                |
| `snshah profile list`                           | The files that apply here, and whether each is trusted.       |
| `snshah profile allow` (alias `safe`) `[--yes]` | Show the file, then trust its SHA-256. Any edit un-trusts it. |
| `snshah profile deny`                           | Stop trusting it.                                             |
| `snshah profile show` / `why <name>`            | What applies here, and which file set it.                     |
| `snshah profile check`                          | Validate a trusted file.                                      |

Untrusted or changed files cost your shell one notice line and nothing else.
A file may set only `aliases`, `env` and `path`, no commands or secrets, and
must be self-contained (type imports only). Works in bash, zsh and fish;
PowerShell does not load them yet (`snshah profile list` still works there).
The hook looks for the file once per directory change, so it is cheap.

## Private config

```ts
// $XDG_CONFIG_HOME/snshah/snshah.conf.ts
export default {
  path: ["~/bin"],
  aliases: {
    k: "kubectl",
    ll: { posix: "ls -alh", pwsh: "Get-ChildItem -Force" },
  },
  prompt: { kind: "oh-my-posh" }, // or { kind: "none" }, or { kind: "oh-my-posh", theme: "~/my.omp.json" }
  agents: { claude: { kind: "defaults" }, codex: { kind: "off" } },
  secrets,
  repositories,
} satisfies WorkshopConfig;
```

The types are tagged unions, so your editor flags a wrong `kind` before
snshah runs. `snshah config edit` opens it in `$VISUAL` or `$EDITOR` and
checks it afterwards. `snshah config check` validates it and never prints
secret values.

### Secrets

```sh
snshah config set-secret OPENAI_API_KEY --scope command --commands codex
snshah config set-secret GITHUB_TOKEN --scope shell
```

The value is read without echo (or from `--stdin`) and never appears in a
command line. A **command** secret reaches only the listed commands, through
`snshah exec <command>` or the wrapper function `snshah shell` defines for
it. A **shell** secret is also exported into every interactive shell. Setting
the same value again changes nothing.

## Git checkouts

```sh
snshah git add shah/shah                       # GitHub owner/repo
snshah git add git@gitlab.com:team/app.git     # any Git URL
snshah git add ./existing-checkout --in-place  # register where it is
snshah git list
snshah git clone --all                         # restore missing checkouts on a new machine
snshah git update --all                        # fast-forward clean checkouts
cd "$(snshah git path shah)"
```

Checkouts go to `$WORKSPACES_HOME/<host>/<owner>/<repo>`, and local sources
to `$WORKSPACES_HOME/local/<repo>`. The registry lives in your private
config and profiles. This repository is always registered as `shah`, so
the bootstrap and `snshah git clone shah` put it in
`$WORKSPACES_HOME/github.com/shah/shah`. Dirty or diverged checkouts are skipped, never changed.
`snshah git remove` unregisters and leaves the files.

## Commands

| Command                                                   | What it does                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `snshah plan [--json] [--explain] [--as FACTS]`           | Show what `apply` would change. Read-only.                                                 |
| `snshah whoami [--json]`                                  | Print the facts profile selectors match against.                                           |
| `snshah apply [--yes] [--json]`                           | Bring this machine to the desired state.                                                   |
| `snshah doctor [--json]`                                  | Check tools and print install commands for this distribution and package manager.          |
| `snshah shell <shell> [--greet]`                          | Print init code for bash, zsh, fish or pwsh.                                               |
| `snshah exec <command> [args]`                            | Run a command with its command-scoped secrets.                                             |
| `snshah config path\|check\|edit\|set-secret`             | Manage the private config.                                                                 |
| `snshah git root\|add\|list\|path\|clone\|update\|remove` | Manage checkouts.                                                                          |
| `snshah ssh <subcommand>`                                 | SSH keys, key copying and hosts (see above).                                               |
| `snshah update [--check [--quiet]] [--yes] [--ref REF]`   | Preview, then apply, one pinned upstream commit. `--check` only says whether one is newer. |
| `snshah test [--remote REF]`                              | Self-test in a temporary HOME.                                                             |

`snshah update` resolves `main` to a commit, shows that candidate's plan,
asks, and applies it. The new CLI replaces the old one only after the rest
of the apply succeeds.

**Picking up changes in the shell you are in.** A program can't change its
parent shell, so in bash, zsh and fish `snshah` is a small shell function
that, after a successful `snshah update` or `snshah apply`, re-sources
snshah's init in that shell (`--check`, `--json` and `--help` don't). New
aliases, tools, PATH entries and prompt changes show up at once. An alias
you changed (rather than added) keeps its old definition until a new shell,
because init never overrides what you already have. PowerShell can't define
that function safely, and a shell where the function isn't loaded yet (the
first update from an older version) gets the exact line to run instead:
`eval "$(snshah shell bash)"`, `snshah shell fish | source` or
`snshah shell pwsh | Out-String | Invoke-Expression`. Logging out and in
always works.

## Maintaining it

See [`AGENTS.md`](AGENTS.md).
