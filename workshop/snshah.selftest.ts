/**
 * snshah self-test, run by `snshah test`. Everything happens in a temporary
 * HOME with fake secrets and a local Git fixture. The core rule it proves:
 * every command is safe to re-run, and a second apply or bootstrap reports
 * "No changes needed."
 */
import {
  chmod,
  symlink,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { cpSync, existsSync, realpathSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";

type Result = { code: number; out: string; err: string };
type Options = { script: string; remote?: string };

/** A stand-in for mise: records installs under $HOME/.mise-stub and fakes shims. */
const miseStub = String.raw`#!/bin/sh
state=@{MISE_STUB_STATE:-$HOME/.mise-stub}
data=@{XDG_DATA_HOME:-$HOME/.local/share}/mise
conf=@{XDG_CONFIG_HOME:-$HOME/.config}/mise/conf.d
mkdir -p "$state"
case "$1" in
  --version) echo "2026.11.14 stub" ;;
  ls)
    printf '{'
    sep=
    if [ -f "$state/installed" ]; then
      while read -r name; do
        printf '%s"%s":[{"version":"1.0.0","installed":true,"active":true}]' "$sep" "$name"
        sep=,
      done < "$state/installed"
    fi
    printf '}\n'
    ;;
  install)
    mkdir -p "$data/shims"
    for f in "$conf"/*.toml; do
      [ -f "$f" ] || continue
      sed -n 's/^"\([^"]*\)" = .*/\1/p' "$f"
    done | while read -r name; do
      grep -qx "$name" "$state/installed" 2>/dev/null || echo "$name" >> "$state/installed"
      bin=$name; [ "$name" = ripgrep ] && bin=rg
      cat > "$data/shims/$bin" <<'SHIM'
#!/bin/sh
if [ "$1" = hook ]; then
  case "$2" in
    fish) echo "set -gx DIRENV_STUB_HOOK fish" ;;
    pwsh) echo "\$env:DIRENV_STUB_HOOK='pwsh'" ;;
    *) echo "export DIRENV_STUB_HOOK=$2" ;;
  esac
  exit 0
fi
if [ "__BIN__" = zoxide ]; then
  db="$(dirname "$0")/../zoxide.db"
  case "$1" in
    add) echo "$2" >> "$db"; exit 0 ;;
    query) if [ "$2" = --list ]; then cat "$db" 2>/dev/null; exit 0; fi; exit 1 ;;
    init) echo ":"; exit 0 ;;
  esac
fi
echo "__BIN__ 1.2.3"
SHIM
      sed "s/__BIN__/$bin/" "$data/shims/$bin" > "$data/shims/$bin.tmp" && mv "$data/shims/$bin.tmp" "$data/shims/$bin"
      chmod +x "$data/shims/$bin"
      echo "stub: installed $name" >&2
    done
    ;;
  activate)
    case "$2" in
      fish) echo "set -gx MISE_SHELL fish; set -gx MISE_STUB_ACTIVE 1; set -gx PATH $data/shims \$PATH" ;;
      pwsh) echo "\$env:MISE_SHELL='pwsh'; \$env:MISE_STUB_ACTIVE='1'; \$env:PATH='$data/shims' + ':' + \$env:PATH" ;;
      *) echo "export MISE_SHELL=$2 MISE_STUB_ACTIVE=1; export PATH=$data/shims:\$PATH" ;;
    esac
    ;;
  *) echo "stub mise: unsupported: $*" >&2; exit 2 ;;
esac
`.replaceAll("@{", "$" + "{");

/** A valid ed25519 public key line, made in-process (no ssh-keygen needed). */
function publicKeyLine(comment: string): string {
  const { publicKey } = generateKeyPairSync("ed25519");
  const raw = (
    publicKey.export({ format: "der", type: "spki" }) as Buffer
  ).subarray(-32);
  const u32 = (n: number) => {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n);
    return b;
  };
  const blob = Buffer.concat([
    u32(11),
    Buffer.from("ssh-ed25519"),
    u32(32),
    raw,
  ]);
  return `ssh-ed25519 ${blob.toString("base64")} ${comment}`;
}

export async function selfTest({ script, remote }: Options): Promise<number> {
  const root = await mkdtemp(join(tmpdir(), "snshah-test-"));
  const workshop = dirname(script);
  const bun = process.execPath;
  let failures = 0;
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(
      `${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? `\n     ${detail.trim().split("\n").join("\n     ")}` : ""}`,
    );
    if (!ok) failures++;
  };

  const baseEnv = (home: string): Record<string, string> => {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v === undefined) continue;
      if (
        /^(XDG_|WORKSPACES_HOME$|CLAUDE_CONFIG_DIR$|CODEX_HOME$|ZDOTDIR$|SNSHAH_|BUN_INSTALL$|MISE_|GH_|GITHUB_TOKEN$|SSH_CONNECTION$|SSH_CLIENT$|SSH_USER_AUTH$|LC_SNSHAH_OS$|LC_SNSHAH_FONTS$|LC_TERMINAL$|CLAUDECODE$|CLAUDE_CODE_ENTRYPOINT$|CODEX_SANDBOX|CURSOR_AGENT$)/.test(
          k,
        )
      )
        continue;
      env[k] = v;
    }
    return {
      ...env,
      // A stand-in mise first on PATH: real installs need the GitHub API,
      // which a test must not depend on. Its state lives under each HOME.
      PATH: `${join(root, "stub")}${delimiter}${env.PATH ?? ""}`,
      HOME: home,
      USERPROFILE: home,
      NO_COLOR: "1",
      SNSHAH_SHELLS: "bash,zsh,fish,pwsh",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: join(root, "gitconfig"),
      GIT_TERMINAL_PROMPT: "0",
      // One download cache for every temporary HOME, so the pinned Oh My
      // Posh build is fetched (and checksum-verified) at most once per run.
      XDG_CACHE_HOME: join(root, "cache"),
      // Shell greetings (doctor, update check) are tested on their own below.
      SNSHAH_GREET: "0",
    };
  };
  await writeFile(
    join(root, "gitconfig"),
    "[user]\n\tname = snshah test\n\temail = test@example.invalid\n[init]\n\tdefaultBranch = main\n[advice]\n\tdetachedHead = false\n",
  );

  await mkdir(join(root, "stub"), { recursive: true });
  await writeFile(join(root, "stub", "mise"), miseStub, { mode: 0o755 });
  await chmod(join(root, "stub", "mise"), 0o755);

  const home = join(root, "home");
  await mkdir(home, { recursive: true });
  const env = baseEnv(home);
  const cli = (
    args: string[],
    input?: string,
    e: Record<string, string> = env,
  ): Result => {
    const r = Bun.spawnSync([bun, "--no-env-file", script, ...args], {
      cwd: root,
      env: e,
      stdin: input === undefined ? "ignore" : new TextEncoder().encode(input),
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
    });
    return {
      code: r.exitCode ?? 1,
      out: r.stdout.toString(),
      err: r.stderr.toString(),
    };
  };
  const sh = (
    argv: string[],
    cwd = root,
    e: Record<string, string> = env,
  ): Result => {
    const r = Bun.spawnSync(argv, {
      cwd,
      env: e,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
    });
    return {
      code: r.exitCode ?? 1,
      out: r.stdout.toString(),
      err: r.stderr.toString(),
    };
  };
  const json = <T>(r: Result): T | undefined => {
    try {
      return JSON.parse(r.out) as T;
    } catch {
      return undefined;
    }
  };

  try {
    const mod = await import(script);

    // Command table matches the manifest (and so the ontology).
    const program = await mod.buildCli(mod.makeContext(env));
    const tree: string[] = mod.commandTree(program);
    check(
      "command tree matches manifest",
      JSON.stringify(tree) === JSON.stringify(mod.commandNames),
      tree.join(", "),
    );

    // Existing user files that apply must preserve.
    await writeFile(join(home, ".bashrc"), "export USER_SETTING=kept\n");
    await mkdir(join(home, ".claude"), { recursive: true });
    await writeFile(
      join(home, ".claude", "settings.json"),
      JSON.stringify(
        { model: "user-choice", permissions: { defaultMode: "default" } },
        null,
        2,
      ) + "\n",
    );
    await mkdir(join(home, ".codex"), { recursive: true });
    await writeFile(
      join(home, ".codex", "config.toml"),
      'model = "user-choice"\n',
    );

    const first = json<Array<{ kind: string; label: string }>>(
      cli(["plan", "--json"]),
    );
    check("fresh plan lists changes", !!first && first.length > 0);
    check(
      "fresh plan seeds the private config",
      !!first?.some((s) => s.kind === "seed"),
    );
    check(
      "fresh plan adds one startup entry per shell",
      [
        "bash startup block",
        "zsh startup block",
        "fish startup (conf.d)",
        "pwsh startup block",
      ].every((l) => first?.some((s) => s.label === l)),
    );

    // Reuse a verified Oh My Posh download from the real cache, if there is one.
    const target = mod.poshTarget();
    const poshOnPath = !!Bun.which("oh-my-posh", { PATH: env.PATH ?? "" });
    if (target) {
      const asset = mod.ohMyPosh.assets[target];
      const name = `oh-my-posh-${mod.ohMyPosh.version}-${asset.file}`;
      const real = join(mod.makeContext(process.env).cacheDir, name);
      const shared = join(root, "cache", "snshah", name);
      if (existsSync(real) && !existsSync(shared)) {
        await mkdir(dirname(shared), { recursive: true });
        await writeFile(shared, await readFile(real));
      }
    }
    check(
      "fresh plan installs pinned Oh My Posh when none is on PATH",
      poshOnPath || !target || !!first?.some((s) => s.kind === "download"),
    );

    const apply1 = cli(["apply", "--yes"]);
    check("apply succeeds", apply1.code === 0, apply1.err + apply1.out);
    if (target && !poshOnPath) {
      const posh = mod.makeContext(env).poshBinary;
      const v = sh([posh, "version"]);
      check(
        "installed Oh My Posh runs and is the pinned version",
        v.code === 0 && v.out.trim() === mod.ohMyPosh.version,
        v.out + v.err,
      );
    }
    const apply2 = cli(["apply", "--yes"]);
    check(
      "second apply reports no changes",
      apply2.code === 0 && apply2.out.includes("No changes needed."),
      apply2.out + apply2.err,
    );
    const plan2 = json<unknown[]>(cli(["plan", "--json"]));
    check(
      "plan is empty after apply",
      Array.isArray(plan2) && plan2.length === 0,
      JSON.stringify(plan2),
    );
    const applyJson = json<{ applied: unknown[] }>(cli(["apply", "--json"]));
    check(
      "apply --json applies nothing on re-run",
      applyJson?.applied.length === 0,
    );

    const bashrc = await readFile(join(home, ".bashrc"), "utf8");
    check(
      "bashrc keeps user content first",
      bashrc.startsWith("export USER_SETTING=kept\n"),
    );
    check(
      "bashrc has exactly one snshah block",
      bashrc.split("# >>> snshah shell >>>").length === 2,
    );
    const config = join(home, ".config", "snshah", "snshah.conf.ts");
    if (process.platform !== "win32") {
      check(
        "config is mode 0600",
        ((await stat(config)).mode & 0o777) === 0o600,
      );
      check(
        "config directory is mode 0700",
        ((await stat(dirname(config))).mode & 0o777) === 0o700,
      );
    }
    check(
      "strict XDG: CLI installed under ~/.local/share/snshah",
      existsSync(join(home, ".local", "share", "snshah", "snshah.ts")),
    );
    check(
      "theme installed",
      existsSync(join(home, ".local", "share", "snshah", "snshah.omp.json")),
    );
    check(
      "launcher in ~/.local/bin",
      existsSync(join(home, ".local", "bin", "snshah")),
    );
    check(
      "workspaces root defaults to ~/workspaces",
      existsSync(join(home, "workspaces")),
    );

    const claude = JSON.parse(
      await readFile(join(home, ".claude", "settings.json"), "utf8"),
    );
    check("Claude defaults fill unset keys", claude.sandbox?.enabled === true);
    check(
      "Claude user values win",
      claude.model === "user-choice" &&
        claude.permissions.defaultMode === "default",
    );
    const codex = Bun.TOML.parse(
      await readFile(join(home, ".codex", "config.toml"), "utf8"),
    ) as Record<string, unknown>;
    check(
      "Codex defaults fill unset keys",
      codex.approval_policy === "never" && codex.model === "user-choice",
    );

    // Config is seeded once and never overwritten by apply.
    const seeded = await readFile(config, "utf8");
    await writeFile(
      config,
      seeded.replace("aliases: {},", 'aliases: { hi: "echo hello" },'),
    );
    await chmod(config, 0o600);
    const apply3 = cli(["apply", "--yes"]);
    check(
      "apply leaves an edited config alone",
      apply3.out.includes("No changes needed.") &&
        (await readFile(config, "utf8")).includes("echo hello"),
      apply3.out + apply3.err,
    );

    // Secrets.
    const s1 = cli(
      [
        "config",
        "set-secret",
        "DEMO_CMD_TOKEN",
        "--scope",
        "command",
        "--commands",
        "bun",
        "--stdin",
      ],
      "cmd-secret-value\n",
    );
    check(
      "set-secret declares a command secret",
      s1.code === 0 && s1.out.includes("Saved"),
      s1.out + s1.err,
    );
    const s2 = cli(
      ["config", "set-secret", "DEMO_CMD_TOKEN", "--stdin"],
      "cmd-secret-value\n",
    );
    check(
      "set-secret with the same value changes nothing",
      s2.code === 0 && s2.out.includes("No change"),
      s2.out + s2.err,
    );
    const s3 = cli(
      [
        "config",
        "set-secret",
        "DEMO_SHELL_TOKEN",
        "--scope",
        "shell",
        "--stdin",
      ],
      "shell-secret-value",
    );
    check("set-secret declares a shell secret", s3.code === 0, s3.out + s3.err);
    const summary = json<{ secrets: { command: number; shell: number } }>(
      cli(["config", "check", "--json"]),
    );
    check(
      "config check counts secrets without values",
      summary?.secrets.command === 1 && summary?.secrets.shell === 1,
    );
    const checkOut = cli(["config", "check"]);
    check(
      "config check never prints values",
      !checkOut.out.includes("secret-value"),
    );
    check(
      "apply after secrets still has no changes",
      cli(["apply", "--yes"]).out.includes("No changes needed."),
    );

    const viaExec = cli([
      "exec",
      "bun",
      "-e",
      "console.log(process.env.DEMO_CMD_TOKEN ?? 'unset')",
    ]);
    check(
      "exec injects command-scoped secret",
      viaExec.out.trim() === "cmd-secret-value",
      viaExec.out + viaExec.err,
    );
    const direct = sh([
      bun,
      "-e",
      "console.log(process.env.DEMO_CMD_TOKEN ?? 'unset')",
    ]);
    check("secret absent outside exec", direct.out.trim() === "unset");

    // Shell emit.
    for (const shell of ["bash", "zsh", "fish", "pwsh"]) {
      const a = cli(["shell", shell]);
      const b = cli(["shell", shell]);
      check(
        `shell ${shell}: emits and is stable`,
        a.code === 0 && a.out === b.out && a.out.length > 0,
        a.err,
      );
      check(
        `shell ${shell}: exports WORKSPACES_HOME`,
        a.out.includes("WORKSPACES_HOME"),
      );
      check(
        `shell ${shell}: shell secret exported, command secret not`,
        a.out.includes("shell-secret-value") &&
          !a.out.includes("cmd-secret-value"),
      );
      check(
        `shell ${shell}: wraps commands that have secrets`,
        /\bbun\b.*exec bun/.test(a.out),
      );
      check(`shell ${shell}: user alias present`, a.out.includes("echo hello"));
      const syntax: Record<string, string[] | undefined> = {
        bash: ["bash", "-n"],
        zsh: ["zsh", "-n"],
        fish: ["fish", "--no-execute"],
        pwsh: [
          "pwsh",
          "-NoProfile",
          "-Command",
          "$e = $null; [void][System.Management.Automation.Language.Parser]::ParseFile($env:SNSHAH_PARSE, [ref]$null, [ref]$e); if ($e) { $e | ForEach-Object Message; exit 1 }",
        ],
      };
      const checker = syntax[shell];
      if (checker && Bun.which(checker[0]!)) {
        const path = join(root, `init.${shell}`);
        await writeFile(path, a.out);
        const r =
          shell === "pwsh"
            ? sh(checker, root, { ...env, SNSHAH_PARSE: path })
            : sh([...checker, path]);
        check(`shell ${shell}: syntax check`, r.code === 0, r.err);
      }
    }
    check("unknown shell is a usage error", cli(["shell", "tcsh"]).code === 2);

    // Each real shell, started interactively in the temporary HOME, loads its
    // one startup entry and gets the helpers, exports and secret wrapper.
    const probe = "console.log(process.env.DEMO_CMD_TOKEN)";
    const live: Record<string, string[]> = {
      bash: [
        "bash",
        "-ic",
        `echo "MKCD=$(type -t mkcd)"; echo "GS=$(type -t gs)"; echo "WS=$WORKSPACES_HOME"; echo "TOKEN=$DEMO_SHELL_TOKEN"; echo "CMD=$(bun -e '${probe}')"; echo "MISE=$MISE_STUB_ACTIVE"; echo "DIRENV=$DIRENV_STUB_HOOK"; echo "OS=$LC_SNSHAH_OS"`,
      ],
      zsh: [
        "zsh",
        "-ic",
        `echo "MKCD=\${$(whence -w mkcd)#*: }"; echo "GS=\${$(whence -w gs)#*: }"; echo "WS=$WORKSPACES_HOME"; echo "TOKEN=$DEMO_SHELL_TOKEN"; echo "CMD=$(bun -e '${probe}')"; echo "MISE=$MISE_STUB_ACTIVE"; echo "DIRENV=$DIRENV_STUB_HOOK"; echo "OS=$LC_SNSHAH_OS"`,
      ],
      fish: [
        "fish",
        "-ic",
        `echo MKCD=(type -t mkcd); echo GS=(type -t gs); echo WS=$WORKSPACES_HOME; echo TOKEN=$DEMO_SHELL_TOKEN; echo CMD=(bun -e '${probe}'); echo MISE=$MISE_STUB_ACTIVE; echo DIRENV=$DIRENV_STUB_HOOK; echo OS=$LC_SNSHAH_OS`,
      ],
      pwsh: [
        "pwsh",
        "-NoLogo",
        "-Command",
        `"MKCD=" + (Get-Command mkcd).CommandType; "GS=" + (Get-Command gs).CommandType; "WS=" + $env:WORKSPACES_HOME; "TOKEN=" + $env:DEMO_SHELL_TOKEN; "CMD=" + (bun -e '${probe}'); "MISE=" + $env:MISE_STUB_ACTIVE; "DIRENV=" + $env:DIRENV_STUB_HOOK; "OS=" + $env:LC_SNSHAH_OS`,
      ],
    };
    for (const [shell, argv] of Object.entries(live)) {
      if (!Bun.which(argv[0]!)) continue;
      const r = sh(argv);
      check(
        `interactive ${shell} loads its startup entry end to end`,
        /MKCD=function/i.test(r.out) &&
          /GS=(alias|function)/i.test(r.out) &&
          r.out.includes(`WS=${join(home, "workspaces")}`) &&
          r.out.includes("TOKEN=shell-secret-value") &&
          r.out.includes("CMD=cmd-secret-value") &&
          r.out.includes("MISE=1") &&
          r.out.includes(`DIRENV=${shell}`) &&
          r.out.includes(
            `OS=${process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : "linux"}`,
          ),
        r.out + r.err,
      );
    }

    // After `snshah apply` or `update`, the snshah function re-sources this
    // shell, so a change shows up without a new login.
    {
      const rh = join(root, "reload-home");
      await mkdir(join(rh, ".config", "snshah", "profile.d"), {
        recursive: true,
      });
      const src = join(root, "reload-profile.ts");
      await writeFile(
        src,
        'export const selector = { kind: "always" };\nexport const config = { aliases: { reloadprobe: "echo reloaded" } };\n',
      );
      const re = { ...baseEnv(rh), PROFILE_SRC: src };
      cli(["apply", "--yes"], undefined, re);
      const copy = `cp "$PROFILE_SRC" "$HOME/.config/snshah/profile.d/70-reload.ts"`;
      const reloadLive: Record<string, string[]> = {
        bash: [
          "bash",
          "-ic",
          `echo "FN=$(type -t snshah)"; echo "BEFORE=$(type -t reloadprobe)"; ${copy}; snshah apply --yes >/dev/null 2>&1; echo "AFTER=$(type -t reloadprobe)"`,
        ],
        zsh: [
          "zsh",
          "-ic",
          `echo "FN=\${$(whence -w snshah)#*: }"; echo "BEFORE=\${$(whence -w reloadprobe)#*: }"; ${copy}; snshah apply --yes >/dev/null 2>&1; echo "AFTER=\${$(whence -w reloadprobe)#*: }"`,
        ],
        fish: [
          "fish",
          "-ic",
          `echo FN=(type -t snshah); echo BEFORE=(type -t reloadprobe); ${copy}; snshah apply --yes >/dev/null 2>&1; echo AFTER=(type -t reloadprobe)`,
        ],
      };
      for (const [shell, argv] of Object.entries(reloadLive)) {
        if (!Bun.which(argv[0]!)) continue;
        await rm(join(rh, ".config", "snshah", "profile.d", "70-reload.ts"), {
          force: true,
        });
        const r = sh(argv, root, re);
        check(
          `interactive ${shell}: snshah apply re-sources the running shell`,
          /FN=function/i.test(r.out) &&
            !/BEFORE=(alias|function)/i.test(r.out) &&
            /AFTER=(alias|function)/i.test(r.out),
          r.out + r.err,
        );
      }
      await rm(join(rh, ".config", "snshah", "profile.d", "70-reload.ts"), {
        force: true,
      });
      check(
        "reload advice names the command for your shell",
        mod.reloadCommand("zsh") === 'eval "$(snshah shell zsh)"' &&
          mod.reloadCommand("fish") === "snshah shell fish | source" &&
          mod.reloadCommand("pwsh").includes("Invoke-Expression") &&
          mod.guessShell({ SHELL: "/usr/bin/fish" }) === "fish",
      );
    }

    // Agent mode: plain output when an AI agent drives the shell; agents can't trust profiles.
    {
      const ah = join(root, "agent-home");
      await mkdir(ah);
      const human = baseEnv(ah);
      const agentEnv = { ...human, CLAUDECODE: "1" };
      const humanInit = cli(["shell", "bash"], undefined, human).out;
      const agentInit = cli(["shell", "bash"], undefined, agentEnv).out;
      check(
        "under an agent the shell init has no eza aliases, no prompt theme, and no pagers",
        humanInit.includes("alias ll='eza") &&
          !agentInit.includes("eza") &&
          !agentInit.includes("oh-my-posh") &&
          agentInit.includes("GIT_PAGER") &&
          agentInit.includes("GIT_TERMINAL_PROMPT"),
        agentInit,
      );
      const forced = cli(["shell", "bash"], undefined, {
        ...agentEnv,
        SNSHAH_AGENT: "0",
      }).out;
      check("SNSHAH_AGENT=0 turns agent mode off", forced === humanInit);
      check(
        "SNSHAH_AGENT=1 turns it on without a known variable",
        !cli(["shell", "bash"], undefined, {
          ...human,
          SNSHAH_AGENT: "1",
        }).out.includes("eza"),
      );
      check(
        "an agent's shell gets no greeting",
        cli(["shell", "bash", "--greet"], undefined, {
          ...agentEnv,
          SNSHAH_GREET: "1",
        }).err === "",
      );
      const proj = join(root, "agent-proj");
      await mkdir(proj);
      const inProj = (args: string[], e: Record<string, string>) =>
        sh([bun, "--no-env-file", script, ...args], proj, e);
      inProj(["profile", "init"], human);
      const refused = inProj(["profile", "allow", "--yes"], {
        ...agentEnv,
        SNSHAH_AGENT: "0",
      });
      check(
        "an agent can't trust a profile file, even with --yes or SNSHAH_AGENT=0",
        refused.code !== 0 &&
          refused.err.includes("AI agent can't trust") &&
          inProj(["profile", "list"], human).out.includes("NOT trusted"),
        refused.out + refused.err,
      );
      check(
        "you can, in your own terminal",
        inProj(["profile", "allow", "--yes"], human).code === 0,
      );
      const ctxJson = json<{
        agent: boolean;
        platform: string;
        sandbox: { bwrap: boolean };
        dirProfiles: Array<{ status: string }>;
        tools: Array<{ name: string }>;
        snshah: { version: string };
      }>(inProj(["context", "--json"], agentEnv));
      check(
        "context --json says who and where, and notes the agent",
        ctxJson?.agent === true &&
          ctxJson.snshah.version === mod.cliVersion &&
          ctxJson.dirProfiles[0]?.status === "trusted" &&
          typeof ctxJson.sandbox.bwrap === "boolean" &&
          ctxJson.tools.some((t) => t.name === "bun"),
        JSON.stringify(ctxJson),
      );
      const ctxText = inProj(["context"], human);
      check(
        "context prints a compact summary",
        ctxText.code === 0 &&
          ctxText.out.includes("snshah") &&
          ctxText.out.includes("sandbox") &&
          !ctxText.out.includes("agent mode"),
        ctxText.out + ctxText.err,
      );
    }

    // commands: every command is classified, and every query takes --json.
    {
      const infos = json<
        Array<{ name: string; effect: string; json: boolean; source: string }>
      >(cli(["commands", "--json"]));
      // (profile-contributed groups are checked in their own block below)
      check(
        "commands --json lists every command with an effect",
        infos?.filter((c) => c.source === "core").length ===
          mod.commandNames.length &&
          !!infos?.every(
            (c) =>
              c.effect in { query: 1, change: 1, advice: 1, emit: 1, run: 1 },
          ),
        JSON.stringify(infos?.map((c) => c.name)),
      );
      const withoutJson = (infos ?? [])
        .filter((c) => c.effect === "query" && !c.json)
        .map((c) => c.name);
      check(
        "every query command takes --json",
        withoutJson.length === 0,
        withoutJson.join(", "),
      );
      const outside = join(root, "not-a-repo");
      await mkdir(outside);
      const misuse = sh([bun, "--no-env-file", script, "wt", "ls"], outside);
      check(
        "using a command wrongly exits 2",
        misuse.code === 2,
        `${misuse.code} ${misuse.err}`,
      );
      for (const args of [
        ["config", "path", "--json"],
        ["git", "root", "--json"],
        ["ux", "fonts", "status", "--json"],
        ["ssh", "host", "list", "--json"],
        ["ssh", "status", "--json"],
      ])
        check(
          `snshah ${args.join(" ")} prints valid JSON`,
          json(cli(args)) !== undefined,
          cli(args).out + cli(args).err,
        );
    }

    // vscode: fill-only user settings; files with comments are left alone.
    {
      const vh = join(root, "vscode-home");
      await mkdir(vh);
      // The vscode group turns on where VS Code is: here, a VS Code terminal.
      const ve = { ...baseEnv(vh), VSCODE_IPC_HOOK_CLI: "/dev/null" };
      const vscodeExt = await import(join(dirname(script), "ext", "vscode.ts"));
      const settings = vscodeExt.vscodeSettingsPath(mod.makeContext(ve));
      await mkdir(dirname(settings), { recursive: true });
      await writeFile(
        settings,
        JSON.stringify({ "terminal.integrated.scrollback": 500, "my.own": 1 }),
      );
      const before = await readFile(settings, "utf8");
      const preview = cli(["vscode"], undefined, ve);
      check(
        "vscode previews and changes nothing without --yes",
        preview.code === 0 &&
          preview.out.includes("Would add") &&
          !preview.out.includes("scrollback,") &&
          (await readFile(settings, "utf8")) === before,
        preview.out + preview.err,
      );
      const done = cli(["vscode", "--yes"], undefined, ve);
      const after = JSON.parse(await readFile(settings, "utf8"));
      check(
        "vscode --yes fills unset keys and never changes yours",
        done.code === 0 &&
          after["terminal.integrated.scrollback"] === 500 &&
          after["my.own"] === 1 &&
          String(after["terminal.integrated.fontFamily"]).includes(
            "Nerd Font",
          ) &&
          after["terminal.integrated.shellIntegration.enabled"] === true,
        done.out + done.err,
      );
      check(
        "vscode again reports no changes",
        cli(["vscode", "--yes"], undefined, ve).out.includes(
          "No changes needed",
        ),
      );
      await writeFile(settings, '{\n  // mine\n  "my.own": 1,\n}\n');
      const kept = await readFile(settings, "utf8");
      const commented = cli(["vscode", "--yes"], undefined, ve);
      check(
        "a settings file with comments is never rewritten; the keys to add are printed",
        (await readFile(settings, "utf8")) === kept &&
          commented.out.includes("has comments") &&
          commented.out.includes("terminal.integrated.fontFamily"),
        commented.out + commented.err,
      );
      const info = json<{
        settingsStatus: string;
        missingExtensions: string[];
      }>(cli(["vscode", "--json"], undefined, ve));
      check(
        "vscode --json reports and changes nothing",
        info?.settingsStatus === "commented" &&
          Array.isArray(info.missingExtensions),
      );
      const server = cli(["vscode"], undefined, {
        ...ve,
        SSH_CONNECTION: "192.0.2.10 50000 192.0.2.20 22",
      });
      const machine = vscodeExt.vscodeSettingsPath(
        mod.makeContext({ ...ve, SSH_CONNECTION: "x" }),
        true,
      );
      const filled = cli(["vscode", "--yes"], undefined, {
        ...ve,
        SSH_CONNECTION: "192.0.2.10 50000 192.0.2.20 22",
      });
      const machineSettings = JSON.parse(await readFile(machine, "utf8"));
      check(
        "over SSH it fills the server's Machine settings, leaves the font to your own computer",
        server.out.includes("on your own computer") &&
          filled.code === 0 &&
          machineSettings["terminal.integrated.scrollback"] === 10000 &&
          !("terminal.integrated.fontFamily" in machineSettings),
        server.out + filled.out + filled.err,
      );

      // Not in VS Code: the group is there but inactive, says why, exits 2.
      const away = cli(["vscode"], undefined, baseEnv(vh));
      check(
        "without VS Code, snshah vscode explains when it turns on and exits 2",
        away.code === 2 &&
          away.err.includes("turns on when") &&
          away.err.includes("code"),
        away.out + away.err,
      );
    }

    // Profile-contributed commands: a profile's selector turns a command group on.
    if (process.platform !== "win32") {
      const ph = join(root, "ext-home");
      const pdir = join(ph, ".config", "snshah", "profile.d");
      await mkdir(pdir, { recursive: true });
      const pe = baseEnv(ph);
      const bin = join(ph, "bin");
      await mkdir(bin);
      const marker = join(ph, "ext-loaded");
      const extFile = join(ph, "probe-ext.ts");
      await writeFile(
        extFile,
        `import { appendFileSync } from "node:fs";
appendFileSync(${JSON.stringify(marker)}, "loaded\\n");
export function register(group, api) {
  group.option("--json", "print JSON").action((o) => {
    console.log(o.json ? JSON.stringify({ ok: true }) : "probe ran");
  });
}
`,
      );
      const profile = (name: string, body: string) =>
        writeFile(join(pdir, name), body, { mode: 0o600 });
      await profile(
        "70-probe.ts",
        `export const selector = { kind: "service", name: "snshah-probe-tool" };
export const commands = {
  group: "probe",
  summary: "Probe command",
  effects: { "": "query" },
  activatesWhen: "snshah-probe-tool is installed",
  advice: "Install snshah-probe-tool.",
  load: () => import(${JSON.stringify(extFile)}),
};
`,
      );
      const off = cli(["probe"], undefined, pe);
      check(
        "a profile's command group is inactive until its service is there; it says how to turn it on and exits 2",
        off.code === 2 &&
          off.err.includes("snshah-probe-tool is installed") &&
          off.err.includes("Install snshah-probe-tool."),
        off.out + off.err,
      );
      const listed = json<
        Array<{ name: string; source: string; active: boolean }>
      >(cli(["commands", "--json"], undefined, pe));
      const entry = listed?.find((c) => c.name === "probe");
      check(
        "commands --json shows the inactive group with its source",
        !!entry && !entry.active && entry.source === "profile:private:70-probe",
        JSON.stringify(entry),
      );
      check("an inactive group never imported its module", !existsSync(marker));
      await writeFile(join(bin, "snshah-probe-tool"), "#!/bin/sh\n", {
        mode: 0o755,
      });
      const withTool = { ...pe, PATH: `${bin}${delimiter}${pe.PATH ?? ""}` };
      const on = cli(["probe"], undefined, withTool);
      check(
        "putting the tool on PATH turns the group on",
        on.code === 0 && on.out.includes("probe ran"),
        on.out + on.err,
      );
      check(
        "probe --json works",
        json<{ ok: boolean }>(cli(["probe", "--json"], undefined, withTool))
          ?.ok === true,
      );
      const before = existsSync(marker)
        ? (await readFile(marker, "utf8")).length
        : 0;
      cli(["config", "path", "--json"], undefined, withTool);
      cli(["doctor", "--json"], undefined, withTool);
      const after = existsSync(marker)
        ? (await readFile(marker, "utf8")).length
        : 0;
      check(
        "core commands never load a profile's module (lazy)",
        before > 0 && after === before,
      );
      const active = json<Array<{ name: string; active: boolean }>>(
        cli(["commands", "--json"], undefined, withTool),
      )?.find((c) => c.name === "probe");
      check("commands --json reports it active", active?.active === true);
      const sizeNow = (await readFile(marker, "utf8")).length;
      const shellStart = cli(["shell", "bash"], undefined, withTool);
      check(
        "a shell start does not probe or load command groups",
        shellStart.code === 0 &&
          (await readFile(marker, "utf8")).length === sizeNow,
        shellStart.err,
      );

      // Refused: a core name, a service selector that also sets config, a duplicate group.
      await profile(
        "71-shadow.ts",
        `export const selector = { kind: "always" };
export const commands = { group: "apply", summary: "x", effects: { "": "change" }, activatesWhen: "always", load: () => import(${JSON.stringify(extFile)}) };
`,
      );
      const shadow = cli(["context", "--json"], undefined, withTool);
      const shadowed = cli(["probe"], undefined, withTool);
      check(
        "a profile cannot take a core command's name",
        shadowed.code === 1 && shadowed.err.includes("core command"),
        shadow.err + shadowed.err,
      );
      await rm(join(pdir, "71-shadow.ts"));
      await profile(
        "72-costly.ts",
        `export const selector = { kind: "service", name: "sshd", state: "running" };
export const config = { env: { X: "1" } };
`,
      );
      const costly = cli(["plan", "--json"], undefined, withTool);
      check(
        "a service selector is refused where it would run at every shell start",
        costly.code !== 0 && costly.err.includes("service selector"),
        costly.err,
      );
      await rm(join(pdir, "72-costly.ts"));
      await profile(
        "73-twin.ts",
        `export const selector = { kind: "always" };
export const commands = { group: "probe", summary: "x", effects: { "": "change" }, activatesWhen: "always", load: () => import(${JSON.stringify(extFile)}) };
`,
      );
      const twin = cli(["probe"], undefined, withTool);
      check(
        "two profiles cannot provide the same group",
        twin.code === 1 && twin.err.includes("already provided"),
        twin.err,
      );
      await rm(join(pdir, "73-twin.ts"));

      // Facts: service selectors on this machine.
      const facts = mod.factSource(mod.makeContext(withTool));
      check(
        "service installed follows PATH; a made-up service is neither installed nor running",
        facts.service("snshah-probe-tool", "installed") &&
          !facts.service("snshah-no-such-service", "installed") &&
          !facts.service("snshah-no-such-service", "running"),
      );
    }

    // efss: rclone mirrors, with a stub rclone that records what it was asked.
    if (process.platform !== "win32") {
      const eh = join(root, "efss-home");
      const bin = join(eh, "stubs");
      await mkdir(bin, { recursive: true });
      const log = join(eh, "calls.log");
      await writeFile(
        join(bin, "rclone"),
        `#!/bin/sh
echo "rclone $*" >> "${log}"
conf=""
prev=""
for a in "$@"; do
  [ "$prev" = "--config" ] && conf="$a"
  prev="$a"
done
case " $* " in
  *" config create "*)
    name=$(printf '%s\\n' "$@" | sed -n '/^snshah-/p' | head -1)
    printf '[%s]\\ntype = stub\\n' "$name" >> "$conf" ;;
  *" config delete "*)
    name=$(printf '%s\\n' "$@" | sed -n '/^snshah-/p' | head -1)
    grep -v -e "^\\[$name\\]" -e '^type = stub' "$conf" > "$conf.new"; mv "$conf.new" "$conf" ;;
  *" lsf "*) echo a.txt ;;
esac
exit 0
`,
        { mode: 0o755 },
      );
      await writeFile(
        join(bin, "systemctl"),
        `#!/bin/sh\necho "systemctl $*" >> "${log}"\nexit 0\n`,
        { mode: 0o755 },
      );
      const bare = baseEnv(eh);
      const ee = { ...bare, PATH: `${bin}${delimiter}${bare.PATH ?? ""}` };
      const calls = async () =>
        existsSync(log) ? await readFile(log, "utf8") : "";
      const inactive = cli(["efss", "list"], undefined, bare);
      check(
        "efss is inactive without rclone and says how to get it",
        inactive.code === 2 && inactive.err.includes("rclone"),
        inactive.err,
      );
      const read = cli(["efss", "connect", "onedrive", "work"], undefined, ee);
      const stateFile = join(eh, ".local", "state", "snshah", "efss.json");
      check(
        "connect defaults to read-only, with a read-only OneDrive scope",
        read.code === 0 &&
          (await calls()).includes("config create snshah-work onedrive") &&
          (await calls()).includes("access_scopes=Files.Read Files.Read.All") &&
          !(await calls()).includes("Files.ReadWrite") &&
          existsSync(join(eh, "efss", "work")),
        read.out + read.err,
      );
      check(
        "connecting again changes nothing",
        cli(
          ["efss", "connect", "onedrive", "work"],
          undefined,
          ee,
        ).out.includes("No changes needed"),
      );
      const listed = json<
        Array<{ id: string; access: string; signedIn: boolean }>
      >(cli(["efss", "list", "--json"], undefined, ee));
      check(
        "list --json shows the connection signed in",
        listed?.[0]?.id === "work" &&
          listed[0].access === "read" &&
          listed[0].signedIn === true,
      );
      const refused = cli(["efss", "push", "work", "--yes"], undefined, ee);
      check(
        "push on a read-only connection is refused",
        refused.code === 2 && refused.err.includes("read-only"),
        refused.err,
      );
      const write = cli(
        [
          "efss",
          "connect",
          "gdrive",
          "docs",
          "--read-write",
          "--folder",
          "/Projects",
        ],
        undefined,
        ee,
      );
      check(
        "--read-write asks Google for the full scope",
        write.code === 0 &&
          (await calls()).includes("scope=drive\n") &&
          !(await calls()).includes("drive.readonly\n"),
        write.out + write.err + (await calls()),
      );
      const secret = cli(
        ["efss", "connect", "webdav", "dav", "--set", "pass=hunter2"],
        undefined,
        ee,
      );
      check(
        "a secret option is refused before rclone runs",
        secret.code === 2 && !(await calls()).includes("hunter2"),
        secret.err,
      );
      const host = cli(
        ["efss", "connect", "sftp", "nas", "--set", "host=nas.test", "user=me"],
        undefined,
        ee,
      );
      check(
        "--set passes rclone options through",
        host.code === 0 && (await calls()).includes("host=nas.test user=me"),
        host.out + host.err,
      );
      const home = cli(
        ["efss", "connect", "box", "b", "--mirror", "~"],
        undefined,
        ee,
      );
      check(
        "a mirror that would swallow your home is refused",
        home.code !== 0 && home.err.includes("contain your home"),
        home.err,
      );
      const pullRun = cli(["efss", "pull", "docs"], undefined, ee);
      check(
        "pull copies with --update and never syncs",
        pullRun.code === 0 &&
          (await calls()).includes("copy snshah-docs:Projects") &&
          (await calls()).includes("--update") &&
          !(await calls()).includes(" sync "),
        pullRun.out + pullRun.err,
      );
      const stateNow = JSON.parse(await readFile(stateFile, "utf8"));
      check(
        "pull records when it last ran",
        typeof stateNow.connections.find((c: { id: string }) => c.id === "docs")
          ?.lastPull === "string",
      );
      const before = (await calls()).length;
      const mirrorPreview = cli(
        ["efss", "pull", "docs", "--mirror"],
        undefined,
        ee,
      );
      const added = (await calls()).slice(before);
      check(
        "pull --mirror previews with --dry-run unless --yes",
        mirrorPreview.code === 0 &&
          added.includes("sync snshah-docs:Projects") &&
          added.includes("--dry-run"),
        added,
      );
      const preview = cli(["efss", "push", "docs"], undefined, ee);
      check(
        "push previews with --dry-run by default",
        preview.code === 0 &&
          (await calls()).includes("--dry-run") &&
          preview.out.includes("Nothing was changed"),
        preview.out + preview.err,
      );
      const at = (await calls()).length;
      const sent = cli(["efss", "push", "docs", "--yes"], undefined, ee);
      const sentCalls = (await calls()).slice(at);
      check(
        "push --yes sends with copy and no --dry-run",
        sent.code === 0 &&
          sentCalls.includes("copy ") &&
          !sentCalls.includes("--dry-run"),
        sent.out + sent.err + sentCalls,
      );
      const noLimit = cli(
        ["efss", "push", "docs", "--delete", "--yes"],
        undefined,
        ee,
      );
      check(
        "push --delete needs --max-delete",
        noLimit.code === 2 && noLimit.err.includes("--max-delete"),
        noLimit.err,
      );
      const at2 = (await calls()).length;
      const del = cli(
        ["efss", "push", "docs", "--delete", "--max-delete", "5", "--yes"],
        undefined,
        ee,
      );
      const delCalls = (await calls()).slice(at2);
      check(
        "push --delete --max-delete uses sync with the limit",
        del.code === 0 &&
          delCalls.includes(" sync ") &&
          delCalls.includes("--max-delete 5"),
        del.out + del.err + delCalls,
      );
      const agentEnv = { ...ee, CLAUDECODE: "1" };
      const agentConnect = cli(
        ["efss", "connect", "box", "b"],
        undefined,
        agentEnv,
      );
      const agentPush = cli(
        ["efss", "push", "docs", "--yes"],
        undefined,
        agentEnv,
      );
      const agentPreview = cli(["efss", "push", "docs"], undefined, agentEnv);
      check(
        "an agent can't sign in or send, but can preview a push",
        agentConnect.code === 2 &&
          agentPush.code === 2 &&
          agentPreview.code === 0,
        agentConnect.err + agentPush.err + agentPreview.err,
      );
      const where = json<{ path: string }>(
        cli(["efss", "folder", "docs", "--json"], undefined, ee),
      );
      check(
        "folder --json prints the mirror path",
        where?.path === join(eh, "efss", "docs"),
        JSON.stringify(where),
      );
      const online = json<Array<{ reachable: boolean }>>(
        cli(["efss", "status", "--online", "--json"], undefined, ee),
      );
      check(
        "status --online asks the provider",
        online?.length === 3 && online.every((c) => c.reachable === true),
        JSON.stringify(online),
      );
      if (process.platform === "linux") {
        const timed = cli(["efss", "schedule", "docs", "6h"], undefined, ee);
        const unit = join(
          eh,
          ".config",
          "systemd",
          "user",
          "snshah-efss-docs.timer",
        );
        check(
          "schedule writes a user timer and enables it",
          timed.code === 0 &&
            existsSync(unit) &&
            (await readFile(unit, "utf8")).includes("OnUnitActiveSec=6h") &&
            (await calls()).includes("enable --now snshah-efss-docs.timer"),
          timed.out + timed.err,
        );
        check(
          "schedule again changes nothing",
          cli(["efss", "schedule", "docs", "6h"], undefined, ee).out.includes(
            "No changes needed",
          ),
        );
        cli(["efss", "schedule", "docs", "off"], undefined, ee);
        check("schedule off removes the timer", !existsSync(unit));
      }
      const gone = cli(["efss", "remove", "work"], undefined, ee);
      check(
        "remove forgets the sign-in and leaves the local files",
        gone.code === 0 &&
          (await calls()).includes("config delete snshah-work") &&
          existsSync(join(eh, "efss", "work")) &&
          !(await readFile(stateFile, "utf8")).includes('"work"'),
        gone.out + gone.err,
      );
      check(
        "removing again changes nothing",
        cli(["efss", "remove", "work"], undefined, ee).out.includes(
          "No changes needed",
        ),
      );
      const infos = json<
        Array<{ name: string; source: string; active: boolean }>
      >(cli(["commands", "--json"], undefined, ee));
      check(
        "commands --json lists efss from its profile, active",
        !!infos?.find(
          (c) =>
            c.name === "efss pull" &&
            c.source === "profile:repo:efss" &&
            c.active,
        ),
      );
    }

    // share: audit Samba and NFS, print safe configuration, never edit.
    if (process.platform !== "win32") {
      const sh2 = join(root, "share-home");
      const bin = join(sh2, "stubs");
      await mkdir(bin, { recursive: true });
      await writeFile(join(bin, "smbd"), "#!/bin/sh\n", { mode: 0o755 });
      const bare = baseEnv(sh2);
      const se = { ...bare, PATH: `${bin}${delimiter}${bare.PATH ?? ""}` };
      const smbConf = join(sh2, "smb.conf");
      await writeFile(
        smbConf,
        `[global]
   workgroup = HOME
   server min protocol = NT1
   map to guest = Bad User

[public]
   path = /srv/public
   guest ok = yes
   read only = no

[docs]
   path = /srv/docs
   valid users = me
   hosts allow = 192.168.1.0/24
   read only = yes
`,
      );
      const exportsFile = join(sh2, "exports");
      await writeFile(
        exportsFile,
        `/srv/open *(rw,no_root_squash)
/srv/lan 192.168.1.0/24(ro,sync,no_subtree_check)
`,
      );
      // A faked machine with no commands at all: neither file server is there.
      const facts = json<Record<string, unknown>>(
        cli(["whoami", "--json"], undefined, bare),
      );
      const factsFile = join(sh2, "facts.json");
      await writeFile(factsFile, JSON.stringify({ ...facts, commands: [] }));
      const off = cli(["share", "status"], undefined, {
        ...bare,
        SNSHAH_FACTS: factsFile,
      });
      check(
        "share is inactive without Samba or NFS and says how to get one",
        off.code === 2 && off.err.includes("turns on when"),
        off.out + off.err,
      );
      const audit = json<{
        findings: Array<{ id: string; where: string; severity: string }>;
      }>(
        cli(
          [
            "share",
            "audit",
            "--smb-conf",
            smbConf,
            "--exports",
            exportsFile,
            "--json",
          ],
          undefined,
          se,
        ),
      );
      const ids = (audit?.findings ?? []).map((f) => `${f.id}@${f.where}`);
      check(
        "audit finds SMB1, guest access, a world-writable export and no_root_squash",
        ids.includes("smb-old-protocol@global") &&
          ids.includes("smb-map-to-guest@global") &&
          ids.includes("smb-guest@public") &&
          ids.includes("smb-writable-anyone@public") &&
          ids.some((i) => i.startsWith("nfs-everyone@/srv/open")) &&
          ids.some((i) => i.startsWith("nfs-no-root-squash@/srv/open")),
        ids.join(", "),
      );
      check(
        "audit leaves a scoped read-only share and a subnet export alone",
        !ids.some(
          (i) => i.endsWith("@docs") && !i.startsWith("smb-unscoped"),
        ) && !ids.some((i) => i.includes("/srv/lan")),
        ids.join(", "),
      );
      const bad = cli(
        ["share", "audit", "--smb-conf", smbConf, "--exports", exportsFile],
        undefined,
        se,
      );
      check(
        "audit exits 1 on a serious finding and prints the fix",
        bad.code === 1 && bad.out.includes("fix:"),
        bad.out + bad.err,
      );
      const clean = join(sh2, "clean.conf");
      await writeFile(
        clean,
        `[global]
   server min protocol = SMB3
   bind interfaces only = yes
   hosts allow = 192.168.1.0/24
   server smb encrypt = required

[docs]
   path = /srv/docs
   valid users = me
   read only = yes
`,
      );
      const ok = cli(
        ["share", "audit", "--smb-conf", clean, "--exports", join(sh2, "none")],
        undefined,
        se,
      );
      check(
        "a careful smb.conf audits clean",
        ok.code === 0 && ok.out.includes("Nothing to fix"),
        ok.out + ok.err,
      );
      const printed = cli(
        [
          "share",
          "print",
          "smb",
          "--path",
          "/srv/docs",
          "--subnet",
          "192.168.1.0/24",
          "--user",
          "me",
        ],
        undefined,
        se,
      );
      check(
        "print smb gives a read-only, subnet-scoped, no-guest share and changes nothing",
        printed.code === 0 &&
          printed.out.includes("read only = yes") &&
          printed.out.includes("guest ok = no") &&
          printed.out.includes("hosts allow = 192.168.1.0/24") &&
          printed.out.includes("Nothing was changed"),
        printed.out + printed.err,
      );
      const nfs = cli(
        [
          "share",
          "print",
          "nfs",
          "--path",
          "/srv/docs",
          "--subnet",
          "10.0.0.0/24",
          "--read-write",
        ],
        undefined,
        se,
      );
      check(
        "print nfs gives one subnet with root_squash",
        nfs.code === 0 &&
          nfs.out.includes(
            "/srv/docs 10.0.0.0/24(rw,sync,no_subtree_check,root_squash)",
          ),
        nfs.out + nfs.err,
      );
      for (const subnet of ["0.0.0.0/0", "8.8.8.0/24", "*"]) {
        const r = cli(
          ["share", "print", "nfs", "--path", "/srv/docs", "--subnet", subnet],
          undefined,
          se,
        );
        check(
          `print refuses ${subnet}`,
          r.code === 2 && r.err.includes("private subnet"),
          r.err,
        );
      }
      check(
        "print needs a subnet",
        cli(["share", "print", "smb", "--path", "/srv/docs"], undefined, se)
          .code === 2,
      );
    }

    // signin, agent, config edit in VS Code, ollama and vault, with stub tools.
    if (process.platform !== "win32") {
      const th = join(root, "tools-home");
      const bin = join(th, "stubs");
      await mkdir(bin, { recursive: true });
      const log = join(th, "calls.log");
      const stub = (name: string, body: string) =>
        writeFile(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
      await stub("codex", `echo "codex $*" >> "${log}"; exit 0`);
      await stub("claude", `echo "claude in $(pwd -P)" >> "${log}"; exit 0`);
      await stub(
        "ollama",
        `echo "ollama $*" >> "${log}"
if [ "$1" = list ]; then
  printf 'NAME             ID      SIZE    MODIFIED\\nllama3.2:latest  abc123  2.0 GB  2 days ago\\n'
fi
exit 0`,
      );
      await stub("code", `echo "code $*" >> "${log}"; exit 0`);
      await stub(
        "age",
        `echo "age $*" >> "${log}"
case "$1" in
  --passphrase) out="$3"; printf 'AGE\\n' > "$out"; cat "$4" >> "$out" ;;
  --decrypt) tail -n +2 "$2" ;;
esac
exit 0`,
      );
      const bare = baseEnv(th);
      const te = {
        ...bare,
        PATH: `${bin}${delimiter}${bare.PATH ?? ""}`,
        GH_TOKEN: "not-a-real-token",
      };
      const calls = async () =>
        existsSync(log) ? await readFile(log, "utf8") : "";

      // signin: reports, never prints a token.
      const si = cli(["signin", "--json"], undefined, te);
      const signed =
        json<
          Array<{ service: string; signedIn: boolean | null; command: string }>
        >(si);
      check(
        "signin --json reports each service with the command to sign in",
        !!signed &&
          signed.some((x) => x.service === "github" && x.signedIn === true) &&
          signed.some((x) => x.service === "codex" && x.signedIn === true) &&
          signed.some((x) => x.service === "claude" && x.signedIn === null) &&
          signed.every((x) => x.command.length > 0) &&
          !si.out.includes("not-a-real-token"),
        si.out + si.err,
      );

      // agent
      const st = json<{ agents: Array<{ agent: string; installed: boolean }> }>(
        cli(["agent", "status", "--json"], undefined, te),
      );
      check(
        "agent status lists claude and codex",
        st?.agents.find((a) => a.agent === "claude")?.installed === true &&
          st.agents.some((a) => a.agent === "codex"),
      );
      check(
        "agent start refuses an unknown agent",
        cli(["agent", "start", "gemini", "x"], undefined, te).code === 2,
      );
      check(
        "an agent can't start another agent",
        cli(["agent", "start", "claude", "x"], undefined, {
          ...te,
          CLAUDECODE: "1",
        }).code === 2,
      );
      const origin = join(th, "origin.git");
      const repo = join(th, "repo");
      await mkdir(repo, { recursive: true });
      const g = (cwd: string, ...args: string[]) =>
        sh(["git", ...args], cwd, te);
      g(th, "init", "--bare", "--quiet", "-b", "main", origin);
      g(repo, "init", "--quiet", "-b", "main");
      await writeFile(join(repo, "a.txt"), "a\n");
      g(repo, "add", "-A");
      g(
        repo,
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@example.com",
        "commit",
        "--quiet",
        "-m",
        "first",
      );
      const started = sh(
        [bun, "--no-env-file", script, "agent", "start", "claude", "feat/x"],
        repo,
        te,
      );
      check(
        "agent start creates the branch worktree and starts the agent in it",
        started.code === 0 &&
          (await calls()).includes(
            `claude in ${realpathSync(join(th, "repo.wt", "feat-x"))}`,
          ),
        started.out + started.err + (await calls()),
      );

      // config edit in VS Code goes through a workspace that never auto-saves
      const edit = cli(["config", "edit"], undefined, {
        ...te,
        EDITOR: "code",
      });
      const workspace = join(
        mod.makeContext(te).cacheDir,
        "config.code-workspace",
      );
      check(
        "config edit in VS Code uses a workspace with auto-save and hot exit off",
        edit.code === 0 &&
          (await calls()).includes(`code --wait ${workspace}`) &&
          existsSync(workspace) &&
          (await readFile(workspace, "utf8")).includes(
            '"files.autoSave": "off"',
          ) &&
          (await readFile(workspace, "utf8")).includes(
            '"files.hotExit": "off"',
          ),
        edit.out + edit.err + (await calls()),
      );

      // ollama
      const oll = json<{ running: boolean; models: Array<{ name: string }> }>(
        cli(["ollama", "status", "--json"], undefined, te),
      );
      check(
        "ollama status lists models",
        oll?.running === true && oll.models[0]?.name === "llama3.2:latest",
        JSON.stringify(oll),
      );
      const pulled = cli(["ollama", "pull", "qwen2.5-coder:7b"], undefined, te);
      check(
        "ollama pull runs ollama pull",
        pulled.code === 0 &&
          (await calls()).includes("ollama pull qwen2.5-coder:7b"),
        pulled.err,
      );
      check(
        "ollama pull refuses a bad name and refuses an agent",
        cli(["ollama", "pull", "bad name; rm"], undefined, te).code === 2 &&
          cli(["ollama", "pull", "llama3.2"], undefined, {
            ...te,
            CLAUDECODE: "1",
          }).code === 2,
      );

      // vault
      const conf = join(th, ".config", "snshah", "snshah.conf.ts");
      await mkdir(dirname(conf), { recursive: true });
      await writeFile(conf, "export default { aliases: { a: 'b' } };\n", {
        mode: 0o600,
      });
      const none = json<{ lastBackup: string | null }>(
        cli(["vault", "status", "--json"], undefined, te),
      );
      check(
        "vault status says there is no backup yet",
        none?.lastBackup === null,
      );
      const dir = join(th, "snapshots");
      const b1 = cli(["vault", "backup", "--to", dir], undefined, te);
      const snaps = existsSync(dir)
        ? (await import("node:fs")).readdirSync(dir)
        : [];
      check(
        "vault backup encrypts the config with an age passphrase",
        b1.code === 0 &&
          snaps.length === 1 &&
          (await calls()).includes("age --passphrase --output"),
        b1.out + b1.err,
      );
      check(
        "backing up again with no change does nothing",
        cli(["vault", "backup", "--to", dir], undefined, te).out.includes(
          "No changes needed",
        ),
      );
      const snapshot = join(dir, snaps[0] ?? "none");
      const ver = json<{ opens: boolean; matches: boolean }>(
        cli(["vault", "verify", snapshot, "--json"], undefined, te),
      );
      check(
        "vault verify opens it and matches the current config",
        ver?.opens === true && ver.matches === true,
      );
      await writeFile(conf, "export default { aliases: { a: 'changed' } };\n", {
        mode: 0o600,
      });
      const changed = json<{ changedSinceBackup: boolean }>(
        cli(["vault", "status", "--json"], undefined, te),
      );
      check(
        "vault status notices the config changed",
        changed?.changedSinceBackup === true,
      );
      const previewRestore = cli(["vault", "restore", snapshot], undefined, te);
      check(
        "vault restore previews and changes nothing without --yes",
        previewRestore.out.includes("Nothing was changed") &&
          (await readFile(conf, "utf8")).includes("changed"),
        previewRestore.out + previewRestore.err,
      );
      const doRestore = cli(
        ["vault", "restore", snapshot, "--yes"],
        undefined,
        te,
      );
      check(
        "vault restore --yes brings the snapshot back and keeps the old file",
        doRestore.code === 0 &&
          (await readFile(conf, "utf8")).includes("'b'") &&
          (await readFile(`${conf}.before-restore`, "utf8")).includes(
            "changed",
          ) &&
          ((await stat(conf)).mode & 0o777) === 0o600,
        doRestore.out + doRestore.err,
      );
      check(
        "vault refuses to run for an agent",
        cli(["vault", "backup", "--to", dir], undefined, {
          ...te,
          CLAUDECODE: "1",
        }).code === 2,
      );
    }

    // recommends, the exists selector, and the omarchy-workstation profile.
    if (process.platform !== "win32") {
      const oh = join(root, "omarchy-ws-home");
      const bin = join(oh, "stubs");
      await mkdir(bin, { recursive: true });
      const log = join(oh, "omarchy.log");
      await writeFile(
        join(bin, "omarchy"),
        `#!/bin/sh
echo "omarchy $*" >> "${log}"
if [ "$1" = webapp ] && [ "$2" = install ]; then
  mkdir -p "$HOME/.local/share/applications"
  : > "$HOME/.local/share/applications/$3.desktop"
fi
exit 0
`,
        { mode: 0o755 },
      );
      const bare = baseEnv(oh);
      const oe = { ...bare, PATH: `${bin}${delimiter}${bare.PATH ?? ""}` };
      const hypr = join(oh, ".config", "hypr");
      const menuFile = join(
        oh,
        ".config",
        "omarchy",
        "extensions",
        "omarchy-menu.jsonc",
      );
      // Omarchy, but no Hyprland Lua configuration: the profile stays out.
      const without = cli(["apply", "--yes"], undefined, oe);
      check(
        "omarchy-workstation needs the Hyprland Lua config to exist",
        without.code === 0 && !existsSync(join(hypr, "snshah.auto.lua")),
        without.out + without.err,
      );
      await mkdir(hypr, { recursive: true });
      await writeFile(join(hypr, "hyprland.lua"), "-- mine\n");
      await writeFile(
        join(hypr, "bindings.lua"),
        "o.bind('SUPER + T', 'term', 'x')\n",
      );
      await mkdir(dirname(menuFile), { recursive: true });
      await writeFile(menuFile, '{\n  "mine": { "label": "Mine" },\n}\n');
      const first = cli(["apply", "--yes"], undefined, oe);
      const bindings = await readFile(join(hypr, "bindings.lua"), "utf8");
      const menuText = await readFile(menuFile, "utf8");
      check(
        "omarchy-workstation adds the binding file, a Lua block, and menu entries inside the object",
        first.code === 0 &&
          (await readFile(join(hypr, "snshah.auto.lua"), "utf8")).includes(
            "omarchy menu summon snshah",
          ) &&
          bindings.startsWith("o.bind('SUPER + T', 'term', 'x')\n") &&
          bindings.includes("-- >>> snshah profile omarchy-workstation >>>") &&
          menuText.startsWith(
            "{\n// >>> snshah profile omarchy-workstation >>>",
          ) &&
          menuText.includes('"snshah.status.doctor"') &&
          menuText.includes('"mine"') &&
          menuText.trimEnd().endsWith("}"),
        first.out + first.err + menuText,
      );
      check(
        "the web apps were installed through omarchy",
        (await readFile(log, "utf8")).includes("omarchy webapp install Gmail"),
      );
      const again = cli(["apply", "--yes"], undefined, oe);
      check(
        "a second apply on an Omarchy workstation reports no changes",
        again.out.includes("No changes needed"),
        again.out + again.err,
      );

      // recommends: shown by doctor, never installed.
      const pdir = join(oh, ".config", "snshah", "profile.d");
      await mkdir(pdir, { recursive: true });
      await writeFile(
        join(pdir, "80-suggest.ts"),
        `export const selector = { kind: "always" };
export const recommends = [
  { tool: "snshah-nope", why: "does a thing" },
  { tool: "sh", why: "is always there" },
];
`,
        { mode: 0o600 },
      );
      const rec = json<{ checks: Array<{ check: string; status: string }> }>(
        cli(["doctor", "--json"], undefined, oe),
      );
      check(
        "doctor shows recommendations, warning for a missing tool",
        rec?.checks.find((c) => c.check === "recommended: snshah-nope")
          ?.status === "warn" &&
          rec.checks.find((c) => c.check === "recommended: sh")?.status ===
            "ok",
        JSON.stringify(rec?.checks.map((c) => c.check)),
      );
      await writeFile(
        join(pdir, "80-suggest.ts"),
        `export const selector = { kind: "always" };
export const recommends = [{ tool: "bad tool", why: "x" }];
`,
        { mode: 0o600 },
      );
      const badRec = cli(["plan"], undefined, oe);
      check(
        "a malformed recommends entry is refused",
        badRec.code !== 0 && badRec.err.includes("recommends"),
        badRec.err,
      );
      await rm(join(pdir, "80-suggest.ts"));
    }

    // zoxide: z, zi and cdz in every shell; cd untouched; seeded from checkouts.
    if (process.platform !== "win32") {
      const zh = join(root, "zoxide-home");
      const bin = join(zh, "stubs");
      await mkdir(bin, { recursive: true });
      const log = join(zh, "zoxide.log");
      const db = join(zh, "known");
      await writeFile(
        join(bin, "zoxide"),
        `#!/bin/sh
echo "zoxide $*" >> "${log}"
case "$1" in
  add) echo "$2" >> "${db}" ;;
  query) [ "$2" = --list ] && { cat "${db}" 2>/dev/null; exit 0; }; exit 1 ;;
esac
exit 0
`,
        { mode: 0o755 },
      );
      const bare = baseEnv(zh);
      const ze = { ...bare, PATH: `${bin}${delimiter}${bare.PATH ?? ""}` };
      for (const shell of ["bash", "zsh", "fish", "pwsh"]) {
        const out = cli(["shell", shell], undefined, ze).out;
        check(
          `shell ${shell}: zoxide init and cdz, with cd left alone`,
          out.includes("zoxide init") &&
            out.includes("cdz") &&
            !/alias cd=|function cd\b|--cmd cd/.test(out),
          out.slice(0, 200),
        );
      }
      const agentOut = cli(["shell", "bash"], undefined, {
        ...ze,
        CLAUDECODE: "1",
      }).out;
      check(
        "an agent's shell gets no zoxide",
        !agentOut.includes("zoxide init"),
      );
      const checkout = join(zh, "work", "mine");
      await mkdir(checkout, { recursive: true });
      await mkdir(join(zh, ".config", "snshah"), { recursive: true });
      await writeFile(
        join(zh, ".config", "snshah", "snshah.conf.ts"),
        `export default { repositories: [{ name: "mine", source: "${checkout}", path: "${checkout}" }] };\n`,
        { mode: 0o600 },
      );
      const seeded = cli(["apply", "--yes"], undefined, ze);
      check(
        "apply teaches zoxide the registered checkouts",
        seeded.code === 0 &&
          existsSync(db) &&
          (await readFile(db, "utf8")).includes(checkout),
        seeded.out + seeded.err,
      );
      const again = cli(["apply", "--yes"], undefined, ze);
      check(
        "and a second apply changes nothing",
        again.out.includes("No changes needed"),
        again.out + again.err,
      );
    }

    // Atuin on Ctrl-R, fzf pickers, and fish-style extras; none of it for agents.
    if (process.platform !== "win32") {
      const ah = join(root, "atuin-home");
      const bin = join(ah, "stubs");
      await mkdir(bin, { recursive: true });
      await writeFile(
        join(bin, "atuin"),
        `#!/bin/sh
[ "$1" = init ] && { shift; echo "echo atuin-init-ran $*"; }
exit 0
`,
        { mode: 0o755 },
      );
      await writeFile(
        join(bin, "fzf"),
        `#!/bin/sh
echo "__fzf_select__() { :; }; fzf-file-widget() { :; }; echo fzf-init-ran $1"
`,
        { mode: 0o755 },
      );
      const bare = baseEnv(ah);
      const ae = { ...bare, PATH: `${bin}${delimiter}${bare.PATH ?? ""}` };
      for (const shell of ["bash", "zsh", "fish", "pwsh"]) {
        const out = cli(["shell", shell], undefined, ae).out;
        check(
          `shell ${shell}: Atuin loads with the up arrow left alone`,
          out.includes(
            `atuin init ${shell === "pwsh" ? "powershell" : shell} --disable-up-arrow`,
          ),
          out.slice(0, 200),
        );
        const fzfAt = out.indexOf("fzf --");
        check(
          `shell ${shell}: fzf ${shell === "pwsh" ? "is left to PSFzf" : "loads before Atuin, so Ctrl-R stays Atuin's"}`,
          shell === "pwsh"
            ? fzfAt < 0
            : fzfAt > 0 && fzfAt < out.indexOf("atuin init"),
        );
      }
      const zsh = cli(["shell", "zsh"], undefined, ae).out;
      const bash = cli(["shell", "bash"], undefined, ae).out;
      const pwsh = cli(["shell", "pwsh"], undefined, ae).out;
      check(
        "zsh sources autosuggestions, then highlighting last, only when installed",
        zsh.includes("zsh-autosuggestions.zsh") &&
          zsh.indexOf("zsh-autosuggestions.zsh") <
            zsh.indexOf("zsh-syntax-highlighting.zsh") &&
          zsh.indexOf("fzf-tab") < zsh.indexOf("zsh-autosuggestions.zsh") &&
          !bash.includes("zsh-autosuggestions"),
      );
      check(
        "ble.sh is bash-only and opt-in",
        bash.includes("SNSHAH_BLE") &&
          bash.includes("ble-attach") &&
          !zsh.includes("blesh"),
      );
      check(
        "PowerShell gets list-view predictions guarded by version",
        pwsh.includes("-PredictionViewStyle ListView") &&
          pwsh.includes("2.2.0"),
      );
      const agentOut = cli(["shell", "bash"], undefined, {
        ...ae,
        CLAUDECODE: "1",
      }).out;
      check(
        "an agent's shell gets no Atuin, fzf or ble.sh",
        !/atuin init|fzf --|SNSHAH_BLE/.test(agentOut),
      );
      for (const shell of ["bash", "zsh"]) {
        if (!Bun.which(shell)) continue; // CI images may not ship zsh
        const file = join(ah, `init.${shell}`);
        await writeFile(file, cli(["shell", shell], undefined, ae).out);
        const ran = sh([shell, "-c", `. "${file}"; . "${file}"`], ah, ae);
        const text = ran.out + ran.err;
        check(
          `${shell}: init runs Atuin and fzf once, even when sourced twice`,
          (text.match(/atuin-init-ran/g) ?? []).length === 1 &&
            (text.match(/fzf-init-ran/g) ?? []).length === 1,
          text.slice(0, 300),
        );
      }
      // The Atuin config: unset keys only.
      const cfgDir = join(ah, ".config", "atuin");
      await mkdir(cfgDir, { recursive: true });
      await writeFile(join(cfgDir, "config.toml"), 'style = "full"\n');
      const applied = cli(["apply", "--yes"], undefined, ae);
      const cfg = await readFile(join(cfgDir, "config.toml"), "utf8");
      check(
        "apply fills Atuin's unset keys and keeps yours",
        applied.code === 0 &&
          cfg.includes('style = "full"') &&
          !cfg.includes('style = "compact"') &&
          cfg.includes("auto_sync = false") &&
          cfg.includes("update_check = false") &&
          cfg.includes("secrets_filter = true"),
        applied.out + applied.err + cfg,
      );
      const second = cli(["apply", "--yes"], undefined, ae);
      check(
        "and a second apply changes nothing",
        second.out.includes("No changes needed"),
        second.out + second.err,
      );
    }

    // wt: worktrees next to the repository; prune only what is safe.
    {
      const wh = join(root, "wt-home");
      const repo = join(wh, "repo");
      const originDir = join(wh, "origin.git");
      await mkdir(repo, { recursive: true });
      const we = baseEnv(wh);
      const g = (cwd: string, ...args: string[]) =>
        sh(["git", ...args], cwd, we);
      g(wh, "init", "--bare", "--quiet", "-b", "main", originDir);
      g(repo, "init", "--quiet", "-b", "main");
      await writeFile(join(repo, "a.txt"), "a\n");
      g(repo, "add", "-A");
      g(repo, "commit", "--quiet", "-m", "first");
      g(repo, "remote", "add", "origin", originDir);
      g(repo, "push", "--quiet", "-u", "origin", "main");
      const wt = (args: string[], cwd = repo) =>
        sh([bun, "--no-env-file", script, "wt", ...args], cwd, we);
      const made = wt(["new", "feat/x"]);
      const tree = join(`${repo}.wt`, "feat-x");
      check(
        "wt new creates <repo>.wt/<branch> on a new branch",
        made.code === 0 &&
          existsSync(join(tree, "a.txt")) &&
          g(tree, "branch", "--show-current").out.trim() === "feat/x",
        made.out + made.err,
      );
      check(
        "wt new again changes nothing",
        wt(["new", "feat/x"]).out.includes("No changes needed"),
      );
      check(
        "wt new from inside a worktree finds the same repository",
        wt(["new", "feat/x"], tree).out.includes("No changes needed"),
      );
      wt(["new", "keep/z"]);
      const listed = json<Array<{ branch?: string; main: boolean }>>(
        wt(["ls", "--json"]),
      );
      check(
        "wt ls --json lists the main tree and each worktree",
        listed?.length === 3 &&
          listed[0]?.main === true &&
          listed.some((w) => w.branch === "feat/x"),
        JSON.stringify(listed),
      );
      const none = wt(["prune"]);
      check(
        "wt prune leaves worktrees alone while their remote branch exists",
        none.out.includes("No changes needed"),
        none.out + none.err,
      );
      // A merged pull request: the branch was pushed, then deleted on the remote.
      await writeFile(join(tree, "b.txt"), "b\n");
      g(tree, "add", "-A");
      g(tree, "commit", "--quiet", "-m", "work");
      g(tree, "push", "--quiet", "-u", "origin", "feat/x");
      g(repo, "push", "--quiet", "origin", "--delete", "feat/x");
      g(repo, "fetch", "--quiet", "--prune");
      const preview = wt(["prune"]);
      check(
        "wt prune previews a worktree whose remote branch is gone, and changes nothing",
        preview.out.includes("feat/x") &&
          preview.out.includes("Would prune") &&
          existsSync(tree),
        preview.out + preview.err,
      );
      await writeFile(join(tree, "dirty.txt"), "unsaved\n");
      check(
        "wt prune never touches a worktree with uncommitted changes",
        wt(["prune", "--yes"]).out.includes("No changes needed") &&
          existsSync(tree),
      );
      await rm(join(tree, "dirty.txt"));
      const gone = wt(["prune", "--yes"]);
      check(
        "wt prune --yes removes the clean stale worktree and its branch, and keeps the others",
        gone.code === 0 &&
          !existsSync(tree) &&
          existsSync(join(`${repo}.wt`, "keep-z")) &&
          !g(repo, "branch", "--list", "feat/x").out.trim(),
        gone.out + gone.err,
      );
    }

    // eza: tree, ls, ll, la and exa, with icons unless your fonts are missing.
    {
      const eh = join(root, "eza-home");
      await mkdir(eh);
      const ee = baseEnv(eh);
      const bashInit = cli(["shell", "bash"], undefined, ee).out;
      check(
        "eza aliases: tree, ls, ll, la and exa, with icons and git ignore",
        bashInit.includes(
          "alias tree='eza --icons=auto --group-directories-first --tree --git-ignore'",
        ) &&
          bashInit.includes("alias ll='eza --icons=auto") &&
          bashInit.includes("alias exa='eza'") &&
          bashInit.includes("command -v eza"),
        bashInit,
      );
      check(
        "without eza on PATH the init still gives you ll",
        bashInit.includes("alias ll='ls -al'"),
      );
      check(
        "fish and pwsh get their own eza forms",
        cli(["shell", "fish"], undefined, ee).out.includes("command -sq eza") &&
          cli(["shell", "pwsh"], undefined, ee).out.includes(
            "function global:tree { eza",
          ),
      );
      cli(["ux", "fonts", "missing"], undefined, ee);
      check(
        "icons drop out when you said fonts are missing",
        !cli(["shell", "bash"], undefined, ee).out.includes(
          "alias tree='eza --icons",
        ),
      );
      const mine = join(eh, ".config", "snshah", "profile.d");
      await mkdir(mine, { recursive: true });
      await writeFile(
        join(mine, "60-mine.ts"),
        'export const selector = { kind: "always" };\nexport const config = { aliases: { ll: "echo mine" } };\n',
      );
      const own = cli(["shell", "bash"], undefined, ee).out;
      check(
        "an alias you set yourself is never replaced by eza",
        own.includes("alias ll='echo mine'") && !own.includes("alias ll='eza"),
        own,
      );
      check(
        "eza is a default tool",
        mod.defaultTools.eza === "latest" &&
          mod.ezaCommands(true).tree.includes("--tree"),
      );
    }

    // Directory profiles: .snshah.profile.ts, trusted by content hash.
    {
      const dh = join(root, "dir-home");
      const proj = join(root, "dir-proj");
      const sub = join(proj, "sub", "deeper");
      await mkdir(dh);
      await mkdir(sub, { recursive: true });
      await mkdir(join(proj, "bin"));
      const de: Record<string, string> = {
        ...baseEnv(dh),
        PROJ_VAR: "orig",
      };
      cli(["apply", "--yes"], undefined, de);
      const file = join(proj, ".snshah.profile.ts");
      await writeFile(
        join(proj, "helper.ts"),
        'export const greeting = "hi";\n',
      );
      await writeFile(
        file,
        [
          'import { greeting } from "./helper.ts";',
          'console.log("noise on stdout must not reach the shell");',
          'export const selector = { kind: "any", of: [{ kind: "always" }, { kind: "hostname", is: "nowhere" }] };',
          "export const config = {",
          '  aliases: { pa: "echo pa" },',
          '  env: { PROJ_VAR: "yes", PROJ_GREETING: greeting },',
          '  path: ["bin"],',
          '  onEnter: { posix: "ENTERED=1; export ENTERED", fish: "set -gx ENTERED 1" },',
          '  onLeave: { posix: "unset ENTERED", fish: "set -e ENTERED" },',
          "};",
          "",
        ].join("\n"),
      );
      const inDir = (args: string[], cwd = sub, e = de) =>
        sh(["bun", "--no-env-file", script, ...args], cwd, e);
      const chain = mod.dirProfileChain(sub);
      check(
        "dirProfileChain finds the files above you, farthest first",
        chain.length === 1 && chain[0] === file,
        JSON.stringify(chain),
      );
      const l0 = inDir(["profile", "list"]);
      check(
        "an untrusted profile file is listed as not trusted",
        l0.out.includes("NOT trusted yet"),
        l0.out + l0.err,
      );
      const load0 = sh(
        ["bun", "--no-env-file", script, "profile", "load", "--shell", "bash"],
        sub,
        { ...de, SNSHAH_DIRFILES: file },
      );
      check(
        "loading an untrusted file prints a notice and no shell code",
        load0.out === "" && load0.err.includes("snshah profile allow"),
        load0.out + load0.err,
      );
      const noYes = inDir(["profile", "allow"]);
      check(
        "profile allow warns about NO LIMITS, prints the file, and refuses without --yes when not interactive",
        noYes.code !== 0 &&
          noYes.out.includes("NO LIMITS") &&
          noYes.out.includes("🚨") &&
          noYes.out.includes("PROJ_VAR"),
        noYes.out + noYes.err,
      );
      const al = inDir(["profile", "safe", "--yes"]);
      check(
        "profile allow (alias safe) trusts the file",
        al.code === 0 &&
          al.out.includes("Trusted") &&
          al.out.includes("NO limits"),
        al.out + al.err,
      );
      check(
        "profile allow again changes nothing",
        inDir(["profile", "allow", "--yes"]).out.includes("No changes needed"),
      );
      const sh1 = inDir(["profile", "show"]);
      check(
        "profile show lists what the file sets and where it came from",
        sh1.out.includes("echo pa") &&
          sh1.out.includes("PROJ_VAR") &&
          sh1.out.includes(".snshah.profile.ts") &&
          sh1.out.includes(join(proj, "bin")),
        sh1.out + sh1.err,
      );
      const loaded = sh(
        ["bun", "--no-env-file", script, "profile", "load", "--shell", "bash"],
        sub,
        { ...de, SNSHAH_DIRFILES: file },
      );
      check(
        "a profile that prints does not pollute the shell code on stdout",
        !loaded.out.includes("noise") &&
          loaded.out.includes("__snshah_dir_env PROJ_VAR") &&
          loaded.err.includes("noise on stdout") &&
          loaded.err.includes("no limits"),
        loaded.out + loaded.err,
      );
      check(
        "profile why names the file",
        inDir(["profile", "why", "pa"]).out.includes(".snshah.profile.ts"),
      );
      check(
        "profile check validates a trusted file",
        inDir(["profile", "check"]).out.includes("is valid"),
      );
      const dirLive: Record<string, string[]> = {
        bash: [
          "bash",
          "-ic",
          `alias pa='echo old'; cd "$PROJ"; __snshah_dir_hook; echo "A=$(alias pa 2>&1)"; echo "E=$PROJ_VAR"; echo "G=$PROJ_GREETING"; echo "N=$ENTERED"; echo "P=$PATH"; cd /; __snshah_dir_hook; echo "B=$(alias pa 2>&1)"; echo "E2=$PROJ_VAR"; echo "N2=\${ENTERED-gone}"; echo "P2=$PATH"`,
        ],
        zsh: [
          "zsh",
          "-ic",
          `alias pa='echo old'; cd "$PROJ"; __snshah_dir_hook; echo "A=$(alias pa 2>&1)"; echo "E=$PROJ_VAR"; echo "G=$PROJ_GREETING"; echo "N=$ENTERED"; echo "P=$PATH"; cd /; __snshah_dir_hook; echo "B=$(alias pa 2>&1)"; echo "E2=$PROJ_VAR"; echo "N2=\${ENTERED-gone}"; echo "P2=$PATH"`,
        ],
        fish: [
          "fish",
          "-ic",
          `alias pa 'echo old'; cd "$PROJ"; __snshah_dir_hook; echo A=(functions pa 2>&1 | string join ' '); echo E=$PROJ_VAR; echo G=$PROJ_GREETING; echo N=$ENTERED; echo P=$PATH; cd /; __snshah_dir_hook; echo B=(functions pa 2>&1 | string join ' '); echo E2=$PROJ_VAR; echo N2=(set -q ENTERED; and echo $ENTERED; or echo gone); echo P2=$PATH`,
        ],
      };
      for (const [shell, argv] of Object.entries(dirLive)) {
        if (!Bun.which(argv[0]!)) continue;
        const r = sh(argv, root, { ...de, PROJ: sub });
        const line = (k: string) =>
          r.out.split("\n").find((l) => l.startsWith(`${k}=`)) ?? "";
        check(
          `interactive ${shell}: entering the directory applies the profile and leaving puts things back`,
          line("A").includes("echo pa") &&
            line("E") === "E=yes" &&
            line("G") === "G=hi" &&
            line("N") === "N=1" &&
            line("N2") === "N2=gone" &&
            line("P").includes(join(proj, "bin")) &&
            line("B").includes("echo old") &&
            line("E2") === "E2=orig" &&
            !line("P2").includes(join(proj, "bin")),
          r.out + r.err,
        );
      }
      // Editing a trusted file un-trusts it.
      await writeFile(file, (await readFile(file, "utf8")) + "// edited\n");
      const l1 = inDir(["profile", "list"]);
      check(
        "editing a trusted file makes it untrusted until you allow it again",
        l1.out.includes("CHANGED since you trusted it") &&
          inDir(["profile", "show"]).out.includes("Nothing applies yet"),
        l1.out + l1.err,
      );
      check(
        "profile deny forgets trust, and twice is a no-op",
        inDir(["profile", "allow", "--yes"]).code === 0 &&
          inDir(["profile", "deny"]).out.includes("No longer trusting") &&
          inDir(["profile", "deny"]).out.includes("No changes needed"),
      );
      await writeFile(file, 'export const config = { tools: { x: "1" } };\n');
      inDir(["profile", "allow", "--yes"]);
      const badCfg = inDir(["profile", "check"]);
      check(
        "machine-wide settings are refused in a directory profile, with the reason",
        badCfg.code !== 0 &&
          (badCfg.out + badCfg.err).includes("whole machine"),
        badCfg.out + badCfg.err,
      );
      const linkDir = join(root, "dir-link");
      await mkdir(linkDir);
      await symlink(file, join(linkDir, ".snshah.profile.ts"));
      check(
        "a symlinked profile file is followed; the content hash is the trust",
        inDir(["profile", "list"], linkDir).out.includes("trusted"),
      );
      // Discovery: profile list finds files above, below and (with --all) in your workspaces.
      const scanRoot = join(root, "scan-root");
      const scanWs = join(root, "scan-ws");
      for (const d of [
        join(scanRoot, "a"),
        join(scanRoot, "a", "b", "c"),
        join(scanRoot, "node_modules", "x"),
        join(scanWs, "w"),
      ])
        await mkdir(d, { recursive: true });
      for (const d of [
        join(scanRoot, "a"),
        join(scanRoot, "a", "b", "c"),
        join(scanRoot, "node_modules", "x"),
        join(scanWs, "w"),
      ])
        await writeFile(
          join(d, ".snshah.profile.ts"),
          "export const config = {};\n",
        );
      const found = mod.scanDirProfiles(scanRoot);
      check(
        "scanDirProfiles finds nested files and skips node_modules",
        found.length === 2 &&
          !found.some((f: string) => f.includes("node_modules")) &&
          mod.scanDirProfiles(scanRoot, 1).length === 1,
        JSON.stringify(found),
      );
      const ls1 = inDir(["profile", "ls"], scanRoot, {
        ...de,
        WORKSPACES_HOME: scanWs,
      });
      check(
        "profile ls finds files below you, says what is not trusted, and summarizes",
        ls1.out.includes("below here") &&
          ls1.out.includes("NOT trusted yet") &&
          ls1.out.includes("2 file(s)") &&
          !ls1.out.includes("scan-ws") &&
          ls1.out.includes("profile list --all"),
        ls1.out + ls1.err,
      );
      const ls2 = inDir(["profile", "list", "--all"], scanRoot, {
        ...de,
        WORKSPACES_HOME: scanWs,
      });
      check(
        "profile list --all also finds files in your workspaces",
        ls2.out.includes("scan-ws") && ls2.out.includes("3 file(s)"),
        ls2.out + ls2.err,
      );
      const lsj = JSON.parse(
        inDir(["profile", "list", "--json"], join(scanRoot, "a", "b", "c")).out,
      ) as Array<{ file: string; scope: string; status: { kind: string } }>;
      check(
        "profile list --json says where each file is and its status",
        lsj.length === 2 &&
          lsj.some(
            (r) => r.scope === "here" && r.status.kind === "untrusted",
          ) &&
          inDir(["profile", "list", "--depth", "x"], scanRoot).code === 2,
        JSON.stringify(lsj),
      );
      const gonePath = join(scanRoot, "a", "b", "c");
      inDir(["profile", "allow", "--yes"], gonePath);
      await rm(join(gonePath, ".snshah.profile.ts"));
      const lsGone = inDir(["profile", "list"], scanRoot);
      check(
        "a trusted file that was deleted is reported as gone",
        lsGone.out.includes("the file is gone"),
        lsGone.out,
      );
      const pr1 = inDir(["profile", "prune"]);
      const pr2 = inDir(["profile", "prune"]);
      check(
        "profile prune forgets stale trust, and twice is a no-op",
        pr1.out.includes("Forgot trust for") &&
          pr2.out.includes("No changes needed"),
        pr1.out + pr2.out,
      );
      const fresh = join(root, "dir-fresh");
      await mkdir(fresh);
      const i1 = inDir(["profile", "init"], fresh);
      const i2 = inDir(["profile", "init"], fresh);
      check(
        "profile init scaffolds once and never overwrites",
        i1.out.includes("Created") &&
          i2.out.includes("No changes needed") &&
          existsSync(join(fresh, ".snshah.profile.ts")),
        i1.out + i2.out,
      );
    }

    // The checkout is the source: a local bare "origin" stands in for GitHub.
    const fx = join(root, "fixture");
    const origin = join(fx, "origin.git");
    const seed = join(fx, "seed");
    await mkdir(seed, { recursive: true });
    sh(["git", "init", "--bare", "--quiet", "-b", "main", origin]);
    cpSync(workshop, join(seed, "workshop"), {
      recursive: true,
      filter: (src) => !src.includes("node_modules"),
    });
    const seedGit = (...args: string[]) => sh(["git", "-C", seed, ...args]);
    seedGit("init", "--quiet", "-b", "main");
    seedGit("add", "-A");
    seedGit("commit", "--quiet", "-m", "seed");
    seedGit("push", "--quiet", origin, "main");
    const git = (dir: string, ...args: string[]) =>
      sh(["git", "-C", dir, ...args]).out.trim();
    const seedHead = () => seedGit("rev-parse", "HEAD").out.trim();
    const bootSh = join(workshop, "bootstrap.sh");
    const fromOrigin = (home: string): Record<string, string> => ({
      ...baseEnv(home),
      SNSHAH_URL: origin,
    });
    const pipedBootstrap = (e: Record<string, string>) =>
      sh(["sh", "-c", `sh < "${bootSh}"`], root, e);
    const checkoutOf = (home: string) =>
      join(home, "workspaces", "github.com", "shah", "shah");
    const receiptOf = async (home: string) =>
      JSON.parse(
        await readFile(
          join(home, ".local", "state", "snshah", "installed.auto.json"),
          "utf8",
        ),
      ) as { revision: string; checkout: string };

    // Bootstrap: git is required, then clone, install from the checkout.
    {
      const noGit = join(root, "no-git-bin");
      await mkdir(noGit);
      for (const tool of ["sh", "uname", "dirname", "cat", "grep"]) {
        const found = Bun.which(tool);
        if (found) await symlink(found, join(noGit, tool));
      }
      const gitHome = join(root, "nogit-home");
      await mkdir(gitHome);
      const g = sh(["sh", "-c", `sh < "${bootSh}"`], root, {
        ...fromOrigin(gitHome),
        PATH: noGit,
      });
      check(
        "bootstrap.sh stops without git and says how to install it",
        g.code !== 0 &&
          g.err.includes("needs git") &&
          g.err.includes("Install it with:") &&
          !existsSync(join(gitHome, ".bun")),
        g.out + g.err,
      );

      const bootHome = join(root, "boot-fx-home");
      await mkdir(bootHome);
      const e = fromOrigin(bootHome);
      const r1 = pipedBootstrap(e);
      const checkout = checkoutOf(bootHome);
      check(
        "piped bootstrap.sh clones shah/shah into the workspaces root and installs",
        r1.code === 0 &&
          existsSync(join(checkout, "workshop", "snshah.ts")) &&
          existsSync(join(bootHome, ".local", "bin", "snshah")),
        r1.out + r1.err,
      );
      const rc = await receiptOf(bootHome).catch(() => undefined);
      check(
        "the receipt names the checkout and its commit",
        !!rc &&
          realpathSync(rc.checkout) === realpathSync(checkout) &&
          rc.revision === seedHead(),
        JSON.stringify(rc),
      );
      const r2 = pipedBootstrap(e);
      check(
        "piped bootstrap.sh again reports no changes",
        r2.code === 0 && r2.out.includes("No changes needed."),
        r2.out + r2.err,
      );
      const wrong = join(root, "wrong-origin-home");
      await mkdir(join(checkoutOf(wrong), ".."), { recursive: true });
      sh(["git", "init", "--quiet", checkoutOf(wrong)]);
      sh([
        "git",
        "-C",
        checkoutOf(wrong),
        "remote",
        "add",
        "origin",
        "https://example.invalid/other/repo.git",
      ]);
      const w = pipedBootstrap(fromOrigin(wrong));
      check(
        "bootstrap.sh refuses a checkout of some other repository",
        w.code !== 0 && w.err.includes("something other than shah/shah"),
        w.err,
      );
      const omar = join(root, "omarchy-home");
      await mkdir(omar);
      const om = pipedBootstrap({
        ...fromOrigin(omar),
        WORKSPACES_HOME: join(omar, "Work"),
      });
      check(
        "bootstrap.sh honours $WORKSPACES_HOME",
        om.code === 0 &&
          existsSync(
            join(
              omar,
              "Work",
              "github.com",
              "shah",
              "shah",
              "workshop",
              "snshah.ts",
            ),
          ),
        om.out + om.err,
      );
    }

    // snshah update: fetch, preview, fast-forward, apply; refuses to disturb work.
    {
      const upHome = join(root, "update-home");
      await mkdir(upHome);
      const ue = fromOrigin(upHome);
      pipedBootstrap(ue);
      const checkout = checkoutOf(upHome);
      const launcher = join(upHome, ".local", "bin", "snshah");
      const same = sh([launcher, "update", "--yes"], root, ue);
      check(
        "update with nothing new says so",
        same.code === 0 && same.out.includes("Already up to date"),
        same.out + same.err,
      );
      // A new commit upstream: a new profile.d file.
      await writeFile(
        join(seed, "workshop", "profile.d", "99-fixture.ts"),
        'import type { Contribution, Selector } from "../snshah.ts";\nexport const selector = { kind: "always" } satisfies Selector;\nexport const config = { env: { SNSHAH_FIXTURE: "1" } } satisfies Contribution;\n',
      );
      seedGit("add", "-A");
      seedGit("commit", "--quiet", "-m", "second");
      seedGit("push", "--quiet", origin, "main");
      const available = sh([launcher, "update", "--check"], root, ue);
      check(
        "update --check sees the new upstream commit",
        available.code === 0 && available.out.includes("update is available"),
        available.out + available.err,
      );
      const stale = await receiptOf(upHome);
      check(
        "update --check changes nothing in the checkout",
        git(checkout, "rev-parse", "HEAD") === stale.revision,
      );

      // Refusals leave everything as it was.
      await writeFile(join(checkout, "workshop", "README.md"), "edited\n", {
        flag: "a",
      });
      const dirty = sh([launcher, "update", "--yes"], root, ue);
      check(
        "update refuses a checkout with uncommitted changes",
        dirty.code !== 0 && dirty.err.includes("uncommitted changes"),
        dirty.out + dirty.err,
      );
      sh(["git", "-C", checkout, "checkout", "--quiet", "--", "."]);
      sh(["git", "-C", checkout, "checkout", "--quiet", "--detach"]);
      const detached = sh([launcher, "update", "--yes"], root, ue);
      check(
        "update refuses a detached checkout",
        detached.code !== 0 && detached.err.includes("detached"),
        detached.out + detached.err,
      );
      sh(["git", "-C", checkout, "checkout", "--quiet", "main"]);
      await writeFile(join(checkout, "local.txt"), "mine\n");
      sh(["git", "-C", checkout, "add", "local.txt"]);
      sh(["git", "-C", checkout, "commit", "--quiet", "-m", "local"]);
      const diverged = sh([launcher, "update", "--yes"], root, ue);
      check(
        "update refuses a diverged checkout",
        diverged.code !== 0 && diverged.err.includes("can't fast-forward"),
        diverged.out + diverged.err,
      );
      sh(["git", "-C", checkout, "reset", "--quiet", "--hard", stale.revision]);
      check(
        "refusals changed nothing",
        git(checkout, "rev-parse", "HEAD") === stale.revision,
      );

      const go = sh([launcher, "update", "--yes"], root, ue);
      const after = await receiptOf(upHome);
      check(
        "update fast-forwards the checkout and applies it",
        go.code === 0 &&
          after.revision === seedHead() &&
          git(checkout, "rev-parse", "HEAD") === seedHead() &&
          existsSync(join(checkout, "workshop", "profile.d", "99-fixture.ts")),
        go.out + go.err,
      );
      const again = sh([launcher, "update", "--yes"], root, ue);
      check(
        "update again reports no changes",
        again.code === 0 && again.out.includes("Already up to date"),
        again.out + again.err,
      );
      const bare = join(root, "bare-home");
      await mkdir(bare);
      const bareRun = sh(
        [bun, "--no-env-file", script, "update", "--check"],
        root,
        baseEnv(bare),
      );
      check(
        "update without a checkout explains how to install",
        bareRun.code !== 0 &&
          /not installed from a git checkout/.test(bareRun.out + bareRun.err),
        bareRun.out + bareRun.err,
      );
    }

    // A workspaces root behind a symlink (macOS /tmp, a linked ~/Work) is still a checkout.
    {
      const sh1 = join(root, "sym-home");
      const real = join(root, "sym-real");
      const link = join(root, "sym-link");
      await mkdir(sh1);
      await mkdir(real);
      await symlink(real, link);
      const se = { ...baseEnv(sh1), WORKSPACES_HOME: link };
      const add1 = cli(
        ["git", "add", origin, "--name", "symfx"],
        undefined,
        se,
      );
      const add2 = cli(
        ["git", "add", origin, "--name", "symfx"],
        undefined,
        se,
      );
      const list = cli(["git", "list"], undefined, se);
      check(
        "a checkout under a symlinked workspaces root is recognised",
        add1.code === 0 &&
          !add2.out.includes("is not a checkout") &&
          !add2.err.includes("not a checkout") &&
          !list.out.includes("not a checkout") &&
          !list.err.includes("not a checkout"),
        add1.out + add1.err + add2.out + add2.err + list.out + list.err,
      );
    }

    // uninstall: previews, removes what snshah made, keeps what is yours.
    {
      const rmHome = join(root, "uninstall-home");
      await mkdir(rmHome);
      await writeFile(join(rmHome, ".bashrc"), "export KEEP=1\n");
      const re = fromOrigin(rmHome);
      pipedBootstrap(re);
      const launcher = join(rmHome, ".local", "bin", "snshah");
      const privateConfig = join(rmHome, ".config", "snshah", "snshah.conf.ts");
      const preview = sh([launcher, "uninstall"], root, re);
      check(
        "uninstall previews by default and changes nothing",
        preview.code === 0 &&
          preview.out.includes("would remove") &&
          existsSync(launcher) &&
          (await readFile(join(rmHome, ".bashrc"), "utf8")).includes(
            ">>> snshah shell >>>",
          ),
        preview.out + preview.err,
      );
      const gone = sh([launcher, "uninstall", "--yes"], root, re);
      const rc = await readFile(join(rmHome, ".bashrc"), "utf8");
      check(
        "uninstall --yes removes the block, launcher, copy, state and cache",
        gone.code === 0 &&
          rc.includes("export KEEP=1") &&
          !rc.includes("snshah") &&
          !existsSync(launcher) &&
          !existsSync(join(rmHome, ".local", "share", "snshah")) &&
          !existsSync(join(rmHome, ".local", "state", "snshah")),
        gone.out + gone.err + rc,
      );
      check(
        "uninstall keeps the private config and the checkout, and says so",
        existsSync(privateConfig) &&
          existsSync(checkoutOf(rmHome)) &&
          gone.out.includes("--purge") &&
          gone.out.includes("rm -rf"),
        gone.out,
      );
      const again = sh(
        [bun, "--no-env-file", script, "uninstall", "--yes", "--purge"],
        root,
        re,
      );
      check(
        "uninstall --purge deletes the private config, and twice is a no-op",
        again.code === 0 &&
          !existsSync(join(rmHome, ".config", "snshah")) &&
          sh(
            [bun, "--no-env-file", script, "uninstall", "--yes", "--purge"],
            root,
            re,
          ).out.includes("No changes needed"),
        again.out + again.err,
      );
    }

    // Shell greeting: doctor on first use per version, update check hourly.
    {
      const greetHome = join(root, "greet-home");
      await mkdir(greetHome);
      pipedBootstrap(fromOrigin(greetHome));
      const pinned = (await receiptOf(greetHome)).revision;
      const ge = {
        ...fromOrigin(greetHome),
        SNSHAH_GREET: "1",
      };
      const statePath = join(
        greetHome,
        ".local",
        "state",
        "snshah",
        "state.json",
      );
      const plain = cli(["shell", "bash"], undefined, ge);
      const g1 = cli(["shell", "bash", "--greet"], undefined, ge);
      check(
        "first greeted shell runs doctor (on stderr only)",
        g1.code === 0 &&
          g1.err.includes("installs from, and updates") &&
          g1.out === plain.out,
        g1.out + g1.err,
      );
      let state: {
        doctorRanFor?: string;
        update?: { kind: string; latest?: string };
      } = {};
      for (let i = 0; i < 100; i++) {
        try {
          state = JSON.parse(await readFile(statePath, "utf8"));
        } catch {
          /* not written yet */
        }
        if (state.update?.kind === "checked") break;
        await Bun.sleep(100);
      }
      check(
        "background update check records its answer in state.json",
        state.doctorRanFor === mod.cliVersion &&
          state.update?.kind === "checked" &&
          state.update.latest === pinned,
        JSON.stringify(state),
      );
      const g2 = cli(["shell", "bash", "--greet"], undefined, ge);
      check(
        "second greeted shell skips doctor and the fresh update check",
        g2.code === 0 &&
          !g2.err.includes("installs from, and updates") &&
          g2.out === plain.out,
        g2.err,
      );
      const c = cli(["update", "--check"], undefined, ge);
      check(
        "update --check asks the checkout's origin and reports",
        c.code === 0 && c.out.includes("Up to date"),
        c.out + c.err,
      );
      await writeFile(statePath, "{ not json");
      const g3 = cli(["shell", "bash", "--greet"], undefined, ge);
      check(
        "a corrupt state.json never breaks a shell",
        g3.code === 0 && g3.out === plain.out,
        g3.err,
      );
      const off = cli(["shell", "bash", "--greet"], undefined, {
        ...ge,
        SNSHAH_GREET: "0",
      });
      check("SNSHAH_GREET=0 keeps shells quiet", off.err === "", off.err);
    }

    // mise: tool list, install through mise, activation, direnv, opt-out.
    {
      const miseFile = join(home, ".config", "mise", "conf.d", "snshah.toml");
      const toml = existsSync(miseFile) ? await readFile(miseFile, "utf8") : "";
      check(
        "apply wrote snshah's mise tool list with the default tools",
        [
          "direnv",
          "gh",
          "ripgrep",
          "fd",
          "bat",
          "fzf",
          "jq",
          "yq",
          "delta",
        ].every((t) => toml.includes(`"${t}" = "latest"`)),
        toml,
      );
      check(
        "apply installed the default tools through mise",
        existsSync(join(home, ".local", "share", "mise", "shims", "direnv")) &&
          existsSync(join(home, ".local", "share", "mise", "shims", "rg")),
      );
      const d = json<{
        checks: Array<{ check: string; version?: string }>;
        advice: string[];
      }>(cli(["doctor", "--json"]));
      check(
        "doctor finds mise-installed tools and shows their versions",
        ["direnv", "gh", "rg", "fd", "bat", "delta"].every(
          (t) => d?.checks.find((c) => c.check === t)?.version === "1.2.3",
        ) && !d?.advice.some((a) => /fd-find|git-delta|direnv/.test(a)),
        JSON.stringify(d?.checks.filter((c) => c.version)),
      );
      for (const shell of ["bash", "zsh", "fish", "pwsh"]) {
        const out = cli(["shell", shell]).out;
        check(
          `shell ${shell}: activates mise, hooks direnv, tells servers the OS`,
          out.includes(`activate ${shell}`) &&
            out.includes(`direnv hook ${shell}`) &&
            out.includes("LC_SNSHAH_OS"),
        );
      }

      // A private profile can leave a tool out and add one.
      const profileDir = join(home, ".config", "snshah", "profile.d");
      await mkdir(profileDir, { recursive: true });
      const tweak = join(profileDir, "60-tools.ts");
      await writeFile(
        tweak,
        'export const selector = { kind: "always" };\nexport const config = { tools: { delta: false, node: "20" } };\n',
      );
      const t1 = cli(["apply", "--yes"]);
      const toml2 = await readFile(miseFile, "utf8");
      check(
        "tools: false leaves a tool out and a new tool is added and installed",
        t1.code === 0 &&
          !toml2.includes('"delta"') &&
          toml2.includes('"node" = "20"') &&
          existsSync(join(home, ".local", "share", "mise", "shims", "node")),
        t1.out + t1.err + toml2,
      );
      check(
        "apply with a tools change is idempotent",
        cli(["apply", "--yes"]).out.includes("No changes needed."),
      );
      await writeFile(
        tweak,
        'export const selector = { kind: "always" };\nexport const config = { toolManager: { kind: "none" } };\n',
      );
      const off = cli(["plan", "--json"]);
      const offSteps = json<Array<{ kind: string; label: string }>>(off) ?? [];
      check(
        'toolManager "none" plans removing snshah\'s tool list only',
        offSteps.some(
          (x) => x.kind === "remove" && x.label.includes("mise tool list"),
        ) && !offSteps.some((x) => x.kind === "tools"),
        off.out,
      );
      const offOut = cli(["shell", "bash"]).out;
      check(
        'toolManager "none" stops emitting mise activation',
        !offOut.includes("activate bash") && offOut.includes("direnv hook"),
      );
      cli(["apply", "--yes"]);
      check(
        'toolManager "none" removed the tool list and left your own mise config alone',
        !existsSync(miseFile),
      );
      await rm(tweak);
      cli(["apply", "--yes"]);
      check(
        "removing the profile brings the tool list back",
        existsSync(miseFile) &&
          cli(["apply", "--yes"]).out.includes("No changes needed."),
      );
      const bad = join(profileDir, "61-bad.ts");
      await writeFile(
        bad,
        'export const selector = { kind: "always" };\nexport const config = { tools: { "x y": "latest" } };\n',
      );
      const badRun = cli(["plan"]);
      check(
        "an invalid tool name is refused",
        badRun.code !== 0 && (badRun.out + badRun.err).includes("tools"),
        badRun.out + badRun.err,
      );
      await rm(bad);
    }

    // GitHub sign-in: shown by the greeting once a day until done.
    {
      const ghHome = join(root, "gh-home");
      await mkdir(ghHome);
      const ge = {
        ...baseEnv(ghHome),
        SNSHAH_GREET: "1",
      };
      cli(["apply", "--yes"], undefined, ge);
      const first = cli(["shell", "bash", "--greet"], undefined, ge);
      check(
        "the first greeting leaves the GitHub step to doctor, with no second reminder",
        !first.err.includes("snshah: GitHub is not signed in"),
        first.err,
      );
      const a = cli(["shell", "bash", "--greet"], undefined, ge);
      check(
        "greeting reminds about GitHub sign-in with the command to run",
        a.err.includes("GitHub is not signed in") &&
          a.err.includes("gh auth login"),
        a.err,
      );
      const b = cli(["shell", "bash", "--greet"], undefined, ge);
      check(
        "the GitHub reminder shows once a day",
        !b.err.includes("GitHub is not signed in"),
        b.err,
      );
      const signed = join(root, "gh-signed");
      await mkdir(signed);
      const se = {
        ...baseEnv(signed),
        SNSHAH_GREET: "1",
        GH_TOKEN: "x",
      };
      const c = cli(["shell", "bash", "--greet"], undefined, se);
      check(
        "no GitHub reminder when a token is present",
        !c.err.includes("GitHub is not signed in"),
        c.err,
      );
    }

    // ssh: keys, authorizing, copy instructions, hosts, the password-login hint.
    {
      const sshHome = join(root, "ssh-home");
      await mkdir(sshHome);
      const se = baseEnv(sshHome);
      const key1 = publicKeyLine("alice@laptop");
      const key2 = publicKeyLine("bob@desktop");
      const parsed = mod.parsePublicKey(key1);
      check(
        "parsePublicKey reads a key and its comment; fingerprint is SHA256",
        parsed?.type === "ssh-ed25519" &&
          parsed.comment === "alice@laptop" &&
          /^SHA256:[A-Za-z0-9+/]{43}$/.test(mod.fingerprint(parsed.blob)),
      );
      check(
        "parsePublicKey refuses a key whose blob does not match its type",
        mod.parsePublicKey("ssh-rsa " + key1.split(" ")[1]) === undefined &&
          mod.parsePublicKey("not a key") === undefined,
      );
      check(
        "parsePublicKey keeps authorized_keys options apart from the key",
        mod.parsePublicKey(`from="10.0.0.0/8",no-pty ${key1}`)?.options ===
          'from="10.0.0.0/8",no-pty',
      );
      const sess0 = cli(["ssh", "authorized"], undefined, se);
      check(
        "ssh authorized with no keys says so",
        sess0.code === 0 && sess0.out.includes("No keys"),
        sess0.out + sess0.err,
      );
      const a1 = cli(["ssh", "authorize", "--key", key1], undefined, se);
      const a2 = cli(["ssh", "authorize", "--key", key1], undefined, se);
      check(
        "ssh authorize adds a key once and is a no-op the second time",
        a1.out.includes("Added 1") &&
          a2.out.includes("No changes needed.") &&
          a2.out.includes("already there"),
        a1.out + a2.out + a1.err + a2.err,
      );
      const file = join(sshHome, ".ssh", "authorized_keys");
      const again = cli(
        ["ssh", "authorize", "--key", key1.replace("alice@laptop", "renamed")],
        undefined,
        se,
      );
      check(
        "a key already authorized is recognized by the key, not its comment",
        again.out.includes("No changes needed.") &&
          (await readFile(file, "utf8")).trim().split("\n").length === 1,
      );
      await writeFile(
        join(root, "more.pub"),
        `${key2}\n# a comment\nnot a key\n`,
      );
      const a3 = cli(
        ["ssh", "authorize", "--file", join(root, "more.pub")],
        undefined,
        se,
      );
      check(
        "ssh authorize --file adds valid keys and skips the rest",
        a3.out.includes("Added 1") && a3.out.includes("not valid"),
        a3.out + a3.err,
      );
      if (process.platform !== "win32") {
        const modes = [
          (await stat(join(sshHome, ".ssh"))).mode & 0o777,
          (await stat(file)).mode & 0o777,
        ];
        check(
          "authorized_keys is 0600 in a 0700 directory",
          modes[0] === 0o700 && modes[1] === 0o600,
          modes.map((m) => m.toString(8)).join(" "),
        );
      }
      const list = json<Array<{ fingerprint: string; comment: string }>>(
        cli(["ssh", "authorized", "--json"], undefined, se),
      );
      check(
        "ssh authorized --json lists fingerprints and comments",
        list?.length === 2 &&
          list[0]!.comment === "alice@laptop" &&
          list[1]!.fingerprint.startsWith("SHA256:"),
      );
      check(
        "ssh authorize needs exactly one source",
        cli(["ssh", "authorize"], undefined, se).code === 2,
      );
      check(
        "ssh authorize refuses a bad GitHub user name",
        cli(["ssh", "authorize", "--github", "-bad"], undefined, se).code === 2,
      );

      // keys: list, fingerprints, loose permissions.
      await writeFile(join(sshHome, ".ssh", "id_ed25519.pub"), key1 + "\n");
      await writeFile(join(sshHome, ".ssh", "id_ed25519"), "private\n", {
        mode: 0o644,
      });
      if (process.platform !== "win32")
        await chmod(join(sshHome, ".ssh", "id_ed25519"), 0o644);
      const keys = cli(["ssh", "keys"], undefined, se);
      check(
        "ssh keys shows the public key and warns about a world-readable private key",
        keys.out.includes(key1) &&
          (process.platform === "win32" || keys.out.includes("chmod 600")) &&
          !keys.out.includes("private\n"),
        keys.out + keys.err,
      );
      check(
        "ssh new leaves an existing key alone",
        cli(["ssh", "new"], undefined, se).out.includes("already exists"),
      );

      // copy: instructions for each OS, filled in from the target.
      const t = mod.parseTarget("shah@example.invalid", "me", 2222);
      const linux = mod
        .copyCommands("linux", t)
        .map((x: { command: string }) => x.command)
        .join("\n");
      const mac = mod
        .copyCommands("macos", t)
        .map((x: { command: string }) => x.command)
        .join("\n");
      const win = mod
        .copyCommands("windows", t)
        .map((x: { command: string }) => x.command)
        .join("\n");
      check(
        "copy instructions: ssh-copy-id on Linux and macOS, PowerShell on Windows, port included",
        linux.includes(
          "ssh-copy-id -i ~/.ssh/id_ed25519.pub -p 2222 shah@example.invalid",
        ) &&
          mac.includes("--apple-use-keychain") &&
          win.includes("Get-Content") &&
          win.includes("ssh -p 2222 shah@example.invalid") &&
          !linux.includes("Get-Content"),
        win,
      );
      check(
        "parseTarget refuses option-looking input",
        (() => {
          try {
            mod.parseTarget("-oProxyCommand=evil@host", "me");
            return false;
          } catch {
            return true;
          }
        })() &&
          (() => {
            try {
              mod.parseTarget("me@-oProxyCommand=evil", "me");
              return false;
            } catch {
              return true;
            }
          })(),
      );
      const ce = { ...se, SSH_CONNECTION: "192.0.2.10 50000 192.0.2.20 2222" };
      const all = cli(["ssh", "copy"], undefined, ce);
      check(
        "ssh copy on a server uses the address the client connected to and shows all three OSes",
        all.out.includes("@192.0.2.20") &&
          all.out.includes("-p 2222") &&
          all.out.includes("Linux") &&
          all.out.includes("macOS") &&
          all.out.includes("Windows"),
        all.out + all.err,
      );
      const smart = cli(["ssh", "copy"], undefined, {
        ...ce,
        LC_SNSHAH_OS: "macos",
      });
      check(
        "ssh copy shows only the client's OS when the client told us",
        smart.out.includes("macOS") &&
          !smart.out.includes("Windows (PowerShell)") &&
          smart.out.includes("sent by the client"),
        smart.out,
      );
      const iterm = mod.detectClientOs({ LC_TERMINAL: "iTerm2" });
      check(
        "iTerm2 identifies a macOS client; nothing identifies nothing",
        iterm?.os === "macos" && mod.detectClientOs({}) === undefined,
      );
      check(
        "ssh copy --run refuses on a server (no target)",
        cli(["ssh", "copy", "--run"], undefined, ce).code === 2,
      );

      // hosts: one marked block each, idempotent.
      const h1 = cli(
        [
          "ssh",
          "host",
          "add",
          "nas",
          "me@nas.example.invalid",
          "-p",
          "2200",
          "-i",
          "~/.ssh/id_ed25519",
        ],
        undefined,
        se,
      );
      const h2 = cli(
        [
          "ssh",
          "host",
          "add",
          "nas",
          "me@nas.example.invalid",
          "-p",
          "2200",
          "-i",
          "~/.ssh/id_ed25519",
        ],
        undefined,
        se,
      );
      const cfg = await readFile(join(sshHome, ".ssh", "config"), "utf8");
      check(
        "ssh host add writes one block and is a no-op when repeated",
        h1.code === 0 &&
          h2.out.includes("No changes needed.") &&
          cfg.includes("Host nas") &&
          cfg.includes("Port 2200") &&
          cfg.includes("SendEnv LC_SNSHAH_OS") &&
          cfg.split("# >>> snshah ssh host nas >>>").length === 2,
        h1.out + h2.out + cfg,
      );
      check(
        "ssh host list shows it",
        cli(["ssh", "host", "list"], undefined, se).out.includes("nas"),
      );
      check(
        "ssh host add refuses an option-looking target",
        cli(["ssh", "host", "add", "x", "-oProxyCommand=evil@h"], undefined, se)
          .code !== 0,
      );
      check(
        "ssh host remove removes only that block",
        await (async () => {
          await writeFile(
            join(sshHome, ".ssh", "config"),
            "Host mine\n    User me\n\n" + cfg,
          );
          cli(["ssh", "host", "remove", "nas"], undefined, se);
          const after = await readFile(join(sshHome, ".ssh", "config"), "utf8");
          return after.includes("Host mine") && !after.includes("Host nas");
        })(),
      );

      // sshd settings (pure parsing): first value wins, Include is followed, Match stops it.
      const files: Record<string, string> = {
        "/etc/ssh/sshd_config":
          "Include /etc/ssh/sshd_config.d/*.conf\nPasswordAuthentication yes\nPermitRootLogin prohibit-password\nMatch User x\nPasswordAuthentication yes\n",
        "/etc/ssh/sshd_config.d/10-a.conf": "PasswordAuthentication no\n",
      };
      const sshd = mod.parseSshdConfig(
        (path: string) => files[path],
        (dir: string) =>
          dir === "/etc/ssh/sshd_config.d" ? ["10-a.conf", "README"] : [],
      );
      check(
        "sshd config parsing: included file first, first value wins",
        sshd.get("passwordauthentication") === "no" &&
          sshd.get("permitrootlogin") === "prohibit-password",
      );
      check(
        "a Match block that reopens passwords is reported, not mistaken for keys only",
        sshd.get("match-password") === "User x",
      );
      const hard = cli(["ssh", "harden"], undefined, se);
      check(
        "ssh harden only prints advice",
        hard.code === 0 && hard.out.includes("never runs it"),
        hard.out + hard.err,
      );

      // How you logged in: log lines, then authorized keys.
      const logText = [
        "Nov 27 12:00:00 h sshd[1]: Accepted publickey for snshah from 192.0.2.9 port 40000 ssh2: ED25519 SHA256:x",
        "Nov 27 12:01:00 h sshd[2]: Accepted password for snshah from 192.0.2.10 port 50000 ssh2",
        "Nov 27 12:02:00 h sshd[3]: Accepted keyboard-interactive/pam for snshah from 192.0.2.11 port 50001 ssh2",
      ].join("\n");
      check(
        "login method is read from the sshd log line for that exact connection",
        mod.methodFromLog(logText, "snshah", "192.0.2.10", 50000) ===
          "password" &&
          mod.methodFromLog(logText, "snshah", "192.0.2.9", 40000) ===
            "publickey" &&
          mod.methodFromLog(logText, "snshah", "192.0.2.11", 50001) ===
            "keyboard-interactive" &&
          mod.methodFromLog(logText, "snshah", "192.0.2.10", 50099) ===
            undefined,
      );

      // The greeting: hint on a password login, once per connection.
      const hintHome = join(root, "hint-home");
      await mkdir(hintHome);
      const hintEnv = {
        ...baseEnv(hintHome),
        SNSHAH_GREET: "1",
        SSH_CONNECTION: "192.0.2.10 50000 192.0.2.20 22",
        USER: "snshah",
      };
      cli(["apply", "--yes"], undefined, hintEnv);
      const plainShell = cli(["shell", "bash"], undefined, hintEnv);
      const h = cli(["shell", "bash", "--greet"], undefined, hintEnv);
      check(
        "a password login (no authorized keys) shows the SSH key hint on stderr only",
        h.code === 0 &&
          h.err.includes("signed in with a password") &&
          h.err.includes("snshah ssh copy") &&
          h.out === plainShell.out,
        h.err,
      );
      const via = cli(["ssh", "copy"], undefined, hintEnv);
      check(
        "ssh copy shows how to see and create the key only when missing, per OS",
        via.out.includes("ls ~/.ssh/*.pub") &&
          via.out.includes("test -f ~/.ssh/id_ed25519.pub ||") &&
          via.out.includes("Get-ChildItem") &&
          via.out.includes("Test-Path"),
        via.out,
      );
      check(
        "the hint shows once per connection",
        !cli(["shell", "bash", "--greet"], undefined, hintEnv).err.includes(
          "signed in with a password",
        ),
      );
      const other = cli(["shell", "bash", "--greet"], undefined, {
        ...hintEnv,
        SSH_CONNECTION: "192.0.2.10 50001 192.0.2.20 22",
      });
      check(
        "a new connection shows it again",
        other.err.includes("signed in with a password"),
      );
      check(
        "the hint is short: it names the command, not the per-OS steps",
        other.err.includes("snshah ssh copy") &&
          !other.err.includes("ssh-copy-id") &&
          other.err.trim().split("\n").length <= 6,
        other.err,
      );
      const quietHome = join(root, "hint-quiet");
      await mkdir(quietHome);
      const quietEnv = {
        ...hintEnv,
        ...baseEnv(quietHome),
        SNSHAH_GREET: "1",
        SNSHAH_SSH_HINT: "0",
      };
      check(
        "SNSHAH_SSH_HINT=0 silences it",
        !cli(["shell", "bash", "--greet"], undefined, quietEnv).err.includes(
          "signed in with a password",
        ),
      );
      const keyedHome = join(root, "hint-keyed");
      await mkdir(join(keyedHome, ".ssh"), { recursive: true });
      await writeFile(join(keyedHome, ".ssh", "authorized_keys"), key1 + "\n");
      const keyedEnv = { ...hintEnv, ...baseEnv(keyedHome), SNSHAH_GREET: "1" };
      check(
        "no hint when this account already has authorized keys and the login method is unknown",
        !cli(["shell", "bash", "--greet"], undefined, keyedEnv).err.includes(
          "signed in with a password",
        ),
      );
      const dp = cli(["doctor"], undefined, hintEnv);
      check(
        "doctor over SSH after a password login points to snshah ssh copy, every time",
        dp.out.includes("logged in with a password") &&
          dp.out.includes("snshah ssh copy") &&
          !dp.out.includes("ssh-copy-id"),
        dp.out,
      );
      const dk = cli(["doctor"], undefined, keyedEnv);
      check(
        "doctor over SSH with an unknown login method gives the exact sshd line",
        dk.out.includes("ExposeAuthInfo yes") &&
          dk.out.includes("systemctl reload") &&
          dk.out.includes("log out and back in"),
        dk.out,
      );
      check(
        "the update notice has color on a terminal and none off it",
        mod
          .updateNotice(
            {
              kind: "checked",
              at: "x",
              ref: "main",
              latest: "b".repeat(40),
              installed: "a".repeat(40),
            },
            "a".repeat(40),
            true,
          )
          ?.includes("\x1b[") === true &&
          !mod
            .updateNotice(
              {
                kind: "checked",
                at: "x",
                ref: "main",
                latest: "b".repeat(40),
                installed: "a".repeat(40),
              },
              "a".repeat(40),
            )
            ?.includes("\x1b["),
      );
      const localHome = join(root, "hint-local");
      await mkdir(localHome);
      const localEnv = { ...baseEnv(localHome), SNSHAH_GREET: "1" };
      check(
        "no hint on a local console",
        !cli(["shell", "bash", "--greet"], undefined, localEnv).err.includes(
          "signed in with a password",
        ),
      );
      const st = cli(["ssh", "status"], undefined, hintEnv);
      check(
        "ssh status reports the password login and the next step",
        st.code === 0 &&
          st.out.includes("with a password") &&
          st.out.includes("To copy a key into") &&
          st.out.includes("ssh-copy-id"),
        st.out + st.err,
      );
    }

    // Update notices only count for the install they were checked against.
    {
      const a = "a".repeat(40);
      const b = "b".repeat(40);
      const at = new Date().toISOString();
      const checked = (installed: string, latest: string) => ({
        kind: "checked" as const,
        at,
        ref: "main",
        latest,
        installed,
      });
      check(
        "an update notice shows when the check was made against this install",
        mod.updateNotice(checked(a, b), a)?.includes("update available") ===
          true,
      );
      check(
        "no notice after an upgrade made the cached check stale, and it is due again",
        mod.updateNotice(checked(a, a), b) === undefined &&
          mod.updateDue(checked(a, a), b, Date.now()) === true &&
          mod.updateDue(checked(b, b), b, Date.now()) === false,
      );
    }

    // ux fonts: your word, what an SSH client sends, and local evidence.
    {
      check(
        "Nerd Font names are recognized",
        mod.isNerdFontName("MesloLGS NF Regular (TrueType)") &&
          mod.isNerdFontName("CaskaydiaCove Nerd Font Mono") &&
          !mod.isNerdFontName("Cascadia Code") &&
          !mod.isNerdFontName("Consolas"),
      );
      check(
        "terminalFace reads Windows Terminal settings, comments and all",
        mod.terminalFace(
          '{ // fonts\n "profiles": { "defaults": { "font": { "face": "MesloLGS NF" } } } }',
        ) === "MesloLGS NF" &&
          mod.terminalFace(
            '{"profiles":{"defaults":{"fontFace":"Consolas"}}}',
          ) === "Consolas" &&
          mod.terminalFace("{}") === undefined,
      );
      const win = (fonts: string[], settings: string) =>
        mod.windowsFontEvidence(JSON.stringify({ fonts, settings })).kind;
      check(
        "Windows evidence: none, wrong face, right face, unreadable",
        win(["Consolas (TrueType)"], "") === "no" &&
          win(["MesloLGS NF Regular (TrueType)"], '{"face":"Consolas"}') ===
            "no" &&
          win(["MesloLGS NF Regular (TrueType)"], '{"face":"MesloLGS NF"}') ===
            "yes" &&
          win(["MesloLGS NF Regular (TrueType)"], "") === "yes" &&
          mod.windowsFontEvidence("garbage").kind === "unknown",
      );
      const fh = join(root, "fonts-home");
      await mkdir(fh);
      const fe = baseEnv(fh);
      const f0 = cli(["ux", "fonts"], undefined, fe);
      check(
        "ux fonts starts as no or unknown, never installed",
        f0.code === 0 && !f0.out.includes("Nerd Font: installed"),
        f0.out + f0.err,
      );
      const sshEnv = {
        ...fe,
        SSH_CONNECTION: "203.0.113.9 50000 192.0.2.1 22",
      };
      const d0 = cli(["doctor", "--json"], undefined, sshEnv);
      const fontRow = (r: Result) =>
        (
          JSON.parse(r.out).checks as {
            check: string;
            status: string;
            detail: string;
          }[]
        ).find((c) => c.check === "fonts");
      check(
        "over SSH with no answer, doctor says fonts are unknown",
        fontRow(d0)?.detail.startsWith("Nerd Font unknown") === true,
        d0.out,
      );
      check(
        "an SSH client's LC_SNSHAH_FONTS is believed",
        fontRow(
          cli(["doctor", "--json"], undefined, {
            ...sshEnv,
            LC_SNSHAH_FONTS: "installed",
          }),
        )?.status === "ok",
      );
      const s1 = cli(["ux", "fonts", "installed"], undefined, fe);
      check(
        "ux fonts installed records it",
        s1.code === 0 && s1.out.includes("Recorded"),
        s1.out + s1.err,
      );
      const s2 = cli(["ux", "fonts", "installed"], undefined, fe);
      check(
        "ux fonts installed again changes nothing",
        s2.out.includes("No changes needed"),
        s2.out,
      );
      check(
        "doctor then shows fonts ok, because you said so",
        fontRow(cli(["doctor", "--json"], undefined, fe))?.status === "ok",
      );
      const st = JSON.parse(
        await readFile(join(fh, ".local/state/snshah/state.json"), "utf8"),
      );
      check(
        "state.json holds the typed answer",
        st.fonts?.kind === "installed" && st.version === 1,
        JSON.stringify(st),
      );
      const sh1 = cli(["shell", "bash"], undefined, fe);
      check(
        "shell init exports LC_SNSHAH_FONTS only after you said so",
        sh1.out.includes("LC_SNSHAH_FONTS") &&
          !cli(
            ["shell", "bash"],
            undefined,
            baseEnv(join(root, "fonts-home-2")),
          ).out.includes("LC_SNSHAH_FONTS"),
      );
      const m = cli(["ux", "fonts", "missing"], undefined, fe);
      check(
        "ux fonts missing flips it and doctor warns with the install command",
        m.code === 0 &&
          fontRow(cli(["doctor", "--json"], undefined, fe))?.status ===
            "warn" &&
          cli(["doctor"], undefined, fe).out.includes(
            "oh-my-posh font install",
          ),
      );
      const r1 = cli(["ux", "fonts", "reset"], undefined, fe);
      const r2 = cli(["ux", "fonts", "reset"], undefined, fe);
      check(
        "ux fonts reset forgets, and twice is a no-op",
        r1.code === 0 && r2.out.includes("No changes needed"),
        r1.out + r2.out,
      );
      check(
        "ux fonts install prints the command without doing anything",
        cli(["ux", "fonts", "install"], undefined, fe).out.includes(
          "oh-my-posh font install Meslo",
        ),
      );
    }

    // Git checkout registry against a local fixture.
    const src = join(root, "fixture-src");
    await mkdir(src);
    sh(["git", "init", "--quiet"], src);
    await writeFile(join(src, "README.md"), "fixture\n");
    sh(["git", "add", "."], src);
    sh(["git", "commit", "--quiet", "-m", "first"], src);
    const bare = join(root, "fixture.git");
    sh(["git", "clone", "--quiet", "--bare", src, bare]);
    sh(["git", "remote", "add", "origin", bare], src);
    const g1 = cli(["git", "add", bare]);
    check(
      "git add registers and clones",
      g1.code === 0 && g1.out.includes("Registered"),
      g1.out + g1.err,
    );
    const g2 = cli(["git", "add", bare]);
    check(
      "git add again is a no-op",
      g2.code === 0 &&
        g2.out.includes("already registered") &&
        g2.out.includes("present"),
      g2.out + g2.err,
    );
    const expected = join(home, "workspaces", "local", "fixture");
    check(
      "git path follows $WORKSPACES_HOME/local/<name>",
      cli(["git", "path", "fixture"]).out.trim() === expected,
    );
    const list = json<Array<{ name: string; state: string }>>(
      cli(["git", "list", "--json"]),
    );
    check(
      "git list shows a clean checkout",
      list?.find((r) => r.name === "fixture")?.state === "clean",
    );
    check(
      "shah/shah is registered by default under github.com/shah/shah",
      list?.find((r) => r.name === "shah")?.state === "missing" &&
        cli(["git", "path", "shah"]).out.trim() ===
          join(home, "workspaces", "github.com", "shah", "shah"),
    );
    check(
      "git clone twice is safe",
      cli(["git", "clone", "fixture"]).code === 0 &&
        cli(["git", "clone", "fixture"]).out.includes("present"),
    );
    await writeFile(join(src, "NEXT.md"), "second\n");
    sh(["git", "add", "."], src);
    sh(["git", "commit", "--quiet", "-m", "second"], src);
    sh(["git", "push", "--quiet", "origin", "main"], src);
    const u1 = cli(["git", "update", "--all"]);
    check(
      "git update fast-forwards",
      u1.code === 0 && u1.out.includes("fast-forwarded"),
      u1.out + u1.err,
    );
    const u2 = cli(["git", "update", "--all"]);
    check(
      "git update again is up to date",
      u2.code === 0 && u2.out.includes("already up to date"),
      u2.out + u2.err,
    );
    const gh = cli(["git", "add", "shah/shah", "--no-clone"]);
    check(
      "owner/repo maps to <host>/<owner>/<repo>",
      gh.code === 0 &&
        cli(["git", "path", "shah"]).out.trim() ===
          join(home, "workspaces", "github.com", "shah", "shah"),
      gh.out + gh.err,
    );
    const withRoot = cli(["git", "path", "shah"], undefined, {
      ...env,
      WORKSPACES_HOME: join(root, "elsewhere"),
    });
    check(
      "$WORKSPACES_HOME overrides the root",
      withRoot.out.trim() ===
        join(root, "elsewhere", "github.com", "shah", "shah"),
    );
    check(
      "git remove",
      cli(["git", "remove", "fixture"]).out.includes("Removed"),
    );
    check(
      "git remove again is a no-op",
      cli(["git", "remove", "fixture"]).out.includes("not registered"),
    );
    const builtIn = cli(["git", "remove", "shah"]);
    check(
      "git remove refuses the built-in shah/shah entry",
      builtIn.code !== 0 && (builtIn.out + builtIn.err).includes("built in"),
      builtIn.out + builtIn.err,
    );
    check(
      "apply after git changes still has no changes",
      cli(["apply", "--yes"]).out.includes("No changes needed."),
    );

    // profile.d: selectors, typed merge, hooks, explain, retirement.
    const factsFile = async (name: string, facts: Record<string, unknown>) => {
      const path = join(root, `facts-${name}.json`);
      await writeFile(path, JSON.stringify(facts));
      return path;
    };
    const machines: Record<
      string,
      {
        facts: Record<string, unknown>;
        expect: string[];
        shell: string;
        has: string[];
        lacks?: string[];
      }
    > = {
      fedora: {
        facts: {
          platform: "linux",
          distro: ["fedora"],
          omarchy: false,
          hostname: "f",
          machine: "0000000000000001",
          commands: [],
        },
        expect: ["20-fedora"],
        shell: "bash",
        has: ["dnfu"],
      },
      debian: {
        facts: {
          platform: "linux",
          distro: ["debian"],
          omarchy: false,
          hostname: "d",
          machine: "0000000000000002",
          commands: ["batcat", "fdfind"],
        },
        expect: ["20-debian-bat", "20-debian-fd"],
        shell: "bash",
        has: ["batcat", "fdfind"],
      },
      "debian-with-bat": {
        facts: {
          platform: "linux",
          distro: ["ubuntu", "debian"],
          omarchy: false,
          hostname: "u",
          machine: "0000000000000003",
          commands: ["batcat", "bat"],
        },
        expect: [],
        shell: "bash",
        has: [],
        lacks: ["batcat"],
      },
      omarchy: {
        facts: {
          platform: "linux",
          distro: ["arch"],
          omarchy: true,
          hostname: "o",
          machine: "0000000000000004",
          commands: [],
        },
        expect: ["10-omarchy"],
        shell: "zsh",
        has: [join(home, "Work")],
      },
      macos: {
        facts: {
          platform: "macos",
          distro: [],
          omarchy: false,
          hostname: "m",
          machine: "0000000000000005",
          commands: [],
        },
        expect: ["30-macos"],
        shell: "zsh",
        has: ["/opt/homebrew/bin"],
      },
      wsl: {
        facts: {
          platform: "wsl",
          distro: ["ubuntu", "debian"],
          omarchy: false,
          hostname: "w",
          machine: "0000000000000006",
          commands: [],
        },
        expect: ["30-wsl"],
        shell: "bash",
        has: ["clip.exe"],
      },
      windows: {
        facts: {
          platform: "windows",
          distro: [],
          omarchy: false,
          hostname: "win",
          machine: "0000000000000007",
          commands: [],
        },
        expect: ["30-windows"],
        shell: "pwsh",
        has: ["Get-Command"],
      },
    };
    for (const [name, m] of Object.entries(machines)) {
      const e = { ...env, SNSHAH_FACTS: await factsFile(name, m.facts) };
      const explain = json<{
        profiles: Array<{ id: string; origin: string; matched: boolean }>;
      }>(cli(["plan", "--explain", "--json"], undefined, e));
      const matched = (explain?.profiles ?? [])
        .filter((p) => p.matched && p.origin === "repo")
        .map((p) => p.id);
      check(
        `profile.d on ${name}: matches ${m.expect.join(", ") || "nothing"}`,
        JSON.stringify(matched) === JSON.stringify(m.expect),
        JSON.stringify(matched),
      );
      const out = cli(["shell", m.shell], undefined, e).out;
      check(
        `profile.d on ${name}: ${m.shell} init reflects it`,
        m.has.every((x) => out.includes(x)) &&
          (m.lacks ?? []).every((x) => !out.includes(x)),
        out,
      );
    }
    const winBash = cli(["shell", "bash"], undefined, {
      ...env,
      SNSHAH_FACTS: join(root, "facts-windows.json"),
    }).out;
    check(
      "pwsh-only alias stays out of bash",
      !winBash.includes("Get-Command"),
    );
    const viaAs = cli([
      "plan",
      "--explain",
      "--json",
      "--as",
      join(root, "facts-fedora.json"),
    ]);
    check(
      "plan --as previews another machine",
      viaAs.out.includes("20-fedora") && /"matched": true/.test(viaAs.out),
      viaAs.out + viaAs.err,
    );
    const who = json<{ platform: string; machine: string }>(
      cli(["whoami", "--json"]),
    );
    check(
      "whoami prints facts with a 16-hex fingerprint",
      !!who && /^([0-9a-f]{16}|unknown)$/.test(who.machine),
    );

    let repoHostname = false;
    try {
      mod.validateSelector({ kind: "hostname", is: "box" }, "repo");
    } catch {
      repoHostname = true;
    }
    let privateHostname = true;
    try {
      mod.validateSelector(
        { kind: "all", of: [{ kind: "hostname", is: "box" }] },
        "private",
      );
    } catch {
      privateHostname = false;
    }
    check(
      "hostname selectors are refused in the repo, allowed in private",
      repoHostname && privateHostname,
    );
    const merged = mod.mergeConfig(
      {
        path: ["a"],
        aliases: { x: "1", y: "1" },
        prompt: { kind: "none" },
        repositories: [{ name: "r", source: "one" }],
      },
      {
        path: ["a", "b"],
        aliases: { x: "2" },
        prompt: { kind: "oh-my-posh" },
        repositories: [{ name: "r", source: "two" }],
      },
    );
    check(
      "typed merge: lists join, records overlay, unions replace whole",
      JSON.stringify(merged.path) === '["a","b"]' &&
        merged.aliases.x === "2" &&
        merged.aliases.y === "1" &&
        JSON.stringify(merged.prompt) === '{"kind":"oh-my-posh"}' &&
        merged.repositories.length === 1 &&
        merged.repositories[0].source === "two",
    );

    if (process.platform !== "win32") {
      const pdir = join(home, ".config", "snshah", "profile.d");
      const write = async (file: string, text: string) => {
        await writeFile(join(pdir, file), text, { mode: 0o600 });
        await chmod(join(pdir, file), 0o600);
      };
      const hookLog = join(home, "hook.log");
      await write(
        "50-this-machine.ts",
        `import type { Contribution, Hook, Selector } from "../snshah.auto.d.ts";
export const selector = { kind: "hostname", is: "test-box" } satisfies Selector;
export const config = { aliases: { gs: "git status" } } satisfies Contribution;
export const hooks = [
  { kind: "file", path: "~/.config/demo/hello.txt", content: "hello\\n" },
  { kind: "block", path: "~/.bashrc", content: "export FROM_PROFILE=1" },
  {
    kind: "command",
    phase: "after-apply",
    run: ["sh", "-c", 'printf "%s|%s|%s|%s\\\\n" "$PASSED" "$SETV" "$DEMO_CMD_TOKEN" "\${NOT_PASSED-unset}" >> "$HOME/hook.log"; touch "$HOME/hook.done"'],
    unless: ["test", "-f", ${JSON.stringify(join(home, "hook.done"))}],
    env: { pass: ["PASSED"], set: { SETV: "literal" }, secrets: ["DEMO_CMD_TOKEN"] },
  },
] satisfies Hook[];
`,
      );
      const box = {
        ...env,
        PASSED: "parent",
        NOT_PASSED: "leak",
        SNSHAH_FACTS: await factsFile("box", {
          platform: "linux",
          distro: ["debian"],
          omarchy: false,
          hostname: "test-box.example.invalid",
          machine: "00000000000000aa",
          commands: [],
        }),
      };
      const h1 = cli(["apply", "--yes"], undefined, box);
      check("private profile hooks apply", h1.code === 0, h1.out + h1.err);
      const log1 = existsSync(hookLog) ? await readFile(hookLog, "utf8") : "";
      check(
        "command hook env: pass, set and secret reach it; others don't",
        log1 === "parent|literal|cmd-secret-value|unset\n",
        log1,
      );
      check(
        "file hook wrote its file",
        existsSync(join(home, ".config", "demo", "hello.txt")),
      );
      const rc = await readFile(join(home, ".bashrc"), "utf8");
      check(
        "block hook and startup block share ~/.bashrc",
        rc.includes("export FROM_PROFILE=1") &&
          rc.split("# >>> snshah profile 50-this-machine >>>").length === 2 &&
          rc.split("# >>> snshah shell >>>").length === 2,
        rc,
      );
      const h2 = cli(["apply", "--yes"], undefined, box);
      check(
        "second apply with hooks reports no changes",
        h2.out.includes("No changes needed."),
        h2.out + h2.err,
      );
      check(
        "command hook ran exactly once",
        (await readFile(hookLog, "utf8")) === log1,
      );
      const ex = json<{ overrides: Array<{ key: string; to: string }> }>(
        cli(["plan", "--explain", "--json"], undefined, box),
      );
      check(
        "explain shows the private profile overriding an alias",
        !!ex?.overrides.some(
          (o) => o.key === "aliases.gs" && o.to === "private:50-this-machine",
        ),
        JSON.stringify(ex?.overrides),
      );
      check(
        "other machines skip the hostname profile",
        !cli(["shell", "bash"], undefined, env).out.includes(
          "alias gs='git status'",
        ),
      );

      await write(
        "60-conflict.ts",
        `export const selector = { kind: "always" } as const;\nexport const hooks = [{ kind: "file", path: "~/.config/demo/hello.txt", content: "other" }] as const;\n`,
      );
      const clash = cli(["plan"], undefined, box);
      check(
        "two profiles writing one file stop plan",
        clash.code === 1 && clash.err.includes("already manages"),
        clash.out + clash.err,
      );
      await rm(join(pdir, "60-conflict.ts"));

      await write(
        "61-loop.ts",
        `export const selector = { kind: "always" } as const;\nexport const hooks = [{ kind: "command", phase: "before-apply", run: ["true"], unless: ["false"] }] as const;\n`,
      );
      const loop = cli(["apply", "--yes"], undefined, box);
      check(
        "a command hook that never converges fails apply",
        loop.code === 1 && loop.err.includes("still fails"),
        loop.out + loop.err,
      );
      await rm(join(pdir, "61-loop.ts"));

      await writeFile(
        join(pdir, "62-typo.ts"),
        `export const selector = { kind: "always" } as const;\nexport const hookz = [];\n`,
        { mode: 0o600 },
      );
      check(
        "an unknown profile export is an error",
        cli(["plan"], undefined, box).err.includes("hookz"),
      );
      await rm(join(pdir, "62-typo.ts"));

      await writeFile(
        join(pdir, "63-open.ts"),
        `export const selector = { kind: "always" } as const;\n`,
        { mode: 0o666 },
      );
      await chmod(join(pdir, "63-open.ts"), 0o666);
      check(
        "a group- or world-writable private profile is refused",
        cli(["plan"], undefined, box).err.includes("writable"),
      );
      await rm(join(pdir, "63-open.ts"));
      check(
        "apply after removing test profiles is clean",
        cli(["apply", "--yes"], undefined, box).out.includes(
          "No changes needed.",
        ),
      );
      await rm(join(pdir, "50-this-machine.ts"));
    }

    const retired = join(
      home,
      ".local",
      "share",
      "snshah",
      "profile.d",
      "99-retired.ts",
    );
    await writeFile(
      retired,
      `export const selector = { kind: "always" } as const;\n`,
    );
    const r1 = cli(["apply", "--yes"]);
    check(
      "a repo profile no longer shipped is removed",
      r1.code === 0 && !existsSync(retired),
      r1.out + r1.err,
    );
    check(
      "and the next apply is clean",
      cli(["apply", "--yes"]).out.includes("No changes needed."),
    );

    // doctor never installs; it only reports.
    const doc = json<{ checks: unknown[]; advice: string[] }>(
      cli(["doctor", "--json"]),
    );
    check("doctor reports checks", !!doc && doc.checks.length > 0);
    const docChecks =
      (doc as { checks?: Array<{ check: string; version?: string }> })
        ?.checks ?? [];
    check(
      "doctor reports a version for every tool it finds",
      ["bun", "git"].every((t) =>
        /^\d+(\.\d+)+$/.test(
          docChecks.find((c) => c.check === t)?.version ?? "",
        ),
      ),
      JSON.stringify(docChecks),
    );
    check(
      "parseVersion reads common --version formats",
      mod.parseVersion("git version 2.47.3") === "2.47.3" &&
        mod.parseVersion("jq-1.7.1") === "1.7.1" &&
        mod.parseVersion(
          "socat by Gerhard Rieger\nsocat version 1.8.0.3 on Jan",
        ) === "1.8.0.3" &&
        mod.parseVersion("0.60 (debian)") === "0.60",
    );

    // bootstrap.sh from this checkout, twice, in a fresh HOME.
    if (process.platform !== "win32" && Bun.which("sh")) {
      const bootHome = join(root, "boot-home");
      await mkdir(bootHome);
      const bootEnv = baseEnv(bootHome);
      const b1 = sh(["sh", join(workshop, "bootstrap.sh")], root, bootEnv);
      check(
        "bootstrap.sh (local) installs",
        b1.code === 0 && existsSync(join(bootHome, ".local", "bin", "snshah")),
        b1.out + b1.err,
      );
      const b2 = sh(["sh", join(workshop, "bootstrap.sh")], root, bootEnv);
      check(
        "bootstrap.sh (local) again reports no changes",
        b2.code === 0 && b2.out.includes("No changes needed."),
        b2.out + b2.err,
      );
      const viaLauncher = sh(
        [join(bootHome, ".local", "bin", "snshah"), "plan", "--json"],
        root,
        bootEnv,
      );
      check(
        "installed launcher runs and plans nothing",
        viaLauncher.code === 0 && viaLauncher.out.trim() === "[]",
        viaLauncher.out + viaLauncher.err,
      );
    }

    // bootstrap.ps1 from this checkout, twice, in a fresh HOME (PowerShell 7 on any OS).
    if (Bun.which("pwsh")) {
      const psHome = join(root, "ps-home");
      await mkdir(psHome);
      const psEnv = baseEnv(psHome);
      const ps1 = join(workshop, "bootstrap.ps1");
      const p1 = sh(["pwsh", "-NoProfile", "-File", ps1], root, psEnv);
      check(
        "bootstrap.ps1 (local) installs",
        p1.code === 0 && existsSync(join(psHome, ".local", "bin", "snshah")),
        p1.out + p1.err,
      );
      const p2 = sh(["pwsh", "-NoProfile", "-File", ps1], root, psEnv);
      check(
        "bootstrap.ps1 (local) again reports no changes",
        p2.code === 0 && p2.out.includes("No changes needed."),
        p2.out + p2.err,
      );
      if (remote) {
        const url = `https://raw.githubusercontent.com/shah/shah/${remote}/workshop/bootstrap.ps1`;
        const psRemoteHome = join(root, "ps-remote-home");
        await mkdir(psRemoteHome);
        const e = {
          ...baseEnv(psRemoteHome),
          SNSHAH_REF: remote,
        };
        const iex = ["pwsh", "-NoProfile", "-Command", `irm '${url}' | iex`];
        const q1 = sh(iex, root, e);
        check(
          `bootstrap.ps1 via irm | iex (${remote}) installs`,
          q1.code === 0,
          q1.out + q1.err,
        );
        const q2 = sh(iex, root, e);
        check(
          `bootstrap.ps1 via irm | iex (${remote}) again reports no changes`,
          q2.code === 0 && q2.out.includes("No changes needed."),
          q2.out + q2.err,
        );
      }
    }

    // Optional: install from GitHub at a ref, twice, then update --check.
    if (remote && process.platform !== "win32") {
      const remoteHome = join(root, "remote-home");
      await mkdir(remoteHome);
      const remoteEnv = {
        ...baseEnv(remoteHome),
        SNSHAH_REF: remote,
      };
      const url = `https://raw.githubusercontent.com/shah/shah/${remote}/workshop/bootstrap.sh`;
      const fetchBoot = async () => {
        const text = await (await fetch(url)).text();
        const path = join(root, "remote-bootstrap.sh");
        await writeFile(path, text);
        return path;
      };
      const path = await fetchBoot();
      const r1 = sh(["sh", "-c", `sh < "${path}"`], root, remoteEnv);
      check(
        `bootstrap.sh from GitHub (${remote}) installs`,
        r1.code === 0,
        r1.out + r1.err,
      );
      const r2 = sh(["sh", "-c", `sh < "${path}"`], root, remoteEnv);
      check(
        `bootstrap.sh from GitHub (${remote}) again reports no changes`,
        r2.code === 0 && r2.out.includes("No changes needed."),
        r2.out + r2.err,
      );
      const up = sh(
        [
          join(remoteHome, ".local", "bin", "snshah"),
          "update",
          "--check",
          "--ref",
          remote,
        ],
        root,
        remoteEnv,
      );
      check(
        "update --check right after install is up to date",
        up.code === 0 && up.out.includes("Up to date"),
        up.out + up.err,
      );
      const checkout = join(
        remoteHome,
        "workspaces",
        "github.com",
        "shah",
        "shah",
      );
      check(
        `bootstrap.sh from GitHub (${remote}) clones shah/shah into the workspaces root`,
        existsSync(join(checkout, "workshop", "snshah.ts")) &&
          sh(["git", "-C", checkout, "status", "--porcelain"]).out === "",
        r1.out + r1.err,
      );
    }

    // The ontology agrees with this file, when run from a repository checkout.
    const ontologyCheck = join(workshop, "..", "ontology", "check.ts");
    if (existsSync(ontologyCheck)) {
      const o = sh([bun, "--no-env-file", ontologyCheck]);
      check("ontology check passes", o.code === 0, o.out + o.err);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} check(s) failed.` : "All checks passed.");
  return failures ? 1 : 0;
}
