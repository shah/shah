#!/usr/bin/env -S bun --no-env-file
/**
 * snshah: Shahid Shah's shell and "creature comforts" for all work at the CLI.
 *
 * This file is public (github.com/shah/shah, workshop/). It holds generic
 * defaults only. Anything personal (aliases, repositories, secrets) lives in
 * the private config at $XDG_CONFIG_HOME/snshah/snshah.conf.ts, which never
 * enters the repository.
 *
 * Every command is idempotent: `plan` is read-only, and running `apply` (or
 * any bootstrap) a second time reports "No changes needed."
 */
import {
  constants,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open as openFile,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { spawn as spawnChild } from "node:child_process";
import { createHash } from "node:crypto";
import {
  homedir,
  hostname,
  networkInterfaces,
  tmpdir,
  userInfo,
} from "node:os";
import { pathToFileURL } from "node:url";
import {
  basename,
  delimiter,
  dirname,
  isAbsolute,
  join,
  resolve,
} from "node:path";

// ---------------------------------------------------------------------------
// Public types. This region is copied verbatim into the private
// snshah.auto.d.ts, so private config and profile.d files are checked
// against exactly these declarations. Keep it self-contained.
// ---------------------------------------------------------------------------

// >>> snshah public types >>>
export type Platform = "linux" | "wsl" | "macos" | "windows";
export type Shell = "bash" | "zsh" | "fish" | "pwsh";
export type AliasValue =
  string | { posix?: string; fish?: string; pwsh?: string };
/** Oh My Posh, installed by snshah (pinned, SHA-256 checked) unless `install: false`. */
export type Prompt =
  { kind: "oh-my-posh"; theme?: string; install?: boolean } | { kind: "none" };
export type AgentDefaults = { kind: "defaults" } | { kind: "off" };
export type Secret =
  | { variable: string; value: string; scope: "command"; commands: string[] }
  | { variable: string; value: string; scope: "shell" };
export type Repository = { name: string; source: string; path?: string };
/** mise installs and activates developer tools in your account. `none` turns it off. */
export type ToolManager = { kind: "mise" } | { kind: "none" };
/** A mise version ("latest", "20", "1.7.1"), or false to leave a tool out. */
export type ToolSpec = string | false;
export type WorkshopConfig = {
  workspacesHome?: string;
  path?: string[];
  aliases?: Record<string, AliasValue>;
  prompt?: Prompt;
  toolManager?: ToolManager;
  tools?: Record<string, ToolSpec>;
  /** Plain (non-secret) environment variables for every shell. */
  env?: Record<string, string>;
  agents?: { claude?: AgentDefaults; codex?: AgentDefaults };
  repositories?: Repository[];
  secrets?: Secret[];
};
/** What a profile.d file may contribute. Secrets stay in the private config. */
export type Contribution = Omit<WorkshopConfig, "secrets">;
/** What a `.snshah.path.ts` file may set while your shell is inside its directory. */
export type DirectoryContribution = Pick<
  WorkshopConfig,
  "path" | "aliases" | "env"
>;
/** Which machines a profile applies to. Environment first; identity last. */
export type Selector =
  | { kind: "always" }
  | { kind: "platform"; is: Platform }
  | { kind: "distro"; id: string }
  | { kind: "omarchy" }
  | { kind: "has"; command: string }
  | { kind: "env"; name: string; equals?: string }
  | { kind: "hostname"; is: string }
  | { kind: "machine"; fingerprint: string }
  | { kind: "all"; of: Selector[] }
  | { kind: "any"; of: Selector[] }
  | { kind: "not"; selector: Selector };
/** The environment a command hook's child process gets. */
export type CommandEnv = {
  /** Variables passed through from the parent, or "all". The base is PATH, HOME, USER, LANG, TERM, XDG_* and the OS essentials. */
  pass?: "all" | string[];
  /** Literal values. */
  set?: Record<string, string>;
  /** Names of secrets declared in the private config (private profiles only). */
  secrets?: string[];
};
export type Hook =
  | { kind: "file"; path: string; content: string; mode?: number }
  | {
      kind: "block";
      path: string;
      content: string;
      comment?: "#" | "//" | ";" | "--" | "<!--";
    }
  | {
      kind: "command";
      phase: "before-apply" | "after-apply";
      run: string[];
      /** Required. The command runs only when this check fails, so re-runs are no-ops. */
      unless: string[];
      env?: CommandEnv;
      cwd?: string;
    };
/** What selectors are evaluated against. `snshah whoami` prints them; `--as` fakes them. */
export type Facts = {
  platform: Platform;
  distro: string[];
  omarchy: boolean;
  hostname: string;
  machine: string;
  /** When set, `has` selectors look only at this list. */
  commands?: string[];
};
// <<< snshah public types <<<

// ---------------------------------------------------------------------------
// Manifest: the facts ontology/workshop.ttl records. ontology/check.ts fails
// when the two disagree, so change both together.
// ---------------------------------------------------------------------------

/** Compile-time proof that a list names every member of a union. */
type Covers<T extends readonly string[], U extends string> = [
  Exclude<U, T[number]>,
] extends [never]
  ? true
  : ["missing", Exclude<U, T[number]>];

export const cliVersion = "0.5.0";
export const minimumBun = "1.4.0";
/** The Oh My Posh release snshah installs when none is on PATH, by Bun-style target. */
export const ohMyPosh = {
  version: "33.4.1",
  assets: {
    "linux-x64": {
      file: "posh-linux-amd64",
      sha256:
        "48f0f61b1f106ec296f024ebaae675c4cd6f2a185a4132f9adfcd4db7f3a3a9d",
    },
    "linux-arm64": {
      file: "posh-linux-arm64",
      sha256:
        "32001936db4f51d7ee4d5312823d1fb72eda8ec1fe6ce2efcaba884ec33d6129",
    },
    "darwin-x64": {
      file: "posh-darwin-amd64",
      sha256:
        "b6090ccab2544870b6b7672eb9baf9c3f18073044e84fa405af968d9c28a58b4",
    },
    "darwin-arm64": {
      file: "posh-darwin-arm64",
      sha256:
        "3f8667d918df22eb2e975d0dc39c71081b7cef6d843a33c070c405f039fba810",
    },
    "windows-x64": {
      file: "posh-windows-amd64.exe",
      sha256:
        "3ae87ffa0b0f0126baf3f0d176fb4e326cb6ec082b13a9cdd10d6cf8aa2f73fc",
    },
    "windows-arm64": {
      file: "posh-windows-arm64.exe",
      sha256:
        "ecd288b918e652f187bc49212a9684aa6eb14ae4c1dbf237c418ce25ff55a0ff",
    },
  },
} as const;
export type PoshTarget = keyof typeof ohMyPosh.assets;
/** The mise release snshah installs when none is on PATH; bare binaries, SHA-256 from its SHASUMS256.txt. */
export const miseRelease = {
  version: "2026.11.14",
  assets: {
    "linux-x64": {
      file: "mise-v2026.11.14-linux-x64",
      sha256:
        "6fa596291e9758106f761fea4f8e7fac6c3e7ff4714d5c0b9a76e16068db14f6",
    },
    "linux-x64-musl": {
      file: "mise-v2026.11.14-linux-x64-musl",
      sha256:
        "3b2dbc7011bfd96c4b1160db2bca9f0937f226cc61ae5beddfd1fec536e81b2a",
    },
    "linux-arm64": {
      file: "mise-v2026.11.14-linux-arm64",
      sha256:
        "7bd3b2d5ffff077a7662ba186c09600e5b40c1eee9df0c264ed67642ce0a8698",
    },
    "linux-arm64-musl": {
      file: "mise-v2026.11.14-linux-arm64-musl",
      sha256:
        "7a5252b6a4f30baa96486234e9f217c9f9aaef2343f32b744cd1a54fb4248268",
    },
    "macos-x64": {
      file: "mise-v2026.11.14-macos-x64",
      sha256:
        "7f38115f28c6cef9d344bc528670d1033d24a9385455013768e78ad6203d9791",
    },
    "macos-arm64": {
      file: "mise-v2026.11.14-macos-arm64",
      sha256:
        "ad39dddb61236cc546ecbd0294aa3fc72a5ae7f1f8c7e6dc6fd4211f99eb3b79",
    },
    "windows-x64": {
      file: "mise-v2026.11.14-windows-x64.exe",
      sha256:
        "d190f5d00fd79d4c7bff1f3f5f4e41aa0b4a2a1a9002e6fca1977367be36413e",
    },
    "windows-arm64": {
      file: "mise-v2026.11.14-windows-arm64.exe",
      sha256:
        "1f2caac177da781843b36a8ff764f6b5ecec9df3090ea89053b3e6aea7a648fb",
    },
  },
} as const;
export type MiseTarget = keyof typeof miseRelease.assets;
/** Developer tools every machine gets from mise, by mise registry name. */
export const defaultTools = {
  gh: "latest",
  ripgrep: "latest",
  fd: "latest",
  bat: "latest",
  fzf: "latest",
  jq: "latest",
  yq: "latest",
  delta: "latest",
  direnv: "latest",
  eza: "latest",
} as const satisfies Record<string, string>;
export const dependencies = {
  commander: "12.1.0",
  chalk: "5.6.2",
  "@clack/prompts": "0.11.0",
} as const;
export const shells = [
  "bash",
  "zsh",
  "fish",
  "pwsh",
] as const satisfies readonly Shell[];
export const platforms = [
  "linux",
  "wsl",
  "macos",
  "windows",
] as const satisfies readonly Platform[];
export const secretScopes = [
  "command",
  "shell",
] as const satisfies readonly Secret["scope"][];
export const selectorKinds = [
  "always",
  "platform",
  "distro",
  "omarchy",
  "has",
  "env",
  "hostname",
  "machine",
  "all",
  "any",
  "not",
] as const satisfies readonly Selector["kind"][];
export const hookKinds = [
  "file",
  "block",
  "command",
] as const satisfies readonly Hook["kind"][];
export const stepKinds = [
  "directory",
  "file",
  "seed",
  "block",
  "json-fill",
  "toml-fill",
  "remove",
  "command",
  "download",
  "tools",
] as const;
export const packageManagers = [
  "apt",
  "dnf",
  "pacman",
  "apk",
  "zypper",
  "brew",
  "winget",
  "omarchy",
] as const;
export const commandNames = [
  "plan",
  "whoami",
  "apply",
  "doctor",
  "shell",
  "exec",
  "config path",
  "config check",
  "config edit",
  "config set-secret",
  "git root",
  "git add",
  "git list",
  "git path",
  "git clone",
  "git update",
  "git remove",
  "ssh status",
  "ssh keys",
  "ssh new",
  "ssh copy",
  "ssh authorize",
  "ssh authorized",
  "ssh test",
  "ssh harden",
  "ssh host add",
  "ssh host list",
  "ssh host remove",
  "profile list",
  "profile show",
  "profile allow",
  "profile deny",
  "profile init",
  "profile check",
  "profile why",
  "profile load",
  "ux fonts status",
  "ux fonts installed",
  "ux fonts missing",
  "ux fonts reset",
  "ux fonts install",
  "update",
  "test",
] as const;
/** Paths relative to an XDG base directory (or HOME for bin). */
export const xdgPaths = {
  config: {
    base: "XDG_CONFIG_HOME",
    fallback: ".config",
    relative: "snshah/snshah.conf.ts",
  },
  types: {
    base: "XDG_CONFIG_HOME",
    fallback: ".config",
    relative: "snshah/snshah.auto.d.ts",
  },
  profiles: {
    base: "XDG_CONFIG_HOME",
    fallback: ".config",
    relative: "snshah/profile.d",
  },
  script: {
    base: "XDG_DATA_HOME",
    fallback: ".local/share",
    relative: "snshah/snshah.ts",
  },
  theme: {
    base: "XDG_DATA_HOME",
    fallback: ".local/share",
    relative: "snshah/snshah.omp.json",
  },
  repoProfiles: {
    base: "XDG_DATA_HOME",
    fallback: ".local/share",
    relative: "snshah/profile.d",
  },
  receipt: {
    base: "XDG_STATE_HOME",
    fallback: ".local/state",
    relative: "snshah/installed.auto.json",
  },
  downloads: { base: "XDG_CACHE_HOME", fallback: ".cache", relative: "snshah" },
  state: {
    base: "XDG_STATE_HOME",
    fallback: ".local/state",
    relative: "snshah/state.json",
  },
  posh: {
    base: "XDG_DATA_HOME",
    fallback: ".local/share",
    relative: "snshah/bin/oh-my-posh",
  },
  mise: {
    base: "XDG_DATA_HOME",
    fallback: ".local/share",
    relative: "snshah/bin/mise",
  },
  bin: { base: "XDG_BIN_HOME", fallback: ".local/bin", relative: "snshah" },
} as const;
export const upstream = {
  owner: "shah",
  repo: "shah",
  ref: "main",
  directory: "workshop",
} as const;
export const workspacesDefaults = {
  variable: "WORKSPACES_HOME",
  standard: "~/workspaces",
} as const;

// These fail to compile if a union gains a member its list lacks.
const coverage: [
  Covers<typeof shells, Shell>,
  Covers<typeof platforms, Platform>,
  Covers<typeof secretScopes, Secret["scope"]>,
  Covers<typeof selectorKinds, Selector["kind"]>,
  Covers<typeof hookKinds, Hook["kind"]>,
] = [true, true, true, true, true];
void coverage;

export type SecretScope = Secret["scope"];
export type StepKind = (typeof stepKinds)[number];
export type PackageManager = (typeof packageManagers)[number];
export type CommandName = (typeof commandNames)[number];

async function configTypes(): Promise<string> {
  const source = await readFile(import.meta.path, "utf8");
  const begin = "// >>> snshah public types >>>\n";
  const end = "// <<< snshah public types <<<";
  const region = source.slice(
    source.indexOf(begin) + begin.length,
    source.indexOf(end),
  );
  return `// Generated by snshah ${cliVersion} from its public types. Do not edit;\n// \`snshah apply\` rewrites it.\n${region}`;
}

const secretsBegin = "// >>> snshah secrets >>>";
const secretsEnd = "// <<< snshah secrets <<<";
const reposBegin = "// >>> snshah repositories >>>";
const reposEnd = "// <<< snshah repositories <<<";

function secretsBlock(secrets: readonly Secret[]): string {
  return `${secretsBegin}\nconst secrets: Secret[] = ${JSON.stringify(secrets, null, 2)};\n${secretsEnd}`;
}
function reposBlock(repositories: readonly Repository[]): string {
  return `${reposBegin}\nconst repositories: Repository[] = ${JSON.stringify(repositories, null, 2)};\n${reposEnd}`;
}

const initialConfig = `// Private snshah config. Never commit or sync this file; it may hold secrets.
// snshah requires it to be a regular file you own with mode 0600.
// Edit with \`snshah config edit\`, then run \`snshah config check\` and \`snshah plan\`.
import type { Repository, Secret, WorkshopConfig } from "./snshah.auto.d.ts";

// Managed by \`snshah config set-secret\`. A "command" secret reaches only the
// listed commands when they run through snshah; a "shell" secret is also
// exported into every interactive shell.
${secretsBlock([])}

// Managed by \`snshah git add|remove\`.
${reposBlock([])}

// Layers, later wins: built-in defaults, workshop/profile.d (matching files,
// in name order), this file, then $XDG_CONFIG_HOME/snshah/profile.d.
// Leave a setting out to let a profile decide it.
export default {
  // workspacesHome: "~/workspaces", // $WORKSPACES_HOME wins when set
  // prompt: { kind: "oh-my-posh" }, // or { kind: "none" }
  // agents: { claude: { kind: "defaults" }, codex: { kind: "defaults" } },
  // toolManager: { kind: "none" }, // mise is on by default; this turns it off
  // tools: { delta: false, node: "lts" }, // add tools, pin versions, or leave one out
  path: [],
  aliases: {},
  secrets,
  repositories,
} satisfies WorkshopConfig;
`;

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

class UsageError extends Error {}
type Env = Record<string, string | undefined>;
type JsonObject = { [key: string]: unknown };

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function member<const T extends readonly string[]>(
  choices: T,
  value: unknown,
): value is T[number] {
  return (
    typeof value === "string" && choices.some((choice) => choice === value)
  );
}
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
async function exists(path: string): Promise<boolean> {
  return lstat(path).then(
    () => true,
    () => false,
  );
}
async function readText(path: string): Promise<string | undefined> {
  return readFile(path, "utf8").catch(() => undefined);
}
const isWindows = process.platform === "win32";

function versionAtLeast(actual: string, minimum: string): boolean {
  const a = actual.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const m = minimum.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (m[i] ?? 0)) return (a[i] ?? 0) > (m[i] ?? 0);
  }
  return true;
}

function resolveExecutable(name: string, env?: Env): string | undefined {
  if (isAbsolute(name)) return existsSync(name) ? name : undefined;
  return (
    Bun.which(name, { PATH: env?.PATH ?? process.env.PATH ?? "" }) ?? undefined
  );
}

function capture(
  argv: string[],
  options: { cwd?: string; env?: Env } = {},
): string | undefined {
  const executable = resolveExecutable(argv[0]!, options.env);
  if (!executable) return undefined;
  const result = Bun.spawnSync([executable, ...argv.slice(1)], {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  return result.exitCode === 0 ? result.stdout.toString().trim() : undefined;
}

function run(
  argv: string[],
  options: { cwd?: string; env?: Env; quiet?: boolean } = {},
): number {
  const executable = resolveExecutable(argv[0]!, options.env);
  if (!executable)
    throw new Error(
      `${argv[0]} is not on PATH. Run \`snshah doctor\` for install advice.`,
    );
  const result = Bun.spawnSync([executable, ...argv.slice(1)], {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdin: "inherit",
    stdout: options.quiet ? "pipe" : "inherit",
    stderr: options.quiet ? "pipe" : "inherit",
  });
  return result.exitCode ?? 1;
}

/** Write a file atomically, following a symlink to its target so dotfile managers keep working. */
async function writeAtomic(
  path: string,
  content: string | Uint8Array,
  mode: number,
): Promise<void> {
  let target = path;
  if (await exists(path)) target = await realpath(path);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.snshah-${process.pid}.tmp`;
  await writeFile(temporary, content, { mode });
  if (!isWindows) await chmod(temporary, mode);
  await rename(temporary, target);
}

async function fileMode(path: string): Promise<number | undefined> {
  if (isWindows) return undefined;
  return stat(path).then(
    (s) => s.mode & 0o777,
    () => undefined,
  );
}

/** Insert or replace one marked block. Throws on damaged markers rather than guessing. */
export function upsertBlock(
  content: string,
  begin: string,
  end: string,
  block: string,
): string {
  const lines = content.split("\n");
  const first = lines.indexOf(begin);
  const last = lines.indexOf(end);
  if (first === -1 && last === -1) {
    const separator = content === "" || content.endsWith("\n") ? "" : "\n";
    return `${content}${separator}${block}\n`;
  }
  if (
    first < 0 ||
    last <= first ||
    lines.lastIndexOf(begin) !== first ||
    lines.lastIndexOf(end) !== last
  )
    throw new Error(
      `Damaged managed block (${begin}). Fix it by hand, then re-run.`,
    );
  return [...lines.slice(0, first), block, ...lines.slice(last + 1)].join("\n");
}

function quotePosix(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
function quoteFish(value: string): string {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}
function quotePwsh(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

// ---------------------------------------------------------------------------
// Context: platform, strict XDG paths, workspaces root
// ---------------------------------------------------------------------------

export type Context = {
  env: Env;
  platform: Platform;
  omarchy: boolean;
  home: string;
  configDir: string;
  configFile: string;
  typesFile: string;
  profileDir: string;
  dataDir: string;
  repoProfileDir: string;
  installedScript: string;
  installedTheme: string;
  poshBinary: string;
  miseBinary: string;
  /** snshah's own mise config: $XDG_CONFIG_HOME/mise/conf.d/snshah.toml */
  miseToolsFile: string;
  /** mise's shims directory, where installed tools get a launcher. */
  miseShims: string;
  stateFile: string;
  stateDir: string;
  receipt: string;
  cacheDir: string;
  binDir: string;
  wrapper: string;
  windowsWrapper: string;
};

function xdg(
  env: Env,
  home: string,
  variable: string,
  fallback: string,
): string {
  const value = env[variable];
  // The XDG spec says relative values are invalid and must be ignored.
  return value && isAbsolute(value) ? value : join(home, fallback);
}

export function makeContext(env: Env = process.env): Context {
  const home = env.HOME || env.USERPROFILE || homedir();
  const p = (key: keyof typeof xdgPaths) => {
    const spec = xdgPaths[key];
    return join(xdg(env, home, spec.base, spec.fallback), spec.relative);
  };
  const binDir = dirname(p("bin"));
  return {
    env,
    platform: detectPlatform(env),
    omarchy:
      !!Bun.which("omarchy", { PATH: env.PATH ?? "" }) ||
      existsSync(
        join(xdg(env, home, "XDG_DATA_HOME", ".local/share"), "omarchy"),
      ),
    home,
    configDir: dirname(p("config")),
    configFile: p("config"),
    typesFile: p("types"),
    profileDir: p("profiles"),
    dataDir: dirname(p("script")),
    repoProfileDir: p("repoProfiles"),
    installedScript: p("script"),
    installedTheme: p("theme"),
    stateFile: p("state"),
    miseBinary: p("mise") + (process.platform === "win32" ? ".exe" : ""),
    miseToolsFile: join(
      env.MISE_CONFIG_DIR && isAbsolute(env.MISE_CONFIG_DIR)
        ? env.MISE_CONFIG_DIR
        : join(xdg(env, home, "XDG_CONFIG_HOME", ".config"), "mise"),
      "conf.d",
      "snshah.toml",
    ),
    miseShims: join(
      env.MISE_DATA_DIR && isAbsolute(env.MISE_DATA_DIR)
        ? env.MISE_DATA_DIR
        : join(xdg(env, home, "XDG_DATA_HOME", ".local/share"), "mise"),
      "shims",
    ),
    poshBinary: p("posh") + (process.platform === "win32" ? ".exe" : ""),
    stateDir: dirname(p("receipt")),
    receipt: p("receipt"),
    cacheDir: p("downloads"),
    binDir,
    wrapper: p("bin"),
    windowsWrapper: join(binDir, "snshah.cmd"),
  };
}

function detectPlatform(env: Env): Platform {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  if (env.WSL_DISTRO_NAME) return "wsl";
  try {
    const release = readFileSync("/proc/sys/kernel/osrelease", "utf8");
    if (/microsoft/i.test(release)) return "wsl";
  } catch {
    /* not Linux, or no procfs */
  }
  return "linux";
}

function expandHome(ctx: Context, path: string): string {
  if (path === "~") return ctx.home;
  if (path.startsWith("~/") || path.startsWith("~\\"))
    return join(ctx.home, path.slice(2));
  return path;
}

export function workspacesRoot(ctx: Context, config: WorkshopConfig): string {
  const fromEnv = ctx.env[workspacesDefaults.variable];
  if (fromEnv) return resolve(expandHome(ctx, fromEnv));
  if (config.workspacesHome)
    return resolve(expandHome(ctx, config.workspacesHome));
  // Omarchy's ~/Work comes from workshop/profile.d/10-omarchy.ts.
  return expandHome(ctx, workspacesDefaults.standard);
}

/** Show a path with $HOME as ~ so output stays free of account names. */
function tilde(ctx: Context, path: string): string {
  return path === ctx.home ||
    path.startsWith(ctx.home + "/") ||
    path.startsWith(ctx.home + "\\")
    ? "~" + path.slice(ctx.home.length)
    : path;
}

// ---------------------------------------------------------------------------
// Private config: load, validate, rewrite managed blocks
// ---------------------------------------------------------------------------

const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
const commandWord = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
const repoName = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const toolName = /^[A-Za-z0-9][A-Za-z0-9:@/._+-]*$/;
const toolVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._+:@/~^<>=, -]*$/;

function fail(path: string, message: string): never {
  throw new Error(`Config ${path}: ${message}`);
}

export function validateConfig(
  value: unknown,
): asserts value is WorkshopConfig {
  if (!isObject(value))
    fail(
      "default export",
      "must be an object (export default { ... } satisfies WorkshopConfig)",
    );
  const known = [
    "workspacesHome",
    "path",
    "aliases",
    "prompt",
    "toolManager",
    "tools",
    "env",
    "agents",
    "repositories",
    "secrets",
  ];
  for (const key of Object.keys(value))
    if (!known.includes(key)) fail(key, "is not a known setting");
  if (
    value.workspacesHome !== undefined &&
    typeof value.workspacesHome !== "string"
  )
    fail("workspacesHome", "must be a string");
  if (value.path !== undefined) {
    if (
      !Array.isArray(value.path) ||
      !value.path.every((p) => typeof p === "string" && p.length > 0)
    )
      fail("path", "must be an array of non-empty strings");
  }
  if (value.aliases !== undefined) {
    if (!isObject(value.aliases)) fail("aliases", "must be an object");
    for (const [name, alias] of Object.entries(value.aliases)) {
      if (!commandWord.test(name))
        fail(`aliases.${name}`, "is not a valid alias name");
      if (typeof alias === "string") continue;
      if (!isObject(alias))
        fail(`aliases.${name}`, "must be a string or { posix, fish, pwsh }");
      for (const [k, v] of Object.entries(alias))
        if (!["posix", "fish", "pwsh"].includes(k) || typeof v !== "string")
          fail(
            `aliases.${name}.${k}`,
            "must be posix, fish or pwsh with a string value",
          );
    }
  }
  if (value.env !== undefined) {
    if (!isObject(value.env)) fail("env", "must be an object");
    for (const [name, v] of Object.entries(value.env)) {
      if (!identifier.test(name))
        fail(`env.${name}`, "is not a valid variable name");
      if (typeof v !== "string") fail(`env.${name}`, "must be a string");
    }
  }
  if (value.prompt !== undefined) {
    const prompt = value.prompt;
    if (
      !isObject(prompt) ||
      !["oh-my-posh", "none"].includes(String(prompt.kind))
    )
      fail("prompt", 'must be { kind: "oh-my-posh" } or { kind: "none" }');
    if (
      prompt.kind === "oh-my-posh" &&
      prompt.theme !== undefined &&
      typeof prompt.theme !== "string"
    )
      fail("prompt.theme", "must be a path string");
    if (
      prompt.kind === "oh-my-posh" &&
      prompt.install !== undefined &&
      typeof prompt.install !== "boolean"
    )
      fail("prompt.install", "must be true or false");
  }
  if (value.toolManager !== undefined) {
    const manager = value.toolManager;
    if (!isObject(manager) || !["mise", "none"].includes(String(manager.kind)))
      fail("toolManager", 'must be { kind: "mise" } or { kind: "none" }');
  }
  if (value.tools !== undefined) {
    if (!isObject(value.tools)) fail("tools", "must be an object");
    for (const [name, version] of Object.entries(value.tools)) {
      if (!toolName.test(name))
        fail(`tools.${name}`, "is not a valid mise tool name");
      if (
        version !== false &&
        !(typeof version === "string" && toolVersionPattern.test(version))
      )
        fail(
          `tools.${name}`,
          'must be a version string such as "latest" or "1.7.1", or false',
        );
    }
  }
  if (value.agents !== undefined) {
    if (!isObject(value.agents)) fail("agents", "must be an object");
    for (const [agent, setting] of Object.entries(value.agents)) {
      if (!["claude", "codex"].includes(agent))
        fail(`agents.${agent}`, "is not a known agent");
      if (
        !isObject(setting) ||
        !["defaults", "off"].includes(String(setting.kind))
      )
        fail(
          `agents.${agent}`,
          'must be { kind: "defaults" } or { kind: "off" }',
        );
    }
  }
  if (value.secrets !== undefined) {
    if (!Array.isArray(value.secrets)) fail("secrets", "must be an array");
    const seen = new Set<string>();
    value.secrets.forEach((secret: unknown, i: number) => {
      const at = `secrets[${i}]`;
      if (!isObject(secret)) fail(at, "must be an object");
      if (
        typeof secret.variable !== "string" ||
        !identifier.test(secret.variable)
      )
        fail(`${at}.variable`, "must be an environment variable name");
      if (seen.has(secret.variable))
        fail(`${at}.variable`, `${secret.variable} is declared twice`);
      seen.add(secret.variable);
      if (typeof secret.value !== "string")
        fail(`${at}.value`, "must be a string");
      if (secret.scope === "command") {
        if (
          !Array.isArray(secret.commands) ||
          secret.commands.length === 0 ||
          !secret.commands.every(
            (c) => typeof c === "string" && commandWord.test(c),
          )
        )
          fail(`${at}.commands`, "must list at least one command name");
      } else if (secret.scope !== "shell")
        fail(`${at}.scope`, 'must be "command" or "shell"');
    });
  }
  if (value.repositories !== undefined) {
    if (!Array.isArray(value.repositories))
      fail("repositories", "must be an array");
    const names = new Set<string>();
    value.repositories.forEach((repo: unknown, i: number) => {
      const at = `repositories[${i}]`;
      if (!isObject(repo)) fail(at, "must be an object");
      if (typeof repo.name !== "string" || !repoName.test(repo.name))
        fail(`${at}.name`, "is not a valid name");
      if (names.has(repo.name))
        fail(`${at}.name`, `${repo.name} is registered twice`);
      names.add(repo.name);
      if (typeof repo.source !== "string" || !repo.source)
        fail(`${at}.source`, "must be a string");
      if (repo.path !== undefined && typeof repo.path !== "string")
        fail(`${at}.path`, "must be a string");
    });
  }
}

async function configBytes(ctx: Context): Promise<string | undefined> {
  if (!(await exists(ctx.configFile))) return undefined;
  const info = await lstat(ctx.configFile);
  if (!info.isFile())
    throw new Error(
      `${tilde(ctx, ctx.configFile)} must be a regular file, not a link or directory.`,
    );
  if (!isWindows) {
    if (info.uid !== process.getuid?.())
      throw new Error(`${tilde(ctx, ctx.configFile)} must be owned by you.`);
    if ((info.mode & 0o777) !== 0o600)
      throw new Error(
        `${tilde(ctx, ctx.configFile)} must have mode 0600. Run: chmod 600 ${ctx.configFile}`,
      );
  }
  if (info.size > 256 * 1024)
    throw new Error(`${tilde(ctx, ctx.configFile)} is larger than 256 KiB.`);
  const handle = await openFile(
    ctx.configFile,
    constants.O_RDONLY | (isWindows ? 0 : constants.O_NOFOLLOW),
  );
  try {
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}

export async function interpretConfig(source: string): Promise<WorkshopConfig> {
  let result: unknown;
  try {
    const js = new Bun.Transpiler({ loader: "ts" }).transformSync(source);
    const module = await import(
      "data:text/javascript;base64," + Buffer.from(js).toString("base64")
    );
    result = module.default;
  } catch (error) {
    throw new Error(
      `The snshah config could not be loaded (${(error as Error).message}). Use only type imports in it.`,
    );
  }
  validateConfig(result);
  return result;
}

const defaultAliases: Record<string, AliasValue> = {
  gs: "git status --short --branch",
  gd: "git diff",
  gds: "git diff --staged",
  gl: "git log --oneline --graph --decorate",
};

/** The built-in layer: generic defaults, plus this repository's own checkout. */
const defaultConfig: WorkshopConfig = {
  aliases: defaultAliases,
  repositories: [
    {
      name: upstream.repo,
      source: `https://github.com/${upstream.owner}/${upstream.repo}.git`,
    },
  ],
  prompt: { kind: "oh-my-posh" },
  toolManager: { kind: "mise" },
  tools: { ...defaultTools },
  agents: { claude: { kind: "defaults" }, codex: { kind: "defaults" } },
};

