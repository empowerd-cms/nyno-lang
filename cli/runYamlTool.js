import fs from 'fs';
import { runFunction } from './runFunction.js';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { spawn,spawnSync } from 'child_process';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function debugLog(...args) {
	if(process.env.NODE_ENV!=='production') {
  		console.log('[DEBUG]', ...args);
	}
}

/**
 * Run a single YAML node
 */
export async function runYamlTool(node, context = {},config = {}) {




  let nodeName = node.func;
  let yamlContent = node.info ?? '';
  let node_id = node.id ?? '';


	if('debug' in config && config.debug) {
  debugLog(`Running YAML node: ${nodeName}`);
  debugLog('Context before execution:', context);
	}

  let cmdName, cmdSpec, args;
  args = []; // default
  cmdSpec = {}; // default

  // if json in node then use JS not YAML parsing
  if('json' in node){
    cmdName = node.json.name;
    cmdSpec = node.json.spec;
  }
  // if its empty return early
   else if(yamlContent.trim().length==0) return {"output":{"r":"","c":context}};
  else if(!yamlContent.includes(':')){
	// if no ":" assume it's a command without args
	cmdName = yamlContent.trim();
  } else {
  try {
    const doc = yaml.load(yamlContent);
	if('debug' in config && config.debug) {
    debugLog('Parsed YAML:', doc);
	}

    if (!doc || typeof doc !== 'object' || Object.keys(doc).length !== 1) {
      return { error: 'YAML must contain exactly one top-level command.' };
    }

    cmdName = Object.keys(doc)[0];
    cmdSpec = doc[cmdName];
  }
	catch (err) {
    debugLog(`Error parsing YAML for node ${nodeName}:`, err.message);
    return { error: err.message };
    //return { error: err.message,nodeName,context };
  }
  }

// END YAML Part


const unreplaced = [];

const replaceEnv = (value) => {
  // Match exactly one variable like "${VAR}"
  const onlyVarMatch = value.match(/^\$\{(\w+)\}$/);
  if (onlyVarMatch) {
    const key = onlyVarMatch[1];
    if (!(key in context)) {
      unreplaced.push(key);
      return '';
    }
    const val = context[key];

    // If val is an object/array, return it directly
    if (typeof val === 'object' && val !== null) {
      return val;
    }

    // Otherwise, return the value as-is
    return val;
  }

  // Otherwise, replace variables inside a string
  return value.replace(/\$\{(\w+)\}/g, (_, key) => {
    if (!(key in context)) {
      unreplaced.push(key);
      return '';
    }

    const val = context[key];

    // If object/array, convert to JSON string for safe embedding
    if (typeof val === 'object' && val !== null) {
      return JSON.stringify(val);
    }

    return String(val);
  });
};



if (cmdSpec.flags) {
  for (const key in cmdSpec.flags) {
    const val = cmdSpec.flags[key];

    if (Array.isArray(val)) {
      for (const item of val) {
        args.push(key.length === 1 ? `-${key}` : `--${key}`);
        let fullValue = (replaceEnv(String(item)));
        args.push(fullValue);
      }
    } else {
      args.push(key.length === 1 ? `-${key}` : `--${key}`);
      if (val != null) {
        	let fullValue = (replaceEnv(String(val)));
	      args.push(fullValue);
      }
    }
  }
}

if (cmdSpec.context) {
  for (const key in cmdSpec.context) {
    const val = cmdSpec.context[key];
      if (val != null) {
	  // also add to global context
	  const notString = typeof val !== "string";
	  if(notString) context[key] = val;
	  else {
	  	let fullValue = (replaceEnv(String(val)));
	  	context[key] = fullValue;
	  }
      }
  }
}

if (cmdSpec.args) {
  for (const item of cmdSpec.args) {
	  const notString = typeof item !== "string";
	  if(notString) args.push(item);
	  else args.push(replaceEnv(String(item)));
  }
}

if (unreplaced.length > 0) {
  return { error: true,output:{r:'',c:context}, missing: [...new Set(unreplaced)] };
}

	if('debug' in config && config.debug) {
    debugLog(`Executing command: ${cmdName} with args:`, args);
	}


    // First check extensions/py/php/js.. 
	const output = await runFunction(cmdName, args,context);
	if('debug' in config && config.debug) {
	 debugLog('runFunction',{output});
	}

	if(!output.fnError) {
	  return {
          command: [cmdName, ...args],
          context,
          output,
	  };
	}

    return await new Promise((resolve) => {
      const child = spawn(cmdName, args);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));

      child.on('error', (err) => {
        debugLog(`Failed to start command ${cmdName}:`, err.message);
        //resolve({ error: err.message });
    	resolve({ error: stderr, errMsg: err.message,cmdName,args,output:{r:'',c:context},bash:true, });
      });

      child.on('close', (exitCode) => {
        const output = stdout.trim();
        context[`O_${node_id}`] = output;
	if('debug' in config && config.debug) {
        debugLog(`Command finished: ${cmdName} exitCode=${exitCode}`);
        debugLog('stdout:', stdout.trim());
        debugLog('stderr:', stderr.trim());
        debugLog('Context after execution:', context);
	}

        resolve({
          command: [cmdName, ...args],
          bash:true,
          stderr:stderr.trim(),
          output:{r:output,c:context},
          exitCode,
        });
      });
    });
   
}


