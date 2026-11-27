// `snshah ollama`: status and pulls for local models. Present where the
// `ollama` command is, so a machine without local models stays lean.
import type { CommandGroup, Selector } from "../snshah.ts";

export const selector = { kind: "has", command: "ollama" } satisfies Selector;

export const commands = {
  group: "ollama",
  summary: "Local models: is ollama answering, which models it has, pull one",
  effects: { status: "query", pull: "change" },
  activatesWhen: "ollama is on PATH",
  advice: "Install ollama from ollama.com or your package manager.",
  load: () => import("../ext/ollama.ts"),
} satisfies CommandGroup;
