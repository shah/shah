# 30-wsl: WSL clipboard and Explorer

Guide for `workshop/profile.d/30-wsl.ts`. Read it from your terminal with `snshah profile catalog 30-wsl --docs`.

## What it is

Inside WSL, the Windows clipboard and Explorer are a command away.

## When it applies

Inside WSL (Windows Subsystem for Linux).

## How it works

It contributes two aliases to every shell's init: `pbcopy` for `clip.exe` (the Windows clipboard) and `explorer` for `explorer.exe`.

## Install

Nothing to install; both programs come from Windows and WSL exposes them on PATH.

## Use it

`cat file | pbcopy` copies to the Windows clipboard. `explorer .` opens the current folder in Windows Explorer.

## Turn it off

A shipped profile can't be switched off by editing it (the next `snshah apply` restores it). To override what it sets, put the same setting in `~/.config/snshah/snshah.conf.ts`, which wins over profile.d. To stop it applying at all, make its condition false (see _When it applies_).

## Troubleshooting

If `clip.exe` isn't found, WSL's Windows PATH interop is off. Check `[interop]` and `appendWindowsPath` in `/etc/wsl.conf`.
