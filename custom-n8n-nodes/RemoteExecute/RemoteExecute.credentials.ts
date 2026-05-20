import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class FastApiServerApi implements ICredentialType {
  name = 'fastApiServerApi';
  displayName = 'FastAPI Server';
  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'http://localhost:9374',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
    },
  ];
}
