import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

function remarkMermaid() {
  return function (tree) {
    function walk(node) {
      if (!node.children) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type === 'code' && child.lang === 'mermaid') {
          const escaped = child.value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          node.children[i] = {
            type: 'html',
            value: `<div class="mermaid">${escaped}</div>`,
          };
        } else {
          walk(child);
        }
      }
    }
    walk(tree);
  };
}

export default defineConfig({
  base: '/docs',
  trailingSlash: 'always',
  markdown: {
    remarkPlugins: [remarkMermaid],
  },
  integrations: [
    starlight({
      title: 'N8N Automation Platform',
      description: 'Developer documentation for the self-hosted n8n automation stack.',
      customCss: ['./src/styles/custom.css'],
      defaultLocale: 'en',
      head: [
        {
          tag: 'script',
          attrs: { type: 'module' },
          content: `
            import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

            function getMermaidConfig() {
              const isDark = document.documentElement.dataset.theme !== 'light';
              if (isDark) {
                return {
                  startOnLoad: false,
                  theme: 'dark',
                  darkMode: true,
                  // Default all flowcharts/graphs to top-down so diagrams stay
                  // narrow and font size stays readable.
                  flowchart: { rankDir: 'TB', useMaxWidth: true },
                  sequence:  { useMaxWidth: true },
                  gantt:     { useMaxWidth: true },
                  themeVariables: {
                    primaryColor: '#0d9488',
                    primaryTextColor: '#e6edf3',
                    primaryBorderColor: '#0f766e',
                    lineColor: '#8b949e',
                    secondaryColor: '#1c2128',
                    tertiaryColor: '#21262d',
                    background: '#0d1117',
                    mainBkg: '#10141a',
                    nodeBorder: '#0f766e',
                    clusterBkg: '#161b22',
                    clusterBorder: '#30363d',
                    titleColor: '#5eead4',
                    edgeLabelBackground: '#10141a',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '14px',
                    // Sequence diagrams
                    actorBkg: '#10141a',
                    actorBorder: '#0d9488',
                    actorTextColor: '#e6edf3',
                    actorLineColor: '#8b949e',
                    signalColor: '#5eead4',
                    signalTextColor: '#e6edf3',
                    labelBoxBkgColor: '#161b22',
                    labelBoxBorderColor: '#0f766e',
                    labelTextColor: '#5eead4',
                    loopTextColor: '#e6edf3',
                    noteBorderColor: '#0f766e',
                    noteBkgColor: '#042f2e',
                    noteTextColor: '#5eead4',
                  },
                };
              } else {
                return {
                  startOnLoad: false,
                  theme: 'base',
                  darkMode: false,
                  flowchart: { rankDir: 'TB', useMaxWidth: true },
                  sequence:  { useMaxWidth: true },
                  gantt:     { useMaxWidth: true },
                  themeVariables: {
                    // Node fills — teal-700 so white text has 5.4:1 contrast ✓ AA
                    primaryColor: '#0f766e',
                    secondaryColor: '#0891b2',
                    tertiaryColor: '#7c3aed',
                    // White text on all dark node fills
                    primaryTextColor: '#ffffff',
                    secondaryTextColor: '#ffffff',
                    tertiaryTextColor: '#ffffff',
                    // Borders
                    primaryBorderColor: '#134e4a',
                    secondaryBorderColor: '#0e7490',
                    // Lines / edges
                    lineColor: '#4a5568',
                    // Backgrounds
                    background: '#f8fafb',
                    mainBkg: '#f8fafb',
                    nodeBorder: '#134e4a',
                    // Clusters (subgraphs)
                    clusterBkg: '#f4f6f6',
                    clusterBorder: '#cbd5e0',
                    // Labels
                    titleColor: '#0f766e',
                    edgeLabelBackground: '#f4f6f6',
                    // Fonts
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '14px',
                    // Sequence diagrams
                    actorBkg: '#0f766e',
                    actorBorder: '#134e4a',
                    actorTextColor: '#ffffff',
                    actorLineColor: '#4a5568',
                    signalColor: '#0d9488',
                    signalTextColor: '#1a202c',
                    labelBoxBkgColor: '#0f766e',
                    labelBoxBorderColor: '#134e4a',
                    labelTextColor: '#ffffff',
                    loopTextColor: '#1a202c',
                    noteBorderColor: '#0d9488',
                    noteBkgColor: '#ccfbf1',
                    noteTextColor: '#134e4a',
                    // Pie charts
                    pie1: '#0d9488', pie2: '#0891b2', pie3: '#7c3aed',
                    pie4: '#059669', pie5: '#d97706', pie6: '#dc2626',
                    pieTextColor: '#1a202c',
                    pieSectionTextColor: '#ffffff',
                  },
                };
              }
            }

            function applyColors(container, isDark) {
              const svg = container.querySelector('svg');
              if (!svg) return;

              const textColor  = '#ffffff';          // white on dark nodes — both modes
              const nodeFill   = isDark ? '#10141a' : '#0f766e';
              const nodeStroke = isDark ? '#0f766e' : '#134e4a';
              const edgeColor  = isDark ? '#8b949e' : '#4a5568';

              // 1. SVG <text> elements (v9-style labels)
              svg.querySelectorAll('text').forEach(el => {
                el.style.setProperty('fill', textColor, 'important');
              });

              // 2. HTML inside <foreignObject> (v10/v11-style labels)
              //    Must query from the foreignObject element itself, not the SVG,
              //    because HTML nodes are in a different namespace.
              svg.querySelectorAll('foreignObject').forEach(fo => {
                fo.querySelectorAll('*').forEach(el => {
                  el.style.setProperty('color', textColor, 'important');
                });
              });

              // 3. Node shapes — cover both v9 (.node > shape) and v10/v11 (.label-container, .basic)
              svg.querySelectorAll(
                '.node > rect, .node > circle, .node > ellipse, .node > polygon, .node > path, .label-container, .basic'
              ).forEach(el => {
                if (el.closest('defs')) return;
                el.style.setProperty('fill',   nodeFill,   'important');
                el.style.setProperty('stroke', nodeStroke, 'important');
              });

              // 4. Edges
              svg.querySelectorAll('.edgePath .path, .flowchart-link').forEach(el => {
                el.style.setProperty('stroke', edgeColor, 'important');
              });

              // 5. Arrowheads
              svg.querySelectorAll('.arrowheadPath').forEach(el => {
                el.style.setProperty('fill',   edgeColor, 'important');
                el.style.setProperty('stroke', edgeColor, 'important');
              });

              // 6. Clusters / subgraphs
              svg.querySelectorAll('.cluster rect').forEach(el => {
                el.style.setProperty('fill',   isDark ? '#161b22' : '#f4f6f6', 'important');
                el.style.setProperty('stroke', isDark ? '#30363d' : '#cbd5e0', 'important');
              });
              svg.querySelectorAll('.cluster span, .cluster .nodeLabel').forEach(el => {
                el.style.setProperty('color', isDark ? '#5eead4' : '#0f766e', 'important');
              });
            }

            function initAndRender() {
              const blocks = document.querySelectorAll('div.mermaid');
              if (blocks.length === 0) return;

              const isDark = document.documentElement.dataset.theme !== 'light';

              blocks.forEach(el => {
                if (!el.dataset.mermaidSource) {
                  el.dataset.mermaidSource = el.textContent.trim();
                } else {
                  el.textContent = el.dataset.mermaidSource;
                  el.removeAttribute('data-processed');
                }
              });

              mermaid.initialize(getMermaidConfig());

              // Watch for Mermaid to insert SVG elements, then apply colors.
              // mermaid.run() resolves before DOM updates land, so we observe instead.
              const pending = new Set(Array.from(blocks));
              const obs = new MutationObserver(() => {
                pending.forEach(el => {
                  if (el.querySelector('svg')) {
                    pending.delete(el);
                    applyColors(el, isDark);
                  }
                });
                if (pending.size === 0) obs.disconnect();
              });
              blocks.forEach(el => obs.observe(el, { childList: true, subtree: true }));

              // Safety: if observer never fires (e.g. run() fails), disconnect after 5s
              setTimeout(() => obs.disconnect(), 5000);

              mermaid.run().catch(() => {});
            }

            // Watch for theme toggle — set up once, not inside page-load
            const themeObserver = new MutationObserver(() => initAndRender());
            themeObserver.observe(document.documentElement, {
              attributes: true,
              attributeFilter: ['data-theme'],
            });

            // Re-run on every Astro SPA navigation
            document.addEventListener('astro:page-load', initAndRender);
          `,
        },
        {
          tag: 'script',
          attrs: { src: '/docs/workflow-canvas.js', defer: true },
        },
      ],
      social: [],
      sidebar: [
        { label: 'Getting Started', autogenerate: { directory: 'getting-started' } },
        { label: 'Architecture', autogenerate: { directory: 'architecture' } },
        { label: 'Services', autogenerate: { directory: 'services' } },
        { label: 'n8n Workflows', autogenerate: { directory: 'n8n-workflows' } },
        { label: 'Custom Nodes', autogenerate: { directory: 'custom-nodes' } },
        { label: 'Credentials', autogenerate: { directory: 'credentials' } },
        { label: 'Admin Panel', autogenerate: { directory: 'admin-panel' } },
        { label: 'Database', autogenerate: { directory: 'database' } },
        { label: 'Deployment', autogenerate: { directory: 'deployment' } },
      ],
    }),
  ],
});
