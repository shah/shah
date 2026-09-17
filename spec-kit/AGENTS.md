# For an AI agent starting a new SpecKit here

This file is for an AI agent (or a person) about to write a new spec or
plan about Shahid Shah, a property of his, or something built on top of
one — anywhere the public account of who he is and what he's built should
stay checkable rather than turning into an ordinary bio. It is not for
editing this repository itself; see the root [`README.md`](../README.md)
for that.

## Read in this order

1. [`specs/0001-shahid-shah/spec.md`](specs/0001-shahid-shah/spec.md) — the
   person himself, specified: roles, properties, boundaries between them,
   personal principles, and open questions. Everything else in this
   repository, and everything a downstream property specifies, cites this
   spec rather than restating it.
2. The property's own spec, if one exists —
   [`specs/0002-intellectual-frontiers/spec.md`](specs/0002-intellectual-frontiers/spec.md)
   is the first. Check `specs/` for others before assuming none exists.
3. If the property has its own repository with its own SpecKit (as
   Intellectual Frontiers does, at
   [`intellectual-frontiers/.github`](https://github.com/intellectual-frontiers/.github)),
   that repository's constitution, specs, and glossary govern that
   property's own internal detail. This repository's job is to say that
   the property exists, what it is, and how it relates to Shahid and to
   his other properties — not to duplicate its internal governance.
4. [`../skills/`](../skills/) and [`../mcp/eidolon-server/`](../mcp/eidolon-server/)
   are not specs — they're Labor as Code built on top of this one: a
   skill packages a reusable *how* (Shahid's own voice and editing
   rules, verbatim), the MCP server serves this spec's own public-tier
   facts as callable tools instead of an agent re-reading `spec.md`
   fresh each time. Neither invents a new fact about Shahid; both cite
   spec 0001 and go stale if it changes without them being updated to
   match.

## Writing a new spec

Copy [`templates/spec-template.md`](templates/spec-template.md) to
`specs/NNNN-kebab-case-slug/spec.md`, where `NNNN` is the next unused
four-digit number across this whole repository — check `specs/` before
picking one. Two rules that matter most:

- Source every claim from something already established: spec 0001, a
  property's own repository or public site, or a fact Shahid supplies
  directly when a network fetch is blocked or a source can't be reached
  (this repository's own bootstrap hit exactly that: `shahidshah.com`
  couldn't be fetched directly in the environment that first wrote this
  file, and Shahid's own site source repository supplied the material
  instead — the same kind of substitution
  [`intellectual-frontiers/.github`](https://github.com/intellectual-frontiers/.github)
  records for `intellectualfrontiers.com` and the Maryland SDAT lookup).
  If you're inventing a category or a fact to fill a gap, stop — mark it
  `[NEEDS CLARIFICATION]` instead.
- Mark a real gap `[NEEDS CLARIFICATION]` rather than guessing, especially
  about whether a property is active, historical, or how it should be
  categorized. This is a public document about a real, named person;
  getting a category wrong is worse than leaving it open.

## Writing a new plan

Copy [`templates/plan-template.md`](templates/plan-template.md) to
`specs/NNNN-kebab-case-slug/plan.md`, next to the spec it implements. This
repository has no constitution and no Constitution Check — see spec 0001's
Personal Principles section for why. The plan template's own Principles
Check is lighter: it asks whether the plan is consistent with the personal
principles spec 0001 quotes, not whether it passes a versioned governance
gate. That's a real difference in weight, not a gap to fill in later.

## Person, company, unit, and venture SpecKits — who owns what

This repository is the **personal SpecKit**: Shahid Shah himself, and a
thin spec per property he holds, founded, or is closely identified with.
A **company SpecKit** — Intellectual Frontiers' own
[`.github`](https://github.com/intellectual-frontiers/.github) repository
is the only one that exists today — inherits nothing structural from this
repository (there's no constitution here to inherit) but is cited by this
repository's spec for that company, and this repository does not redefine
the company's own units, doctrine, or governance. A **unit SpecKit** and a
**venture SpecKit** are exactly as described in the company repository's
own `AGENTS.md`; nothing about that layering changes here. The one added
layer is at the top: a company's own constitution governs that company,
but no equivalent document governs Shahid himself — see spec 0001.

## Using this pattern for your own Eidolon

This repository is Shahid's own Eidolon, public tier only — a term from
his own published research,
[Eidolon: Working Digital Reflections for AI Workforce and Labor as
Code](https://www.intellectualfrontiers.com/research/eidolons), which
deliberately retired the more familiar "digital twin" as overpromising
for this purpose. See
[`specs/0001-shahid-shah/spec.md`](specs/0001-shahid-shah/spec.md#eidolon)
for what that means here (a structured, checkable, read reference; not a
live agent; public-tier-only for now, with internal, confidential, and
highly restricted tiers intended but not yet built). If you're an agent
helping someone build the same kind of profile for themselves rather
than editing this one, here's what to carry over and what not to:

**Carry over:**
- The three-layer structure: a root `README.md` that doubles as the
  GitHub profile card, a `spec-kit/AGENTS.md` entry point like this one,
  and `spec-kit/specs/0001-<slug>/spec.md` as the person's own spec.
- The claims standard (FR-001 in spec 0001): verifiable facts, labeled
  opinions, no invented categories.
- The status-honesty rule (FR-003): "Former" / "Historical" for anything
  whose current status can't be confirmed from a first-party source.
- Marking real gaps `[NEEDS CLARIFICATION]` instead of guessing —
  especially important for a public document about a real, named person.
- No constitution. A person's own stated ethics (if any) can sit as a
  short quoted section, the way spec 0001's Personal Principles does,
  without building amendment/versioning machinery around it.

**Do not carry over:**
- Any of Shahid's specific facts, properties, or relationships (the
  Intellectual Frontiers / Netspective thinking-and-doing split, his
  specific companies, his personal principles quote). Those are his, not
  a template.
- The specific property categories this repository landed on (personal
  active company, non-profit vehicle, brand/partnership, Studios-delivered
  project). A different person's properties will sort differently —
  derive the categories from their own facts rather than reusing these
  labels by default.

## Versioning

There is no constitution version to check against, because there is no
constitution. If a property's own repository has a constitution (as
Intellectual Frontiers does), note that repository's version in any spec
here that depends on a specific fact from it, the same way spec 0001 notes
which of Shahid's own site's content files a claim was sourced from.
