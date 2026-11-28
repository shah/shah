/**
 * snshah osquery: ask this machine questions in SQL, and audit it against a
 * small baseline. Read-only: it runs osqueryi with one SELECT at a time, never
 * loads an extension, never reaches the network, and never edits osquery's own
 * configuration. Contributed by profile.d/osquery.ts; loaded only when it runs.
 */
import { existsSync } from "node:fs";
import type { CommanderCommand, ExtApi, Platform } from "../snshah.ts";

type Row = Record<string, string>;

/** A named question. `platforms` limits where the tables exist. */
export type NamedQuery = {
  name: string;
  about: string;
  sql: string;
  platforms: readonly Platform[];
};

const unix = ["linux", "wsl", "macos"] as const;
const everywhere = ["linux", "wsl", "macos", "windows"] as const;

export const namedQueries: readonly NamedQuery[] = [
  {
    name: "os",
    about: "Operating system, version and architecture",
    sql: "SELECT name, version, platform, arch FROM os_version",
    platforms: everywhere,
  },
  {
    name: "listening-ports",
    about: "What is listening, on which address, and which program owns it",
    sql: "SELECT lp.port, lp.protocol, lp.address, p.name, p.path FROM listening_ports lp LEFT JOIN processes p USING (pid) WHERE lp.port != 0 ORDER BY lp.port",
    platforms: everywhere,
  },
  {
    name: "users",
    about: "Local accounts with their home and shell",
    sql: "SELECT uid, username, directory, shell FROM users ORDER BY uid",
    platforms: everywhere,
  },
  {
    name: "root-accounts",
    about: "Accounts with UID 0 (there should be exactly one)",
    sql: "SELECT uid, username FROM users WHERE uid = 0",
    platforms: unix,
  },
  {
    name: "sudoers",
    about: "sudo rules (needs root to read them all)",
    sql: "SELECT source, header, rule_details FROM sudoers",
    platforms: unix,
  },
  {
    name: "authorized-keys",
    about: "Who can SSH in with a key (no key material is shown)",
    sql: "SELECT u.username, k.key_file, k.algorithm, k.comment FROM users u JOIN authorized_keys k USING (uid)",
    platforms: unix,
  },
  {
    name: "startup-items",
    about: "What starts at boot or login",
    sql: "SELECT name, path, source, status FROM startup_items",
    platforms: everywhere,
  },
  {
    name: "crontab",
    about: "Scheduled jobs",
    sql: "SELECT command, path, minute, hour, day_of_month, month, day_of_week FROM crontab",
    platforms: unix,
  },
  {
    name: "suid-binaries",
    about: "Programs that run with their owner's rights",
    sql: "SELECT path, username, permissions FROM suid_bin ORDER BY path",
    platforms: unix,
  },
  {
    name: "kernel-modules",
    about: "Loaded kernel modules",
    sql: "SELECT name, size, status FROM kernel_modules",
    platforms: ["linux", "wsl"],
  },
  {
    name: "containers",
    about: "Docker containers (needs Docker running)",
    sql: "SELECT id, name, image, state FROM docker_containers",
    platforms: ["linux", "wsl", "macos"],
  },
  {
    name: "services",
    about: "Windows services that start automatically",
    sql: "SELECT name, display_name, status, start_type, path FROM services WHERE start_type = 'AUTO_START'",
    platforms: ["windows"],
  },
];

// ---------------------------------------------------------------------------
// The SELECT-only guard
// ---------------------------------------------------------------------------

/** Tables that reach the network, which a question about this machine never needs. */
const networkTables = ["curl", "curl_certificate"];

/**
 * One SELECT (or WITH ... SELECT), nothing else. Returns the statement to run,
 * or the reason it was refused. osqueryi also takes dot-commands and can load
 * extensions; neither gets through.
 */
export function guardSql(
  input: string,
): { ok: true; sql: string } | { ok: false; reason: string } {
  const sql = input.trim().replace(/;+\s*$/, "");
  if (!sql) return { ok: false, reason: "The query is empty." };
  if (sql.includes(";"))
    return { ok: false, reason: "Only one statement at a time." };
  if (!/^(select|with)\b/i.test(sql))
    return { ok: false, reason: "Only SELECT queries are allowed." };
  if (
    /\b(attach|detach|pragma|load_extension|insert|update|delete|drop|create|alter|replace)\b/i.test(
      sql,
    )
  )
    return {
      ok: false,
      reason:
        "That statement can change or load something; only plain SELECTs are allowed.",
    };
  for (const table of networkTables)
    if (new RegExp(`\\b${table}\\b`, "i").test(sql))
      return {
        ok: false,
        reason: `The ${table} table reaches the network, so it is not allowed here.`,
      };
  return { ok: true, sql };
}

