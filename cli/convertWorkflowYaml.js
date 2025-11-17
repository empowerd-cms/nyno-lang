import fs from "fs";
import { load } from 'js-yaml';

/**
 * Convert a YAML workflow file into the normalized { context, workflow: [...] } format
 * Supports both array and object formats for workflow
 */
export function convertWorkflowYaml(path) {
  // 1. Read + parse YAML
  const raw = fs.readFileSync(path, "utf8");
  const input = load(raw);
  const { context = {}, workflow = [] } = input;

  // Handle both array and object formats for workflow
  let workflowSteps = [];
  if (Array.isArray(workflow)) {
    workflowSteps = workflow;
  } else if (typeof workflow === 'object' && workflow !== null) {
    // Convert object format to array format
    workflowSteps = [workflow];
  } else {
    throw new Error("Workflow must be an array or an object");
  }

  // 2. Convert each workflow step
  const convertedWorkflow = workflowSteps.map((step, index) => {
    const name = step.step || "unknown";
    // Ensure args is an array
    const args = Array.isArray(step.args) ? step.args : [step.args];
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
      nextMap,
    };
  });
  // 3. Return structured object
  return { context, workflow: convertedWorkflow };
}

// Example usage when run directly:
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const inputPath = process.argv[2] || "workflow.yaml";
  try {
    const result = convertWorkflowYaml(inputPath);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

