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

The bootstrap needs `git` (required, no fallback), `curl` or `wget`, and
`unzip` (macOS and Linux) or the tools that ship with Windows. If one is
missing it prints the install command for your distribution (for example
`sudo apt-get update && sudo apt-get install -y git` on Debian, `su -c '…'`
when you have no `sudo`, `winget install --id Git.Git -e` on Windows,
`xcode-select --install` on macOS). It:

1. Uses Bun 1.4 or newer if you have it. Otherwise it downloads the pinned
   Bun 1.4.4 release for your OS and CPU, checks its SHA-256, and installs
   it to `~/.bun`.
2. Clones shah/shah to `$WORKSPACES_HOME/github.com/shah/shah` (`~/Work` on
   Omarchy, else `~/workspaces`), or fast-forwards it when it is clean and
   on `main`. `$SNSHAH_REF` checks out a branch, tag or commit instead. It
   refuses a directory there that is some other repository.
3. Runs `snshah apply` from that checkout, which copies the CLI into
   `~/.local/share/snshah`, records a receipt (checkout path and commit),
   and ends by listing any missing tools with the install command for your
   distribution and package manager.

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

### Who is signed in: `snshah signin`

`snshah signin` (`--json` too) says whether GitHub, Codex, Claude and your
ssh-agent are signed in and prints the command to run for each one that
isn't. It reads exit codes and files, never a token, and the sign-in itself
is always yours.

### GitHub sign-in

`gh` is installed, but it can't sign in for you. After your first login run:

```sh
gh auth login --web --git-protocol https && gh auth setup-git
```

Do it before `git clone` or `git push` over HTTPS quietly fails. `snshah
doctor` shows whether you are signed in, and your shell reminds you once a
day until you are.

## Jumping around: `z`, `zi`, `cdz`

