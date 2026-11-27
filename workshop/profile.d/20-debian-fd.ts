// Debian and Ubuntu ship fd as `fdfind`; use the upstream name when it is free.
import type { Contribution, Selector } from "../snshah.ts";

export const selector = {
  kind: "all",
  of: [
    { kind: "distro", id: "debian" },
    { kind: "has", command: "fdfind" },
    { kind: "not", selector: { kind: "has", command: "fd" } },
  ],
} satisfies Selector;

export const config = { aliases: { fd: "fdfind" } } satisfies Contribution;
