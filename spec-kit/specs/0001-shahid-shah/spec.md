# Feature Specification: Shahid N. Shah

**Spec ID:** 0001-shahid-shah
**Status:** Draft — clarified 2026-09-16
**Created:** 2026-09-15
**Decision authority:** Shahid N. Shah
**Input:** Build a public GitHub profile repository (`shah/shah`) for
Shahid Shah as a person — his public ecosystem of properties, companies,
and brands — using the same spec-kit methodology already built out for
his company in `intellectual-frontiers/.github`, one level up: Intellectual
Frontiers becomes one node under this, not the top of anything.

## Why this document exists

`intellectual-frontiers/.github`'s constitution and specs govern the
company. Nothing governs the person the same way, because a person isn't
a company — see Personal Principles below for why this repository doesn't
build constitution-style machinery around that fact. What this spec does
instead: state, as testable claims, who Shahid Shah publicly is, what
properties he holds or is closely identified with, and how they relate to
each other — sourced from his own site's structured content
(`shah/www.shahidshah.com`, primarily `src/content/site.ts`,
`src/content/network.ts`, `src/content/founderMode.ts`,
`src/content/bios.ts`, `src/content/structuredData.ts`,
`src/content/onAir.ts`, `src/routes/about.tsx`, and `public/llms.txt`) and
from Shahid's own direct statements where the site's content needed
correcting or didn't yet say enough.

This is not an implementation plan. It says what's true and how to check
it, not how any work gets done.

## Personal principles

Shahid was asked directly whether this repository should carry a
constitution the way the company repository does. His answer, quoted in
full because it's the actual source rather than something to paraphrase:

> "I'm a person, I don't have a doctrine for myself, but I do have
> professional ethics that starts with be kind, generous, empathetic,
> intellectually honest and intellectually consistent, and useful to my
> fellow man across the globe."

That's the whole of it. This repository does not pad that sentence into
additional invented principles, and does not build the machinery a
governing corporate doctrine needs — semantic versioning, an amendment
process, a version-history table — around it, because those exist in
`intellectual-frontiers/.github` to track changes to a *governing* document
that other people's decisions must answer to. A personal ethics statement
isn't that: nobody downstream cites this sentence the way a Studios plan
cites the constitution's Native Alpha test. It's context for how to read
everything else in this spec, not a gate anything has to pass.

## Digital twin

This repository is the public tier of Shahid's professional digital
twin: a structured, checkable account of who he is, what he's built, how
his properties relate to each other, and how to reach him — written so a
person, or an AI agent acting on a person's behalf, can use it to decide
whether he's a fit for a project, get his stated positions on something,
or figure out which property to approach. That's the same job a bio or a
LinkedIn profile tries to do, done to spec-kit's standard of evidence
instead of marketing copy.

Two things this is not. First, it is not a live, conversational agent —
nothing in this repository answers a question on Shahid's behalf in real
time. It's the structured source material a human or an AI reads, the
same way any other part of this repository is read, not a running
service. Second, it is not the only tier that will ever exist. Shahid's
stated intent is that digital twins — his and, per his direct
encouragement, anyone else's built the same way — will eventually have a
more detailed, private and sensitive tier behind them, for relationships
and decisions that shouldn't be public. That tier doesn't exist yet.
Until it does, this repository describes only the public tier, and
doesn't promise a timeline or a specific shape for what comes after it —
see FR-011 and FR-012.

If you're reading this to build a similar profile for yourself rather
than to learn about Shahid specifically: see "Build your own digital
twin" in the root [`README.md`](../../../README.md) and
[`spec-kit/AGENTS.md`](../../AGENTS.md) for what generalizes and what's
specific to him.

## Clarifications

### Session 2026-09-15

- **Q: Which of Shahid's companies count as his "personal active
  companies"?** → **A: Exactly two** — Intellectual Frontiers LLC and
  Netspective Communications LLC, per Shahid's direct statement. Every
  other property in this spec is categorized separately (non-profit
  vehicle, brand and partnership, co-founded venture, historical venture,
  or Studios-delivered project) rather than counted as a personal active
  company. Updates the Key Entities table below; resolves the "active
  company" half of OQ-1 and OQ-2.
