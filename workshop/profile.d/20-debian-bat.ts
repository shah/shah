// Debian and Ubuntu ship bat as `batcat`; use the upstream name when it is free.
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
    { kind: "has", command: "batcat" },
    { kind: "not", selector: { kind: "has", command: "bat" } },
  ],
} satisfies Selector;

export const config = { aliases: { bat: "batcat" } } satisfies Contribution;

export const about = {
  title: "bat under its Debian name",
  summary:
    "Debian and Ubuntu install bat as `batcat`; this adds a `bat` alias so the upstream name works.",
  use: "Install bat, then type `bat`. It steps aside once a real `bat` is on PATH, for example from mise.",
} satisfies ProfileAbout;

export const install = {
  packages: { apt: ["bat"] },
} satisfies ProfileInstall;
