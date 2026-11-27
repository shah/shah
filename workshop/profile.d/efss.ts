// `snshah efss`: enterprise file sync and share (OneDrive, SharePoint, Google
// Drive, Box, Dropbox, SMB, SFTP, WebDAV) through rclone, with no FUSE. It
// exists where rclone does, so a machine that doesn't sync files stays lean.
import type { CommandGroup, Selector } from "../snshah.ts";

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
