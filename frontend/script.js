const API_BASE_URL = "https://rxnorm-intelligence-explorer.onrender.com";

const input = document.getElementById("drugInput");
const button = document.getElementById("searchButton");
const statusMessage = document.getElementById("statusMessage");
const results = document.getElementById("results");
const suggestionBox = document.getElementById("suggestionBox");

let activeNetwork = null;
let activeNodes = null;
let activeEdges = null;
let fullGraphData = { nodes: [], edges: [] };
let currentPayload = null;
let currentScoreBreakdowns = {};
let activeIntelligenceView = null;
let suggestionTimer = null;
let suggestionAbortController = null;

const GROUP_STYLES = {
  searched_drug: { background: "#2563eb", border: "#bfdbfe", font: "#f8fafc", size: 38 },
  drug: { background: "#60a5fa", border: "#dbeafe", font: "#07111f", size: 30 },
  rxcui: { background: "#38bdf8", border: "#e0f2fe", font: "#07111f", size: 30 },
  rxnorm: { background: "#8b5cf6", border: "#ede9fe", font: "#f8fafc", size: 30 },
  atc: { background: "#fb923c", border: "#fed7aa", font: "#07111f", size: 30 },
  ndc: { background: "#22c55e", border: "#bbf7d0", font: "#07111f", size: 30 },
  analytics: { background: "#facc15", border: "#fef08a", font: "#07111f", size: 30 }
};

const VIEW_CONFIG = {
  interoperability: {
    title: "Interoperability Summary",
    focusGroups: ["rxnorm", "rxcui", "atc", "ndc"],
    dimGroups: ["analytics"],
    description: "Shows how well this medication is connected across healthcare data standards. This view emphasizes RxNorm, RxCUI, ATC, and NDC terminology relationships while de-emphasizing analytics so the interoperability pathway is easier to understand."
  },
  clinical: {
    title: "Clinical Intelligence Summary",
    focusGroups: ["drug", "rxnorm", "atc", "rxcui"],
    dimGroups: ["ndc", "analytics"],
    description: "Shows what this medication is clinically. This view emphasizes ingredients, clinical drugs, branded drugs, dose forms, RxNorm relationships, and therapeutic ATC classification."
  },
  claims: {
    title: "Claims Intelligence Summary",
    focusGroups: ["ndc", "rxcui", "drug"],
    dimGroups: ["rxnorm", "atc", "analytics"],
    description: "Shows how this medication appears in real-world pharmacy claims data. This view emphasizes NDC package identifiers, claims-level mappings, and the RxCUI anchor that connects standardized concepts to billing workflows."
  },
  aiReadiness: {
    title: "AI Readiness Summary",
    focusGroups: ["rxnorm", "atc", "ndc", "analytics"],
    dimGroups: ["drug"],
    description: "Shows whether this medication has enough standardized, connected, and claims-ready information to support analytics, machine learning, and AI-driven healthcare intelligence."
  }
};

button.addEventListener("click", () => fetchDrugIntelligence(input.value));
input.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    hideSuggestions();
    fetchDrugIntelligence(input.value);
  }
  if (event.key === "Escape") hideSuggestions();
});
input.addEventListener("input", handleSuggestionInput);
document.addEventListener("click", event => {
  if (!event.target.closest(".autocomplete-wrap")) hideSuggestions();
});

document.querySelectorAll(".example-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    input.value = btn.textContent;
    hideSuggestions();
    fetchDrugIntelligence(btn.textContent);
  });
});

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "graph" && activeNetwork) setTimeout(() => activeNetwork.fit(), 120);
  });
});

document.querySelectorAll(".layer-toggle").forEach(cb => cb.addEventListener("change", applyGraphFilters));

document.querySelectorAll(".intelligence-view-btn").forEach(btn => {
  const viewKey = btn.dataset.view;
  const icon = btn.querySelector(".view-info-icon");
  if (icon) icon.dataset.tooltip = VIEW_CONFIG[viewKey]?.description || "";
  btn.addEventListener("click", event => {
    if (event.target.classList.contains("info-icon")) return;
    setIntelligenceView(activeIntelligenceView === viewKey ? null : viewKey);
  });
});

document.getElementById("expandAtcButton")?.addEventListener("click", () => {
  document.querySelectorAll(".atc-group").forEach(group => group.classList.add("open"));
  document.querySelectorAll(".atc-toggle").forEach(toggle => toggle.textContent = "−");
});
document.getElementById("collapseAtcButton")?.addEventListener("click", () => {
  document.querySelectorAll(".atc-group").forEach(group => group.classList.remove("open"));
  document.querySelectorAll(".atc-toggle").forEach(toggle => toggle.textContent = "+");
});

