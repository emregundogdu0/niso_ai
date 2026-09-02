const fs = require('fs');
const path = require('path');

// 1. Update 06_Chat_Intent_Router to add Webhook trigger
const file06 = path.join(__dirname, '..', 'n8n_06_chat_intent_router_workflow.json');
const wf06 = JSON.parse(fs.readFileSync(file06, 'utf8'));

// Check if webhook node already exists
let webhook06 = wf06.nodes.find(n => n.id === 'webhook-trigger-06');
if (!webhook06) {
  webhook06 = {
    parameters: {
      httpMethod: 'POST',
      path: 'chat-router',
      responseMode: 'lastNode',
      options: {}
    },
    id: 'webhook-trigger-06',
    name: 'Webhook Trigger',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2,
    position: [ 200, 100 ],
    webhookId: 'chat-router'
  };
  wf06.nodes.unshift(webhook06);
  wf06.connections['Webhook Trigger'] = {
    main: [
      [
        {
          node: 'Input Normalization & Guard',
          type: 'main',
          index: 0
        }
      ]
    ]
  };
}
wf06.active = true;
fs.writeFileSync(file06, JSON.stringify(wf06, null, 2), 'utf8');

// 2. Update 10C_Common_Mail_Ingestion to add Webhook trigger
const file10C = path.join(__dirname, '..', 'n8n_10C_common_mail_ingestion_workflow.json');
const wf10C = JSON.parse(fs.readFileSync(file10C, 'utf8'));

let webhook10C = wf10C.nodes.find(n => n.id === 'webhook-trigger-10c');
if (!webhook10C) {
  webhook10C = {
    parameters: {
      httpMethod: 'POST',
      path: 'common-mail-ingestion',
      responseMode: 'lastNode',
      options: {}
    },
    id: 'webhook-trigger-10c',
    name: 'Webhook Ingest Trigger',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2,
    position: [ 100, 150 ],
    webhookId: 'common-mail-ingestion'
  };
  wf10C.nodes.unshift(webhook10C);
  wf10C.connections['Webhook Ingest Trigger'] = {
    main: [
      [
        {
          node: 'Validate & Normalize Message Schema',
          type: 'main',
          index: 0
        }
      ]
    ]
  };
}
wf10C.active = true;
fs.writeFileSync(file10C, JSON.stringify(wf10C, null, 2), 'utf8');

console.log('Added webhook triggers to 06 and 10C workflows.');