async function loadConfig(
  ctx: Context,
): Promise<{ config: WorkshopConfig; source?: string }> {
  const source = await configBytes(ctx);
  if (source === undefined) return { config: defaultConfig };
  return { config: await interpretConfig(source), source };
}

async function saveConfigBlock(
  ctx: Context,
  begin: string,
  end: string,
  block: string,
): Promise<boolean> {
  const source = (await configBytes(ctx)) ?? initialConfig;
  const next = upsertBlock(source, begin, end, block);
  if (next === source) return false;
  await interpretConfig(next); // never save a config that would not load
  if (!(await exists(ctx.configDir)))
    await mkdir(ctx.configDir, { recursive: true, mode: 0o700 });
  await writeAtomic(ctx.configFile, next, 0o600);
  return true;
}

// ---------------------------------------------------------------------------
// profile.d: typed selectors, typed contributions, typed hooks, typed merge
// ---------------------------------------------------------------------------

export type Origin = "repo" | "private";
export type LoadedProfile = {
  id: string;
  origin: Origin;
  file: string;
  selector: Selector;
  config: Contribution;
  hooks: Hook[];
};
/** Facts plus lazy lookups, so a shell start never pays for what no selector asks. */
export type FactSource = {
  platform: Platform;
  distro: string[];
  omarchy: boolean;
  hostname: string;
  machine: () => string;
  has: (command: string) => boolean;
  env: Env;
};

const profileId = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const hookComments = ["#", "//", ";", "--", "<!--"] as const;

/** PRETTY_NAME from /etc/os-release, e.g. "Debian GNU/Linux 13 (trixie)". */
function distroName(): string | undefined {
  try {
    const text = readFileSync("/etc/os-release", "utf8");
    return (
      /^PRETTY_NAME=(.*)$/m.exec(text)?.[1]?.replaceAll('"', "") || undefined
    );
  } catch {
    return undefined;
  }
}

function osRelease(): string[] {
  let text = "";
  try {
    text = readFileSync("/etc/os-release", "utf8");
  } catch {
    return [];
  }
  const field = (name: string) =>
    (new RegExp(`^${name}=(.*)$`, "m").exec(text)?.[1] ?? "")
      .replaceAll('"', "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  return [...new Set([...field("ID"), ...field("ID_LIKE")])];
}

/** A salted, truncated hash of the OS machine ID: stable per install, not reversible. */
export function machineFingerprint(): string {
  let id: string | undefined;
  for (const path of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
    try {
      id = readFileSync(path, "utf8").trim();
      if (id) break;
    } catch {
      /* try the next source */
    }
  }
  if (!id && process.platform === "darwin")
    id = /"IOPlatformUUID" = "([^"]+)"/.exec(
      capture(["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"]) ?? "",
    )?.[1];
  if (!id && isWindows)
    id = /MachineGuid\s+REG_SZ\s+(\S+)/.exec(
      capture([
        "reg",
        "query",
        "HKLM\\SOFTWARE\\Microsoft\\Cryptography",
        "/v",
        "MachineGuid",
      ]) ?? "",
    )?.[1];
  if (!id) return "unknown";
  return createHash("sha256")
    .update(`snshah:${id.toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);
}

export function validateFacts(value: unknown): asserts value is Facts {
  function bad(m: string): never {
    throw new Error(`Facts file: ${m}`);
  }
  if (!isObject(value)) bad("must be a JSON object");
  if (!member(platforms, value.platform))
    bad(`platform must be one of ${platforms.join(", ")}`);
  if (
    !Array.isArray(value.distro) ||
    !value.distro.every((d) => typeof d === "string")
  )
    bad("distro must be an array of strings");
  if (typeof value.omarchy !== "boolean") bad("omarchy must be true or false");
  if (typeof value.hostname !== "string") bad("hostname must be a string");
  if (typeof value.machine !== "string") bad("machine must be a string");
  if (
    value.commands !== undefined &&
    (!Array.isArray(value.commands) ||
      !value.commands.every((c) => typeof c === "string"))
  )
    bad("commands must be an array of strings");
}

export function factSource(ctx: Context): FactSource {
  const PATH = ctx.env.PATH ?? "";
  const fake = ctx.env.SNSHAH_FACTS;
  if (fake) {
    const facts: unknown = JSON.parse(readFileSync(fake, "utf8"));
    validateFacts(facts);
    return {
      platform: facts.platform,
      distro: facts.distro.map((d) => d.toLowerCase()),
      omarchy: facts.omarchy,
      hostname: facts.hostname.toLowerCase(),
      machine: () => facts.machine,
      has: (c) =>
        facts.commands ? facts.commands.includes(c) : !!Bun.which(c, { PATH }),
      env: ctx.env,
    };
  }
  let fingerprint: string | undefined;
  return {
    platform: ctx.platform,
    distro:
      ctx.platform === "linux" || ctx.platform === "wsl" ? osRelease() : [],
    omarchy: ctx.omarchy,
    hostname: hostname().toLowerCase(),
    machine: () => (fingerprint ??= machineFingerprint()),
    has: (c) => !!Bun.which(c, { PATH }),
    env: ctx.env,
  };
}

export function factsOf(source: FactSource): Facts {
  return {
    platform: source.platform,
    distro: source.distro,
    omarchy: source.omarchy,
    hostname: source.hostname,
    machine: source.machine(),
  };
}

export function matches(selector: Selector, facts: FactSource): boolean {
  switch (selector.kind) {
    case "always":
      return true;
    case "platform":
      return facts.platform === selector.is;
    case "distro":
      return facts.distro.includes(selector.id.toLowerCase());
    case "omarchy":
      return facts.omarchy;
    case "has":
      return facts.has(selector.command);
    case "env": {
      const value = facts.env[selector.name];
      return selector.equals === undefined
        ? !!value
        : value === selector.equals;
    }
    case "hostname": {
      const want = selector.is.toLowerCase();
      return facts.hostname === want || facts.hostname.split(".")[0] === want;
    }
    case "machine":
      return facts.machine() === selector.fingerprint.toLowerCase();
    case "all":
      return selector.of.every((s) => matches(s, facts));
    case "any":
      return selector.of.some((s) => matches(s, facts));
    case "not":
      return !matches(selector.selector, facts);
    default:
      return assertNever(selector);
  }
}

export function validateSelector(
  value: unknown,
  origin: Origin,
  at = "selector",
): asserts value is Selector {
  if (!isObject(value) || !member(selectorKinds, value.kind))
    fail(at, `must be a Selector ({ kind: ${selectorKinds.join(" | ")} })`);
  const str = (key: string) => {
    if (typeof value[key] !== "string" || !value[key])
      fail(`${at}.${key}`, "must be a non-empty string");
  };
  const kind = value.kind as Selector["kind"];
  switch (kind) {
    case "always":
    case "omarchy":
      return;
    case "platform":
      if (!member(platforms, value.is))
        fail(`${at}.is`, `must be one of ${platforms.join(", ")}`);
      return;
    case "distro":
      return str("id");
    case "has":
      return str("command");
    case "env":
      str("name");
      if (value.equals !== undefined && typeof value.equals !== "string")
        fail(`${at}.equals`, "must be a string");
      return;
    case "hostname":
      if (origin === "repo")
        fail(
          at,
          "hostname selectors belong in $XDG_CONFIG_HOME/snshah/profile.d, never in the public repository",
        );
      return str("is");
    case "machine":
      str("fingerprint");
      if (!/^[0-9a-f]{16}$/i.test(String(value.fingerprint)))
        fail(`${at}.fingerprint`, "must be 16 hex digits from snshah whoami");
      return;
    case "all":
    case "any":
      if (!Array.isArray(value.of) || value.of.length === 0)
        fail(`${at}.of`, "must list at least one selector");
      (value.of as unknown[]).forEach((s, i) =>
        validateSelector(s, origin, `${at}.of[${i}]`),
      );
      return;
    case "not":
      return validateSelector(value.selector, origin, `${at}.selector`);
    default:
      assertNever(kind);
  }
}

export function validateHooks(
  value: unknown,
  origin: Origin,
): asserts value is Hook[] {
  if (!Array.isArray(value)) fail("hooks", "must be an array");
  value.forEach((hook: unknown, i: number) => {
    const at = `hooks[${i}]`;
    if (!isObject(hook) || !member(hookKinds, hook.kind))
      fail(at, `must be a Hook ({ kind: ${hookKinds.join(" | ")} })`);
    const kind = hook.kind as Hook["kind"];
    const argv = (key: string) => {
      const v = hook[key];
      if (
        !Array.isArray(v) ||
        v.length === 0 ||
        !v.every((a) => typeof a === "string")
      )
        fail(`${at}.${key}`, "must be a non-empty array of strings");
    };
    switch (kind) {
      case "file":
      case "block":
        if (typeof hook.path !== "string" || !hook.path)
          fail(`${at}.path`, "must be a path");
        if (typeof hook.content !== "string")
          fail(`${at}.content`, "must be a string");
        if (kind === "file" && hook.mode !== undefined) {
          if (
            typeof hook.mode !== "number" ||
            !Number.isInteger(hook.mode) ||
            hook.mode < 0 ||
            hook.mode > 0o777
          )
            fail(`${at}.mode`, "must be a file mode such as 0o644");
        }
        if (
          kind === "block" &&
          hook.comment !== undefined &&
          !member(hookComments, hook.comment)
        )
          fail(`${at}.comment`, `must be one of ${hookComments.join(" ")}`);
        return;
      case "command": {
        if (!["before-apply", "after-apply"].includes(String(hook.phase)))
          fail(`${at}.phase`, 'must be "before-apply" or "after-apply"');
        argv("run");
        argv("unless");
        if (hook.cwd !== undefined && typeof hook.cwd !== "string")
          fail(`${at}.cwd`, "must be a path");
        if (hook.env === undefined) return;
        const env = hook.env;
        if (!isObject(env)) fail(`${at}.env`, "must be an object");
        if (
          env.pass !== undefined &&
          env.pass !== "all" &&
          !(
            Array.isArray(env.pass) &&
            env.pass.every((n) => typeof n === "string" && identifier.test(n))
          )
        )
          fail(`${at}.env.pass`, 'must be "all" or variable names');
        if (env.set !== undefined) {
          if (!isObject(env.set)) fail(`${at}.env.set`, "must be an object");
          for (const [k, v] of Object.entries(env.set))
            if (!identifier.test(k) || typeof v !== "string")
              fail(
                `${at}.env.set.${k}`,
                "must map a variable name to a string",
              );
        }
        if (env.secrets !== undefined) {
          if (origin === "repo")
            fail(
              `${at}.env.secrets`,
              "only private profiles may pass secrets to commands",
            );
          if (
            !Array.isArray(env.secrets) ||
            !env.secrets.every(
              (n) => typeof n === "string" && identifier.test(n),
            )
          )
            fail(`${at}.env.secrets`, "must list secret variable names");
        }
        return;
      }
      default:
        assertNever(kind);
    }
  });
}

async function loadProfileDir(
  dir: string,
  origin: Origin,
): Promise<LoadedProfile[]> {
  if (!existsSyncDir(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
    .sort();
  const loaded: LoadedProfile[] = [];
  for (const file of files) {
    const path = join(dir, file);
    const id = file.slice(0, -3);
    const where = `${origin} profile ${file}`;
    if (!profileId.test(id)) throw new Error(`${where}: invalid file name.`);
    const info = await lstat(path);
    if (!info.isFile())
      throw new Error(`${where}: must be a regular file, not a link.`);
    if (origin === "private" && !isWindows) {
      if (info.uid !== process.getuid?.())
        throw new Error(`${where}: must be owned by you.`);
      if (info.mode & 0o022)
        throw new Error(
          `${where}: must not be writable by group or others (chmod 600).`,
        );
    }
    let module: Record<string, unknown>;
    try {
      module = await import(pathToFileURL(path).href);
    } catch (error) {
      throw new Error(
        `${where}: could not load (${(error as Error).message}).`,
      );
    }
    try {
      for (const key of Object.keys(module))
        if (!["selector", "config", "hooks"].includes(key))
          fail(key, "is not a profile export (use selector, config, hooks)");
      validateSelector(module.selector, origin);
      const config = module.config ?? {};
      validateConfig(config);
      if (config.secrets !== undefined)
        fail("config.secrets", "secrets belong only in snshah.conf.ts");
      const hooks = module.hooks ?? [];
      validateHooks(hooks, origin);
      loaded.push({
        id,
        origin,
        file: path,
        selector: module.selector,
        config,
        hooks,
      });
    } catch (error) {
      throw new Error(`${where}: ${(error as Error).message}`);
    }
  }
  return loaded;
}

// Typed merge: the compiler requires one rule per config key.
type Mergers = {
  [K in keyof WorkshopConfig]-?: (
    a: WorkshopConfig[K],
    b: WorkshopConfig[K],
  ) => WorkshopConfig[K];
};
function later<T>(a: T, b: T): T {
  return b === undefined ? a : b;
}
function byKey<T, K extends keyof T>(key: K) {
  return (a: T[] | undefined, b: T[] | undefined): T[] | undefined => {
    if (!a && !b) return undefined;
    const out = new Map<T[K], T>();
    for (const item of [...(a ?? []), ...(b ?? [])]) {
      out.delete(item[key]);
      out.set(item[key], item);
    }
    return [...out.values()];
  };
}
const mergers: Mergers = {
  // Scalars and tagged unions: a later layer replaces the value whole.
  workspacesHome: later,
  prompt: later,
  toolManager: later,
  // Records: a later layer's keys win; each agent's union is replaced whole.
  aliases: (a, b) => (a || b ? { ...a, ...b } : undefined),
  tools: (a, b) => (a || b ? { ...a, ...b } : undefined),
  env: (a, b) => (a || b ? { ...a, ...b } : undefined),
  agents: (a, b) => (a || b ? { ...a, ...b } : undefined),
  // Lists: concatenate; keyed lists let a later layer replace an entry.
  path: (a, b) =>
    a || b ? [...new Set([...(a ?? []), ...(b ?? [])])] : undefined,
  repositories: byKey<Repository, "name">("name"),
  secrets: byKey<Secret, "variable">("variable"),
};

export function mergeConfig(
  a: WorkshopConfig,
  b: WorkshopConfig,
): WorkshopConfig {
  const out: WorkshopConfig = {};
  const keys = Object.keys(mergers) as (keyof WorkshopConfig)[];
  for (const key of keys) {
    const merge = mergers[key] as (x: unknown, y: unknown) => unknown;
    const value = merge(a[key], b[key]);
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

export type Override = { key: string; from: string; to: string };
export type Effective = {
  config: WorkshopConfig;
  privateConfig: WorkshopConfig;
  privateSource?: string;
  facts: FactSource;
  profiles: Array<{ id: string; origin: Origin; matched: boolean }>;
  hooks: Array<{ profile: string; origin: Origin; hook: Hook }>;
  overrides: Override[];
};

/** Settings a layer sets that are replaced whole, for plan --explain. */
function overridable(config: WorkshopConfig): Map<string, string> {
  const out = new Map<string, string>();
  if (config.workspacesHome !== undefined)
    out.set("workspacesHome", JSON.stringify(config.workspacesHome));
  if (config.prompt) out.set("prompt", JSON.stringify(config.prompt));
  if (config.toolManager)
    out.set("toolManager", JSON.stringify(config.toolManager));
  for (const [k, v] of Object.entries(config.tools ?? {}))
    out.set(`tools.${k}`, JSON.stringify(v));
  for (const [k, v] of Object.entries(config.env ?? {}))
    out.set(`env.${k}`, JSON.stringify(v));
  for (const [k, v] of Object.entries(config.agents ?? {}))
    out.set(`agents.${k}`, JSON.stringify(v));
  for (const [k, v] of Object.entries(config.aliases ?? {}))
    out.set(`aliases.${k}`, JSON.stringify(v));
  for (const r of config.repositories ?? [])
    out.set(`repositories.${r.name}`, JSON.stringify(r));
  return out;
}

export function repoProfileSource(): string {
  return join(import.meta.dir, "profile.d");
}

export async function loadEffective(ctx: Context): Promise<Effective> {
  const facts = factSource(ctx);
  const { config: privateConfig, source } = await loadConfig(ctx);
  const repo = await loadProfileDir(repoProfileSource(), "repo");
  const mine = await loadProfileDir(ctx.profileDir, "private");
  const layers: Array<{ name: string; config: WorkshopConfig }> = [
    { name: "built-in", config: defaultConfig },
  ];
  const profiles: Effective["profiles"] = [];
  const hooks: Effective["hooks"] = [];
  const use = (p: LoadedProfile) => {
    const matched = matches(p.selector, facts);
    profiles.push({ id: p.id, origin: p.origin, matched });
    if (!matched) return;
    layers.push({ name: `${p.origin}:${p.id}`, config: p.config });
    for (const hook of p.hooks)
      hooks.push({ profile: p.id, origin: p.origin, hook });
  };
  repo.forEach(use);
  layers.push({ name: "snshah.conf.ts", config: privateConfig });
  mine.forEach(use);

  const overrides: Override[] = [];
  const owner = new Map<string, { layer: string; value: string }>();
  let config: WorkshopConfig = {};
  for (const layer of layers) {
    for (const [key, value] of overridable(layer.config)) {
      const previous = owner.get(key);
      if (previous && previous.value !== value)
        overrides.push({ key, from: previous.layer, to: layer.name });
      owner.set(key, { layer: layer.name, value });
    }
    config = mergeConfig(config, layer.config);
  }
  return {
    config,
    privateConfig,
    privateSource: source,
    facts,
    profiles,
    hooks,
    overrides,
  };
}

/** The base environment every command hook gets, before `pass`, `set` and `secrets`. */
const baseCommandEnv = [
  "PATH",
  "HOME",
  "USER",
  "USERNAME",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "TERM",
  "TMPDIR",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_STATE_HOME",
  "XDG_CACHE_HOME",
  "XDG_RUNTIME_DIR",
  "XDG_BIN_HOME",
  "WORKSPACES_HOME",
  // Windows needs these for almost any child process to start.
  "SystemRoot",
  "SYSTEMROOT",
  "COMSPEC",
  "PATHEXT",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "TEMP",
  "TMP",
  "ProgramData",
  "ProgramFiles",
];

export function commandEnv(
  parent: Env,
  spec: CommandEnv | undefined,
  secrets: readonly Secret[],
  where: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  const copy = (name: string) => {
    const v = parent[name];
    if (v !== undefined) out[name] = v;
  };
  if (spec?.pass === "all")
    for (const [k, v] of Object.entries(parent)) {
      if (v !== undefined) out[k] = v;
    }
  else {
    baseCommandEnv.forEach(copy);
    (spec?.pass ?? []).forEach(copy);
  }
  Object.assign(out, spec?.set ?? {});
  for (const name of spec?.secrets ?? []) {
    const secret = secrets.find((s) => s.variable === name);
    if (!secret)
      throw new Error(
        `${where}: secret ${name} is not declared in snshah.conf.ts.`,
      );
    out[name] = secret.value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Plan: the desired end state, as steps that differ from what is on disk
// ---------------------------------------------------------------------------

/** The pinned Oh My Posh build for this OS and CPU, if there is one. */
export function poshTarget(
  os: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): PoshTarget | undefined {
  const name =
    os === "linux"
      ? "linux"
      : os === "darwin"
        ? "darwin"
        : os === "win32"
          ? "windows"
          : undefined;
  const cpu = arch === "x64" ? "x64" : arch === "arm64" ? "arm64" : undefined;
  const target = name && cpu ? `${name}-${cpu}` : undefined;
  return target && target in ohMyPosh.assets
    ? (target as PoshTarget)
    : undefined;
}

async function sha256Of(path: string): Promise<string | undefined> {
  try {
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(await Bun.file(path).arrayBuffer());
    return hasher.digest("hex");
  } catch {
    return undefined;
  }
}

/** One download step for a pinned release file that is missing or not the pinned build. */
async function planPinned(
  ctx: Context,
  pin: {
    label: string;
    url: string;
    sha256: string;
    cacheName: string;
    path: string;
  },
): Promise<Step | undefined> {
  const current = await sha256Of(pin.path);
  if (current === pin.sha256) return;
  return {
    kind: "download",
    url: pin.url,
    sha256: pin.sha256,
    cache: join(ctx.cacheDir, pin.cacheName),
    path: pin.path,
    mode: 0o755,
    label: pin.label,
    create: current === undefined,
  };
}

/** Oh My Posh, when the prompt wants it and none is on PATH. */
async function planPosh(
  ctx: Context,
  config: WorkshopConfig,
): Promise<Step | undefined> {
  const prompt = config.prompt ?? { kind: "oh-my-posh" };
  if (prompt.kind !== "oh-my-posh" || prompt.install === false) return;
  if (Bun.which("oh-my-posh", { PATH: ctx.env.PATH ?? "" })) return;
  const target = poshTarget();
  if (!target) return;
  const asset = ohMyPosh.assets[target];
  return planPinned(ctx, {
    label: `Oh My Posh ${ohMyPosh.version}`,
    url: `https://github.com/JanDeDobbeleer/oh-my-posh/releases/download/v${ohMyPosh.version}/${asset.file}`,
    sha256: asset.sha256,
    cacheName: `oh-my-posh-${ohMyPosh.version}-${asset.file}`,
    path: ctx.poshBinary,
  });
}

/** The pinned mise build for this OS and CPU, if there is one. */
export function miseTarget(
  os: NodeJS.Platform = process.platform,
  arch: string = process.arch,
  musl: boolean = existsSync("/etc/alpine-release"),
): MiseTarget | undefined {
  const cpu = arch === "x64" ? "x64" : arch === "arm64" ? "arm64" : undefined;
  if (!cpu) return;
  const name =
    os === "linux"
      ? `linux-${cpu}${musl ? "-musl" : ""}`
      : os === "darwin"
        ? `macos-${cpu}`
        : os === "win32"
          ? `windows-${cpu}`
          : undefined;
  return name && name in miseRelease.assets ? (name as MiseTarget) : undefined;
}

function miseOnPath(ctx: Context): string | undefined {
  return Bun.which("mise", { PATH: ctx.env.PATH ?? "" }) ?? undefined;
}

/** The mise this machine uses: one already on PATH, else snshah's pinned copy. */
function miseBinaryFor(ctx: Context): string {
  return miseOnPath(ctx) ?? ctx.miseBinary;
}

function toolManagerOn(config: WorkshopConfig): boolean {
  return (config.toolManager ?? { kind: "mise" }).kind === "mise";
}

/** The tools snshah asks mise for: every `tools` entry that is not false, sorted. */
export function wantedTools(config: WorkshopConfig): Array<[string, string]> {
  if (!toolManagerOn(config)) return [];
  return Object.entries(config.tools ?? {})
    .filter((e): e is [string, string] => e[1] !== false)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** snshah's mise config, a conf.d file mise reads after (and yields to) your own config.toml. */
export function miseToolsToml(tools: ReadonlyArray<[string, string]>): string {
  return [
    "# Managed by snshah (github.com/shah/shah, workshop/). Regenerated by `snshah apply`.",
    "# Your own mise config.toml wins over this file. Change the list in snshah.conf.ts",
    '# (`tools`), or turn mise off with `toolManager: { kind: "none" }`.',
    "[tools]",
    ...tools.map(
      ([name, version]) =>
        `${JSON.stringify(name)} = ${JSON.stringify(version)}`,
    ),
    "",
  ].join("\n");
}

function cleanEnv(env: Env): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter(
      (e): e is [string, string] => e[1] !== undefined,
    ),
  );
}

/** The wanted tools that `mise ls` does not report as installed. Any failure counts as missing. */
export function miseMissing(
  binary: string,
  env: Record<string, string>,
  cwd: string,
  names: readonly string[],
): string[] {
  try {
    const r = Bun.spawnSync([binary, "ls", "--json"], {
      env,
      cwd,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "ignore",
      timeout: 30_000,
    });
    if (r.exitCode !== 0) return [...names];
    const listed: unknown = JSON.parse(r.stdout.toString());
    if (!isObject(listed)) return [...names];
    return names.filter((name) => {
      const entries = listed[name];
      return !(
        Array.isArray(entries) &&
        entries.some((e) => isObject(e) && e.installed === true)
      );
    });
  } catch {
    return [...names];
  }
}

/** mise itself (when none is on PATH). */
async function planMise(
  ctx: Context,
  config: WorkshopConfig,
): Promise<Step | undefined> {
  if (!toolManagerOn(config) || miseOnPath(ctx)) return;
  const target = miseTarget();
  if (!target) return;
  const asset = miseRelease.assets[target];
  return planPinned(ctx, {
    label: `mise ${miseRelease.version}`,
    url: `https://github.com/jdx/mise/releases/download/v${miseRelease.version}/${asset.file}`,
    sha256: asset.sha256,
    cacheName: `mise-${miseRelease.version}-${asset.file}`,
    path: ctx.miseBinary,
  });
}

/**
 * The tool list file and mise itself come first; installing the tools comes
 * last, after the rest of the apply, so a slow or failed download never blocks
 * the startup files and CLI.
 */
async function planTools(
  ctx: Context,
  config: WorkshopConfig,
): Promise<{ early: Step[]; late: Step[] }> {
  const early: Step[] = [];
  const late: Step[] = [];
  const wanted = wantedTools(config);
  const file = ctx.miseToolsFile;
  if (!wanted.length) {
    if (await exists(file))
      early.push({
        kind: "remove",
        path: file,
        label: toolManagerOn(config)
          ? "mise tool list (no tools wanted)"
          : "mise tool list (tool manager off)",
      });
    return { early, late };
  }
  early.push(
    ...(await contentStep(
      "file",
      file,
      miseToolsToml(wanted),
      0o644,
      "mise tool list",
    )),
  );
  const download = await planMise(ctx, config);
  if (download) early.push(download);
  const binary = miseBinaryFor(ctx);
  const present = await exists(binary);
  const names = wanted.map(([name]) => name);
  const env = cleanEnv(ctx.env);
  const missing = present ? miseMissing(binary, env, ctx.home, names) : names;
  if (missing.length && (present || download))
    late.push({
      kind: "tools",
      binary,
      names: missing,
      env,
      cwd: ctx.home,
      label: "developer tools (mise)",
    });
  return { early, late };
}

/** Fetch a pinned file into the cache (reusing a verified copy), then install it. */
async function download(
  step: Extract<Step, { kind: "download" }>,
): Promise<void> {
  let bytes: Uint8Array | undefined;
  if ((await sha256Of(step.cache)) === step.sha256)
    bytes = new Uint8Array(await Bun.file(step.cache).arrayBuffer());
  if (!bytes) {
    const response = await fetch(step.url);
    if (!response.ok)
      throw new Error(
        `${step.label}: download failed (HTTP ${response.status}).`,
      );
    bytes = new Uint8Array(await response.arrayBuffer());
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(bytes);
    if (hasher.digest("hex") !== step.sha256)
      throw new Error(
        `${step.label}: checksum mismatch; nothing was installed.`,
      );
    await writeAtomic(step.cache, bytes, 0o644);
  }
  await writeAtomic(step.path, bytes, step.mode);
}

