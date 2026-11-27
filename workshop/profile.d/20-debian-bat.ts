// Debian and Ubuntu ship bat as `batcat`; use the upstream name when it is free.
import type { Contribution, Selector } from "../snshah.ts";

export const selector = {
  kind: "all",
  of: [
    { kind: "distro", id: "debian" },
    { kind: "has", command: "batcat" },
    { kind: "not", selector: { kind: "has", command: "bat" } },
  ],
} satisfies Selector;

export const config = { aliases: { bat: "batcat" } } satisfies Contribution;
