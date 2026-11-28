# 10-omarchy: Omarchy workspaces root

Guide for `workshop/profile.d/10-omarchy.ts`. Read it from your terminal with `snshah profile catalog 10-omarchy --docs`.

## What it is

Omarchy keeps work under `~/Work`. This profile makes that the place `snshah git` clones and registers checkouts, so you don't have two workspaces roots.

## When it applies

On an Omarchy machine (snshah detects Omarchy and `snshah whoami` shows what it found).

## How it works

It sets `workspacesHome` to `~/Work`. Precedence, lowest to highest: built-in default (`~/workspaces`), this profile, `snshah.conf.ts`, then your private `profile.d`. The environment variable `$WORKSPACES_HOME` beats all of them.

## Install

Nothing to install.

## Use it

Nothing to run. `snshah git list` shows checkouts under `~/Work`, and `snshah git add owner/repo` clones to `~/Work/github.com/owner/repo`.

## Turn it off

Set `workspacesHome` in `snshah.conf.ts`, or export `WORKSPACES_HOME`. A shipped profile can't be switched off by editing it (the next `snshah apply` restores it). To override what it sets, put the same setting in `~/.config/snshah/snshah.conf.ts`, which wins over profile.d. To stop it applying at all, make its condition false (see _When it applies_).

## Troubleshooting

If checkouts appear under `~/workspaces`, run `snshah whoami --json` and check the platform facts say Omarchy; `snshah plan --explain` names the layer that set the root. Existing checkouts are never moved.
