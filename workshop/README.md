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
or the tools that ship with Windows. It:

1. Uses Bun 1.4 or newer if you have it. Otherwise it downloads the pinned
   Bun 1.4.4 release for your OS and CPU, checks its SHA-256, and installs
   it to `~/.bun`.
2. Resolves `main` (or `$SNSHAH_REF`) to one commit, downloads only that
   commit, and runs `snshah apply` from it.

Open a new shell afterwards. Run `snshah doctor` to see which optional tools
are missing and the exact install command for your package manager. snshah
never installs packages for you.

## What `apply` sets up

| What                                           | Where                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| The CLI and its launcher                       | `$XDG_DATA_HOME/snshah/`, `~/.local/bin/snshah` (plus `snshah.cmd` on Windows)                               |
| Private typed config (mode 0600, never in Git) | `$XDG_CONFIG_HOME/snshah/snshah.conf.ts` and its generated `snshah.auto.d.ts`                                |
| Oh My Posh theme                               | `$XDG_DATA_HOME/snshah/snshah.omp.json`, from [`snshah.omp.json`](snshah.omp.json)                           |
| Install receipt and lock                       | `$XDG_STATE_HOME/snshah/`                                                                                    |
| Download cache                                 | `$XDG_CACHE_HOME/snshah/`                                                                                    |
| Workspaces root                                | `$WORKSPACES_HOME`, default `~/workspaces` (`~/Work` on Omarchy)                                             |
| One marked startup block per shell             | `~/.bashrc`, `${ZDOTDIR:-~}/.zshrc`, your PowerShell profile, and `$XDG_CONFIG_HOME/fish/conf.d/snshah.fish` |
| Claude Code and Codex user defaults            | Fills only unset keys in `~/.claude/settings.json` and `~/.codex/config.toml`, plus a short guidance block   |

Paths follow the XDG Base Directory spec strictly, on every OS including
macOS and Windows: an unset or relative `XDG_*` variable falls back to
`~/.config`, `~/.local/share`, `~/.local/state` and `~/.cache`, never to
`~/Library` or `%APPDATA%`.

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
- The Oh My Posh prompt, only if `oh-my-posh` is installed.

Delete the block and your shell is back to how it was. `snshah shell` and
`snshah exec` load no npm packages, so shell start stays fast.

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
config. Dirty or diverged checkouts are skipped, never changed.
`snshah git remove` unregisters and leaves the files.

## Commands

| Command                                                   | What it does                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `snshah plan [--json]`                                    | Show what `apply` would change. Read-only.                                                       |
| `snshah apply [--yes] [--json]`                           | Bring this machine to the desired state.                                                         |
| `snshah doctor [--json]`                                  | Check tools and print install advice for apt, dnf, pacman, apk, zypper, brew, winget or Omarchy. |
| `snshah shell <shell>`                                    | Print init code for bash, zsh, fish or pwsh.                                                     |
| `snshah exec <command> [args]`                            | Run a command with its command-scoped secrets.                                                   |
| `snshah config path\|check\|edit\|set-secret`             | Manage the private config.                                                                       |
| `snshah git root\|add\|list\|path\|clone\|update\|remove` | Manage checkouts.                                                                                |
| `snshah update [--check] [--yes] [--ref REF]`             | Preview, then apply, one pinned upstream commit. Up to date means no change.                     |
| `snshah test [--remote REF]`                              | Self-test in a temporary HOME.                                                                   |

`snshah update` resolves `main` to a commit, shows that candidate's plan,
asks, and applies it. The new CLI replaces the old one only after the rest
of the apply succeeds.

## Maintaining it

See [`AGENTS.md`](AGENTS.md).
