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
  founderModeSummary: Record<string, unknown>;
  companiesAndOrganizationsFounded: {
    totalConfirmed: number;
    probableAdditional: number;
    active: unknown[];
    exitedViaAcquisition: unknown[];
    activeButFormerFounderRole: unknown[];
    closed: unknown[];
    activeNonProfits: unknown[];
    probableNotCounted: unknown[];
  };
  brandAndPartnership: unknown[];
  studiosProjectsDeliveredByNetspective: unknown[];
  mediaAndPublishing: unknown[];
  mediaChannels: string[];
  boardAdvisoryInvestmentRoles: { org: string; role: string; status: string }[];
  ventureRoleTaxonomy: Record<string, unknown>;
  ventureRoleLedger: {
    name: string;
    relationshipClass: string;
    role: string;
    status: string;
    confidence: "Confirmed" | "Probable" | "Uncertain";
    note?: string;
  }[];
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
  for (const entry of profile.ventureRoleLedger)
    out.push({ category: entry.relationshipClass, entry });
  for (const entry of profile.studiosProjectsDeliveredByNetspective)
    out.push({ category: "IF Studios project (delivered by Netspective)", entry });
  for (const entry of profile.mediaAndPublishing)
    out.push({ category: "media and publishing property", entry });
  return out;
}

function nameOf(entry: any): string {
  return entry.name ?? entry.org ?? "";
}

const server = new McpServer({
  name: "shahid-eidolon",
  version: "0.2.0",
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
      founderModeSummary: profile.founderModeSummary,
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
      "The evidence-weighted founder record: eleven confirmed companies and organizations plus one probable historical co-founder record, broken down by status. Use this rather than assuming a number — the site's own older stat ('05 Cos Founded') and this Eidolon's former total of ten are stale.",
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
  "get_venture_roles",
  {
    title: "Get Shahid's venture-role ledger",
    description:
      "Founder/operator, board/advisory, investment, fractional operating, working, historical executive, corporate-successor, and proposed/exploratory relationships. Every entry keeps relationship class, confidence, and status separate so a proposal is not mistaken for an appointment and a historical role is not described as current.",
    inputSchema: {
      relationshipClass: z
        .enum([
          "founder_operator",
          "board_advisory",
          "investment",
          "fractional_operating",
          "working_relationship",
          "historical_executive",
          "corporate_successor",
          "proposed_exploratory",
        ])
        .optional()
        .describe("Optional relationship-class filter."),
      confidence: z
        .enum(["Confirmed", "Probable", "Uncertain"])
        .optional()
        .describe("Optional evidence-confidence filter."),
      statusContains: z
        .string()
        .optional()
        .describe("Optional case-insensitive substring filter over the status text, e.g. 'current', 'former', or 'closed'."),
    },
  },
  async ({ relationshipClass, confidence, statusContains }) => {
    const profile = loadProfile();
    let entries = profile.ventureRoleLedger;
    if (relationshipClass) {
      entries = entries.filter((entry) => entry.relationshipClass === relationshipClass);
    }
    if (confidence) {
      entries = entries.filter((entry) => entry.confidence === confidence);
    }
    if (statusContains?.trim()) {
      const needle = statusContains.trim().toLowerCase();
      entries = entries.filter((entry) => entry.status.toLowerCase().includes(needle));
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              asOf: profile._asOf,
              taxonomy: profile.ventureRoleTaxonomy,
              count: entries.length,
              entries,
            },
            null,
            2,
          ),
        },
      ],
    };
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