`zoxide` is a default tool. In every shell (not an agent's) `z fleet` jumps to
the directory matching "fleet" that you use most and most recently, `zi`
picks one interactively with `fzf`, and `cdz` is the same as `z`. `cd` itself
is left alone. `snshah apply` tells zoxide about your registered checkouts
(`snshah git list`) so they are found before you have visited them. For a
directory you've never been in, use `fzf`'s `Alt-C`. Turn it off with
`tools: { zoxide: false }`.

## History, pickers and fish-style editing

- **Atuin** (a default tool) owns Ctrl-R: searchable history with directory,
  exit status and duration. The up arrow keeps its stock behavior. `snshah
apply` fills only the Atuin settings you haven't set: no sync, no update
  check, compact style, secrets filtered out. snshah never signs you in; to
  sync across machines, run `atuin register` or `atuin login` yourself.
- **fzf** pickers: Ctrl-T for files, Alt-C to jump to any directory with a tree
  preview, using `fd` as the source (your own `FZF_*` settings win).
- **zsh**: if installed, fzf-tab, zsh-autosuggestions and
  zsh-syntax-highlighting are loaded for you; `snshah doctor` says which are
  missing.
- **bash**: for suggestions and highlighting as in fish, install
  [ble.sh](https://github.com/akinomyoga/ble.sh) and set
  `env: { SNSHAH_BLE: "1" }`. It is opt-in because it slows shell startup.
- **PowerShell**: list-view predictions from history (PSReadLine 2.2+).
- Agent shells get none of this. Turn Atuin or fzf off with
  `tools: { atuin: false }` or `tools: { fzf: false }`.

## What each profile does: `snshah profile catalog`

`workshop/profile.d/` holds the profiles that adapt snshah to a machine (a
distribution, Omarchy, a file server, VS Code, local models). To see them:

```sh
snshah profile catalog            # all of them: active here, and what turns the others on
snshah profile catalog share      # one in full: what it adds, how to use it, how to turn it on
snshah profile catalog share --docs   # its full guide, read offline
```

Each profile has a guide, `profile.d/<name>.ts.md`, linked from the catalog on
GitHub at the revision you have installed. A profile that needs something
installed (Samba, rclone, age) lists package names per package manager, and the
catalog prints the exact command for your machine. It prints it and never runs
it, because installing a system service needs sudo and a decision. Your own
profiles in `~/.config/snshah/profile.d/` show up too; add an `about` export and
a `<name>.ts.md` beside the file and they get the same treatment.

## Agents, local models and backups

- `snshah agent status` lists the agent CLIs (`claude`, `codex`) you have.
  `snshah agent start claude feat/login` creates (or finds) that branch's
  worktree next to the repository and starts the agent in it, so parallel
  agents never share a checkout. It won't start an agent from inside an agent.
- `snshah ollama status | pull <model>` (where `ollama` is on PATH) shows
  whether the server answers and which models it has, and pulls one. Pulls
  are for your own terminal.
- `snshah vault status | backup | verify <file> | restore <file>` (where `age`
  is on PATH) keeps an age passphrase-encrypted snapshot of `snshah.conf.ts`.
  age asks for the passphrase on your terminal, so snshah never sees it;
  `backup` does nothing when the config hasn't changed; `restore` previews
  until `--yes` and keeps the file it replaces as `.before-restore`. Keep a
  copy of the snapshot off this machine: the passphrase isn't stored anywhere.
- `snshah config edit` with VS Code as your editor opens the config through a
  generated workspace with auto-save, hot exit and local history off, so
  copies of it don't pile up in editor caches.

## File sync: `snshah efss`

Where `rclone` is on your PATH, `snshah efss` mirrors cloud and network
folders to ordinary local folders. There is no FUSE: nothing is mounted,
`pull` brings files down and `push` sends them up, so a stalled network
never freezes your shell. (Get rclone with `tools: { rclone: "latest" }` in
`snshah.conf.ts` and `snshah apply`, or your package manager.)

```sh
snshah efss connect onedrive                 # read-only by default; mirror in ~/efss/onedrive
snshah efss connect sharepoint team --read-write
snshah efss connect gdrive docs --folder /Projects
snshah efss connect sftp nas --set host=nas.example user=me
snshah efss pull onedrive                    # copies new and changed files; deletes nothing
snshah efss push team                        # previews; add --yes to send
snshah efss list | status [--online] | folder <name> | schedule <name> 6h | remove <name>
```

Providers: `onedrive`, `onedrive-business`, `sharepoint`, `gdrive`, `box`,
`dropbox`, `smb`, `sftp`, `webdav`. You choose `--read` (the default) or
`--read-write` when you connect. For OneDrive, SharePoint and Google Drive
the sign-in itself is limited to read-only; Box, Dropbox, SMB, SFTP and WebDAV
can't do that, so snshah refuses `push` on a read connection instead.

snshah never sees a password or token: rclone does the sign-in (a browser
window, or a prompt) and keeps it in `$XDG_CONFIG_HOME/snshah/rclone.conf`,
separate from any rclone setup of your own. `--set` takes non-secret rclone
options only. `connect` is for you in your own terminal; an agent is refused.
`pull --mirror` also deletes local files the provider lacks and previews until
`--yes`; `push --delete` needs `--max-delete <n>`. An agent may preview a push
but not send one. `schedule` pulls from a systemd user timer; elsewhere it
tells you to use your own scheduler. `remove` forgets the sign-in and keeps
your files: revoke the access in the provider's settings too.

## File servers: `snshah share`

On a machine with Samba (`smbd`) or an NFS server, `snshah share` looks and
prints; it never edits a service.

```sh
snshah share status                  # installed, running, what is shared
snshah share audit                   # exits 1 on a serious finding; --json too
snshah share audit --smb-conf ./smb.conf --exports ./exports   # another machine's files
snshah share print smb --path /srv/docs --subnet 192.168.1.0/24 --user me
snshah share print nfs --path /srv/docs --subnet 192.168.1.0/24 --read-write
```

`audit` flags SMB1 and NTLMv1, guest access, shares that anyone can write,
wide links, exports to everyone and `no_root_squash`. `print` gives a
read-only, no-guest, one-subnet share (or export) for you to paste, plus the
reload commands. It requires a private subnet and refuses anything wider.
Samba keeps its own passwords: you set them with `smbpasswd`, not snshah.

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
  (a command on PATH), `service` (installed or running; for command-only
  profiles), `exists` (a file or folder), `env`, `hostname`, `machine` (a hashed machine
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

### Omarchy workstation

On Omarchy with the Hyprland Lua configuration (`~/.config/hypr/hyprland.lua`),
`profile.d/omarchy-workstation.ts` adds an `snshah` entry to the Omarchy menu
(Doctor, Preview changes, Who is signed in, Update, Apply), a `SUPER + ALT + M`
binding that opens it, and Gmail, WhatsApp and Discord web apps, all in marked
blocks or files of its own. It also suggests `rclone` and `age` (see
`recommends` below). Your browser, work accounts and cloud folders are private,
so they go in `$XDG_CONFIG_HOME/snshah/profile.d/`:

```ts
// 50-omarchy-private.ts: Edge as the default browser, and a private web app
import type { Hook, Selector } from "../snshah.auto.d.ts";
export const selector = { kind: "omarchy" } satisfies Selector;
export const hooks = [
  {
    kind: "command",
    phase: "after-apply",
    run: ["omarchy", "default", "browser", "edge"],
    unless: [
      "sh",
      "-c",
      '[ "$(xdg-settings get default-web-browser)" = microsoft-edge.desktop ]',
    ],
  },
] satisfies Hook[];
```

For OneDrive or SharePoint use `snshah efss connect` instead of a mount.

### Recommendations and the `exists` selector

A profile can export `recommends = [{ tool, why }]`. `snshah doctor` lists
each as a warning when the tool is missing and installs nothing. The `exists`
selector (`{ kind: "exists", path: "~/.config/hypr/hyprland.lua" }`) matches
when a file or folder is there. A `block` hook with `within: "object"` puts
its block just inside a JSON or JSONC object, which is how the Omarchy menu
entries are added without disturbing yours.

### Profiles that contribute commands

A profile can also export `commands`, so a feature switches itself on where
its tool is, and the core stays lean. `profile.d/vscode.ts` is the model:

```ts
export const selector = { kind: "has", command: "code" } satisfies Selector;
export const commands = {
  group: "vscode", // snshah vscode
  summary: "Fill VS Code settings and list recommended extensions",
  effects: { "": "change" }, // every leaf command: query, change, advice, emit or run
  activatesWhen: "VS Code is here (`code` on PATH)",
  advice: "In VS Code: Shell Command: Install 'code' command in PATH.",
  load: () => import("../ext/vscode.ts"), // loads only when the group runs
} satisfies CommandGroup;
```

The module exports `register(group, api)` and adds its commands to the
group. Where the selector doesn't match, `snshah <group>` still shows in
`snshah commands` as inactive, and running it says when it turns on and
exits 2. Core commands never import these modules, and a profile with a
`service` selector may not also set `config` or `hooks`, because those run
at every shell start. Directory profiles can't contribute commands.

## Per-directory profiles: `.snshah.profile.ts`

Drop a `.snshah.profile.ts` in a project (or any directory) to change your
shell **while you are in that directory or below**. Leaving puts back the
aliases, variables and PATH it replaced. Nearer files beat farther ones.

```ts
import { sharedAliases } from "./tools/aliases.ts"; // anything, it is just TypeScript

export const selector = { kind: "always" }; // optional: platform, distro, has, env, hostname, machine, all, any, not
export const config = {
  aliases: { t: "bun test", ...sharedAliases },
  env: { APP_ENV: "development" },
  path: ["node_modules/.bin"], // relative to this file's directory
  onEnter: { posix: "echo entering", fish: "echo entering" }, // or a plain string
  onLeave: "echo leaving",
};
```

> 🚨 **Danger: a trusted file runs with no limits.** It is a TypeScript
> program that runs as you every time your shell enters its directory. It can
> read and change any file, run any command, use the network and see your
> environment and secrets. snshah puts no sandbox around it. The only
> protection is that it does not run until you read it and run
> `snshah profile allow`, and that **any edit makes it untrusted again** (the
> trust is a SHA-256 of its content, kept in `state.json`).

| Command                                                  | What it does                                                                                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `snshah profile init`                                    | Create a starter file here (never overwrites).                                                                                                       |
| `snshah profile list` (alias `ls`) `[--all] [--depth n]` | Finds files here, above and below, and shows which are trusted, not trusted or changed. `--all` also scans your workspaces and registered checkouts. |
| `snshah profile prune`                                   | Forget trust for files that no longer exist.                                                                                                         |
| `snshah profile allow` (alias `safe`) `[--yes]`          | 🚨 Show the file, then trust it to run with no limits.                                                                                               |
| `snshah profile deny`                                    | Stop trusting it.                                                                                                                                    |
| `snshah profile show` / `why <name>`                     | What applies here, and which file set it.                                                                                                            |
| `snshah profile check`                                   | Validate a trusted file (this runs it).                                                                                                              |

An untrusted or changed file costs your shell one notice line and nothing
else. Only `aliases`, `env`, `path`, `onEnter` and `onLeave` make sense per
directory: `tools`, `prompt`, `agents` and the like are applied by
`snshah apply` for the whole machine, so a directory profile that sets them
is refused with that reason. Anything the file prints goes to stderr so it
can't corrupt the shell. Works in bash, zsh and fish; PowerShell does not
load them yet (`snshah profile list` still works there). The hook looks for
the file once per directory change, so it is cheap.

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

| Command                                                                   | What it does                                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `snshah plan [--json] [--explain] [--as FACTS]`                           | Show what `apply` would change. Read-only.                                                        |
| `snshah whoami [--json]`                                                  | Print the facts profile selectors match against.                                                  |
| `snshah apply [--yes] [--json]`                                           | Bring this machine to the desired state.                                                          |
| `snshah doctor [--json]`                                                  | Check tools and print install commands for this distribution and package manager.                 |
| `snshah context [--json]`                                                 | Where am I? OS, shell, tools, git state, profiles, sandbox, problems.                             |
| `snshah commands [--json]`                                                | Every command, what it does to the machine, and whether it takes `--json`.                        |
| `snshah efss connect\|list\|status\|pull\|push\|folder\|schedule\|remove` | Mirror cloud and network folders with rclone (present where rclone is). See File sync.            |
| `snshah share status\|audit\|print`                                       | Audit Samba and NFS, print safe subnet-scoped config. Present where a file server is.             |
| `snshah signin [--json]`                                                  | Who is signed in (GitHub, Codex, Claude, ssh-agent) and the command to sign in.                   |
| `snshah agent status\|start`                                              | Agent CLIs installed; start one on its own branch worktree.                                       |
| `snshah ollama status\|pull`                                              | Local models. Present where ollama is.                                                            |
| `snshah vault status\|backup\|verify\|restore`                            | age-encrypted config snapshot. Present where age is.                                              |
| `snshah vscode [--yes] [--json]`                                          | Fill VS Code settings (fill-only), list extensions. Present where VS Code is (a profile command). |
| `snshah wt new\|ls\|prune`                                                | Git worktrees next to the repository, one per branch.                                             |
| `snshah shell <shell> [--greet]`                                          | Print init code for bash, zsh, fish or pwsh.                                                      |
| `snshah exec <command> [args]`                                            | Run a command with its command-scoped secrets.                                                    |
| `snshah config path\|check\|edit\|set-secret`                             | Manage the private config.                                                                        |
| `snshah git root\|add\|list\|path\|clone\|update\|remove`                 | Manage checkouts.                                                                                 |
| `snshah ssh <subcommand>`                                                 | SSH keys, key copying and hosts (see above).                                                      |
| `snshah update [--check [--quiet]] [--yes] [--ref REF]`                   | Fetch the checkout, preview, fast-forward, apply. `--check` only says whether one is newer.       |
| `snshah uninstall [--yes] [--purge]`                                      | Remove snshah. Lists what would go; `--yes` does it; `--purge` also deletes your private config.  |
| `snshah test [--remote REF]`                                              | Self-test in a temporary HOME.                                                                    |

`snshah update` runs `git fetch` in the install checkout, shows the plan the
new commit would make (from a temporary worktree), asks, fast-forwards the
checkout, and applies from it. The new CLI replaces the old one only after
the rest of the apply succeeds. It refuses and says why when the checkout
has uncommitted changes, is detached, is on another branch, or has diverged
from origin. `update --check` only asks origin. The installed CLI is a copy,
not a symlink, so a half-finished edit in the checkout never breaks your
shell; it changes when you run `snshah apply` or `snshah update`.

## For AI agents and VS Code

snshah is built for CLI work that agents and editors share with you.

**Agent mode.** When a shell is started by an agent (Claude Code, Codex,
Cursor: any variable in `agentVariables`, or `SNSHAH_AGENT=1`), `snshah shell`
leaves out the `ls`/`tree` eza aliases and the prompt theme, defaults
`GIT_PAGER=cat`, `PAGER=cat` and `GIT_TERMINAL_PROMPT=0`, and the greeting
stays silent, so the output an agent reads is plain. `SNSHAH_AGENT=0` turns
it off.

**Agents can't trust profiles.** `snshah profile allow` refuses when an agent
is detected, even with `--yes` or `SNSHAH_AGENT=0`: trusting a
`.snshah.profile.ts` runs code as you with no limits, so only you do it, in
your own terminal. This is a guardrail against accidents, not a sandbox; an
agent with a shell can already do anything you can.

**One call instead of probing.** `snshah context --json` says where it is:
OS, distribution, shell, working directory, workspaces root, git state, tool
versions, problems (each with what to do), directory profiles and whether
they are trusted, and whether the sandbox prerequisites (`bwrap`, `socat`)
are present. The guidance block `apply` adds to Claude Code's and Codex's
instruction files tells agents to run it once.

**Machine-readable help.** `snshah commands --json` lists every command with
its options and its effect: `query` (prints facts; always takes `--json`),
`change` (writes files or state; previews or is idempotent), `advice` (only
prints instructions), `emit` (shell code, or runs another command) and `run`
(the self-test). Exit codes: 0 success, 1 failure (for `doctor`, something
required is missing), 2 you used it wrongly. Every command is safe to re-run,
and a second run reports "No changes needed."

**Worktrees for parallel agents.** One checkout can't safely hold several
agents' work. `snshah wt new feat/x` creates `<repo>.wt/feat-x` on a new
branch (or finds it again), `snshah wt ls` shows each with uncommitted and
merged markers, and `snshah wt prune` removes the clean ones whose remote
branch was deleted (what a merged pull request leaves behind); it previews
unless you add `--yes`, and `--merged` also includes branches merged locally.
Worktrees sit next to the repository under `$WORKSPACES_HOME`, so
`snshah profile list --all` and your editor find them.

**VS Code.** `snshah vscode` previews, and `--yes` writes, VS Code user
settings it only fills when you haven't set them: the Nerd Font terminal
font, shell integration, scrollback, and final newline and trailing
whitespace handling. A settings file with comments is never rewritten; it
prints the keys for you to add. It also lists recommended extensions that are
missing (Claude Code, Bun, direnv, TOML, YAML) as `code --install-extension`
lines. Over SSH it fills the server's Machine settings instead (no terminal
font: the VS Code on your own computer draws that, so run it there too). The
command exists where VS Code does (`code` on PATH or a VS Code terminal).

**CI.** `.github/workflows/workshop.yml` runs the format check, the
self-test and the ontology check on Linux, macOS and Windows. The Windows job
reports but doesn't block until it has passed once.

## Removing snshah

```sh
snshah uninstall                 # lists what would be removed; changes nothing
snshah uninstall --yes           # removes it
snshah uninstall --yes --purge   # also deletes your private config (and its secrets)
```

It removes snshah's marked blocks from your startup files (and the guidance
blocks in Claude Code's and Codex's instruction files), the fish startup
file, the launcher, the installed copy (with the Oh My Posh and mise that
snshah downloaded), state, the download cache and snshah's mise tool list.
It never touches your own lines in those files. It leaves your private
config (unless `--purge`), the git checkout (it prints the `rm -rf` line),
Bun, tools mise installed, `~/.ssh`, and settings snshah filled in for
Claude Code or Codex. Running it twice is harmless. Open a new shell after.

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
