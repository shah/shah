// Fedora and its relatives: one alias for a full refresh-and-upgrade.
import type { Contribution, ProfileAbout, Selector } from "../snshah.ts";

export const selector = { kind: "distro", id: "fedora" } satisfies Selector;

export const config = {
  aliases: { dnfu: "sudo dnf upgrade --refresh" },
} satisfies Contribution;

export const about = {
  title: "Fedora full upgrade alias",
  summary:
    "Adds `dnfu`, one command that refreshes metadata and upgrades everything.",
  use: "Run `dnfu`. It asks for sudo.",
} satisfies ProfileAbout;