- **Q: What is Netspective Foundation?** → **A: Shahid's principal
  non-profit vehicle, which he co-founded.** Not an in-flight or
  unconfirmed venture — `founderMode.ts`'s placement of it under
  `currentVentureWork` describes its maturity as a business, not its
  legal or organizational status, which Shahid has now stated directly.
  Resolves OQ-1.
- **Q: What is HealthIMPACT, structurally?** → **A: A brand, built on
  Shahid's personal partnership with Purpose Events
  ([purposeevents.com](https://purposeevents.com)), not a company he
  owns outright.** He co-founded it and has chaired it since 2013; the
  partnership with Purpose Events is what makes the forum run. Moved out
  of the companies table into its own category below.
- **Q: What are Medigy, Opsfolio, Qualityfolio, Fleetfolio, and similar
  named projects?** → **A: Projects built by and for Intellectual
  Frontiers Studios, delivered by Netspective Communications** — not
  personal ventures of Shahid's, and not evidence of a company he
  founded independently of IF and Netspective. This is a fact about how
  two of Shahid's properties relate to each other (Netspective as the
  engineering and delivery platform, IF Studios as the venture-decision
  layer that commissions the work) that neither property's own source
  material stated on its own. Resolves OQ-2, and the "project" half of
  OQ-1.
- **Note on remaining conflicts (OQ-3, OQ-4, OQ-5):** Shahid asked that
  these stay open for now ("we'll deal with conflicts later"). They are
  not resolved by this session and remain in Open Questions below.
- **Q: What is Unblock Health, and is it a company?** → **A: An
  Intellectual Frontiers Studios research project, implemented by
  Netspective Communications — not a company.** It began as an IF
  Studios research project, later became a venture pursued in
  partnership with Grace Cordovano exploring how release-of-information
  and medical-records-transfer processes for cancer and specialty care
  could be improved. It currently remains an active research project,
  not a company Shahid or anyone else owns outright. This corrects
  `founderMode.ts`'s "Operating" status label, which described the
  project's activity level, not a claim that it's incorporated as a
  company. Moves Unblock Health out of "co-founded venture" and into
  the Studios-delivered-projects category below.
- **Q: How do Intellectual Frontiers and Netspective Communications
  divide the work between them?** → **A: Intellectual Frontiers is
  where Shahid does most of his thinking and writing; Netspective
  Communications is where things actually get built** — software and
  solutions for IF. Shahid's own framing: IF is for "thinking,"
  Netspective is for "doing." This is the same pattern already stated
  for Studios projects (FR-009) at a more general level: IF (research,
  publishing, capital, venture decisions) decides and writes; Netspective
  (engineering, delivery) builds. See FR-010.
- **Q: Should this repository describe itself as a "digital twin"?** →
  **A: Yes — the public tier of one.** Shahid's direction: this is his
  professional digital twin, usable by anyone (person or AI) to get his
  stated positions, check project fit, or find the right property to
  approach; a more detailed private/sensitive tier is intended for the
  future, for him and for others building the same pattern, but doesn't
  exist yet and isn't promised on a timeline. See the new "Digital twin"
  section above, and FR-011 / FR-012.

### Session 2026-09-16

- **Q: Which companies actually count toward a "companies founded"
  figure, and how many is it?** → **A: Six**, per Shahid's direct
  statement: Netspective Communications and Intellectual Frontiers
  (active); Physia, simplifyMD, and Citus Health (each co-founded,
  venture-backed, and exited via acquisition — Shahid is no longer
  affiliated with any of the three); and Influential Networks (closed,
  no longer operating). This resolves OQ-5. The site's "05 Cos Founded"
  stat predates Intellectual Frontiers' founding and is superseded here.
- **Q: Do HealthcareGuy and HITSphere count as founded companies?** →
  **A: No — they're past publications, not companies.** Removed from the
  historical-ventures list below; see Media and Publishing Properties
  instead. This doesn't fully resolve OQ-7 (how the three related
  publications relate to each other), but confirms neither counts toward
  the companies-founded figure.
- **Q: Is the Hoy Health board seat current or former?** → **A: Former.**
  Resolves OQ-3 in favor of `founderMode.ts`'s "Previously served as"
  label over `recognition.ts`'s "Since 2016" (current) label.