// ---------------------------------------------------------------------------
// Finding osquery and asking it
// ---------------------------------------------------------------------------

const knownPaths = [
  "/opt/osquery/bin/osqueryi",
  "/usr/local/bin/osqueryi",
  "/usr/bin/osqueryi",
  "C:\\Program Files\\osquery\\osqueryi.exe",
];

export function findOsqueryi(api: ExtApi): string | undefined {
  return (
    Bun.which("osqueryi", { PATH: api.ctx.env.PATH ?? "" }) ??
    knownPaths.find((p) => existsSync(p))
  );
}

export type Answer =
  | { ok: true; rows: Row[] }
  | { ok: false; error: string; missingTable?: boolean };

export function ask(api: ExtApi, binary: string, sql: string): Answer {
  const result = Bun.spawnSync([binary, "--json", sql], {
    env: api.ctx.env,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    timeout: 60_000,
  });
  const out = result.stdout.toString().trim();
  const err = result.stderr.toString().trim();
  if (result.exitCode !== 0) {
    const error = (err || out || `osqueryi exited ${result.exitCode}`).split(
      "\n",
    )[0]!;
    return { ok: false, error, missingTable: /no such table/i.test(error) };
  }
  try {
    const parsed: unknown = JSON.parse(out || "[]");
    return Array.isArray(parsed)
      ? { ok: true, rows: parsed as Row[] }
      : { ok: false, error: "osqueryi did not return a list of rows." };
  } catch {
    return { ok: false, error: "osqueryi did not return JSON." };
  }
}

function table(rows: Row[]): string {
  if (!rows.length) return "(no rows)";
  const cols = Object.keys(rows[0]!);
  const width = cols.map((c) =>
    Math.min(60, Math.max(c.length, ...rows.map((r) => (r[c] ?? "").length))),
  );
  const line = (cells: string[]) =>
    cells
      .map((cell, i) => cell.slice(0, width[i]).padEnd(width[i]!))
      .join("  ")
      .trimEnd();
  return [
    line(cols),
    line(width.map((w) => "-".repeat(w))),
    ...rows.map((r) => line(cols.map((c) => r[c] ?? ""))),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// The audit
// ---------------------------------------------------------------------------

export type Severity = "high" | "medium" | "low";
export type Finding = {
  id: string;
  severity: Severity;
  message: string;
  fix: string;
};

/** Ports that are almost never meant to be open to a network. */
const dangerousPorts = new Map<number, string>([
  [21, "FTP sends passwords in the clear"],
  [23, "telnet sends passwords in the clear"],
  [512, "rexec"],
  [513, "rlogin"],
  [514, "rsh"],
  [2375, "Docker's API without TLS gives root to anyone who reaches it"],
  [5900, "VNC"],
]);
const loopback = new Set(["127.0.0.1", "::1", "127.0.0.53", "127.0.0.54"]);
const looksLikeLoopback = (address: string) =>
  loopback.has(address) ||
  address.startsWith("127.") ||
  address === "::ffff:127.0.0.1";

export function auditPorts(rows: Row[]): Finding[] {
  const seen = new Set<string>();
  const found: Finding[] = [];
  for (const row of rows) {
    const port = Number(row.port);
    const address = row.address ?? "";
    if (!port || looksLikeLoopback(address)) continue;
    const key = `${row.protocol}/${port}/${row.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const who = row.name || "an unknown program";
    const danger = dangerousPorts.get(port);
    found.push({
      id: danger ? "port-dangerous" : "port-listening",
      severity: danger ? "high" : "low",
      message: `${who} listens on ${address || "all addresses"} port ${port}${danger ? `: ${danger}` : ""}`,
      fix: danger
        ? `Stop ${who}, or bind it to 127.0.0.1 and firewall port ${port}`
        : `Confirm you want ${who} reachable on port ${port}; bind it to 127.0.0.1 or firewall it if not`,
    });
  }
  return found;
}

export function auditRoots(rows: Row[]): Finding[] {
  const extra = rows.filter((r) => r.username !== "root");
  return extra.map((r) => ({
    id: "uid-zero",
    severity: "high" as const,
    message: `${r.username} has UID 0, which is root`,
    fix: `Remove it, or give ${r.username} its own UID: it can do anything root can`,
  }));
}

const writablePlaces = ["/tmp/", "/var/tmp/", "/dev/shm/", "/home/", "/Users/"];
export function auditSuid(rows: Row[]): Finding[] {
  return rows
    .filter((r) => writablePlaces.some((p) => (r.path ?? "").startsWith(p)))
    .map((r) => ({
      id: "suid-writable",
      severity: "high" as const,
      message: `${r.path} runs with ${r.username}'s rights and sits where users can write`,
      fix: `Check where ${r.path} came from; remove its setuid bit (chmod u-s) or delete it`,
    }));
}

