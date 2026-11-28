# 20-debian-bat: bat under its Debian name

Guide for `workshop/profile.d/20-debian-bat.ts`. Read it from your terminal with `snshah profile catalog 20-debian-bat --docs`.

## What it is

Debian and Ubuntu package `bat` as the command `batcat` because another program already owns the name `bat`. This profile adds a `bat` alias to `batcat` so upstream documentation and your muscle memory work.

## When it applies

On Debian or a Debian-like distribution, when `batcat` is on PATH and a real `bat` is not.

## How it works

It contributes one alias, `bat` for `batcat`, to every shell's init. Once a real `bat` exists (for example `bat` is a default snshah tool installed through mise), the condition turns false and the alias disappears on the next shell start.

## Install

`sudo apt-get install bat` provides `batcat`. Or use mise: `snshah apply` installs the real `bat` by default, which makes this profile unnecessary.

## Use it

Type `bat file.txt`.

## Turn it off

A shipped profile can't be switched off by editing it (the next `snshah apply` restores it). To override what it sets, put the same setting in `~/.config/snshah/snshah.conf.ts`, which wins over profile.d. To stop it applying at all, make its condition false (see _When it applies_).

## Troubleshooting

`bat: command not found` means `batcat` isn't installed either; install the package above. If `bat` runs a different program, something else is first on PATH: `type -a bat`.
