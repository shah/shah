// WSL: reach the Windows clipboard and Explorer with familiar names.
import type { Contribution, Selector } from "../snshah.ts";

export const selector = { kind: "platform", is: "wsl" } satisfies Selector;

export const config = {
  aliases: { pbcopy: "clip.exe", explorer: "explorer.exe" },
} satisfies Contribution;
