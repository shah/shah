<!--
How to use this template

1. Copy it to spec-kit/specs/NNNN-kebab-case-slug/spec.md, where NNNN is
   the next unused four-digit number in spec-kit/specs/ (0001 is taken by
   the spec for Shahid himself, 0002 by Intellectual Frontiers).
2. Fill in every bracketed field. Each section below carries its own
   guidance comment, like this one — delete each comment as you fill in
   the section it explains, so nothing but real content ships.
3. Source every claim from something already established: spec 0001, the
   property's own site or repository, or a fact Shahid supplies directly
   when a source can't be reached. If you catch yourself inventing a
   category or a fact to fill a gap, stop — that's a decision for Shahid
   or whoever holds authority over the property, not something a spec
   should quietly introduce.
4. Where the source material doesn't give a checkable answer, write
   `[NEEDS CLARIFICATION: ...]` and move on. A spec with an honest gap in
   it is more useful than one that guessed and sounded finished. This
   matters more here than in most spec-kits: this is a public document
   about a real, named person, and a wrongly asserted category (is this
   company active or historical? owned or merely advised?) is worse than
   an open question.
5. If the property already has its own repository with its own SpecKit
   (the way Intellectual Frontiers does), this spec should be thin: say
   what the property is and how it relates to Shahid and his other
   properties, and cite the property's own repository for everything
   else. Don't duplicate governance that already lives there.
6. This produces a spec — what's true, and how to check it. It is not a
   plan. Nothing about tooling, timelines, or how work actually gets done
   belongs here.
-->

# Feature Specification: [SPEC NAME]

**Spec ID:** [NNNN-kebab-case-slug]
**Status:** Draft — first pass
**Created:** [YYYY-MM-DD]
**Decision authority:** [who has final say over this spec's contents —
name a person, not a role. Anything about Shahid himself routes to Shahid
N. Shah; a property with its own named lead should name that person
instead.]
**Input:** [the request that produced this spec, close to verbatim]

## Why this document exists

<!-- One short paragraph. Name what this spec makes checkable, and which
existing document it draws from (spec 0001, the property's own site or
repository, another spec). Cite the source instead of restating it. -->

This is not an implementation plan. It says what's true and how to check
it, not how any work gets done, what tools are used, or how it's staffed.

## Clarifications

<!-- Leave as "None yet." until a real clarification session happens. When
one does, append it here, oldest session first, and update every affected
requirement below so the requirement text and the answer never disagree.
Follow the format used in spec 0001: one dated "### Session YYYY-MM-DD"
heading, then a Q → A bullet per question resolved. -->

None yet.

## Primary scenario

<!-- One paragraph: the real situation this spec governs, as a sequence of
events — e.g., someone encountering this property for the first time and
needing to know what it is and how it relates to Shahid's other work. Not
a mission statement. -->

### Acceptance scenarios

<!-- Given/When/Then, numbered. Each one must be checkable against a real
situation. Fewer than three usually means the spec is still too abstract
to be useful. -->

1. **Given** [...], **when** [...], **then** [...].

### Edge cases

<!-- Situations that don't fit the primary scenario cleanly: ambiguous
ownership, a status that's changed since the source material was written,
overlap with another property. State what resolves each one, or mark it
[NEEDS CLARIFICATION] if nothing here or in spec 0001 resolves it yet. -->

## Requirements

<!-- Every requirement is a MUST / MUST NOT / MAY sentence, numbered
FR-001 upward, grouped under short subheadings once there are more than
five or six. If a sentence can't be checked against a real fact or
decision, it's not a requirement — it belongs in prose instead.

Where the source material doesn't give a checkable answer, write the
requirement as far as it goes and append:
`[NEEDS CLARIFICATION: the specific thing that's undecided]`
Don't guess at a resolution to make the section look finished. -->

- **FR-001**: [Subject] MUST [testable behavior].

## Key entities

<!-- The nouns a reader needs defined to follow this spec: the property
itself, related people, other properties it touches. One line each,
linking to the source (spec 0001, the property's own repository or site)
instead of redefining it here. -->

## Success criteria

<!-- Measurable, and independent of how the work gets done. -->

- **SC-001**: [...]

## Out of scope

<!-- What this spec deliberately does not govern, and why — usually
because it's already governed elsewhere (cite it) or because it's a
plan-level decision rather than a spec-level one. -->

## Open questions

<!-- Every [NEEDS CLARIFICATION] marker above, collected here so they can
be scanned in one place. Remove an item only when a dated Clarifications
session above actually resolved it — never because you privately decided
what the answer should be. -->

## Review & acceptance checklist

- [ ] Every requirement is testable (MUST / MUST NOT / MAY), not aspirational
- [ ] No implementation detail — tooling, staffing, and timeline decisions
      belong in a future plan
- [ ] Every requirement traces to spec 0001, the property's own source, or
      is explicitly flagged as new content for the decision authority to
      confirm
- [ ] Ambiguities are marked `[NEEDS CLARIFICATION]`, not silently resolved
- [ ] Public-safe: no confidential or unverifiable information, no
      unverified number or category stated as settled fact

## Traceability

<!-- One row per requirement and success criterion, pointing at its
source. This is what lets a reader trust nothing here was invented. -->

| Requirement | Source |
| --- | --- |
| FR-001 | [...] |
