# Skills

Portable [Agent Skills](https://github.com/shah/shah) — each a
self-contained `SKILL.md` any Claude Code, claude.ai, or other
skill-aware agent can load. These are "Labor as Code" for judgment and
voice: the reusable *how*, paired with the
[Eidolon MCP server](../mcp/eidolon-server/) as the reusable *who for* —
see [spec-kit/specs/0001-shahid-shah/spec.md#eidolon](../spec-kit/specs/0001-shahid-shah/spec.md#eidolon).

| Skill | Job |
| --- | --- |
| [`write-like-shahid`](write-like-shahid/SKILL.md) | Draft text in Shahid's voice. Sourced verbatim from his own AI voice prompt at [shahidshah.com/write-like-shahid](https://www.shahidshah.com/write-like-shahid). |
| [`shahid-quick-audit`](shahid-quick-audit/SKILL.md) | Fast AI-smell audit and rewrite for an everyday draft. |
| [`shahid-editorial-audit`](shahid-editorial-audit/SKILL.md) | Full professional-editor pass for a manuscript headed toward publication. |

Every skill here cites its source in its own file. None of these invent
voice rules — they package Shahid's own, verbatim. If you're adapting
this pattern for yourself rather than for Shahid specifically, write
your own version from your own material; see "Build your own Eidolon"
in the root [`README.md`](../README.md).
