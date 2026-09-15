# Feature Specification: Intellectual Frontiers

**Spec ID:** 0002-intellectual-frontiers
**Status:** Draft — first pass
**Created:** 2026-09-15
**Decision authority:** Shahid N. Shah
**Input:** Specify Intellectual Frontiers as one of Shahid Shah's
properties, thinly — citing its own governed repository for everything
about what it is and does, rather than restating any of it here.

## Why this document exists

Intellectual Frontiers LLC is Shahid's venture-building, intellectual
property, publishing, and investment platform — and it already specifies
itself, exhaustively, in
[`intellectual-frontiers/.github`](https://github.com/intellectual-frontiers/.github):
a constitution, a company-level spec, five unit specs, a brand book, a
glossary, and a writing guide. This spec's only job is to say that this
property exists, name Shahid's relationship to it, and point at that
repository for everything else — per
[`spec-kit/specs/0001-shahid-shah/spec.md`](../0001-shahid-shah/spec.md)
FR-005 and FR-006, which require exactly this rather than a competing
second account.

This is not an implementation plan.

## Clarifications

### Session 2026-09-15

- **Q: How do Medigy, Opsfolio, Qualityfolio, Fleetfolio, and similar
  named projects relate to Intellectual Frontiers?** → **A: They are
  projects built by and for Intellectual Frontiers Studios, delivered by
  Netspective Communications** (Shahid's other personal active company).
  This is a fact about the relationship between two of Shahid's
  properties, not a restatement of IF's own governance, so it's recorded
  in full in
  [`spec-kit/specs/0001-shahid-shah/spec.md`](../0001-shahid-shah/spec.md)
  (Key Entities, FR-009) rather than here. Noted here only as a pointer,
  per this spec's own FR-001.
- **Q: What is Intellectual Frontiers "for," relative to Netspective
  Communications?** → **A: Thinking.** Shahid's own framing: IF is where
  he does most of his thinking and writing (research, publishing,
  capital and venture decisions); Netspective Communications is where
  things actually get built. Same rule as above — recorded in full at
  [`spec-kit/specs/0001-shahid-shah/spec.md`](../0001-shahid-shah/spec.md)
  FR-010, since it's a fact about how two properties relate, not IF's own
  governance.

## Primary scenario

Someone reading this personal repository reaches Intellectual Frontiers in
the properties list and needs to know two things this repository, not the
company repository, is positioned to answer: how does IF relate to Shahid,
and where should they go for everything else about it.

### Acceptance scenarios

1. **Given** a reader wants IF's doctrine, unit charters, brand rules, or
   corporate facts, **when** they look here, **then** they're pointed to
   `intellectual-frontiers/.github` rather than finding a second copy.
2. **Given** `intellectual-frontiers/.github`'s own content changes,
   **when** this spec is read afterward, **then** nothing in this file
   needs to change, because nothing here restates that content.

## Requirements

- **FR-001**: This spec MUST NOT restate Intellectual Frontiers'
  constitution, unit charters, corporate facts, or glossary. It MUST cite
  [`intellectual-frontiers/.github`](https://github.com/intellectual-frontiers/.github)
  for all of them.
- **FR-002**: This spec MUST state Shahid's relationship to Intellectual
  Frontiers as "Founder, owner, and Managing Partner," per his own site's
  `founderMode.ts`, and MUST NOT independently characterize his role in
  any way that repository doesn't already state.
- **FR-003**: If a future fact about Shahid's relationship to IF changes
  in a way that matters to this personal repository specifically (not to
  IF's own governance), it MUST be recorded here as a dated Clarification
  rather than by editing the company repository.

## Key entities

- **Intellectual Frontiers LLC** — see
  [`intellectual-frontiers/.github/context/company.md`](https://github.com/intellectual-frontiers/.github/blob/main/context/company.md)
  for corporate facts, and
  [`spec-kit/specs/0001-intellectual-frontiers/spec.md`](https://github.com/intellectual-frontiers/.github/blob/main/spec-kit/specs/0001-intellectual-frontiers/spec.md)
  for the company itself, specified.
- **Shahid N. Shah** — see
  [`spec-kit/specs/0001-shahid-shah/spec.md`](../0001-shahid-shah/spec.md).

## Success criteria

- **SC-001**: This file contains zero restated constitution text, unit
  charter text, or corporate facts — verifiable by grep against the
  company repository's own content.

## Out of scope

- Everything the company repository already governs: doctrine, unit
  mandates, brand, corporate facts, glossary. See FR-001.

## Open questions

None at this time.

## Review & acceptance checklist

- [x] Every requirement is testable
- [x] No implementation detail
- [x] Every requirement traces to `intellectual-frontiers/.github` or spec
      0001
- [x] Ambiguities are marked `[NEEDS CLARIFICATION]`, not silently resolved
- [x] Public-safe

## Traceability

| Requirement | Source |
| --- | --- |
| FR-001 | `intellectual-frontiers/.github` README, "Canonical source, going forward" |
| FR-002 | `www.shahidshah.com` `src/content/founderMode.ts` (`founderRecord`) |
| FR-003 | `spec-kit/specs/0001-shahid-shah/spec.md` FR-006 |
