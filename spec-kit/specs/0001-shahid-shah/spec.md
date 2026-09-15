# Feature Specification: Shahid N. Shah

**Spec ID:** 0001-shahid-shah
**Status:** Draft — first pass
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
`src/content/bios.ts`, `src/content/structuredData.ts`, and
`public/llms.txt`) rather than from this session's own memory or
assumptions.

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

## Clarifications

None yet.

## Primary scenario

Someone — a journalist, a founder considering a co-founder CTO
relationship, a conference organizer, an LP evaluating Intellectual
Frontiers, a job candidate, or another AI agent researching Shahid Shah —
encounters one of his properties (a company, a publication, a podcast, a
patent) and needs to know what it actually is, how it relates to Shahid
and to his other properties, and whether a claim about it is current,
historical, or unconfirmed.

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
4. **Given** a source file on Shahid's own site (`founderMode.ts`,
   `network.ts`, `recognition.ts`, `bios.ts`) states something that
   conflicts with another of his own source files, **when** this spec
   surfaces that fact, **then** it records the conflict as an open
   question rather than silently picking one version. (Several such
   conflicts exist — see Open Questions.)

### Edge cases

- A property's category (company vs. media brand vs. defunct project)
  isn't settled by the source material: marked `[NEEDS CLARIFICATION]` in
  Open Questions, not asserted.
