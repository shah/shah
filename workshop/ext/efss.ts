/**
 * snshah efss: enterprise file sync and share, through rclone, with no FUSE.
 *
 * Contributed by profile.d/efss.ts and loaded only when `snshah efss` runs.
 * Each connection mirrors a provider folder into an ordinary local folder
 * (default ~/efss/<id>): `pull` brings it down, `push` (read-write
 * connections only) sends changes up. Sign-in is rclone's own: snshah never
 * sees a password, token or secret. rclone keeps them in
 * $XDG_CONFIG_HOME/snshah/rclone.conf, which holds only snshah's remotes.
 */
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { CommanderCommand, Context, ExtApi } from "../snshah.ts";

export const providerIds = [
  "onedrive",
  "onedrive-business",
  "sharepoint",
  "gdrive",
  "box",
  "dropbox",
  "smb",
  "sftp",
  "webdav",
] as const;
export type ProviderId = (typeof providerIds)[number];
export type Access = "read" | "read-write";

export type Provider = {
  label: string;
  /** rclone backend type. */
  type: string;
  /** Options rclone gets for this access level. */
  options(access: Access): string[];
  /** True when the provider's own token is limited to read-only for a read connection; otherwise snshah alone enforces it. */
  readOnlyToken: boolean;
  /** What rclone will ask you, so the person is not surprised. */
  signIn: string;
};

const onedriveRead = "Files.Read Files.Read.All Sites.Read.All offline_access";

export const providers: Record<ProviderId, Provider> = {
  onedrive: {
    label: "OneDrive (personal)",
    type: "onedrive",
    options: (a) => [
      "drive_type=personal",
      ...(a === "read" ? [`access_scopes=${onedriveRead}`] : []),
    ],
    readOnlyToken: true,
    signIn: "a browser window for your Microsoft account",
  },
  "onedrive-business": {
    label: "OneDrive for work or school",
    type: "onedrive",
    options: (a) => [
      "drive_type=business",
      ...(a === "read" ? [`access_scopes=${onedriveRead}`] : []),
    ],
    readOnlyToken: true,
    signIn: "a browser window for your work or school account",
  },
  sharepoint: {
    label: "SharePoint document library",
    type: "onedrive",
    options: (a) => [
      "drive_type=documentLibrary",
      ...(a === "read" ? [`access_scopes=${onedriveRead}`] : []),
    ],
    readOnlyToken: true,
    signIn:
      "a browser window for your work or school account, then which site and library",
  },
  gdrive: {
    label: "Google Drive",
    type: "drive",
    options: (a) => [`scope=${a === "read" ? "drive.readonly" : "drive"}`],
    readOnlyToken: true,
    signIn: "a browser window for your Google account",
  },
  box: {
    label: "Box",
    type: "box",
    options: () => [],
    readOnlyToken: false,
    signIn: "a browser window for your Box account",
  },
  dropbox: {
    label: "Dropbox",
    type: "dropbox",
    options: () => [],
    readOnlyToken: false,
    signIn: "a browser window for your Dropbox account",
  },
  smb: {
    label: "SMB / Windows file share",
    type: "smb",
    options: () => [],
    readOnlyToken: false,
    signIn:
      "the password for the share (rclone asks; use --set host=... user=...)",
  },
  sftp: {
    label: "SFTP",
    type: "sftp",
    options: () => ["key_use_agent=true"],
    readOnlyToken: false,
    signIn:
      "nothing when your ssh agent has a key (use --set host=... user=...)",
  },
  webdav: {
    label: "WebDAV",
    type: "webdav",
    options: () => [],
    readOnlyToken: false,
    signIn: "the password (rclone asks; use --set url=... vendor=... user=...)",
  },
};

export function isProvider(value: unknown): value is ProviderId {
  return typeof value === "string" && providerIds.some((id) => id === value);
}

/** Option keys that would put a secret on a command line; rclone prompts for these instead. */
const secretKey =
  /(^|_)(pass|password|token|secret|client_secret|key_pem|sas_url|api_key)$/i;

