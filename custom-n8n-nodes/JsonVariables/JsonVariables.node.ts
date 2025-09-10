import fs from 'fs';
import path from 'path';
import {
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData
} from 'n8n-workflow';

type NodeInput = {
  name: string;
  type: string;
  value: string
}

export class JsonVariables implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Variables',
    name: 'Workflow Variables',
    icon: 'file:jsonvariables_v2.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + " Variable(s)"}}',
    description: 'Get / Save variables for the workflow / execution',
    defaults: {
      name: 'Workflow Variables',
    },
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
		properties: [
      {
        displayName: 'Execution ID Mode',
        name: 'executionIdMode',
        type: 'options',
        options: [
          { name: 'Use Execution ID', value: 'auto' },
          { name: 'Custom ID', value: 'custom' },
          { name: 'Use Workspace ID', value: 'workspace' },
        ],
        default: 'auto',
      },
      {
        displayName: 'Custom Execution ID',
        name: 'customExecutionId',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            executionIdMode: ['custom'],
          },
        },
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Get',
            value: 'get',
            action: 'Get key-value pairs',
            description: 'Get single/multiple key-value pairs',
          },
          {
            name: 'Set',
            value: 'set',
            action: 'Set key-value pairs',
            description: 'Set single/multiple key-value pairs',
          },
          {
            name: 'Append',
            value: 'append',
            action: 'Append key-value pairs',
            description: 'Append single/multiple key-value pairs',
          },
        ],
        default: 'get',
      },
      {
        displayName: 'Fields to Set',
        name: 'values',
        type: 'fixedCollection',
        placeholder: 'Add Value',
        default: {},
        typeOptions: {
          multipleValues: true,
        },
        displayOptions: {
          show: {
            operation: ['set', 'append'],
          },
        },
        options: [
          {
            name: 'keyValuePair',
            displayName: 'Key-Value Pair',
            values: [
              { displayName: 'Name', name: 'name', type: 'string', default: '' },
              {
                displayName: 'Type',
                name: 'type',
                type: 'options',
                options: [
                  { name: 'String', value: 'string' },
                  { name: 'Number', value: 'number' },
                  { name: 'Boolean', value: 'boolean' },
                  { name: 'Array', value: 'array' },
                  { name: 'Object', value: 'object' },
                ],
                default: 'string',
              },
              { displayName: 'Value', name: 'value', type: 'string', default: '' },
            ],
          },
        ],
      },
      {
        displayName:
          'Using Workspace ID mode will store variables at the workflow/workspace level. ' +
          'They will not be unique per execution and will act like global variables.',
        name: 'workspaceNotice',
        type: 'notice',
        default: '',
        displayOptions: {
          show: {
            executionIdMode: ['workspace'],
          }
        },
      },
    ],
	};

  async execute(this: IExecuteFunctions) {
    const items = this.getInputData();
    const returnItems: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;
      const executionMode = this.getNodeParameter('executionIdMode', i) as string;
      const executionId = (() => {
        if (executionMode === 'auto') {
          return this.getExecutionId();
        } else if (executionMode === 'custom') {
          return this.getNodeParameter('customExecutionId', i) as string;
        } else {
          return `${this.getWorkflow().id}`;
        }
      })();
      const n8nFile = process.env.N8N_TEST ? 'n8n-data/test-variables' : '.n8n/variables';
      const filePath = path.resolve(`./${n8nFile}/${executionId}.json`);

      if (operation === 'get') {
        let existingData: IDataObject[] = [];

        if (fs.existsSync(filePath)) {
          try {
            existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          } catch {}
        }
        existingData.forEach(obj => returnItems.push({ json: obj }));
      }

      if (operation === 'set' || operation === 'append') {
        let finalData: IDataObject[];
        const keyValuePairs =
          this.getNodeParameter('values.keyValuePair', i) as Array<NodeInput>;

        const newData = keyValuePairs.reduce((acc, pair) => {
          let value;
          switch (pair.type) {
            case 'number':
              value = Number(pair.value);
              break;
            case 'boolean':
              value = typeof pair.value === 'string'
                  ? pair.value === 'true'
                  : pair.value;
              break;
            case 'object':
            case 'array':
              try {
                const normalized = pair.value.replace(/'/g, '"');
                value = JSON.parse(normalized);
              } catch {
                value = pair.value;
              }
              break;
            case 'string':
            default:
              value = pair.value;
          }
          acc[pair.name] = value;
          return acc;
        }, {} as IDataObject);

        if (operation === 'append' && fs.existsSync(filePath)) {
          try {
            const existing = JSON.parse(fs.readFileSync(filePath, 'utf8')) as IDataObject[];
            finalData = [...existing, newData];
          } catch {
            finalData = [newData];
          }
        } else {
          finalData = [newData];
        }

        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2), 'utf8');

        returnItems.push({ json: newData });
      }
    }

    return this.prepareOutputData(returnItems);
  }
}