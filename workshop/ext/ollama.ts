/**
 * snshah ollama: local models. Contributed by profile.d/ollama.ts, where the
 * `ollama` command is. It only asks ollama what it has and pulls what you name.
 */
import type { CommanderCommand, ExtApi } from "../snshah.ts";

const modelName = /^[a-z0-9][a-z0-9._/-]*(:[A-Za-z0-9._-]+)?$/;

export type Model = { name: string; size: string | null };

/** `ollama list`: a header row, then NAME ID SIZE MODIFIED columns. */
export function parseModels(text: string): Model[] {
  return text
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cols = line.split(/\s{2,}|\t+/).filter(Boolean);
      return { name: cols[0]!, size: cols[2] ?? null };
    });
}

function status(api: ExtApi, json: boolean): void {
  const out = api.capture(["ollama", "list"], { env: api.ctx.env });
  const running = out !== undefined;
  const models = running ? parseModels(out) : [];
  if (json) return console.log(JSON.stringify({ running, models }, null, 2));
  if (!running)
    return api.say(
      "ollama is installed but its server isn't answering. Start it with: ollama serve",
      "pending",
    );
  api.say(`ollama is running with ${models.length} model(s).`, "success");
  for (const m of models)
    console.log(`   ${m.name}${m.size ? `  ${m.size}` : ""}`);
  if (!models.length) console.log("   Pull one: snshah ollama pull llama3.2");
}

function pull(api: ExtApi, model: string): void {
  if (api.detectedAgent(api.ctx.env))
    throw new api.UsageError(
      "A model download is several gigabytes. Run it in your own terminal.",
    );
  if (!modelName.test(model))
    throw new api.UsageError(
      `${model} is not a model name such as llama3.2 or qwen2.5-coder:7b.`,
    );
  api.say(`Pulling ${model} (this can be several gigabytes).`, "action");
  const code = api.run(["ollama", "pull", model], { env: api.ctx.env });
  if (code !== 0) throw new Error(`ollama pull ${model} failed.`);
  api.say(`${model} is ready.`, "success");
}

export function register(group: CommanderCommand, api: ExtApi): void {
  group
    .command("status")
    .description("Is the ollama server answering, and which models it has")
    .option("--json", "print JSON")
    .action((o: { json?: boolean }) => status(api, !!o.json));
  group
    .command("pull")
    .description("Download a model with ollama pull")
    .argument("<model>", "for example llama3.2 or qwen2.5-coder:7b")
    .action((model: string) => pull(api, model));
}
