# share: File server audit

Guide for `workshop/profile.d/share.ts`. Read it from your terminal with `snshah profile catalog share --docs`.

## What it is

The `snshah share` command group for the file servers on this machine: Samba (SMB, Windows-compatible shares) and NFS (Unix-style exports). It looks, audits, and prints configuration for you to paste. It never edits `smb.conf`, `/etc/exports` or any service, and never prints or stores a password.

## When it applies

When any of these is true: the `smbd` service is installed, the `nfs-server` service is installed, or `exportfs` is on PATH. Without one, `snshah share` is still listed but exits 2 and tells you what to install.

## How it works

`status` reports for Samba and NFS whether each is installed, whether it is running, and what it shares. `audit` parses `smb.conf` (Samba ignores case and spaces in parameter names, so snshah does too) and `/etc/exports`, then reports findings by severity (high, medium, low). It exits 1 when any finding is high, so you can use it in a script or CI job. NFS findings include exports to everyone, `no_root_squash`, insecure ports, `async`, and read-write without Kerberos. Samba findings cover an old minimum protocol (SMB1 and older), share-level security, unknown users mapped to guest, shares reachable from everywhere, encryption not required, wide symlinks, and guest access on a share. `print smb|nfs` writes a safe configuration: read-only unless you pass `--read-write`, no guests, one private subnet only. It refuses a subnet that is not private (RFC 1918) or is wider than you named. Test against another machine's files with `--smb-conf <file>` and `--exports <file>`.

## Install

Samba: Debian and Ubuntu `sudo apt-get install samba`; Fedora `sudo dnf install samba`; Arch `sudo pacman -S samba`; Alpine `apk add samba`; openSUSE `zypper install samba`. NFS server: Debian and Ubuntu `nfs-kernel-server`; Fedora and Arch `nfs-utils`. macOS ships both clients and servers: turn on File Sharing in System Settings > General > Sharing (SMB) and use `/etc/exports` for NFS. WSL: it works for Linux-side services, but Windows shares are better served by Windows itself. Start the service after installing: `sudo systemctl enable --now smbd` on Debian and Ubuntu, `smb` on Fedora and Arch, `nfs-server` for NFS. `snshah profile catalog share` prints the package command for this machine.

## Use it

`snshah share status`, then `snshah share audit` (add `--json` for scripts). To share a folder read-only to your LAN: `snshah share print smb --path ~/Public --subnet 192.168.1.0/24 --user alice`, read what it printed, paste it into `smb.conf` yourself, create the Samba password with `sudo smbpasswd -a alice` (you type it; snshah never sees it), and restart the service. For NFS: `snshah share print nfs --path /srv/data --subnet 192.168.1.0/24` into `/etc/exports`, then `sudo exportfs -ra`. Run `audit` again to confirm.

## Turn it off

Stop or uninstall the servers; the group goes inactive by itself. snshah never changes a service, so there is nothing of its own to undo. A shipped profile can't be switched off by editing it (the next `snshah apply` restores it). To override what it sets, put the same setting in `~/.config/snshah/snshah.conf.ts`, which wins over profile.d. To stop it applying at all, make its condition false (see _When it applies_).

## Troubleshooting

`audit` exits 1: read the HIGH findings first; each says what to change. "Permission denied" reading `/etc/samba/smb.conf` or `/etc/exports`: run as a user who can read them, or audit a copy with `--smb-conf`/`--exports`. The group says inactive on a machine you think has Samba: it looks for the `smbd` service, the `nfs-server` service, or the `exportfs` command, so a Samba that isn't installed as a system service isn't seen; install the package above. Firewalls are not changed: open the ports for SMB (445) or NFS (2049) yourself, scoped to your subnet.
