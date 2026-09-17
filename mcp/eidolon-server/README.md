# Eidolon MCP server

An MCP (Model Context Protocol) server that exposes the **public tier**
of [Shahid N. Shah's Eidolon](https://github.com/shah/shah) as tools an
AI agent can call directly, instead of cloning the repo and reading
`spec.md` by hand. See
[spec-kit/specs/0001-shahid-shah/spec.md](../../spec-kit/specs/0001-shahid-shah/spec.md#eidolon)
for what an Eidolon is and why this repository is one, and
[intellectualfrontiers.com/research/eidolons](https://www.intellectualfrontiers.com/research/eidolons)
for the full argument.

## What this is not

This server reads a static JSON snapshot (`data/profile.json`) that's
hand-generated from the spec. It doesn't fetch anything live from
GitHub, doesn't call any LLM, and doesn't reach any tier beyond public —
there is no internal, confidential, or highly restricted tier to reach
yet. If `spec.md` changes, `data/profile.json` needs to be updated by
hand to match — this server doesn't do that automatically. Treat the
spec as the source of truth and this file as a derived cache.

## Tools

| Tool | What it does |
| --- | --- |
| `get_profile` | Identity, roles, education, personal principles, Eidolon metadata. |
| `get_companies_founded` | The full ten-company/organization breakdown (active, exited via acquisition, closed, non-profit). |
| `get_property` | Look up a named company, brand, project, or role by substring match, labeled by category. |
| `check_status` | Check whether a named property/role is current, former, closed, or unconfirmed — don't assume. |
| `get_technical_skills` | Proven-skill / plain-skill breakdown, filterable. |

## Build and run

```sh
npm install
npm run build
npm start
```

The server speaks MCP over stdio. It doesn't print anything on its own —
an MCP client connects to it and calls tools.

## Verify it actually works

```sh
npm test
```

This builds the server, spawns it as a real MCP client would (via
`@modelcontextprotocol/sdk`'s `StdioClientTransport`), lists its tools,
and calls each one against the real data. It's a development check, not
a published artifact — read `test/smoke-test.mjs` to see exactly what it
exercises before trusting a "no errors" result.

## Wiring it into an MCP client

For Claude Desktop or Claude Code, add an entry to your MCP config
(exact file depends on the client — see that client's own docs) pointing
at the built server:

```json
{
  "mcpServers": {
    "shahid-eidolon": {
      "command": "node",
      "args": ["/absolute/path/to/shah/mcp/eidolon-server/dist/index.js"]
    }
  }
}
```

## Updating the data

1. Edit `spec-kit/specs/0001-shahid-shah/spec.md` first — it's the
   source of truth, with its own Clarifications log and claims
   standard. Never add a fact here that isn't in the spec.
2. Update `data/profile.json` to match, by hand.
3. Run `npm test` again before committing, to catch a schema mismatch
   between the new data and what `src/index.ts` expects.
