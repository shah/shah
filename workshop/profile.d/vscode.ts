// `snshah vscode`: VS Code settings and extensions. It exists when VS Code is
// here (the `code` command) or when you are inside a VS Code terminal or a
// Remote-SSH session, so a bare server stays free of it.
import type { CommandGroup, Selector } from "../snshah.ts";

export const selector = {
  kind: "any",
  of: [
    { kind: "has", command: "code" },
    { kind: "env", name: "VSCODE_IPC_HOOK_CLI" },
    { kind: "env", name: "VSCODE_GIT_IPC_HANDLE" },
  ],
} satisfies Selector;

export const commands = {
  group: "vscode",
  summary:
    "Fill VS Code settings (Nerd Font terminal, shell integration) and list recommended extensions; previews unless --yes",
  effects: { "": "change" },
  activatesWhen:
    "VS Code is here (the `code` command is on PATH) or you are in a VS Code terminal",
  advice:
    "In VS Code run Command Palette > Shell Command: Install 'code' command in PATH, or run this from VS Code's terminal.",
  load: () => import("../ext/vscode.ts"),
} satisfies CommandGroup;