- **Q: Is the Manos Health advisory seat current or former?** → **A:
  Current.** Resolves OQ-4 in favor of `recognition.ts`'s "Current" label
  over `founderMode.ts`'s "Previously served as" label.

## Primary scenario

Someone — a journalist, a founder considering a co-founder CTO
relationship, a conference organizer, an LP evaluating Intellectual
Frontiers, a job candidate, someone deciding whether Shahid could help
with a project, or another AI agent researching or representing Shahid
Shah — encounters one of his properties (a company, a publication, a
podcast, a patent) and needs to know what it actually is, how it relates
to Shahid and to his other properties, and whether a claim about it is
current, historical, or unconfirmed. This repository is written to be
that reference: the public tier of a digital twin, read by a person or an
AI, rather than answered by one living inside it. See Digital Twin above.

### Acceptance scenarios

1. **Given** a property appears in Shahid's founder record with a role
   like "Co-founder" or "Chairman," **when** its current operating status
   cannot be confirmed from a recent first-party source, **then** it must
   be labeled "Former," "Historical," or "Previously served as" rather
   than presented as current. (This is the rule his own site's
   `founderMode.ts` already states and follows — see FR-003.)
2. **Given** a claim about one property (e.g., Intellectual Frontiers'
   patent count, or Netspective Communications' client roster), **when**
   the claim is actually about a different property, **then** it must
   name the correct property rather than letting the two blend into one
   undifferentiated "Shahid Shah" narrative.
3. **Given** Intellectual Frontiers is one of Shahid's properties,
   **when** this repository needs to say anything about IF's own
   doctrine, units, or governance, **then** it must cite
   `intellectual-frontiers/.github` rather than restating any of it here.
4. **Given** a named project (Medigy, Opsfolio, Qualityfolio, Fleetfolio,
   Resource Surveillance/surveilr, Unblock Health, and similar), **when**
   this spec describes it, **then** it must be attributed to Intellectual
   Frontiers Studios as commissioning party and Netspective Communications
   as builder, not presented as an independent personal venture or
   company — even where, as with Unblock Health, an outside partner
   (Grace Cordovano) is also named.
5. **Given** a source file on Shahid's own site (`founderMode.ts`,
   `network.ts`, `recognition.ts`, `bios.ts`) states something that
   conflicts with another of his own source files, **when** this spec
   surfaces that fact, **then** it records the conflict as an open
   question rather than silently picking one version, unless Shahid has
   directly resolved it (see Clarifications).
6. **Given** a reader wants to understand why Netspective Communications
   builds Studios projects rather than Intellectual Frontiers building
   them directly, **when** this spec explains that relationship, **then**
   it must use Shahid's own thinking/doing framing (FR-010) rather than
   describing it as an ad hoc delegation.
7. **Given** someone describes this repository to a third party, **when**
   they call it a "digital twin," **then** the description must make
   clear it's a read reference (public tier, structured content), not a
   live agent that itself converses or gives advice — per FR-011.

### Edge cases

- A property's category (company vs. media brand vs. defunct project)
  isn't settled by the source material: marked `[NEEDS CLARIFICATION]` in
  Open Questions, not asserted.