export type Step =
  | { kind: "directory"; path: string; mode: number; label: string }
  | {
      kind: "file";
      path: string;
      content: string;
      mode: number;
      label: string;
      create: boolean;
    }
  | {
      kind: "seed";
      path: string;
      content: string;
      mode: number;
      label: string;
      create: boolean;
    }
  | {
      kind: "block";
      path: string;
      content: string;
      mode: number;
      label: string;
      create: boolean;
    }
  | {
      kind: "json-fill";
      path: string;
      content: string;
      mode: number;
      label: string;
      create: boolean;
    }
  | {
      kind: "toml-fill";
      path: string;
      content: string;
      mode: number;
      label: string;
      create: boolean;
    }
  | { kind: "remove"; path: string; label: string }
  | {
      kind: "tools";
      binary: string;
      names: string[];
      env: Record<string, string>;
      cwd: string;
      label: string;
    }
  | {
      kind: "download";
      url: string;
      sha256: string;
      cache: string;
      path: string;
      mode: number;
      label: string;
      create: boolean;
    }
  | {
      kind: "command";
      phase: "before-apply" | "after-apply";
      run: string[];
      unless: string[];
      env: Record<string, string>;
      cwd?: string;
      path: string;
      label: string;
    };

type ContentStep = Exclude<
  Step,
  { kind: "directory" | "remove" | "command" | "download" | "tools" }
>;

async function contentStep<K extends ContentStep["kind"]>(
  kind: K,
  path: string,
  content: string,
  mode: number,
  label: string,
): Promise<Step[]> {
  const current = await readText(path);
  const currentMode = await fileMode(path);
  const keepMode =
    kind === "block" || kind === "json-fill" || kind === "toml-fill";
  const wantedMode = keepMode && currentMode !== undefined ? currentMode : mode;
  if (
    current === content &&
    (currentMode === undefined || currentMode === wantedMode)
  )
    return [];
  return [
    {
      kind,
      path,
      content,
      mode: wantedMode,
      label,
      create: current === undefined,
    } as Step,
  ];
}

const shellBegin = "# >>> snshah shell >>>";
const shellEnd = "# <<< snshah shell <<<";
const docLine =
  "# Managed by snshah (github.com/shah/shah, workshop/). Delete this block to opt out.";

function wrapperFor(ctx: Context, shell: Shell): string {
  return isWindows && shell === "pwsh" ? ctx.windowsWrapper : ctx.wrapper;
}

/** The single thing each shell's startup file gets. */
export function rcBlock(ctx: Context, shell: Shell): string {
  const wrapper = wrapperFor(ctx, shell);
  const relative = wrapper.startsWith(ctx.home)
    ? wrapper.slice(ctx.home.length).replaceAll("\\", "/")
    : undefined;
  switch (shell) {
    case "bash":
    case "zsh": {
      const target = relative
        ? `"$HOME"${quotePosix(relative)}`
        : quotePosix(wrapper);
      return [
        shellBegin,
        docLine,
        "case $- in",
        `  *i*) if [ -x ${target} ]; then eval "$(${target} shell ${shell} --greet)"; fi ;;`,
        "esac",
        shellEnd,
      ].join("\n");
    }
    case "fish": {
      const target = relative
        ? `"$HOME"${quoteFish(relative)}`
        : quoteFish(wrapper);
      return [
        docLine,
        `if status is-interactive; and test -x ${target}`,
        `    ${target} shell fish --greet | source`,
        "end",
        "",
      ].join("\n");
    }
    case "pwsh": {
      const target = relative
        ? `(Join-Path $HOME ${quotePwsh(relative.slice(1))})`
        : quotePwsh(wrapper);
      return [
        shellBegin,
        docLine,
        `$__snshah = ${target}`,
        'if (Test-Path -LiteralPath $__snshah) { (& $__snshah shell pwsh --greet) -join "`n" | Invoke-Expression }',
        "Remove-Variable __snshah -ErrorAction SilentlyContinue",
        shellEnd,
      ].join("\n");
    }
    default:
      return assertNever(shell);
  }
}

function forcedShells(ctx: Context): Shell[] | undefined {
  const forced = ctx.env.SNSHAH_SHELLS;
  if (!forced) return undefined;
  return forced
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Shell => member(shells, s));
}

function detectedShells(ctx: Context): Shell[] {
  const forced = forcedShells(ctx);
  if (forced) return forced;
  const PATH = ctx.env.PATH ?? "";
  return shells.filter((shell) => {
    const found = Bun.which(shell, { PATH });
    // WSL's launcher in System32 is not a bash for Windows-side startup files.
    return !!found && !(isWindows && /\\system32\\bash\.exe$/i.test(found));
  });
}

function pwshProfile(ctx: Context): string {
  if (!forcedShells(ctx)) {
    const reported = capture(
      [
        "pwsh",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$PROFILE.CurrentUserAllHosts",
      ],
      {
        env: ctx.env as Record<string, string>,
      },
    );
    if (reported) return reported;
  }
  return isWindows
    ? join(ctx.home, "Documents", "PowerShell", "profile.ps1")
    : join(
        xdg(ctx.env, ctx.home, "XDG_CONFIG_HOME", ".config"),
        "powershell",
        "profile.ps1",
      );
}

function rcFile(ctx: Context, shell: Shell): string {
  switch (shell) {
    case "bash":
      return join(ctx.home, ".bashrc");
    case "zsh":
      return join(ctx.env.ZDOTDIR || ctx.home, ".zshrc");
    case "fish":
      return join(
        xdg(ctx.env, ctx.home, "XDG_CONFIG_HOME", ".config"),
        "fish",
        "conf.d",
        "snshah.fish",
      );
    case "pwsh":
      return pwshProfile(ctx);
    default:
      return assertNever(shell);
  }
}

function themeSource(): string {
  return join(import.meta.dir, "snshah.omp.json");
}

function wrapperScripts(
  ctx: Context,
): Array<{ path: string; content: string }> {
  const bun = process.execPath;
  const posix = [
    "#!/bin/sh",
    "# Managed by snshah. `snshah apply` rewrites this file.",
    `exec ${quotePosix(bun.replaceAll("\\", "/"))} --no-env-file ${quotePosix(ctx.installedScript.replaceAll("\\", "/"))} "$@"`,
    "",
  ].join("\n");
  const scripts = [{ path: ctx.wrapper, content: posix }];
  if (isWindows)
    scripts.push({
      path: ctx.windowsWrapper,
      content: `@echo off\r\nrem Managed by snshah. \`snshah apply\` rewrites this file.\r\n"${bun}" --no-env-file "${ctx.installedScript}" %*\r\n`,
    });
  return scripts;
}

export async function plan(
  ctx: Context,
  options: { revision?: string; effective?: Effective } = {},
): Promise<Step[]> {
  const effective = options.effective ?? (await loadEffective(ctx));
  const { config } = effective;
  const steps: Step[] = [];
  const before: Step[] = [];
  const after: Step[] = [];
  const directory = async (path: string, mode: number, label: string) => {
    if (await exists(path)) {
      if (!(await stat(path)).isDirectory())
        throw new Error(`${tilde(ctx, path)} exists and is not a directory.`);
      const current = await fileMode(path);
      if (current === undefined || current === mode || mode !== 0o700) return;
    }
    steps.push({ kind: "directory", path, mode, label });
  };

  await directory(ctx.configDir, 0o700, "private config directory");
  await directory(ctx.profileDir, 0o700, "private profile.d");
  await directory(ctx.dataDir, 0o755, "installed CLI directory");
  await directory(ctx.stateDir, 0o755, "state directory");
  await directory(ctx.cacheDir, 0o755, "download cache");
  await directory(ctx.binDir, 0o755, "user bin directory");
  await directory(workspacesRoot(ctx, config), 0o755, "workspaces root");

  // The private config is seeded once and then never touched by apply,
  // except to restore mode 0600.
  const configSource = await readText(ctx.configFile);
  if (configSource === undefined) {
    steps.push({
      kind: "seed",
      path: ctx.configFile,
      content: initialConfig,
      mode: 0o600,
      label: "private config",
      create: true,
    });
  } else if (
    (await fileMode(ctx.configFile)) !== undefined &&
    (await fileMode(ctx.configFile)) !== 0o600
  ) {
    steps.push({
      kind: "seed",
      path: ctx.configFile,
      content: configSource,
      mode: 0o600,
      label: "private config mode",
      create: false,
    });
  }
  steps.push(
    ...(await contentStep(
      "file",
      ctx.typesFile,
      await configTypes(),
      0o600,
      "config type declarations",
    )),
  );

  // Paths snshah owns outright; a profile's file hook may not claim them.
  const owned = new Map<string, string>([
    [ctx.configFile, "snshah"],
    [ctx.typesFile, "snshah"],
    [ctx.installedTheme, "snshah"],
    [ctx.poshBinary, "snshah"],
    [ctx.miseBinary, "snshah"],
    [ctx.miseToolsFile, "snshah"],
    [ctx.installedScript, "snshah"],
    [ctx.receipt, "snshah"],
    [join(ctx.dataDir, "snshah.selftest.ts"), "snshah"],
    ...wrapperScripts(ctx).map((w) => [w.path, "snshah"] as [string, string]),
  ]);

  const theme = await readText(themeSource());
  if (theme !== undefined)
    steps.push(
      ...(await contentStep(
        "file",
        ctx.installedTheme,
        theme,
        0o644,
        "Oh My Posh theme",
      )),
    );
  const posh = await planPosh(ctx, config);
  if (posh) steps.push(posh);
  const tools = await planTools(ctx, config);
  steps.push(...tools.early);

  // Marked blocks are accumulated per file, so a startup block and any
  // number of profile blocks in the same file compose instead of clobbering.
  const blocks = new Map<string, { content: string; labels: string[] }>();
  const editBlock = async (
    path: string,
    begin: string,
    end: string,
    block: string,
    label: string,
  ) => {
    const entry = blocks.get(path) ?? {
      content: (await readText(path)) ?? "",
      labels: [],
    };
    entry.content = upsertBlock(entry.content, begin, end, block);
    entry.labels.push(label);
    blocks.set(path, entry);
  };

  for (const shell of detectedShells(ctx)) {
    const path = rcFile(ctx, shell);
    const block = rcBlock(ctx, shell);
    if (shell === "fish") {
      owned.set(path, "snshah");
      steps.push(
        ...(await contentStep(
          "file",
          path,
          block,
          0o644,
          "fish startup (conf.d)",
        )),
      );
      continue;
    }
    await editBlock(
      path,
      shellBegin,
      shellEnd,
      block,
      `${shell} startup block`,
    );
  }

  // Profile hooks.
  const seenBlocks = new Set<string>();
  for (const { profile, origin, hook } of effective.hooks) {
    const where = `${origin} profile ${profile}`;
    switch (hook.kind) {
      case "file": {
        const path = resolve(expandHome(ctx, hook.path));
        const claimed = owned.get(path);
        if (claimed)
          throw new Error(
            `${where} writes ${tilde(ctx, path)}, which ${claimed} already manages.`,
          );
        owned.set(path, where);
        steps.push(
          ...(await contentStep(
            "file",
            path,
            hook.content,
            hook.mode ?? 0o644,
            `${where}: file`,
          )),
        );
        break;
      }
      case "block": {
        const path = resolve(expandHome(ctx, hook.path));
        if (owned.has(path))
          throw new Error(
            `${where} adds a block to ${tilde(ctx, path)}, which ${owned.get(path)} manages whole.`,
          );
        const key = `${path}\0${profile}`;
        if (seenBlocks.has(key))
          throw new Error(
            `${where} has two blocks for ${tilde(ctx, path)}; combine them.`,
          );
        seenBlocks.add(key);
        const c = hook.comment ?? "#";
        const close = c === "<!--" ? " -->" : "";
        const begin = `${c} >>> snshah profile ${profile} >>>${close}`;
        const end = `${c} <<< snshah profile ${profile} <<<${close}`;
        const body = hook.content.replace(/\n$/, "");
        await editBlock(
          path,
          begin,
          end,
          `${begin}\n${body}\n${end}`,
          `${where}: block`,
        );
        break;
      }
      case "command": {
        const env = commandEnv(ctx.env, hook.env, config.secrets ?? [], where);
        const cwd = hook.cwd ? resolve(expandHome(ctx, hook.cwd)) : undefined;
        const satisfied =
          resolveExecutable(hook.unless[0]!, env) !== undefined &&
          Bun.spawnSync(
            [resolveExecutable(hook.unless[0]!, env)!, ...hook.unless.slice(1)],
            { env, cwd, stdin: "ignore", stdout: "ignore", stderr: "ignore" },
          ).exitCode === 0;
        if (satisfied) break;
        (hook.phase === "before-apply" ? before : after).push({
          kind: "command",
          phase: hook.phase,
          run: hook.run,
          unless: hook.unless,
          env,
          cwd,
          path: cwd ?? "",
          label: `${where}: ${hook.phase}`,
        });
        break;
      }
      default:
        assertNever(hook);
    }
  }

  for (const [path, entry] of blocks)
    steps.push(
      ...(await contentStep(
        "block",
        path,
        entry.content,
        0o644,
        entry.labels.join(", "),
      )),
    );

  steps.push(...(await planAgentDefaults(ctx, config)));

  if (options.revision) {
    const receipt =
      JSON.stringify(
        {
          version: cliVersion,
          revision: options.revision,
          source: `${upstream.owner}/${upstream.repo}`,
        },
        null,
        2,
      ) + "\n";
    steps.push(
      ...(await contentStep(
        "file",
        ctx.receipt,
        receipt,
        0o644,
        "install receipt",
      )),
    );
  }

  // The CLI itself goes last, so a failed apply leaves the old one in place.
  const cli: Step[] = [];
  const source = repoProfileSource();
  if (resolve(source) !== resolve(ctx.repoProfileDir)) {
    const shipped = existsSyncDir(source)
      ? readdirSync(source)
          .filter((f) => f.endsWith(".ts"))
          .sort()
      : [];
    for (const file of shipped)
      cli.push(
        ...(await contentStep(
          "file",
          join(ctx.repoProfileDir, file),
          await readFile(join(source, file), "utf8"),
          0o644,
          `repo profile ${file}`,
        )),
      );
    const installed = existsSyncDir(ctx.repoProfileDir)
      ? readdirSync(ctx.repoProfileDir).filter((f) => f.endsWith(".ts"))
      : [];
    for (const file of installed)
      if (!shipped.includes(file))
        cli.push({
          kind: "remove",
          path: join(ctx.repoProfileDir, file),
          label: `retired repo profile ${file}`,
        });
  }
  const tests = await readText(join(import.meta.dir, "snshah.selftest.ts"));
  if (tests !== undefined)
    cli.push(
      ...(await contentStep(
        "file",
        join(ctx.dataDir, "snshah.selftest.ts"),
        tests,
        0o644,
        "snshah self-test",
      )),
    );
  const self = await readFile(import.meta.path, "utf8");
  cli.push(
    ...(await contentStep(
      "file",
      ctx.installedScript,
      self,
      0o644,
      "snshah CLI",
    )),
  );
  for (const script of wrapperScripts(ctx))
    cli.push(
      ...(await contentStep(
        "file",
        script.path,
        script.content,
        0o755,
        "snshah launcher",
      )),
    );
  return [...before, ...steps, ...after, ...cli, ...tools.late];
}

// ---------------------------------------------------------------------------
// Claude Code and Codex user-level defaults: fill unset keys, never override
// ---------------------------------------------------------------------------

const claudeNetworkDomains = [
  "github.com",
  "api.github.com",
  "raw.githubusercontent.com",
  "codeload.github.com",
  "objects.githubusercontent.com",
  "registry.npmjs.org",
];

/** Recursively add keys that are missing. Existing values always win. */
export function fillDefaults(
  current: JsonObject,
  defaults: JsonObject,
): JsonObject {
  const next: JsonObject = { ...current };
  for (const [key, value] of Object.entries(defaults)) {
    if (next[key] === undefined) next[key] = value;
    else if (isObject(next[key]) && isObject(value))
      next[key] = fillDefaults(next[key] as JsonObject, value);
  }
  return next;
}

export function claudeSettings(
  previous: string | undefined,
): string | undefined {
  const current: unknown = previous?.trim() ? JSON.parse(previous) : {};
  if (!isObject(current))
    throw new Error("Claude Code settings.json must hold a JSON object.");
  const sandboxOff =
    isObject(current.sandbox) && current.sandbox.enabled === false;
  const defaults: JsonObject = {
    permissions: { defaultMode: "acceptEdits" },
    ...(sandboxOff
      ? {}
      : {
          sandbox: {
            enabled: true,
            autoAllowBashIfSandboxed: true,
            allowUnsandboxedCommands: false,
            network: { allowedDomains: claudeNetworkDomains },
          },
        }),
  };
  const next = fillDefaults(current, defaults);
  return Bun.deepEquals(next, current)
    ? previous
    : JSON.stringify(next, null, 2) + "\n";
}

export function codexConfig(previous: string | undefined): string | undefined {
  const text = previous ?? "";
  const current = Bun.TOML.parse(text) as JsonObject;
  if (current.default_permissions !== undefined) return previous; // profile-based setup: leave alone
  const add: string[] = [];
  if (current.approval_policy === undefined)
    add.push('approval_policy = "never"');
  if (current.sandbox_mode === undefined)
    add.push('sandbox_mode = "workspace-write"');
  const mode = current.sandbox_mode ?? "workspace-write";
  const table =
    mode === "workspace-write" && current.sandbox_workspace_write === undefined;
  if (!add.length && !table) return previous;
  let next = add.length
    ? `# snshah defaults: fills unset keys only\n${add.join("\n")}\n\n${text}`
    : text;
  if (table)
    next = `${next}${next === "" || next.endsWith("\n") ? "" : "\n"}\n[sandbox_workspace_write]\nnetwork_access = true\n`;
  const parsed = Bun.TOML.parse(next) as JsonObject;
  for (const [key, value] of Object.entries(current))
    if (!Bun.deepEquals(parsed[key], value))
      throw new Error(
        "Could not add Codex defaults without changing existing settings.",
      );
  return next;
}

const guidanceBegin = "<!-- >>> snshah agent guidance >>> -->";
const guidanceEnd = "<!-- <<< snshah agent guidance <<< -->";
const guidance = [
  guidanceBegin,
  "## Routine work",
  "",
  "Proceed without asking for routine work an experienced engineer would do in their own sandbox: inspecting and editing project files, running builds and tests, and using Git locally.",
  "Stay inside the permissions and sandbox the session provides. Never print, store or commit secrets.",
  guidanceEnd,
].join("\n");

async function planAgentDefaults(
  ctx: Context,
  config: WorkshopConfig,
): Promise<Step[]> {
  const steps: Step[] = [];
  const PATH = ctx.env.PATH ?? "";
  const claudeDir = ctx.env.CLAUDE_CONFIG_DIR || join(ctx.home, ".claude");
  const codexDir = ctx.env.CODEX_HOME || join(ctx.home, ".codex");
  const want = (agent: "claude" | "codex", dir: string) =>
    (config.agents?.[agent]?.kind ?? "defaults") === "defaults" &&
    (!!Bun.which(agent, { PATH }) || existsSyncDir(dir));

  if (want("claude", claudeDir)) {
    const settingsPath = join(claudeDir, "settings.json");
    const previous = await readText(settingsPath);
    const next = claudeSettings(previous);
    if (next !== undefined && next !== previous)
      steps.push(
        ...(await contentStep(
          "json-fill",
          settingsPath,
          next,
          0o644,
          "Claude Code defaults (unset keys only)",
        )),
      );
    const memory = join(claudeDir, "CLAUDE.md");
    steps.push(
      ...(await contentStep(
        "block",
        memory,
        upsertBlock(
          (await readText(memory)) ?? "",
          guidanceBegin,
          guidanceEnd,
          guidance,
        ),
        0o644,
        "Claude Code guidance block",
      )),
    );
  }
  if (want("codex", codexDir)) {
    const configPath = join(codexDir, "config.toml");
    const previous = await readText(configPath);
    const next = codexConfig(previous);
    if (next !== undefined && next !== previous)
      steps.push(
        ...(await contentStep(
          "toml-fill",
          configPath,
          next,
          0o644,
          "Codex defaults (unset keys only)",
        )),
      );
    const override = join(codexDir, "AGENTS.override.md");
    const agentsPath = (await readText(override))?.trim()
      ? override
      : join(codexDir, "AGENTS.md");
    steps.push(
      ...(await contentStep(
        "block",
        agentsPath,
        upsertBlock(
          (await readText(agentsPath)) ?? "",
          guidanceBegin,
          guidanceEnd,
          guidance,
        ),
        0o644,
        "Codex guidance block",
      )),
    );
  }
  return steps;
}

function existsSyncDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

async function applySteps(steps: readonly Step[]): Promise<void> {
  for (const step of steps) {
    switch (step.kind) {
      case "directory":
        await mkdir(step.path, { recursive: true, mode: step.mode });
        if (!isWindows && step.mode === 0o700)
          await chmod(step.path, step.mode);
        break;
      case "file":
      case "seed":
      case "block":
      case "json-fill":
      case "toml-fill":
        await writeAtomic(step.path, step.content, step.mode);
        break;
      case "remove":
        await rm(step.path, { force: true });
        break;
      case "download":
        await download(step);
        break;
      case "tools": {
        const r = Bun.spawnSync([step.binary, "install"], {
          env: step.env,
          cwd: step.cwd,
          stdin: "ignore",
          stdout: 2, // progress goes to stderr, keeping --json stdout clean
          stderr: 2,
        });
        if (r.exitCode !== 0)
          throw new Error(
            `${step.label}: mise install exited ${r.exitCode}. Fix the error above (GitHub rate limits clear when GITHUB_TOKEN is set), then re-run snshah apply.`,
          );
        const still = miseMissing(step.binary, step.env, step.cwd, step.names);
        if (still.length)
          throw new Error(
            `${step.label}: ${still.join(", ")} still not installed after mise install.`,
          );
        break;
      }
      case "command": {
        const exe = resolveExecutable(step.run[0]!, step.env);
        if (!exe)
          throw new Error(`${step.label}: ${step.run[0]} is not on PATH.`);
        const r = Bun.spawnSync([exe, ...step.run.slice(1)], {
          env: step.env,
          cwd: step.cwd,
          stdin: "inherit",
          stdout: "pipe",
          stderr: "pipe",
        });
        // Keep stdout clean for --json: hook output goes to stderr.
        process.stderr.write(r.stdout);
        process.stderr.write(r.stderr);
        if (r.exitCode !== 0)
          throw new Error(
            `${step.label}: ${step.run.join(" ")} exited ${r.exitCode}.`,
          );
        const uexe = resolveExecutable(step.unless[0]!, step.env);
        const converged =
          !!uexe &&
          Bun.spawnSync([uexe, ...step.unless.slice(1)], {
            env: step.env,
            cwd: step.cwd,
            stdin: "ignore",
            stdout: "ignore",
            stderr: "ignore",
          }).exitCode === 0;
        if (!converged)
          throw new Error(
            `${step.label}: its unless check (${step.unless.join(" ")}) still fails after running, so it would run again every time. Fix the hook.`,
          );
        break;
      }
      default:
        assertNever(step);
    }
  }
}

