// `snshah share`: audit and print configuration for the file servers on this
// machine (Samba, NFS). It exists where one of them does, and only prints and
// checks: it never edits a service's configuration.
import type { CommandGroup, Selector } from "../snshah.ts";

export const selector = {
  kind: "any",
  of: [
    { kind: "service", name: "smbd" },
    { kind: "service", name: "nfs-server" },
    { kind: "has", command: "exportfs" },
  ],
} satisfies Selector;

export const commands = {
  group: "share",
  summary:
    "Audit Samba and NFS shares and print safe, subnet-scoped configuration to paste (never edits a service)",
  effects: { status: "query", audit: "query", print: "advice" },
  activatesWhen:
    "Samba (smbd) or an NFS server (nfs-server, exportfs) is installed",
  advice:
    "Install one to use it, for example: sudo apt-get install samba   or   sudo apt-get install nfs-kernel-server",
  load: () => import("../ext/share.ts"),
} satisfies CommandGroup;
