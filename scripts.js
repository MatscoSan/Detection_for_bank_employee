// Script extrait de index.html — charge les données et rend le graphe
Chart.register(ChartDataLabels);

const COLOR_START = { r:255, g:240, b:245};
const COLOR_END   = { r:153, g:0, b:0 };

function getColorForScore(score) {
    const ratio = score / 100;
    const r = Math.round(COLOR_START.r - ratio * (COLOR_START.r - COLOR_END.r));
    const g = Math.round(COLOR_START.g - ratio * (COLOR_START.g - COLOR_END.g));
    const b = Math.round(COLOR_START.b - ratio * (COLOR_START.b - COLOR_END.b));
    return `rgba(${r}, ${g}, ${b}, 0.9)`;
}

function attachCanvasInteraction(chart) {
    const canvas = chart.canvas;
    if(!canvas) return;
    let draggingIndex = null;
    let panning = false;
    let panStart = null;

    canvas.style.cursor = 'default';

    canvas.onmousedown = (evt) => {
        const rect = canvas.getBoundingClientRect();
        // use canvas-local coordinates for hit testing
        const mx = evt.clientX - rect.left;
        const my = evt.clientY - rect.top;
        const meta = chart.getDatasetMeta(0);
        draggingIndex = null;
        // find nearest point within radius (in pixels)
        const HIT_RADIUS = 12;
        if(meta && meta.data) {
            for(let i=0;i<meta.data.length;i++){
                const el = meta.data[i];
                if(!el) continue;
                if(el.hidden) continue;
                const dx = el.x - mx;
                const dy = el.y - my;
                const dist = Math.hypot(dx, dy);
                if(dist <= HIT_RADIUS) { draggingIndex = i; break; }
            }
        }
        if(draggingIndex !== null) {
            canvas.style.cursor = 'grabbing';
        } else {
            // start panning
            panning = true;
            panStart = { x: evt.clientX, y: evt.clientY };
            canvas.style.cursor = 'grab';
        }
    };

    canvas.onmousemove = (evt) => {
        const rect = canvas.getBoundingClientRect();
        if(draggingIndex !== null) {
            // convert mouse pixels to data values using chart scales when available
            const canvasX = evt.clientX - rect.left;
            const canvasY = evt.clientY - rect.top;
            let xVal, yVal;
            if(chart.scales && chart.scales.x && chart.scales.y && typeof chart.scales.x.getValueForPixel === 'function') {
                xVal = chart.scales.x.getValueForPixel(canvasX);
                yVal = chart.scales.y.getValueForPixel(canvasY);
            } else {
                xVal = (canvasX / rect.width) * 100;
                yVal = (canvasY / rect.height) * 100;
            }
            if(CURRENT_POINTS[draggingIndex]) {
                CURRENT_POINTS[draggingIndex].x = xVal;
                CURRENT_POINTS[draggingIndex].y = yVal;
                try { chart.update('none'); } catch(e) { /* ignore */ }
            }
        } else if(panning) {
            // pan by computing value delta via scales if possible
            const prevPixel = { x: panStart.x - rect.left, y: panStart.y - rect.top };
            const curPixel = { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
            let dxVal, dyVal;
            if(chart.scales && chart.scales.x && chart.scales.y && typeof chart.scales.x.getValueForPixel === 'function') {
                const prevXVal = chart.scales.x.getValueForPixel(prevPixel.x);
                const prevYVal = chart.scales.y.getValueForPixel(prevPixel.y);
                const curXVal = chart.scales.x.getValueForPixel(curPixel.x);
                const curYVal = chart.scales.y.getValueForPixel(curPixel.y);
                dxVal = curXVal - prevXVal;
                dyVal = curYVal - prevYVal;
            } else {
                dxVal = ((curPixel.x - prevPixel.x) / rect.width) * 100;
                dyVal = ((curPixel.y - prevPixel.y) / rect.height) * 100;
            }
            panStart = { x: evt.clientX, y: evt.clientY };
            for(let i=0;i<CURRENT_POINTS.length;i++){
                CURRENT_POINTS[i].x = CURRENT_POINTS[i].x + dxVal;
                CURRENT_POINTS[i].y = CURRENT_POINTS[i].y + dyVal;
            }
            try { chart.update('none'); } catch(e) { /* ignore */ }
        }
    };

    canvas.onmouseup = canvas.onmouseleave = (evt) => {
        draggingIndex = null;
        if(panning) {
            panning = false;
        }
        canvas.style.cursor = 'default';
    };
}

let ALL_NODES = [];
let chartInstance = null;
let ID_TO_NAME = {};
// current rendered points and interactions (used for dragging/panning)
let CURRENT_POINTS = [];
let CURRENT_INTERACTIONS = [];

function roleSize(role) {
    if(!role) return 12;
    if(role.toLowerCase().includes('business')) return 18;
    if(role.toLowerCase().includes('member')) return 14;
    if(role.toLowerCase().includes('viewing')) return 10;
    return 12;
}

function roleScore(role) {
    if(!role) return 40;
    if(role.toLowerCase().includes('business')) return 85;
    if(role.toLowerCase().includes('member')) return 55;
    if(role.toLowerCase().includes('viewing')) return 20;
    return 40;
}

function buildRawPoint(nObj, x, y) {
    const size = roleSize(nObj.role);
    const score = roleScore(nObj.role);
    const name = nObj.name || nObj.id;
    return { x, y, r: size, originalScore: score, id: nObj.id, label: name, name: name, parent: nObj.parent || null, parent_name: nObj.parent_name || null, role: nObj.role, links: nObj.links || [] };
}

function createChart(ctx, rawData, interactions) {
    const bgColors = rawData.map(d => getColorForScore(d.originalScore));

    const drawNetworkLines = {
        id: 'drawNetworkLines',
        beforeDatasetsDraw(chart, args, options) {
            const { ctx } = chart;
            ctx.save();
            ctx.beginPath();
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = 'rgba(200, 200, 200, 0.7)';

            const meta = chart.getDatasetMeta(0);

            // hide points that are outside the visible chart area to avoid drawing them
            const area = chart.chartArea || { left: 0, right: ctx.canvas.width, top: 0, bottom: ctx.canvas.height };
            if(meta && meta.data) {
                meta.data.forEach(pt => {
                    if(!pt) return;
                    if(pt.x < area.left || pt.x > area.right || pt.y < area.top || pt.y > area.bottom) {
                        pt.hidden = true;
                    } else {
                        pt.hidden = false;
                    }
                });
            }

            interactions.forEach(link => {
                const pointA = meta.data[link.from];
                const pointB = meta.data[link.to];
                if(pointA && pointB && !pointA.hidden && !pointB.hidden) {
                    ctx.moveTo(pointA.x, pointA.y);
                    ctx.lineTo(pointB.x, pointB.y);
                }
            });

            ctx.stroke();
            ctx.restore();
        }
    };

    if(chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{ label: 'Entités', data: rawData, backgroundColor: bgColors, borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1 }]
        },
        plugins: [drawNetworkLines],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: 20 },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true, callbacks: { label: (ctx) => { const d = ctx.raw; const linkNames = (d.links||[]).map(id => ID_TO_NAME[id] || id); const linksText = linkNames.length ? `\nLiens: ${linkNames.slice(0,10).join(', ')}${linkNames.length>10 ? ' ...' : ''}` : ''; return `${d.name} — ${d.role || 'N/A'}${linksText}`; } } },
                datalabels: { color: 'white', font: { weight: 'bold', size: 11 }, formatter: (val, ctx) => { const d = ctx.dataset.data[ctx.dataIndex]; return d.name; }, display: (ctx) => { const meta = ctx.chart.getDatasetMeta(ctx.datasetIndex); const el = meta && meta.data && meta.data[ctx.dataIndex]; if(el && el.hidden) return false; return ctx.dataset.data[ctx.dataIndex].r > 11; } }
            },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
    // expose current points/interactions for interaction handlers
    CURRENT_POINTS = rawData;
    CURRENT_INTERACTIONS = interactions;

    // attach simple drag & pan handlers to the canvas
    try {
        attachCanvasInteraction(chartInstance);
    } catch (e) {
        console.warn('attachCanvasInteraction failed', e);
    }
}

