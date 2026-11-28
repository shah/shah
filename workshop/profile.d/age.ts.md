# age: Encrypted config backup

Guide for `workshop/profile.d/age.ts`. Read it from your terminal with `snshah profile catalog age --docs`.

## What it is

The `snshah vault` command group: a passphrase-encrypted snapshot of your private `snshah.conf.ts`, made with [age](https://github.com/FiloSottile/age). The config holds personal values that are not in git, so this is the way to keep a recoverable copy.

## When it applies

Wherever the `age` command is on PATH. Without it `snshah vault` is still listed but exits 2 and says how to get age.

## How it works

`backup` asks age to encrypt the config. age prompts for the passphrase on your terminal; snshah never sees, stores or logs it, and refuses to run for an AI agent. The snapshot is a file you can put anywhere (cloud folder, USB stick). `verify` opens a snapshot with its passphrase and compares it to the current config. `restore` previews and changes nothing until `--yes`, and keeps the old file as a backup.

## Install

Your package manager (`snshah profile catalog age` prints the command for this machine), or set `tools: { age: "latest" }` in `snshah.conf.ts` and run `snshah apply` so mise installs it.

## Use it

`snshah vault status` shows when the last backup was made and whether the config changed since. `snshah vault backup` makes one (add `--to <dir>` to choose the folder). `snshah vault verify <file>` checks it. `snshah vault restore <file> --yes` brings it back.

## Turn it off

Uninstall age, or don't run the commands; nothing happens on its own. A shipped profile can't be switched off by editing it (the next `snshah apply` restores it). To override what it sets, put the same setting in `~/.config/snshah/snshah.conf.ts`, which wins over profile.d. To stop it applying at all, make its condition false (see _When it applies_).

## Troubleshooting

Forgot the passphrase: it can't be recovered; make a new backup. `restore` says the file is not an age file: you passed the wrong path. Under an agent the commands refuse by design.
