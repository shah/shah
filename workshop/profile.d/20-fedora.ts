// Fedora and its relatives: one alias for a full refresh-and-upgrade.
import type { Contribution, Selector } from "../snshah.ts";

export const selector = { kind: "distro", id: "fedora" } satisfies Selector;

export const config = {
  aliases: { dnfu: "sudo dnf upgrade --refresh" },
} satisfies Contribution;