export type Connection = {
  id: string;
  provider: ProviderId;
  access: Access;
  /** Local folder holding the mirror. */
  mirror: string;
  /** Path inside the remote to mirror (default: all of it). */
  folder?: string;
  lastPull?: string;
  every?: string;
};
export type EfssState = { connections: Connection[] };

const idPattern = /^[a-z][a-z0-9-]{0,31}$/;
const intervalPattern = /^[1-9][0-9]{0,3}(m|h|d)$/;

function stateFile(ctx: Context): string {
  return join(ctx.stateDir, "efss.json");
}
function rcloneConfig(ctx: Context): string {
  return join(ctx.configDir, "rclone.conf");
}
export function remoteName(id: string): string {
  return `snshah-${id}`;
}

export function parseState(text: string | undefined): EfssState {
  if (!text) return { connections: [] };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { connections: [] };
  }
  const list =
    value && typeof value === "object" && "connections" in value
      ? (value as { connections: unknown }).connections
      : [];
  const connections: Connection[] = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    if (
      typeof c.id !== "string" ||
      !idPattern.test(c.id) ||
      !isProvider(c.provider) ||
      (c.access !== "read" && c.access !== "read-write") ||
      typeof c.mirror !== "string"
    )
      continue;
    connections.push({
      id: c.id,
      provider: c.provider,
      access: c.access,
      mirror: c.mirror,
      ...(typeof c.folder === "string" ? { folder: c.folder } : {}),
      ...(typeof c.lastPull === "string" ? { lastPull: c.lastPull } : {}),
      ...(typeof c.every === "string" ? { every: c.every } : {}),
    });
  }
  return { connections };
}

async function load(api: ExtApi): Promise<EfssState> {
  return parseState(await api.readText(stateFile(api.ctx)));
}
async function save(api: ExtApi, state: EfssState): Promise<void> {
  state.connections.sort((a, b) => a.id.localeCompare(b.id));
  await api.writeAtomic(
    stateFile(api.ctx),
    JSON.stringify(state, null, 2) + "\n",
    0o600,
  );
}

function expand(ctx: Context, path: string): string {
  if (path === "~") return ctx.home;
  if (path.startsWith("~/")) return join(ctx.home, path.slice(2));
  return path;
}

/** A mirror may be any folder except one that would swallow your home or the root. */
export function checkMirror(ctx: Context, path: string): string {
  const full = resolve(expand(ctx, path));
  if (!isAbsolute(full)) throw new Error("The mirror folder must be absolute.");
  const home = resolve(ctx.home);
  if (full === dirname(full) || full === home || home.startsWith(full + "/"))
    throw new Error(
      `${full} would contain your home folder. Pick a folder inside it, such as ~/efss/<name>.`,
    );
  return full;
}

function find(state: EfssState, id: string, api: ExtApi): Connection {
  const found = state.connections.find((c) => c.id === id);
  if (!found)
    throw new api.UsageError(
      `No connection called ${id}. See: snshah efss list`,
    );
  return found;
}

function rclone(ctx: Context): string[] {
  return ["rclone", "--config", rcloneConfig(ctx)];
}
function source(c: Connection): string {
  return `${remoteName(c.id)}:${c.folder ?? ""}`;
}

