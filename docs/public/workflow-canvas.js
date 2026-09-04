(function () {
  'use strict';

  const NODE_W = 200;
  const NODE_H = 60;
  const PAD    = 80;

  function nodeColor(type) {
    const t = type.toLowerCase();
    if (t.includes('trigger') || t.includes('webhook'))
      return { fill: '#0e7490', stroke: '#0c4a6e' };
    if (t.includes('postgres') || t.includes('mysql') || t.includes('sqlite'))
      return { fill: '#065f46', stroke: '#047857' };
    if (t.includes('httprequest') || t.includes('httpbin'))
      return { fill: '#1e3a8a', stroke: '#1e40af' };
    if (t.includes('executeworkflow') || t.includes('subworkflow'))
      return { fill: '#4c1d95', stroke: '#6d28d9' };
    if (t.includes('code') || t.includes('function'))
      return { fill: '#374151', stroke: '#4b5563' };
    if (t.includes('langchain') || t.includes('openai') || t.includes('lmchat'))
      return { fill: '#713f12', stroke: '#92400e' };
    if (t.includes('gmail') || t.includes('smtp') || t.includes('email'))
      return { fill: '#1e3a5f', stroke: '#2563eb' };
    return { fill: '#0d9488', stroke: '#0f766e' };
  }

  function trunc(str, max) {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function shortType(type) {
    const last = type.split('.').pop();
    return last.replace(/([A-Z])/g, ' $1').trim();
  }

  class WorkflowCanvas extends HTMLElement {
    connectedCallback() {
      const id = this.getAttribute('workflow-id');
      if (!id) { this._err('Missing workflow-id attribute'); return; }
      this._loading();
      fetch(`/workflow-api/workflows/${id}`)
        .then(r => {
          if (!r.ok) throw new Error(`n8n API returned ${r.status}`);
          return r.json();
        })
        .then(data => this._render(data))
        .catch(e => this._err(e.message));
    }

    _loading() {
      this.innerHTML = '<div class="wf-state">Loading workflow…</div>';
    }

    _err(msg) {
      this.innerHTML = `<div class="wf-state wf-err">⚠️ ${esc(msg)}</div>`;
    }

    _render(wf) {
      const nodes = wf.nodes || [];
      const connections = wf.connections || {};
      if (!nodes.length) { this._err('Workflow has no nodes'); return; }

      // Bounding box in n8n canvas coordinates
      const xs = nodes.map(n => n.position[0]);
      const ys = nodes.map(n => n.position[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const svgW = Math.max(...xs) - minX + NODE_W + PAD * 2;
      const svgH = Math.max(...ys) - minY + NODE_H + PAD * 2;

      const px = n => n.position[0] - minX + PAD;
      const py = n => n.position[1] - minY + PAD;

      const nodeMap = {};
      nodes.forEach(n => { nodeMap[n.name] = n; });

      // Edges
      let edges = '';
      Object.entries(connections).forEach(([srcName, outputs]) => {
        const src = nodeMap[srcName];
        if (!src) return;
        const sx = px(src) + NODE_W;
        const sy = py(src) + NODE_H / 2;
        (outputs.main || []).forEach(group => {
          (group || []).forEach(conn => {
            const tgt = nodeMap[conn.node];
            if (!tgt) return;
            const tx = px(tgt);
            const ty = py(tgt) + NODE_H / 2;
            const cx = (sx + tx) / 2;
            edges += `<path d="M${sx},${sy} C${cx},${sy} ${cx},${ty} ${tx},${ty}" class="wf-edge" marker-end="url(#wf-arr)"/>`;
          });
        });
      });

      // Nodes
      let nodesHtml = '';
      nodes.forEach(n => {
        const x = px(n);
        const y = py(n);
        const { fill, stroke } = nodeColor(n.type);
        nodesHtml += `
<g class="wf-node">
  <rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
  <text x="${x + NODE_W / 2}" y="${y + 22}" class="wf-nl" text-anchor="middle" dominant-baseline="middle">${esc(trunc(n.name, 26))}</text>
  <text x="${x + NODE_W / 2}" y="${y + 42}" class="wf-nt" text-anchor="middle" dominant-baseline="middle">${esc(trunc(shortType(n.type), 30))}</text>
</g>`;
      });

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" class="wf-svg">
  <defs>
    <marker id="wf-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" class="wf-arrowhead"/>
    </marker>
  </defs>
  ${edges}
  ${nodesHtml}
</svg>`;

      this.innerHTML =
        `<div class="wf-header"><span class="wf-name">${esc(wf.name)}</span><span class="wf-badge">${nodes.length} nodes</span></div>` +
        `<div class="wf-canvas-wrap">${svg}</div>`;
    }
  }

  if (!customElements.get('workflow-canvas')) {
    customElements.define('workflow-canvas', WorkflowCanvas);
  }
})();
