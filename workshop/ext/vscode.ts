/**
 * snshah vscode: creature comforts for VS Code's settings (fill-only).
 * Contributed by profile.d/vscode.ts; loaded only when `snshah vscode` runs.
 * Over SSH it fills the server's Machine settings (the part VS Code reads on
 * this computer) and leaves the terminal font to the computer you sit at.
 */
import { join } from "node:path";
import type {
  CommanderCommand,
  Context,
  ExtApi,
  JsonObject,
} from "../snshah.ts";

/** Keys snshah fills when you haven't set them. Existing values are never changed. */
export const vscodeDefaults: JsonObject = {
  "terminal.integrated.fontFamily":
    "'MesloLGM Nerd Font Mono', 'MesloLGM Nerd Font', monospace",
  "terminal.integrated.shellIntegration.enabled": true,
  "terminal.integrated.scrollback": 10000,
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
};

export const vscodeExtensions = [
  "anthropic.claude-code",
  "oven.bun-vscode",
  "mkhl.direnv",
  "tamasfe.even-better-toml",
  "redhat.vscode-yaml",
] as const;

/** Defaults for a server reached over SSH: no terminal font, which the client draws. */
export const vscodeMachineDefaults: JsonObject = Object.fromEntries(
  Object.entries(vscodeDefaults).filter(
    ([key]) => key !== "terminal.integrated.fontFamily",
  ),
);

function configHome(ctx: Context): string {
  const value = ctx.env.XDG_CONFIG_HOME;
  return value && value.startsWith("/") ? value : join(ctx.home, ".config");
}

export function vscodeSettingsPath(ctx: Context, machine = false): string {
  if (machine)
    return join(ctx.home, ".vscode-server", "data", "Machine", "settings.json");
  switch (ctx.platform) {
    case "macos":
      return join(
        ctx.home,
        "Library",
        "Application Support",
        "Code",
        "User",
        "settings.json",
      );
    case "windows":
      return join(
        ctx.env.APPDATA || join(ctx.home, "AppData", "Roaming"),
        "Code",
        "User",
        "settings.json",
      );
    case "linux":
    case "wsl":
      return join(configHome(ctx), "Code", "User", "settings.json");
    default:
      throw new Error(`Unknown platform ${String(ctx.platform)}`);
  }
}

export type VscodeFill =
  | { kind: "fill"; next: string; added: string[] }
  | { kind: "current" }
  /** The file has comments or trailing commas, which snshah won't rewrite. */
  | { kind: "commented"; missing: JsonObject };

export function vscodeFill(
  previous: string | undefined,
  api: Pick<ExtApi, "fillDefaults" | "isObject" | "UsageError">,
  defaults: JsonObject = vscodeDefaults,
): VscodeFill {
  let current: unknown;
  try {
    current = previous?.trim() ? JSON.parse(previous) : {};
  } catch {
    const missing: JsonObject = {};
    for (const [key, value] of Object.entries(defaults))
      if (!previous!.includes(`"${key}"`)) missing[key] = value;
    return { kind: "commented", missing };
  }
  if (!api.isObject(current))
    throw new api.UsageError("VS Code settings.json must hold a JSON object.");
  const next = api.fillDefaults(current, defaults);
  const added = Object.keys(next).filter((k) => !(k in current));
  return added.length
    ? { kind: "fill", next: JSON.stringify(next, null, 2) + "\n", added }
    : { kind: "current" };
}

async function vscode(
  api: ExtApi,
  options: { yes: boolean; json: boolean },
): Promise<number> {
  const { ctx, say, tilde, readText, writeAtomic, capture } = api;
  // Over SSH the server's own (Machine) settings are the ones this computer can change.
  const remote = !!ctx.env.SSH_CONNECTION;
  const path = vscodeSettingsPath(ctx, remote);
  const previous = await readText(path);
  const fill = vscodeFill(
    previous,
    api,
    remote ? vscodeMachineDefaults : vscodeDefaults,
  );
  const PATH = ctx.env.PATH ?? "";
  const codeBinary = Bun.which("code", { PATH });
  const installed = codeBinary
    ? (capture([codeBinary, "--list-extensions"]) ?? "")
        .split("\n")
        .map((l) => l.trim().toLowerCase())
    : [];
  const missingExtensions = codeBinary
    ? vscodeExtensions.filter((e) => !installed.includes(e))
    : [...vscodeExtensions];
  const report = {
    settings: tilde(ctx, path),
    settingsStatus: fill.kind,
    wouldAdd:
      fill.kind === "fill"
        ? fill.added
        : fill.kind === "commented"
          ? Object.keys(fill.missing)
          : [],
    codeOnPath: !!codeBinary,
    missingExtensions,
    remote,
  };
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }
  if (remote)
    say(
      "You are on a server over SSH, so this fills the server's Machine settings. The terminal font is drawn by the VS Code on your own computer: run `snshah vscode` there too.",
      "pending",
    );
  say(
    `VS Code ${remote ? "machine" : "user"} settings: ${tilde(ctx, path)}`,
    "action",
  );
  switch (fill.kind) {
    case "current":
      say("Already has snshah's settings. No changes needed.", "success");
      break;
    case "commented":
      say(
        "That file has comments, so snshah won't rewrite it. Add these keys yourself:",
        "pending",
      );
      console.log(JSON.stringify(fill.missing, null, 2).replace(/^/gm, "   "));
      break;
    case "fill":
      if (!options.yes) {
        say(
          `Would add (never changing what you set): ${fill.added.join(", ")}`,
          "pending",
        );
        say("Nothing was changed. To add them: snshah vscode --yes", "pending");
      } else {
        await writeAtomic(path, fill.next, 0o644);
        say(
          `Added ${fill.added.join(", ")}. Reload VS Code windows to see them.`,
          "success",
        );
      }
      break;
    default:
      return api.assertNever(fill);
  }
  if (!codeBinary)
    say(
      "The `code` command is not on PATH, so extensions can't be checked. In VS Code: Command Palette > Shell Command: Install 'code' command in PATH.",
      "pending",
    );
  else if (missingExtensions.length) {
    say("Useful extensions you don't have yet (run what you want):", "pending");
    for (const id of missingExtensions)
      console.log(`   code --install-extension ${id}`);
  } else say("All recommended extensions are installed.", "success");
  if (!remote && (fill.kind !== "current" || missingExtensions.length))
    console.log(
      "Fonts: the terminal font setting needs a Nerd Font on this computer. Install: oh-my-posh font install Meslo, then run: snshah ux fonts installed",
    );
  return 0;
}

export function register(group: CommanderCommand, api: ExtApi): void {
  group
    .option("--json", "print JSON")
    .option("-y, --yes", "write the missing settings (default: preview)")
    .action(async (o: { json?: boolean; yes?: boolean }) => {
      process.exitCode = await vscode(api, {
        yes: !!o.yes,
        json: !!o.json,
      });
    });
}
