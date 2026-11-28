# 20-debian-fd: fd under its Debian name

Guide for `workshop/profile.d/20-debian-fd.ts`. Read it from your terminal with `snshah profile catalog 20-debian-fd --docs`.

## What it is

Debian and Ubuntu package `fd` as the command `fdfind`. This profile makes the upstream name `fd` work, which is what you'd type. fzf's file and directory pickers (Ctrl-T and Alt-C) run in their own shell, where aliases don't exist, so snshah's fzf setup looks for `fdfind` directly and doesn't depend on this alias.

## When it applies

On Debian or a Debian-like distribution, when `fdfind` is on PATH and a real `fd` is not.

## How it works

It adds an alias `fd` for `fdfind` to every shell's init. A real `fd` (a default snshah tool through mise) makes this profile unnecessary and the alias disappears on the next shell start.

## Install

`sudo apt-get install fd-find`.

## Use it

Type `fd pattern`.

## Turn it off

A shipped profile can't be switched off by editing it (the next `snshah apply` restores it). To override what it sets, put the same setting in `~/.config/snshah/snshah.conf.ts`, which wins over profile.d. To stop it applying at all, make its condition false (see _When it applies_).

## Troubleshooting

Aliases don't apply to scripts; call `fdfind` there. If `fd` is still missing in a shell, start a new one so the init is re-read.
