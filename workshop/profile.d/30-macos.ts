// Homebrew on Apple silicon lives in /opt/homebrew, which login shells may not have on PATH.
import type { Contribution, ProfileAbout, Selector } from "../snshah.ts";

export const selector = { kind: "platform", is: "macos" } satisfies Selector;

export const config = {
  path: ["/opt/homebrew/bin", "/opt/homebrew/sbin"],
} satisfies Contribution;

export const about = {
  title: "Homebrew on PATH",
  summary:
    "Adds /opt/homebrew/bin and /opt/homebrew/sbin to PATH, where Homebrew lives on Apple silicon and login shells may not look.",
  use: "Nothing to run; brew and what it installs are found in every shell.",
} satisfies ProfileAbout;
