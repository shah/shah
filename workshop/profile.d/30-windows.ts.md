# 30-windows: which for PowerShell

Guide for `workshop/profile.d/30-windows.ts`. Read it from your terminal with `snshah profile catalog 30-windows --docs`.

## What it is

A `which` command for PowerShell, for people with Unix fingers.

## When it applies

On native Windows.

## How it works

It contributes a `which` alias that runs `Get-Command`, to PowerShell only. Bash, zsh and fish don't get it (they have their own).

## Install

Nothing to install; PowerShell is on Windows.

## Use it

`which git` prints where `git` comes from.

## Turn it off

A shipped profile can't be switched off by editing it (the next `snshah apply` restores it). To override what it sets, put the same setting in `~/.config/snshah/snshah.conf.ts`, which wins over profile.d. To stop it applying at all, make its condition false (see _When it applies_).

## Troubleshooting

If `which` runs something else, a program called `which.exe` is earlier on PATH; `Get-Command which -All` shows both.
