#!/usr/bin/env -S bun --no-env-file
/**
 * Drift check for ontology/*.ttl. Fails (exit 1) when:
 * - a Turtle file does not parse,
 * - an eid:/ws: class or property is used but not declared in eidolon-schema.ttl,
 * - an eid:path or eid:sourcedFrom path (or its #anchor) does not exist,
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
const files = ["eidolon-schema.ttl", "eidolon.ttl"];
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

if (problems.length) {
  for (const p of problems) console.error(`FAIL ${p}`);
  console.error(`${problems.length} ontology problem(s).`);
  process.exit(1);
}
console.log(
  `Ontology OK: ${quads.length} triples in ${files.length} files agree with the repository.`,
);
