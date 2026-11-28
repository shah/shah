// Windows PowerShell: `which` for people with Unix fingers. Other shells get nothing.
import type { Contribution, ProfileAbout, Selector } from "../snshah.ts";

export const selector = { kind: "platform", is: "windows" } satisfies Selector;

export const config = {
  aliases: { which: { pwsh: "Get-Command" } },
} satisfies Contribution;

export const about = {
  title: "which for PowerShell",
  summary:
    "Gives PowerShell a `which` that works like the Unix one (it runs Get-Command). Other shells get nothing.",
  use: "Type `which git` in PowerShell.",
} satisfies ProfileAbout;
