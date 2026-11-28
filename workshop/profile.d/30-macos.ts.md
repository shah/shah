# 30-macos: Homebrew on PATH

Guide for `workshop/profile.d/30-macos.ts`. Read it from your terminal with `snshah profile catalog 30-macos --docs`.

## What it is

On Apple silicon, Homebrew installs into `/opt/homebrew`, which login shells don't always have on PATH. This profile puts it there.

## When it applies

On macOS.

## How it works

It adds `/opt/homebrew/bin` and `/opt/homebrew/sbin` to PATH in every shell's init, only when they aren't already there.

## Install

Nothing to install. Homebrew itself: see brew.sh. snshah only detects and advises about packages; it never installs Homebrew.

## Use it

Nothing to run. `brew` and what it installs are found in every shell snshah initializes.

## Turn it off

A shipped profile can't be switched off by editing it (the next `snshah apply` restores it). To override what it sets, put the same setting in `~/.config/snshah/snshah.conf.ts`, which wins over profile.d. To stop it applying at all, make its condition false (see _When it applies_).

## Troubleshooting

On an Intel Mac Homebrew lives in `/usr/local`, which is already on PATH; the extra entries are harmless. If `brew` is still missing, check `ls /opt/homebrew/bin/brew`.
