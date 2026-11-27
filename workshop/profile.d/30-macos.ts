// Homebrew on Apple silicon lives in /opt/homebrew, which login shells may not have on PATH.
import type { Contribution, Selector } from "../snshah.ts";

export const selector = { kind: "platform", is: "macos" } satisfies Selector;

export const config = {
  path: ["/opt/homebrew/bin", "/opt/homebrew/sbin"],
} satisfies Contribution;