async function withLock<T>(
  ctx: Context,
  operation: () => Promise<T>,
): Promise<T> {
  await mkdir(ctx.stateDir, { recursive: true });
  const lock = join(ctx.stateDir, "apply.lock");
  try {
    await mkdir(lock);
  } catch {
    const age = Date.now() - (await stat(lock)).mtimeMs;
    if (age < 10 * 60 * 1000)
      throw new Error(
        `Another snshah apply is running (lock ${tilde(ctx, lock)}).`,
      );
    await rm(lock, { recursive: true, force: true });
    await mkdir(lock);
  }
  try {
    return await operation();
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Shell emit: everything the rc block loads, generated at shell start
// ---------------------------------------------------------------------------

export type ShellOp =
  | { kind: "path"; directory: string }
  | { kind: "env-default"; name: string; value: string }
  | { kind: "env"; name: string; value: string }
  | { kind: "alias"; name: string; value: AliasValue }
  | { kind: "mkcd" }
  | { kind: "reload" }
  | { kind: "eza"; icons: boolean; skip: string[] }
  | { kind: "dirhook" }
  | { kind: "wrap"; command: string; wrapper: string }
  | { kind: "mise"; binary: string }
  | { kind: "direnv" }
  | { kind: "prompt"; theme: string; binary: string };

export function shellOps(
  ctx: Context,
  config: WorkshopConfig,
  shell: Shell,
  fonts?: FontWord,
): ShellOp[] {
  const ops: ShellOp[] = [];
  const bunBin = join(ctx.env.BUN_INSTALL || join(ctx.home, ".bun"), "bin");
  for (const directory of [
    ...(config.path ?? []).map((p) => expandHome(ctx, p)).reverse(),
    bunBin,
    ctx.binDir,
  ])
    ops.push({ kind: "path", directory });
  ops.push({
    kind: "env-default",
    name: workspacesDefaults.variable,
    value: workspacesRoot(ctx, config),
  });
  // Tells a server you ssh into which kind of computer you are on (see snshah ssh copy).
  ops.push({
    kind: "env-default",
    name: "LC_SNSHAH_OS",
    value:
      ctx.platform === "macos"
        ? "macos"
        : ctx.platform === "windows"
          ? "windows"
          : "linux",
  });
  // Your own answer to `snshah ux fonts`, sent the same way so servers can see it.
  if (fonts)
    ops.push({ kind: "env-default", name: "LC_SNSHAH_FONTS", value: fonts });
  for (const secret of config.secrets ?? [])
    if (secret.scope === "shell")
      ops.push({ kind: "env", name: secret.variable, value: secret.value });
  for (const [name, value] of Object.entries(config.env ?? {}))
    ops.push({ kind: "env", name, value });
  for (const [name, value] of Object.entries(config.aliases ?? {}))
    ops.push({ kind: "alias", name, value });
  ops.push({ kind: "mkcd" });
  ops.push({ kind: "reload" });
  const wrapped = new Set<string>();
  for (const secret of config.secrets ?? [])
    if (secret.scope === "command")
      for (const command of secret.commands) wrapped.add(command);
  for (const command of [...wrapped].sort())
    ops.push({ kind: "wrap", command, wrapper: wrapperFor(ctx, shell) });
  if (toolManagerOn(config)) ops.push({ kind: "mise", binary: ctx.miseBinary });
  if (config.tools?.direnv !== false) ops.push({ kind: "direnv" });
  if (config.tools?.eza !== false)
    ops.push({
      kind: "eza",
      icons: fonts !== "missing",
      // Names you set yourself in `aliases` are never replaced.
      skip: Object.keys(config.aliases ?? {}),
    });
  if ((config.prompt ?? { kind: "oh-my-posh" }).kind === "oh-my-posh") {
    const custom =
      config.prompt?.kind === "oh-my-posh" ? config.prompt.theme : undefined;
    ops.push({
      kind: "prompt",
      theme: custom ? expandHome(ctx, custom) : ctx.installedTheme,
      binary: ctx.poshBinary,
    });
  }
  // After the prompt, so its init can't replace the hook that follows your directory.
  ops.push({ kind: "dirhook" });
  return ops;
}

/** The eza aliases, shared by every shell. `icons` follows `snshah ux fonts`. */
export function ezaCommands(icons: boolean): Record<string, string> {
  const i = icons ? " --icons=auto" : "";
  const base = `eza${i} --group-directories-first`;
  return {
    ls: base,
    ll: `${base} -l --git`,
    la: `${base} -la --git`,
    tree: `${base} --tree --git-ignore`,
    exa: "eza",
  };
}

export const dirProfileFile = ".snshah.path.ts";

/**
 * Per-directory profiles: a prompt hook finds `.snshah.path.ts` files above
 * your directory and, only when that list changes, asks `snshah profile load`
 * for the trusted ones. The helpers record what they replace so leaving the
 * directory puts it back.
 */
function renderDirHookPosix(shell: "bash" | "zsh"): string[] {
  const aliasShow = shell === "zsh" ? "alias -L" : "alias";
  const registration =
    shell === "zsh"
      ? [
          `case " \${chpwd_functions[*]-} " in *" __snshah_dir_hook "*) ;; *) chpwd_functions+=(__snshah_dir_hook) ;; esac`,
          `__snshah_dir_hook`,
        ]
      : [
          `case ";\${PROMPT_COMMAND-};" in *__snshah_dir_hook*) ;; *) PROMPT_COMMAND="\${PROMPT_COMMAND:+$PROMPT_COMMAND;}__snshah_dir_hook" ;; esac`,
        ];
  return [
    `__snshah_dir_undo=''`,
    `__snshah_q() { printf "'%s'" "$(printf %s "$1" | sed "s/'/'\\\\\\\\''/g")"; }`,
    `__snshah_dir_alias() { if alias "$1" >/dev/null 2>&1; then __snshah_dir_undo="$(${aliasShow} "$1")
$__snshah_dir_undo"; else __snshah_dir_undo="unalias $1
$__snshah_dir_undo"; fi; alias "$1=$2"; }`,
    `__snshah_dir_env() { if eval "[ \\"\\\${$1+x}\\" = x ]"; then eval "__snshah_old=\\\${$1}"; __snshah_dir_undo="export $1=$(__snshah_q "$__snshah_old")
$__snshah_dir_undo"; else __snshah_dir_undo="unset $1
$__snshah_dir_undo"; fi; export "$1=$2"; }`,
    `__snshah_dir_unpath() { __snshah_t=":$PATH:"; __snshah_t=\${__snshah_t//":$1:"/:}; __snshah_t=\${__snshah_t#:}; PATH=\${__snshah_t%:}; export PATH; }`,
    `__snshah_dir_path() { case ":$PATH:" in *":$1:"*) return 0 ;; esac; PATH="$1:$PATH"; export PATH; __snshah_dir_undo="__snshah_dir_unpath $(__snshah_q "$1")
$__snshah_dir_undo"; }`,
    `__snshah_dir_reset() { if [ -n "$__snshah_dir_undo" ]; then eval "$__snshah_dir_undo"; fi; __snshah_dir_undo=''; }`,
    `__snshah_dir_hook() { [ "$PWD" = "\${__snshah_dir_pwd-}" ] && return 0; __snshah_dir_pwd=$PWD; __snshah_d=$PWD; __snshah_f=''; while :; do if [ -f "$__snshah_d/${dirProfileFile}" ]; then __snshah_f="$__snshah_d/${dirProfileFile}\${__snshah_f:+
$__snshah_f}"; fi; [ "$__snshah_d" = / ] && break; __snshah_d=\${__snshah_d%/*}; [ -n "$__snshah_d" ] || __snshah_d=/; done; [ "$__snshah_f" = "\${__snshah_dir_sig-}" ] && return 0; __snshah_dir_reset; __snshah_dir_sig=$__snshah_f; if [ -n "$__snshah_f" ]; then eval "$(SNSHAH_DIRFILES="$__snshah_f" command snshah profile load --shell ${shell})"; fi; return 0; }`,
    ...registration,
  ];
}

function renderDirHookFish(): string[] {
  return [
    `set -g __snshah_dir_undo`,
    `function __snshah_dir_alias; if functions -q $argv[1]; functions -c $argv[1] __snshah_prev_$argv[1]; set -ga __snshah_dir_undo "functions -e $argv[1]; functions -c __snshah_prev_$argv[1] $argv[1]; functions -e __snshah_prev_$argv[1]"; else; set -ga __snshah_dir_undo "functions -e $argv[1]"; end; alias $argv[1] $argv[2]; end`,
    `function __snshah_dir_env; if set -q $argv[1]; set -ga __snshah_dir_undo "set -gx $argv[1] "(string escape -- "$$argv[1]"); else; set -ga __snshah_dir_undo "set -e $argv[1]"; end; set -gx $argv[1] $argv[2]; end`,
    `function __snshah_dir_path; contains -- $argv[1] $PATH; and return 0; set -ga __snshah_dir_undo "set -gx PATH (string match -v -- "(string escape -- $argv[1])" \\$PATH)"; set -gx PATH $argv[1] $PATH; end`,
    `function __snshah_dir_reset; for c in $__snshah_dir_undo; eval $c; end; set -g __snshah_dir_undo; end`,
    `function __snshah_dir_hook --on-variable PWD; test "$PWD" = "$__snshah_dir_pwd"; and return 0; set -g __snshah_dir_pwd $PWD; set -l d $PWD; set -l f; while true; if test -f "$d/${dirProfileFile}"; set f "$d/${dirProfileFile}" $f; end; test "$d" = /; and break; set d (path dirname $d); end; test "$f" = "$__snshah_dir_sig"; and return 0; __snshah_dir_reset; set -g __snshah_dir_sig "$f"; if test -n "$f"; env SNSHAH_DIRFILES=(string join \\n -- $f | string collect) snshah profile load --shell fish | source; end; end`,
    `__snshah_dir_hook`,
  ];
}

function aliasText(
  value: AliasValue,
  flavor: "posix" | "fish" | "pwsh",
): string | undefined {
  if (typeof value === "string") return value;
  return value[flavor] ?? (flavor === "fish" ? value.posix : undefined);
}

export function renderShell(shell: Shell, ops: readonly ShellOp[]): string {
  const lines: string[] = [
    `# snshah ${cliVersion} shell init (${shell}). Generated; do not edit.`,
  ];
  for (const op of ops) {
    switch (shell) {
      case "bash":
      case "zsh":
        lines.push(...renderPosix(shell, op));
        break;
      case "fish":
        lines.push(...renderFish(op));
        break;
      case "pwsh":
        lines.push(...renderPwsh(op));
        break;
      default:
        assertNever(shell);
    }
  }
  return lines.join("\n") + "\n";
}

function renderPosix(shell: "bash" | "zsh", op: ShellOp): string[] {
  const defined = (name: string) =>
    shell === "bash"
      ? `{ alias ${name} || declare -F ${name}; } >/dev/null 2>&1`
      : `(( \${+aliases[${name}]} || \${+functions[${name}]} ))`;
  switch (op.kind) {
    case "path":
      return [
        `case ":$PATH:" in *:${quotePosix(op.directory)}:*) ;; *) PATH=${quotePosix(op.directory)}":$PATH"; export PATH ;; esac`,
      ];
    case "env-default":
      return [
        `[ -n "\${${op.name}-}" ] || ${op.name}=${quotePosix(op.value)}; export ${op.name}`,
      ];
    case "env":
      return [`export ${op.name}=${quotePosix(op.value)}`];
    case "alias": {
      const text = aliasText(op.value, "posix");
      return text === undefined
        ? []
        : [`${defined(op.name)} || alias ${op.name}=${quotePosix(text)}`];
    }
    case "mkcd":
      return [
        `${defined("mkcd")} || mkcd() { mkdir -p -- "$1" && cd -- "$1"; }`,
      ];
    case "eza": {
      const cmds = ezaCommands(op.icons);
      const set = Object.entries(cmds)
        .filter(([name]) => !op.skip.includes(name))
        .map(([name, text]) => `alias ${name}=${quotePosix(text)}`)
        .join("; ");
      const plain = op.skip.includes("ll")
        ? ""
        : `${defined("ll")} || alias ll='ls -al'`;
      return [
        `if command -v eza >/dev/null 2>&1; then ${set || ":"}; else ${plain || ":"}; fi`,
      ];
    }
    case "dirhook":
      return renderDirHookPosix(shell);
    case "reload":
      // After a successful `snshah update` or `snshah apply`, re-source this init in
      // the shell you are in. Always redefined, so a reload refreshes the function too.
      return [
        `snshah() { SNSHAH_RELOAD=1 command snshah "$@"; __snshah_rc=$?; if [ "$__snshah_rc" -eq 0 ]; then case " $* " in *" --check "*|*" --json "*|*" --help "*|*" -h "*) ;; *) case "$1" in update|apply) eval "$(command snshah shell ${shell})" ;; profile) __snshah_dir_pwd=''; __snshah_dir_sig=reload; __snshah_dir_hook ;; esac ;; esac; fi; return "$__snshah_rc"; }`,
      ];
    case "wrap":
      return [
        `${defined(op.command)} || ${op.command}() { ${quotePosix(op.wrapper)} exec ${op.command} "$@"; }`,
      ];
    case "mise":
      return [
        // Activate mise unless this shell already did; prefer a mise on PATH.
        `if [ -z "\${MISE_SHELL-}" ]; then __snshah_mise=$(command -v mise 2>/dev/null) || __snshah_mise=${quotePosix(op.binary)}; if [ -x "$__snshah_mise" ]; then eval "$("$__snshah_mise" activate ${shell})"; fi; unset __snshah_mise; fi`,
      ];
    case "direnv":
      return [
        `if command -v direnv >/dev/null 2>&1 && ! type _direnv_hook >/dev/null 2>&1; then eval "$(direnv hook ${shell})"; fi`,
      ];
    case "prompt":
      return [
        // Prefer an oh-my-posh on PATH; fall back to the copy snshah installed.
        `__snshah_omp=$(command -v oh-my-posh 2>/dev/null) || __snshah_omp=${quotePosix(op.binary)}`,
        `if [ -x "$__snshah_omp" ] && [ -f ${quotePosix(op.theme)} ]; then eval "$("$__snshah_omp" init ${shell} --config ${quotePosix(op.theme)})"; fi`,
        `unset __snshah_omp`,
      ];
    default:
      return assertNever(op);
  }
}

function renderFish(op: ShellOp): string[] {
  switch (op.kind) {
    case "path":
      return [
        `contains -- ${quoteFish(op.directory)} $PATH; or set -gx PATH ${quoteFish(op.directory)} $PATH`,
      ];
    case "env-default":
      return [
        `set -q ${op.name}; or set -gx ${op.name} ${quoteFish(op.value)}`,
      ];
    case "env":
      return [`set -gx ${op.name} ${quoteFish(op.value)}`];
    case "alias": {
      const text = aliasText(op.value, "fish");
      return text === undefined
        ? []
        : [`functions -q ${op.name}; or alias ${op.name} ${quoteFish(text)}`];
    }
    case "mkcd":
      return [
        "functions -q mkcd; or function mkcd; mkdir -p -- $argv[1]; and cd -- $argv[1]; end",
      ];
    case "eza": {
      const set = Object.entries(ezaCommands(op.icons))
        .filter(([name]) => !op.skip.includes(name))
        .map(([name, text]) => `alias ${name} ${quoteFish(text)}`)
        .join("; ");
      const plain = op.skip.includes("ll")
        ? "true"
        : "functions -q ll; or alias ll 'ls -al'";
      return [`if command -sq eza; ${set || "true"}; else; ${plain}; end`];
    }
    case "dirhook":
      return renderDirHookFish();
    case "reload":
      return [
        `function snshah --description 'snshah; re-sources this shell after update or apply'; env SNSHAH_RELOAD=1 snshah $argv; set -l __snshah_rc $status; if test $__snshah_rc -eq 0; and not contains -- --check $argv; and not contains -- --json $argv; and not contains -- --help $argv; if contains -- "$argv[1]" update apply; command snshah shell fish | source; else if test "$argv[1]" = profile; set -g __snshah_dir_pwd ""; set -g __snshah_dir_sig reload; __snshah_dir_hook; end; end; return $__snshah_rc; end`,
      ];
    case "wrap":
      return [
        `functions -q ${op.command}; or function ${op.command} --wraps ${op.command}; ${quoteFish(op.wrapper)} exec ${op.command} $argv; end`,
      ];
    case "mise":
      return [
        `if not set -q MISE_SHELL; set -l __snshah_mise (command -s mise); or set __snshah_mise ${quoteFish(op.binary)}; if test -x "$__snshah_mise"; $__snshah_mise activate fish | source; end; end`,
      ];
    case "direnv":
      return [
        `if command -sq direnv; and not functions -q __direnv_export_eval; direnv hook fish | source; end`,
      ];
    case "prompt":
      return [
        `set -l __snshah_omp (command -s oh-my-posh); or set __snshah_omp ${quoteFish(op.binary)}`,
        `if test -x "$__snshah_omp"; and test -f ${quoteFish(op.theme)}; $__snshah_omp init fish --config ${quoteFish(op.theme)} | source; end`,
        `set -e __snshah_omp`,
      ];
    default:
      return assertNever(op);
  }
}

function renderPwsh(op: ShellOp): string[] {
  const undefinedCommand = (name: string) =>
    `-not (Get-Command -Name ${quotePwsh(name)} -CommandType Alias,Function -ErrorAction SilentlyContinue)`;
  switch (op.kind) {
    case "path":
      return [
        `if (($env:PATH -split [IO.Path]::PathSeparator) -notcontains ${quotePwsh(op.directory)}) { $env:PATH = ${quotePwsh(op.directory)} + [IO.Path]::PathSeparator + $env:PATH }`,
      ];
    case "env-default":
      return [
        `if (-not $env:${op.name}) { $env:${op.name} = ${quotePwsh(op.value)} }`,
      ];
    case "env":
      return [`$env:${op.name} = ${quotePwsh(op.value)}`];
    case "alias": {
      const text = aliasText(op.value, "pwsh");
      return text === undefined
        ? []
        : [
            `if (${undefinedCommand(op.name)}) { function global:${op.name} { ${text} @args } }`,
          ];
    }
    case "mkcd":
      return [
        `if (${undefinedCommand("mkcd")}) { function global:mkcd { param([string]$Path) New-Item -ItemType Directory -Force -Path $Path | Out-Null; Set-Location -LiteralPath $Path } }`,
      ];
    case "eza": {
      // Functions never beat PowerShell's own `ls` alias, so `ls` is left alone.
      const set = Object.entries(ezaCommands(op.icons))
        .filter(([name]) => name !== "ls" && !op.skip.includes(name))
        .map(
          ([name, text]) =>
            `if (${undefinedCommand(name)}) { function global:${name} { ${text} @args } }`,
        )
        .join("; ");
      const plain = op.skip.includes("ll")
        ? ""
        : ` elseif (${undefinedCommand("ll")}) { function global:ll { Get-ChildItem -Force @args } }`;
      return [
        `if (Get-Command eza -CommandType Application -ErrorAction SilentlyContinue) { ${set || ";"} }${plain}`,
      ];
    }
    case "dirhook":
      // PowerShell has no safe hook for this yet; use `snshah profile list` there.
      return [];
    case "reload":
      // A function can't define things in the global scope PowerShell shows you,
      // so pwsh gets advice from the CLI instead (see reloadAdvice).
      return [];
    case "wrap":
      return [
        `if (${undefinedCommand(op.command)}) { function global:${op.command} { & ${quotePwsh(op.wrapper)} exec ${op.command} @args } }`,
      ];
    case "mise":
      return [
        `if (-not $env:MISE_SHELL) { $__snshahMise = (Get-Command mise -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source; if (-not $__snshahMise -and (Test-Path -LiteralPath ${quotePwsh(op.binary)})) { $__snshahMise = ${quotePwsh(op.binary)} }; if ($__snshahMise) { (& $__snshahMise activate pwsh) -join "\`n" | Invoke-Expression }; Remove-Variable __snshahMise -ErrorAction SilentlyContinue }`,
      ];
    case "direnv":
      return [
        `if ((Get-Command direnv -CommandType Application -ErrorAction SilentlyContinue) -and -not $global:__snshahDirenv) { $global:__snshahDirenv = $true; (& direnv hook pwsh) -join "\`n" | Invoke-Expression }`,
      ];
    case "prompt":
      return [
        `$__snshahOmp = (Get-Command oh-my-posh -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source`,
        `if (-not $__snshahOmp -and (Test-Path -LiteralPath ${quotePwsh(op.binary)})) { $__snshahOmp = ${quotePwsh(op.binary)} }`,
        `if ($__snshahOmp -and (Test-Path -LiteralPath ${quotePwsh(op.theme)})) { & $__snshahOmp init pwsh --config ${quotePwsh(op.theme)} | Invoke-Expression }`,
        `Remove-Variable __snshahOmp -ErrorAction SilentlyContinue`,
      ];
    default:
      return assertNever(op);
  }
}

// ---------------------------------------------------------------------------
// exec: run a command with its command-scoped secrets
// ---------------------------------------------------------------------------

async function execWithSecrets(ctx: Context, argv: string[]): Promise<number> {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  const command = args[0];
  if (!command) throw new UsageError("Usage: snshah exec <command> [args...]");
  const { config } = await loadEffective(ctx);
  const env: Env = { ...ctx.env };
  for (const secret of config.secrets ?? [])
    if (
      secret.scope === "command" &&
      secret.commands.includes(
        basename(command).replace(/\.(exe|cmd|bat)$/i, ""),
      )
    )
      env[secret.variable] = secret.value;
  const executable = Bun.which(command, { PATH: env.PATH ?? "" });
  if (!executable) {
    console.error(`snshah exec: ${command} is not on PATH.`);
    return 127;
  }
  const child = Bun.spawn([executable, ...args.slice(1)], {
    env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return await child.exited;
}

// ---------------------------------------------------------------------------
// Git checkout registry under $WORKSPACES_HOME
// ---------------------------------------------------------------------------

export type GitSource =
  | { kind: "remote"; url: string; host: string; segments: string[] }
  | { kind: "local"; url: string; name: string };

export function parseGitSource(input: string, cwd = process.cwd()): GitSource {
  const trimmed = input.trim();
  const strip = (s: string) => s.replace(/\.git$/, "");
  if (
    /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(trimmed) &&
    !existsSync(resolve(cwd, trimmed))
  ) {
    const [owner, repo] = trimmed.split("/") as [string, string];
    return {
      kind: "remote",
      url: `https://github.com/${owner}/${strip(repo)}.git`,
      host: "github.com",
      segments: [owner, strip(repo)],
    };
  }
  const scp = /^(?:[^@\s/]+@)?([^:/\s]{2,}):(?!\/\/)(.+)$/.exec(trimmed);
  if (scp) {
    const segments = scp[2]!.split("/").filter(Boolean).map(strip);
    return { kind: "remote", url: trimmed, host: scp[1]!, segments };
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    if (url.protocol === "file:") {
      const path = decodeURIComponent(url.pathname);
      return { kind: "local", url: path, name: strip(basename(path)) };
    }
    if (!["https:", "http:", "ssh:", "git:"].includes(url.protocol))
      throw new UsageError(`Unsupported Git URL scheme: ${url.protocol}`);
    const host = url.port ? `${url.hostname}+${url.port}` : url.hostname;
    const segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((s) => strip(decodeURIComponent(s)));
    if (!segments.length)
      throw new UsageError(`No repository path in ${trimmed}`);
    return { kind: "remote", url: trimmed, host, segments };
  }
  const path = resolve(cwd, trimmed);
  if (!existsSync(path))
    throw new UsageError(
      `Not a Git URL, owner/repo, or existing path: ${input}`,
    );
  return { kind: "local", url: path, name: strip(basename(path)) };
}

export function defaultCheckout(root: string, source: GitSource): string {
  switch (source.kind) {
    case "remote":
      return join(root, source.host, ...source.segments);
    case "local":
      return join(root, "local", source.name);
    default:
      return assertNever(source);
  }
}

function repoPath(
  ctx: Context,
  config: WorkshopConfig,
  repo: Repository,
): string {
  if (repo.path) return resolve(expandHome(ctx, repo.path));
  return defaultCheckout(
    workspacesRoot(ctx, config),
    parseGitSource(repo.source),
  );
}

type CheckoutState = "missing" | "clean" | "dirty" | "not-a-checkout";

function checkoutState(path: string): CheckoutState {
  if (!existsSync(path)) return "missing";
  const top = capture(["git", "-C", path, "rev-parse", "--show-toplevel"]);
  if (!top || resolve(top) !== resolve(path)) return "not-a-checkout";
  return capture(["git", "-C", path, "status", "--porcelain"]) === ""
    ? "clean"
    : "dirty";
}

function isEmptyDir(path: string): boolean {
  try {
    return readdirSync(path).length === 0;
  } catch {
    return false;
  }
}

async function gitAdd(
  ctx: Context,
  input: string,
  options: { name?: string; path?: string; inPlace?: boolean; clone: boolean },
): Promise<void> {
  const { privateConfig, config: merged } = await loadEffective(ctx);
  const repos = privateConfig.repositories ?? [];
  let source = input;
  let path = options.path ? resolve(expandHome(ctx, options.path)) : undefined;
  if (options.inPlace) {
    path = resolve(expandHome(ctx, input));
    if (
      checkoutState(path) === "missing" ||
      checkoutState(path) === "not-a-checkout"
    )
      throw new UsageError(`${input} is not the top of a Git checkout.`);
    source =
      capture(["git", "-C", path, "remote", "get-url", "origin"]) ?? path;
  }
  const parsed = parseGitSource(source);
  const normalized = parsed.kind === "local" ? parsed.url : source;
  const name =
    options.name ??
    (parsed.kind === "remote" ? parsed.segments.at(-1)! : parsed.name);
  if (!repoName.test(name))
    throw new UsageError(`Invalid repository name: ${name}. Use --name.`);
  const existing = (merged.repositories ?? []).find((r) => r.name === name);
  if (existing) {
    const urlOf = (source: string) => {
      try {
        return parseGitSource(source).url;
      } catch {
        return source;
      }
    };
    const same =
      existing.source === normalized || urlOf(existing.source) === parsed.url;
    if (!same)
      throw new UsageError(
        `The name ${name} is already used by ${existing.source}. Use --name.`,
      );
    say(`${name} is already registered.`, "success");
  } else {
    const entry: Repository = {
      name,
      source: normalized,
      ...(path ? { path: tilde(ctx, path) } : {}),
    };
    await saveConfigBlock(
      ctx,
      reposBegin,
      reposEnd,
      reposBlock([...repos, entry]),
    );
    say(`Registered ${name}.`, "success");
  }
  if (options.clone && !options.inPlace) await gitClone(ctx, name);
}

async function gitClone(
  ctx: Context,
  name: string | undefined,
  all = false,
): Promise<void> {
  const { config } = await loadEffective(ctx);
  const repos = selectRepos(config, name, all);
  let failed = 0;
  for (const repo of repos) {
    const path = repoPath(ctx, config, repo);
    const state = checkoutState(path);
    if (state === "clean" || state === "dirty") {
      say(`${repo.name}: present at ${tilde(ctx, path)}`, "success");
      continue;
    }
    if (state === "not-a-checkout" && !isEmptyDir(path)) {
      say(
        `${repo.name}: ${tilde(ctx, path)} exists and is not a checkout; left alone`,
        "error",
      );
      failed++;
      continue;
    }
    await mkdir(dirname(path), { recursive: true });
    say(`${repo.name}: cloning into ${tilde(ctx, path)}`, "action");
    const url = parseGitSource(repo.source).url;
    if (run(["git", "clone", "--quiet", "--", url, path]) !== 0) failed++;
  }
  if (failed) throw new Error(`${failed} checkout(s) need attention.`);
}

async function gitUpdate(
  ctx: Context,
  name: string | undefined,
  all: boolean,
): Promise<void> {
  const { config } = await loadEffective(ctx);
  let failed = 0;
  for (const repo of selectRepos(config, name, all)) {
    const path = repoPath(ctx, config, repo);
    const state = checkoutState(path);
    if (state !== "clean") {
      say(
        `${repo.name}: ${state === "dirty" ? "has local changes; skipped" : state === "missing" ? "not cloned yet; run snshah git clone" : "is not a checkout; left alone"}`,
        state === "not-a-checkout" ? "error" : "pending",
      );
      if (state === "not-a-checkout") failed++;
      continue;
    }
    if (
      !capture(["git", "-C", path, "rev-parse", "--abbrev-ref", "@{upstream}"])
    ) {
      say(`${repo.name}: no upstream branch; skipped`, "pending");
      continue;
    }
    const before = capture(["git", "-C", path, "rev-parse", "HEAD"]);
    if (
      run(["git", "-C", path, "fetch", "--quiet", "origin"]) !== 0 ||
      run(["git", "-C", path, "merge", "--ff-only", "--quiet", "@{upstream}"], {
        quiet: true,
      }) !== 0
    ) {
      say(`${repo.name}: cannot fast-forward; resolve it by hand`, "error");
      failed++;
      continue;
    }
    const after = capture(["git", "-C", path, "rev-parse", "HEAD"]);
    say(
      `${repo.name}: ${before === after ? "already up to date" : "fast-forwarded"}`,
      "success",
    );
  }
  if (failed) throw new Error(`${failed} checkout(s) need attention.`);
}

function selectRepos(
  config: WorkshopConfig,
  name: string | undefined,
  all: boolean,
): Repository[] {
  const repos = config.repositories ?? [];
  if (all) return repos;
  if (!name) throw new UsageError("Name a repository or pass --all.");
  const repo = repos.find((r) => r.name === name);
  if (!repo)
    throw new UsageError(`${name} is not registered. See snshah git list.`);
  return [repo];
}

async function gitRemove(ctx: Context, name: string): Promise<void> {
  const { privateConfig, config: merged } = await loadEffective(ctx);
  const repos = privateConfig.repositories ?? [];
  if (!repos.some((r) => r.name === name)) {
    if ((defaultConfig.repositories ?? []).some((r) => r.name === name))
      throw new UsageError(
        `${name} is built in (this repository's own checkout) and cannot be removed.`,
      );
    if ((merged.repositories ?? []).some((r) => r.name === name))
      throw new UsageError(
        `${name} comes from a profile.d file; remove it there. See snshah plan --explain.`,
      );
    say(`${name} is not registered; nothing to remove.`, "success");
    return;
  }
  await saveConfigBlock(
    ctx,
    reposBegin,
    reposEnd,
    reposBlock(repos.filter((r) => r.name !== name)),
  );
  say(
    `Removed ${name} from the registry. Its files were left in place.`,
    "success",
  );
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

async function setSecret(
  ctx: Context,
  variable: string,
  options: { stdin: boolean; scope?: string; commands?: string },
): Promise<void> {
  if (!identifier.test(variable))
    throw new UsageError(
      `${variable} is not a valid environment variable name.`,
    );
  const { config } = await loadConfig(ctx);
  const secrets = [...(config.secrets ?? [])];
  const index = secrets.findIndex((s) => s.variable === variable);
  let template = secrets[index];
  if (!template) {
    if (options.scope === "shell")
      template = { variable, value: "", scope: "shell" };
    else if (options.scope === "command") {
      const commands = (options.commands ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      if (!commands.length)
        throw new UsageError("A command-scoped secret needs --commands a,b.");
      template = { variable, value: "", scope: "command", commands };
    } else
      throw new UsageError(
        `${variable} is not declared. Pass --scope command --commands <list>, or --scope shell.`,
      );
  }
  let value: string;
  if (options.stdin) value = (await Bun.stdin.text()).replace(/\r?\n$/, "");
  else {
    const clack = await prompts();
    const answer = await clack.password({
      message: `Value for ${variable} (hidden)`,
    });
    if (clack.isCancel(answer)) throw new UsageError("Cancelled.");
    value = String(answer);
  }
  const next = [...secrets];
  next[index === -1 ? next.length : index] = { ...template, value };
  const changed = await saveConfigBlock(
    ctx,
    secretsBegin,
    secretsEnd,
    secretsBlock(next),
  );
  say(
    changed
      ? `Saved ${variable} (${template.scope} scope).`
      : `No change: ${variable} already has that value.`,
    "success",
  );
}

// ---------------------------------------------------------------------------
// doctor: detect tools and advise installs; never installs anything
// ---------------------------------------------------------------------------

type Advice = Partial<Record<PackageManager, string>> & { fallback?: string };
type Tool = {
  name: string;
  /** How to ask for its version; "--version" when unset. */
  versionArgs?: readonly string[];
  /** The mise tool that provides it, when mise can. */
  mise?: string;
  purpose: string;
  required: boolean;
  linuxOnly?: boolean;
  advice: Advice;
};

const tools: Tool[] = [
  {
    name: "git",
    purpose: "checkouts and updates",
    required: true,
    advice: {
      apt: "git",
      dnf: "git",
      pacman: "git",
      apk: "git",
      zypper: "git",
      brew: "git",
      winget: "Git.Git",
      omarchy: "git",
    },
  },
  {
    name: "tar",
    purpose: "snshah update",
    required: true,
    advice: {
      apt: "tar",
      dnf: "tar",
      pacman: "tar",
      apk: "tar",
      zypper: "tar",
      brew: "gnu-tar",
      omarchy: "tar",
    },
  },
  {
    name: "oh-my-posh",
    versionArgs: ["version"],
    purpose: "prompt theme",
    required: false,
    advice: {
      brew: "jandedobbeleer/oh-my-posh/oh-my-posh",
      winget: "JanDeDobbeleer.OhMyPosh",
      omarchy: "oh-my-posh",
      // Elsewhere snshah apply installs a pinned build itself (see doctor).
      fallback:
        "curl -fsSL https://ohmyposh.dev/install.sh | bash -s -- -d ~/.local/bin",
    },
  },
  {
    name: "gh",
    mise: "gh",
    purpose: "GitHub sign-in",
    required: false,
    advice: {
      apt: "gh",
      dnf: "gh",
      pacman: "github-cli",
      apk: "github-cli",
      zypper: "gh",
      brew: "gh",
      winget: "GitHub.cli",
      omarchy: "github-cli",
    },
  },
  {
    name: "rg",
    mise: "ripgrep",
    purpose: "fast search",
    required: false,
    advice: {
      apt: "ripgrep",
      dnf: "ripgrep",
      pacman: "ripgrep",
      apk: "ripgrep",
      zypper: "ripgrep",
      brew: "ripgrep",
      winget: "BurntSushi.ripgrep.MSVC",
      omarchy: "ripgrep",
    },
  },
  {
    name: "fzf",
    mise: "fzf",
    purpose: "fuzzy finder",
    required: false,
    advice: {
      apt: "fzf",
      dnf: "fzf",
      pacman: "fzf",
      apk: "fzf",
      zypper: "fzf",
      brew: "fzf",
      winget: "junegunn.fzf",
      omarchy: "fzf",
    },
  },
  {
    name: "jq",
    mise: "jq",
    purpose: "JSON on the command line",
    required: false,
    advice: {
      apt: "jq",
      dnf: "jq",
      pacman: "jq",
      apk: "jq",
      zypper: "jq",
      brew: "jq",
      winget: "jqlang.jq",
      omarchy: "jq",
    },
  },
  {
    name: "mise",
    purpose: "developer tool manager",
    required: false,
    advice: {
      pacman: "mise",
      apk: "mise",
      brew: "mise",
      winget: "jdx.mise",
      omarchy: "mise",
    },
  },
  {
    name: "direnv",
    mise: "direnv",
    purpose: "per-directory environments (.envrc)",
    required: false,
    advice: {
      apt: "direnv",
      dnf: "direnv",
      pacman: "direnv",
      apk: "direnv",
      zypper: "direnv",
      brew: "direnv",
      winget: "direnv.direnv",
      omarchy: "direnv",
    },
  },
  {
    name: "fd",
    mise: "fd",
    purpose: "fast find",
    required: false,
    advice: {
      apt: "fd-find",
      dnf: "fd-find",
      pacman: "fd",
      apk: "fd",
      zypper: "fd",
      brew: "fd",
      winget: "sharkdp.fd",
      omarchy: "fd",
    },
  },
  {
    name: "eza",
    mise: "eza",
    purpose: "ls and tree with colors and icons",
    required: false,
    advice: {
      apt: "eza",
      dnf: "eza",
      pacman: "eza",
      apk: "eza",
      zypper: "eza",
      brew: "eza",
      winget: "eza-community.eza",
      omarchy: "eza",
    },
  },
  {
    name: "bat",
    mise: "bat",
    purpose: "cat with syntax highlighting",
    required: false,
    advice: {
      apt: "bat",
      dnf: "bat",
      pacman: "bat",
      apk: "bat",
      zypper: "bat",
      brew: "bat",
      winget: "sharkdp.bat",
      omarchy: "bat",
    },
  },
  {
    name: "yq",
    mise: "yq",
    purpose: "YAML on the command line",
    required: false,
    advice: {
      pacman: "go-yq",
      brew: "yq",
      winget: "MikeFarah.yq",
      omarchy: "go-yq",
      fallback:
        "snshah apply   # installs yq with mise (distro yq packages are a different tool)",
    },
  },
  {
    name: "delta",
    mise: "delta",
    purpose: "readable git diffs",
    required: false,
    advice: {
      apt: "git-delta",
      dnf: "git-delta",
      pacman: "git-delta",
      apk: "delta",
      brew: "git-delta",
      winget: "dandavison.delta",
      omarchy: "git-delta",
    },
  },
  {
    name: "bwrap",
    purpose: "Claude Code sandbox",
    required: false,
    linuxOnly: true,
    advice: {
      apt: "bubblewrap",
      dnf: "bubblewrap",
      pacman: "bubblewrap",
      apk: "bubblewrap",
      zypper: "bubblewrap",
      omarchy: "bubblewrap",
    },
  },
  {
    name: "socat",
    versionArgs: ["-V"],
    purpose: "Claude Code sandbox",
    required: false,
    linuxOnly: true,
    advice: {
      apt: "socat",
      dnf: "socat",
      pacman: "socat",
      apk: "socat",
      zypper: "socat",
      omarchy: "socat",
    },
  },
];

function detectManager(ctx: Context): PackageManager | undefined {
  const PATH = ctx.env.PATH ?? "";
  if (ctx.platform === "windows")
    return Bun.which("winget", { PATH }) ? "winget" : undefined;
  if (ctx.platform === "macos") return "brew";
  if (ctx.omarchy) return "omarchy";
  let release = "";
  try {
    release = readFileSync("/etc/os-release", "utf8");
  } catch {
    /* unknown distribution */
  }
  const ids =
    (/^ID=(.*)$/m.exec(release)?.[1] ?? "") +
    " " +
    (/^ID_LIKE=(.*)$/m.exec(release)?.[1] ?? "");
  const id = ids.replaceAll('"', "");
  if (/\b(debian|ubuntu)\b/.test(id)) return "apt";
  if (/\b(fedora|rhel|centos)\b/.test(id)) return "dnf";
  if (/\barch\b/.test(id)) return "pacman";
  if (/\balpine\b/.test(id)) return "apk";
  if (/\b(suse|opensuse)\b/.test(id)) return "zypper";
  if (Bun.which("brew", { PATH })) return "brew";
  return undefined;
}

export function installCommand(
  manager: PackageManager,
  packages: string[],
  hasSudo = true,
): string {
  const list = packages.join(" ");
  // Debian and others may have no sudo for this user; then root's su works.
  const root = (cmd: string) => (hasSudo ? `sudo ${cmd}` : `su -c '${cmd}'`);
  switch (manager) {
    case "apt":
      return root(`apt-get update && apt-get install -y ${list}`).replace(
        "sudo apt-get update && apt-get",
        "sudo apt-get update && sudo apt-get",
      );
    case "dnf":
      return root(`dnf install -y ${list}`);
    case "pacman":
      return root(`pacman -S --needed ${list}`);
    case "apk":
      return root(`apk add ${list}`);
    case "zypper":
      return root(`zypper install -y ${list}`);
    case "brew":
      return `brew install ${list}`;
    case "winget":
      return packages.map((p) => `winget install --id ${p} -e`).join("; ");
    case "omarchy":
      return packages
        .map((p) =>
          p === "oh-my-posh"
            ? "omarchy pkg aur add oh-my-posh-bin"
            : `omarchy pkg add ${p}`,
        )
        .join("; ");
    default:
      return assertNever(manager);
  }
}

type Check = {
  check: string;
  status: "ok" | "warn" | "missing";
  detail: string;
  /** The installed version, for checks that are tools. */
  version?: string;
};

/** First dotted version number a tool prints, e.g. "2.47.3" from "git version 2.47.3". */
export function parseVersion(text: string): string | undefined {
  return /\d+(?:\.\d+)+/.exec(text)?.[0];
}

function toolVersion(path: string, args: readonly string[]): string {
  try {
    const r = Bun.spawnSync([path, ...args], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      timeout: 5000,
    });
    return (
      parseVersion(`${r.stdout.toString()}\n${r.stderr.toString()}`) ??
      "unknown version"
    );
  } catch {
    return "unknown version";
  }
}

/** A human name for this OS, so advice says where it applies. */
function systemName(ctx: Context): string {
  switch (ctx.platform) {
    case "macos":
      return "macOS";
    case "windows":
      return "Windows";
    case "wsl":
      return `${distroName() ?? "Linux"} on WSL`;
    case "linux":
      return ctx.omarchy ? "Omarchy" : (distroName() ?? "Linux");
    default:
      return assertNever(ctx.platform);
  }
}

/** The one thing to do next, with the command to paste. */
type NextStep = { title: string; command: string };

const githubSignIn =
  "gh auth login --web --git-protocol https && gh auth setup-git";

/** Without a network call: a token in the environment, or a saved login. */
export function githubSignedIn(ctx: Context): boolean {
  for (const name of ["GH_TOKEN", "GITHUB_TOKEN"])
    if (ctx.env[name]) return true;
  const dir =
    ctx.env.GH_CONFIG_DIR && isAbsolute(ctx.env.GH_CONFIG_DIR)
      ? ctx.env.GH_CONFIG_DIR
      : join(xdgConfigHome(ctx), "gh");
  try {
    return readFileSync(join(dir, "hosts.yml"), "utf8").includes("github.com");
  } catch {
    return false;
  }
}

function xdgConfigHome(ctx: Context): string {
  return xdg(ctx.env, ctx.home, "XDG_CONFIG_HOME", ".config");
}

/** Authoritative check, used by doctor: asks gh for a token without printing it. */
function ghHasToken(gh: string, env: Env): boolean {
  if (env.GH_TOKEN || env.GITHUB_TOKEN) return true;
  try {
    return (
      Bun.spawnSync([gh, "auth", "token"], {
        env: cleanEnv(env),
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
        timeout: 10_000,
      }).exitCode === 0
    );
  } catch {
    return false;
  }
}

async function doctor(ctx: Context): Promise<{
  checks: Check[];
  advice: string[];
  next: NextStep[];
  platform: Platform;
  system: string;
  manager?: PackageManager;
}> {
  const checks: Check[] = [];
  const envPath = ctx.env.PATH ?? "";
  // Tools mise installs are found through its shims, as in an activated shell.
  const PATH = [ctx.miseShims, envPath].join(delimiter);
  checks.push({
    check: "bun",
    status: versionAtLeast(Bun.version, minimumBun) ? "ok" : "missing",
    detail: `runtime (needs ${minimumBun} or newer)`,
    version: Bun.version,
  });
  let config: WorkshopConfig = defaultConfig;
  try {
    const effective = await loadEffective(ctx);
    config = effective.config;
    checks.push({
      check: "profiles",
      status: "ok",
      detail: `${effective.profiles.filter((p) => p.matched).length} of ${effective.profiles.length} profile.d file(s) match this machine`,
    });
    checks.push({
      check: "config",
      status: effective.privateSource ? "ok" : "warn",
      detail: effective.privateSource
        ? `${tilde(ctx, ctx.configFile)} is valid`
        : "not created yet; run snshah apply",
    });
  } catch (error) {
    checks.push({
      check: "config",
      status: "missing",
      detail: (error as Error).message,
    });
  }
  const onPath = envPath
    .split(delimiter)
    .some((d) => resolve(d) === resolve(ctx.binDir));
  checks.push({
    check: "path",
    status: onPath ? "ok" : "warn",
    detail: onPath
      ? `${tilde(ctx, ctx.binDir)} is on PATH`
      : `${tilde(ctx, ctx.binDir)} is not on PATH yet; open a new shell after snshah apply`,
  });

  const manager = detectManager(ctx);
  const wanted = new Map(wantedTools(config));
  const missing: Tool[] = []; // need a system package
  const byApply: string[] = []; // `snshah apply` will install these
  const inList = new Set<string>();
  const find = (tool: Tool): string | null =>
    Bun.which(tool.name, { PATH }) ??
    (tool.name === "oh-my-posh" && existsSync(ctx.poshBinary)
      ? ctx.poshBinary
      : tool.name === "mise" && existsSync(ctx.miseBinary)
        ? ctx.miseBinary
        : null);
  const row = (
    name: string,
    purpose: string,
    found: string | null,
    level: Check["status"],
    args?: readonly string[],
  ) =>
    checks.push({
      check: name,
      status: found ? "ok" : level,
      detail: found ? purpose : `not installed (${purpose})`,
      ...(found ? { version: toolVersion(found, args ?? ["--version"]) } : {}),
    });
  const poshByApply = !!(await planPosh(ctx, config).catch(() => undefined));
  const miseByApply =
    toolManagerOn(config) && !!miseTarget() && !miseOnPath(ctx);
  for (const tool of tools) {
    if (tool.linuxOnly && !(ctx.platform === "linux" || ctx.platform === "wsl"))
      continue;
    if (tool.mise) inList.add(tool.mise);
    const found = find(tool);
    const level = tool.required ? "missing" : "warn";
    const providedByMise =
      !!tool.mise && wanted.has(tool.mise) && toolManagerOn(config);
    row(tool.name, tool.purpose, found, level, tool.versionArgs);
    if (found) continue;
    if (tool.name === "oh-my-posh" && poshByApply) byApply.push("Oh My Posh");
    else if (tool.name === "mise" && miseByApply) byApply.push("mise");
    else if (providedByMise) byApply.push(tool.mise!);
    else missing.push(tool);
  }
  // Tools you added to `tools` that doctor has no row for.
  for (const [name] of wanted) {
    if (inList.has(name) || /[:/@]/.test(name)) continue;
    const found = Bun.which(name, { PATH }) ?? null;
    row(name, "from your tools list", found, "warn");
    if (!found) byApply.push(name);
  }

  const next: NextStep[] = [];
  const gh = Bun.which("gh", { PATH });
  if (gh) {
    const signedIn = ghHasToken(gh, ctx.env);
    const helper =
      capture(
        ["git", "config", "--get-all", "credential.https://github.com.helper"],
        { env: ctx.env },
      )?.includes("gh") ?? false;
    if (!signedIn) {
      checks.push({
        check: "github",
        status: "warn",
        detail:
          "not signed in; git clone, push and gh will fail on private repositories until you sign in",
      });
      next.push({
        title: "Sign in to GitHub before git or gh fail on you:",
        command: githubSignIn,
      });
    } else if (!helper) {
      checks.push({
        check: "github",
        status: "warn",
        detail: "signed in, but git is not set up to use that login",
      });
      next.push({
        title: "Let git use your GitHub login:",
        command: "gh auth setup-git",
      });
    } else {
      checks.push({
        check: "github",
        status: "ok",
        detail: "signed in, and git uses that login",
      });
    }
  }

  {
    const state = await readState(ctx);
    const found = detectFonts(ctx, state.fonts?.kind);
    checks.push({
      check: "fonts",
      status: found.kind === "yes" ? "ok" : "warn",
      detail: `Nerd Font ${{ yes: "installed", no: "missing", unknown: "unknown" }[found.kind]}: ${found.why}`,
    });
    next.push(...fontsNext(found));
  }

  // Over SSH: always say how you got in, and point at keys when it was not one.
  if (ctx.env.SSH_CONNECTION) {
    const session = await detectSession(ctx);
    if (session.kind === "ssh") {
      const copy: NextStep = {
        title: "See how to set up an SSH key from your own computer:",
        command: "snshah ssh copy",
      };
      if (session.method === "publickey") {
        checks.push({
          check: "ssh",
          status: "ok",
          detail: "logged in with an SSH key",
        });
      } else if (usedPassword(session.method)) {
        checks.push({
          check: "ssh",
          status: "warn",
          detail:
            "logged in with a password; an SSH key is safer and you stop typing it",
        });
        next.push(copy);
      } else {
        const fix = exposeAuthInfoAdvice(
          ctx,
          isWindows || !!Bun.which("sudo", { PATH: envPath }),
        );
        checks.push({
          check: "ssh",
          status: "warn",
          detail: fix.enabled
            ? "login method unknown: sshd exposes it for new logins only; log out and back in"
            : "login method unknown: sshd doesn't tell users how they logged in, so the password-login hint can't be exact",
        });
        if (!fix.enabled)
          next.push({
            title:
              "Let sshd tell snshah how you logged in (then log out and back in):",
            command: fix.command,
          });
        next.push({
          ...copy,
          title: `If you used a password: ${copy.title.toLowerCase()}`,
        });
      }
    }
  }

  const advice: string[] = [];
  const hasSudo = isWindows || !!Bun.which("sudo", { PATH: envPath });
  const viaManager = missing
    .filter((t) => manager && t.advice[manager])
    .map((t) => t.advice[manager!]!);
  if (byApply.length)
    advice.push(
      `snshah apply   # installs ${byApply.join(", ")} for you in your account, no sudo`,
    );
  if (manager && viaManager.length)
    advice.push(installCommand(manager, viaManager, hasSudo));
  for (const tool of missing) {
    if (manager && tool.advice[manager]) continue;
    advice.push(
      tool.advice.fallback ??
        `${tool.name}: no ${manager ?? "known"} package on ${systemName(ctx)}; install it from its project's releases.`,
    );
  }
  return {
    checks,
    advice,
    next,
    platform: ctx.platform,
    system: systemName(ctx),
    manager,
  };
}

/** The exact command that turns on sshd's ExposeAuthInfo (sets SSH_USER_AUTH at login). */
export function exposeAuthInfoAdvice(
  ctx: Context,
  hasSudo: boolean,
): { enabled: boolean; command: string } {
  const sshd = readSshd();
  if (sshd?.get("exposeauthinfo") === "yes")
    return { enabled: true, command: "" };
  const service =
    existsSync("/lib/systemd/system/ssh.service") ||
    existsSync("/usr/lib/systemd/system/ssh.service")
      ? "ssh"
      : "sshd";
  const dropIn = existsSync("/etc/ssh/sshd_config.d");
  const write = dropIn
    ? "echo 'ExposeAuthInfo yes' | tee /etc/ssh/sshd_config.d/50-snshah.conf"
    : "echo 'ExposeAuthInfo yes' | tee -a /etc/ssh/sshd_config";
  const body = `${write} >/dev/null && systemctl reload ${service}`;
  return {
    enabled: false,
    command: hasSudo
      ? `echo 'ExposeAuthInfo yes' | sudo tee ${dropIn ? "/etc/ssh/sshd_config.d/50-snshah.conf" : "-a /etc/ssh/sshd_config"} >/dev/null && sudo systemctl reload ${service}`
      : `su -c "${body}"`,
  };
}

/** Which shell the user is probably in, for the one-line reload command. */
export function guessShell(env: Env): Shell {
  const name = basename(env.SHELL ?? "").replace(/\.exe$/, "");
  if (member(shells, name)) return name;
  return isWindows || env.PSModulePath ? "pwsh" : "bash";
}

/** A child process can't change its parent shell: the snshah function does it, or we say how. */
export function reloadCommand(shell: Shell): string {
  switch (shell) {
    case "bash":
    case "zsh":
      return `eval "$(snshah shell ${shell})"`;
    case "fish":
      return "snshah shell fish | source";
    case "pwsh":
      return "snshah shell pwsh | Out-String | Invoke-Expression";
    default:
      return assertNever(shell);
  }
}

function reloadAdvice(ctx: Context): void {
  if (ctx.env.SNSHAH_RELOAD === "1") {
    say("🔄 Reloading snshah in this shell...", "action");
    return;
  }
  say("🔁 To use the changes in this shell, run:", "action");
  console.log(`  ${reloadCommand(guessShell(ctx.env))}`);
  console.log(
    "  or log out and back in (new shells pick them up by themselves).",
  );
}

function printNext(next: readonly NextStep[]): void {
  for (const step of next) {
    say(step.title, "pending");
    console.log(`  ${step.command}`);
  }
}

// ---------------------------------------------------------------------------
// update: pinned to one upstream commit, applied only after a preview
// ---------------------------------------------------------------------------

async function resolveRevision(ref: string): Promise<string> {
  if (/^[0-9a-f]{40}$/.test(ref)) return ref;
  const remote = `https://github.com/${upstream.owner}/${upstream.repo}.git`;
  const listed = capture([
    "git",
    "ls-remote",
    "--exit-code",
    remote,
    `refs/heads/${ref}`,
    `refs/tags/${ref}`,
  ]);
  const fromGit = listed?.split(/\s+/)[0];
  if (fromGit && /^[0-9a-f]{40}$/.test(fromGit)) return fromGit;
  const response = await fetch(
    `https://api.github.com/repos/${upstream.owner}/${upstream.repo}/commits/${encodeURIComponent(ref)}`,
    {
      headers: { Accept: "application/vnd.github.sha", "User-Agent": "snshah" },
    },
  );
  const sha = (await response.text()).trim();
  if (!response.ok || !/^[0-9a-f]{40}$/.test(sha))
    throw new Error(
      `Could not resolve ${upstream.owner}/${upstream.repo}@${ref}.`,
    );
  return sha;
}

async function installedRevision(ctx: Context): Promise<string | undefined> {
  const text = await readText(ctx.receipt);
  if (!text) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    return isObject(parsed) && typeof parsed.revision === "string"
      ? parsed.revision
      : undefined;
  } catch {
    return undefined;
  }
}

async function update(
  ctx: Context,
  options: { check: boolean; yes: boolean; ref?: string },
): Promise<number> {
  const ref = options.ref ?? ctx.env.SNSHAH_REF ?? upstream.ref;
  const revision = await resolveRevision(ref);
  const current = await installedRevision(ctx);
  say(
    `Installed: ${current ? current.slice(0, 12) : "unknown"} (v${cliVersion}). Available on ${ref}: ${revision.slice(0, 12)}.`,
    "action",
  );
  if (current === revision) {
    say("Already up to date. No changes needed.", "success");
    return 0;
  }
  await mkdir(ctx.cacheDir, { recursive: true });
  const archive = join(ctx.cacheDir, `${upstream.repo}-${revision}.tar.gz`);
  if (!(await exists(archive))) {
    const response = await fetch(
      `https://codeload.github.com/${upstream.owner}/${upstream.repo}/tar.gz/${revision}`,
    );
    if (!response.ok)
      throw new Error(`Download failed: HTTP ${response.status}`);
    await writeAtomic(
      archive,
      new Uint8Array(await response.arrayBuffer()),
      0o644,
    );
  }
  const staging = await mkdtemp(join(tmpdir(), "snshah-update-"));
  try {
    const member = `${upstream.repo}-${revision}/${upstream.directory}`;
    if (
      run(["tar", "-xzf", archive, "-C", staging, member], { quiet: true }) !==
      0
    ) {
      await rm(archive, { force: true });
      throw new Error(
        "Could not extract the downloaded revision; the cached archive was removed. Re-run snshah update.",
      );
    }
    const candidate = join(staging, member, "snshah.ts");
    const bun = process.execPath;
    say("Preview of the candidate's changes:", "action");
    if (run([bun, "--no-env-file", candidate, "plan"], { env: ctx.env }) !== 0)
      throw new Error("The candidate could not plan; nothing was changed.");
    if (options.check) return 0;
    if (!options.yes) {
      if (!process.stdin.isTTY)
        throw new UsageError("Re-run with --yes to apply without a prompt.");
      const clack = await prompts();
      const ok = await clack.confirm({
        message: `Apply ${revision.slice(0, 12)}?`,
      });
      if (clack.isCancel(ok) || !ok) return 1;
    }
    const code = run(
      [
        bun,
        "--no-env-file",
        candidate,
        "apply",
        "--yes",
        "--revision",
        revision,
      ],
      { env: ctx.env },
    );
    // Keep this repository's own checkout current too, when it is cloned.
    if (code === 0)
      try {
        await gitUpdate(ctx, upstream.repo, false);
      } catch (error) {
        say((error as Error).message, "pending");
      }
    return code;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// State: $XDG_STATE_HOME/snshah/state.json, typed and validated on read
// ---------------------------------------------------------------------------

export type UpdateCheck =
  | { kind: "never" }
  | { kind: "running"; startedAt: string }
  | {
      kind: "checked";
      at: string;
      ref: string;
      latest: string;
      installed?: string;
    }
  | { kind: "failed"; at: string; ref: string; error: string };
export type State = {
  version: 1;
  /** The CLI version whose first interactive shell already ran doctor. */
  doctorRanFor?: string;
  /** When the daily "sign in to GitHub" reminder last showed. */
  githubReminderAt?: string;
  /** The SSH connection whose password-login hint already showed. */
  sshHintFor?: string;
  /** What the owner said about Nerd Fonts in the terminal they look at. */
  fonts?: { kind: FontWord; at: string };
  /** `.snshah.path.ts` files the owner trusted: real path to the SHA-256 of what they read. */
  trusted?: Record<string, string>;
  update: UpdateCheck;
};
const emptyState: State = { version: 1, update: { kind: "never" } };
export const updateCheckIntervalMs = 60 * 60 * 1000;
/** A check that started but never finished is retried after this long. */
const staleRunMs = 10 * 60 * 1000;

function isUpdateCheck(v: unknown): v is UpdateCheck {
  if (!isObject(v)) return false;
  const str = (k: string) => typeof v[k] === "string";
  switch (v.kind) {
    case "never":
      return true;
    case "running":
      return str("startedAt");
    case "checked":
      return (
        str("at") &&
        str("ref") &&
        str("latest") &&
        (v.installed === undefined || str("installed"))
      );
    case "failed":
      return str("at") && str("ref") && str("error");
    default:
      return false;
  }
}

/** A cached check counts only for the install it was made against; an upgrade makes it stale. */
export function updateNotice(
  u: UpdateCheck,
  installed: string | undefined,
  color = false,
): string | undefined {
  if (!(
    u.kind === "checked" &&
    installed &&
    u.installed === installed &&
    u.latest !== installed
  ))
    return undefined;
  const c = (code: string, t: string) =>
    color ? `\x1b[${code}m${t}\x1b[0m` : t;
  return [
    c("1;33", "⬆️  snshah update available"),
    c("2", `${installed.slice(0, 8)} → ${u.latest.slice(0, 8)} on ${u.ref}`),
    c("1;36", "🚀 run: snshah update"),
  ].join("  ");
}

export function updateDue(
  u: UpdateCheck,
  installed: string | undefined,
  now: number,
): boolean {
  switch (u.kind) {
    case "never":
      return true;
    case "running":
      return now - Date.parse(u.startedAt) > staleRunMs;
    case "checked":
      return (
        u.installed !== installed ||
        now - Date.parse(u.at) > updateCheckIntervalMs
      );
    case "failed":
      return now - Date.parse(u.at) > updateCheckIntervalMs;
    default:
      return assertNever(u);
  }
}

/** Unreadable or unknown state is treated as empty, never as an error. */
export async function readState(ctx: Context): Promise<State> {
  try {
    const v: unknown = JSON.parse((await readText(ctx.stateFile)) ?? "");
    if (
      isObject(v) &&
      v.version === 1 &&
      (v.doctorRanFor === undefined || typeof v.doctorRanFor === "string") &&
      (v.githubReminderAt === undefined ||
        typeof v.githubReminderAt === "string") &&
      (v.sshHintFor === undefined || typeof v.sshHintFor === "string") &&
      (v.trusted === undefined ||
        (isObject(v.trusted) &&
          Object.values(v.trusted).every((h) => typeof h === "string"))) &&
      (v.fonts === undefined ||
        (isObject(v.fonts) &&
          member(fontWords, v.fonts.kind) &&
          typeof v.fonts.at === "string")) &&
      isUpdateCheck(v.update)
    )
      return v as State;
  } catch {
    /* missing or corrupt: start over */
  }
  return emptyState;
}

/** Read-modify-write from fresh disk state, so a background check and a shell never undo each other's field. */
async function patchState(
  ctx: Context,
  change: (state: State) => State,
): Promise<void> {
  // A lock file keeps two processes (a shell and the background check) from
  // reading the same old state; a lock older than 5 s is a crashed holder's.
  const lock = `${ctx.stateFile}.lock`;
  await mkdir(dirname(lock), { recursive: true });
  let held = false;
  for (let i = 0; i < 100 && !held; i++) {
    try {
      await (await openFile(lock, "wx")).close();
      held = true;
    } catch {
      const age =
        Date.now() -
        ((await stat(lock).catch(() => undefined))?.mtimeMs ?? Date.now());
      if (age > 5000) await rm(lock, { force: true });
      else await Bun.sleep(20);
    }
  }
  try {
    await writeState(ctx, change(await readState(ctx)));
  } finally {
    if (held) await rm(lock, { force: true });
  }
}

async function writeState(ctx: Context, state: State): Promise<void> {
  await writeAtomic(
    ctx.stateFile,
    JSON.stringify(state, null, 2) + "\n",
    0o644,
  );
}

/** Resolve the upstream ref, record the answer, and report it. Never downloads. */
async function checkForUpdate(
  ctx: Context,
  refOption: string | undefined,
  quiet: boolean,
): Promise<number> {
  const ref = refOption ?? ctx.env.SNSHAH_REF ?? upstream.ref;
  const at = new Date().toISOString();
  const installed = await installedRevision(ctx);
  let update: UpdateCheck;
  try {
    update = {
      kind: "checked",
      at,
      ref,
      latest: await resolveRevision(ref),
      ...(installed ? { installed } : {}),
    };
  } catch (error) {
    update = { kind: "failed", at, ref, error: (error as Error).message };
  }
  await patchState(ctx, (st) => ({ ...st, update }));
  if (update.kind === "failed") {
    if (!quiet) say(update.error, "error");
    return 1;
  }
  if (!quiet)
    say(
      update.latest === installed
        ? `Up to date with ${ref} (${update.latest.slice(0, 12)}).`
        : `An update is available on ${ref}: ${update.latest.slice(0, 12)} (installed ${installed ? installed.slice(0, 12) : "unknown"}). Run snshah update.`,
      update.latest === installed ? "success" : "action",
    );
  return 0;
}

/**
 * Runs from each interactive shell's startup (snshah shell <shell> --greet).
 * Writes only to stderr, never fails the shell, and stays fast: doctor runs
 * once per installed CLI version, and the update check runs at most hourly
 * in a detached background process whose answer the next shell prints.
 * SNSHAH_GREET=0 turns it off.
 */
async function greet(ctx: Context, config: WorkshopConfig): Promise<void> {
  if (ctx.env.SNSHAH_GREET === "0") return;
  try {
    let state = await readState(ctx);
    const self = [process.execPath, "--no-env-file", import.meta.path];
    const doctorShown = state.doctorRanFor !== cliVersion;
    if (doctorShown) {
      state = { ...state, doctorRanFor: cliVersion };
      await patchState(ctx, (st) => ({ ...st, doctorRanFor: cliVersion }));
      // The shell is about to get these PATH entries from the init code it
      // evaluates, so doctor sees the PATH the user will actually have.
      const bunBin = join(ctx.env.BUN_INSTALL || join(ctx.home, ".bun"), "bin");
      const color =
        !!process.stderr.isTTY && !ctx.env.NO_COLOR && ctx.env.TERM !== "dumb";
      const r = Bun.spawnSync([...self, "doctor"], {
        env: {
          ...ctx.env,
          PATH: [ctx.binDir, bunBin, ctx.env.PATH ?? ""].join(delimiter),
          ...(color ? { SNSHAH_COLOR: "1", FORCE_COLOR: "1" } : {}),
        },
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });
      process.stderr.write(r.stdout);
      process.stderr.write(r.stderr);
    }
    const tty =
      !!process.stderr.isTTY && !ctx.env.NO_COLOR && ctx.env.TERM !== "dumb";
    const colorEnv = tty ? { SNSHAH_COLOR: "1", FORCE_COLOR: "1" } : {};
    // Over SSH with a password: show how to copy a key, the same text as `snshah ssh copy`.
    if (ctx.env.SNSHAH_SSH_HINT !== "0" && ctx.env.SSH_CONNECTION) {
      const id = createHash("sha256")
        .update(ctx.env.SSH_CONNECTION)
        .digest("hex")
        .slice(0, 16);
      if (state.sshHintFor !== id) {
        state = { ...state, sshHintFor: id };
        await patchState(ctx, (st) => ({ ...st, sshHintFor: id }));
        const session = await detectSession(ctx);
        if (session.kind === "ssh" && usedPassword(session.method)) {
          // Short on purpose: the full per-OS steps are one command away.
          const c = (code: string, t: string) =>
            tty ? `\x1b[${code}m${t}\x1b[0m` : t;
          process.stderr.write(
            `${c("1;33", "🔐 You signed in with a password. SSH keys are safer, and you will not have to type it again.")}\n  ${c("36", "To see how to copy a key into this server from your computer, run:")} ${c("1;32", "snshah ssh copy")}\n  ${c("2", "Shown once per login. Silence it with SNSHAH_SSH_HINT=0.")}\n`,
          );
        }
      }
    }
    // GitHub: remind about signing in, at most once a day, until it is done.
    const ghWanted =
      (toolManagerOn(config) &&
        config.tools?.gh !== undefined &&
        config.tools.gh !== false) ||
      !!Bun.which("gh", { PATH: ctx.env.PATH ?? "" });
    const lastReminder = Date.parse(state.githubReminderAt ?? "");
    if (
      ghWanted &&
      !doctorShown && // doctor's own output already says it
      !githubSignedIn(ctx) &&
      !(Date.now() - lastReminder < 24 * 3600 * 1000)
    ) {
      const remindedAt = new Date().toISOString();
      state = { ...state, githubReminderAt: remindedAt };
      await patchState(ctx, (st) => ({ ...st, githubReminderAt: remindedAt }));
      const y = (t: string) => (tty ? `\x1b[33m${t}\x1b[0m` : t);
      process.stderr.write(
        `${y("snshah: GitHub is not signed in yet; git and gh will fail on private repositories until you do.")}\n  ${githubSignIn}\n`,
      );
    }
    const u = state.update;
    const installed = await installedRevision(ctx);
    const notice = updateNotice(u, installed, tty);
    if (notice) process.stderr.write(`${notice}\n`);
    const now = Date.now();
    const due = updateDue(u, installed, now);
    if (due) {
      await patchState(ctx, (st) => ({
        ...st,
        update: { kind: "running", startedAt: new Date(now).toISOString() },
      }));
      const child = spawnChild(
        self[0]!,
        [...self.slice(1), "update", "--check", "--quiet"],
        { env: ctx.env, detached: true, stdio: "ignore", windowsHide: true },
      );
      child.unref();
    }
  } catch {
    /* a greeting must never break a shell */
  }
}

// ---------------------------------------------------------------------------
// ssh: keys, copying a key to a server, hosts, and the password-login hint
// ---------------------------------------------------------------------------

export const clientOses = ["linux", "macos", "windows"] as const;
export type ClientOs = (typeof clientOses)[number];
export type LoginMethod =
  "publickey" | "password" | "keyboard-interactive" | "unknown";
export type SshSession =
  | { kind: "local" }
  | {
      kind: "ssh";
      client: string;
      clientPort: number;
      server: string;
      serverPort: number;
      method: LoginMethod;
      evidence: "login-record" | "sshd-log" | "no-authorized-keys" | "none";
    };
export type SshTarget = { user: string; host: string; port: number };
export type PublicKey = {
  type: string;
  blob: string;
  comment: string;
  options?: string;
};

export const usedPassword = (method: LoginMethod): boolean =>
  method === "password" || method === "keyboard-interactive";

const publicKeyTypes: readonly string[] = [
  "ssh-ed25519",
  "ssh-rsa",
  "ecdsa-sha2-nistp256",
  "ecdsa-sha2-nistp384",
  "ecdsa-sha2-nistp521",
  "sk-ssh-ed25519@openssh.com",
  "sk-ecdsa-sha2-nistp256@openssh.com",
];

/** One authorized_keys or .pub line: optional options, type, base64 blob, comment. */
export function parsePublicKey(line: string): PublicKey | undefined {
  const text = line.trim();
  if (!text || text.startsWith("#")) return;
  const tokens = text.split(/\s+/);
  const at = tokens.findIndex((t) => publicKeyTypes.includes(t));
  if (at < 0) return;
  const type = tokens[at]!;
  const blob = tokens[at + 1];
  if (!blob || !/^[A-Za-z0-9+/]+={0,3}$/.test(blob)) return;
  const raw = Buffer.from(blob, "base64");
  // The blob starts with its own length-prefixed type name; it must agree.
  if (
    raw.length < 4 ||
    raw.subarray(4, 4 + raw.readUInt32BE(0)).toString() !== type
  )
    return;
  return {
    type,
    blob,
    comment: tokens.slice(at + 2).join(" "),
    ...(at > 0 ? { options: tokens.slice(0, at).join(" ") } : {}),
  };
}

/** OpenSSH's SHA256 fingerprint of a key blob. */
export function fingerprint(blob: string): string {
  return (
    "SHA256:" +
    createHash("sha256")
      .update(Buffer.from(blob, "base64"))
      .digest("base64")
      .replace(/=+$/, "")
  );
}

export function parseSshConnection(
  value: string | undefined,
):
  | Omit<Extract<SshSession, { kind: "ssh" }>, "kind" | "method" | "evidence">
  | undefined {
  const [client, clientPort, server, serverPort] = (value ?? "")
    .trim()
    .split(/\s+/);
  const cp = Number(clientPort);
  const sp = Number(serverPort);
  if (!client || !server || !Number.isInteger(cp) || !Number.isInteger(sp))
    return;
  return { client, clientPort: cp, server, serverPort: sp };
}

function loginMethod(token: string | undefined): LoginMethod | undefined {
  if (!token) return;
  if (token === "publickey") return "publickey";
  if (token === "password") return "password";
  if (token.startsWith("keyboard-interactive")) return "keyboard-interactive";
  return "unknown";
}

/** sshd's ExposeAuthInfo file starts each line with the method that succeeded. */
export function methodFromAuthInfo(
  text: string | undefined,
): LoginMethod | undefined {
  return loginMethod(text?.trim().split(/\s+/)[0]);
}

/** The method sshd logged for exactly this connection (client address and port). */
export function methodFromLog(
  text: string,
  user: string,
  client: string,
  clientPort: number,
): LoginMethod | undefined {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `Accepted (\\S+) for ${escape(user)} from ${escape(client)} port ${clientPort}\\b`,
  );
  let found: LoginMethod | undefined;
  for (const line of text.split("\n")) {
    const m = re.exec(line);
    if (m) found = loginMethod(m[1]);
  }
  return found;
}

function recentAuthLog(): string {
  if (isWindows) return "";
  try {
    const r = Bun.spawnSync(
      [
        "journalctl",
        "-u",
        "ssh",
        "-u",
        "sshd",
        "--since",
        "-15min",
        "-o",
        "cat",
        "--no-pager",
        "-q",
      ],
      { stdin: "ignore", stdout: "pipe", stderr: "ignore", timeout: 3000 },
    );
    if (r.exitCode === 0 && r.stdout.length) return r.stdout.toString();
  } catch {
    /* no journalctl */
  }
  for (const file of ["/var/log/auth.log", "/var/log/secure"]) {
    try {
      return readFileSync(file, "utf8").slice(-300_000);
    } catch {
      /* not readable */
    }
  }
  return "";
}

const sshDir = (ctx: Context) => join(ctx.home, ".ssh");
const authorizedKeysFile = (ctx: Context) =>
  join(sshDir(ctx), "authorized_keys");
const sshUser = (ctx: Context) =>
  ctx.env.USER || ctx.env.LOGNAME || ctx.env.USERNAME || userInfo().username;

export async function authorizedKeys(ctx: Context): Promise<PublicKey[]> {
  return ((await readText(authorizedKeysFile(ctx))) ?? "")
    .split("\n")
    .map(parsePublicKey)
    .filter((k): k is PublicKey => !!k);
}

/** How this shell got here: local, or over SSH with a key or a password (best evidence first). */
export async function detectSession(ctx: Context): Promise<SshSession> {
  const c = parseSshConnection(ctx.env.SSH_CONNECTION);
  if (!c) return { kind: "local" };
  const base = { kind: "ssh" as const, ...c };
  const record = ctx.env.SSH_USER_AUTH
    ? methodFromAuthInfo(await readText(ctx.env.SSH_USER_AUTH))
    : undefined;
  if (record) return { ...base, method: record, evidence: "login-record" };
  const logged = methodFromLog(
    recentAuthLog(),
    sshUser(ctx),
    c.client,
    c.clientPort,
  );
  if (logged) return { ...base, method: logged, evidence: "sshd-log" };
  // With no authorized keys, a key cannot have been what let you in.
  if (!(await authorizedKeys(ctx)).length)
    return { ...base, method: "password", evidence: "no-authorized-keys" };
  return { ...base, method: "unknown", evidence: "none" };
}

/**
 * The client's OS, only from what the client itself sent. snshah on the
 * client exports LC_SNSHAH_OS (an LC_* name that default ssh and sshd configs
 * already send and accept); iTerm2 sends LC_TERMINAL.
 */
export function detectClientOs(
  env: Env,
): { os: ClientOs; evidence: string } | undefined {
  const sent = (env.LC_SNSHAH_OS ?? env.SNSHAH_CLIENT_OS)?.toLowerCase();
  if (member(clientOses, sent))
    return { os: sent, evidence: "sent by the client's snshah" };
  if (env.LC_TERMINAL === "iTerm2")
    return { os: "macos", evidence: "iTerm2 terminal" };
  return undefined;
}

/** `user@host`, `host`, or `user@host:port`-free; the port is separate. */
export function parseTarget(
  text: string,
  defaultUser: string,
  port = 22,
): SshTarget {
  const at = text.lastIndexOf("@");
  const user = at >= 0 ? text.slice(0, at) : defaultUser;
  const host = at >= 0 ? text.slice(at + 1) : text;
  const word = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
  if (!word.test(user) || !word.test(host))
    throw new UsageError(`${text} is not a valid [user@]host.`);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new UsageError(`${port} is not a valid port.`);
  return { user, host, port };
}

export type CopyStep = { note: string; command: string };

/** What to type, on a machine of this OS, to put its key into `target`. */
export function copyCommands(os: ClientOs, t: SshTarget): CopyStep[] {
  const dest = `${t.user}@${t.host}`;
  const p = t.port !== 22 ? ` -p ${t.port}` : "";
  const test: CopyStep = {
    note: "Check that it works without a password:",
    command: `ssh -o PreferredAuthentications=publickey${p} ${dest} true && echo "key login works"`,
  };
  switch (os) {
    case "linux":
    case "macos":
      return [
        {
          note: "See which public keys you already have (look for id_ed25519.pub):",
          command: "ls ~/.ssh/*.pub",
        },
        {
          note: "Create one only if id_ed25519.pub is missing (does nothing if it exists):",
          command:
            "test -f ~/.ssh/id_ed25519.pub || ssh-keygen -t ed25519 -a 100",
        },
        {
          note: `Copy your key into ${dest} (safe to run twice):`,
          command: `ssh-copy-id -i ~/.ssh/id_ed25519.pub${p} ${dest}`,
        },
        test,
        ...(os === "macos"
          ? [
              {
                note: "Optional: let the macOS keychain remember the passphrase:",
                command: "ssh-add --apple-use-keychain ~/.ssh/id_ed25519",
              },
            ]
          : []),
      ];
    case "windows":
      return [
        {
          note: "See which public keys you already have (look for id_ed25519.pub):",
          command: "Get-ChildItem $env:USERPROFILE\\.ssh\\*.pub",
        },
        {
          note: "Create one only if id_ed25519.pub is missing (does nothing if it exists):",
          command:
            'if (-not (Test-Path "$env:USERPROFILE\\.ssh\\id_ed25519.pub")) { ssh-keygen -t ed25519 -a 100 }',
        },
        {
          note: `Copy your key into ${dest} (PowerShell; safe to run twice):`,
          command: `$k = (Get-Content "$env:USERPROFILE\\.ssh\\id_ed25519.pub").Trim(); ssh${p} ${dest} "umask 077; mkdir -p ~/.ssh; touch ~/.ssh/authorized_keys; grep -qF '$($k.Split(' ')[1])' ~/.ssh/authorized_keys || echo '$k' >> ~/.ssh/authorized_keys"`,
        },
        test,
        {
          note: "Optional: have Windows remember the passphrase (admin PowerShell for the first line):",
          command:
            "Get-Service ssh-agent | Set-Service -StartupType Automatic; Start-Service ssh-agent; ssh-add $env:USERPROFILE\\.ssh\\id_ed25519",
        },
      ];
    default:
      return assertNever(os);
  }
}

/** The shell command that adds one key to the server's authorized_keys, once. */
export function authorizeScript(key: PublicKey): string {
  const comment = key.comment.replace(/[^A-Za-z0-9@._ -]/g, "_");
  const line = `${key.type} ${key.blob}${comment ? ` ${comment}` : ""}`;
  return `umask 077; mkdir -p ~/.ssh; touch ~/.ssh/authorized_keys; grep -qF '${key.blob}' ~/.ssh/authorized_keys || printf '%s\\n' '${line}' >> ~/.ssh/authorized_keys`;
}

type KeyRow = {
  path: string;
  type: string;
  fingerprint: string;
  comment: string;
  privateKey: "present" | "missing";
  problem?: string;
};

export async function listKeys(ctx: Context): Promise<KeyRow[]> {
  const dir = sshDir(ctx);
  let files: string[] = [];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".pub"))
      .sort();
  } catch {
    return [];
  }
  const rows: KeyRow[] = [];
  for (const file of files) {
    const key = parsePublicKey((await readText(join(dir, file))) ?? "");
    if (!key) continue;
    const priv = join(dir, file.slice(0, -4));
    const hasPrivate = existsSync(priv);
    const mode = hasPrivate ? await fileMode(priv) : undefined;
    rows.push({
      path: tilde(ctx, join(dir, file)),
      type: key.type.replace(/^ssh-/, "").replace("ecdsa-sha2-", "ecdsa-"),
      fingerprint: fingerprint(key.blob),
      comment: key.comment,
      privateKey: hasPrivate ? "present" : "missing",
      ...(mode !== undefined && (mode & 0o077) !== 0
        ? {
            problem: `${tilde(ctx, priv)} is readable by others (mode ${mode.toString(8)}); run chmod 600 ${tilde(ctx, priv)}`,
          }
        : {}),
    });
  }
  return rows;
}

/** Add public keys to ~/.ssh/authorized_keys once each (matched by key, not comment). */
export async function authorizeKeys(
  ctx: Context,
  lines: readonly string[],
  options: { tag?: string; allowOptions?: boolean } = {},
): Promise<{ added: number; present: number; invalid: number }> {
  const file = authorizedKeysFile(ctx);
  let text = (await readText(file)) ?? "";
  const known = new Set(
    text
      .split("\n")
      .map(parsePublicKey)
      .filter((k): k is PublicKey => !!k)
      .map((k) => k.blob),
  );
  const result = { added: 0, present: 0, invalid: 0 };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const key = parsePublicKey(line);
    if (!key || (key.options && !options.allowOptions)) {
      result.invalid++;
      continue;
    }
    if (known.has(key.blob)) {
      result.present++;
      continue;
    }
    known.add(key.blob);
    const out = key.comment || !options.tag ? line : `${line} ${options.tag}`;
    text += `${text === "" || text.endsWith("\n") ? "" : "\n"}${out}\n`;
    result.added++;
  }
  if (result.added) {
    await mkdir(sshDir(ctx), { recursive: true, mode: 0o700 });
    await writeAtomic(file, text, 0o600);
  }
  if (!isWindows && existsSync(file)) {
    if ((await fileMode(sshDir(ctx))) !== 0o700)
      await chmod(sshDir(ctx), 0o700);
    if ((await fileMode(file)) !== 0o600) await chmod(file, 0o600);
  }
  return result;
}

// --- ~/.ssh/config host blocks, one marked block per alias

const hostMarks = (alias: string) => ({
  begin: `# >>> snshah ssh host ${alias} >>>`,
  end: `# <<< snshah ssh host ${alias} <<<`,
});
const aliasWord = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function hostBlock(
  alias: string,
  t: SshTarget,
  identity?: string,
): string {
  const { begin, end } = hostMarks(alias);
  return [
    begin,
    `Host ${alias}`,
    `    HostName ${t.host}`,
    `    User ${t.user}`,
    ...(t.port !== 22 ? [`    Port ${t.port}`] : []),
    ...(identity
      ? [`    IdentityFile ${identity}`, "    IdentitiesOnly yes"]
      : []),
    "    SendEnv LC_SNSHAH_OS LC_SNSHAH_FONTS",
    end,
  ].join("\n");
}

export function listHostAliases(config: string): string[] {
  return [...config.matchAll(/^# >>> snshah ssh host (\S+) >>>$/gm)].map(
    (m) => m[1]!,
  );
}

export function removeHostBlock(config: string, alias: string): string {
  const { begin, end } = hostMarks(alias);
  const lines = config.split("\n");
  const first = lines.indexOf(begin);
  const last = lines.indexOf(end);
  if (first < 0 || last <= first) return config;
  const rest = [...lines.slice(0, first), ...lines.slice(last + 1)];
  return rest.join("\n").replace(/\n{3,}/g, "\n\n");
}

// --- sshd settings, read only (advice, never changes)

/** First value wins, as in sshd; stops at the first Match block. Follows simple Include globs. */
export function parseSshdConfig(
  read: (path: string) => string | undefined,
  list: (dir: string) => string[],
  file = "/etc/ssh/sshd_config",
): Map<string, string> {
  const out = new Map<string, string>();
  let match: string | undefined; // the Match line whose settings we are reading
  const visit = (path: string, depth: number): boolean => {
    const text = read(path);
    if (text === undefined || depth > 3) return true;
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const [word, ...rest] = line.split(/\s+/);
      const key = word!.toLowerCase();
      if (key === "match") {
        match = rest.join(" ");
        continue;
      }
      if (match !== undefined) {
        // Only record what can reopen passwords; the top-level answer stays top-level.
        if (
          key === "passwordauthentication" &&
          rest[0]?.toLowerCase() === "yes" &&
          !out.has("match-password")
        )
          out.set("match-password", match);
        continue;
      }
      if (key === "include") {
        for (const pattern of rest) {
          const full = pattern.startsWith("/")
            ? pattern
            : join(dirname(file), pattern);
          const base = basename(full);
          const rx = new RegExp(
            "^" +
              base
                .replace(/[.+^${}()|[\]\\]/g, "\\$&")
                .replace(/\*/g, ".*")
                .replace(/\?/g, ".") +
              "$",
          );
          for (const name of list(dirname(full))
            .filter((n) => rx.test(n))
            .sort())
            if (!visit(join(dirname(full), name), depth + 1)) return false;
        }
        continue;
      }
      if (!out.has(key)) out.set(key, rest.join(" ").toLowerCase());
    }
    return true;
  };
  visit(file, 0);
  return out;
}

function readSshd(): Map<string, string> | undefined {
  if (isWindows) return undefined;
  try {
    readFileSync("/etc/ssh/sshd_config", "utf8");
  } catch {
    return undefined;
  }
  return parseSshdConfig(
    (p) => {
      try {
        return readFileSync(p, "utf8");
      } catch {
        return undefined;
      }
    },
    (d) => {
      try {
        return readdirSync(d);
      } catch {
        return [];
      }
    },
  );
}

// --- commands

function sshTarget(
  ctx: Context,
  text: string | undefined,
  port?: string,
): SshTarget {
  const p = port === undefined ? undefined : Number(port);
  if (text !== undefined) return parseTarget(text, sshUser(ctx), p ?? 22);
  // On the server: the address the client used to reach this machine.
  const c = parseSshConnection(ctx.env.SSH_CONNECTION);
  if (c) return { user: sshUser(ctx), host: c.server, port: p ?? c.serverPort };
  let host = hostname();
  for (const list of Object.values(networkInterfaces()))
    for (const a of list ?? [])
      if (a.family === "IPv4" && !a.internal) {
        host = a.address;
        break;
      }
  return { user: sshUser(ctx), host, port: p ?? 22 };
}

const osLabel: Record<ClientOs, string> = {
  linux: "🐧 Linux",
  macos: "🍎 macOS",
  windows: "🪟 Windows (PowerShell)",
};

function paint(
  name: "cyan" | "green" | "yellow" | "red" | "dim" | "bold",
  text: string,
): string {
  return chalk ? chalk[name](text) : text;
}

/** The one rendering of "how to copy a key here", shared by `ssh copy` and the login hint. */
export function printCopyHelp(
  target: SshTarget,
  oses: readonly ClientOs[],
  options: { evidence?: string; banner?: string; local?: boolean },
): void {
  const dest = `${target.user}@${target.host}`;
  if (options.banner)
    console.log(paint("yellow", paint("bold", options.banner)));
  console.log(
    paint(
      "cyan",
      options.local
        ? `Copy your key into ${dest}:`
        : `To copy a key into ${dest}, run these on your own computer:`,
    ),
  );
  if (options.evidence) console.log(paint("dim", `  (${options.evidence})`));
  else if (oses.length > 1)
    console.log(
      paint(
        "dim",
        "  (I can't tell which kind of computer you are on, so here are all three)",
      ),
    );
  for (const os of oses) {
    console.log("");
    console.log(paint("bold", osLabel[os]));
    copyCommands(os, target).forEach((step, i) => {
      console.log(paint("green", `  ${i + 1}. ${step.note}`));
      console.log(`       ${step.command}`);
    });
  }
}

const localOs = (ctx: Context): ClientOs =>
  ctx.platform === "macos"
    ? "macos"
    : ctx.platform === "windows"
      ? "windows"
      : "linux";

async function sshStatus(ctx: Context): Promise<void> {
  const rows: Check[] = [];
  const session = await detectSession(ctx);
  const next: NextStep[] = [];
  const usedKey = session.kind === "ssh" && session.method === "publickey";
  if (session.kind === "local") {
    rows.push({
      check: "session",
      status: "ok",
      detail: "local console (not an SSH login)",
    });
  } else {
    const how: Record<LoginMethod, string> = {
      publickey: "an SSH key",
      password: "a password",
      "keyboard-interactive": "a password (keyboard-interactive)",
      unknown: "an unknown method",
    };
    rows.push({
      check: "session",
      status: usedPassword(session.method) ? "warn" : "ok",
      detail: `logged in over SSH from ${session.client} with ${how[session.method]}${session.evidence === "no-authorized-keys" ? " (this account has no authorized keys, so it was not a key)" : ""}`,
    });
  }
  const keys = await listKeys(ctx);
  if (!keys.length) {
    rows.push({
      check: "keys",
      status: "warn",
      detail: `no key pair in ${tilde(ctx, sshDir(ctx))}`,
    });
    // Over SSH the key that matters lives on the computer you came from.
    if (session.kind === "local")
      next.push({
        title: "Create one on this machine:",
        command: "snshah ssh new",
      });
  }
  for (const k of keys)
    rows.push({
      check: "key",
      status: k.problem || k.privateKey === "missing" ? "warn" : "ok",
      detail:
        `${k.type} ${k.fingerprint} ${k.comment}`.trim() +
        (k.privateKey === "missing" ? " (no private key beside it)" : ""),
    });
  for (const k of keys)
    if (k.problem)
      rows.push({ check: "mode", status: "warn", detail: k.problem });
  const agent = ctx.env.SSH_AUTH_SOCK;
  if (!agent) {
    rows.push({
      check: "agent",
      status: "warn",
      detail: "no ssh-agent in this shell, so you retype key passphrases",
    });
  } else if (Bun.which("ssh-add")) {
    const r = Bun.spawnSync(["ssh-add", "-l"], {
      env: cleanEnv(ctx.env),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "ignore",
      timeout: 5000,
    });
    const n =
      r.exitCode === 0 ? r.stdout.toString().trim().split("\n").length : 0;
    rows.push({
      check: "agent",
      status: n ? "ok" : "warn",
      detail: n
        ? `${n} key(s) loaded`
        : "running, but no keys loaded; run ssh-add",
    });
  }
  const authorized = await authorizedKeys(ctx);
  rows.push({
    check: "authorized",
    status: "ok",
    detail: `${authorized.length} key(s) can log in to this account (snshah ssh authorized)`,
  });
  const sshd = readSshd();
  if (sshd) {
    const passwords = (sshd.get("passwordauthentication") ?? "yes") !== "no";
    rows.push({
      check: "sshd",
      status: passwords ? "warn" : "ok",
      detail: passwords
        ? "this machine's SSH server still accepts passwords (snshah ssh harden)"
        : sshd.has("match-password")
          ? `this machine's SSH server accepts keys, except passwords are allowed for: Match ${sshd.get("match-password")}`
          : "this machine's SSH server accepts keys only",
    });
    if (!passwords && sshd.has("match-password") && !usedKey)
      rows.push({
        check: "method",
        status: "warn",
        detail:
          "the login method could not be read; since passwords are allowed for that Match rule, you may have used one",
      });
  }
  printChecks(rows);
  printNext(next);
  // Not a key login (or can't tell): show how to put a key here, per client OS.
  if (session.kind === "ssh" && !usedKey) {
    console.log("");
    await sshCopy(ctx, undefined, {});
  }
}

async function sshKeys(ctx: Context, json: boolean): Promise<void> {
  const keys = await listKeys(ctx);
  if (json) return console.log(JSON.stringify(keys, null, 2));
  if (!keys.length) {
    say(
      `No key pair in ${tilde(ctx, sshDir(ctx))}. Create one with snshah ssh new.`,
      "pending",
    );
    return;
  }
  for (const k of keys) {
    say(
      `${k.path}  ${k.type}  ${k.fingerprint}  ${k.comment}`,
      k.problem ? "pending" : "success",
    );
    if (k.problem) console.log(`  ${k.problem}`);
    const line = (
      (await readText(join(ctx.home, k.path.slice(1)))) ?? ""
    ).trim();
    console.log(`  ${paint("dim", "public key (safe to share):")}`);
    console.log(`  ${line}`);
  }
}

async function sshNew(
  ctx: Context,
  options: { name: string; comment?: string },
): Promise<void> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(options.name))
    throw new UsageError(`${options.name} is not a valid key file name.`);
  const priv = join(sshDir(ctx), options.name);
  if (existsSync(priv)) {
    say(`${tilde(ctx, priv)} already exists; nothing to do.`, "success");
    return;
  }
  if (!Bun.which("ssh-keygen"))
    throw new Error(
      "ssh-keygen is not installed. Install the OpenSSH client (see snshah doctor).",
    );
  await mkdir(sshDir(ctx), { recursive: true, mode: 0o700 });
  const comment = options.comment ?? `${sshUser(ctx)}@${hostname()}`;
  say(
    `Creating ${tilde(ctx, priv)}. Choose a passphrase when asked.`,
    "action",
  );
  const code = run(
    ["ssh-keygen", "-t", "ed25519", "-a", "100", "-C", comment, "-f", priv],
    { env: ctx.env },
  );
  if (code !== 0)
    throw new Error("ssh-keygen did not finish; no key was created.");
  say(`Created. Public key (safe to share):`, "success");
  console.log(`  ${((await readText(priv + ".pub")) ?? "").trim()}`);
}

