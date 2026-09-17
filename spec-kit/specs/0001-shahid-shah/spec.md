# Feature Specification: Shahid N. Shah

**Spec ID:** 0001-shahid-shah
**Status:** Draft — clarified 2026-09-17
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
`src/content/onAir.ts`, `src/content/skills.ts`, `src/routes/about.tsx`,
and `public/llms.txt`), from the live repository listings at
[github.com/shah](https://github.com/shah) and the
[netspective](https://github.com/netspective) and
[alim-foundation](https://github.com/alim-foundation) GitHub
organizations, from Shahid's published research on
[Eidolons](https://www.intellectualfrontiers.com/research/eidolons),
and from Shahid's own direct statements where those sources needed
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

## Eidolon

This repository is Shahid's own Eidolon — a term he's since defined
properly in his own published research:
[Eidolon: Working Digital Reflections for AI Workforce and Labor as
Code](https://www.intellectualfrontiers.com/research/eidolons), an
Intellectual Frontiers research pillar. Earlier in this repository's
history this same idea was called a "digital twin"; that term is
retired here on purpose — see "Why not a digital twin?" below. For the
full argument, read the research page directly; what follows is only
enough to orient a reader of this spec.

Per that page, an Eidolon is "a working digital reflection of a person,
company, customer, product or system. It is not a replica. It contains
enough grounded reality for AI to reason about the original accurately
and flexibly." The word is the ancient Greek εἴδωλον — an image or
likeness the classical sources are careful never to confuse with the
thing it reflects. That's the distinction that matters here too: an
Eidolon of Shahid is not Shahid.

**What that means for this repository specifically:**

- It's a **read reference, not a live agent**. The research page's own
  account of this repository already makes the point directly: it's
  "structured source material for people and AI agents, not a live
  agent pretending to be me." Nothing here holds a conversation or gives
  advice on Shahid's behalf in real time — see FR-011.
- It's expressed as **readable specifications** — this spec-kit, not a
  proprietary vendor memory system — so any AI (Claude, Codex, Gemini,
  whatever comes after) can read it the same way a person does. Per the
  research page: "The Eidolon belongs to the person or organization, not
  to the AI engine."
- It has **tiers** — public, internal, confidential, and highly
  restricted, per the research page's model. This repository is the
  **public tier only**. The others don't exist here, and this repository
  doesn't promise a timeline or shape for them — see FR-012.
- It's **working, not exhaustive**. An Eidolon doesn't need every fact
  about Shahid, only enough for a reader — human or AI — to reason about
  him accurately for whatever they're actually trying to do. That's the
  same reason this spec marks real gaps `[NEEDS CLARIFICATION]` instead
  of padding itself out to look complete.

**Why not a digital twin?** Briefly, because the engineering standards
that have accumulated around "digital twin" — NIST, the Digital Twin
Consortium, the National Academies: real-time bidirectional
synchronization, predictive capability, continuous lifecycle
connection — fit a jet engine or a factory floor, not a person's public
profile. The research page makes the full argument; this repository
just uses the word Shahid settled on instead.

If you're reading this to build a similar profile for yourself rather
than to learn about Shahid specifically: see "Build your own Eidolon" in
the root [`README.md`](../../../README.md) and
[`spec-kit/AGENTS.md`](../../AGENTS.md) for what generalizes and what's
specific to him.

## Technical skills

Two independent sources, cross-referenced rather than merged into one
undifferentiated list, per Shahid's direct instruction on how to weigh
them:

- **LinkedIn** — the endorsed-skills list already in
  `www.shahidshah.com`'s `src/content/skills.ts` (2,513 total
  endorsements across 49 named skills, sourced from his LinkedIn
  profile).
- **GitHub** — every public repository under Shahid's personal account,
  [github.com/shah](https://github.com/shah) (70 repositories: 10 forks
  and 1 repository with an unverified fork status excluded, 59
  counted — including 4 archived repositories, which still count as
  Shahid's own original code), the
  [netspective](https://github.com/netspective) organization (38
  repositories, 4 forks excluded, 34 remaining), and the
  [alim-foundation](https://github.com/alim-foundation) organization (12
  repositories, no forks) — per Shahid's direct statement, all three
  count as his own evidence. 105 repositories total, checked
  2026-09-16, each repository's primary language as GitHub itself
  detects it. (See OQ-9's resolution for how the `shah`-account figure
  changed from an earlier, incomplete 64.)

**Classification rule** (per Shahid's direct statement, formalized as
FR-013): a skill is a **Proven skill** whenever there's direct evidence of
actual code — a non-fork GitHub repository's detected primary language,
or an equivalent code artifact elsewhere — regardless of whether it also
appears on the LinkedIn list. A skill with no code evidence, appearing
only on the LinkedIn-endorsed list, is labeled a **Skill**, not a Proven
skill. This is a mechanical, reproducible check (does code evidence
exist, yes or no), not a judgment call about which skills "feel" true —
see the Review checklist's public-safe standard.

**Proven skill — direct GitHub evidence** (a non-fork repository's
detected primary language, across Shahid's personal `shah` account and
the `netspective` and `alim-foundation` orgs; LinkedIn endorsement count
shown where that skill also happens to be endorsed there, though
endorsement isn't what makes it Proven):

| Skill | Repositories (shah + netspective + alim-foundation) | Also LinkedIn-endorsed |
| --- | --- | --- |
| TypeScript | 32 (32 + 0 + 0) | — |
| JavaScript | 12 (1 + 10 + 1) | 13 |
| Shell | 9 (8 + 1 + 0) | — |
| C++ | 6 (0 + 6 + 0) | 14 |
| Go | 6 (5 + 1 + 0) | — |
| Java | 5 (0 + 5 + 0) | 24 |
| HTML | 4 (1 + 2 + 1) | — |
| Makefile | 4 (3 + 1 + 0) | — |
| PHP | 2 (0 + 1 + 1) | 11 |
| CSS | 2 (1 + 1 + 0) | — |
| Python | 1 (1 + 0 + 0) | — |
| Perl | 1 (1 + 0 + 0) | — |
| Pascal | 1 (0 + 0 + 1) | — |
| Smarty | 1 (0 + 0 + 1) | — |
| Astro, Handlebars, ActionScript, Ruby, Jsonnet, Dockerfile | 1 each (netspective, except Jsonnet/Dockerfile which are shah) | — |

Four `shah`-account repositories in this table are archived rather than
active (three TypeScript: `ts-safe-template`, `tsd-typed-data-gen`,
`tsn-periodicals-anchors-classifier`; one Makefile:
`container-appliance-framework`) — archiving a repository doesn't erase
that it's Shahid's own original code, so they're counted the same as
active ones. Excluded from the table entirely: 10 forks across `shah`
and 4 across `netspective`; one `shah` repository
(`ts-lhncbc-lforms`) whose fork status this check couldn't verify
consistently — an earlier fetch called it a fork, a later one didn't, so
it's excluded rather than guessed at either way; `netspective`'s
`enterprise-architecture` (showed licensing text where a language would
normally appear); and seven of `alim-foundation`'s twelve repositories
(several older Delphi-era projects — `arabic-playhouse-1.0-delphi`,
`alim-mobile-android`, `alim-mobile-common`, `daily-islam-1.0-delphi`,
`prayer-minder-1.0-delphi`, `www.arabicplayhouse.com`,
`www.communityquran.com` — where GitHub didn't surface a primary
language).

**Proven skill — general software-engineering competency** (the combined
GitHub portfolio — 105 public repositories across `shah`, `netspective`,
and `alim-foundation`, multiple languages, sustained activity — is
itself the code evidence for these general skills, rather than any
single repository's language tag; all five also happen to be
LinkedIn-endorsed):

| Skill | LinkedIn endorsements |
| --- | --- |
| Software Development | 209 |
| Software Engineering | 86 |
| Software Design | 54 |
| SDLC | 47 |
| Programming | 25 |

**Skill** (LinkedIn-endorsed; no direct code evidence found across any
GitHub source): Enterprise Architecture (283), Agile Methodologies (238),
Software Project Management (155), IT Strategy (146), Product Management
(111), Integration (96), Healthcare Information Technology (76), Cloud
Computing (70), Healthcare (68), System Architecture (67), Investment
Advisory (62), Entrepreneur (61), Engaging Public Speaker (57), Business
Intelligence (52), Unix (51), Requirements Analysis (47), Security (39),
SaaS (37), SQL (29), Mobile Applications (23), Linux (23), Equity
Research (21), Technology Strategy Development (21), Valuation (18),
Board of Directors (16), Medical Device R&D (16), SOA (16), Operating
Systems (12), C (12), Technical Management (11), Information
Architecture (11), Healthcare IT (11), Application Architecture (11),
Medical Informatics (11), Relational Databases (10), J2EE (10), Due
Diligence (9), Agile (9), Publisher (3), Writer (2).

Worth noting rather than smoothing over: adding the `netspective` org
moved Java, C++, and PHP from Skill to Proven skill — evidence Shahid's
personal `shah` account alone didn't show. Adding `alim-foundation`
reinforced PHP (a second, independent repository) and added Pascal and
Smarty — both new Proven skills with no LinkedIn counterpart at all,
evidence of an older Delphi-era stack from the original Alim software
(see Companies and Organizations Founded, above). C, SQL, and J2EE
remain Skill-only: no non-fork repository in any of the three sources
matches them (one `netspective` repo, `pdflib-2.0.1-patched-ubuntu`, is
C, but it's a fork, and forks don't count as evidence of Shahid's own
code). Unix and Linux come close — nine repositories are Shell scripts,
and one is named `linux-user-conf` — but "Shell" isn't the literal
string "Unix" or "Linux," so under the classification rule above they
stay a plain Skill rather than a Proven skill. That's the rule working
as intended: close isn't the same as matched.

Read together, the two Proven-skill tables are Shahid's actual
technology stack by volume of public work across all three GitHub
sources (TypeScript and JavaScript-heavy, with meaningful C++ and Java
from Netspective, older Pascal and PHP work from Alim Foundation, plus
Go, Shell, Python, and Perl), and it still doesn't fully overlap with
what LinkedIn's endorsers voted on — an honest gap between a profile
built by other people's endorsements over time and a portfolio he
actively maintains today. See OQ-9 for a repo-count discrepancy this
check surfaced, and later corrected.

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
- **Q: How do Healthcare Guys, The Healthcare IT Guy, and HITSphere
  relate to each other?** → **A: Three distinct things.** The Healthcare
  IT Guy (`healthcareguy.com`) is Shahid's personal-opinion blog —
  mostly historical but still live; his current personal writing has
  moved to `shahidshah.com/writing`. Healthcare Guys (`healthcareguys.com`,
  plural) is a separate, active, multi-contributor blog with posts
  written by others, on similar topics but not the same property.
  HITSphere is neither — Shahid founded it, and it was later acquired
  and rolled into Medigy. Resolves OQ-7.
- **Note:** HITSphere's founded-and-acquired history matches the pattern
  already used for Physia, simplifyMD, and Citus Health in the
  companies-founded count (OQ-5), which raised a question about whether
  HITSphere should be a seventh entry there. See below.
- **Q: Should HITSphere count as a seventh company in the
  companies-founded figure?** → **A: No.** Per Shahid's direct statement:
  "HITSphere was a publication with a domain but not a company." The
  founded/acquired verbs are the same ones used for Physia, simplifyMD,
  and Citus Health, but the underlying entity wasn't a company in the
  way those three were. Companies-founded figure stays at six. Resolves
  OQ-8.
- **Q: Should Netspective Communications or HealthIMPACT get their own
  numbered spec (0003, 0004)?** → **A: Neither, for now.** Shahid's
  choice, given neither has its own governed spec-kit repository to cite
  the way Intellectual Frontiers does (spec 0002's actual justification),
  and per the company repo's own "start with one unit, not the whole
  thing" precedent. Both remain entries inside this spec. Resolves OQ-6.
- **Q: What are Shahid's actual technical skills, and which are the most
  credible?** → **A: Cross-referenced from two independent sources —**
  the LinkedIn-endorsed skills already in `skills.ts`, and every
  non-fork public repository under
  [github.com/shah](https://github.com/shah) (64 total, 8 forks, 56
  non-fork, checked 2026-09-16). This surfaced a new discrepancy —
  `openSource.ts` states "70+" public repos, but the actual count
  checked today is 64 — see OQ-9.
- **Q: Should "Proven" require both LinkedIn and GitHub evidence, or is
  code evidence alone enough?** → **A: Code evidence alone is enough —
  corrected.** Shahid's direct correction to the initial rule above: a
  **Proven skill** is anything with direct code evidence (GitHub or
  elsewhere), whether or not it's also LinkedIn-endorsed. A skill with no
  code evidence — LinkedIn only — is labeled a plain **Skill**, not
  "Valid." This supersedes the original dual-source "Proven" rule from
  earlier in this session. See the revised "Technical skills" section
  above and FR-013.
- **Q: Should code-evidence-gathering stay limited to the `shah` personal
  GitHub account, or include Shahid's other GitHub organizations?** →
  **A: Include them — starting with `netspective`.** Per Shahid's direct
  statement, the `netspective` org's repositories (Netspective
  Communications' own org, 38 total, 34 non-fork) count as his personal
  code evidence too. This added Java, C++, and PHP as Proven skills that
  weren't otherwise evidenced. The `alim-foundation` org, also found in
  this check, is handled separately — see below.
- **Q: What is Alim Foundation, and what's Shahid's relationship to
  it?** → **A: A non-profit he co-founded and now chairs.** Full
  history, per Shahid's direct statement: he co-founded ISL Software
  (closed, early 2000s), which created the original "The Alim" Islamic
  software; that work was later brought online as the non-profit Alim
  Foundation (co-founded by Shahid, active since 2006, at
  [alim.org](https://alim.org)), which he currently chairs. Not
  previously mentioned anywhere on `shahidshah.com`.
- **Q: Any other organizations in the same category?** → **A: Minaret
  of Freedom** (minaret.org), a think tank focused on Islam and liberty,
  co-founded by Shahid, still active. He served on its board for a time
  and is now its volunteer Treasurer. Also not previously mentioned on
  `shahidshah.com`.
- **Q: Do ISL Software, The Alim Foundation, and Minaret of Freedom
  count toward the companies-founded figure?** → **A: Yes — and so does
  Netspective Foundation, which wasn't counted before.** Per Shahid's
  direct statement: non-profits count toward the figure the same as
  for-profit companies. This raises the total from six to **ten**: 2
  active companies, 3 exited via acquisition, 2 closed (Influential
  Networks, ISL Software), and 3 active non-profits (Netspective
  Foundation, Alim Foundation, Minaret of Freedom). Supersedes the
  six-company resolution earlier in this session.
- **Q: Should `alim-foundation`'s GitHub org repositories also count as
  Shahid's code evidence, like `netspective`'s?** → **A: Yes.** Per
  Shahid's direct statement. Twelve repositories, no forks, added to the
  Technical Skills evidence base (102 non-fork repositories total across
  all three sources). This reinforced PHP and added Pascal and Smarty as
  new Proven skills, from the original Alim software's Delphi-era stack.
- **Q: Revisit OQ-9 — why did `openSource.ts` say "70+" repos when this
  check found only 64?** → **A: This check was wrong, not the site.**
  The original fetch used GitHub's `type=source` filter, which silently
  drops archived repositories and some forks. Refetched with
  `type=all`: 70 total, matching "70+." Corrected count: 10 forks, 1
  repository (`ts-lhncbc-lforms`) with an unverified fork status
  (excluded rather than guessed at), 4 archived (still counted as
  Shahid's own code), 59 counted from the `shah` account — up from the
  earlier, incomplete 56. Combined with `netspective` (34) and
  `alim-foundation` (12): 105 repositories total. Resolves OQ-9. See the
  revised Technical Skills section above.

### Session 2026-09-17

- **Q: Should this repository keep using "digital twin," or adopt
  different terminology?** → **A: "Eidolon."** Shahid has since
  published a formal research pillar defining the concept —
  [Eidolon: Working Digital Reflections for AI Workforce and Labor as
  Code](https://www.intellectualfrontiers.com/research/eidolons) — and
  deliberately retiring "digital twin," arguing that the engineering
  standards attached to that term (NIST, the Digital Twin Consortium,
  the National Academies: real-time bidirectional synchronization,
  predictive capability, continuous lifecycle connection) overpromise
  for what a personal profile actually needs. This repository adopts
  his terminology throughout: the "Digital twin" section is renamed
  "Eidolon," FR-011 and FR-012 are reworded accordingly, and every other
  reference to "digital twin" in this repository (and in
  `spec-kit/AGENTS.md` and the root `README.md`) is updated to
  "Eidolon" with a link to the research page rather than restating its
  argument. Earlier Clarification entries above that used "digital
  twin" are left as an accurate record of what was decided at the time,
  not rewritten.

## Primary scenario

Someone — a journalist, a founder considering a co-founder CTO
relationship, a conference organizer, an LP evaluating Intellectual
Frontiers, a job candidate, someone deciding whether Shahid could help
with a project, or another AI agent researching or representing Shahid
Shah — encounters one of his properties (a company, a publication, a
podcast, a patent) and needs to know what it actually is, how it relates
to Shahid and to his other properties, and whether a claim about it is
current, historical, or unconfirmed. This repository is written to be
that reference: the public tier of Shahid's Eidolon, read by a person or
an AI, rather than answered by one living inside it. See Eidolon above.

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
   they call it an "Eidolon," **then** the description must make clear
   it's a read reference (public tier, structured content), not a live
   agent that itself converses or gives advice — per FR-011. **Given**
   someone uses the older "digital twin" language instead, **then** the
   description should note that Shahid retired that term in favor of
   Eidolon (see Eidolon, above) rather than treat the two as
   interchangeable without comment.
8. **Given** a skill appears on the LinkedIn list with no matching code
   evidence anywhere, **when** this spec labels that skill, **then** it
   must say plain "Skill," never "Proven skill" — per FR-013. **Given** a
   skill has direct code evidence (a GitHub repository's primary
   language) whether or not it's separately LinkedIn-endorsed, **then**
   it must say "Proven skill."

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

**Eidolon**

- **FR-011**: This repository MUST describe itself as Shahid's Eidolon
  (per [Eidolon: Working Digital Reflections for AI Workforce and Labor
  as Code](https://www.intellectualfrontiers.com/research/eidolons)),
  public tier only — structured content a person or an AI agent can
  read and reason from — and MUST NOT represent itself as a live,
  autonomous, or conversational agent that answers on Shahid's behalf.
  Nothing in this repository executes; it's read.
- **FR-012**: The Eidolon's internal, confidential, and highly
  restricted tiers, per the research page's own tier model, MAY be
  described as Shahid's stated intent, for himself and for others who
  build the same pattern, but MUST NOT be described as already built,
  scheduled, or committed to a timeline unless and until they actually
  exist.

**Technical skills**

- **FR-013**: A skill MUST be labeled a "Proven skill" whenever there is
  direct evidence of actual code demonstrating it — a non-fork GitHub
  repository's detected primary language, or an equivalent code
  artifact — regardless of whether that skill also appears on the
  LinkedIn-sourced skills list (`www.shahidshah.com`'s
  `src/content/skills.ts`). A skill with no code evidence, appearing
  only on the LinkedIn list, MUST be labeled a plain "Skill," not a
  Proven skill. A closely related term (e.g., "Unix"/"Linux" as a
  LinkedIn skill versus "Shell" as a detected GitHub language) MUST NOT
  be treated as a code-evidence match — the check is mechanical, not
  interpretive.

## Key entities

**Shahid N. Shah** — Fractional CTO, CISO, and Chief Technology & Venture
Officer (CTVO); inventor (34 awarded U.S. patents); author; keynote
speaker. 35 years of engineering experience. Education: M.Sc. in
Technology Management, University of Maryland (1998); B.Sc. in Computer
Science, Penn State Harrisburg (1990). Primary public site:
`shahidshah.com`. Primary professional email: `shahid@shah.org`.

**Companies and organizations founded: ten** (per Shahid's direct
statement 2026-09-16 — see Clarifications, resolving and then expanding
OQ-5). Shahid's own count includes non-profits alongside for-profit
companies:

- **Active companies (2)**: Netspective Communications, Intellectual
  Frontiers — see Personal active companies below.
- **Exited via acquisition (3)**: Physia, simplifyMD, Citus Health —
  co-founded, venture-backed, Shahid no longer affiliated with any.
- **Closed (2)**: Influential Networks, ISL Software — no longer
  operating.
- **Active non-profits (3)**: Netspective Foundation, The Alim
  Foundation, Minaret of Freedom — see Non-profit vehicles founded,
  below.

This supersedes the site's "05 Cos Founded" stat, which predates
Intellectual Frontiers' founding and doesn't count non-profits at all.
HITSphere (founded by Shahid, later acquired into Medigy) still does not
count — resolved as a publication, not a company or organization; see
OQ-8.

**Personal active companies** (Shahid's own term, stated directly
2026-09-15 — see Clarifications; 2 of the 10 companies and
organizations founded, above):

| Property | Role | Status | What it's for |
| --- | --- | --- | --- |
| [Intellectual Frontiers LLC](https://www.intellectualfrontiers.com) | Founder, owner, Managing Partner | Current — see spec 0002 | "Thinking": research, publishing, capital and venture decisions |
| [Netspective Communications LLC](https://www.netspective.com) | Founder and CEO | Founded 2001, still operating | "Doing": builds the software and solutions IF's thinking calls for |

**Non-profit vehicles founded** (3 of the 10 companies and organizations
founded, above; per Shahid's direct statement 2026-09-16, non-profits
count toward that figure the same as for-profit companies):

| Property | Role | Status |
| --- | --- | --- |
| [Netspective Foundation](https://www.netspective.foundation/) | Co-founder | Active |
| [The Alim Foundation](https://alim.org) | Co-founder; current Chair | Active since 2006. Grew out of "The Alim" Islamic software, originally created by ISL Software (see Closed companies, below), later brought online as this non-profit. |
| [Minaret of Freedom](https://minaret.org) | Co-founder; former board member, now volunteer Treasurer | Active. A think tank focused on Islam and liberty. |

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

**Historical / exited companies** (3 of the 10 companies and
organizations founded — see above; per Shahid's direct statement
2026-09-16, each was venture-backed and Shahid is no longer affiliated
with any of them):

| Property | Role | Outcome |
| --- | --- | --- |
| Physia | Co-founder and CTO | Venture-backed; IP assets acquired by COMSYS; no longer affiliated |
| simplifyMD | Co-founder and CTO | Venture-backed; merged with Azalea Health, 2014; no longer affiliated |
| Citus Health | Co-founder, CTO, early Chairman | Venture-backed; acquired by ResMed, 2021; no longer affiliated |

**Closed companies** (2 of the 10 companies and organizations founded):

| Property | Role | Outcome |
| --- | --- | --- |
| Influential Networks | Co-founder | Closed — no longer operating |
| ISL Software | Co-founder | Closed, early 2000s. Created the original "The Alim" Islamic software, later brought online as the non-profit Alim Foundation — see Non-profit vehicles founded, above. |

Note: HealthcareGuy and HITSphere were previously listed here together as
"founder-led media properties" and excluded from the companies-founded
figure as a pair. A closer look (OQ-7, OQ-8) confirmed both are correctly
excluded, for different reasons: HealthcareGuy is Shahid's
personal-opinion blog, and HITSphere — despite being "founded" and later
"acquired," the same verbs used for Physia, simplifyMD, and Citus Health
above — was a publication with a domain, not an incorporated company.
The founded/acquired pattern looks the same on the surface; the entity
underneath it wasn't.

**Media and publishing properties** (per `network.ts`'s `publications`;
current-vs-historical status not stated for most of these — see Open
Questions):

- [Medigy](https://www.medigy.com) — see Studios projects above; listed
  here too because `network.ts` categorizes it as a publication, which
  this spec doesn't resolve further than noting the overlap.
- [GovCon Intelligence](https://govconic.com)
- [Compliant Insecurity](https://compliantinsecurity.com/)
- [Healthcare Guys](https://www.healthcareguys.com) — a separate,
  active, multi-contributor blog (posts written by others), similar
  topics to The Healthcare IT Guy below but a distinct property, not the
  same thing under a pluralized domain. Resolves OQ-7.
- [The Healthcare IT Guy](https://www.healthcareguy.com) — Shahid's
  personal-opinion blog. Mostly historical but still live; his current
  personal writing has moved to
  [shahidshah.com/writing](https://www.shahidshah.com/writing). Resolves
  OQ-7.
- HITSphere — founded by Shahid; a publication with a domain, not a
  company, later acquired and rolled into
  [Medigy](https://www.medigy.com) (see Studios projects above). Not a
  publication still standing on its own today. Resolves OQ-7 and OQ-8.
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
  2026-09-16, then revised same day** — first resolved to six (Netspective
  Communications and Intellectual Frontiers, active; Physia, simplifyMD,
  and Citus Health, exited via acquisition; Influential Networks,
  closed), then expanded to **ten** once Shahid clarified non-profits
  count too and disclosed two more organizations: ISL Software (closed,
  a company) and The Alim Foundation and Minaret of Freedom (active
  non-profits), alongside the already-known Netspective Foundation
  (also active, also now counted). See Clarifications and Companies and
  Organizations Founded, above. The site's "05" figure predates
  Intellectual Frontiers and doesn't count non-profits at all.
- ~~**OQ-6**: Whether Netspective Communications or HealthIMPACT should
  get their own numbered spec.~~ **Resolved 2026-09-16** — see
  Clarifications: neither, for now. Both stay as entries inside this
  spec. Revisit if either genuinely needs more depth than a summary
  table can hold.
- ~~**OQ-7**: How Healthcare Guys, The Healthcare IT Guy, and HITSphere
  relate to each other.~~ **Resolved 2026-09-16** — see Clarifications:
  three distinct things. The Healthcare IT Guy is Shahid's own blog
  (mostly historical, still live); Healthcare Guys is a separate active
  multi-contributor blog; HITSphere was founded by Shahid and later
  acquired into Medigy.
- ~~**OQ-8**: Should HITSphere count as a seventh company in the
  companies-founded figure?~~ **Resolved 2026-09-16** — see
  Clarifications: no. HITSphere was a publication with a domain, not a
  company; the founded/acquired verbs matched Physia, simplifyMD, and
  Citus Health, but the underlying entity didn't. Figure stays at six.
- ~~**OQ-9**: `openSource.ts` states "70+" repos under github.com/shah;
  an earlier check here found only 64.~~ **Resolved 2026-09-16** — the
  site was right; this repository's own first check was wrong. That
  first pass used GitHub's `type=source` filter, which silently
  excludes archived repositories and some forks. Refetched with
  `type=all`: **70 repositories** total, matching the site's "70+"
  almost exactly. 10 are forks, 1 (`ts-lhncbc-lforms`) has a fork status
  this check couldn't verify consistently across two fetches and is
  excluded rather than guessed at, and 4 are archived — still counted,
  since archiving doesn't erase that Shahid wrote the code. See the
  revised Technical Skills section above.

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
| FR-011, FR-012; Eidolon section | Shahid N. Shah, direct statement, 2026-09-15; [Eidolon: Working Digital Reflections for AI Workforce and Labor as Code](https://www.intellectualfrontiers.com/research/eidolons), 2026-09-17 (terminology superseding "digital twin") |
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
| Companies and organizations founded (ten, revised from six); historical/closed company outcomes | Shahid N. Shah, direct statement, 2026-09-16; `www.shahidshah.com` `src/content/founderMode.ts` (`founderRecord`, `site.ts` "05 Cos Founded" superseded) |
| ISL Software, The Alim Foundation, Minaret of Freedom | Shahid N. Shah, direct statement, 2026-09-16 (not previously documented on `shahidshah.com`) |
| HealthcareGuy / Healthcare Guys / HITSphere relationship (OQ-7); HITSphere not a company (OQ-8) | Shahid N. Shah, direct statement, 2026-09-16; `www.shahidshah.com` `src/content/network.ts`, `src/content/posts/archive.ts` (2005 HITSphere reference) |
| No dedicated spec for Netspective Communications or HealthIMPACT (OQ-6) | Shahid N. Shah, direct statement, 2026-09-16 |
| FR-013; Technical skills (Proven skill / Skill tables) | `www.shahidshah.com` `src/content/skills.ts` (LinkedIn-sourced); github.com/shah, github.com/netspective, and github.com/alim-foundation repository listings, fetched 2026-09-16; Shahid N. Shah, direct statements, 2026-09-16 (code evidence alone is sufficient for "Proven skill"; all three GitHub sources count as his own evidence) |
| OQ-9 (resolved: 70 repos, matching "70+") | `www.shahidshah.com` `src/content/openSource.ts` ("70+"); github.com/shah repository listing, refetched with `type=all` 2026-09-16 (70 total, 10 forks, 1 unverified, 4 archived, 59 counted) |
