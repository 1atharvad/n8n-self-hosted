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
        displayName: 'Command',
        name: 'command',
        type: 'string',
        typeOptions: { rows: 5 },
        default: '',
        placeholder: 'echo "Hello, World!"',
        description: 'Shell command to execute on the FastAPI server',
        noDataExpression: false,
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials('fastApiServerApi');
    const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');

    const items = this.getInputData();
    const returnItems: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const command = this.getNodeParameter('command', i) as string;

      const response = await this.helpers.httpRequestWithAuthentication.call(
        this,
        'fastApiServerApi',
        {
          method: 'POST',
          url: `${baseUrl}/execute`,
          body: { command },
          json: true,
        },
      );

      returnItems.push({ json: response as { stdout: string; stderr: string; returnCode: number } });
    }

    return this.prepareOutputData(returnItems);
  }
}
