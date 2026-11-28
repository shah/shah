// `snshah efss`: enterprise file sync and share (OneDrive, SharePoint, Google
// Drive, Box, Dropbox, SMB, SFTP, WebDAV) through rclone, with no FUSE. It
// exists where rclone does, so a machine that doesn't sync files stays lean.
import type {
  CommandGroup,
  ProfileAbout,
  ProfileInstall,
  Selector,
} from "../snshah.ts";

export const selector = { kind: "has", command: "rclone" } satisfies Selector;

export const commands = {
  group: "efss",
  summary:
    "Mirror OneDrive, SharePoint, Google Drive, Box, Dropbox, SMB, SFTP or WebDAV to local folders with rclone (no FUSE)",
  effects: {
    connect: "change",
    list: "query",
    status: "query",
    pull: "change",
    push: "change",
    folder: "query",
    schedule: "change",
    remove: "change",
  },
  activatesWhen: "rclone is on PATH",
  advice:
    'Get rclone: set tools: { rclone: "latest" } in snshah.conf.ts and run snshah apply, or use your package manager.',
  load: () => import("../ext/efss.ts"),
} satisfies CommandGroup;

export const about = {
  title: "Cloud files, mirrored",
  summary:
    "Mirrors OneDrive, SharePoint, Google Drive, Box, Dropbox, SMB, SFTP or WebDAV into ordinary folders under ~/efss with rclone. No FUSE mount, so nothing hangs when the network drops.",
  use: "Run `snshah efss connect onedrive` (you sign in in the browser), then `snshah efss pull <name>`. Schedule it with `snshah efss schedule <name> 6h`.",
} satisfies ProfileAbout;

export const install = {
  packages: {
    apt: ["rclone"],
    dnf: ["rclone"],
    pacman: ["rclone"],
    apk: ["rclone"],
    zypper: ["rclone"],
    brew: ["rclone"],
    winget: ["Rclone.Rclone"],
    omarchy: ["rclone"],
  },
  note: 'Or let snshah install it: set tools: { rclone: "latest" } in snshah.conf.ts and run snshah apply.',
} satisfies ProfileInstall;
