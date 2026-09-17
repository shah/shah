#!/usr/bin/env node
/**
 * MCP server exposing the public tier of Shahid N. Shah's Eidolon
 * (github.com/shah/shah) as tools an AI agent can call.
 *
 * Data comes from data/profile.json, a hand-generated snapshot of
 * spec-kit/specs/0001-shahid-shah/spec.md. That spec is the source of
 * truth. This server only serves what's already public there — it has
 * no access to any other tier, because no other tier exists yet.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_PATH = join(__dirname, "..", "data", "profile.json");

type Profile = {
  _provenance: string;
  _asOf: string;
  _tier: string;
  eidolon: Record<string, unknown>;
  identity: Record<string, unknown>;
  personalPrinciples: string;
  companiesAndOrganizationsFounded: {
    total: number;
    active: unknown[];
    exitedViaAcquisition: unknown[];
    closed: unknown[];
    activeNonProfits: unknown[];
  };
  brandAndPartnership: unknown[];
  studiosProjectsDeliveredByNetspective: unknown[];
  mediaAndPublishing: unknown[];
  mediaChannels: string[];
  boardAdvisoryInvestmentRoles: { org: string; role: string; status: string }[];
  technicalSkills: {
    methodology: string;
    provenDirectCodeEvidence: unknown[];
    provenGeneralCompetency: unknown[];
    skillOnlyTopByEndorsements: unknown[];
  };
};

function loadProfile(): Profile {
  const raw = readFileSync(PROFILE_PATH, "utf-8");
  return JSON.parse(raw) as Profile;
}

/** Every named-entity list in the profile, tagged with which category it's from. */
function allNamedProperties(profile: Profile): { category: string; entry: any }[] {
  const out: { category: string; entry: any }[] = [];
  const c = profile.companiesAndOrganizationsFounded;
  for (const entry of c.active) out.push({ category: "active company", entry });
  for (const entry of c.exitedViaAcquisition)
    out.push({ category: "exited via acquisition", entry });
  for (const entry of c.closed) out.push({ category: "closed", entry });
  for (const entry of c.activeNonProfits)
    out.push({ category: "active non-profit", entry });
  for (const entry of profile.brandAndPartnership)
    out.push({ category: "brand and personal partnership", entry });
  for (const entry of profile.studiosProjectsDeliveredByNetspective)
    out.push({ category: "IF Studios project (delivered by Netspective)", entry });
  for (const entry of profile.mediaAndPublishing)
    out.push({ category: "media and publishing property", entry });
  for (const entry of profile.boardAdvisoryInvestmentRoles)
    out.push({ category: "board / advisory / investment role", entry });
  return out;
}

function nameOf(entry: any): string {
  return entry.name ?? entry.org ?? "";
}

const server = new McpServer({
  name: "shahid-eidolon",
  version: "0.1.0",
});

server.registerTool(
  "get_profile",
  {
    title: "Get Shahid's profile",
    description:
      "Top-level identity, roles, education, and personal principles from Shahid N. Shah's Eidolon (public tier only). Start here before calling more specific tools.",
    inputSchema: {},
  },
  async () => {
    const profile = loadProfile();
    const result = {
      identity: profile.identity,
      personalPrinciples: profile.personalPrinciples,
      eidolon: profile.eidolon,
      asOf: profile._asOf,
      tier: profile._tier,
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "get_companies_founded",
  {
    title: "Get companies and organizations founded",
    description:
      "The full breakdown of the ten companies and organizations Shahid has founded or co-founded: active companies, ones exited via acquisition, closed ones, and active non-profits. Use this rather than assuming a number — the site's own older stat ('05 Cos Founded') is stale.",
    inputSchema: {},
  },
  async () => {
    const profile = loadProfile();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(profile.companiesAndOrganizationsFounded, null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  "get_property",
  {
    title: "Look up one of Shahid's properties",
    description:
      "Look up a specific company, non-profit, brand, project, media property, or board role by name (case-insensitive substring match). Returns every matching entry across all categories, each labeled with its category, so you don't have to guess which list it's in.",
    inputSchema: { name: z.string().describe("Name or partial name to search for, e.g. 'Netspective', 'Alim', 'Medigy'") },
  },
  async ({ name }) => {
    const profile = loadProfile();
    const needle = name.trim().toLowerCase();
    const matches = allNamedProperties(profile).filter(({ entry }) =>
      nameOf(entry).toLowerCase().includes(needle),
    );
    if (matches.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No property matching "${name}" found in the public tier of this Eidolon. That doesn't mean it doesn't exist — it may just not be documented here yet.`,
          },
        ],
      };
    }
    return { content: [{ type: "text", text: JSON.stringify(matches, null, 2) }] };
  },
);

server.registerTool(
  "check_status",
  {
    title: "Check a property's current status",
    description:
      "Check whether a named property, role, or organization is current, former/historical, closed, or exited — and its category. Use this before describing anything as 'active' — several conflicting statuses were found and resolved in this Eidolon's own history (see its Clarifications log), so don't assume.",
    inputSchema: { name: z.string().describe("Name or partial name to check, e.g. 'Hoy Health', 'Citus Health'") },
  },
  async ({ name }) => {
    const profile = loadProfile();
    const needle = name.trim().toLowerCase();
    const matches = allNamedProperties(profile).filter(({ entry }) =>
      nameOf(entry).toLowerCase().includes(needle),
    );
    if (matches.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No property matching "${name}" found. Don't assume a status — say it's unconfirmed.`,
          },
        ],
      };
    }
    const statuses = matches.map(({ category, entry }) => ({
      name: nameOf(entry),
      category,
      status: entry.status ?? entry.outcome ?? entry.role ?? "see category",
    }));
    return { content: [{ type: "text", text: JSON.stringify(statuses, null, 2) }] };
  },
);

server.registerTool(
  "get_technical_skills",
  {
    title: "Get Shahid's technical skills",
    description:
      "Technical skills, split by evidence: 'proven' (direct code evidence across github.com/shah, github.com/netspective, and github.com/alim-foundation — includes both specific languages and general software-engineering competencies), or 'skill' (LinkedIn-endorsed only, no code evidence found). Omit the filter to get everything plus the methodology note.",
    inputSchema: {
      filter: z
        .enum(["proven", "skill", "all"])
        .optional()
        .describe("Which bucket to return. Defaults to 'all'."),
    },
  },
  async ({ filter }) => {
    const profile = loadProfile();
    const ts = profile.technicalSkills;
    let result: unknown;
    if (filter === "proven") {
      result = {
        directCodeEvidence: ts.provenDirectCodeEvidence,
        generalCompetency: ts.provenGeneralCompetency,
      };
    } else if (filter === "skill") {
      result = { skillOnlyTopByEndorsements: ts.skillOnlyTopByEndorsements };
    } else {
      result = ts;
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting Eidolon MCP server:", err);
  process.exit(1);
});
