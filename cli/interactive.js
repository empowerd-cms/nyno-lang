#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { runYamlTool } from './runYamlTool.js';
import { connectAllRunners } from './runFunction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the directory where commands are located
const extensionsDir = path.join(process.env.HOME, 'github', 'nyno', 'extensions');

// Read available commands from the directory (directories only)
let commands = [];
try {
  commands = fs.readdirSync(extensionsDir).filter(file => {
    return fs.statSync(path.join(extensionsDir, file)).isDirectory();
  });
} catch (err) {
  console.error(`Error reading commands directory: ${err.message}`);
  process.exit(1);
}

// Create a readline interface for autocompletion
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line) => {
    const parts = line.split(' ').filter(part => part !== '');
    if (parts.length === 0) {
      // If no command is being typed yet, show all commands
      return [commands, line];
    }
    const cmd = parts[0];
    const hits = commands.filter((c) => c.startsWith(cmd));
    return [hits.length ? hits : commands, line];
  }
});

/**
 * Parse CLI arguments into a simple key-value object
 */
function parseArgs(argv) {
  const args = {};
  let positionalArgs = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex > 0) {
        const key = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        args[key] = value;
      } else {
        const key = arg.slice(2);
        const nextArg = argv[i + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          args[key] = nextArg;
          i++; // Skip the next argument since we've used it as a value
        } else {
          args[key] = true;
        }
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1, 2);
      const longKeyMap = { 'c': 'context' };
      if (longKeyMap[key]) {
        const nextArg = argv[i + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          args[longKeyMap[key]] = nextArg;
          i++; // Skip the next argument since we've used it as a value
        } else {
          args[longKeyMap[key]] = true;
        }
      } else {
        // Treat as a positional argument
        positionalArgs.push(arg);
      }
    } else {
      // Treat as a positional argument
      positionalArgs.push(arg);
    }
  }

  return { args, positionalArgs };
}

// Main function to run the interactive shell
async function main() {
  // Parse command-line arguments
  const argv = process.argv.slice(2);
  const { args, positionalArgs } = parseArgs(argv);

  // Connect all runners
  await Promise.all(connectAllRunners({ debug: false }));

  // Start the interactive shell if no command is provided
  if (positionalArgs.length === 0) {
    console.log('Welcome to the interactive shell. Available commands:');
    console.log(commands.join(', '));
    console.log('Type "exit" to quit.');
    prompt(args);
  } else {
    // Execute the command directly with provided arguments
    await executeCommand(positionalArgs[0], positionalArgs.slice(1), args.context);
  }
}

// Function to prompt the user for input
function prompt(args) {
  rl.question('> ', async (answer) => {
    const input = answer.trim();
    if (input === 'exit') {
      rl.close();
      return;
    }

    // Parse the input to separate command and arguments
    const parts = input.split(' ').filter(part => part !== '');
    if (parts.length === 0) {
      prompt(args);
      return;
    }

    const cmd = parts[0];
    const cmdArgs = parts.slice(1);

    await executeCommand(cmd, cmdArgs, args.context);
    prompt(args);
  });
}

// Function to execute a command with arguments and context
async function executeCommand(cmd, cmdArgs, contextStr) {
  // Check if the command directory exists
  const cmdDir = path.join(extensionsDir, cmd);
  if (!fs.existsSync(cmdDir) || !fs.statSync(cmdDir).isDirectory()) {
    console.log(`Command not found: ${cmd}`);
    return;
  }

  try {
    // Parse context if provided
    let context = {};
    if (contextStr) {
      try {
        context = JSON.parse(contextStr);
      } catch (e) {
        console.error("Invalid JSON in --context:", e.message);
        return;
      }
    }

    // Create a single-step workflow
    const workflow = [{
      id: '0',
      func: cmd,
      json: {
        name: cmd,
        spec: {
          id: '0',
          args: cmdArgs,
          context: context,
          func: cmd
        },
      },
      nextMap: {},
    }];

    // Debug
    const debug = process.env.NYNO_DEBUG == "1";
    if (debug) console.log('Executing workflow:', workflow);

    // Execute the workflow
    const oldNodes = Object.fromEntries(workflow.map((n) => [n.id, n]));
    const log = [];
    let current = '0'; // Start with the first (and only) step

    const nodes = {};
    for (const [key, node] of Object.entries(oldNodes)) {
      nodes[key] = {
        id: node.id,
        func: node.func,
        json: node.json,
        info: node.info,
        args: node.args,
        nextMap: node.nextMap,
      };
    }

    // Main workflow loop (will only execute once for a single step)
    while (current && nodes[current]) {
      const node = nodes[current];
      if ('set_context' in context) delete context['set_context'];
      const input = JSON.parse(JSON.stringify(context));
      const yamlOutput = await runYamlTool(node, context, { debug });
      const outputValue =
        typeof yamlOutput.output === 'string' ? yamlOutput.output : JSON.stringify(yamlOutput.output);
      const output = yamlOutput.output.r || yamlOutput.output;
      context = JSON.parse(JSON.stringify(yamlOutput.output.c ?? {}));
      context[`O_${node.id}`] = output;
      const details = JSON.parse(JSON.stringify(yamlOutput));
      details['node_id'] = node.id;
      details['node_title'] = node.func;
      details['new_context'] = details.output?.c ?? {};
      details['new_context'][`O_${node.id}`] = output;
      delete details['output'];
      log.push({ input, output, details });
      current = null; // No next step in a single-step workflow
    }

    // Output result
    console.log(JSON.stringify(context, null, 2));
  } catch (err) {
    console.error(`Error executing command ${cmd}:`, err);
  }
}

export function nynoInteractive(){
// Start the main function
main().catch(console.error);

}

