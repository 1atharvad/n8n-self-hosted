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
  it('returns output/returnCode from the API response', async () => {
    const node = new RemoteExecute();
    const mockResponse = { output: 'hello', returnCode: 0 };
    const context = makeMock({ mode: 'command', command: 'echo hello' }, async () => mockResponse);

    const result = await node.execute.call(context);

    expect(result[0][0].json).toEqual(mockResponse);
  });

  it('sends command in request body when mode is command', async () => {
    const node = new RemoteExecute();
    let capturedBody: unknown;
    const context = makeMock(
      { mode: 'command', command: 'ls' },
      async (_cred, opts) => { capturedBody = opts.body; return { output: '', returnCode: 0 }; },
    );

    await node.execute.call(context);

    expect(capturedBody).toEqual({ command: 'ls' });
  });

  it('sends script in request body when mode is script', async () => {
    const node = new RemoteExecute();
    let capturedBody: unknown;
    const context = makeMock(
      { mode: 'script', script: 'echo one\necho two' },
      async (_cred, opts) => { capturedBody = opts.body; return { output: '', returnCode: 0 }; },
    );

    await node.execute.call(context);

    expect(capturedBody).toEqual({ script: 'echo one\necho two' });
  });
});