function setIntelligenceView(viewKey) {
  activeIntelligenceView = viewKey;
  document.querySelectorAll(".intelligence-view-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === activeIntelligenceView);
  });
  applyGraphFilters();
  if (activeIntelligenceView) renderIntelligenceViewPanel(activeIntelligenceView);
}

async function handleSuggestionInput() {
  const query = input.value.trim();
  if (suggestionTimer) clearTimeout(suggestionTimer);
  if (suggestionAbortController) suggestionAbortController.abort();
  if (query.length < 2) {
    hideSuggestions();
    return;
  }
  suggestionTimer = setTimeout(async () => {
    try {
      suggestionAbortController = new AbortController();
      const response = await fetch(`${API_BASE_URL}/suggest/${encodeURIComponent(query)}?max_results=8`, { signal: suggestionAbortController.signal });
      if (!response.ok) throw new Error(`Suggestion API error: ${response.status}`);
      const data = await response.json();
      renderSuggestions(data.suggestions || [], query);
    } catch (error) {
      if (error.name !== "AbortError") hideSuggestions();
    }
  }, 300);
}

function renderSuggestions(suggestions, query) {
  if (!suggestionBox) return;
  if (input.value.trim() !== query) return;
  if (!suggestions.length) {
    suggestionBox.innerHTML = '<div class="suggestion-empty">No suggestions found yet. Try another spelling or keep typing.</div>';
    suggestionBox.classList.remove("hidden");
    return;
  }
  suggestionBox.innerHTML = suggestions
    .map(value => `<button type="button" class="suggestion-item" role="option" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`)
    .join("");
  suggestionBox.classList.remove("hidden");
  suggestionBox.querySelectorAll(".suggestion-item").forEach(item => {
    item.addEventListener("click", () => {
      const value = item.dataset.value || item.textContent;
      input.value = value;
      hideSuggestions();
      fetchDrugIntelligence(value);
    });
  });
}

