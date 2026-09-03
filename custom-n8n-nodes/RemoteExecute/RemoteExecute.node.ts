import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

export class RemoteExecute implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Remote Execute',
    name: 'remoteExecute',
    icon: 'file:remoteexecute.svg',
    group: ['transform'],
    version: 1,
    description: 'Execute a shell command on the FastAPI server',
    defaults: { name: 'Remote Execute' },
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
    credentials: [
      {
        name: 'fastApiServerApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Mode',
        name: 'mode',
        type: 'options',
        options: [
          {
            name: 'Command',
            value: 'command',
            description: 'Run a single command directly (no shell — no pipes, variables, or control flow)',
          },
          {
            name: 'Script',
            value: 'script',
            description: 'Run a multi-line bash script (supports pipes, variables, loops, conditionals)',
          },
        ],
        default: 'command',
      },
      {
        displayName: 'Command',
        name: 'command',
        type: 'string',
        typeOptions: { rows: 5 },
        default: '',
        placeholder: 'echo "Hello, World!"',
        description: 'Shell command to execute on the FastAPI server',
        noDataExpression: false,
        displayOptions: { show: { mode: ['command'] } },
      },
      {
        displayName: 'Script',
        name: 'script',
        type: 'string',
        typeOptions: { rows: 10 },
        default: '',
        placeholder: '#!/bin/bash\necho "Hello, World!"',
        description: 'Bash script to execute on the FastAPI server',
        noDataExpression: false,
        displayOptions: { show: { mode: ['script'] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials('fastApiServerApi');
    const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');

    const items = this.getInputData();
    const returnItems: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const mode = this.getNodeParameter('mode', i) as 'command' | 'script';
      const body =
        mode === 'script'
          ? { script: this.getNodeParameter('script', i) as string }
          : { command: this.getNodeParameter('command', i) as string };

      const response = await this.helpers.httpRequestWithAuthentication.call(
        this,
        'fastApiServerApi',
        {
          method: 'POST',
          url: `${baseUrl}/execute`,
          body,
          json: true,
        },
      );

      returnItems.push({ json: response as { output: string; returnCode: number } });
    }

    return this.prepareOutputData(returnItems);
  }
}