async function connect(
  api: ExtApi,
  providerArg: string,
  nameArg: string | undefined,
  o: {
    read?: boolean;
    readWrite?: boolean;
    mirror?: string;
    folder?: string;
    set?: string[];
  },
): Promise<void> {
  const { ctx, say, run } = api;
  if (api.detectedAgent(ctx.env))
    throw new api.UsageError(
      "snshah efss connect signs in to an account, which only you can do. Run it in your own terminal.",
    );
  if (!isProvider(providerArg))
    throw new api.UsageError(
      `Unknown provider ${providerArg}. Choose from: ${providerIds.join(", ")}.`,
    );
  if (o.read && o.readWrite)
    throw new api.UsageError("Choose --read or --read-write, not both.");
  const access: Access = o.readWrite ? "read-write" : "read";
  const id = nameArg ?? providerArg;
  if (!idPattern.test(id))
    throw new api.UsageError(
      `${id} is not a usable name (lowercase letters, digits and dashes, starting with a letter).`,
    );
  const provider = providers[providerArg];
  const extra = (o.set ?? []).map((pair) => {
    const eq = pair.indexOf("=");
    const key = eq > 0 ? pair.slice(0, eq) : "";
    if (!key || eq < 0)
      throw new api.UsageError(`--set wants key=value, not ${pair}.`);
    if (secretKey.test(key))
      throw new api.UsageError(
        `--set ${key} would put a secret on the command line. Leave it out: rclone asks for it privately.`,
      );
    return pair;
  });
  const state = await load(api);
  const existing = state.connections.find((c) => c.id === id);
  if (existing) {
    say(
      `${id} is already connected (${existing.provider}, ${existing.access}). No changes needed. To change it: snshah efss remove ${id}, then connect again.`,
      "success",
    );
    return;
  }
  const mirror = checkMirror(ctx, o.mirror ?? `~/efss/${id}`);
  say(
    `Connecting ${provider.label} as ${id}, ${access === "read" ? "read-only" : "read and write"}. rclone will ask for ${provider.signIn}; snshah never sees it.`,
    "action",
  );
  if (access === "read" && !provider.readOnlyToken)
    say(
      `${provider.label} can't limit the sign-in itself to read-only, so snshah enforces it: push refuses on this connection.`,
      "pending",
    );
  await mkdir(dirname(rcloneConfig(ctx)), { recursive: true });
  const code = run(
    [
      ...rclone(ctx),
      "config",
      "create",
      remoteName(id),
      provider.type,
      ...provider.options(access),
      ...extra,
    ],
    { env: ctx.env },
  );
  if (code !== 0) throw new Error("rclone could not finish the sign-in.");
  await mkdir(mirror, { recursive: true });
  state.connections.push({
    id,
    provider: providerArg,
    access,
    mirror,
    ...(o.folder ? { folder: o.folder.replace(/^\/+/, "") } : {}),
  });
  await save(api, state);
  say(`Connected ${id}. Local folder: ${api.tilde(ctx, mirror)}`, "success");
  say(`Next: snshah efss pull ${id}`, "pending");
}

type ListRow = Connection & {
  signedIn: boolean;
  timer: boolean;
};

async function rows(api: ExtApi, state: EfssState): Promise<ListRow[]> {
  const conf = (await api.readText(rcloneConfig(api.ctx))) ?? "";
  return state.connections.map((c) => ({
    ...c,
    signedIn: conf.includes(`[${remoteName(c.id)}]`),
    timer: existsSync(unitPath(api.ctx, c.id, "timer")),
  }));
}

async function list(api: ExtApi, json: boolean): Promise<void> {
  const state = await load(api);
  const all = await rows(api, state);
  if (json) {
    console.log(
      JSON.stringify(
        all.map((c) => ({ ...c, mirror: api.tilde(api.ctx, c.mirror) })),
        null,
        2,
      ),
    );
    return;
  }
  if (!all.length)
    return api.say(
      `Nothing connected. Try: snshah efss connect onedrive   (${providerIds.join(", ")})`,
      "pending",
    );
  for (const c of all)
    console.log(
      `${c.id.padEnd(18)} ${c.provider.padEnd(18)} ${c.access.padEnd(10)} ${api.tilde(api.ctx, c.mirror)}${c.signedIn ? "" : "  (sign-in missing: remove and connect again)"}${c.lastPull ? `  pulled ${c.lastPull}` : ""}${c.every ? `  every ${c.every}` : ""}`,
    );
}