export function auditRootKeys(rows: Row[]): Finding[] {
  return rows
    .filter((r) => r.username === "root")
    .map((r) => ({
      id: "root-key",
      severity: "medium" as const,
      message: `root can log in over SSH with a key from ${r.key_file}${r.comment ? ` (${r.comment})` : ""}`,
      fix: "Log in as yourself and use sudo; remove root's key unless a tool needs it (see snshah ssh harden)",
    }));
}

type Check = {
  id: string;
  query: string;
  platforms: readonly Platform[];
  run: (rows: Row[]) => Finding[];
};
const checks: Check[] = [
  {
    id: "listening-ports",
    query: "listening-ports",
    platforms: everywhere,
    run: auditPorts,
  },
  {
    id: "root-accounts",
    query: "root-accounts",
    platforms: unix,
    run: auditRoots,
  },
  {
    id: "suid-binaries",
    query: "suid-binaries",
    platforms: unix,
    run: auditSuid,
  },
  {
    id: "authorized-keys",
    query: "authorized-keys",
    platforms: unix,
    run: auditRootKeys,
  },
];

const sql = (name: string) => namedQueries.find((q) => q.name === name)!.sql;

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function platformOf(api: ExtApi): Platform {
  return api.ctx.platform;
}

function binaryOrExit(api: ExtApi): string | undefined {
  const binary = findOsqueryi(api);
  if (!binary) {
    api.say(
      "osqueryi is not on this machine. Run `snshah profile catalog osquery` for how to get it.",
      "error",
    );
    process.exitCode = 2;
  }
  return binary;
}

async function status(api: ExtApi, json: boolean) {
  const binary = findOsqueryi(api);
  const version = binary
    ? (api.capture([binary, "--version"]) ?? "").replace(
        /^osqueryi version\s*/i,
        "",
      )
    : undefined;
  const daemon =
    platformOf(api) === "linux" || platformOf(api) === "wsl"
      ? (api.capture(["systemctl", "is-active", "osqueryd"]) ?? "unknown")
      : "unknown";
  const configs = [
    "/etc/osquery/osquery.conf",
    "/var/osquery/osquery.conf",
    "C:\\Program Files\\osquery\\osquery.conf",
  ].filter((p) => existsSync(p));
  const report = {
    osqueryi: binary ? api.tilde(api.ctx, binary) : null,
    version: version || null,
    daemon,
    config: configs.map((p) => api.tilde(api.ctx, p)),
  };
  if (json) return console.log(JSON.stringify(report, null, 2));
  api.say(
    binary
      ? `osqueryi ${version || "(version unknown)"} at ${report.osqueryi}`
      : "osqueryi: not found (the daemon may be running without it on PATH)",
    binary ? "success" : "pending",
  );
  api.say(`osqueryd: ${daemon}`, "action");
  api.say(
    configs.length
      ? `config: ${report.config.join(", ")}`
      : "config: none found (osquery runs fine without one)",
    "action",
  );
  console.log("Next: snshah osquery audit    or    snshah osquery queries");
}

function queries(api: ExtApi, json: boolean) {
  const here = platformOf(api);
  const rows = namedQueries.map((q) => ({
    name: q.name,
    about: q.about,
    here: q.platforms.includes(here),
    sql: q.sql,
  }));
  if (json) return console.log(JSON.stringify(rows, null, 2));
  for (const q of rows)
    console.log(
      `${q.name.padEnd(18)} ${q.about}${q.here ? "" : "  (not on this platform)"}`,
    );
  console.log(
    '\nRun one: snshah osquery ask <name>   Your own: snshah osquery ask "SELECT ..."',
  );
}