async function loadData() {
    let nodes = [];
    if(window.CUSTOMERS_RELATIONSHIP && Array.isArray(window.CUSTOMERS_RELATIONSHIP.nodes)) {
        nodes = window.CUSTOMERS_RELATIONSHIP.nodes;
        console.info('Loaded customers from window.CUSTOMERS_RELATIONSHIP');
    } else {
        try {
            const resp = await fetch('data/customers_relationship.json');
            if(resp.ok) {
                const json = await resp.json();
                nodes = json.nodes || [];
            } else {
                console.warn('Impossible de charger data/customers_relationship.json, statut:', resp.status);
            }
        } catch (e) {
            console.warn('Erreur lors du fetch du JSON:', e);
        }
    }
    ALL_NODES = nodes;
    // build id -> name map for tooltip display
    ID_TO_NAME = {};
    ALL_NODES.forEach(n => { ID_TO_NAME[n.id] = n.name || n.id; });
    populateDatalist(nodes);
}

function populateDatalist(nodes) {
    const list = document.getElementById('clients-list');
    if(!list) return;
    list.innerHTML = '';
    // Compute degree = number of children + (has parent ? 1 : 0)
    const idToChildrenCount = {};
    nodes.forEach(n => { idToChildrenCount[n.id] = 0; });
    nodes.forEach(n => {
        if(n.parent && idToChildrenCount[n.parent] !== undefined) {
            idToChildrenCount[n.parent] += 1;
        }
    });

    const nodesWithDegree = nodes.map(n => {
        const children = idToChildrenCount[n.id] || 0;
        const degree = children + (n.parent ? 1 : 0);
        return Object.assign({}, n, { degree, childrenCount: children });
    });

    // Sort descending by degree (most connected first), then by name
    nodesWithDegree.sort((a,b) => {
        if(b.degree !== a.degree) return b.degree - a.degree;
        const an = (a.name||'').toLowerCase();
        const bn = (b.name||'').toLowerCase();
        return an < bn ? -1 : (an > bn ? 1 : 0);
    });

    nodesWithDegree.forEach(n => {
        const opt = document.createElement('option');
        // value used for selection; include id so selection is unambiguous
        opt.value = `${n.name} | ${n.id}`;
        // keep degree in data attribute for debugging/UX if needed
        opt.dataset.degree = String(n.degree);
        list.appendChild(opt);
    });
}

