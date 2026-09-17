<div align="center">

# Shahid N. Shah

**Fractional CTO • CISO • CTVO • Inventor • Author**

[shahidshah.com](https://www.shahidshah.com) · [Intellectual Frontiers](https://www.intellectualfrontiers.com)

</div>

---

Award-winning Government 2.0, Health IT, and Medical Device Integration
software expert with 35 years of technology strategy, software engineering,
entrepreneurship, speaking, and writing experience. 34 awarded U.S. patents,
105 open source repositories across GitHub, 10 companies and organizations
founded (2 active, 3 exited via acquisition, 2 closed, 3 active
non-profits), 35+ clients served.

This repository is **Shahid Shah's Eidolon** — public tier only: a
structured, checkable account of who he is, what he's built, and how his
properties relate — written so a person, or an AI agent acting for one,
can get his stated positions, judge project fit, or find the right
property to approach, without guessing from an ordinary bio. It's a
read reference, not a live agent — nothing here answers on his behalf in
real time. See "My Eidolon" below for what that means and doesn't mean,
and "Build your own Eidolon" if you want to do the same for yourself.

It's also specified the way
[`intellectual-frontiers/.github`](https://github.com/intellectual-frontiers/.github)
specifies the company: testable statements instead of a bio that drifts out
of date, sourced from what's actually verifiable, with open questions marked
as open rather than quietly resolved. See "Specifying a person" below.

## Roles

| Role | What it means |
| --- | --- |
| **Fractional CTO** | Architecture ownership, engineering standards, delivery accountability, board-level technical judgment, part-time and recurring. |
| **Fractional CISO** | Security programs for regulated and safety-critical software: HIPAA, HITRUST, SOC 2, FedRAMP, FDA premarket cybersecurity. |
| **CTVO** (Chief Technology & Venture Officer) | A role he defined: a CTO makes the technology organization better; a CTVO asks what new company, product, or business model the technology now makes possible. |
| **Entrepreneur-in-residence** | Technology due diligence and venture-building for boards and founders. |

## My Eidolon

Most people's public presence is scattered across a LinkedIn profile, a
personal site's About page, and whatever a search engine happens to
surface — none of it structured enough for another person, let alone an
AI acting on their behalf, to reliably answer "is this person a fit for
what I need, and which of their things should I actually contact?" This
repository is built to answer exactly that, for Shahid: a public,
structured, checkable profile — roles, active companies, brands,
projects, historical ventures, and the boundaries between them — that
works whether the reader is human or an AI representing one.

Shahid calls this kind of profile an **Eidolon** — "a working digital
reflection of a person, company, customer, product or system," not a
replica, containing "enough grounded reality for AI to reason about the
original accurately and flexibly." He's written the full argument up,
including why he deliberately retired the more familiar term "digital
twin" in favor of this one (the engineering standards that word has
accumulated — real-time bidirectional sync, predictive capability —
overpromise for what a personal profile needs): see [Eidolon: Working
Digital Reflections for AI Workforce and Labor as
Code](https://www.intellectualfrontiers.com/research/eidolons). This
README only summarizes; read that page for the real thing.

Two things worth being precise about, echoing that page directly. First,
this is a **read** reference, not a live agent: nothing in this
repository holds a conversation or gives advice on its own — it's
"structured source material for people and AI agents, not a live agent
pretending to be [Shahid]." Second, an Eidolon has tiers — public,
internal, confidential, and highly restricted — and this repository is
the **public tier only**. The others don't exist here, and this
repository doesn't promise a timeline for them. See
[`spec-kit/specs/0001-shahid-shah/spec.md`](spec-kit/specs/0001-shahid-shah/spec.md#eidolon)
for the full statement.

## Specifying a person

Most public bios are written once and left to drift. This repository
treats the public account of Shahid Shah — the properties that exist, the
boundaries between them, what's verified versus stated — as something that
can be checked, the same discipline
[`intellectual-frontiers/.github`](https://github.com/intellectual-frontiers/.github)
applies to the company. Intellectual Frontiers is one property specified
here, not the top of this hierarchy — this repository sits one level above
it, and cites its corporate spec-kit rather than restating it.

There is no personal "constitution" here. Shahid's own words on that: *"I'm
a person, I don't have a doctrine for myself, but I do have professional
ethics that starts with be kind, generous, empathetic, intellectually
honest and intellectually consistent, and useful to my fellow man across
the globe."* See
[`spec-kit/specs/0001-shahid-shah/spec.md`](spec-kit/specs/0001-shahid-shah/spec.md#personal-principles)
for that statement in full context, and why this repository doesn't build
constitution-style machinery — versioning, an amendment process — around a
sentence that isn't a governing doctrine.

## What this repository is

1. **The GitHub profile.** This file is the card GitHub renders on
   [github.com/shah](https://github.com/shah).
2. **The public specification.** [`spec-kit/`](spec-kit/) holds one spec
   for the person and one per major property, following the same spec-kit
   discipline as the company repo: testable statements, not values
   language, with `[NEEDS CLARIFICATION]` markers left in rather than
   guessed away.

## Layout

```
README.md                      this profile card
spec-kit/
  AGENTS.md                    entry point for writing a new spec here
  templates/
    spec-template.md           how to write the next spec
    plan-template.md           how to plan against a spec
  specs/
    0001-shahid-shah/
      spec.md                  the person, specified: roles, properties,
                                boundaries, personal principles, Eidolon,
                                technical skills (Proven/Valid), open
                                questions — not a plan
    0002-intellectual-frontiers/
      spec.md                  thin — cites intellectual-frontiers/.github
                                for everything, restates nothing
skills/                        portable Agent Skills — Labor as Code
                                for voice and judgment; see skills/README.md
mcp/
  eidolon-server/              MCP server exposing this Eidolon's public
                                tier as tools; see its own README.md
```

## Skills and an MCP server

Two artifact types, one job each, per the Eidolon research's Labor as
Code argument: a skill is the reusable *how* (voice, judgment, a
checklist), an MCP server is the reusable *who for* (live access to this
Eidolon's own data instead of an agent guessing). [`skills/`](skills/)
packages three of Shahid's own writing/editing prompts as portable
`SKILL.md` files, sourced verbatim from
[shahidshah.com/write-like-shahid](https://www.shahidshah.com/write-like-shahid).
[`mcp/eidolon-server/`](mcp/eidolon-server/) is a working MCP server
(built, tested, not just described) that serves this repository's
public-tier facts — profile, companies founded, technical skills — as
callable tools, generated from `spec.md` rather than duplicating it as a
second source of truth.

## Build your own Eidolon

This pattern isn't specific to Shahid. Anyone can build the same kind of
structured, checkable public profile — the concept is explicitly
designed to generalize; see the "Research questions" section of [Eidolon:
Working Digital Reflections for AI Workforce and Labor as
Code](https://www.intellectualfrontiers.com/research/eidolons) — and
Shahid's encouraged it. If this is useful to you, here's what actually
generalizes from this specific repository:

- **The structure**: a `spec-kit/` holding a person-spec (your own version
  of [`0001-shahid-shah`](spec-kit/specs/0001-shahid-shah/spec.md)), plus
  a thin spec per major property you're closely identified with, built
  from [`spec-kit/templates/spec-template.md`](spec-kit/templates/spec-template.md).
- **The claims standard**: an observable fact should be verifiable; an
  opinion should read as an opinion; a category you're not sure of gets
  marked `[NEEDS CLARIFICATION]` instead of asserted. This is what keeps
  the profile trustworthy to both a human reader and an AI agent reading
  it on someone's behalf.
- **The status-honesty rule**: label anything whose current status you
  can't confirm from a recent first-party source as "Former" or
  "Historical" rather than letting it read as current.
- **No constitution required**: you don't need governance machinery for
  a personal profile — see
  [`spec-kit/specs/0001-shahid-shah/spec.md`](spec-kit/specs/0001-shahid-shah/spec.md#personal-principles)
  for why this repository doesn't have one, and use your own judgment
  about what fits your situation.

What doesn't generalize: Shahid's specific properties, the Intellectual
Frontiers / Netspective thinking-and-doing split, and anything else that's
a fact about him rather than about the pattern. Copy the structure and the
discipline, not the content. See
[`spec-kit/AGENTS.md`](spec-kit/AGENTS.md) for the fuller entry point an
AI agent (or you) would use to start writing your own version.

## Elsewhere

- Website: [shahidshah.com](https://www.shahidshah.com)
- LinkedIn: [linkedin.com/in/shahidnshah](https://www.linkedin.com/in/shahidnshah/)
- X: [@ShahidNShah](https://twitter.com/ShahidNShah)
- GitHub: [github.com/shah](https://github.com/shah)
- Intellectual Frontiers: [intellectualfrontiers.com](https://www.intellectualfrontiers.com)
- HealthIMPACT: [healthimpactlive.com](https://www.healthimpactlive.com)

## Editing this repository

- Treat every file under `spec-kit/` as public the moment it's committed —
  this repository has no private branch or draft state; it renders as a
  GitHub profile the instant it has a root README.
- Follow the claims standard in
  [`spec-kit/specs/0001-shahid-shah/spec.md`](spec-kit/specs/0001-shahid-shah/spec.md):
  an observable fact should be verifiable; a claim doesn't become true
  because this repository states it.
- Don't invent a property's category (company, media brand, historical
  venture) from guesswork — if the source material doesn't settle it, mark
  it `[NEEDS CLARIFICATION]` in Open Questions instead.
- A new spec starts from
  [`spec-kit/templates/spec-template.md`](spec-kit/templates/spec-template.md)
  at the next unused number in `spec-kit/specs/`. See
  [`spec-kit/AGENTS.md`](spec-kit/AGENTS.md) for the full read order and
  the person → company → unit → venture layering model.