async function sshCopy(
  ctx: Context,
  targetText: string | undefined,
  o: {
    os?: string;
    port?: string;
    key?: string;
    run?: boolean;
    hint?: boolean;
  },
): Promise<void> {
  const target = sshTarget(ctx, targetText, o.port);
  if (o.os !== undefined && o.os !== "all" && !member(clientOses, o.os))
    throw new UsageError("--os must be linux, macos, windows or all.");
  // With a target you are on the client, so its OS is known; on the server it is not.
  let oses: readonly ClientOs[];
  let evidence: string | undefined;
  if (o.os === "all") oses = clientOses;
  else if (member(clientOses, o.os)) {
    oses = [o.os];
    evidence = `${o.os}, as you asked`;
  } else if (targetText !== undefined) {
    oses = [localOs(ctx)];
    evidence = `this computer is ${osLabel[localOs(ctx)]}`;
  } else {
    const seen = detectClientOs(ctx.env);
    oses = seen ? [seen.os] : clientOses;
    evidence = seen
      ? `your computer looks like ${osLabel[seen.os]}: ${seen.evidence}. Use --os all for the others`
      : undefined;
  }
  if (o.run) {
    if (targetText === undefined)
      throw new UsageError(
        "Run it on the computer you want to log in from: snshah ssh copy user@server --run",
      );
    await runCopy(ctx, target, o.key);
    return;
  }
  printCopyHelp(target, oses, {
    evidence,
    local: targetText !== undefined,
    banner: o.hint
      ? "🔐 You signed in with a password. SSH keys are safer, and you will not have to type it again."
      : undefined,
  });
  if (targetText !== undefined)
    console.log(
      paint(
        "dim",
        `\nOr let snshah do it from here: snshah ssh copy ${target.user}@${target.host}${target.port !== 22 ? ` -p ${target.port}` : ""} --run`,
      ),
    );
  else if (o.hint)
    console.log(
      paint(
        "dim",
        "\nThis hint shows once per login. Silence it with SNSHAH_SSH_HINT=0. More: snshah ssh",
      ),
    );
}