- A property is named in one source file and absent from another
  (e.g., listed as a "company" in one place and as unconfirmed "in-flight
  venture work" in another): recorded as a conflict, not resolved by
  picking the more flattering label — unless a dated Clarification
  session above actually resolves it.

## Requirements

**Claims and disclosure**

- **FR-001**: This repository MUST treat an observable fact as one that
  should be verifiable, an opinion as one that should be identifiable as
  an opinion, and MUST NOT treat a claim as true merely because this
  repository states it — the same claims standard
  `intellectual-frontiers/.github`'s `context/company.md` states for the
  company.
- **FR-002**: This repository MUST NOT publish a street address, phone
  number, date of birth, financial specifics (revenue, compensation,
  ownership percentages, investment amounts), or other personal detail
  beyond what Shahid's own public site (`shahidshah.com`) already
  discloses (name, professional email, general location "Washington,
  D.C.," professional history).
- **FR-003**: A role, venture, or relationship whose current status
  cannot be confirmed from a recent first-party source MUST be labeled
  "Former," "Historical," or "Previously served as," per the standard
  Shahid's own `founderMode.ts` states and applies to itself. This
  repository MUST NOT upgrade a label to current status without a
  first-party source confirming it.

**Property boundaries**

- **FR-004**: No property's activity MAY be cited as proof of another
  property's claim. A patent held by Intellectual Frontiers is not
  evidence for a claim about Netspective Communications; Unblock Health's
  activity does not validate a claim about Intellectual Frontiers Capital;
  and so on — the same unit-boundary discipline
  `intellectual-frontiers/.github`'s constitution §5 states for IF's own
  units, extended across Shahid's properties generally.
- **FR-005**: This repository MUST NOT restate Intellectual Frontiers'
  governing doctrine, unit charters, or requirements; it MUST cite
  `intellectual-frontiers/.github` for all of them. See spec 0002.
- **FR-006**: Where a property already has its own repository or public
  site with its own account of itself, this repository's spec for that
  property MUST stay thin and cite that source, per FR-005's pattern —
  it MUST NOT fork a second, competing account of a property that already
  specifies itself elsewhere.
- **FR-008**: Only Intellectual Frontiers LLC and Netspective
  Communications LLC MAY be described as Shahid's "personal active
  companies." Every other entity in Key Entities MUST use its own
  category (non-profit vehicle, brand/partnership, co-founded venture,
  historical venture, or Studios-delivered project) and MUST NOT be
  described using that specific phrase.
- **FR-009**: A project built by Netspective Communications for
  Intellectual Frontiers Studios (Medigy, Opsfolio, Qualityfolio,
  Fleetfolio, Resource Surveillance/surveilr, Unblock Health, and any
  other project fitting this pattern) MUST be attributed to both —
  Studios as the commissioning unit, Netspective as the builder — and
  MUST NOT be listed as an independent company or personal venture of
  Shahid's, even where an outside partner is also named on the project.
- **FR-010**: When describing how Intellectual Frontiers and Netspective
  Communications relate, this repository MUST frame Intellectual
  Frontiers as where Shahid's thinking and writing work happens
  (research, publishing, capital and venture decisions) and Netspective
  Communications as where building happens (engineering, delivery,
  implementation) — per Shahid's own "thinking" / "doing" framing. This
  repository MUST NOT describe either company doing the other's half of
  that split as its primary characterization.

**Naming**

- **FR-007**: This repository MUST use "Shahid N. Shah" as the primary
  name, consistent with the `Person` structured-data node on
  `shahidshah.com`, and MAY use "Shahid Shah" as the alternate name that
  same source declares.

**Digital twin**

- **FR-011**: This repository MUST describe itself as the public tier of
  a professional digital twin — structured content a person or an AI
  agent can read and reason from — and MUST NOT represent itself as a
  live, autonomous, or conversational agent that answers on Shahid's
  behalf. Nothing in this repository executes; it's read.
- **FR-012**: A future, more detailed, private or sensitive tier of the
  digital twin concept MAY be described as Shahid's stated intent, for
  himself and for others who build the same pattern, but MUST NOT be
  described as already built, scheduled, or committed to a timeline
  unless and until it actually exists.

## Key entities

**Shahid N. Shah** — Fractional CTO, CISO, and Chief Technology & Venture
Officer (CTVO); inventor (34 awarded U.S. patents); author; keynote
speaker. 35 years of engineering experience. Education: M.Sc. in
Technology Management, University of Maryland (1998); B.Sc. in Computer
Science, Penn State Harrisburg (1990). Primary public site:
`shahidshah.com`. Primary professional email: `shahid@shah.org`.

**Companies founded: six** (per Shahid's direct statement 2026-09-16 —
see Clarifications, resolving OQ-5): Netspective Communications and
Intellectual Frontiers (active — see Personal active companies below);
Physia, simplifyMD, and Citus Health (co-founded, venture-backed, each
exited via acquisition, Shahid no longer affiliated with any of the
three); and Influential Networks (closed, no longer operating). This
supersedes the site's "05 Cos Founded" stat, which predates Intellectual
Frontiers' founding.

**Personal active companies** (Shahid's own term, stated directly
2026-09-15 — see Clarifications; 2 of the 6 companies founded, above):

| Property | Role | Status | What it's for |
| --- | --- | --- | --- |
| [Intellectual Frontiers LLC](https://www.intellectualfrontiers.com) | Founder, owner, Managing Partner | Current — see spec 0002 | "Thinking": research, publishing, capital and venture decisions |
| [Netspective Communications LLC](https://www.netspective.com) | Founder and CEO | Founded 2001, still operating | "Doing": builds the software and solutions IF's thinking calls for |

**Principal non-profit vehicle:**

| Property | Role | Status |
| --- | --- | --- |
| [Netspective Foundation](https://www.netspective.foundation/) | Co-founder | Shahid's principal non-profit vehicle |

**Brand and personal partnership:**

| Property | Role | Status |
| --- | --- | --- |
| [HealthIMPACT](https://www.healthimpactlive.com) | Co-founder and Chair | Active since 2013. A brand built on Shahid's personal partnership with [Purpose Events](https://purposeevents.com), not a company he owns outright. |

**Intellectual Frontiers Studios projects, delivered by Netspective
Communications** (per Shahid's direct statement 2026-09-15 — these are
projects, not independent personal ventures or companies. Consistent
with FR-010's thinking/doing split: IF Studios decides what should exist,
Netspective builds it):

- [Medigy](https://www.medigy.com)
- [Opsfolio](https://www.opsfolio.com)
- [Resource Surveillance / surveilr](https://www.surveilr.com)
- [Qualityfolio](https://qualityfolio.dev)
- [Fleetfolio](https://fleetfolio.dev)
- **[Unblock Health](https://www.unblock.health)** — began as an IF
  Studios research project implemented by Netspective Communications;
  later pursued as a venture in partnership with Grace Cordovano,
  exploring how release-of-information and medical-records-transfer
  processes for cancer and specialty care could be improved. Currently
  remains an active research project, not a company. (`founderMode.ts`'s
  "Operating" label described the project's activity, not incorporation
  — see Clarifications.)
- And other projects fitting the same pattern, per FR-009.

**Historical / exited companies** (three of the six companies founded —
see above; per Shahid's direct statement 2026-09-16, each was
venture-backed and Shahid is no longer affiliated with any of them):

| Property | Role | Outcome |
| --- | --- | --- |
| Physia | Co-founder and CTO | Venture-backed; IP assets acquired by COMSYS; no longer affiliated |
| simplifyMD | Co-founder and CTO | Venture-backed; merged with Azalea Health, 2014; no longer affiliated |
| Citus Health | Co-founder, CTO, early Chairman | Venture-backed; acquired by ResMed, 2021; no longer affiliated |

**Closed company** (the sixth of the six companies founded):

| Property | Role | Outcome |
| --- | --- | --- |
| Influential Networks | Co-founder | Closed — no longer operating |

Note: HealthcareGuy and HITSphere were previously listed here as
"founder-led media properties." Per Shahid's direct statement 2026-09-16,
they're past publications, not companies, and don't count toward the
companies-founded figure — see Media and Publishing Properties below, and
OQ-7.

**Media and publishing properties** (per `network.ts`'s `publications`;
current-vs-historical status not stated for most of these — see Open
Questions):

- [Medigy](https://www.medigy.com) — see Studios projects above; listed
  here too because `network.ts` categorizes it as a publication, which
  this spec doesn't resolve further than noting the overlap.
- [GovCon Intelligence](https://govconic.com)
- [Compliant Insecurity](https://compliantinsecurity.com/)
- [Healthcare Guys](https://www.healthcareguys.com)
- [The Healthcare IT Guy](https://www.healthcareguy.com)
- HealthcareGuy / HITSphere — past publications, per Shahid's direct
  statement 2026-09-16 (moved here from the companies list; see
  Clarifications). How these relate to Healthcare Guys and The
  Healthcare IT Guy above isn't settled — see OQ-7.
- [Operational Truth](https://operationaltruth.org)
- Unsafely Compliant (no public URL given in the source)

Note: his authored books (the *Shahid Shah Fieldbooks* series, including
*The Code Takes Care of Itself*) are published under Intellectual
Frontiers Press, an IF Press unit function per
`intellectual-frontiers/.github`'s glossary ("Founder writing"). Not
duplicated here — see spec 0002.

**Media channels** (broadcast and recorded work, not separate companies —
per `onAir.ts`): *The Shahid Shah Show* (weekday radio, HealthcareNOW
Radio); YouTube (130+ videos); SpeakerDeck (76 decks) and an older
SlideShare archive (40 decks); *The #HCBiz Show!* (200+ episodes,
co-hosted with Don Lee, 2017–2023, concluded); *Trending NOW*
(HealthcareNOW Radio, concluded, superseded by *The Shahid Shah Show*).

**Board, advisory, and investment roles** (per `founderMode.ts`'s
`boardRoles`, with Hoy Health and Manos Health's status confirmed
directly by Shahid 2026-09-16 — see Clarifications): Citus Health
(Chairman, former), Hybrent (board member, former), Caristix (board
member, previously), OSEHRA (Chairman of Strategic Board of Advisors,
previously), Hoy Health (Strategic Board of Advisors, **former**), Larta
Institute (advisor, previously), AHIP Innovation Lab (adviser and EiR,
previously), Manos Health (Regulatory and Technology Advisor,
**current**), plus investor roles in Goomzee, Poliwogg, Buddie/Teleport,
and Twazer.

## Success criteria

- **SC-001**: Every property named in this spec traces to a specific
  source file, first-party statement, or dated Clarification — no
  property is asserted from general knowledge.
- **SC-002**: No two source files' conflicting statements about the same
  property are silently resolved in this spec without a dated
  Clarifications entry recording how.
- **SC-003**: A reader can determine, for any property named here,
  whether its status is current, historical, or unconfirmed, and which
  category it belongs to (personal active company, non-profit vehicle,
  brand/partnership, co-founded venture, historical venture, or
  Studios-delivered project).

## Out of scope

- Individual specs for every property named above. Following
  `intellectual-frontiers/.github`'s own advice ("start with one unit, not
  the whole thing"), this first pass writes a full spec only for
  Intellectual Frontiers (spec 0002), since it already has its own
  governed repository to cite. The rest are listed here, in one place,
  rather than each getting a thin placeholder spec of uncertain value —
  see OQ-6.
- Financial detail of any kind: valuations, compensation, fund sizes,
  ownership percentages, revenue. Per FR-002 and the company repo's own
  non-disclosure precedent.
- A personal constitution or doctrine. See Personal Principles above.
- Anything about Shahid's private life, family, or personal legal/medical
  history not already published on `shahidshah.com`.

## Open questions

- ~~**OQ-1**: Netspective Foundation's categorization.~~ **Resolved
  2026-09-15** — see Clarifications: it's Shahid's principal non-profit
  vehicle, co-founded by him.
- ~~**OQ-2**: Medigy and Opsfolio's categorization.~~ **Resolved
  2026-09-15** — see Clarifications: Studios-delivered projects, built by
  Netspective Communications, not independent personal ventures. (Note:
  `network.ts` still lists Medigy under `publications` too — that overlap
  is noted in Key Entities but not further resolved.)
- ~~**OQ-3**: Hoy Health seat, current or former.~~ **Resolved
  2026-09-16** — see Clarifications: former. `founderMode.ts`'s
  "Previously served as" label was correct; `recognition.ts`'s "Since
  2016" (current) label is superseded.
- ~~**OQ-4**: Manos Health seat, current or former.~~ **Resolved
  2026-09-16** — see Clarifications: current. `recognition.ts`'s
  "Current" label was correct; `founderMode.ts`'s "Previously served as"
  label is superseded.
- ~~**OQ-5**: Which companies count toward "5 Cos Founded."~~ **Resolved
  2026-09-16** — see Clarifications: six companies, not five —
  Netspective Communications and Intellectual Frontiers (active); Physia,
  simplifyMD, and Citus Health (exited via acquisition); Influential
  Networks (closed). The site's "05" figure predates Intellectual
  Frontiers and is superseded.
- **OQ-6**: Whether any property beyond Intellectual Frontiers should get
  its own numbered spec (`0003-...` onward) in a future pass — and if so,
  which ones warrant it (Netspective Communications and HealthIMPACT seem
  like the strongest candidates, given they're both long-running and
  already have public sites of their own) — is an open decision for
  Shahid, not resolved here. See Out of Scope.
- **OQ-7**: "Healthcare Guys" (`healthcareguys.com`), "The Healthcare IT
  Guy" (`healthcareguy.com`), and "HITSphere" appear to be three related
  but distinct media properties, but the source material doesn't state
  how they relate to each other (imprint vs. syndication vs. rebrand) or
  whether HITSphere is still active — it has no URL in either source
  file. Partially informed 2026-09-16: Shahid confirmed HealthcareGuy and
  HITSphere are "past publications" (not companies), which suggests
  neither is currently active, but the relationship between all three
  properties is still unresolved. `[NEEDS CLARIFICATION]`

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / MAY), not aspirational
- [x] No implementation detail
- [x] Every requirement and entity traces to a named source file, a
      dated Clarification, or a first-party statement (see Traceability)
- [x] Ambiguities are marked `[NEEDS CLARIFICATION]`, not silently resolved
- [x] Public-safe: no confidential information, no unverified financial or
      personal detail stated as settled fact

## Traceability

| Requirement / entity | Source |
| --- | --- |
| FR-001 | `intellectual-frontiers/.github/context/company.md` (claims standard), applied to this repository |
| FR-002 | `shahidshah.com` published content only; company repo's non-disclosure precedent |
| FR-003 | `www.shahidshah.com` `src/content/founderMode.ts` (self-stated labeling rule) |
| FR-004 | `intellectual-frontiers/.github/spec-kit/memory/constitution.md` §5, extended |
| FR-005, FR-006 | `intellectual-frontiers/.github` README, "Canonical source, going forward" |
| FR-007 | `www.shahidshah.com` `src/content/structuredData.ts` (`personNode`) |
| FR-008 | Shahid N. Shah, direct statement, 2026-09-15 |
| FR-009 | Shahid N. Shah, direct statement, 2026-09-15 |
| FR-010 | Shahid N. Shah, direct statement, 2026-09-15 |
| FR-011, FR-012 | Shahid N. Shah, direct statement, 2026-09-15 |
| Education | `www.shahidshah.com` `src/content/site.ts` (`education`) |
| Personal active companies | Shahid N. Shah, direct statement, 2026-09-15; `www.shahidshah.com` `src/content/founderMode.ts` |
| Netspective Foundation | Shahid N. Shah, direct statement, 2026-09-15; `www.shahidshah.com` `src/content/network.ts` |
| HealthIMPACT / Purpose Events | Shahid N. Shah, direct statement, 2026-09-15; `www.shahidshah.com` `src/content/site.ts` (`healthImpact`), `src/content/founderMode.ts` |
| Unblock Health | Shahid N. Shah, direct statement, 2026-09-15; `www.shahidshah.com` `src/content/founderMode.ts` (`founderRecord`, prior "Operating" label) |
| Studios projects delivered by Netspective | Shahid N. Shah, direct statement, 2026-09-15 |
| Historical ventures | `www.shahidshah.com` `src/content/founderMode.ts` (`founderRecord`) |
| Media and publishing properties | `www.shahidshah.com` `src/content/network.ts` (`publications`) |
| Media channels | `www.shahidshah.com` `src/content/onAir.ts` |
| Board / advisory / investment roles | `www.shahidshah.com` `src/content/founderMode.ts` (`boardRoles`) |
| OQ-3, OQ-4 (resolved) | Shahid N. Shah, direct statement, 2026-09-16; `www.shahidshah.com` `src/content/founderMode.ts` (`boardRoles`) vs. `src/content/recognition.ts` (`advisorySeats`) |
| Personal principles | Shahid N. Shah, direct statement, 2026-09-15 |
| Companies founded (six); historical/closed company outcomes | Shahid N. Shah, direct statement, 2026-09-16; `www.shahidshah.com` `src/content/founderMode.ts` (`founderRecord`, `site.ts` "05 Cos Founded" superseded) |
| HealthcareGuy / HITSphere reclassified as publications | Shahid N. Shah, direct statement, 2026-09-16 |