async function askCommand(api: ExtApi, what: string, json: boolean) {
  const binary = binaryOrExit(api);
  if (!binary) return;
  const named = namedQueries.find((q) => q.name === what);
  const statement = named
    ? { ok: true as const, sql: named.sql }
    : guardSql(what);
  if (!statement.ok) {
    api.say(statement.reason, "error");
    process.exitCode = 1;
    return;
  }
  const answer = ask(api, binary, statement.sql);
  if (!answer.ok) {
    api.say(answer.error, "error");
    process.exitCode = 1;
    return;
  }
  if (json) console.log(JSON.stringify(answer.rows, null, 2));
  else console.log(table(answer.rows));
}

async function audit(api: ExtApi, json: boolean) {
  const binary = binaryOrExit(api);
  if (!binary) return;
  const here = platformOf(api);
  const findings: Finding[] = [];
  const skipped: Array<{ check: string; why: string }> = [];
  const ran: string[] = [];
  for (const check of checks) {
    if (!check.platforms.includes(here)) {
      skipped.push({ check: check.id, why: `not on ${here}` });
      continue;
    }
    const answer = ask(api, binary, sql(check.query));
    if (!answer.ok) {
      skipped.push({ check: check.id, why: answer.error });
      continue;
    }
    ran.push(check.id);
    findings.push(...check.run(answer.rows));
  }
  const order = { high: 0, medium: 1, low: 2 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  if (json) {
    console.log(JSON.stringify({ ran, skipped, findings }, null, 2));
  } else {
    api.say(`Checked: ${ran.join(", ") || "nothing"}`, "action");
    for (const s of skipped) api.say(`skipped ${s.check}: ${s.why}`, "pending");
    if (!findings.length && ran.length) api.say("Nothing to fix.", "success");
    for (const f of findings) {
      api.say(
        `${f.severity.toUpperCase()}  ${f.message}`,
        f.severity === "high" ? "error" : "pending",
      );
      console.log(`   fix: ${f.fix}`);
    }
  }
  if (findings.some((f) => f.severity === "high")) process.exitCode = 1;
}

/** A small osquery.conf with a scheduled pack, to read and install yourself. */
export function sampleConfig(): string {
  const schedule: Record<string, unknown> = {};
  for (const name of [
    "listening-ports",
    "users",
    "authorized-keys",
    "startup-items",
    "suid-binaries",
  ]) {
    const q = namedQueries.find((x) => x.name === name)!;
    schedule[name] = { query: q.sql, interval: 3600, snapshot: true };
  }
  return JSON.stringify(
    {
      options: {
        config_plugin: "filesystem",
        logger_plugin: "filesystem",
        utc: true,
        schedule_splay_percent: 10,
      },
      schedule,
    },
    null,
    2,
  );
}

function config(api: ExtApi) {
  const where =
    platformOf(api) === "macos"
      ? "/var/osquery/osquery.conf"
      : platformOf(api) === "windows"
        ? "C:\\Program Files\\osquery\\osquery.conf"
        : "/etc/osquery/osquery.conf";
  api.say(`Save this as ${where} (as root), then restart osqueryd:`, "action");
  console.log(sampleConfig());
  api.say(
    "Nothing was changed. It records each query's result hourly in osquery's own log; ship that log wherever you keep logs.",
    "pending",
  );
}

export function register(group: CommanderCommand, api: ExtApi): void {
  group
    .command("status")
    .description("Is osquery here, which version, is the daemon running")
    .option("--json", "print JSON")
    .action((o: { json?: boolean }) => status(api, !!o.json));
  group
    .command("queries")
    .description("The named questions snshah ships")
    .option("--json", "print JSON")
    .action((o: { json?: boolean }) => queries(api, !!o.json));
  group
    .command("ask")
    .description(
      "Run a named query or your own single SELECT (read-only; no network tables)",
    )
    .argument("<query>", "a name from `snshah osquery queries`, or SELECT ...")
    .option("--json", "print JSON")
    .action((what: string, o: { json?: boolean }) =>
      askCommand(api, what, !!o.json),
    );
  group
    .command("audit")
    .description(
      "Check this machine against a small baseline (ports, root accounts, setuid files, root's SSH keys); exits 1 on a serious finding",
    )
    .option("--json", "print JSON")
    .action((o: { json?: boolean }) => audit(api, !!o.json));
  group
    .command("config")
    .description(
      "Print a sample osquery.conf with an hourly pack to install yourself; changes nothing",
    )
    .action(() => config(api));
}