async function runCopy(
  ctx: Context,
  target: SshTarget,
  keyPath?: string,
): Promise<void> {
  if (!Bun.which("ssh"))
    throw new Error(
      "ssh is not installed. Install the OpenSSH client (see snshah doctor).",
    );
  let pub = keyPath ? resolve(expandHome(ctx, keyPath)) : undefined;
  if (!pub) {
    const first = (await listKeys(ctx))[0];
    if (!first) {
      await sshNew(ctx, { name: "id_ed25519" });
      pub = join(sshDir(ctx), "id_ed25519.pub");
    } else pub = resolve(expandHome(ctx, first.path));
  }
  const key = parsePublicKey((await readText(pub)) ?? "");
  if (!key || key.options)
    throw new Error(`${tilde(ctx, pub)} does not hold a public key.`);
  const dest = `${target.user}@${target.host}`;
  say(
    `Copying ${tilde(ctx, pub)} into ${dest}. Type its password once when asked.`,
    "action",
  );
  const code = run(
    [
      "ssh",
      ...(target.port !== 22 ? ["-p", String(target.port)] : []),
      dest,
      authorizeScript(key),
    ],
    { env: ctx.env },
  );
  if (code !== 0) throw new Error("The key was not copied.");
  await sshTest(ctx, target, pub.slice(0, -4));
}

