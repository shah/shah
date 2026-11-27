// Windows PowerShell: `which` for people with Unix fingers. Other shells get nothing.
import type { Contribution, Selector } from "../snshah.ts";

export const selector = { kind: "platform", is: "windows" } satisfies Selector;

export const config = {
  aliases: { which: { pwsh: "Get-Command" } },
} satisfies Contribution;
