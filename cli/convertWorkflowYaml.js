import fs from "fs";
import yaml from "js-yaml";

/**
 * Convert a YAML workflow file into the normalized { context, workflow: [...] } format
 * Supports the cleaner YAML style:
 * workflow:
 *   - step: nyno-echo
 *     args: ["${i}"]
 *     next: [1, 2]
 */
export function convertWorkflowYaml(path) {
  // 1. Read + parse YAML
  const raw = fs.readFileSync(path, "utf8");
  const input = yaml.load(raw);

  const { context = {}, workflow = [] } = input;

  // 2. Convert each workflow step
  const convertedWorkflow = workflow.map((step, index) => {
    const name = step.step || "unknown";
    const args = step.args || [];
    const stepContext = step.context || null;
    const next = step.next || [];

    // Convert next array → object map { 0: val0, 1: val1, ... }
    const nextMap = {};
    next.forEach((n, i) => (nextMap[i] = n));
      let id = String(index);
      let func = `step [${index}]`;

    return {
      id,
      func,
      json: { name, spec: { id, args, context: stepContext, func }},
      //args: [], // optional: args can go here if you want structured access
      nextMap,
    };
  });

  // 3. Return structured object
  return { context, workflow: convertedWorkflow };
}

// Example usage when run directly:
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const inputPath = process.argv[2] || "workflow.yaml";
  const result = convertWorkflowYaml(inputPath);
  console.log(JSON.stringify(result, null, 2));
}

