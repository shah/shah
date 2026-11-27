/**
 * snshah share: look at the file servers on this machine (Samba, NFS), audit
 * their configuration, and print safe configuration to paste. It never
 * changes a service, never edits smb.conf or /etc/exports, and never prints a
 * password. Contributed by profile.d/share.ts; loaded only when it runs.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { CommanderCommand, ExtApi } from "../snshah.ts";

export type Severity = "high" | "medium" | "low";
export type Finding = {
  id: string;
  severity: Severity;
  /** The share or export it is about, or "global". */
  where: string;
  message: string;
  fix: string;
};

// ---------------------------------------------------------------------------
// Samba
// ---------------------------------------------------------------------------

export type SmbSection = { name: string; values: Map<string, string> };

/** Samba ignores case and spaces in parameter names, so they are normalized. */
const key = (raw: string) => raw.toLowerCase().replace(/[\s_]+/g, "");

export function parseSmbConf(text: string): SmbSection[] {
  const sections: SmbSection[] = [];
  let current: SmbSection | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      current = { name: header[1]!.trim(), values: new Map() };
      sections.push(current);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq > 0 && current)
      current.values.set(key(line.slice(0, eq)), line.slice(eq + 1).trim());
  }
  return sections;
}

const yes = (value: string | undefined) =>
  value !== undefined && /^(yes|true|1|on)$/i.test(value);
const no = (value: string | undefined) =>
  value !== undefined && /^(no|false|0|off)$/i.test(value);

