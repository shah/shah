// `snshah vault`: an age-encrypted backup of your private config. Present
// where `age` is on PATH. age asks for the passphrase on your terminal, so
// snshah never sees it.
import type {
  CommandGroup,
  ProfileAbout,
  ProfileInstall,
  Selector,
} from "../snshah.ts";

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

export const about = {
  title: "Encrypted config backup",
  summary:
    "Keeps a passphrase-encrypted age snapshot of your private snshah.conf.ts, and verifies and restores it. snshah never sees the passphrase; age asks you on your terminal.",
  use: "Run `snshah vault backup`, then `snshah vault verify <file>`. To restore, run `snshah vault restore <file>` (it previews first).",
} satisfies ProfileAbout;

export const install = {
  packages: {
    apt: ["age"],
    dnf: ["age"],
    pacman: ["age"],
    apk: ["age"],
    brew: ["age"],
    winget: ["FiloSottile.age"],
    omarchy: ["age"],
  },
  note: 'Or let snshah install it: set tools: { age: "latest" } in snshah.conf.ts and run snshah apply.',
} satisfies ProfileInstall;