async function sshTest(
  ctx: Context,
  target: SshTarget,
  identity?: string,
): Promise<void> {
  if (!Bun.which("ssh"))
    throw new Error(
      "ssh is not installed. Install the OpenSSH client (see snshah doctor).",
    );
  const dest = `${target.user}@${target.host}`;
  const r = Bun.spawnSync(
    [
      "ssh",
      "-o",
      "BatchMode=yes",
      "-o",
      "PreferredAuthentications=publickey",
      "-o",
      "ConnectTimeout=8",
      ...(identity ? ["-i", identity, "-o", "IdentitiesOnly=yes"] : []),
      ...(target.port !== 22 ? ["-p", String(target.port)] : []),
      dest,
      "true",
    ],
    {
      env: cleanEnv(ctx.env),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      timeout: 20_000,
    },
  );
  if (r.exitCode === 0) {
    say(`Key login to ${dest} works.`, "success");
    return;
  }
  const why = r.stderr.toString().trim().split("\n").pop() ?? "";
  say(`Key login to ${dest} did not work: ${why}`, "error");
  console.log(
    `  Copy a key first: snshah ssh copy ${dest}${target.port !== 22 ? ` -p ${target.port}` : ""} --run`,
  );
  process.exitCode = 1;
}

async function sshAuthorize(
  ctx: Context,
  o: { key?: string; file?: string; github?: string; stdin?: boolean },
): Promise<void> {
  const chosen = [
    o.key,
    o.file,
    o.github,
    o.stdin ? "stdin" : undefined,
  ].filter((x) => x !== undefined);
  if (chosen.length !== 1)
    throw new UsageError(
      "Give exactly one of --key, --file, --github or --stdin.",
    );
  let lines: string[];
  let tag: string | undefined;
  let allowOptions = true;
  if (o.key !== undefined) lines = [o.key];
  else if (o.file !== undefined)
    lines = ((await readText(resolve(expandHome(ctx, o.file)))) ?? "").split(
      "\n",
    );
  else if (o.stdin) lines = (await Bun.stdin.text()).split("\n");
  else {
    const user = o.github!;
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(user))
      throw new UsageError(`${user} is not a valid GitHub user name.`);
    const response = await fetch(`https://github.com/${user}.keys`, {
      headers: { "User-Agent": "snshah" },
    });
    if (!response.ok)
      throw new Error(
        `GitHub has no keys for ${user} (HTTP ${response.status}).`,
      );
    lines = (await response.text()).split("\n");
    tag = `github:${user}`;
    allowOptions = false; // keys from the network never carry options
  }
  const r = await authorizeKeys(ctx, lines, { tag, allowOptions });
  if (!r.added && !r.present && !r.invalid)
    throw new UsageError("No public keys found in the input.");
  if (r.invalid)
    say(
      `${r.invalid} line(s) were not valid public keys and were skipped.`,
      "pending",
    );
  say(
    r.added
      ? `Added ${r.added} key(s) to ${tilde(ctx, authorizedKeysFile(ctx))}.`
      : "No changes needed.",
    "success",
  );
  if (r.present) console.log(`  ${r.present} key(s) were already there.`);
}

async function sshAuthorized(ctx: Context, json: boolean): Promise<void> {
  const keys = await authorizedKeys(ctx);
  const rows = keys.map((k) => ({
    type: k.type,
    fingerprint: fingerprint(k.blob),
    comment: k.comment,
    ...(k.options ? { options: k.options } : {}),
  }));
  if (json) return console.log(JSON.stringify(rows, null, 2));
  if (!rows.length) {
    say(
      `No keys in ${tilde(ctx, authorizedKeysFile(ctx))}; only passwords can log in here.`,
      "pending",
    );
    return;
  }
  for (const r of rows)
    say(
      `${r.type}  ${r.fingerprint}  ${r.comment}${r.options ? `  [${r.options}]` : ""}`,
      "success",
    );
}

async function sshHarden(ctx: Context): Promise<void> {
  const sshd = readSshd();
  const rows: Check[] = [];
  if (!sshd) {
    rows.push({
      check: "sshd",
      status: "warn",
      detail:
        "cannot read /etc/ssh/sshd_config here (no SSH server, or not allowed)",
    });
  } else {
    const passwords = (sshd.get("passwordauthentication") ?? "yes") !== "no";
    rows.push({
      check: "passwords",
      status: passwords ? "warn" : "ok",
      detail: passwords
        ? "the SSH server accepts passwords"
        : "the SSH server accepts keys only",
    });
    const root = sshd.get("permitrootlogin") ?? "prohibit-password";
    rows.push({
      check: "root",
      status: root === "yes" ? "warn" : "ok",
      detail: `root login: ${root}`,
    });
    rows.push({
      check: "records",
      status: sshd.get("exposeauthinfo") === "yes" ? "ok" : "warn",
      detail:
        sshd.get("exposeauthinfo") === "yes"
          ? "ExposeAuthInfo is on, so snshah knows exactly how you logged in"
          : "ExposeAuthInfo is off; turning it on lets snshah tell password logins from key logins exactly",
    });
  }
  printChecks(rows);
  const service = detectManager(ctx) === "apt" ? "ssh" : "sshd";
  say(
    "Only after `snshah ssh test <user@host>` shows key login works, and with this session still open:",
    "pending",
  );
  console.log(
    [
      "  sudo tee /etc/ssh/sshd_config.d/10-snshah.conf >/dev/null <<'EOF'",
      "  PasswordAuthentication no",
      "  KbdInteractiveAuthentication no",
      "  ExposeAuthInfo yes",
      "  EOF",
      `  sudo sshd -t && sudo systemctl reload ${service}`,
    ].join("\n"),
  );
  console.log(
    paint(
      "dim",
      "  snshah prints this and never runs it. Test from a second terminal before you close the first.",
    ),
  );
}

async function sshHostAdd(
  ctx: Context,
  alias: string,
  targetText: string,
  o: { port?: string; identity?: string },
): Promise<void> {
  if (!aliasWord.test(alias))
    throw new UsageError(`${alias} is not a valid host alias.`);
  const target = parseTarget(
    targetText,
    sshUser(ctx),
    o.port === undefined ? 22 : Number(o.port),
  );
  if (
    o.identity !== undefined &&
    !/^[A-Za-z0-9~/][A-Za-z0-9._/~-]*$/.test(o.identity)
  )
    throw new UsageError(`${o.identity} is not a plain path.`);
  const file = join(sshDir(ctx), "config");
  const { begin, end } = hostMarks(alias);
  const current = (await readText(file)) ?? "";
  const next = upsertBlock(
    current,
    begin,
    end,
    hostBlock(alias, target, o.identity),
  );
  if (next === current)
    return say(`${alias} is already set up. No changes needed.`, "success");
  await mkdir(sshDir(ctx), { recursive: true, mode: 0o700 });
  await writeAtomic(file, next, 0o600);
  say(
    `Saved ${alias} in ${tilde(ctx, file)}. Connect with: ssh ${alias}`,
    "success",
  );
}

async function sshHostList(ctx: Context): Promise<void> {
  const config = (await readText(join(sshDir(ctx), "config"))) ?? "";
  const aliases = listHostAliases(config);
  if (!aliases.length)
    return say(
      "No hosts saved by snshah. Add one with snshah ssh host add <alias> <user@host>.",
      "pending",
    );
  for (const a of aliases) say(a, "success");
}

async function sshHostRemove(ctx: Context, alias: string): Promise<void> {
  const file = join(sshDir(ctx), "config");
  const current = (await readText(file)) ?? "";
  const next = removeHostBlock(current, alias);
  if (next === current)
    return say(
      `${alias} is not saved by snshah. No changes needed.`,
      "success",
    );
  await writeAtomic(file, next, 0o600);
  say(`Removed ${alias}.`, "success");
}

// ---------------------------------------------------------------------------
// Directory profiles: `.snshah.path.ts`, trusted by content hash
// ---------------------------------------------------------------------------

export type DirStatus =
  | { kind: "trusted"; hash: string }
  | { kind: "untrusted"; hash: string }
  | { kind: "changed"; hash: string }
  | { kind: "blocked"; reason: string };
export type DirFile = { file: string; status: DirStatus };
export type DirLoaded = {
  file: string;
  matched: boolean;
  config: DirectoryContribution;
};
export type DirEffective = {
  files: DirFile[];
  loaded: DirLoaded[];
  /** Which file set each alias, variable or PATH entry (the nearest wins). */
  source: Record<string, string>;
  aliases: Record<string, AliasValue>;
  env: Record<string, string>;
  path: string[];
};

/** Every `.snshah.path.ts` from `start` up to the root, farthest first. */
export function dirProfileChain(
  start: string,
  isFile: (path: string) => boolean = (p) => existsSync(p),
): string[] {
  const found: string[] = [];
  let dir = resolve(start);
  for (;;) {
    const file = join(dir, dirProfileFile);
    if (isFile(file)) found.unshift(file);
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return found;
}

async function dirFileStatus(
  ctx: Context,
  file: string,
  trusted: Record<string, string> | undefined,
): Promise<DirFile> {
  try {
    const info = await lstat(file);
    if (!info.isFile())
      return {
        file,
        status: {
          kind: "blocked",
          reason: "must be a regular file, not a link",
        },
      };
    // No owner or mode rules: the content hash is the trust, and any edit
    // (by anyone) makes the file untrusted again.
    const hash = createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
    const known = trusted?.[await realpath(file)];
    return {
      file,
      status:
        known === undefined
          ? { kind: "untrusted", hash }
          : known === hash
            ? { kind: "trusted", hash }
            : { kind: "changed", hash },
    };
  } catch (error) {
    return {
      file,
      status: { kind: "blocked", reason: (error as Error).message },
    };
  }
}

const dirAllowedKeys = ["aliases", "env", "path"];

/** Run one trusted file. The bytes that were hashed are the bytes that run. */
async function importDirProfile(
  ctx: Context,
  file: string,
): Promise<{ selector: Selector; config: DirectoryContribution }> {
  const staging = await mkdtemp(join(tmpdir(), "snshah-dir-"));
  try {
    const copy = join(staging, "profile.ts");
    await writeFile(copy, await readFile(file), { mode: 0o600 });
    const module: Record<string, unknown> = await import(
      pathToFileURL(copy).href
    );
    for (const key of Object.keys(module))
      if (!["selector", "config"].includes(key))
        fail(key, "is not a directory-profile export (use selector, config)");
    const selector = module.selector ?? { kind: "always" };
    validateSelector(selector, "repo");
    const config = module.config ?? {};
    if (!isObject(config)) fail("config", "must be an object");
    for (const key of Object.keys(config))
      if (!dirAllowedKeys.includes(key))
        fail(`config.${key}`, "is not allowed here (use aliases, env, path)");
    validateConfig(config);
    const base = dirname(file);
    return {
      selector,
      config: {
        ...(config.aliases ? { aliases: config.aliases } : {}),
        ...(config.env ? { env: config.env } : {}),
        ...(config.path
          ? { path: config.path.map((p) => resolve(base, expandHome(ctx, p))) }
          : {}),
      },
    };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/** The trusted files at `start` and above, merged: farthest first, nearest wins. */
export async function effectiveDirProfile(
  ctx: Context,
  start: string,
  options: { facts?: FactSource } = {},
): Promise<DirEffective> {
  const state = await readState(ctx);
  const files: DirFile[] = [];
  for (const file of dirProfileChain(start))
    files.push(await dirFileStatus(ctx, file, state.trusted));
  const facts = options.facts ?? factSource(ctx);
  const out: DirEffective = {
    files,
    loaded: [],
    source: {},
    aliases: {},
    env: {},
    path: [],
  };
  for (const f of files) {
    if (f.status.kind !== "trusted") continue;
    const { selector, config } = await importDirProfile(ctx, f.file);
    const matched = matches(selector, facts);
    out.loaded.push({ file: f.file, matched, config });
    if (!matched) continue;
    for (const [k, v] of Object.entries(config.aliases ?? {})) {
      out.aliases[k] = v;
      out.source[`alias ${k}`] = f.file;
    }
    for (const [k, v] of Object.entries(config.env ?? {})) {
      out.env[k] = v;
      out.source[`env ${k}`] = f.file;
    }
    for (const dir of config.path ?? []) {
      out.path = [dir, ...out.path.filter((p) => p !== dir)];
      out.source[`path ${dir}`] = f.file;
    }
  }
  return out;
}

/** Shell code that applies the effective profile through the hook's helpers. */
export function renderDirProfile(
  shell: Shell,
  effective: DirEffective,
): string {
  if (shell === "pwsh")
    throw new UsageError(
      "Directory profiles are not available in PowerShell yet.",
    );
  const quote = shell === "fish" ? quoteFish : quotePosix;
  const flavor = shell === "fish" ? "fish" : "posix";
  const lines: string[] = [];
  for (const [name, value] of Object.entries(effective.env))
    lines.push(`__snshah_dir_env ${name} ${quote(value)}`);
  for (const [name, value] of Object.entries(effective.aliases)) {
    const text = aliasText(value, flavor);
    if (text !== undefined)
      lines.push(`__snshah_dir_alias ${name} ${quote(text)}`);
  }
  // The farthest entry goes in first, so the nearest ends up first on PATH.
  for (const dir of [...effective.path].reverse())
    lines.push(`__snshah_dir_path ${quote(dir)}`);
  return lines.join("\n") + (lines.length ? "\n" : "");
}

/** What the prompt hook runs: print shell code on stdout, notices on stderr. Never fails a shell. */
async function profileLoad(ctx: Context, shellName: string): Promise<number> {
  const shell = member(shells, shellName) ? shellName : undefined;
  if (!shell || shell === "pwsh") return 0;
  try {
    const starts = (ctx.env.SNSHAH_DIRFILES ?? "").split("\n").filter(Boolean);
    const start = starts.length
      ? dirname(starts[starts.length - 1]!)
      : process.cwd();
    const effective = await effectiveDirProfile(ctx, start);
    const tty =
      !!process.stderr.isTTY && !ctx.env.NO_COLOR && ctx.env.TERM !== "dumb";
    const c = (code: string, t: string) =>
      tty ? `\x1b[${code}m${t}\x1b[0m` : t;
    for (const f of effective.files) {
      const where = tilde(ctx, f.file);
      switch (f.status.kind) {
        case "trusted":
          break;
        case "untrusted":
        case "changed":
          process.stderr.write(
            `${c("1;33", `🔒 snshah: ${where} ${f.status.kind === "changed" ? "changed since you trusted it" : "is not trusted yet"}.`)} ${c("36", "Read it, then run:")} ${c("1;32", "snshah profile allow")}\n`,
          );
          break;
        case "blocked":
          process.stderr.write(
            `${c("1;31", `⛔ snshah: ${where} ignored: ${f.status.reason}.`)}\n`,
          );
          break;
        default:
          assertNever(f.status);
      }
    }
    const used = effective.loaded.filter((l) => l.matched);
    if (used.length) {
      const n =
        Object.keys(effective.aliases).length +
        Object.keys(effective.env).length +
        effective.path.length;
      process.stderr.write(
        `${c("2", `📂 snshah: ${used.map((l) => tilde(ctx, l.file)).join(", ")} (${n} setting${n === 1 ? "" : "s"}; snshah profile show)`)}\n`,
      );
    }
    process.stdout.write(renderDirProfile(shell, effective));
  } catch (error) {
    process.stderr.write(
      `snshah: directory profile skipped: ${(error as Error).message}\n`,
    );
  }
  return 0;
}

const dirProfileScaffold = `// Per-directory snshah profile. snshah ignores it until you read it and run:
//   snshah profile allow
// Any edit makes it untrusted again. Keep it self-contained (type imports only).
// It applies while your shell is in this directory or below, and is undone when you leave.

// Optional: limit where it applies (platform, distro, has, env, all, any, not).
export const selector = { kind: "always" };

export const config = {
  aliases: {
    // t: "bun test",
  },
  env: {
    // APP_ENV: "development",
  },
  path: [
    // "node_modules/.bin", // relative to this directory
  ],
};
`;

async function profileInit(ctx: Context): Promise<void> {
  const file = join(process.cwd(), dirProfileFile);
  if (await exists(file))
    return say(
      `${tilde(ctx, file)} already exists. No changes needed.`,
      "success",
    );
  await writeFile(file, dirProfileScaffold, { mode: 0o644 });
  say(`Created ${tilde(ctx, file)}.`, "success");
  console.log("Edit it, then trust it with:  snshah profile allow");
}

async function dirTarget(
  ctx: Context,
  fileArg: string | undefined,
): Promise<string> {
  if (fileArg) {
    const file = resolve(process.cwd(), fileArg);
    return file.endsWith(dirProfileFile) ||
      !(await exists(join(file, dirProfileFile)))
      ? file
      : join(file, dirProfileFile);
  }
  const chain = dirProfileChain(process.cwd());
  const nearest = chain.at(-1);
  if (!nearest)
    throw new UsageError(
      `No ${dirProfileFile} in ${tilde(ctx, process.cwd())} or above. Create one with snshah profile init.`,
    );
  return nearest;
}

async function profileAllow(
  ctx: Context,
  fileArg: string | undefined,
  options: { yes?: boolean },
): Promise<void> {
  const file = await dirTarget(ctx, fileArg);
  const entry = await dirFileStatus(ctx, file, undefined);
  if (entry.status.kind === "blocked")
    throw new UsageError(`${tilde(ctx, file)}: ${entry.status.reason}.`);
  const state = await readState(ctx);
  const real = await realpath(file);
  if (state.trusted?.[real] === entry.status.hash)
    return say(
      `${tilde(ctx, file)} is already trusted. No changes needed.`,
      "success",
    );
  console.log(
    paint(
      "cyan",
      `This is ${tilde(ctx, file)}. It will run as code in snshah, and set what is below while you are in its directory:`,
    ),
  );
  console.log("");
  console.log((await readText(file)) ?? "");
  if (!options.yes) {
    if (!process.stdin.isTTY)
      throw new UsageError(
        "Read the file above, then re-run with --yes to trust it.",
      );
    const clack = await prompts();
    const ok = await clack.confirm({ message: "Trust this file?" });
    if (clack.isCancel(ok) || !ok) throw new UsageError("Nothing was changed.");
  }
  const hash = entry.status.hash;
  await patchState(ctx, (st) => ({
    ...st,
    trusted: { ...st.trusted, [real]: hash },
  }));
  say(
    `Trusted ${tilde(ctx, file)}. Any edit makes it untrusted again.`,
    "success",
  );
}

async function profileDeny(
  ctx: Context,
  fileArg: string | undefined,
): Promise<void> {
  const file = await dirTarget(ctx, fileArg);
  const real = await realpath(file).catch(() => file);
  const state = await readState(ctx);
  if (state.trusted?.[real] === undefined)
    return say(
      `${tilde(ctx, file)} is not trusted. No changes needed.`,
      "success",
    );
  await patchState(ctx, (st) => {
    const { [real]: _gone, ...rest } = st.trusted ?? {};
    return { ...st, trusted: rest };
  });
  say(`No longer trusting ${tilde(ctx, file)}.`, "success");
}

async function profileList(ctx: Context, json: boolean): Promise<void> {
  const state = await readState(ctx);
  const files: DirFile[] = [];
  for (const file of dirProfileChain(process.cwd()))
    files.push(await dirFileStatus(ctx, file, state.trusted));
  if (json) return console.log(JSON.stringify(files, null, 2));
  if (!files.length)
    return say(
      `No ${dirProfileFile} in ${tilde(ctx, process.cwd())} or above. Create one with snshah profile init.`,
      "pending",
    );
  const detail: Record<DirStatus["kind"], string> = {
    trusted: "trusted",
    untrusted: "not trusted yet (read it, then snshah profile allow)",
    changed: "changed since you trusted it (snshah profile allow)",
    blocked: "ignored",
  };
  printChecks(
    files.map((f) => ({
      check: tilde(ctx, f.file),
      status:
        f.status.kind === "trusted"
          ? ("ok" as const)
          : f.status.kind === "blocked"
            ? ("missing" as const)
            : ("warn" as const),
      detail:
        f.status.kind === "blocked"
          ? `ignored: ${f.status.reason}`
          : detail[f.status.kind],
    })),
  );
}

async function profileShow(ctx: Context, json: boolean): Promise<void> {
  const e = await effectiveDirProfile(ctx, process.cwd());
  if (json)
    return console.log(
      JSON.stringify(
        {
          files: e.files,
          aliases: e.aliases,
          env: e.env,
          path: e.path,
          source: e.source,
        },
        null,
        2,
      ),
    );
  const rows: Check[] = [];
  for (const [k, v] of Object.entries(e.aliases))
    rows.push({
      check: `alias ${k}`,
      status: "ok",
      detail: `${aliasText(v, "posix") ?? aliasText(v, "pwsh") ?? ""}  (${tilde(ctx, e.source[`alias ${k}`]!)})`,
    });
  for (const [k, v] of Object.entries(e.env))
    rows.push({
      check: `env ${k}`,
      status: "ok",
      detail: `${v}  (${tilde(ctx, e.source[`env ${k}`]!)})`,
    });
  for (const dir of e.path)
    rows.push({
      check: "path",
      status: "ok",
      detail: `${tilde(ctx, dir)}  (${tilde(ctx, e.source[`path ${dir}`]!)})`,
    });
  if (!rows.length) {
    const waiting = e.files.filter((f) => f.status.kind !== "trusted").length;
    return say(
      waiting
        ? `Nothing applies yet: ${waiting} file(s) wait for snshah profile allow.`
        : `Nothing applies here. Create ${dirProfileFile} with snshah profile init.`,
      "pending",
    );
  }
  printChecks(rows);
}

async function profileWhy(ctx: Context, name: string): Promise<void> {
  const e = await effectiveDirProfile(ctx, process.cwd());
  const hits = Object.keys(e.source).filter(
    (k) => k.endsWith(` ${name}`) || k === name,
  );
  if (!hits.length)
    throw new UsageError(`${name} is not set by a directory profile here.`);
  for (const k of hits)
    say(`${k} comes from ${tilde(ctx, e.source[k]!)}`, "success");
}

async function profileCheck(
  ctx: Context,
  fileArg: string | undefined,
): Promise<void> {
  const file = await dirTarget(ctx, fileArg);
  const state = await readState(ctx);
  const entry = await dirFileStatus(ctx, file, state.trusted);
  if (entry.status.kind === "blocked")
    throw new UsageError(`${tilde(ctx, file)}: ${entry.status.reason}.`);
  if (entry.status.kind !== "trusted")
    throw new UsageError(
      `${tilde(ctx, file)} is not trusted, and checking it would run it. Read it, then run snshah profile allow.`,
    );
  const { config } = await importDirProfile(ctx, file);
  const n =
    Object.keys(config.aliases ?? {}).length +
    Object.keys(config.env ?? {}).length +
    (config.path?.length ?? 0);
  say(
    `${tilde(ctx, file)} is valid (${n} setting${n === 1 ? "" : "s"}).`,
    "success",
  );
}

// ---------------------------------------------------------------------------
// ux fonts: does the viewer's terminal have a Nerd Font? Terminals can't say,
// so: your word first, what a client sends over SSH, then local evidence.
// ---------------------------------------------------------------------------

export const fontWords = ["installed", "missing"] as const;
export type FontWord = (typeof fontWords)[number];
export type FontEvidence =
  | { kind: "yes"; why: string }
  | { kind: "no"; why: string }
  | { kind: "unknown"; why: string };

/** Nerd Font family names: "MesloLGS NF", "CaskaydiaCove Nerd Font Mono", ... */
export function isNerdFontName(name: string): boolean {
  return /nerd|\bNF[MP]?\b|caskaydia|meslolgs/i.test(name);
}

/** The font face Windows Terminal's settings.json chooses by default (comments allowed in that file). */
export function terminalFace(settings: string): string | undefined {
  const found =
    /"face"\s*:\s*"([^"]+)"/.exec(settings) ??
    /"fontFace"\s*:\s*"([^"]+)"/.exec(settings);
  return found?.[1];
}

const windowsFontScript = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$names = foreach ($p in 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts','HKLM:\Software\Microsoft\Windows NT\CurrentVersion\Fonts') { if (Test-Path $p) { (Get-Item $p).Property } }
$settings = ''
foreach ($d in 'Microsoft.WindowsTerminal_8wekyb3d8bbwe','Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe') {
  $f = Join-Path $env:LOCALAPPDATA "Packages\$d\LocalState\settings.json"
  if (Test-Path $f) { $settings = Get-Content -Raw $f; break }
}
@{ fonts = @($names); settings = $settings } | ConvertTo-Json -Compress
`;

/** Windows evidence from the registry's font list and Windows Terminal's settings. */
export function windowsFontEvidence(json: string): FontEvidence {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { kind: "unknown", why: "could not read the Windows font list" };
  }
  if (!isObject(data) || !Array.isArray(data.fonts))
    return { kind: "unknown", why: "could not read the Windows font list" };
  const installed = data.fonts.filter(
    (f): f is string => typeof f === "string" && isNerdFontName(f),
  );
  const face =
    typeof data.settings === "string" ? terminalFace(data.settings) : undefined;
  if (!installed.length)
    return { kind: "no", why: "no Nerd Font is installed in Windows" };
  const family = installed[0]!.replace(/\s*\((TrueType|OpenType)\)$/i, "");
  if (face && !isNerdFontName(face))
    return {
      kind: "no",
      why: `${family} is installed, but Windows Terminal uses "${face}"`,
    };
  return {
    kind: "yes",
    why: face
      ? `${family} is installed and Windows Terminal uses "${face}"`
      : `${family} is installed (set it as your terminal's font)`,
  };
}

function fontFileEvidence(ctx: Context): FontEvidence {
  const names: string[] = [];
  const fc = capture(["fc-list", ":", "family"], { env: ctx.env });
  if (fc) names.push(...fc.split("\n"));
  const dirs =
    ctx.platform === "macos"
      ? [join(ctx.home, "Library", "Fonts"), "/Library/Fonts"]
      : [
          join(
            xdg(ctx.env, ctx.home, "XDG_DATA_HOME", ".local/share"),
            "fonts",
          ),
          join(ctx.home, ".fonts"),
        ];
  for (const dir of dirs)
    try {
      names.push(...readdirSync(dir));
    } catch {
      /* no such folder */
    }
  const hit = names.find(isNerdFontName);
  return hit
    ? {
        kind: "yes",
        why: `${hit.trim()} is installed (set it as your terminal's font)`,
      }
    : { kind: "no", why: "no Nerd Font is installed on this machine" };
}