/** Samba's own defaults matter: a missing key is not the same as a safe one. */
export function auditSmb(sections: SmbSection[]): Finding[] {
  const found: Finding[] = [];
  const global = sections.find((s) => s.name.toLowerCase() === "global");
  const g = (k: string) => global?.values.get(k);
  const add = (
    id: string,
    severity: Severity,
    where: string,
    message: string,
    fix: string,
  ) => found.push({ id, severity, where, message, fix });

  const minimum = (
    g("serverminprotocol") ??
    g("minprotocol") ??
    ""
  ).toUpperCase();
  if (["CORE", "COREPLUS", "LANMAN1", "LANMAN2", "NT1"].includes(minimum))
    add(
      "smb-old-protocol",
      "high",
      "global",
      `server min protocol = ${minimum} allows SMB1, which has known remote exploits.`,
      "server min protocol = SMB2_10 (or SMB3)",
    );
  if (yes(g("ntlmauth")) || g("ntlmauth")?.toLowerCase() === "ntlmv1-permitted")
    add(
      "smb-ntlmv1",
      "high",
      "global",
      "ntlm auth allows NTLMv1, which is trivially crackable.",
      "ntlm auth = ntlmv2-only",
    );
  if (g("security")?.toLowerCase() === "share")
    add(
      "smb-share-security",
      "high",
      "global",
      "security = share has no per-user login.",
      "security = user",
    );
  const guestMap = g("maptoguest")?.toLowerCase();
  if (guestMap && guestMap !== "never")
    add(
      "smb-map-to-guest",
      "high",
      "global",
      `map to guest = ${g("maptoguest")} lets failed logins in as guest.`,
      "map to guest = never",
    );
  if (!g("hostsallow") && !g("bindinterfacesonly"))
    add(
      "smb-everywhere",
      "medium",
      "global",
      "Samba answers on every interface and any address.",
      "interfaces = lo <your LAN interface>, bind interfaces only = yes, hosts allow = <your subnet>",
    );
  if (
    !["required", "desired", "mandatory"].includes(
      (g("serversmbencrypt") ?? "").toLowerCase(),
    )
  )
    add(
      "smb-no-encryption",
      "low",
      "global",
      "SMB encryption isn't requested.",
      "server smb encrypt = required (clients must be SMB3)",
    );
  if (yes(g("widelinks")))
    add(
      "smb-wide-links",
      "high",
      "global",
      "wide links = yes lets a symlink in a share lead anywhere on the disk.",
      "wide links = no",
    );

  for (const share of sections) {
    const name = share.name;
    if (["global", "printers", "print$"].includes(name.toLowerCase())) continue;
    const v = (k: string) => share.values.get(k) ?? g(k);
    if (yes(v("guestok")) || yes(v("public")) || yes(v("guestonly")))
      add(
        "smb-guest",
        "high",
        name,
        `[${name}] allows guests without a login.`,
        "guest ok = no",
      );
    const writable =
      yes(v("writable")) ||
      yes(v("writeable")) ||
      no(v("readonly")) ||
      !!v("writelist");
    if (writable && !v("validusers") && !v("writelist"))
      add(
        "smb-writable-anyone",
        "high",
        name,
        `[${name}] is writable and has no valid users list.`,
        "valid users = <you or a group>, read only = yes unless you need to write",
      );
    else if (writable)
      add(
        "smb-writable",
        "low",
        name,
        `[${name}] is writable.`,
        "read only = yes if nobody needs to write",
      );
    if (!v("validusers") && !v("hostsallow"))
      add(
        "smb-unscoped",
        "medium",
        name,
        `[${name}] has no valid users and no hosts allow.`,
        "valid users = <users>, hosts allow = <your subnet>",
      );
    if (yes(v("widelinks")))
      add(
        "smb-wide-links",
        "high",
        name,
        `[${name}] follows symlinks anywhere (wide links).`,
        "wide links = no",
      );
    if (v("forceuser"))
      add(
        "smb-force-user",
        "low",
        name,
        `[${name}] makes every client act as ${v("forceuser")}.`,
        "remove force user unless you mean it",
      );
  }
  // One finding per id and place.
  const seen = new Set<string>();
  return found.filter((f) => {
    const k = `${f.id}\0${f.where}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}

// ---------------------------------------------------------------------------
// NFS
// ---------------------------------------------------------------------------

export type NfsExport = {
  path: string;
  clients: Array<{ host: string; options: string[] }>;
};

export function parseExports(text: string): NfsExport[] {
  const exports: NfsExport[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const [path, ...rest] = line.split(/\s+/);
    if (!path) continue;
    const clients = rest.map((entry) => {
      const open = entry.indexOf("(");
      return open < 0
        ? { host: entry, options: [] }
        : {
            host: entry.slice(0, open),
            options: entry
              .slice(open + 1)
              .replace(/\)$/, "")
              .split(",")
              .filter(Boolean),
          };
    });
    // `/srv (rw)` is a client list of one unnamed host, which means everyone.
    exports.push({
      path,
      clients: clients.length ? clients : [{ host: "*", options: [] }],
    });
  }
  return exports;
}

const wideHost = (host: string) =>
  host === "" ||
  host === "*" ||
  host === "0.0.0.0/0" ||
  host === "::/0" ||
  /\/([0-7])$/.test(host);

export function auditNfs(exports: NfsExport[]): Finding[] {
  const found: Finding[] = [];
  for (const e of exports)
    for (const c of e.clients) {
      const host = c.host === "" ? "*" : c.host;
      const where = `${e.path} -> ${host}`;
      const writable = c.options.includes("rw");
      if (wideHost(host))
        found.push({
          id: "nfs-everyone",
          severity: writable ? "high" : "medium",
          where,
          message: `${e.path} is exported to ${host === "*" ? "any host" : host}${writable ? " read-write" : ""}.`,
          fix: "export to one subnet, such as 192.168.1.0/24, with ro unless you need rw",
        });
      if (c.options.includes("no_root_squash"))
        found.push({
          id: "nfs-no-root-squash",
          severity: "high",
          where,
          message: `no_root_squash lets root on ${host} act as root on this machine's ${e.path}.`,
          fix: "remove no_root_squash (root_squash is the default)",
        });
      if (c.options.includes("insecure"))
        found.push({
          id: "nfs-insecure-port",
          severity: "low",
          where,
          message:
            "insecure lets any local user on the client use the mount port.",
          fix: "remove insecure unless a client needs it",
        });
      if (c.options.includes("async") && writable)
        found.push({
          id: "nfs-async",
          severity: "low",
          where,
          message:
            "async can lose acknowledged writes if this machine crashes.",
          fix: "use sync for data you care about",
        });
      if (
        c.options.includes("rw") &&
        !c.options.some((o) => o === "sec=krb5" || o.startsWith("sec=krb5"))
      )
        found.push({
          id: "nfs-rw-no-kerberos",
          severity: "low",
          where,
          message:
            "Read-write without Kerberos trusts the client's idea of who a user is.",
          fix: "sec=krb5p for anything sensitive, or keep rw to one trusted host",
        });
    }
  return found;
}

// ---------------------------------------------------------------------------
// Printing configuration
// ---------------------------------------------------------------------------