function hideSuggestions() {
  if (suggestionTimer) clearTimeout(suggestionTimer);
  if (suggestionAbortController) suggestionAbortController.abort();
  if (suggestionBox) {
    suggestionBox.classList.add("hidden");
    suggestionBox.innerHTML = "";
  }
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

async function fetchDrugIntelligence(drugName) {
  hideSuggestions();
  const cleanDrugName = String(drugName || "").trim();
  if (!cleanDrugName) {
    statusMessage.textContent = "Please enter a medication name.";
    return;
  }
  setLoading(true);
  try {
    const [payloadResponse, graphResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/drug/${encodeURIComponent(cleanDrugName)}`),
      fetch(`${API_BASE_URL}/graph/${encodeURIComponent(cleanDrugName)}`)
    ]);
    if (!payloadResponse.ok) throw new Error(`Payload API error: ${payloadResponse.status}`);
    if (!graphResponse.ok) throw new Error(`Graph API error: ${graphResponse.status}`);
    const data = await payloadResponse.json();
    const graphData = await graphResponse.json();
    currentPayload = data;
    fullGraphData = graphData;
    activeIntelligenceView = null;
    document.querySelectorAll(".intelligence-view-btn").forEach(btn => btn.classList.remove("active"));
    renderResults(data, graphData);
    statusMessage.textContent = "Medication intelligence loaded successfully.";
  } catch (error) {
    console.error(error);
    statusMessage.textContent = "Unable to retrieve medication intelligence. Confirm FastAPI is running on Render or locally.";
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading ? "Loading..." : "Explore Drug Intelligence";
  if (isLoading) {
    statusMessage.textContent = "Loading medication intelligence...";
    results.classList.add("hidden");
  }
}

function renderResults(data, graphData) {
  results.classList.remove("hidden");
  renderIdentityCard(data);
  renderSummaryMetrics(data);
  renderKnowledgeGraph(graphData);
  renderPipeline(data);
  renderAtcExplorer(data);
  renderTherapeuticClasses(data);
  renderNdcCrosswalk(data);
  renderBriefing(data);
  renderMedicationSummaryPanel(data);
}

function renderIdentityCard(data) {
  document.getElementById("searchTerm").textContent = data.identity_card?.search_term || "—";
  document.getElementById("primaryRxcui").textContent = data.identity_card?.primary_rxcui || "—";
  document.getElementById("conceptName").textContent = data.identity_card?.concept_name || "—";
  document.getElementById("termType").textContent = `${data.identity_card?.term_type || "—"} — ${data.identity_card?.term_type_description || "Unknown"}`;
}

function renderSummaryMetrics(data) {
  document.getElementById("relatedCount").textContent = data.related_concepts?.related_concepts_count || 0;
  document.getElementById("atcCount").textContent = data.therapeutic_classes?.atc_count || 0;
  document.getElementById("ndcCount").textContent = data.ndc_crosswalk?.ndc_count || 0;
}

function getSelectedLayers() {
  return Array.from(document.querySelectorAll(".layer-toggle"))
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

function applyGraphFilters() {
  const selected = getSelectedLayers();
  const nodes = (fullGraphData.nodes || []).filter(node => node.group === "searched_drug" || selected.includes(node.group));
  const allowed = new Set(nodes.map(node => node.id));
  const edges = (fullGraphData.edges || []).filter(edge => allowed.has(edge.from) && allowed.has(edge.to));
  renderKnowledgeGraph({ nodes, edges });
}

function rgbaFromHex(hex, opacity) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${opacity})`;
}

function getNodeStyle(node) {
  const group = node.group || "drug";
  const base = GROUP_STYLES[group] || GROUP_STYLES.drug;
  const isCenter = node.group === "searched_drug" || node.id === "drug_center";
  let opacity = 1;
  if (activeIntelligenceView && !isCenter) {
    const view = VIEW_CONFIG[activeIntelligenceView];
    opacity = view?.focusGroups?.includes(group) ? 1 : 0.25;
  }
  const size = node.size || base.size || 24;
  return {
    ...node,
    size,
    originalSize: size,
    color: {
      background: rgbaFromHex(base.background, opacity),
      border: rgbaFromHex(base.border, opacity),
      highlight: { background: base.background, border: base.border },
      hover: { background: base.background, border: base.border }
    },
    font: {
      color: opacity < 0.5 ? "rgba(203,213,225,.42)" : base.font,
      size: isCenter ? 14 : (node.layout_role === "hub" ? 13 : 12),
      face: "Arial",
      bold: true,
      vadjust: 0,
      strokeWidth: isCenter ? 4 : 2,
      strokeColor: "rgba(2,6,23,.55)"
    },
    fixed: node.fixed || { x: true, y: true },
    physics: false
  };
}

function getEdgeStyle(edge, visibleNodes) {
  const fromNode = visibleNodes.get(edge.from);
  const toNode = visibleNodes.get(edge.to);
  const fromGroup = fromNode?.group;
  const toGroup = toNode?.group;
  let opacity = 0.68;
  if (activeIntelligenceView) {
    const focus = VIEW_CONFIG[activeIntelligenceView]?.focusGroups || [];
    const centerEdge = fromGroup === "searched_drug" || toGroup === "searched_drug";
    const focusedEdge = focus.includes(fromGroup) || focus.includes(toGroup);
    opacity = centerEdge || focusedEdge ? 0.78 : 0.18;
  }
  return {
    ...edge,
    label: edge.show_label ? edge.label : "",
    arrows: { to: { enabled: true, scaleFactor: 0.9 } },
    color: {
      color: `rgba(203,213,225,${opacity})`,
      highlight: "#38bdf8",
      hover: "#38bdf8"
    },
    font: { size: 0, color: "rgba(0,0,0,0)" },
    smooth: { enabled: true, type: "cubicBezier", roundness: 0.28 },
    width: edge.edge_role === "primary" ? 1.8 : 1.25,
    physics: false
  };
}

function renderKnowledgeGraph(graphData) {
  const container = document.getElementById("networkGraph");
  if (activeNetwork) {
    activeNetwork.destroy();
    activeNetwork = null;
  }

  const styledNodes = (graphData.nodes || []).map(getNodeStyle);
  const nodeMap = new Map(styledNodes.map(node => [node.id, node]));
  const styledEdges = (graphData.edges || []).map(edge => getEdgeStyle(edge, nodeMap));

  activeNodes = new vis.DataSet(styledNodes);
  activeEdges = new vis.DataSet(styledEdges);

  activeNetwork = new vis.Network(container, { nodes: activeNodes, edges: activeEdges }, {
    interaction: { hover: true, tooltipDelay: 120, navigationButtons: true, keyboard: true },
    physics: { enabled: false },
    layout: { improvedLayout: false },
    nodes: {
      shape: "dot",
      borderWidth: 3,
      chosen: false,
      shadow: { enabled: true, color: "rgba(0,0,0,.45)", size: 12, x: 0, y: 4 }
    },
    edges: { selectionWidth: 2, chosen: false }
  });

  activeNetwork.on("hoverNode", params => {
    const node = activeNodes.get(params.node);
    if (node) activeNodes.update({ id: node.id, size: Math.round((node.originalSize || node.size || 18) * 1.08) });
  });
  activeNetwork.on("blurNode", params => {
    const node = activeNodes.get(params.node);
    if (node) activeNodes.update({ id: node.id, size: node.originalSize || node.size || 18 });
  });
  activeNetwork.on("click", params => {
    if (params.nodes.length) {
      const id = params.nodes[0];
      const node = (graphData.nodes || []).find(item => item.id === id) || activeNodes.get(id);
      renderNodeInspector(node);
    } else {
      renderMedicationSummaryPanel(currentPayload);
    }
  });

  setTimeout(() => activeNetwork && activeNetwork.fit({ animation: { duration: 250, easingFunction: "easeInOutQuad" } }), 100);
}

function calculateMedicationScores(data) {
  const related = data?.related_concepts?.related_concepts_count || 0;
  const atc = data?.therapeutic_classes?.atc_count || 0;
  const ndc = data?.ndc_crosswalk?.ndc_count || 0;

  const rxnormCoverage = related > 0 ? 25 : 0;
  const atcCoverage = Math.min(20, Math.round((atc / 10) * 20));
  const ndcConnectivity = Math.min(25, Math.round((ndc / 1600) * 25));
  const relationshipDensity = Math.min(30, Math.round(((related + atc) / 90) * 30));
  const aiReadiness = Math.min(100, rxnormCoverage + atcCoverage + ndcConnectivity + relationshipDensity);

  const semanticConceptBreadth = Math.min(35, Math.round((related / 80) * 35));
  const therapeuticDepth = Math.min(30, Math.round((atc / 40) * 30));
  const graphConnectivity = Math.min(35, Math.round(((related + atc) / 120) * 35));
  const semanticRichness = Math.min(100, semanticConceptBreadth + therapeuticDepth + graphConnectivity);

  const ndcMappingCoverage = Math.min(70, Math.round((ndc / 1600) * 70));
  const claimsIdentifierDepth = ndc > 0 ? 20 : 0;
  const workflowUsability = ndc > 0 ? 10 : 0;
  const claimsReadiness = Math.min(100, ndcMappingCoverage + claimsIdentifierDepth + workflowUsability);

  const interoperability = Math.min(100, Math.round(
    (Math.min(100, related * 2) * 0.30) +
    (Math.min(100, atc * 12) * 0.25) +
    (Math.min(100, ndc / 8) * 0.25) +
    (semanticRichness * 0.20)
  ));

  const clinicalIntelligence = Math.min(100, Math.round(
    (Math.min(100, atc * 15) * 0.45) +
    (Math.min(100, related * 2) * 0.35) +
    (semanticRichness * 0.20)
  ));

  return {
    related,
    atc,
    ndc,
    aiReadiness,
    semanticRichness,
    claimsReadiness,
    interoperability,
    clinicalIntelligence,
    components: { rxnormCoverage, atcCoverage, ndcConnectivity, relationshipDensity, semanticConceptBreadth, therapeuticDepth, graphConnectivity, ndcMappingCoverage, claimsIdentifierDepth, workflowUsability }
  };
}

function scoreMeaning(score, type = "interoperability") {
  if (score >= 90) {
    if (type === "claims") return "Excellent - This medication has strong package-level identifier coverage and is highly ready for claims analytics.";
    if (type === "clinical") return "Excellent - This medication has rich clinical and therapeutic context for interpretation and reporting.";
    if (type === "ai") return "Excellent - This medication is highly ready for AI, predictive modeling, and enterprise analytics workflows.";
    return "Excellent - This medication is extremely well represented across healthcare terminology systems and is highly interoperable.";
  }
  if (score >= 70) return "Strong - This medication has solid structured data coverage with some areas that may benefit from deeper enrichment.";
  if (score >= 40) return "Moderate - This medication has useful structured data, but some interoperability or analytics layers may be limited.";
  return "Limited - This medication has sparse structured coverage and may require additional normalization before advanced analytics use.";
}

function getIngredient(data) {
  const identity = data?.identity_card || {};
  if ((identity.term_type_description || "").toLowerCase().includes("ingredient")) return identity.concept_name || identity.search_term || "—";
  const related = data?.related_concepts?.related_concepts || [];
  const ingredient = related.find(item => (item.term_type_description || "").toLowerCase().includes("ingredient"));
  return ingredient?.name || identity.concept_name || identity.search_term || "—";
}

function getTherapeuticCategory(data) {
  const atc = data?.therapeutic_classes?.atc_hierarchy || [];
  return atc[0]?.full_class_name || "Not available from current ATC lookup";
}

function renderDetailRows(rows) {
  return `<div class="node-details-rows">${rows.map(([label, value]) => `
    <div class="node-detail-row"><strong>${escapeHtml(label)}</strong><p>${escapeHtml(value || "—")}</p></div>
  `).join("")}</div>`;
}

function renderMedicationSummaryPanel(data) {
  const el = document.getElementById("nodeInspectorContent");
  if (!el || !data) {
    if (el) el.innerHTML = '<p class="muted">Click a graph node to inspect its semantic layer, source, and interoperability context.</p>';
    return;
  }
  const identity = data.identity_card || {};
  const scores = calculateMedicationScores(data);
  const concept = identity.concept_name || identity.search_term || "Medication";
  el.innerHTML = `
    <div class="node-details-card">
      <h3>${escapeHtml(concept)}</h3>
      <span class="node-layer-pill">Drug (Searched)</span>
      ${renderDetailRows([
        ["Type", identity.term_type_description || identity.term_type || "Drug (Searched)"],
        ["RxCUI", identity.primary_rxcui || "—"],
        ["Source", "RxNorm / RxNav"],
        ["Medication Intelligence Summary", "AI-powered medication profile generated from RxNorm, ATC, NDC, and analytics coverage."],
        ["Ingredient", getIngredient(data)],
        ["Therapeutic Category", getTherapeuticCategory(data)],
        ["RxNorm Relationships", String(scores.related)],
        ["ATC Classifications", String(scores.atc)],
        ["NDC Package Identifiers", String(scores.ndc)],
        ["Interoperability Score", `${scores.interoperability} - ${scoreMeaning(scores.interoperability, "interoperability")}`],
        ["Clinical Intelligence Score", `${scores.clinicalIntelligence} - ${scoreMeaning(scores.clinicalIntelligence, "clinical")}`],
        ["Claims Readiness", scoreMeaning(scores.claimsReadiness, "claims")],
        ["Claims Readiness Score", String(scores.claimsReadiness)],
        ["AI Readiness", scoreMeaning(scores.aiReadiness, "ai")],
        ["AI Readiness Score", String(scores.aiReadiness)],
        ["Semantic Richness", String(scores.semanticRichness)]
      ])}
    </div>`;
}

function renderIntelligenceViewPanel(viewKey) {
  const el = document.getElementById("nodeInspectorContent");
  if (!el || !currentPayload) return;
  const scores = calculateMedicationScores(currentPayload);
  const identity = currentPayload.identity_card || {};
  const view = VIEW_CONFIG[viewKey];
  const rowsByView = {
    interoperability: [
      ["Ingredient", getIngredient(currentPayload)],
      ["Primary RxCUI", identity.primary_rxcui || "—"],
      ["RxNorm Relationships", String(scores.related)],
      ["ATC Classifications", String(scores.atc)],
      ["NDC Package Identifiers", String(scores.ndc)],
      ["Terminology Coverage", scores.interoperability >= 90 ? "Excellent" : scores.interoperability >= 70 ? "Strong" : scores.interoperability >= 40 ? "Moderate" : "Limited"],
      ["Interoperability Score & Meaning", `${scores.interoperability} - ${scoreMeaning(scores.interoperability, "interoperability")}`]
    ],
    clinical: [
      ["Ingredient", getIngredient(currentPayload)],
      ["Therapeutic Category", getTherapeuticCategory(currentPayload)],
      ["RxNorm Relationships", String(scores.related)],
      ["ATC Classifications", String(scores.atc)],
      ["Clinical Intelligence Score", `${scores.clinicalIntelligence} - ${scoreMeaning(scores.clinicalIntelligence, "clinical")}`]
    ],
    claims: [
      ["Primary RxCUI", identity.primary_rxcui || "—"],
      ["NDC Package Identifiers", String(scores.ndc)],
      ["Claims Readiness", scoreMeaning(scores.claimsReadiness, "claims")],
      ["Claims Readiness Score", String(scores.claimsReadiness)]
    ],
    aiReadiness: [
      ["RxNorm Relationships", String(scores.related)],
      ["ATC Classifications", String(scores.atc)],
      ["NDC Package Identifiers", String(scores.ndc)],
      ["Semantic Richness", String(scores.semanticRichness)],
      ["AI Readiness", scoreMeaning(scores.aiReadiness, "ai")],
      ["AI Readiness Score", String(scores.aiReadiness)]
    ]
  };
  el.innerHTML = `
    <div class="node-details-card">
      <h3>${escapeHtml(view.title)}</h3>
      <span class="node-layer-pill">Intelligence View</span>
      ${renderDetailRows(rowsByView[viewKey] || [])}
    </div>`;
}

function renderNodeInspector(node) {
  const el = document.getElementById("nodeInspectorContent");
  if (!node) {
    renderMedicationSummaryPanel(currentPayload);
    return;
  }
  if (node.group === "searched_drug" || node.id === "drug_center") {
    renderMedicationSummaryPanel(currentPayload);
    return;
  }
  const displayName = node.hover_label || node.label || node.title || "Medication node";
  const rows = [
    ["Type", node.node_type || node.group || "Medication Node"],
    ["RxCUI", node.rxcui || "—"],
    ["Source", node.source || "RxNorm Intelligence Explorer"],
    ["Description", node.description || node.title || "Medication intelligence node."],
    ["Additional Context", node.additional_context || node.title || "—"]
  ];
  el.innerHTML = `
    <div class="node-details-card">
      <h3>${escapeHtml(displayName)}</h3>
      <span class="node-layer-pill">${escapeHtml(node.group || "Node")}</span>
      ${renderDetailRows(rows)}
    </div>`;
}

function renderPipeline(data) {
  const container = document.getElementById("pipelineNodes");
  container.innerHTML = "";
  const searchTerm = data.search?.search_term || "Medication";
  const rxcui = data.search?.primary_rxcui || "N/A";
  const concept = data.identity_card?.concept_name || "N/A";
  const atcCount = data.therapeutic_classes?.atc_count || 0;
  const ndcCount = data.ndc_crosswalk?.ndc_count || 0;
  const firstAtc = data.therapeutic_classes?.atc_hierarchy?.[0];
  const firstAtcValue = firstAtc ? `${firstAtc.full_class_id} — ${firstAtc.full_class_name}` : "No ATC class returned";
  const nodes = [
    { title: "Drug Search", value: searchTerm, description: "User-entered medication name captured by the application.", tag: "Input Layer" },
    { title: "RxCUI Resolution", value: rxcui, description: "RxNorm standardizes the medication into a durable concept identifier.", tag: "Identity Layer" },
    { title: "RxNorm Concept", value: concept, description: "Medication identity is enriched with term type, concept name, and vocabulary context.", tag: "Semantic Layer" },
    { title: "RxClass / ATC", value: firstAtcValue, description: `${atcCount} therapeutic class records connect this medication to clinical intelligence.`, tag: "Therapeutic Layer" },
    { title: "NDC Crosswalk", value: `${ndcCount} records`, description: "NDC mappings connect RxNorm concepts to pharmacy claims data.", tag: "Claims Layer" },
    { title: "Analytics Intelligence", value: "AI-ready", description: "Normalized medication data can support trend analysis, forecasting, dashboards, and ML features.", tag: "Intelligence Layer" }
  ];
  nodes.forEach((node, index) => {
    const div = document.createElement("div");
    div.className = "pipeline-node";
    div.innerHTML = `<div class="node-index">${index + 1}</div><h3>${escapeHtml(node.title)}</h3><div class="pipeline-value">${escapeHtml(node.value)}</div><p>${escapeHtml(node.description)}</p><span class="pipeline-tag">${escapeHtml(node.tag)}</span>`;
    container.appendChild(div);
  });
}

function renderAtcExplorer(data) {
  const atcItems = data.therapeutic_classes?.atc_hierarchy || [];
  const tree = document.getElementById("atcTree");
  tree.innerHTML = "";
  const uniqueMap = new Map();
  atcItems.forEach(item => {
    const key = item.full_class_id || item.atc_full_code || "UNKNOWN";
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, { full_class_id: item.full_class_id || key, full_class_name: item.full_class_name || "Unnamed therapeutic class", atc_level_1_code: item.atc_level_1_code || "", atc_level_2_code: item.atc_level_2_code || "", atc_level_3_code: item.atc_level_3_code || "", atc_level_4_code: item.atc_level_4_code || "", records: [] });
    }
    uniqueMap.get(key).records.push(item);
  });
  const uniqueItems = Array.from(uniqueMap.values());
  document.getElementById("atcUniqueCount").textContent = uniqueItems.length || 0;
  document.getElementById("atcPrimaryCode").textContent = uniqueItems[0]?.full_class_id || "—";
  if (uniqueItems.length === 0) {
    document.getElementById("atcReadout").textContent = "No ATC hierarchy records were returned for this medication.";
    tree.innerHTML = '<div class="list-item">No ATC hierarchy records returned.</div>';
    return;
  }
  document.getElementById("atcReadout").textContent = `${data.identity_card?.concept_name || "This medication"} maps to ${uniqueItems.length} unique ATC therapeutic class signals. These classes help translate medication identity into clinical categories for reporting, formulary analytics, and predictive modeling.`;
  uniqueItems.slice(0, 12).forEach((item, index) => {
    const group = document.createElement("div");
    group.className = `atc-group ${index === 0 ? "open" : ""}`;
    const recordPills = item.records.slice(0, 5).map(record => `<div class="atc-record-pill">Relationship Source: ${escapeHtml(record.rela_source || "RxClass")} | Drug Name: ${escapeHtml(record.drug_name || "N/A")} | RxCUI: ${escapeHtml(record.rxcui || "N/A")}</div>`).join("");
    group.innerHTML = `<button class="atc-group-header"><div class="atc-header-left"><span class="atc-toggle">${index === 0 ? "−" : "+"}</span><div><strong>${escapeHtml(item.full_class_name)}</strong><div class="list-meta">ATC Code: ${escapeHtml(item.full_class_id)}</div></div></div><span class="atc-code-badge">${item.records.length} record${item.records.length === 1 ? "" : "s"}</span></button><div class="atc-group-body"><div class="atc-level-grid"><div class="atc-level-card"><span>Level 1</span><strong>${escapeHtml(item.atc_level_1_code || "N/A")}</strong></div><div class="atc-level-card"><span>Level 2</span><strong>${escapeHtml(item.atc_level_2_code || "N/A")}</strong></div><div class="atc-level-card"><span>Level 3</span><strong>${escapeHtml(item.atc_level_3_code || "N/A")}</strong></div><div class="atc-level-card"><span>Level 4</span><strong>${escapeHtml(item.atc_level_4_code || "N/A")}</strong></div></div><div class="atc-record-list">${recordPills}${item.records.length > 5 ? `<div class="atc-record-pill">...and ${item.records.length - 5} more supporting records.</div>` : ""}</div></div>`;
    const header = group.querySelector(".atc-group-header");
    const toggle = group.querySelector(".atc-toggle");
    header.addEventListener("click", () => {
      group.classList.toggle("open");
      toggle.textContent = group.classList.contains("open") ? "−" : "+";
    });
    tree.appendChild(group);
  });
}

function renderTherapeuticClasses(data) {
  const container = document.getElementById("atcList");
  container.innerHTML = "";
  const atcItems = data.therapeutic_classes?.atc_hierarchy || [];
  if (atcItems.length === 0) {
    container.innerHTML = '<div class="list-item">No ATC hierarchy records returned.</div>';
    return;
  }
  atcItems.slice(0, 20).forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `<strong>${index + 1}. ${escapeHtml(item.full_class_id || "N/A")} — ${escapeHtml(item.full_class_name || "Unnamed Class")}</strong><div class="list-meta">Level 1: ${escapeHtml(item.atc_level_1_code || "N/A")} | Level 2: ${escapeHtml(item.atc_level_2_code || "N/A")} | Level 3: ${escapeHtml(item.atc_level_3_code || "N/A")} | Level 4: ${escapeHtml(item.atc_level_4_code || "N/A")}</div><div class="list-meta">Source: ${escapeHtml(item.rela_source || "RxClass")}</div>`;
    container.appendChild(div);
  });
}