/** Best evidence about the viewer's fonts. Never installs anything. */
export function detectFonts(ctx: Context, saved?: FontWord): FontEvidence {
  const ssh = !!(ctx.env.SSH_CONNECTION ?? ctx.env.SSH_CLIENT);
  const sent = ctx.env.LC_SNSHAH_FONTS?.toLowerCase();
  if (ssh) {
    if (sent === "installed")
      return {
        kind: "yes",
        why: "your client says it has one (LC_SNSHAH_FONTS)",
      };
    if (sent === "missing")
      return {
        kind: "no",
        why: "your client says it has none (LC_SNSHAH_FONTS)",
      };
    if (saved)
      return {
        kind: saved === "installed" ? "yes" : "no",
        why: `you set it to ${saved} on this machine`,
      };
    return {
      kind: "unknown",
      why: "over SSH the server can't see your terminal; run `snshah ux fonts installed` on your own machine",
    };
  }
  if (saved)
    return {
      kind: saved === "installed" ? "yes" : "no",
      why: `you said so (snshah ux fonts ${saved})`,
    };
  if (ctx.platform === "windows" || ctx.platform === "wsl") {
    const script = windowsFontScript;
    const out = capture(
      ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
      { env: ctx.env },
    );
    return out
      ? windowsFontEvidence(out)
      : { kind: "unknown", why: "could not ask Windows about fonts" };
  }
  return fontFileEvidence(ctx);
}

async function fontsStatus(ctx: Context): Promise<void> {
  const state = await readState(ctx);
  const found = detectFonts(ctx, state.fonts?.kind);
  const label = { yes: "installed", no: "missing", unknown: "unknown" }[
    found.kind
  ];
  say(
    `Nerd Font: ${label}. ${found.why}.`,
    found.kind === "yes" ? "success" : "pending",
  );
  if (found.kind !== "yes") printNext(fontsNext(found));
}

function fontsNext(found: FontEvidence): NextStep[] {
  return found.kind === "unknown"
    ? [
        {
          title:
            "When your terminal draws the prompt icons correctly, tell snshah once:",
          command: "snshah ux fonts installed",
        },
        {
          title: "If it shows boxes or ?, install one:",
          command: fontInstallCommand,
        },
      ]
    : found.kind === "no"
      ? [
          {
            title: "Install a Nerd Font, then pick it as your terminal's font:",
            command: fontInstallCommand,
          },
        ]
      : [];
}

const fontInstallCommand = "oh-my-posh font install Meslo";

async function fontsSet(ctx: Context, word: FontWord | "reset"): Promise<void> {
  const state = await readState(ctx);
  const same = word === "reset" ? !state.fonts : state.fonts?.kind === word;
  if (same)
    return say(
      `Fonts already ${word === "reset" ? "unknown" : word}. No changes needed.`,
      "success",
    );
  await patchState(ctx, (st) => {
    const { fonts: _gone, ...others } = st;
    return word === "reset"
      ? others
      : { ...others, fonts: { kind: word, at: new Date().toISOString() } };
  });
  say(
    word === "reset"
      ? "Forgot your answer; doctor shows fonts as unknown again."
      : `Recorded: Nerd Font ${word}. New shells tell servers you ssh into (LC_SNSHAH_FONTS).`,
    "success",
  );
}

async function fontsInstall(ctx: Context, run: boolean): Promise<void> {
  const posh =
    Bun.which("oh-my-posh", { PATH: ctx.env.PATH ?? "" }) ??
    (existsSync(ctx.poshBinary) ? ctx.poshBinary : null);
  if (!run || !posh) {
    say(
      "Install a Nerd Font in your account (run this on the machine whose terminal you look at):",
      "action",
    );
    console.log(`  ${fontInstallCommand}`);
    if (run)
      say("oh-my-posh is not installed yet; run snshah apply first.", "error");
  } else {
    say("Installing Meslo Nerd Font with oh-my-posh...", "action");
    const result = Bun.spawnSync([posh, "font", "install", "Meslo"], {
      stdout: 2,
      stderr: 2,
      stdin: "inherit",
    });
    if (result.exitCode !== 0)
      throw new Error("oh-my-posh font install failed");
  }
  console.log(
    "Then choose it as the font in your terminal (Windows Terminal: Settings > Profiles > Defaults > Appearance > Font face), and run:",
  );
  console.log("  snshah ux fonts installed");
}

// ---------------------------------------------------------------------------
// Output helpers (chalk and clack load lazily; shell/exec never load them)
// ---------------------------------------------------------------------------

type Chalk = {
  [k in "cyan" | "green" | "yellow" | "red" | "dim" | "bold"]: (
    s: string,
  ) => string;
} & { level: number };
let chalk: Chalk | undefined;
const interactive =
  (!!process.stdout.isTTY || process.env.SNSHAH_COLOR === "1") &&
  process.env.TERM !== "dumb" &&
  !process.env.NO_COLOR;

async function loadChalk(): Promise<void> {
  if (!interactive || chalk) return;
  chalk = (await import(`chalk@${dependencies.chalk}`)).default as Chalk;
}
type Clack = {
  confirm(o: { message: string }): Promise<unknown>;
  password(o: { message: string }): Promise<unknown>;
  isCancel(v: unknown): boolean;
};
async function prompts(): Promise<Clack> {
  return (await import(
    `@clack/prompts@${dependencies["@clack/prompts"]}`
  )) as Clack;
}

function say(
  message: string,
  style: "action" | "success" | "pending" | "error" = "action",
): void {
  if (!interactive || !chalk) {
    console.log(message);
    return;
  }
  const icon = { action: "🛠️ ", success: "✅", pending: "🟡", error: "❌" }[
    style
  ];
  const color = {
    action: chalk.cyan,
    success: chalk.green,
    pending: chalk.yellow,
    error: chalk.red,
  }[style];
  console.log(`${icon} ${color(message)}`);
}

/** One line per check: icon, bold name, version in cyan, detail dimmed. */
function printChecks(checks: readonly Check[]): void {
  const width = Math.max(...checks.map((c) => c.check.length));
  const vwidth = Math.max(0, ...checks.map((c) => (c.version ?? "").length));
  for (const c of checks) {
    if (!interactive || !chalk) {
      console.log(`${c.check}${c.version ? ` ${c.version}` : ""}: ${c.detail}`);
      continue;
    }
    const icon = { ok: "✅", warn: "🟡", missing: "❌" }[c.status];
    const name = { ok: chalk.green, warn: chalk.yellow, missing: chalk.red }[
      c.status
    ];
    const version = (c.version ?? "").padEnd(vwidth);
    const detail = c.status === "ok" ? chalk.dim(c.detail) : name(c.detail);
    console.log(
      `${icon} ${chalk.bold(name(c.check.padEnd(width)))}  ${chalk.cyan(version)}  ${detail}`,
    );
  }
}

function describeStep(ctx: Context, step: Step): string {
  switch (step.kind) {
    case "directory":
      return `create ${step.label}: ${tilde(ctx, step.path)} [directory]`;
    case "remove":
      return `remove ${step.label}: ${tilde(ctx, step.path)} [remove]`;
    case "tools":
      return `install ${step.label}: ${step.names.join(", ")} [tools]`;
    case "download":
      return `${step.create ? "install" : "update"} ${step.label}: ${tilde(ctx, step.path)} (SHA-256 checked) [download]`;
    case "command":
      return `run ${step.label}: ${step.run.join(" ")} (because \`${step.unless.join(" ")}\` fails) [command]`;
    case "file":
    case "seed":
    case "block":
    case "json-fill":
    case "toml-fill":
      return `${step.create ? "create" : "update"} ${step.label}: ${tilde(ctx, step.path)} [${step.kind}]`;
    default:
      return assertNever(step);
  }
}

function stepJson(ctx: Context, s: Step) {
  return s.kind === "command"
    ? { kind: s.kind, label: s.label, run: s.run }
    : s.kind === "tools"
      ? { kind: s.kind, label: s.label, tools: s.names }
      : { kind: s.kind, label: s.label, path: tilde(ctx, s.path) };
}

function printExplain(ctx: Context, e: Effective, json: boolean): void {
  const report = {
    facts: factsOf(e.facts),
    profiles: e.profiles,
    overrides: e.overrides,
    hooks: e.hooks.map((h) => ({
      profile: `${h.origin}:${h.profile}`,
      kind: h.hook.kind,
    })),
  };
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  for (const p of e.profiles)
    say(
      `${p.matched ? "matches" : "skips  "} ${p.origin}:${p.id}`,
      p.matched ? "success" : "pending",
    );
  for (const o of e.overrides)
    say(`${o.key}: ${o.to} overrides ${o.from}`, "action");
}

function printSteps(ctx: Context, steps: readonly Step[], json: boolean): void {
  if (json) {
    console.log(
      JSON.stringify(
        steps.map((s) => stepJson(ctx, s)),
        null,
        2,
      ),
    );
    return;
  }
  if (!steps.length) say("No changes needed.", "success");
  for (const step of steps) say(describeStep(ctx, step), "pending");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

type CommanderCommand = {
  name(): string;
  commands: CommanderCommand[];
  command(
    name: string,
    opts?: { isDefault?: boolean; hidden?: boolean },
  ): CommanderCommand;
  alias(name: string): CommanderCommand;
  description(text: string): CommanderCommand;
  option(
    flags: string,
    description?: string,
    defaultValue?: unknown,
  ): CommanderCommand;
  argument(name: string, description?: string): CommanderCommand;
  action(fn: (...args: any[]) => unknown): CommanderCommand;
  version(v: string): CommanderCommand;
  enablePositionalOptions(): CommanderCommand;
  passThroughOptions(): CommanderCommand;
  allowUnknownOption(): CommanderCommand;
  helpOption(flags: string | false): CommanderCommand;
  parseAsync(argv: string[]): Promise<unknown>;
};

export async function buildCli(ctx: Context): Promise<CommanderCommand> {
  const { Command } = (await import(`commander@${dependencies.commander}`)) as {
    Command: new (name?: string) => CommanderCommand;
  };
  const program = new Command("snshah")
    .description(
      "Shahid Shah's shell and creature comforts for CLI work. Every command is safe to re-run.",
    )
    .version(cliVersion);

  program
    .command("plan")
    .description("Show what apply would change (read-only)")
    .option("--json", "print JSON")
    .option("--revision <sha>", "include an install receipt for this commit")
    .option(
      "--explain",
      "show which profile.d files match and what they override",
    )
    .option(
      "--as <facts.json>",
      "evaluate profiles as another machine (see whoami --json)",
    )
    .action(
      async (o: {
        json?: boolean;
        revision?: string;
        explain?: boolean;
        as?: string;
      }) => {
        const c = o.as
          ? makeContext({ ...ctx.env, SNSHAH_FACTS: resolve(o.as) })
          : ctx;
        const effective = await loadEffective(c);
        if (o.explain) printExplain(c, effective, !!o.json);
        if (!(o.explain && o.json))
          printSteps(
            c,
            await plan(c, { revision: o.revision, effective }),
            !!o.json,
          );
      },
    );

  program
    .command("whoami")
    .description("Print this machine's facts for profile.d selectors")
    .option("--json", "print JSON (usable with plan --as)")
    .action(async (o: { json?: boolean }) => {
      const e = await loadEffective(ctx);
      const facts = factsOf(e.facts);
      if (o.json) return console.log(JSON.stringify(facts, null, 2));
      say(`platform: ${facts.platform}`, "action");
      say(`distro: ${facts.distro.join(", ") || "(none)"}`, "action");
      say(`omarchy: ${facts.omarchy}`, "action");
      say(`hostname: ${facts.hostname}`, "action");
      say(
        `machine: ${facts.machine}  (use as { kind: "machine", fingerprint: "${facts.machine}" })`,
        "action",
      );
      for (const p of e.profiles.filter((p) => p.matched))
        say(`profile: ${p.origin}:${p.id}`, "success");
    });

  program
    .command("apply")
    .description(
      "Bring this machine to the desired state; a second run reports no changes",
    )
    .option("--json", "print JSON")
    .option("-y, --yes", "do not ask for confirmation")
    .option("--revision <sha>", "record the upstream commit being installed")
    .action(async (o: { json?: boolean; yes?: boolean; revision?: string }) => {
      await withLock(ctx, async () => {
        const steps = await plan(ctx, { revision: o.revision });
        if (!o.json) printSteps(ctx, steps, false);
        if (steps.length && !o.yes && process.stdin.isTTY && !o.json) {
          const clack = await prompts();
          const ok = await clack.confirm({
            message: `Apply ${steps.length} change(s)?`,
          });
          if (clack.isCancel(ok) || !ok)
            throw new UsageError("Nothing was changed.");
        }
        await applySteps(steps);
        if (o.json)
          console.log(
            JSON.stringify(
              {
                applied: steps.map((s) => stepJson(ctx, s)),
              },
              null,
              2,
            ),
          );
        else {
          if (steps.length) {
            say(`Applied ${steps.length} change(s).`, "success");
            reloadAdvice(ctx);
          }
          const { advice, next, system, manager } = await doctor(ctx);
          printNext(next);
          if (advice.length) {
            say(
              `Some tools snshah uses are missing. To install on ${system}${manager ? ` (${manager})` : ""}:`,
              "pending",
            );
            for (const line of advice) console.log(`  ${line}`);
          }
        }
      });
    });

  program
    .command("doctor")
    .description(
      "Check tools and print install advice for this OS (never installs)",
    )
    .option("--json", "print JSON")
    .action(async (o: { json?: boolean }) => {
      const report = await doctor(ctx);
      if (o.json) return console.log(JSON.stringify(report, null, 2));
      printChecks(report.checks);
      if (report.advice.length) {
        say(
          `To install on ${report.system}${report.manager ? ` (${report.manager})` : ""}:`,
          "action",
        );
        for (const line of report.advice) console.log(`  ${line}`);
      }
      printNext(report.next);
      if (report.checks.some((c) => c.status === "missing"))
        process.exitCode = 1;
    });

  program
    .command("shell")
    .description("Print shell init code: eval it from bash, zsh, fish or pwsh")
    .argument("<shell>", shells.join("|"))
    .option(
      "--greet",
      "also run doctor on first use and the hourly update check (startup files pass this)",
    )
    .action((shell: string) => {
      throw new UsageError(`Unknown shell ${shell}. Use ${shells.join(", ")}.`);
    });
  program
    .command("exec")
    .description("Run a command with its command-scoped secrets")
    .argument("<command>", "command to run")
    .allowUnknownOption()
    .helpOption(false)
    .action(() => {
      throw new UsageError("snshah exec handles its own arguments.");
    });

  const config = program
    .command("config")
    .description("Private typed config under $XDG_CONFIG_HOME/snshah");
  config
    .command("path")
    .description("Print the config file path")
    .action(() => console.log(ctx.configFile));
  config
    .command("check")
    .description("Validate the config (never prints secret values)")
    .option("--json", "print JSON")
    .action(async (o: { json?: boolean }) => {
      const {
        config: c,
        privateSource: source,
        profiles,
      } = await loadEffective(ctx);
      const summary = {
        path: tilde(ctx, ctx.configFile),
        exists: !!source,
        secrets: {
          command: (c.secrets ?? []).filter((s) => s.scope === "command")
            .length,
          shell: (c.secrets ?? []).filter((s) => s.scope === "shell").length,
        },
        repositories: (c.repositories ?? []).length,
        aliases: Object.keys(c.aliases ?? {}).length,
        profiles: profiles
          .filter((p) => p.matched)
          .map((p) => `${p.origin}:${p.id}`),
      };
      if (o.json) console.log(JSON.stringify(summary, null, 2));
      else
        say(
          `${summary.path} is valid: ${summary.secrets.command} command and ${summary.secrets.shell} shell secret(s), ${summary.repositories} repositories, ${summary.aliases} aliases. Matching profiles: ${summary.profiles.join(", ") || "none"}.`,
          "success",
        );
    });
  config
    .command("edit")
    .description("Open the config in $VISUAL or $EDITOR, then check it")
    .action(async () => {
      await withLock(ctx, async () =>
        applySteps(
          (await plan(ctx)).filter(
            (s) =>
              s.kind !== "tools" &&
              (s.path === ctx.configFile ||
                s.path === ctx.typesFile ||
                s.path === ctx.configDir),
          ),
        ),
      );
      const editor =
        ctx.env.VISUAL || ctx.env.EDITOR || (isWindows ? "notepad" : "vi");
      const parts = editor.split(" ").filter(Boolean);
      const code = run([
        ...parts,
        ...(parts[0] === "code" && !parts.includes("--wait") ? ["--wait"] : []),
        ctx.configFile,
      ]);
      if (code !== 0) throw new Error(`${editor} exited with ${code}.`);
      await loadEffective(ctx);
      say("Config is valid. Run snshah plan to see any effect.", "success");
    });
  config
    .command("set-secret")
    .description(
      "Set a secret without echoing it; declares it when --scope is given",
    )
    .argument("<variable>", "environment variable name")
    .option(
      "--scope <scope>",
      "command or shell (only to declare a new secret)",
    )
    .option(
      "--commands <list>",
      "comma-separated commands for a command-scoped secret",
    )
    .option("--stdin", "read the value from standard input")
    .action(
      async (
        variable: string,
        o: { scope?: string; commands?: string; stdin?: boolean },
      ) => setSecret(ctx, variable, { ...o, stdin: !!o.stdin }),
    );

  const git = program
    .command("git")
    .description(
      "Checkout registry under $WORKSPACES_HOME/<host>/<owner>/<repo>",
    );
  git
    .command("root")
    .description("Print the workspaces root")
    .action(async () =>
      console.log(workspacesRoot(ctx, (await loadEffective(ctx)).config)),
    );
  git
    .command("add")
    .description(
      "Register a repository (URL, owner/repo, or path) and clone it",
    )
    .argument("<source>", "Git URL, GitHub owner/repo, or local path")
    .option("--name <name>", "registry name")
    .option("--path <path>", "checkout path instead of the default")
    .option("--in-place", "register an existing checkout where it is")
    .option("--no-clone", "register only")
    .action(
      async (
        source: string,
        o: { name?: string; path?: string; inPlace?: boolean; clone: boolean },
      ) => gitAdd(ctx, source, o),
    );
  git
    .command("list")
    .description("List registered checkouts and their state")
    .option("--json", "print JSON")
    .action(async (o: { json?: boolean }) => {
      const { config: c } = await loadEffective(ctx);
      const rows = (c.repositories ?? []).map((r) => {
        const path = repoPath(ctx, c, r);
        return {
          name: r.name,
          source: r.source,
          path: tilde(ctx, path),
          state: checkoutState(path),
        };
      });
      if (o.json) return console.log(JSON.stringify(rows, null, 2));
      if (!rows.length)
        say(
          "No repositories registered. Add one with snshah git add <url>.",
          "pending",
        );
      for (const r of rows)
        say(
          `${r.name}  ${r.state}  ${r.path}`,
          r.state === "clean" ? "success" : "pending",
        );
    });
  git
    .command("path")
    .description("Print a checkout path (for scripts)")
    .argument("<name>", "registry name")
    .action(async (name: string) => {
      const { config: c } = await loadEffective(ctx);
      console.log(repoPath(ctx, c, selectRepos(c, name, false)[0]!));
    });
  git
    .command("clone")
    .description("Clone missing checkouts; present ones are left alone")
    .argument("[name]", "registry name")
    .option("--all", "every registered repository")
    .action(async (name: string | undefined, o: { all?: boolean }) =>
      gitClone(ctx, name, !!o.all),
    );
  git
    .command("update")
    .description(
      "Fast-forward clean checkouts from upstream; dirty ones are skipped",
    )
    .argument("[name]", "registry name")
    .option("--all", "every registered repository")
    .action(async (name: string | undefined, o: { all?: boolean }) =>
      gitUpdate(ctx, name, !!o.all),
    );
  git
    .command("remove")
    .description("Unregister a repository; its files stay")
    .argument("<name>", "registry name")
    .action(async (name: string) => gitRemove(ctx, name));

  const ssh = program
    .command("ssh")
    .description(
      "SSH keys, copying a key to a server, saved hosts, and server hardening advice",
    );
  ssh
    .command("status", { isDefault: true })
    .description(
      "How you logged in, your keys, the agent, who can log in here, and what to do next",
    )
    .action(async () => sshStatus(ctx));
  ssh
    .command("keys")
    .description("List your keys with fingerprints and the public key to share")
    .option("--json", "print JSON")
    .action(async (o: { json?: boolean }) => sshKeys(ctx, !!o.json));
  ssh
    .command("new")
    .description(
      "Create an ed25519 key if you don't have one (asks for a passphrase)",
    )
    .option("--name <file>", "key file name in ~/.ssh", "id_ed25519")
    .option("--comment <text>", "key comment (default user@host)")
    .action(async (o: { name: string; comment?: string }) => sshNew(ctx, o));
  ssh
    .command("copy")
    .description(
      "Show how to copy your key into a server, for your kind of computer (or all three)",
    )
    .argument(
      "[target]",
      "user@host; leave out on the server to use this machine",
    )
    .option("--os <os>", "linux, macos, windows or all")
    .option("-p, --port <n>", "the server's SSH port")
    .option("--key <path>", "public key to copy with --run")
    .option(
      "--run",
      "do it from here: copy the key, then test it (run on your own computer)",
    )
    .option(
      "--hint",
      "lead with the password-login banner (what shells show at login)",
    )
    .action(
      async (
        target: string | undefined,
        o: {
          os?: string;
          port?: string;
          key?: string;
          run?: boolean;
          hint?: boolean;
        },
      ) => sshCopy(ctx, target, o),
    );
  ssh
    .command("authorize")
    .description("Add a public key to this account's authorized_keys (once)")
    .option("--key <line>", "the public key text")
    .option("--file <path>", "a file of public keys, such as id_ed25519.pub")
    .option("--github <user>", "the keys published at github.com/<user>.keys")
    .option("--stdin", "read public keys from standard input")
    .action(
      async (o: {
        key?: string;
        file?: string;
        github?: string;
        stdin?: boolean;
      }) => sshAuthorize(ctx, o),
    );
  ssh
    .command("authorized")
    .description("List the keys that can log in to this account")
    .option("--json", "print JSON")
    .action(async (o: { json?: boolean }) => sshAuthorized(ctx, !!o.json));
  ssh
    .command("test")
    .description("Check that key login (no password) works to a server")
    .argument("<target>", "user@host")
    .option("-p, --port <n>", "the server's SSH port")
    .option("-i, --identity <file>", "private key to try")
    .action(async (target: string, o: { port?: string; identity?: string }) =>
      sshTest(
        ctx,
        sshTarget(ctx, target, o.port),
        o.identity ? resolve(expandHome(ctx, o.identity)) : undefined,
      ),
    );
  ssh
    .command("harden")
    .description(
      "Show this machine's SSH server settings and how to turn passwords off (never changes anything)",
    )
    .action(async () => sshHarden(ctx));
  const sshHost = ssh
    .command("host")
    .description("Saved hosts in ~/.ssh/config (one marked block each)");
  sshHost
    .command("add")
    .description("Save an alias so `ssh <alias>` works")
    .argument("<alias>", "short name")
    .argument("<target>", "user@host")
    .option("-p, --port <n>", "SSH port")
    .option("-i, --identity <file>", "key to use, such as ~/.ssh/id_ed25519")
    .action(
      async (
        alias: string,
        target: string,
        o: { port?: string; identity?: string },
      ) => sshHostAdd(ctx, alias, target, o),
    );
  sshHost
    .command("list")
    .description("List saved aliases")
    .action(async () => sshHostList(ctx));
  sshHost
    .command("remove")
    .description("Forget an alias")
    .argument("<alias>", "short name")
    .action(async (alias: string) => sshHostRemove(ctx, alias));

  const profile = program
    .command("profile")
    .description(
      `Per-directory profiles: ${dirProfileFile} files that set aliases, env and PATH while you are inside`,
    );
  profile
    .command("list", { isDefault: true })
    .description(
      "The profile files that apply here, and whether you trust them",
    )
    .option("--json", "print JSON")
    .action(async (o: { json?: boolean }) => profileList(ctx, !!o.json));
  profile
    .command("show")
    .description("What the trusted files set here, and which file set it")
    .option("--json", "print JSON")
    .action(async (o: { json?: boolean }) => profileShow(ctx, !!o.json));
  profile
    .command("allow")
    .alias("safe")
    .description("Read a profile file, then trust it (any edit un-trusts it)")
    .argument("[file]", "the file or its directory; default the nearest")
    .option("-y, --yes", "trust without asking (read it first)")
    .action(async (file: string | undefined, o: { yes?: boolean }) =>
      profileAllow(ctx, file, o),
    );
  profile
    .command("deny")
    .description("Stop trusting a profile file")
    .argument("[file]", "the file or its directory; default the nearest")
    .action(async (file: string | undefined) => profileDeny(ctx, file));
  profile
    .command("init")
    .description(`Create a ${dirProfileFile} here (never overwrites)`)
    .action(async () => profileInit(ctx));
  profile
    .command("check")
    .description("Validate a trusted profile file")
    .argument("[file]", "the file or its directory; default the nearest")
    .action(async (file: string | undefined) => profileCheck(ctx, file));
  profile
    .command("why")
    .description("Which file sets an alias, variable or PATH entry here")
    .argument("<name>", "alias, variable or directory")
    .action(async (name: string) => profileWhy(ctx, name));
  profile
    .command("load", { hidden: true })
    .description("Internal: what the shell hook evaluates")
    .option("--shell <shell>", "bash, zsh or fish")
    .action(async (o: { shell?: string }) => {
      await profileLoad(ctx, o.shell ?? "");
    });

  const ux = program
    .command("ux")
    .description("Terminal comforts: what your terminal can show");
  const fonts = ux
    .command("fonts")
    .description(
      "Does your terminal have a Nerd Font? (prompt icons need one)",
    );
  fonts
    .command("status", { isDefault: true })
    .description("Show what snshah knows and how it knows")
    .action(async () => fontsStatus(ctx));
  fonts
    .command("installed")
    .description("Record that your terminal shows the icons correctly")
    .action(async () => fontsSet(ctx, "installed"));
  fonts
    .command("missing")
    .description("Record that your terminal has no Nerd Font")
    .action(async () => fontsSet(ctx, "missing"));
  fonts
    .command("reset")
    .description("Forget your answer; doctor shows unknown")
    .action(async () => fontsSet(ctx, "reset"));
  fonts
    .command("install")
    .description("Show (or with --run, do) the Nerd Font install")
    .option("--run", "run oh-my-posh font install Meslo now")
    .action(async (o: { run?: boolean }) => fontsInstall(ctx, !!o.run));

  program
    .command("update")
    .description(
      `Update from ${upstream.owner}/${upstream.repo}, pinned to one commit, after a preview`,
    )
    .option(
      "--check",
      "only report whether a newer commit exists (shells run this hourly)",
    )
    .option("--quiet", "with --check: print nothing, just record the result")
    .option("-y, --yes", "apply without a prompt")
    .option("--ref <ref>", `branch, tag or commit (default ${upstream.ref})`)
    .action(
      async (o: {
        check?: boolean;
        quiet?: boolean;
        yes?: boolean;
        ref?: string;
      }) => {
        if (o.check) {
          process.exitCode = await checkForUpdate(ctx, o.ref, !!o.quiet);
          return;
        }
        process.exitCode = await update(ctx, {
          check: false,
          yes: !!o.yes,
          ref: o.ref,
        });
      },
    );

  program
    .command("test")
    .description(
      "Self-test in a temporary HOME: every command twice, second run unchanged",
    )
    .option(
      "--remote <ref>",
      "also install from GitHub at this ref with bootstrap.sh, twice",
    )
    .action(async (o: { remote?: string }) => {
      const { selfTest } = await import(
        join(import.meta.dir, "snshah.selftest.ts")
      );
      process.exitCode = await selfTest({
        script: import.meta.path,
        remote: o.remote,
      });
    });

  return program;
}

export function commandTree(program: CommanderCommand, prefix = ""): string[] {
  return program.commands.flatMap((command) =>
    command.commands.length
      ? commandTree(command, `${prefix}${command.name()} `)
      : [`${prefix}${command.name()}`],
  );
}

export async function main(argv: string[]): Promise<number> {
  const ctx = makeContext();
  try {
    // Fast paths: run at every shell start or tool launch, so no npm imports.
    if (
      argv[0] === "shell" &&
      member(shells, argv[1]) &&
      (argv.length === 2 || (argv.length === 3 && argv[2] === "--greet"))
    ) {
      const { config } = await loadEffective(ctx);
      const fonts = (await readState(ctx)).fonts?.kind;
      process.stdout.write(
        renderShell(argv[1], shellOps(ctx, config, argv[1], fonts)),
      );
      if (argv[2] === "--greet") await greet(ctx, config);
      return 0;
    }
    if (
      argv[0] === "profile" &&
      argv[1] === "load" &&
      argv[2] === "--shell" &&
      argv.length === 4
    )
      return await profileLoad(ctx, argv[3]!);
    if (argv[0] === "exec") return await execWithSecrets(ctx, argv.slice(1));
    if (!versionAtLeast(Bun.version, minimumBun))
      throw new Error(
        `snshah needs Bun ${minimumBun} or newer; this is ${Bun.version}.`,
      );
    await loadChalk();
    const program = await buildCli(ctx);
    await program.parseAsync(["bun", "snshah", ...argv]);
    return typeof process.exitCode === "number" ? process.exitCode : 0;
  } catch (error) {
    console.error(`snshah: ${(error as Error).message}`);
    return error instanceof UsageError ? 2 : 1;
  }
}

// No top-level await: the self-test and ontology/check.ts import this module.
if (import.meta.main)
  void main(process.argv.slice(2)).then((code) => process.exit(code));