/** Only a private (RFC 1918 or unique-local) subnet; never a default of "everyone". */
export function privateSubnet(cidr: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(
    cidr,
  );
  if (m) {
    const [a, b, c, d] = m.slice(1, 5).map(Number) as [
      number,
      number,
      number,
      number,
    ];
    const bits = Number(m[5]);
    if ([a, b, c, d].some((n) => n > 255) || bits < 8 || bits > 32)
      return false;
    if (a === 10) return bits >= 8;
    if (a === 172) return b >= 16 && b <= 31 && bits >= 12;
    if (a === 192 && b === 168) return bits >= 16;
    return false;
  }
  return /^f[cd][0-9a-f]{2}:[0-9a-f:]+\/\d{1,3}$/i.test(cidr);
}

const shareName = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;

export function smbSnippet(o: {
  name: string;
  path: string;
  subnet: string;
  readWrite: boolean;
  user?: string;
}): string {
  return [
    `[${o.name}]`,
    `   path = ${o.path}`,
    `   read only = ${o.readWrite ? "no" : "yes"}`,
    "   guest ok = no",
    `   valid users = ${o.user ?? "<user>"}`,
    `   hosts allow = ${o.subnet}`,
    "   hosts deny = 0.0.0.0/0",
    "   wide links = no",
    "",
  ].join("\n");
}

