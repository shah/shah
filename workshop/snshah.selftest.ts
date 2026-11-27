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
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

type Result = { code: number; out: string; err: string };
type Options = { script: string; remote?: string };

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
        /^(XDG_|WORKSPACES_HOME$|CLAUDE_CONFIG_DIR$|CODEX_HOME$|ZDOTDIR$|SNSHAH_|BUN_INSTALL$)/.test(
          k,
        )
      )
        continue;
      env[k] = v;
    }
    return {
      ...env,
      HOME: home,
      USERPROFILE: home,
      NO_COLOR: "1",
      SNSHAH_SHELLS: "bash,zsh,fish,pwsh",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: join(root, "gitconfig"),
      GIT_TERMINAL_PROMPT: "0",
    };
  };
  await writeFile(
    join(root, "gitconfig"),
    "[user]\n\tname = snshah test\n\temail = test@example.invalid\n[init]\n\tdefaultBranch = main\n[advice]\n\tdetachedHead = false\n",
  );

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

    const apply1 = cli(["apply", "--yes"]);
    check("apply succeeds", apply1.code === 0, apply1.err + apply1.out);
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
        pwsh: undefined,
      };
      const checker = syntax[shell];
      if (checker && Bun.which(checker[0]!)) {
        const path = join(root, `init.${shell}`);
        await writeFile(path, a.out);
        const r = sh([...checker, path]);
        check(`shell ${shell}: syntax check`, r.code === 0, r.err);
      }
    }
    check("unknown shell is a usage error", cli(["shell", "tcsh"]).code === 2);

    if (Bun.which("bash")) {
      const live = sh([
        "bash",
        "-ic",
        'type -t mkcd; type -t gs; echo "WS=$WORKSPACES_HOME"; echo "TOKEN=$DEMO_SHELL_TOKEN"',
      ]);
      check(
        "interactive bash loads the block end to end",
        live.out.includes("function") &&
          live.out.includes("alias") &&
          live.out.includes(`WS=${join(home, "workspaces")}`) &&
          live.out.includes("TOKEN=shell-secret-value"),
        live.out + live.err,
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
    const list = json<Array<{ state: string }>>(cli(["git", "list", "--json"]));
    check("git list shows a clean checkout", list?.[0]?.state === "clean");
    check(
      "git clone --all twice is safe",
      cli(["git", "clone", "--all"]).code === 0 &&
        cli(["git", "clone", "--all"]).out.includes("present"),
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
    check("git remove", cli(["git", "remove", "shah"]).out.includes("Removed"));
    check(
      "git remove again is a no-op",
      cli(["git", "remove", "shah"]).out.includes("not registered"),
    );
    check(
      "apply after git changes still has no changes",
      cli(["apply", "--yes"]).out.includes("No changes needed."),
    );

    // doctor never installs; it only reports.
    const doc = json<{ checks: unknown[]; advice: string[] }>(
      cli(["doctor", "--json"]),
    );
    check("doctor reports checks", !!doc && doc.checks.length > 0);

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

    // Optional: install from GitHub at a ref, twice, then update --check.
    if (remote && process.platform !== "win32") {
      const remoteHome = join(root, "remote-home");
      await mkdir(remoteHome);
      const remoteEnv = { ...baseEnv(remoteHome), SNSHAH_REF: remote };
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
        up.code === 0 && up.out.includes("Already up to date"),
        up.out + up.err,
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
