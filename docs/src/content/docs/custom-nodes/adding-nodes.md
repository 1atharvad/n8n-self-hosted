---
title: Adding a New Custom Node
description: Step-by-step guide to creating a new TypeScript n8n node in this repo.
sidebar:
  order: 3
---

## Build and test loop

```bash
# Compile and install
npm run build-n8n-nodes

# Restart n8n to load the new build
docker restart n8n

# Run tests
npm test
npm run test:watch
```

The build script (`gulpfile.js`) runs `tsc` then copies compiled output into `n8n-data/custom/`. The dev compose mounts `n8n-data/` into the n8n container — no image rebuild needed.

---

## Steps to create a new node

### 1. Create the directory

```
custom-n8n-nodes/
└── YourNodeName/
    ├── YourNodeName.node.ts
    ├── YourNodeName.node.svg   ← icon (required)
    └── YourNodeName.test.ts   ← tests
```

### 2. Implement the node class

Follow `JsonVariables.node.ts` as a template. The class must implement `INodeType`:

```typescript
import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class YourNodeName implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Your Node Name',
    name: 'yourNodeName',
    icon: 'file:YourNodeName.node.svg',
    group: ['transform'],
    version: 1,
    description: 'What this node does',
    defaults: { name: 'Your Node Name' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      // define UI parameters here
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    // ... your logic ...
    return [items];
  }
}
```

### 3. Add an SVG icon

Place a square SVG icon at `custom-n8n-nodes/YourNodeName/YourNodeName.node.svg`. Minimum size: 60×60px. n8n displays it in the node palette.

### 4. Register the node in `package.json`

```json
"n8n": {
  "nodes": [
    "dist/custom-n8n-nodes/JsonVariables/JsonVariables.node.js",
    "dist/custom-n8n-nodes/RemoteExecute/RemoteExecute.node.js",
    "dist/custom-n8n-nodes/YourNodeName/YourNodeName.node.js"
  ]
}
```

### 5. Add a custom credential type (if needed)

If your node needs a new credential type:

1. Create `custom-n8n-nodes/credentials/YourCredential.credentials.ts`.
2. Register it under `n8n.credentials` in `package.json`:
   ```json
   "credentials": [
     "dist/custom-n8n-nodes/credentials/FastApiServerApi.credentials.js",
     "dist/custom-n8n-nodes/credentials/YourCredential.credentials.js"
   ]
   ```

### 6. Write tests

Create `YourNodeName.test.ts` in the same directory. Tests use Jest:

```typescript
import { YourNodeName } from './YourNodeName.node';

describe('YourNodeName', () => {
  it('should ...', () => {
    // test
  });
});
```

### 7. Build and verify

```bash
npm run build-n8n-nodes
docker restart n8n
```

Open the n8n UI and search for your node name in the node palette to confirm it loaded.