function renderNdcCrosswalk(data) {
  const container = document.getElementById("ndcList");
  container.innerHTML = "";
  const ndcItems = data.ndc_crosswalk?.ndc_records || [];
  if (ndcItems.length === 0) {
    container.innerHTML = '<div class="list-item">No NDC records returned.</div>';
    return;
  }
  ndcItems.slice(0, 60).forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `<strong>${index + 1}. NDC11: ${escapeHtml(item.ndc11 || "N/A")}</strong><div class="list-meta">NDC10: ${escapeHtml(item.ndc10 || "N/A")} | NDC9: ${escapeHtml(item.ndc9 || "N/A")} | Clinical RxCUI: ${escapeHtml(item.clinical_drug_rxcui || item.rxcui || "N/A")}</div><div class="list-meta">Source: ${escapeHtml(item.source || "RxNorm Related NDC")}</div>`;
    container.appendChild(div);
  });
}

function renderBriefing(data) {
  const concept = data.identity_card?.concept_name || "This medication";
  const rxcui = data.identity_card?.primary_rxcui || "N/A";
  const scores = calculateMedicationScores(data);
  document.getElementById("briefingTitle").textContent = `${concept} Intelligence Briefing`;
  document.getElementById("executiveSummary").textContent = `${concept} resolves to RxCUI ${rxcui}, creating a standardized medication identity that can be recognized consistently across healthcare systems.`;
  document.getElementById("interopNarrative").textContent = `The current lookup returned ${scores.related} related RxNorm concepts and ${scores.atc} therapeutic class records, showing how one medication can be translated into normalized semantic and clinical categories.`;
  document.getElementById("clinicalCommentary").textContent = `The ATC hierarchy provides clinical grouping logic that supports formulary management, therapeutic trend analysis, and medication class reporting.`;
  document.getElementById("analyticsImplications").textContent = `The ${scores.ndc} NDC mappings connect this medication identity to pharmacy claims workflows, enabling downstream dashboards, predictive modeling features, and AI-ready claims intelligence.`;
  document.getElementById("aiReadinessScore").textContent = scores.aiReadiness;
  document.getElementById("semanticRichnessScore").textContent = scores.semanticRichness;
  document.getElementById("claimsReadinessScore").textContent = scores.claimsReadiness;
  const c = scores.components;
  currentScoreBreakdowns = {
    aiReadiness: { title: `AI Readiness Score: ${scores.aiReadiness}`, description: "Measures how effectively a medication concept can support AI, analytics, and interoperability workflows.", rows: [["RxNorm Coverage", c.rxnormCoverage, 25], ["ATC Coverage", c.atcCoverage, 20], ["NDC Connectivity", c.ndcConnectivity, 25], ["Relationship Density", c.relationshipDensity, 30]] },
    semanticRichness: { title: `Semantic Richness: ${scores.semanticRichness}`, description: "Quantifies the amount of semantic information available for a medication concept.", rows: [["RxNorm Concept Breadth", c.semanticConceptBreadth, 35], ["Therapeutic Classification Depth", c.therapeuticDepth, 30], ["Knowledge Graph Connectivity", c.graphConnectivity, 35]] },
    claimsReadiness: { title: `Claims Readiness: ${scores.claimsReadiness}`, description: "Measures how completely a medication can be connected to pharmacy claims data through NDC mappings.", rows: [["NDC Mapping Coverage", c.ndcMappingCoverage, 70], ["Claims Identifier Depth", c.claimsIdentifierDepth, 20], ["Workflow Usability", c.workflowUsability, 10]] }
  };
  attachScoreTooltips();
}

