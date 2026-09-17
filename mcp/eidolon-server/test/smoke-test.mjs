// Smoke test: spawns the built server as a real MCP client would, lists
// tools, and calls each one. Not shipped — just verifies the server
// actually works before committing it. Run: node test/smoke-test.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "dist", "index.js");

const transport = new StdioClientTransport({
  command: "node",
  args: [serverPath],
});

const client = new Client({ name: "smoke-test-client", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
console.log("=== Tools registered ===");
for (const t of tools.tools) console.log(`- ${t.name}: ${t.description}`);

console.log("\n=== get_profile() ===");
console.log((await client.callTool({ name: "get_profile", arguments: {} })).content[0].text);

console.log("\n=== get_companies_founded() ===");
const cf = await client.callTool({ name: "get_companies_founded", arguments: {} });
console.log(JSON.parse(cf.content[0].text).total, "total companies/orgs");

console.log("\n=== get_property({name: 'Netspective'}) ===");
const p1 = await client.callTool({ name: "get_property", arguments: { name: "Netspective" } });
console.log(p1.content[0].text);

console.log("\n=== check_status({name: 'Hoy Health'}) ===");
const s1 = await client.callTool({ name: "check_status", arguments: { name: "Hoy Health" } });
console.log(s1.content[0].text);

console.log("\n=== check_status({name: 'Manos Health'}) ===");
const s2 = await client.callTool({ name: "check_status", arguments: { name: "Manos Health" } });
console.log(s2.content[0].text);

console.log("\n=== get_property({name: 'nonexistent-xyz'}) ===");
const p2 = await client.callTool({ name: "get_property", arguments: { name: "nonexistent-xyz" } });
console.log(p2.content[0].text);

console.log("\n=== get_technical_skills({filter: 'proven'}) ===");
const ts = await client.callTool({ name: "get_technical_skills", arguments: { filter: "proven" } });
const tsData = JSON.parse(ts.content[0].text);
console.log("directCodeEvidence entries:", tsData.directCodeEvidence.length);
console.log("generalCompetency entries:", tsData.generalCompetency.length);

await client.close();
console.log("\nAll calls completed without error.");
