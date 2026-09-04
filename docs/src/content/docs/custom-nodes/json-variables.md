---
title: JsonVariables
description: Persistent key-value variable storage scoped to an execution, a custom ID, or the workspace.
sidebar:
  order: 1
---

**Node name in n8n:** `Variables` (displayed as "Workflow Variables")  
**Internal name:** `JsonVariables`  
**Source:** `custom-n8n-nodes/JsonVariables/JsonVariables.node.ts`

Provides persistent key-value variable storage scoped to an execution, a custom ID, or the entire workspace. Solves the problem of sharing state between disconnected branches within a workflow, or carrying data between sub-workflows.

Variables are stored as JSON files on disk at `.n8n/variables/<id>.json` inside the n8n container.

---

## Operations

| Operation | Description |
|---|---|
| **Get** | Read all key-value pairs for the current scope. Returns each pair as a separate item. |
| **Set** | Write one or more key-value pairs, replacing any existing data for the scope. |
| **Append** | Add key-value pairs to the existing list without overwriting previous entries. |

---

## Scope modes

| Mode | Scope | File path | Use when |
|---|---|---|---|
| `Use Execution ID` (default) | Unique per execution | `.n8n/variables/<execution-id>.json` | Storing data that should not leak between runs |
| `Custom ID` | Any string you provide | `.n8n/variables/<your-id>.json` | Sharing data between sub-workflows by using the same ID |
| `Use Workspace ID` | Shared across all executions of this workflow | `.n8n/variables/<workflow-id>.json` | Global workflow-level config that persists across runs |

> **Warning:** Workspace ID mode writes to a shared file. Concurrent executions can overwrite each other. Use it only for read-heavy global config, not per-run state.

---

## Supported value types

`String`, `Number`, `Boolean`, `Array`, `Object`

Arrays and Objects can be passed as JSON strings — single quotes are normalized to double quotes automatically.

---

## Example usage

### Within a workflow (carry data between branches)

```
[Variables: Set]
  Key: "jobId"
  Value: "{{ $json.id }}"
  Mode: Use Execution ID
         ↓
[... other processing ...]
         ↓
[Variables: Get]
  Mode: Use Execution ID
  → outputs: { jobId: "abc123" }
```

### Cross-workflow (parent → sub-workflow)

In the parent workflow, set a Custom ID to a shared job UUID:
```
[Variables: Set]
  Key: "sharedKey"
  Value: "{{ $json.uuid }}"
  Mode: Custom ID
  ID:   "{{ $json.uuid }}"
```

In the sub-workflow, read it using the same Custom ID:
```
[Variables: Get]
  Mode: Custom ID
  ID:   "{{ $json.uuid }}"   ← passed in from parent as an input field
```

---

## File storage

Variables are stored as plain JSON files in the n8n data directory. In the Docker setup, `n8n-data/` is mounted into the container at `.n8n/`, so the variable files are at `n8n-data/variables/` on the host.

These files are not cleaned up automatically — use the Cleanup & Reset workflow to delete them if needed for per-run variables, or let n8n's execution cleanup handle them.
