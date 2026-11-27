/**
 * snshah self-test, run by `snshah test`. Everything happens in a temporary
 * HOME with fake secrets and a local Git fixture. The core rule it proves:
 * every command is safe to re-run, and a second apply or bootstrap reports
 * "No changes needed."
 */
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
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
echo "__BIN__ 1.2.3"
SHIM
      sed -i "s/__BIN__/$bin/" "$data/shims/$bin"
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
        /^(XDG_|WORKSPACES_HOME$|CLAUDE_CONFIG_DIR$|CODEX_HOME$|ZDOTDIR$|SNSHAH_|BUN_INSTALL$|MISE_|GH_|GITHUB_TOKEN$|SSH_CONNECTION$|SSH_CLIENT$|SSH_USER_AUTH$|LC_SNSHAH_OS$|LC_SNSHAH_FONTS$|LC_TERMINAL$)/.test(
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
      // Local bootstraps skip cloning shah/shah from GitHub; --remote runs do it.
      SNSHAH_CLONE: "0",
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

    // Shell greeting: doctor on first use per version, update check hourly.
    {
      const greetHome = join(root, "greet-home");
      await mkdir(greetHome);
      // A full commit hash resolves without the network.
      const pinned = "0123456789abcdef0123456789abcdef01234567";
      const ge = {
        ...baseEnv(greetHome),
        SNSHAH_GREET: "1",
        SNSHAH_REF: pinned,
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
          g1.err.includes("checkouts and updates") &&
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
          !g2.err.includes("checkouts and updates") &&
          g2.out === plain.out,
        g2.err,
      );
      const c = cli(["update", "--check"], undefined, ge);
      check(
        "update --check reports without downloading",
        c.code === 0 && c.out.includes("update is available"),
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
        SNSHAH_REF: "0123456789abcdef0123456789abcdef01234567",
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
        SNSHAH_REF: "0123456789abcdef0123456789abcdef01234567",
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
        SNSHAH_REF: "0123456789abcdef0123456789abcdef01234567",
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
          h.err.includes("ssh-copy-id") &&
          h.err.includes("@192.0.2.20") &&
          h.out === plainShell.out,
        h.err,
      );
      const via = cli(["ssh", "copy"], undefined, hintEnv);
      check(
        "the hint's instructions are the same text as `snshah ssh copy`",
        via.out.length > 0 &&
          h.err.includes(via.out.trim().split("\n")[0]!) &&
          h.err.includes(via.out.trim().split("\n").at(-1)!),
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
          SNSHAH_CLONE: "1",
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
        SNSHAH_CLONE: "1",
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
        [join(remoteHome, ".local", "bin", "snshah"), "update", "--check"],
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
