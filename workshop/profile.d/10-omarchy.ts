// Omarchy keeps work under ~/Work. $WORKSPACES_HOME and snshah.conf.ts still win.
import type { Contribution, ProfileAbout, Selector } from "../snshah.ts";

export const selector = { kind: "omarchy" } satisfies Selector;

export const config = { workspacesHome: "~/Work" } satisfies Contribution;

export const about = {
  title: "Omarchy workspaces root",
  summary:
    "On Omarchy, your checkouts live under ~/Work instead of ~/workspaces.",
  use: "Nothing to run. `snshah git` and new clones use ~/Work. $WORKSPACES_HOME, or workspacesHome in snshah.conf.ts, still wins.",
} satisfies ProfileAbout;
