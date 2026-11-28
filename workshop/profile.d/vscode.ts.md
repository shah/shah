# vscode: VS Code settings

Guide for `workshop/profile.d/vscode.ts`. Read it from your terminal with `snshah profile catalog vscode --docs`.

## What it is

The `snshah vscode` command: fills the VS Code settings that make the integrated terminal work well (a Nerd Font, shell integration) and lists extensions worth having. It previews unless you pass `--yes`.

## When it applies

When VS Code is here (the `code` command is on PATH) or you are inside a VS Code terminal or a Remote-SSH session. A bare server stays free of it.

## How it works

It reads the settings file, adds only the keys that are unset, and never changes one you've set. Over Remote-SSH it writes the server's Machine settings so the terminal font and integration work for that host. The `config edit` command also uses VS Code, through a generated workspace with auto-save, hot exit and local history turned off so an unfinished edit of `snshah.conf.ts` never lands on disk.

## Install

Install VS Code from code.visualstudio.com (winget `Microsoft.VisualStudioCode` on Windows), then in VS Code run Command Palette > Shell Command: Install 'code' command in PATH. Running snshah from VS Code's own terminal also works without it.

## Use it

`snshah vscode` shows the settings and extensions that are missing; `snshah vscode --yes` writes the settings. `--json` is for scripts.

## Turn it off

Don't run it; nothing is written on its own. A shipped profile can't be switched off by editing it (the next `snshah apply` restores it). To override what it sets, put the same setting in `~/.config/snshah/snshah.conf.ts`, which wins over profile.d. To stop it applying at all, make its condition false (see _When it applies_).

## Troubleshooting

If settings land in the wrong place, remember local, remote (Machine) and workspace settings are separate files; `snshah vscode` prints the file it wrote. Fonts must be installed on the machine where VS Code's window runs, not on the SSH server.