function findNodeByInput(input) {
    if(!input) return null;
    // If input contains '|' assume format 'name | id'
    const pipe = input.indexOf('|');
    if(pipe !== -1) {
        const id = input.slice(pipe+1).trim();
        return ALL_NODES.find(n => n.id === id) || null;
    }
    // try exact case-insensitive name first
    const byName = ALL_NODES.find(n => (n.name||'').toLowerCase() === input.toLowerCase());
    if(byName) return byName;
    // otherwise try substring search on name
    const sub = ALL_NODES.find(n => (n.name||'').toLowerCase().includes(input.toLowerCase()));
    if(sub) return sub;
    // lastly try id match
    const byId = ALL_NODES.find(n => n.id === input);
    return byId || null;
}

function renderForNode(node) {
    const ctx = document.getElementById('myBubbleChart').getContext('2d');
    if(!node) {
        // show empty chart or message
        createChart(ctx, [], []);
        return;
    }

    // find parent and children
    const parent = node.parent ? ALL_NODES.find(n => n.id === node.parent) : null;
    const children = ALL_NODES.filter(n => n.parent === node.id);
    // build initial layout: center node at (50,50), place relations initially around a small circle
    const center = { x: 50, y: 50 };
    const points = [];
    const interactions = [];

    // central node (index 0)
    points.push(buildRawPoint(node, center.x, center.y));
    const centerIndex = 0;

    // collect relations (parent first, then children) but avoid duplicates
    const relations = [];
    if(parent && parent.id !== node.id) relations.push(parent);
    children.forEach(c => { if(c.id !== node.id && (!parent || c.id !== parent.id)) relations.push(c); });

    // initial positions for relations (small circle) so forceLayout has a sensible start
    const relCount = relations.length;
    const initRadius = Math.max(14, 12 + relCount * 3);
    for(let i=0;i<relCount;i++){
        const rel = relations[i];
        const angle = (2 * Math.PI * i) / Math.max(1, relCount);
        const x = center.x + Math.cos(angle) * initRadius;
        const y = center.y + Math.sin(angle) * initRadius;
        const idx = points.length;
        points.push(buildRawPoint(rel, x, y));
        // link relation -> center
        interactions.push({ from: idx, to: centerIndex });
    }

    // run force-directed layout so nodes are arranged as a graph
    try {
        forceLayout(points, interactions, Math.min(500, Math.max(80, points.length * 25)));
    } catch(e) {
        console.warn('forceLayout failed in renderForNode', e);
    }

    createChart(ctx, points, interactions);
}

