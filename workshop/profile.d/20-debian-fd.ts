// Debian and Ubuntu ship fd as `fdfind`; use the upstream name when it is free.
import type {
  Contribution,
  ProfileAbout,
  ProfileInstall,
  Selector,
} from "../snshah.ts";

export const selector = {
  kind: "all",
  of: [
    { kind: "distro", id: "debian" },
    { kind: "has", command: "fdfind" },
    { kind: "not", selector: { kind: "has", command: "fd" } },
  ],
} satisfies Selector;

export const config = { aliases: { fd: "fdfind" } } satisfies Contribution;

export const about = {
  title: "fd under its Debian name",
  summary:
    "Debian and Ubuntu install fd as `fdfind`; this makes `fd` work, which fzf's file pickers expect.",
  use: "Install fd-find, then type `fd`. It steps aside once a real `fd` is on PATH, for example from mise.",
} satisfies ProfileAbout;

export const install = {
  packages: { apt: ["fd-find"] },
} satisfies ProfileInstall;