- A property is named in one source file and absent from another
  (e.g., listed as a "company" in one place and as unconfirmed "in-flight
  venture work" in another): recorded as a conflict, not resolved by
  picking the more flattering label.

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

**Naming**

- **FR-007**: This repository MUST use "Shahid N. Shah" as the primary
  name, consistent with the `Person` structured-data node on
  `shahidshah.com`, and MAY use "Shahid Shah" as the alternate name that
  same source declares.

## Key entities

**Shahid N. Shah** — Fractional CTO, CISO, and Chief Technology & Venture
Officer (CTVO); inventor (34 awarded U.S. patents); author; keynote
speaker. 35 years of engineering experience; 5 companies founded per his
own stated count (see Open Questions for how that count squares with the
longer founder record below). Primary public site: `shahidshah.com`.
Primary professional email: `shahid@shah.org`.

**Current companies and ventures** (per `founderMode.ts`'s `founderRecord`,
status as stated there):

| Property | Role | Status |
| --- | --- | --- |
| [Intellectual Frontiers](https://www.intellectualfrontiers.com) | Founder, owner, Managing Partner | Current — see spec 0002 |
| [Netspective Communications](https://www.netspective.com) | Founder and CEO | Founded 2001, still operating |
| [Unblock Health](https://www.unblock.health) | Co-founder (with Grace Cordovano) | Operating |
| [HealthIMPACT](https://www.healthimpactlive.com) | Co-founder and Chair | Active since 2013; 50+ forums, 200+ panels moderated |

**Historical / exited ventures:**

| Property | Role | Outcome |
| --- | --- | --- |
| Physia | Co-founder and CTO | IP assets acquired by COMSYS |
| simplifyMD | Co-founder and CTO | Merged with Azalea Health, 2014 |
| Citus Health | Co-founder, CTO, early Chairman | Acquired by ResMed, 2021 |
| Influential Networks | Co-founder | Historical venture |
| HealthcareGuy / HITSphere | Founder or co-founder, publisher | Founder-led media properties |

**Media and publishing properties** (per `network.ts`'s `publications`;
current-vs-historical status not stated for most of these — see Open
Questions):

- [Medigy](https://www.medigy.com)
- [GovCon Intelligence](https://govconic.com)
- [Compliant Insecurity](https://compliantinsecurity.com/)
- [Healthcare Guys](https://www.healthcareguys.com)
- [The Healthcare IT Guy](https://www.healthcareguy.com)
- [Operational Truth](https://operationaltruth.org)
- Unsafely Compliant (no public URL given in the source)

Note: his authored books (the *Shahid Shah Fieldbooks* series, including
*The Code Takes Care of Itself*) are published under Intellectual
Frontiers Press, an IF Press unit function per
`intellectual-frontiers/.github`'s glossary ("Founder writing"). Not
duplicated here — see spec 0002.

**In-flight venture work** (per `founderMode.ts`'s `currentVentureWork`,
explicitly described there as exploratory and not confirmed as funded
companies): Revenue Acceleration, Medigy, Opsfolio, VIP Care Health, VIP
Care Cardio, OurHakeem, PatientTeam, Neuvist, Payshent, Coordinate with
Care, Netspective Foundation.

**Open source and product projects** (per `network.ts`'s `projects`, and
`openSource.ts`'s 70+ repositories under the `shah` GitHub account):
[Opsfolio](https://www.opsfolio.com),
[Resource Surveillance / surveilr](https://www.surveilr.com),
[Qualityfolio](https://qualityfolio.dev),
[Fleetfolio](https://fleetfolio.dev).

**Board, advisory, and investment roles** (per `founderMode.ts`'s
`boardRoles`): Citus Health (Chairman, former), Hybrent (board member,
former), Caristix (board member, previously), OSEHRA (Chairman of
Strategic Board of Advisors, previously), Hoy Health (Strategic Board of
Advisors, previously per this table — but see Open Questions), Larta
Institute (advisor, previously), AHIP Innovation Lab (adviser and EiR,
previously), Manos Health (Regulatory and Technology Advisor, previously
per this table — but see Open Questions), plus investor roles in Goomzee,
Poliwogg, Buddie/Teleport, and Twazer.

## Success criteria

- **SC-001**: Every property named in this spec traces to a specific
  source file or first-party statement, listed in Traceability below —
  no property is asserted from general knowledge.
- **SC-002**: No two source files' conflicting statements about the same
  property are silently resolved in this spec without a dated
  Clarifications entry recording how.
- **SC-003**: A reader can determine, for any property named here,
  whether its status is current, historical, or unconfirmed.

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

- **OQ-1**: `network.ts` lists Netspective Foundation under `companies`
  (implying an established, current entity), while `founderMode.ts` lists
  it under `currentVentureWork` — explicitly described there as
  exploratory, not-yet-confirmed venture work. These two source files
  disagree about the same entity's maturity. `[NEEDS CLARIFICATION]`
- **OQ-2**: `network.ts` lists Medigy and Opsfolio under `companies` /
  `projects` respectively, while `founderMode.ts` lists both under
  `currentVentureWork`'s explicitly-exploratory bucket. Same conflict as
  OQ-1, different entities. `[NEEDS CLARIFICATION]`
- **OQ-3**: `founderMode.ts`'s `boardRoles` table labels the Hoy Health
  seat "Previously served as," but `recognition.ts`'s `advisorySeats`
  table lists the same seat as "Since 2016" with no former/past label —
  i.e., current. The two tables on the same site disagree about whether
  this role is active. `[NEEDS CLARIFICATION]`
- **OQ-4**: The same conflict as OQ-3 recurs for the Manos Health seat:
  `boardRoles` labels it "Previously served as," `advisorySeats` labels
  it "Current." `[NEEDS CLARIFICATION]`
- **OQ-5**: `site.ts`'s top-level stats state "05 Cos Founded," while
  `founderMode.ts`'s `founderRecord` lists nine named ventures plus
  Intellectual Frontiers (ten), of which several are explicitly
  co-founded rather than founded outright. It isn't stated which five
  count toward the "05" figure, or whether that figure predates some of
  the later entries. `[NEEDS CLARIFICATION]`
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
  file. `[NEEDS CLARIFICATION]`

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / MAY), not aspirational
- [x] No implementation detail
- [x] Every requirement and entity traces to a named source file or
      first-party statement (see Traceability)
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
| Roles, stats | `www.shahidshah.com` `src/content/site.ts`, `public/llms.txt` |
| Current companies / ventures, historical ventures | `www.shahidshah.com` `src/content/founderMode.ts` (`founderRecord`) |
| Media and publishing properties | `www.shahidshah.com` `src/content/network.ts` (`publications`) |
| In-flight venture work | `www.shahidshah.com` `src/content/founderMode.ts` (`currentVentureWork`) |
| Open source / product projects | `www.shahidshah.com` `src/content/network.ts` (`projects`); `src/content/openSource.ts` |
| Board / advisory / investment roles | `www.shahidshah.com` `src/content/founderMode.ts` (`boardRoles`) |
| OQ-3, OQ-4 | `www.shahidshah.com` `src/content/founderMode.ts` (`boardRoles`) vs. `src/content/recognition.ts` (`advisorySeats`) |
| Personal principles | Shahid N. Shah, direct statement, 2026-09-15 |
