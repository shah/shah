/**
 * snshah vault: an age-encrypted snapshot of your private config
 * (snshah.conf.ts). age asks for the passphrase on your terminal, so snshah
 * never sees it. Contributed by profile.d/age.ts, where `age` is on PATH.
 */
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { CommanderCommand, Context, ExtApi } from "../snshah.ts";

type VaultState = { file?: string; sha256?: string; at?: string };

const sha = (text: string) =>
  createHash("sha256").update(text.trim()).digest("hex");

function stateFile(ctx: Context): string {
  return join(ctx.stateDir, "vault.json");
}
export function defaultDir(ctx: Context): string {
  return join(ctx.dataDir, "vault");
}

async function load(api: ExtApi): Promise<VaultState> {
  const text = await api.readText(stateFile(api.ctx));
  try {
    const v = text ? JSON.parse(text) : {};
    return api.isObject(v) ? (v as VaultState) : {};
  } catch {
    return {};
  }
}

function human(api: ExtApi, what: string): void {
  if (api.detectedAgent(api.ctx.env))
    throw new api.UsageError(
      `${what} needs your passphrase, which only you can type. Run it in your own terminal.`,
    );
}

async function status(api: ExtApi, json: boolean): Promise<void> {
  const { ctx } = api;
  const config = await api.readText(ctx.configFile);
  const last = await load(api);
  const report = {
    config: api.tilde(ctx, ctx.configFile),
    configExists: config !== undefined,
    lastBackup: last.file ? api.tilde(ctx, last.file) : null,
    lastBackupAt: last.at ?? null,
    changedSinceBackup:
      config !== undefined && last.sha256 !== undefined
        ? sha(config) !== last.sha256
        : null,
  };
  if (json) return console.log(JSON.stringify(report, null, 2));
  if (!report.configExists)
    return api.say(
      `No config yet at ${report.config}. Nothing to back up.`,
      "pending",
    );
  if (!last.file)
    return api.say("No backup yet. Make one: snshah vault backup", "pending");
  api.say(
    `Last backup ${report.lastBackupAt}: ${report.lastBackup}`,
    report.changedSinceBackup ? "pending" : "success",
  );
  if (report.changedSinceBackup)
    console.log("   The config has changed since. Run: snshah vault backup");
}

async function backup(
  api: ExtApi,
  o: { to?: string; force?: boolean },
): Promise<void> {
  human(api, "A backup");
  const { ctx, say } = api;
  const config = await api.readText(ctx.configFile);
  if (config === undefined)
    throw new api.UsageError(
      `There is no config at ${api.tilde(ctx, ctx.configFile)} to back up.`,
    );
  const last = await load(api);
  if (!o.force && last.sha256 === sha(config)) {
    say(
      `The config hasn't changed since the last backup (${api.tilde(ctx, last.file ?? "")}). No changes needed.`,
      "success",
    );
    return;
  }
  const dir = resolve(o.to ?? defaultDir(ctx));
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const file = join(dir, `snshah-config-${stamp}.ts.age`);
  say("age will ask for a passphrase. Choose one you will remember.", "action");
  const code = api.run(
    ["age", "--passphrase", "--output", file, ctx.configFile],
    { env: ctx.env },
  );
  if (code !== 0) throw new Error("age did not finish; nothing was saved.");
  await api.writeAtomic(
    stateFile(ctx),
    JSON.stringify(
      { file, sha256: sha(config), at: stamp } satisfies VaultState,
      null,
      2,
    ) + "\n",
    0o600,
  );
  say(`Saved ${api.tilde(ctx, file)}`, "success");
  console.log(
    "   Keep a copy somewhere that isn't this machine. The passphrase isn't stored anywhere.",
  );
}

function decrypt(api: ExtApi, file: string): string {
  const path = resolve(file);
  const text = api.capture(["age", "--decrypt", path], { env: api.ctx.env });
  if (text === undefined)
    throw new Error(
      `Could not decrypt ${basename(path)}: wrong passphrase, or not an age file.`,
    );
  return text;
}

async function verify(api: ExtApi, file: string, json: boolean): Promise<void> {
  human(api, "Verifying a backup");
  const plain = decrypt(api, file);
  const current = await api.readText(api.ctx.configFile);
  if (!plain.trim()) throw new Error("The backup decrypted to nothing.");
  const matches = current !== undefined && sha(current) === sha(plain);
  if (json)
    return console.log(JSON.stringify({ opens: true, matches }, null, 2));
  api.say(
    matches
      ? "The backup opens and matches your current config."
      : "The backup opens. It differs from your current config.",
    "success",
  );
}

async function restore(
  api: ExtApi,
  file: string,
  o: { yes?: boolean },
): Promise<void> {
  human(api, "Restoring a backup");
  const { ctx, say } = api;
  const plain = decrypt(api, file);
  if (!plain.trim()) throw new Error("The backup decrypted to nothing.");
  const current = await api.readText(ctx.configFile);
  if (current !== undefined && sha(current) === sha(plain)) {
    say(
      "The config already matches this backup. No changes needed.",
      "success",
    );
    return;
  }
  if (!o.yes) {
    say(
      `Would replace ${api.tilde(ctx, ctx.configFile)} with this backup${current === undefined ? "" : " (the current file is kept beside it as .before-restore)"}.`,
      "pending",
    );
    say(
      `Nothing was changed. To do it: snshah vault restore ${file} --yes`,
      "pending",
    );
    return;
  }
  if (current !== undefined)
    await api.writeAtomic(`${ctx.configFile}.before-restore`, current, 0o600);
  await api.writeAtomic(ctx.configFile, plain + "\n", 0o600);
  say("Restored. Check it: snshah config check", "success");
}

export function register(group: CommanderCommand, api: ExtApi): void {
  group
    .command("status")
    .description(
      "When the config was last backed up, and whether it changed since",
    )
    .option("--json", "print JSON")
    .action((o: { json?: boolean }) => status(api, !!o.json));
  group
    .command("backup")
    .description(
      "Encrypt snshah.conf.ts with an age passphrase (asked on your terminal) into a snapshot file",
    )
    .option(
      "--to <dir>",
      "folder for the snapshot (default: snshah's data folder)",
    )
    .option("--force", "back up even if nothing changed")
    .action((o: { to?: string; force?: boolean }) => backup(api, o));
  group
    .command("verify")
    .description("Check that a snapshot opens with its passphrase")
    .argument("<file>")
    .option("--json", "print JSON")
    .action((file: string, o: { json?: boolean }) =>
      verify(api, file, !!o.json),
    );
  group
    .command("restore")
    .description("Replace the config with a snapshot; previews unless --yes")
    .argument("<file>")
    .option("-y, --yes", "do it")
    .action((file: string, o: { yes?: boolean }) => restore(api, file, o));
}
