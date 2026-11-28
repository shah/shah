// `snshah share`: audit and print configuration for the file servers on this
// machine (Samba, NFS). It exists where one of them does, and only prints and
// checks: it never edits a service's configuration.
import type {
  CommandGroup,
  ProfileAbout,
  ProfileInstall,
  Selector,
} from "../snshah.ts";

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

export const about = {
  title: "File server audit",
  summary:
    "Checks the Samba and NFS servers on this machine for guest access, old protocols and exports open to everyone, and prints safe, subnet-scoped configuration for you to paste. It never edits a service.",
  use: "Run `snshah share status`, then `snshah share audit` (it exits 1 on a serious finding). To share a folder, run `snshah share print smb --path ~/Public --subnet 192.168.1.0/24` and paste the result yourself.",
} satisfies ProfileAbout;

export const install = {
  packages: {
    apt: ["samba"],
    dnf: ["samba"],
    pacman: ["samba"],
    apk: ["samba"],
    zypper: ["samba"],
    omarchy: ["samba"],
  },
  note: "NFS instead of Samba: nfs-kernel-server on Debian and Ubuntu, nfs-utils on Fedora and Arch. macOS already ships both; turn on File Sharing in System Settings. Start the service after installing it (systemctl enable --now smbd on Debian, smb on Fedora).",
} satisfies ProfileInstall;
