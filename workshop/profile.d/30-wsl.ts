// WSL: reach the Windows clipboard and Explorer with familiar names.
import type { Contribution, ProfileAbout, Selector } from "../snshah.ts";

export const selector = { kind: "platform", is: "wsl" } satisfies Selector;

export const config = {
  aliases: { pbcopy: "clip.exe", explorer: "explorer.exe" },
} satisfies Contribution;

export const about = {
  title: "WSL clipboard and Explorer",
  summary:
    "Adds `pbcopy` (Windows clipboard) and `explorer` aliases inside WSL.",
  use: "Pipe into `pbcopy` to copy to the Windows clipboard; run `explorer .` to open the folder in Windows.",
} satisfies ProfileAbout;