async function status(
  api: ExtApi,
  o: { id?: string; online?: boolean; json?: boolean },
): Promise<void> {
  const state = await load(api);
  const all = (await rows(api, state)).filter((c) => !o.id || c.id === o.id);
  if (o.id && !all.length) find(state, o.id, api);
  const report = all.map((c) => {
    const reachable = o.online
      ? api.capture([
          ...rclone(api.ctx),
          "lsf",
          "--max-depth",
          "1",
          source(c),
        ]) !== undefined
      : undefined;
    return {
      id: c.id,
      provider: c.provider,
      access: c.access,
      mirror: api.tilde(api.ctx, c.mirror),
      mirrorExists: existsSync(c.mirror),
      signedIn: c.signedIn,
      lastPull: c.lastPull ?? null,
      every: c.every ?? null,
      ...(reachable === undefined ? {} : { reachable }),
    };
  });
  if (o.json) return console.log(JSON.stringify(report, null, 2));
  if (!report.length)
    return api.say("Nothing connected. No changes needed.", "success");
  for (const r of report) {
    api.say(
      `${r.id}: ${r.provider}, ${r.access}, ${r.mirror}`,
      r.signedIn ? "success" : "error",
    );
    if (!r.mirrorExists) console.log("   the local folder is missing");
    if (!r.signedIn)
      console.log("   sign-in missing: remove and connect again");
    if (r.lastPull) console.log(`   last pulled ${r.lastPull}`);
    if (r.reachable !== undefined)
      console.log(`   ${r.reachable ? "reachable" : "could not reach it"}`);
  }
}

async function pull(
  api: ExtApi,
  id: string,
  o: { mirror?: boolean; yes?: boolean },
): Promise<void> {
  const { ctx, say, run } = api;
  const state = await load(api);
  const c = find(state, id, api);
  await mkdir(c.mirror, { recursive: true });
  if (o.mirror) {
    // sync: the local folder becomes exactly the remote, deleting extra local files.
    const preview = !o.yes;
    say(
      preview
        ? `Preview: making ${api.tilde(ctx, c.mirror)} match ${c.id}, including deleting local files the provider doesn't have.`
        : `Making ${api.tilde(ctx, c.mirror)} match ${c.id}.`,
      "action",
    );
    const code = run(
      [
        ...rclone(ctx),
        "sync",
        source(c),
        c.mirror,
        ...(preview ? ["--dry-run"] : []),
      ],
      { env: ctx.env },
    );
    if (code !== 0) throw new Error("rclone sync failed.");
    if (preview)
      say(
        `Nothing was changed. To do it: snshah efss pull ${id} --mirror --yes`,
        "pending",
      );
    else await markPulled(api, state, c);
    return;
  }
  say(`Pulling ${c.id} into ${api.tilde(ctx, c.mirror)}`, "action");
  const code = run([...rclone(ctx), "copy", source(c), c.mirror, "--update"], {
    env: ctx.env,
  });
  if (code !== 0) throw new Error("rclone copy failed.");
  await markPulled(api, state, c);
  say(
    "Pulled. Nothing local was deleted or overwritten with older files.",
    "success",
  );
}

async function markPulled(
  api: ExtApi,
  state: EfssState,
  c: Connection,
): Promise<void> {
  c.lastPull = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  await save(api, state);
}

async function push(
  api: ExtApi,
  id: string,
  o: { yes?: boolean; delete?: boolean; maxDelete?: string },
): Promise<void> {
  const { ctx, say, run } = api;
  const state = await load(api);
  const c = find(state, id, api);
  if (c.access !== "read-write")
    throw new api.UsageError(
      `${id} was connected read-only, so snshah won't send changes. To change that: snshah efss remove ${id}, then snshah efss connect ${c.provider} ${id} --read-write`,
    );
  if ((o.yes || o.delete) && api.detectedAgent(ctx.env))
    throw new api.UsageError(
      "An agent can preview a push but not send it. Run it with --yes in your own terminal.",
    );
  let limit: string | undefined;
  if (o.delete) {
    if (!o.maxDelete || !/^[1-9][0-9]*$/.test(o.maxDelete))
      throw new api.UsageError(
        "--delete removes files from the provider, so it needs a limit: --max-delete <n> (the most files it may delete).",
      );
    limit = o.maxDelete;
  } else if (o.maxDelete)
    throw new api.UsageError("--max-delete only goes with --delete.");
  if (o.delete && !o.yes)
    say(
      "Preview of a push that also deletes remote files the local folder no longer has.",
      "pending",
    );
  const preview = !o.yes;
  say(
    preview
      ? `Preview: sending ${api.tilde(ctx, c.mirror)} to ${c.id}.`
      : `Sending ${api.tilde(ctx, c.mirror)} to ${c.id}.`,
    "action",
  );
  const code = run(
    [
      ...rclone(ctx),
      o.delete ? "sync" : "copy",
      c.mirror,
      source(c),
      ...(o.delete ? ["--max-delete", limit!] : ["--update"]),
      ...(preview ? ["--dry-run"] : []),
    ],
    { env: ctx.env },
  );
  if (code !== 0) throw new Error("rclone failed.");
  if (preview)
    say(
      `Nothing was changed. To send it: snshah efss push ${id}${o.delete ? ` --delete --max-delete ${limit}` : ""} --yes`,
      "pending",
    );
  else say("Pushed.", "success");
}

