# efss: Cloud files, mirrored

Guide for `workshop/profile.d/efss.ts`. Read it from your terminal with `snshah profile catalog efss --docs`.

## What it is

The `snshah efss` command group (enterprise file sync and share). It connects OneDrive, SharePoint, Google Drive, Box, Dropbox, SMB, SFTP or WebDAV through [rclone](https://rclone.org) and mirrors each into an ordinary folder under `~/efss/<name>`. There is no FUSE mount (FUSE is brittle: it hangs when the network drops), so everything works on plain files.

## When it applies

Wherever `rclone` is on PATH. Without it the group is listed but exits 2 and says how to get rclone.

## How it works

rclone does every sign-in in your browser; snshah never sees a token, stores the rclone config at `$XDG_CONFIG_HOME/snshah/rclone.conf`, and keeps its own bookkeeping in `efss.json`. Each connection is read-only by default (`--read`); `--read-write` chooses read-write at connect time, using read-only token scopes where the provider has them, and `push` refuses otherwise. `pull` copies new and changed files down and never deletes; `pull --mirror` also removes local files the provider doesn't have, previewing until `--yes`. `push` previews until `--yes`; `push --delete` also needs `--max-delete <n>`. `schedule <name> <30m|6h|1d|off>` writes a systemd user timer that runs `pull`.

## Install

`snshah profile catalog efss` prints the command for your package manager, or set `tools: { rclone: "latest" }` in `snshah.conf.ts` and run `snshah apply`.

## Use it

`snshah efss connect onedrive` (add `--read-write` if you want to push), sign in when the browser opens, then `snshah efss pull onedrive`. `snshah efss list`, `status`, and `folder <name>` (prints the local path) show what you have. `snshah efss schedule onedrive 6h` keeps it fresh. `snshah efss remove <name>` forgets the connection and its sign-in; local files stay, and you should also revoke access at the provider.

## Turn it off

`snshah efss schedule <name> off` stops a timer. `snshah efss remove <name>` forgets a connection. Uninstalling rclone makes the group inactive. A shipped profile can't be switched off by editing it (the next `snshah apply` restores it). To override what it sets, put the same setting in `~/.config/snshah/snshah.conf.ts`, which wins over profile.d. To stop it applying at all, make its condition false (see _When it applies_).

## Troubleshooting

`connect` refuses under an AI agent because only you can sign in. A sign-in that expired shows in `snshah efss status --online`; run `connect` again for that provider. systemd timers need a systemd user session (not available on macOS or inside most containers).
