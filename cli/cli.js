#!/usr/bin/env node
import net from "net";
import fs from "fs";
import yaml from "js-yaml";

// --- CLI argument parsing ---
const argv = process.argv.slice(2);
let yamlFile = null;
let workflowJSON = null;
let context = {};
let apiKey = "change_me";

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--workflow") {
    workflowJSON = argv[i + 1];
    if (!workflowJSON) {
      console.error("Missing value for --workflow");
      process.exit(1);
    }
    i++;
  } else if (arg === "--context" || arg === "-c") {
    const nextArg = argv[i + 1];
    if (!nextArg) {
      console.error("Missing value for --context");
      process.exit(1);
    }
    try {
      context = JSON.parse(nextArg);
    } catch (e) {
      console.error("Invalid JSON for context:", e.message);
      process.exit(1);
    }
    i++;
  } else if (arg === "--apiKey") {
    apiKey = argv[i + 1];
    if (!apiKey) {
      console.error("Missing value for --apiKey");
      process.exit(1);
    }
    i++;
  } else if (!yamlFile && !workflowJSON) {
    yamlFile = arg;
  }
}

// Validate input
if (!yamlFile && !workflowJSON) {
  console.error("You must provide either a YAML file or --workflow JSON string.");
  process.exit(1);
}

// --- Prepare YAML content ---
let yamlData;

if (workflowJSON) {
  // Parse JSON string to object
  try {
    yamlData = JSON.parse(workflowJSON);
  } catch (e) {
    console.error("Invalid JSON for --workflow:", e.message);
    process.exit(1);
  }
} else if (yamlFile) {
  if (!fs.existsSync(yamlFile)) {
    console.error("YAML file does not exist:", yamlFile);
    process.exit(1);
  }
  try {
    yamlData = yaml.load(fs.readFileSync(yamlFile, "utf8"));
  } catch (e) {
    console.error("Error parsing YAML file:", e.message);
    process.exit(1);
  }
}

// Merge context into yamlData.context
if (context && Object.keys(context).length > 0) {
  if (!yamlData || typeof yamlData !== "object") yamlData = {};
  yamlData.context = { ...(yamlData.context || {}), ...context };
}

// Convert back to YAML string
const finalYamlContent = yaml.dump(yamlData);

console.log('sening final',finalYamlContent);
// --- TCP connection ---
const HOST = "0.0.0.0";
const PORT = 9024;
const PATH = "/run-nyno";

const client = new net.Socket();

client.connect(PORT, HOST, () => {
  // First: send connect message
  client.write(`c${JSON.stringify({ apiKey })}\n`);

  // Then: send query message with YAML text
  const qMsg = { yamlContent: finalYamlContent, path: PATH };
  client.write(`q${JSON.stringify(qMsg)}\n`);
});

let buffer = "";

let responses = 0;
client.on("data", (data) => {
	responses++;
  buffer += data.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const msg = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    if (!msg.trim()) continue;


    // --- Print + Exit after processing the second response ---
    if(responses == 2){
	    try {
	      const resp = JSON.parse(msg);
	      console.log(JSON.stringify(resp, null, 2));
	    } catch (e) {
	      console.log(msg);
	    }
    	   process.exit(0);
	}
  }
});

client.on("error", (err) => {
  console.error("TCP error:", err.message);
  process.exit(1);
});

client.on("close", () => process.exit(0));