async function folder(api: ExtApi, id: string, json: boolean): Promise<void> {
  const c = find(await load(api), id, api);
  if (json)
    return console.log(
      JSON.stringify({ id, path: c.mirror, access: c.access }, null, 2),
    );
  console.log(c.mirror);
}

async function remove(api: ExtApi, id: string): Promise<void> {
  const { ctx, say, run } = api;
  const state = await load(api);
  const found = state.connections.find((c) => c.id === id);
  const conf = (await api.readText(rcloneConfig(ctx))) ?? "";
  if (!found && !conf.includes(`[${remoteName(id)}]`)) {
    say(`${id} is not connected. No changes needed.`, "success");
    return;
  }
  if (found?.every) await schedule(api, id, "off");
  if (conf.includes(`[${remoteName(id)}]`))
    run([...rclone(ctx), "config", "delete", remoteName(id)], {
      env: ctx.env,
      quiet: true,
    });
  state.connections = state.connections.filter((c) => c.id !== id);
  await save(api, state);
  say(`Removed ${id}.`, "success");
  if (found)
    say(
      `Your files in ${api.tilde(ctx, found.mirror)} were left alone. Also revoke the access in your ${providers[found.provider].label} account settings, since snshah can only forget the sign-in, not cancel it at the provider.`,
      "pending",
    );
}

function unitPath(ctx: Context, id: string, kind: "service" | "timer"): string {
  const base =
    ctx.env.XDG_CONFIG_HOME && isAbsolute(ctx.env.XDG_CONFIG_HOME)
      ? ctx.env.XDG_CONFIG_HOME
      : join(ctx.home, ".config");
  return join(base, "systemd", "user", `snshah-efss-${id}.${kind}`);
}

export function unitFiles(
  ctx: Context,
  id: string,
  every: string,
): { service: string; timer: string } {
  const minutes = Number(every.slice(0, -1));
  const unit = every.slice(-1);
  const systemd = `${minutes}${unit === "d" ? "d" : unit === "h" ? "h" : "min"}`;
  return {
    service: [
      "[Unit]",
      `Description=snshah efss pull ${id}`,
      "",
      "[Service]",
      "Type=oneshot",
      `ExecStart=${ctx.wrapper} efss pull ${id}`,
      "",
    ].join("\n"),
    timer: [
      "[Unit]",
      `Description=snshah efss pull ${id} every ${every}`,
      "",
      "[Timer]",
      "OnBootSec=5min",
      `OnUnitActiveSec=${systemd}`,
      "",
      "[Install]",
      "WantedBy=timers.target",
      "",
    ].join("\n"),
  };
}

