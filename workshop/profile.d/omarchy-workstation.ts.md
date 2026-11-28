# omarchy-workstation: Omarchy workstation

Guide for `workshop/profile.d/omarchy-workstation.ts`. Read it from your terminal with `snshah profile catalog omarchy-workstation --docs`.

## What it is

Everything an Omarchy owner with the Hyprland Lua configuration would want from snshah in the desktop itself: an snshah entry in the Omarchy menu, a key binding that opens it, and Gmail, WhatsApp and Discord as web apps. It holds nothing private: no work accounts, tenants or private URLs, and it doesn't change your default browser (that is a choice for your own private profile).

## When it applies

On an Omarchy machine where `~/.config/hypr/hyprland.lua` exists (the Lua configuration). Without that file it stays off.

## How it works

Only managed, marked blocks and files of its own: (1) `~/.config/hypr/snshah.auto.lua` binds Super+Alt+M to the snshah menu; (2) a marked block in `~/.config/hypr/bindings.lua` loads that file; (3) a marked block just inside the object of `~/.config/omarchy/extensions/omarchy-menu.jsonc` adds the snshah menu (Doctor, Preview changes, Who is signed in, Update, Apply); (4) after-apply commands run `omarchy webapp install` for Gmail, WhatsApp and Discord, each skipped when its `.desktop` file already exists. It also recommends `rclone` and `age`, which `snshah doctor` shows. `snshah uninstall` removes every block and file it added.

## Install

Nothing to install beyond Omarchy itself. For the optional features: `snshah profile catalog efss` and `snshah profile catalog age`.

## Use it

Press Super+Alt+M or open the Omarchy menu and choose snshah. Actions open in a terminal that waits for Enter so you can read the result.

## Turn it off

Remove the `exists` condition by deleting `~/.config/hypr/hyprland.lua` (not recommended), or run `snshah uninstall` to remove the blocks. A shipped profile can't be switched off by editing it (the next `snshah apply` restores it). To override what it sets, put the same setting in `~/.config/snshah/snshah.conf.ts`, which wins over profile.d. To stop it applying at all, make its condition false (see _When it applies_).

## Troubleshooting

Binding doesn't work: reload Hyprland (`hyprctl reload`) and check `~/.config/hypr/bindings.lua` has the marked snshah block. Menu entry missing: check the JSONC file still parses and the block sits inside the top-level object. A web app that exists is never reinstalled.
