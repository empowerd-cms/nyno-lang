#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { spawn,spawnSync } from 'child_process';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { runYamlTool} from './runYamlTool.js';
import { connectAllRunners} from './runFunction.js';

/**
 * Run a workflow from start node
 */
export async function runWorkflow(wf, startNodeId=null,config={}) {
	let context = wf.context;
  const oldNodes = Object.fromEntries(wf.workflow.map((n) => [n.id, n]));
  const log = [];
  let current = startNodeId;
   //console.log('old nodes',oldNodes);
const nodes = {};
  for(const [key,value] of Object.entries(oldNodes)) {
	  //console.log('key,value',[key,value]);
	const node = value;
	  if(!current) current = node.id; //= startNodeId;

	nodes[key] = {
	    id: node.id,
	    func: node.func,
	    json: node.json, // json object from yaml
	    info: node.info, // raw yaml
	    args: node.args, // extracted args?
	    nextMap: node.nextMap, // next? if not nextMap?
	}
	
  }

   //console.log('nodes',nodes);
  //console.log(`Starting workflow at node: ${startNodeId}`);

  while (current && nodes[current]) {
    const node = nodes[current];
    //console.log(`Processing node: ${node.id} (${node.func})`);

	// clear old context system tokens
	if('set_context' in context) delete context['set_context'];

    const input = JSON.parse(JSON.stringify(context));
    
    const yamlOutput = await runYamlTool(node, context,config);
      //console.log('yamlOutput b4',yamlOutput);

     const outputValue =
      typeof yamlOutput.output === 'string' ? yamlOutput.output : JSON.stringify(yamlOutput.output);
      //console.log('yamlOutput',yamlOutput);

      const output = yamlOutput.output.r;

    context = JSON.parse(JSON.stringify(yamlOutput.output.c ?? {}));
    context[`O_${node.id}`] = output;

    const details = JSON.parse(JSON.stringify(yamlOutput)); // clone
	  //console.log('details',details);

    details['node_id'] = node.id;
    details['node_title'] = node.func;

    details['new_context'] = details.output.c;
    details['new_context'][`O_${node.id}`] = output;
    // remove double info
    delete details['output'];
    log.push({
      input,
      output,
      details, 
    });

       //console.log(`Node output: ${outputValue}`);

	  const nextMap = JSON.parse(outputValue).r ?? '';
    if (node.nextMap) {
      current = node.nextMap[nextMap] ?? node.nextMap['0'] ?? null;
      //console.log(`Next node determined: ${current}`);
    } else {
      current = node.next ?? null;
      //console.log(`Next node: ${current}`);
    }
  }

  //console.log('Workflow finished');
	if("NYNO_ONE_VAR" in context) {
		return context[context.NYNO_ONE_VAR];
	}

  
  return { log, context };
}


await Promise.all(connectAllRunners({debug:false}));


let yamlFile =  process.argv[2];

/*
const context = {'i': 0}
	workflow:[{
    id: '1',
    func: 'route_/test_nyno_echo',
    info: 'nyno-echo:\n  args:\n    - "${i}"\n',
    args: [],
  }];
*/
import { convertWorkflowYaml } from './convertWorkflowYaml.js';

const {context,workflow} = convertWorkflowYaml(yamlFile);
//console.log('workflow',workflow);


const o = await runWorkflow({context,workflow},null,{debug:false});
//console.log('o',o);
//console.log('o logs',JSON.stringify(o.log));
console.log(JSON.stringify(o.log));

process.exit(0);
