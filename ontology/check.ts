#!/usr/bin/env -S bun --no-env-file
/**
 * Drift check for ontology/*.ttl. Fails (exit 1) when:
 * - a Turtle file does not parse,
 * - an eid:/ws: class or property is used but not declared in eidolon-schema.ttl,
 * - an eid:path or eid:sourcedFrom path (or its #anchor) does not exist,
 * - ontology/workshop.ttl disagrees with workshop/snshah.ts or the bootstraps.
 * Read-only and safe to re-run.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const n3Version = "1.17.4";
const { Parser } = (await import(`n3@${n3Version}`)) as {
  Parser: new (o?: { baseIRI?: string }) => { parse(text: string): Quad[] };
};
type Term = { termType: string; value: string };
type Quad = { subject: Term; predicate: Term; object: Term };

const root = resolve(import.meta.dir, "..");
const files = ["eidolon-schema.ttl", "eidolon.ttl", "workshop.ttl"];
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const OWL = "http://www.w3.org/2002/07/owl#";
const EID = "https://github.com/shah/shah/ontology/eidolon#";
const WS = "https://github.com/shah/shah/ontology/workshop#";

const problems: string[] = [];
const quads: Quad[] = [];
for (const file of files) {
  try {
    quads.push(
      ...new Parser().parse(readFileSync(join(import.meta.dir, file), "utf8")),
    );
  } catch (error) {
    problems.push(`${file}: ${(error as Error).message}`);
  }
}

const values = (s: string, p: string) =>
  quads
    .filter((q) => q.subject.value === s && q.predicate.value === p)
    .map((q) => q.object.value);
const one = (s: string, p: string) => values(s, p)[0];
const short = (iri: string) => iri.replace(EID, "eid:").replace(WS, "ws:");

// 1. Every eid:/ws: class and predicate in use is declared.
const declaredClasses = new Set(
  quads
    .filter(
      (q) => q.predicate.value === RDF_TYPE && q.object.value === `${OWL}Class`,
    )
    .map((q) => q.subject.value),
);
const declaredProps = new Set(
  quads
    .filter(
      (q) =>
        q.predicate.value === RDF_TYPE &&
        [`${OWL}ObjectProperty`, `${OWL}DatatypeProperty`].includes(
          q.object.value,
        ),
    )
    .map((q) => q.subject.value),
);
const ours = (iri: string) => iri.startsWith(EID) || iri.startsWith(WS);
for (const q of quads) {
  if (ours(q.predicate.value) && !declaredProps.has(q.predicate.value))
    problems.push(`undeclared property ${short(q.predicate.value)}`);
  if (
    q.predicate.value === RDF_TYPE &&
    ours(q.object.value) &&
    !declaredClasses.has(q.object.value)
  )
    problems.push(
      `undeclared class ${short(q.object.value)} on ${short(q.subject.value)}`,
    );
}

// 2. Paths and anchors exist.
const slug = (heading: string) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");
for (const q of quads) {
  if (
    q.predicate.value !== `${EID}path` &&
    q.predicate.value !== `${EID}sourcedFrom`
  )
    continue;
  const [path, anchor] = q.object.value.split("#") as [
    string,
    string | undefined,
  ];
  const full = join(root, path);
  if (!existsSync(full)) {
    problems.push(`${short(q.subject.value)}: ${path} does not exist`);
    continue;
  }
  if (anchor && statSync(full).isFile()) {
    const headings = readFileSync(full, "utf8")
      .split("\n")
      .filter((l) => /^#{1,6} /.test(l))
      .map((l) => slug(l.replace(/^#+ /, "")));
    if (!headings.includes(anchor))
      problems.push(
        `${short(q.subject.value)}: no heading #${anchor} in ${path}`,
      );
  }
}

// 3. The Workshop model matches the code.
const ws = await import(join(root, "workshop", "snshah.ts"));
const toolkit = `${WS}snshah`;
const same = (
  label: string,
  model: readonly string[],
  code: readonly string[],
) => {
  const a = [...model].sort();
  const b = [...code].sort();
  if (JSON.stringify(a) !== JSON.stringify(b))
    problems.push(
      `${label}: ontology [${a.join(", ")}] vs snshah.ts [${b.join(", ")}]`,
    );
};
const names = (predicate: string) =>
  values(toolkit, `${WS}${predicate}`).map(
    (iri) => one(iri, `${WS}name`) ?? `(no ws:name on ${short(iri)})`,
  );

if (one(toolkit, `${WS}version`) !== ws.cliVersion)
  problems.push(
    `version: ontology ${one(toolkit, `${WS}version`)} vs snshah.ts ${ws.cliVersion}`,
  );
if (one(`${WS}bun`, `${WS}minimumVersion`) !== ws.minimumBun)
  problems.push(`minimum Bun: ontology vs snshah.ts ${ws.minimumBun}`);
same("commands", names("hasCommand"), ws.commandNames);
same("platforms", names("supportsPlatform"), ws.platforms);
same("shells", names("emitsFor"), ws.shells);
same("secret scopes", names("secretScope"), ws.secretScopes);
same("step kinds", names("makesStep"), ws.stepKinds);
same("package managers", names("advisesWith"), ws.packageManagers);
same("selector kinds", names("selectsBy"), ws.selectorKinds);
same("hook kinds", names("hooksWith"), ws.hookKinds);
const interval = /^PT(\d+)H$/.exec(
  one(toolkit, `${WS}updateCheckInterval`) ?? "",
);
if (!interval || Number(interval[1]) * 3_600_000 !== ws.updateCheckIntervalMs)
  problems.push(
    `updateCheckInterval: ontology vs snshah.ts ${ws.updateCheckIntervalMs} ms`,
  );
if (one(toolkit, `${WS}selfCheckout`) !== ws.upstream.repo)
  problems.push(`selfCheckout: ontology vs snshah.ts ${ws.upstream.repo}`);
const posh = values(toolkit, `${WS}installs`).find(
  (iri) => one(iri, `${WS}name`) === "oh-my-posh",
);
if (!posh || one(posh, `${WS}pinnedVersion`) !== ws.ohMyPosh.version)
  problems.push(`oh-my-posh: ontology vs snshah.ts ${ws.ohMyPosh.version}`);

const mise = values(toolkit, `${WS}installs`).find(
  (iri) => one(iri, `${WS}name`) === "mise",
);
if (!mise || one(mise, `${WS}pinnedVersion`) !== ws.miseRelease.version)
  problems.push(`mise: ontology vs snshah.ts ${ws.miseRelease.version}`);
if (one(toolkit, `${WS}directoryProfileFile`) !== ws.dirProfileFile)
  problems.push(
    `directoryProfileFile: ontology vs snshah.ts ${ws.dirProfileFile}`,
  );
same(
  "default tools",
  values(toolkit, `${WS}defaultTool`),
  Object.keys(ws.defaultTools),
);

// 3b. Every workshop/profile.d file is modeled, with its top-level selector
// kind, and none uses a private-only selector (hostname, machine).
const privateOnly = new Set(
  quads
    .filter(
      (q) =>
        q.predicate.value === `${WS}privateOnly` && q.object.value === "true",
    )
    .map((q) => one(q.subject.value, `${WS}name`)),
);
privateOnly.add("machine");
const profileDir = join(root, "workshop", "profile.d");
const shipped = readdirSync(profileDir)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => f.slice(0, -3));
same("profiles", names("hasProfile"), shipped);
const kindsIn = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(kindsIn)
    : value && typeof value === "object"
      ? [
          ...("kind" in value
            ? [String((value as { kind: unknown }).kind)]
            : []),
          ...Object.values(value).flatMap(kindsIn),
        ]
      : [];
for (const id of shipped) {
  const mod = await import(join(profileDir, `${id}.ts`));
  const iri = values(toolkit, `${WS}hasProfile`).find(
    (p) => one(p, `${WS}name`) === id,
  );
  const modeled = iri && one(one(iri, `${WS}selectorKind`) ?? "", `${WS}name`);
  if (iri && modeled !== mod.selector?.kind)
    problems.push(
      `profile ${id}: ontology selector ${modeled} vs file ${mod.selector?.kind}`,
    );
  const modeledGroup = iri ? one(iri, `${WS}providesGroup`) : undefined;
  if (modeledGroup !== mod.commands?.group)
    problems.push(
      `profile ${id}: ontology group ${modeledGroup} vs file ${mod.commands?.group}`,
    );
  for (const kind of kindsIn(mod.selector))
    if (privateOnly.has(kind))
      problems.push(
        `profile ${id}: ${kind} selectors belong only in private profile.d`,
      );
}
same(
  "dependencies",
  values(toolkit, `${WS}dependsOn`).map(
    (iri) => `${one(iri, `${WS}name`)}@${one(iri, `${WS}pinnedVersion`)}`,
  ),
  Object.entries(ws.dependencies as Record<string, string>).map(
    ([n, v]) => `${n}@${v}`,
  ),
);
same(
  "XDG paths",
  values(toolkit, `${WS}usesPath`).map((iri) =>
    [`${WS}name`, `${WS}xdgBase`, `${WS}fallback`, `${WS}relativePath`]
      .map((p) => one(iri, p))
      .join(" "),
  ),
  Object.entries(
    ws.xdgPaths as Record<
      string,
      { base: string; fallback: string; relative: string }
    >,
  ).map(([k, v]) => [k, v.base, v.fallback, v.relative].join(" ")),
);
const upstream = `${ws.upstream.owner}/${ws.upstream.repo}@${ws.upstream.ref}`;
if (one(toolkit, `${WS}upstream`) !== upstream)
  problems.push(`upstream: ontology vs snshah.ts ${upstream}`);
for (const [p, v] of [
  ["workspacesVariable", ws.workspacesDefaults.variable],
  ["workspacesDefault", ws.workspacesDefaults.standard],
] as const)
  if (one(toolkit, `${WS}${p}`) !== v)
    problems.push(
      `${p}: ontology ${one(toolkit, `${WS}${p}`)} vs snshah.ts ${v}`,
    );

// 4. Both bootstraps pin the Bun version the ontology states, with the same checksums.
const sh = readFileSync(join(root, "workshop", "bootstrap.sh"), "utf8");
const ps1 = readFileSync(join(root, "workshop", "bootstrap.ps1"), "utf8");
const pinned = one(`${WS}bootstrap-sh`, `${WS}pinsBun`);
if (!sh.includes(`BUN_VERSION=${pinned}\n`))
  problems.push(`bootstrap.sh does not pin Bun ${pinned}`);
if (
  one(`${WS}bootstrap-ps1`, `${WS}pinsBun`) !== pinned ||
  !ps1.includes(`$BunVersion = '${pinned}'`)
)
  problems.push(`bootstrap.ps1 does not pin Bun ${pinned}`);
const shSums = new Map(
  [...sh.matchAll(/^\s+([a-z0-9-]+)\) echo ([0-9a-f]{64}) ;;$/gm)].map((m) => [
    m[1]!,
    m[2]!,
  ]),
);
const psSums = new Map(
  [...ps1.matchAll(/^\s+'([a-z0-9-]+)'\s+= '([0-9a-f]{64})'$/gm)].map((m) => [
    m[1]!,
    m[2]!,
  ]),
);
if (shSums.size < 6 || psSums.size < 3)
  problems.push("could not read the pinned Bun checksums from the bootstraps");
for (const [target, sum] of psSums)
  if (shSums.has(target) && shSums.get(target) !== sum)
    problems.push(`Bun checksum for ${target} differs between bootstraps`);

if (problems.length) {
  for (const p of problems) console.error(`FAIL ${p}`);
  console.error(`${problems.length} ontology problem(s).`);
  process.exit(1);
}
console.log(
  `Ontology OK: ${quads.length} triples in ${files.length} files agree with the repository and workshop/snshah.ts.`,
);