async function schedule(api: ExtApi, id: string, every: string): Promise<void> {
  const { ctx, say, run, writeAtomic } = api;
  const state = await load(api);
  const c = find(state, id, api);
  const off = every === "off";
  if (!off && !intervalPattern.test(every))
    throw new api.UsageError("Give an interval like 30m, 6h or 1d, or `off`.");
  if (ctx.platform !== "linux" && ctx.platform !== "wsl") {
    say(
      `Scheduling uses systemd user timers, which this machine doesn't have. Run this from your own scheduler instead: snshah efss pull ${id}`,
      "pending",
    );
    return;
  }
  const hasSystemd =
    api.capture(["systemctl", "--user", "show-environment"]) !== undefined;
  const service = unitPath(ctx, id, "service");
  const timer = unitPath(ctx, id, "timer");
  if (off) {
    if (!c.every && !existsSync(timer)) {
      say("No schedule. No changes needed.", "success");
      return;
    }
    if (hasSystemd)
      run(
        ["systemctl", "--user", "disable", "--now", `snshah-efss-${id}.timer`],
        { env: ctx.env, quiet: true },
      );
    await rm(timer, { force: true });
    await rm(service, { force: true });
    delete c.every;
    await save(api, state);
    say(`Stopped pulling ${id} on a schedule.`, "success");
    return;
  }
  const files = unitFiles(ctx, id, every);
  const current = await api.readText(timer);
  if (c.every === every && current === files.timer) {
    say(`${id} already pulls every ${every}. No changes needed.`, "success");
    return;
  }
  await writeAtomic(service, files.service, 0o644);
  await writeAtomic(timer, files.timer, 0o644);
  c.every = every;
  await save(api, state);
  if (!hasSystemd) {
    say(
      `Wrote the timer, but no systemd user session is running. Start it with: systemctl --user enable --now snshah-efss-${id}.timer`,
      "pending",
    );
    return;
  }
  run(["systemctl", "--user", "daemon-reload"], { env: ctx.env, quiet: true });
  run(["systemctl", "--user", "enable", "--now", `snshah-efss-${id}.timer`], {
    env: ctx.env,
    quiet: true,
  });
  say(`${id} now pulls every ${every}.`, "success");
}

export function register(group: CommanderCommand, api: ExtApi): void {
  group
    .command("connect")
    .description(
      `Sign in to a provider through rclone and mirror it to a local folder (${providerIds.join(", ")})`,
    )
    .argument("<provider>", providerIds.join("|"))
    .argument("[name]", "name for this connection (default: the provider)")
    .option("--read", "read-only (the default)")
    .option("--read-write", "allow push")
    .option("--mirror <folder>", "local folder (default ~/efss/<name>)")
    .option("--folder <path>", "only this folder of the provider")
    .option(
      "--set <key=value...>",
      "rclone options such as host=nas user=me (never secrets)",
    )
    .action(
      async (
        provider: string,
        name: string | undefined,
        o: {
          read?: boolean;
          readWrite?: boolean;
          mirror?: string;
          folder?: string;
          set?: string[];
        },
      ) => connect(api, provider, name, o),
    );
  group
    .command("list")
    .description("Connections, their access and local folders")
    .option("--json", "print JSON")
    .action((o: { json?: boolean }) => list(api, !!o.json));
  group
    .command("status")
    .description("Whether each connection is signed in and when it last pulled")
    .argument("[name]")
    .option("--online", "also ask the provider whether it answers")
    .option("--json", "print JSON")
    .action((id: string | undefined, o: { online?: boolean; json?: boolean }) =>
      status(api, { id, ...o }),
    );
  group
    .command("pull")
    .description(
      "Copy new and changed files down; never deletes. --mirror makes the folder match, previewing unless --yes",
    )
    .argument("<name>")
    .option("--mirror", "also delete local files the provider doesn't have")
    .option("-y, --yes", "with --mirror: do it (default: preview)")
    .action((id: string, o: { mirror?: boolean; yes?: boolean }) =>
      pull(api, id, o),
    );
  group
    .command("push")
    .description(
      "Send local changes up (read-write connections only); previews unless --yes",
    )
    .argument("<name>")
    .option("-y, --yes", "send (default: preview)")
    .option("--delete", "also delete remote files missing locally")
    .option("--max-delete <n>", "the most files --delete may remove")
    .action(
      (
        id: string,
        o: { yes?: boolean; delete?: boolean; maxDelete?: string },
      ) => push(api, id, o),
    );
  group
    .command("folder")
    .description("Print a connection's local folder")
    .argument("<name>")
    .option("--json", "print JSON")
    .action((id: string, o: { json?: boolean }) => folder(api, id, !!o.json));
  group
    .command("schedule")
    .description(
      "Pull on a schedule with a systemd user timer: 30m, 6h, 1d or off",
    )
    .argument("<name>")
    .argument("<every>", "30m | 6h | 1d | off")
    .action((id: string, every: string) => schedule(api, id, every));
  group
    .command("remove")
    .description("Forget a connection and its sign-in; local files stay")
    .argument("<name>")
    .action((id: string) => remove(api, id));
}
