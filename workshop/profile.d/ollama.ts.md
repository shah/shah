# ollama: Local models

Guide for `workshop/profile.d/ollama.ts`. Read it from your terminal with `snshah profile catalog ollama --docs`.

## What it is

The `snshah ollama` command group: is the local [ollama](https://ollama.com) server answering, which models does it have, and pull more.

## When it applies

Wherever the `ollama` command is on PATH. A machine without local models stays lean; the group is listed but exits 2.

## How it works

`status` asks the local server and lists its models. `pull <model>` runs `ollama pull`, which can download gigabytes, so snshah refuses to do it for an AI agent and refuses names that look like options.

## Install

`snshah profile catalog ollama` prints the package command where one exists (Homebrew, Arch, winget). On other systems use the installer on ollama.com.

## Use it

`snshah ollama status` (add `--json` for scripts), `snshah ollama pull llama3.2`, `snshah ollama pull qwen2.5-coder:7b`.

## Turn it off

Uninstall ollama. A shipped profile can't be switched off by editing it (the next `snshah apply` restores it). To override what it sets, put the same setting in `~/.config/snshah/snshah.conf.ts`, which wins over profile.d. To stop it applying at all, make its condition false (see _When it applies_).

## Troubleshooting

`status` says the server isn't answering: start it (`ollama serve`, or the desktop app, or `systemctl start ollama`). Large pulls can take long on slow links; run them in a separate terminal.