export function nfsLine(o: {
  path: string;
  subnet: string;
  readWrite: boolean;
}): string {
  return `${o.path} ${o.subnet}(${o.readWrite ? "rw" : "ro"},sync,no_subtree_check,root_squash)`;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

type Where = { smbConf?: string; exports?: string };

async function readSmb(api: ExtApi, file?: string) {
  const path = file ?? "/etc/samba/smb.conf";
  const text = await api.readText(path);
  return { path, text };
}
async function readExports(api: ExtApi, file?: string) {
  const path = file ?? "/etc/exports";
  let text = await api.readText(path);
  if (!file) {
    try {
      for (const f of readdirSync("/etc/exports.d").sort())
        if (f.endsWith(".exports"))
          text = `${text ?? ""}\n${(await api.readText(join("/etc/exports.d", f))) ?? ""}`;
    } catch {
      // no exports.d
    }
  }
  return { path, text };
}

function state(api: ExtApi, unit: string): string {
  return api.capture(["systemctl", "is-active", unit]) ?? "unknown";
}

async function status(api: ExtApi, o: Where & { json?: boolean }) {
  const smb = await readSmb(api, o.smbConf);
  const nfs = await readExports(api, o.exports);
  const smbShares = smb.text
    ? parseSmbConf(smb.text)
        .map((s) => s.name)
        .filter(
          (n) => !["global", "printers", "print$"].includes(n.toLowerCase()),
        )
    : [];
  const nfsPaths = nfs.text ? parseExports(nfs.text).map((e) => e.path) : [];
  const report = {
    samba: {
      installed: !!Bun.which("smbd", { PATH: api.ctx.env.PATH ?? "" }),
      state: state(api, "smbd"),
      config: smb.text === undefined ? null : api.tilde(api.ctx, smb.path),
      shares: smbShares,
    },
    nfs: {
      installed: !!Bun.which("exportfs", { PATH: api.ctx.env.PATH ?? "" }),
      state: state(api, "nfs-server"),
      config: nfs.text === undefined ? null : api.tilde(api.ctx, nfs.path),
      exports: nfsPaths,
    },
  };
  if (o.json) return console.log(JSON.stringify(report, null, 2));
  api.say(
    `Samba: ${report.samba.installed ? "installed" : "not installed"}, ${report.samba.state}; ${smbShares.length} share(s)${smbShares.length ? `: ${smbShares.join(", ")}` : ""}`,
    "action",
  );
  api.say(
    `NFS: ${report.nfs.installed ? "installed" : "not installed"}, ${report.nfs.state}; ${nfsPaths.length} export(s)${nfsPaths.length ? `: ${nfsPaths.join(", ")}` : ""}`,
    "action",
  );
  console.log("Next: snshah share audit");
}

async function audit(api: ExtApi, o: Where & { json?: boolean }) {
  const smb = await readSmb(api, o.smbConf);
  const nfs = await readExports(api, o.exports);
  const findings: Finding[] = [
    ...(smb.text ? auditSmb(parseSmbConf(smb.text)) : []),
    ...(nfs.text ? auditNfs(parseExports(nfs.text)) : []),
  ];
  const order = { high: 0, medium: 1, low: 2 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  const checked = [
    ...(smb.text !== undefined ? [api.tilde(api.ctx, smb.path)] : []),
    ...(nfs.text !== undefined ? [api.tilde(api.ctx, nfs.path)] : []),
  ];
  if (o.json) {
    console.log(JSON.stringify({ checked, findings }, null, 2));
  } else if (!checked.length)
    api.say(
      "No Samba or NFS configuration found to check. No changes needed.",
      "success",
    );
  else {
    api.say(`Checked ${checked.join(" and ")}`, "action");
    if (!findings.length) api.say("Nothing to fix.", "success");
    for (const f of findings) {
      api.say(
        `${f.severity.toUpperCase()}  ${f.message}`,
        f.severity === "high" ? "error" : "pending",
      );
      console.log(`   fix: ${f.fix}`);
    }
  }
  // Like doctor: exit 1 when something serious needs fixing.
  if (findings.some((f) => f.severity === "high")) process.exitCode = 1;
}

function print(
  api: ExtApi,
  kind: string,
  o: {
    path?: string;
    name?: string;
    subnet?: string;
    readWrite?: boolean;
    user?: string;
  },
): void {
  if (kind !== "smb" && kind !== "nfs")
    throw new api.UsageError("Choose smb or nfs.");
  if (!o.path || !o.path.startsWith("/"))
    throw new api.UsageError("--path <absolute folder to share> is required.");
  if (!o.subnet)
    throw new api.UsageError(
      "--subnet <private subnet, such as 192.168.1.0/24> is required: there is no default that shares with everyone.",
    );
  if (!privateSubnet(o.subnet))
    throw new api.UsageError(
      `${o.subnet} is not a private subnet (10/8, 172.16/12, 192.168/16 or fd00::/8). snshah won't print a rule that could expose a share to the internet.`,
    );
  if (/\s/.test(o.path))
    throw new api.UsageError("The path must not contain spaces.");
  const readWrite = !!o.readWrite;
  if (kind === "smb") {
    const name = o.name ?? o.path.split("/").filter(Boolean).pop() ?? "share";
    if (!shareName.test(name))
      throw new api.UsageError(
        `${name} is not a usable share name (letters, digits, - and _).`,
      );
    api.say(
      "Add this to /etc/samba/smb.conf, then check and reload:",
      "action",
    );
    console.log(
      smbSnippet({
        name,
        path: o.path,
        subnet: o.subnet,
        readWrite,
        user: o.user,
      }).replace(/^/gm, "   "),
    );
    console.log("   testparm -s && sudo smbcontrol all reload-config");
    console.log(
      `   sudo smbpasswd -a ${o.user ?? "<user>"}    # Samba keeps its own password; you type it, snshah never sees it`,
    );
  } else {
    api.say("Add this line to /etc/exports, then re-export:", "action");
    console.log(`   ${nfsLine({ path: o.path, subnet: o.subnet, readWrite })}`);
    console.log("   sudo exportfs -ra && sudo exportfs -v");
  }
  api.say(
    `Nothing was changed. ${readWrite ? "This is read-write." : "This is read-only; add --read-write if clients must write."} Then: snshah share audit`,
    "pending",
  );
}

export function register(group: CommanderCommand, api: ExtApi): void {
  group
    .command("status")
    .description("Samba and NFS: installed, running, and what they share")
    .option(
      "--smb-conf <file>",
      "read this smb.conf (default /etc/samba/smb.conf)",
    )
    .option("--exports <file>", "read this exports file (default /etc/exports)")
    .option("--json", "print JSON")
    .action((o: Where & { json?: boolean }) => status(api, o));
  group
    .command("audit")
    .description(
      "Check Samba and NFS configuration for guest access, old protocols and wide exports; exits 1 on a serious finding",
    )
    .option("--smb-conf <file>", "audit this smb.conf instead")
    .option("--exports <file>", "audit this exports file instead")
    .option("--json", "print JSON")
    .action((o: Where & { json?: boolean }) => audit(api, o));
  group
    .command("print")
    .description(
      "Print a safe Samba share or NFS export for one private subnet to paste yourself; changes nothing",
    )
    .argument("<kind>", "smb | nfs")
    .option("--path <folder>", "folder to share")
    .option("--name <share>", "Samba share name (default: the folder's name)")
    .option("--subnet <cidr>", "who may connect, such as 192.168.1.0/24")
    .option("--user <user>", "Samba user who may connect")
    .option("--read-write", "allow writes (default: read-only)")
    .action(
      (
        kind: string,
        o: {
          path?: string;
          name?: string;
          subnet?: string;
          readWrite?: boolean;
          user?: string;
        },
      ) => print(api, kind, o),
    );
}