function attachUI() {
    const input = document.getElementById('client-search');
    if(!input) return;
    input.addEventListener('change', (e) => {
        const val = e.target.value.trim();
        const node = findNodeByInput(val);
        renderForNode(node);
    });
    input.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') {
            e.preventDefault();
            const val = input.value.trim();
            const node = findNodeByInput(val);
            renderForNode(node);
        }
    });

    // Overview controls
    const overviewBtn = document.getElementById('overview-btn');
    const maxNodesInput = document.getElementById('max-nodes');
    const resetBtn = document.getElementById('reset-btn');
    if(overviewBtn && maxNodesInput) {
        overviewBtn.addEventListener('click', () => {
            const v = parseInt(maxNodesInput.value, 10) || 50;
            renderOverview(v);
        });
    }
    if(resetBtn) {
        resetBtn.addEventListener('click', () => {
            const inputEl = document.getElementById('client-search');
            if(inputEl) inputEl.value = '';
            // render empty chart
            renderForNode(null);
        });
    }
}

function computeDegrees() {
    // compute children count and degree for ALL_NODES
    const idToChildren = {};
    ALL_NODES.forEach(n => { idToChildren[n.id] = []; });
    ALL_NODES.forEach(n => { if(n.parent && idToChildren[n.parent]) idToChildren[n.parent].push(n.id); });
    ALL_NODES.forEach(n => { const children = idToChildren[n.id] || []; n.childrenCount = children.length; n.degree = children.length + (n.parent ? 1 : 0); n._children = children; });
}

