// Omarchy keeps work under ~/Work. $WORKSPACES_HOME and snshah.conf.ts still win.
import type { Contribution, Selector } from "../snshah.ts";

export const selector = { kind: "omarchy" } satisfies Selector;

export const config = { workspacesHome: "~/Work" } satisfies Contribution;
