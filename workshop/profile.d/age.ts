// `snshah vault`: an age-encrypted backup of your private config. Present
// where `age` is on PATH. age asks for the passphrase on your terminal, so
// snshah never sees it.
import type { CommandGroup, Selector } from "../snshah.ts";

export const selector = { kind: "has", command: "age" } satisfies Selector;

export const commands = {
  group: "vault",
  summary:
    "Back up snshah.conf.ts as an age passphrase-encrypted snapshot; verify and restore it",
  effects: {
    status: "query",
    backup: "change",
    verify: "query",
    restore: "change",
  },
  activatesWhen: "age is on PATH",
  advice:
    'Get age: set tools: { age: "latest" } in snshah.conf.ts and run snshah apply, or use your package manager.',
  load: () => import("../ext/vault.ts"),
} satisfies CommandGroup;
