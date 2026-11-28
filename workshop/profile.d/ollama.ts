// `snshah ollama`: status and pulls for local models. Present where the
// `ollama` command is, so a machine without local models stays lean.
import type {
  CommandGroup,
  ProfileAbout,
  ProfileInstall,
  Selector,
} from "../snshah.ts";

export const selector = { kind: "has", command: "ollama" } satisfies Selector;

export const commands = {
  group: "ollama",
  summary: "Local models: is ollama answering, which models it has, pull one",
  effects: { status: "query", pull: "change" },
  activatesWhen: "ollama is on PATH",
  advice: "Install ollama from ollama.com or your package manager.",
  load: () => import("../ext/ollama.ts"),
} satisfies CommandGroup;

export const about = {
  title: "Local models",
  summary:
    "Shows whether the ollama server is answering and which models it has, and pulls new ones.",
  use: "Run `snshah ollama status`, then `snshah ollama pull llama3.2`.",
} satisfies ProfileAbout;

export const install = {
  packages: {
    brew: ["ollama"],
    pacman: ["ollama"],
    winget: ["Ollama.Ollama"],
    omarchy: ["ollama"],
  },
  note: "On Debian, Fedora and most others, use the installer from ollama.com.",
} satisfies ProfileInstall;
