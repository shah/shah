# 20-fedora: Fedora full upgrade alias

Guide for `workshop/profile.d/20-fedora.ts`. Read it from your terminal with `snshah profile catalog 20-fedora --docs`.

## What it is

One short command for the refresh-and-upgrade you run all the time on Fedora.

## When it applies

On Fedora and distributions like it (RHEL, CentOS, Rocky, Alma).

## How it works

It contributes the alias `dnfu` for `sudo dnf upgrade --refresh` to every shell's init.

## Install

Nothing to install; `dnf` is part of the distribution.

## Use it

Run `dnfu`. It asks for your sudo password and upgrades everything.

## Turn it off

Define your own `dnfu` under `aliases` in `snshah.conf.ts` to change it. A shipped profile can't be switched off by editing it (the next `snshah apply` restores it). To override what it sets, put the same setting in `~/.config/snshah/snshah.conf.ts`, which wins over profile.d. To stop it applying at all, make its condition false (see _When it applies_).

## Troubleshooting

`dnfu: command not found` in a running shell means the shell started before the profile applied; open a new one or run `snshah update`.
