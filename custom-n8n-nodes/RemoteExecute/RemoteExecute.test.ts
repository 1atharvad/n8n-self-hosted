import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { RemoteExecute } from './RemoteExecute.node';

type MockHttpFn = (credName: string, opts: { body: unknown }) => Promise<unknown>;

const makeMock = (params: Record<string, unknown>, httpFn: MockHttpFn): IExecuteFunctions =>
  ({
    getInputData: (): INodeExecutionData[] => [{ json: {} }],
    getNodeParameter: (_name: string) => params[_name],
    getCredentials: async () => ({ baseUrl: 'http://localhost:9374', apiKey: 'test-key' }),
    helpers: { httpRequestWithAuthentication: httpFn } as unknown,
    prepareOutputData: (items: INodeExecutionData[]) => Promise.resolve([items]),
  }) as unknown as IExecuteFunctions;

describe('RemoteExecute Node', () => {
  it('returns stdout/stderr/returnCode from the API response', async () => {
    const node = new RemoteExecute();
    const mockResponse = { stdout: 'hello\n', stderr: '', returnCode: 0 };
    const context = makeMock({ command: 'echo hello' }, async () => mockResponse);

    const result = await node.execute.call(context);

    expect(result[0][0].json).toEqual(mockResponse);
  });

  it('sends command in request body', async () => {
    const node = new RemoteExecute();
    let capturedBody: unknown;
    const context = makeMock(
      { command: 'ls' },
      async (_cred, opts) => { capturedBody = opts.body; return { stdout: '', stderr: '', returnCode: 0 }; },
    );

    await node.execute.call(context);

    expect(capturedBody).toEqual({ command: 'ls' });
  });
});
