# osquery: ask this machine questions in SQL

Guide for `workshop/profile.d/osquery.ts`. Read it from your terminal with `snshah profile catalog osquery --docs`.

## What it is

The `snshah osquery` command group. [osquery](https://osquery.io) exposes an operating system as a set of SQL tables: `listening_ports`, `users`, `startup_items`, `authorized_keys` and hundreds more. The tables are the same on Linux, macOS and Windows, so one question works on every machine. snshah adds a few named questions, a small audit, and a guard that keeps every query read-only. It is not installed by default; this profile appears where osquery already is.

## When it applies

When `osqueryi` is on PATH, or the `osqueryd` service is running. Anywhere else `snshah osquery` is still listed, exits 2 and says how to get osquery, and `snshah profile catalog osquery` shows it as not active here.

## How it works

`ask` runs `osqueryi --json "<one query>"`. The guard accepts exactly one `SELECT` (or `WITH ... SELECT`) and refuses everything else: a second statement, osqueryi's dot-commands, `ATTACH`, `PRAGMA`, anything that writes, and `load_extension`. It also refuses the `curl` and `curl_certificate` tables, which reach the network; a question about this machine never needs them. snshah never loads an osquery extension. Reading some tables needs root (for example `sudoers`); without it they come back empty or fail, and `audit` says which checks it skipped and why.

`audit` runs four checks and exits 1 when any finding is high, like `snshah share audit`:

1. **Listening ports.** Anything listening on a non-loopback address is listed (low). A port that is almost never meant to be open to a network (FTP 21, telnet 23, rexec, rlogin, rsh, Docker's unauthenticated API 2375, VNC 5900) is high.
2. **UID 0.** Any account other than `root` with UID 0 is high.
3. **Setuid files in writable places.** A setuid program under `/tmp`, `/var/tmp`, `/dev/shm` or a home folder is high.
4. **Root's SSH keys.** A key that lets `root` log in over SSH is medium.

Checks that don't exist on the platform (the Unix ones on Windows) or whose table is missing are reported as skipped, not as passes.

`config` prints a small `osquery.conf` that records five of the named queries hourly as snapshots in osquery's own log. It prints; it never writes to `/etc/osquery`.

## Install

osquery is not in the default Debian, Ubuntu or Fedora repositories. Check [osquery.io/downloads](https://osquery.io/downloads) for the current steps; at the time of writing they are:

- **Debian and Ubuntu:** add osquery's signing key and apt repository (`https://pkg.osquery.io/deb`), then `sudo apt-get update && sudo apt-get install osquery`. Or download the `.deb` from the downloads page and `sudo dpkg -i` it.
- **Fedora, RHEL and relatives:** add `https://pkg.osquery.io/rpm/osquery-s3-rpm.repo` to your dnf repositories, then `sudo dnf install osquery`. Or download the `.rpm`.
- **macOS:** `brew install --cask osquery`.
- **Windows:** `winget install osquery.osquery` (`snshah profile catalog osquery` prints the command).
- **Arch and Omarchy:** an AUR package (`osquery` or `osquery-bin`).

You only need `osqueryi` for snshah. The `osqueryd` daemon is for scheduled monitoring and is optional. snshah does not install osquery, because it needs root and a repository you should choose to trust.

## Use it

- `snshah osquery status`: version, whether `osqueryd` is running, and which config it found.
- `snshah osquery queries`: the named questions (`os`, `listening-ports`, `users`, `root-accounts`, `sudoers`, `authorized-keys`, `startup-items`, `crontab`, `suid-binaries`, `kernel-modules`, `containers`, `services`).
- `snshah osquery ask listening-ports`, or your own: `snshah osquery ask "SELECT name, version FROM os_version"`. Add `--json` for scripts and agents.
- `snshah osquery audit` (add `--json`): the baseline above. Run it with `sudo` for the complete picture.
- `snshah osquery config`: a sample config with an hourly pack, for you to install.

## Turn it off

Nothing runs on its own. Uninstall osquery, or stop `osqueryd` and remove `osqueryi` from PATH, and the group goes inactive. A shipped profile can't be edited away (the next `snshah apply` restores it); to override it, change what it depends on, or set the same thing in `~/.config/snshah/snshah.conf.ts`.

## Troubleshooting

- **`osqueryi is not on this machine`.** Only the daemon is running, or osquery is installed outside PATH. snshah also looks in `/opt/osquery/bin`, `/usr/local/bin`, `/usr/bin` and `C:\Program Files\osquery`; otherwise add its folder to PATH.
- **`no such table`.** That table doesn't exist on this platform or osquery version. `audit` skips the check and says so.
- **An empty result for `sudoers` or `authorized-keys`.** Run with `sudo`; those tables need to read other people's files.
- **The query is refused.** Read the reason: only one `SELECT`, no network tables, nothing that writes.
- **Slow.** Some tables (`suid_bin`, `file`) walk the disk; give them a minute, or narrow the query.