// Lightweight force-directed layout to spread nodes for readability
function forceLayout(points, interactions, iterations = 150) {
    if(!points || points.length <= 1) return;
    const n = points.length;
    const pos = points.map(p => ({ x: p.x, y: p.y }));
    // increase layout area so nodes can spread in a more circular/graph-like space
    const area = Math.max(10000, n * 800); // proportional to node count
    const k = Math.sqrt(area / n);
    let temp = Math.min(1.0, Math.max(0.2, 0.2 + n * 0.001));
    const attractionStrength = 0.06;

    // adjacency set
    const adj = Array.from({ length: n }, () => new Set());
    interactions.forEach(link => { if(link.from !== link.to) { adj[link.from].add(link.to); adj[link.to].add(link.from); } });

    for(let iter=0; iter<iterations; iter++) {
        const disp = Array.from({ length: n }, () => ({ x: 0, y: 0 }));

        // repulsion
        for(let i=0;i<n;i++){
            for(let j=i+1;j<n;j++){
                let dx = pos[i].x - pos[j].x;
                let dy = pos[i].y - pos[j].y;
                let dist = Math.hypot(dx, dy) || 0.001;
                const force = (k * k) / (dist + 0.01);
                const fx = (dx / (dist + 0.01)) * force;
                const fy = (dy / (dist + 0.01)) * force;
                disp[i].x += fx; disp[i].y += fy;
                disp[j].x -= fx; disp[j].y -= fy;
            }
        }

        // attraction for links
        for(let i=0;i<n;i++){
            adj[i].forEach(j => {
                let dx = pos[j].x - pos[i].x;
                let dy = pos[j].y - pos[i].y;
                let dist = Math.hypot(dx, dy) || 0.001;
                const force = (dist * dist) / k;
                const fx = (dx / dist) * force * attractionStrength;
                const fy = (dy / dist) * force * attractionStrength;
                disp[i].x += fx; disp[i].y += fy;
                disp[j].x -= fx; disp[j].y -= fy;
            });
        }

        // apply displacements with temperature cap
        for(let i=0;i<n;i++){
            const dx = disp[i].x;
            const dy = disp[i].y;
            const len = Math.hypot(dx, dy);
            if(len > 0) {
                pos[i].x += (dx / len) * Math.min(len, temp * 100);
                pos[i].y += (dy / len) * Math.min(len, temp * 100);
            }
            // allow positions outside 0..100 so nodes form a natural graph (not clipped to square)
            // but keep some practical limits to avoid runaway values
            const MIN_BOUND = -200;
            const MAX_BOUND = 300;
            pos[i].x = Math.max(MIN_BOUND, Math.min(MAX_BOUND, pos[i].x));
            pos[i].y = Math.max(MIN_BOUND, Math.min(MAX_BOUND, pos[i].y));
        }
        temp *= 0.99;
    }

    // write back
    for(let i=0;i<n;i++){ points[i].x = pos[i].x; points[i].y = pos[i].y; }
}

function renderOverview(limit) {
    const ctx = document.getElementById('myBubbleChart').getContext('2d');
    // Ensure degrees available
    computeDegrees();
    // pick top by degree desc
    const sorted = [...ALL_NODES].sort((a,b) => (b.degree||0)-(a.degree||0) || ((a.name||'').toLowerCase()<(b.name||'')? -1:1));
    const selection = sorted.slice(0, Math.max(1, limit));
    const ids = new Set(selection.map(s => s.id));

    // layout on circle
    const center = { x: 50, y: 50 };
    const n = selection.length;
    const radius = Math.min(40, 12 + n / 6);
    const points = selection.map((s, i) => {
        const angle = (2 * Math.PI * i) / n;
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;
        return buildRawPoint(s, x, y);
    });

    // interactions only among selected nodes (use links field)
    const idIndex = {};
    points.forEach((p, idx) => { idIndex[p.id] = idx; });
    const interactions = [];
    selection.forEach((s, idx) => {
        const links = s.links || s._children || [];
        links.forEach(lid => {
            if(ids.has(lid) && idIndex[lid] !== undefined) {
                interactions.push({ from: idx, to: idIndex[lid] });
            }
        });
        // also add parent link if parent in selection
        if(s.parent && ids.has(s.parent) && idIndex[s.parent] !== undefined) {
            interactions.push({ from: idx, to: idIndex[s.parent] });
        }
    });

    // run force-directed layout to position nodes as a graph
    try {
        forceLayout(points, interactions, Math.min(600, Math.max(120, n * 12)));
    } catch (e) {
        console.warn('forceLayout failed in overview', e);
    }

    createChart(ctx, points, interactions);
}

// initial load
loadData().then(() => {
    attachUI();
    // if there is at least one node, render the first one by default (or keep empty)
    if(ALL_NODES && ALL_NODES.length>0) {
        // render first node and its relations by default
        renderForNode(ALL_NODES[0]);
    }
});