function attachScoreTooltips() {
  const definitions = {
    aiReadiness: "Measures how effectively a medication concept can support AI, analytics, and interoperability workflows. Higher scores indicate stronger readiness for machine learning and enterprise data integration.",
    semanticRichness: "Quantifies the amount of semantic information available for a medication concept. Richer semantic networks improve explainability and downstream analytics.",
    claimsReadiness: "Measures how completely a medication can be connected to pharmacy claims data through NDC mappings."
  };
  document.querySelectorAll(".score-card").forEach(card => {
    const key = card.dataset.scoreKey;
    const icon = card.querySelector(".info-icon");
    if (icon) icon.dataset.tooltip = definitions[key] || "";
    card.onclick = () => openScoreModal(key);
  });
}

function openScoreModal(key) {
  const modal = document.getElementById("scoreModal");
  const score = currentScoreBreakdowns[key];
  if (!modal || !score) return;
  document.getElementById("scoreModalTitle").textContent = score.title;
  document.getElementById("scoreModalDescription").textContent = score.description;
  document.getElementById("scoreBreakdownRows").innerHTML = score.rows.map(([label, value, max]) => `<div class="score-breakdown-row"><span>${escapeHtml(label)}</span><strong>${value} / ${max}</strong></div>`).join("");
  modal.classList.remove("hidden");
}

function closeScoreModal() {
  const modal = document.getElementById("scoreModal");
  if (modal) modal.classList.add("hidden");
}

document.getElementById("scoreModalClose")?.addEventListener("click", closeScoreModal);
document.getElementById("scoreModal")?.addEventListener("click", event => { if (event.target.id === "scoreModal") closeScoreModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeScoreModal(); });
