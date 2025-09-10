import fs from 'fs';
import path from 'path';
import type {
  IExecuteFunctions,
  INodeExecutionData,
  IWorkflowMetadata
} from 'n8n-workflow';
import { JsonVariables } from '../JsonVariables/JsonVariables.node';

export const createMockExecuteFunctions = (
  params: Record<string, any>
): Partial<IExecuteFunctions> => {
  return {
    getInputData: (): INodeExecutionData[] => [{ json: {} }],
    getNodeParameter: (name: string) => params[name],
    getWorkflow: (): IWorkflowMetadata => ({
      id: 'mock-workflow-id',
      name: 'Mock Workflow',
      active: true
    }),
    prepareOutputData: (items: INodeExecutionData[]): Promise<INodeExecutionData[][]> =>
      Promise.resolve([items]),
  };
};

const variablesDir = './n8n-data/test-variables';

describe('JsonVariables Node', () => {
  beforeAll(() => {
    process.env.N8N_TEST = 'true'; // ensure test mode
    fs.mkdirSync(variablesDir, { recursive: true });
  });

  afterEach(() => {
    // clean up files after each test
    if (fs.existsSync(variablesDir)) {
      fs.readdirSync(variablesDir).forEach(file => fs.unlinkSync(path.join(variablesDir, file)));
    }
  });

  afterAll(() => {
    // remove the test folder
    if (fs.existsSync(variablesDir)) {
      fs.rmdirSync(variablesDir, { recursive: true });
    }
  });

  it('should set key-value pairs when operation=set', async () => {
    const node = new JsonVariables();
    const context = createMockExecuteFunctions({
      operation: 'set',
      'values.keyValuePair': [
        { name: 'age', type: 'number', value: '42' },
        { name: 'active', type: 'boolean', value: true },
        { name: 'is_flag', type: 'boolean', value: 'false' },
        { name: 'raw', type: 'string', value: 'hello' },
        { name: 'data', type: 'object', value: '{"foo":"bar"}' },
        { name: 'array', type: 'array', value: '["foo", "bar", "old"]' },
      ],
      useExecutionId: true,
      executionId: 'test-set',
    });

    const result: INodeExecutionData[][] = await node.execute.call(context as IExecuteFunctions);

    expect(result[0][0].json).toEqual({
      age: 42,
      active: true,
      is_flag: false,
      raw: 'hello',
      data: { foo: 'bar' },
      array: [ 'foo', 'bar', 'old' ]
    });
  });

  it('should append key-value pairs when operation=append', async () => {
    const node = new JsonVariables();

    const setContext = createMockExecuteFunctions({
      operation: 'set',
      'values.keyValuePair': [{ name: 'first', type: 'string', value: 'one' }],
      useExecutionId: true,
      executionId: 'test-append',
    });
    await node.execute.call(setContext as IExecuteFunctions);

    const appendContext = createMockExecuteFunctions({
      operation: 'append',
      'values.keyValuePair': [{ name: 'second', type: 'string', value: 'two' }],
      useExecutionId: true,
      executionId: 'test-append',
    });
    const result: INodeExecutionData[][] = await node.execute.call(appendContext as IExecuteFunctions);

    expect(result[0][0].json).toEqual({ second: 'two' });
  });

  it('should get existing key-value pairs when operation=get', async () => {
    const node = new JsonVariables();

    const setContext = createMockExecuteFunctions({
      operation: 'set',
      'values.keyValuePair': [{ name: 'foo', type: 'string', value: 'bar' }],
      useExecutionId: true,
      executionId: 'test-get',
    });
    await node.execute.call(setContext as IExecuteFunctions);

    const getContext = createMockExecuteFunctions({
      operation: 'get',
      useExecutionId: true,
      executionId: 'test-get',
    });
    const result: INodeExecutionData[][] = await node.execute.call(getContext as IExecuteFunctions);

    expect(result[0][0].json).toEqual({ foo: 'bar' });
  });
});