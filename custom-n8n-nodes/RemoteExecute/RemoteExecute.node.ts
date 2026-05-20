import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
} from 'n8n-workflow';

export class RemoteExecute implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Remote Execute',
    name: 'remoteExecute',
    icon: 'fa:terminal',
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
        displayName: 'Command',
        name: 'command',
        type: 'string',
        typeOptions: { rows: 5 },
        default: '',
        placeholder: 'sh /sh_files/cleanup.sh --confirm',
        description: 'Shell command to execute on the FastAPI server',
        noDataExpression: false,
      },
      {
        displayName: 'Working Directory',
        name: 'cwd',
        type: 'string',
        default: '',
        placeholder: '/home/node',
        description: 'Working directory on the FastAPI server (optional)',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials('fastApiServerApi');
    const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
    const apiKey = credentials.apiKey as string;

    const items = this.getInputData();
    const returnItems: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const command = this.getNodeParameter('command', i) as string;
      const cwd = (this.getNodeParameter('cwd', i) as string) || undefined;

      const response = await this.helpers.httpRequest({
        method: 'POST',
        url: `${baseUrl}/execute`,
        headers: { 'X-API-Key': apiKey },
        body: { command, ...(cwd ? { cwd } : {}) },
        json: true,
      });

      returnItems.push({ json: response as { stdout: string; stderr: string; returnCode: number } });
    }

    return this.prepareOutputData(returnItems);
  }
}
