const API_BASE_URL = "http://127.0.0.1:8000";

const input = document.getElementById("drugInput");
const button = document.getElementById("searchButton");
const statusMessage = document.getElementById("statusMessage");
const results = document.getElementById("results");

button.addEventListener("click", () => {
  fetchDrugIntelligence(input.value);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    fetchDrugIntelligence(input.value);
  }
});

document.querySelectorAll(".example-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    input.value = btn.textContent;
    fetchDrugIntelligence(btn.textContent);
  });
});

document.getElementById("expandAtcButton").addEventListener("click", () => {
  document.querySelectorAll(".atc-group").forEach((group) => group.classList.add("open"));
  document.querySelectorAll(".atc-toggle").forEach((toggle) => toggle.textContent = "−");
});

document.getElementById("collapseAtcButton").addEventListener("click", () => {
  document.querySelectorAll(".atc-group").forEach((group) => group.classList.remove("open"));
  document.querySelectorAll(".atc-toggle").forEach((toggle) => toggle.textContent = "+");
});

async function fetchDrugIntelligence(drugName) {
  const cleanDrugName = drugName.trim();

  if (!cleanDrugName) {
    statusMessage.textContent = "Please enter a medication name.";
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/drug/${encodeURIComponent(cleanDrugName)}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    renderResults(data);
    statusMessage.textContent = "Medication intelligence loaded successfully.";
  } catch (error) {
    console.error(error);
    statusMessage.textContent = "Unable to retrieve medication intelligence. Confirm FastAPI is running on port 8000.";
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.textContent = "Loading...";
    statusMessage.textContent = "Loading medication intelligence...";
    results.classList.add("hidden");
  } else {
    button.disabled = false;
    button.textContent = "Explore Drug Intelligence";
  }
}

function renderResults(data) {
  results.classList.remove("hidden");

  renderIdentityCard(data);
  renderSummaryMetrics(data);
  renderPipeline(data);
  renderAtcExplorer(data);
  renderInteroperabilityFlow(data);
  renderTherapeuticClasses(data);
  renderNdcCrosswalk(data);
}

function renderIdentityCard(data) {
  document.getElementById("searchTerm").textContent = data.identity_card?.search_term || "—";
  document.getElementById("primaryRxcui").textContent = data.identity_card?.primary_rxcui || "—";
  document.getElementById("conceptName").textContent = data.identity_card?.concept_name || "—";
  document.getElementById("termType").textContent =
    `${data.identity_card?.term_type || "—"} — ${data.identity_card?.term_type_description || "Unknown"}`;
}

function renderSummaryMetrics(data) {
  document.getElementById("relatedCount").textContent = data.related_concepts?.related_concepts_count || 0;
  document.getElementById("atcCount").textContent = data.therapeutic_classes?.atc_count || 0;
  document.getElementById("ndcCount").textContent = data.ndc_crosswalk?.ndc_count || 0;
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
  const firstAtcValue = firstAtc
    ? `${firstAtc.full_class_id} — ${firstAtc.full_class_name}`
    : "No ATC class returned";

  const nodes = [
    {
      title: "Drug Search",
      value: searchTerm,
      description: "User-entered medication name captured by the application.",
      tag: "Input Layer"
    },
    {
      title: "RxCUI Resolution",
      value: rxcui,
      description: "RxNorm standardizes the medication into a durable concept identifier.",
      tag: "Identity Layer"
    },
    {
      title: "RxNorm Concept",
      value: concept,
      description: "Medication identity is enriched with term type, concept name, and vocabulary context.",
      tag: "Semantic Layer"
    },
    {
      title: "RxClass / ATC",
      value: firstAtcValue,
      description: `${atcCount} therapeutic class records connect this medication to clinical intelligence.`,
      tag: "Therapeutic Layer"
    },
    {
      title: "NDC Crosswalk",
      value: `${ndcCount} records`,
      description: "NDC9, NDC10, and NDC11 mappings connect RxNorm concepts to pharmacy claims data.",
      tag: "Claims Layer"
    },
    {
      title: "Analytics Intelligence",
      value: "AI-ready",
      description: "Normalized medication data can support trend analysis, forecasting, dashboards, and ML features.",
      tag: "Intelligence Layer"
    }
  ];

  nodes.forEach((node, index) => {
    const div = document.createElement("div");
    div.className = "pipeline-node";
    div.innerHTML = `
      <div class="node-index">${index + 1}</div>
      <h3>${node.title}</h3>
      <div class="pipeline-value">${node.value}</div>
      <p>${node.description}</p>
      <span class="pipeline-tag">${node.tag}</span>
    `;
    container.appendChild(div);
  });
}

function renderAtcExplorer(data) {
  const atcItems = data.therapeutic_classes?.atc_hierarchy || [];
  const tree = document.getElementById("atcTree");

  tree.innerHTML = "";

  const uniqueMap = new Map();

  atcItems.forEach((item) => {
    const key = item.full_class_id || item.atc_full_code || "UNKNOWN";

    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        full_class_id: item.full_class_id || key,
        full_class_name: item.full_class_name || "Unnamed therapeutic class",
        atc_level_1_code: item.atc_level_1_code || "",
        atc_level_2_code: item.atc_level_2_code || "",
        atc_level_3_code: item.atc_level_3_code || "",
        atc_level_4_code: item.atc_level_4_code || "",
        records: []
      });
    }

    uniqueMap.get(key).records.push(item);
  });

  const uniqueItems = Array.from(uniqueMap.values());

  document.getElementById("atcUniqueCount").textContent = uniqueItems.length || 0;
  document.getElementById("atcPrimaryCode").textContent = uniqueItems[0]?.full_class_id || "—";

  if (uniqueItems.length === 0) {
    document.getElementById("atcReadout").textContent =
      "No ATC hierarchy records were returned for this medication.";
    tree.innerHTML = `<div class="list-item">No ATC hierarchy records returned.</div>`;
    return;
  }

  document.getElementById("atcReadout").textContent =
    `${data.identity_card?.concept_name || "This medication"} maps to ${uniqueItems.length} unique ATC therapeutic class signals. These classes help translate medication identity into clinical categories for reporting, formulary analytics, and predictive modeling.`;

  uniqueItems.slice(0, 12).forEach((item, index) => {
    const group = document.createElement("div");
    group.className = `atc-group ${index === 0 ? "open" : ""}`;

    const recordPills = item.records.slice(0, 5).map((record) => {
      return `
        <div class="atc-record-pill">
          Relationship Source: ${record.rela_source || "RxClass"} |
          Drug Name: ${record.drug_name || "N/A"} |
          RxCUI: ${record.rxcui || "N/A"}
        </div>
      `;
    }).join("");

    group.innerHTML = `
      <button class="atc-group-header">
        <div class="atc-header-left">
          <span class="atc-toggle">${index === 0 ? "−" : "+"}</span>
          <div>
            <strong>${item.full_class_name}</strong>
            <div class="list-meta">ATC Code: ${item.full_class_id}</div>
          </div>
        </div>
        <span class="atc-code-badge">${item.records.length} record${item.records.length === 1 ? "" : "s"}</span>
      </button>

      <div class="atc-group-body">
        <div class="atc-level-grid">
          <div class="atc-level-card">
            <span>Level 1</span>
            <strong>${item.atc_level_1_code || "N/A"}</strong>
          </div>
          <div class="atc-level-card">
            <span>Level 2</span>
            <strong>${item.atc_level_2_code || "N/A"}</strong>
          </div>
          <div class="atc-level-card">
            <span>Level 3</span>
            <strong>${item.atc_level_3_code || "N/A"}</strong>
          </div>
          <div class="atc-level-card">
            <span>Level 4</span>
            <strong>${item.atc_level_4_code || "N/A"}</strong>
          </div>
        </div>

        <div class="atc-record-list">
          ${recordPills}
          ${item.records.length > 5 ? `<div class="atc-record-pill">...and ${item.records.length - 5} more supporting records.</div>` : ""}
        </div>
      </div>
    `;

    const header = group.querySelector(".atc-group-header");
    const toggle = group.querySelector(".atc-toggle");

    header.addEventListener("click", () => {
      group.classList.toggle("open");
      toggle.textContent = group.classList.contains("open") ? "−" : "+";
    });

    tree.appendChild(group);
  });
}

function renderInteroperabilityFlow(data) {
  const container = document.getElementById("flowNodes");
  container.innerHTML = "";

  const nodes = data.interoperability_graph?.interoperability_flow?.nodes || [];

  nodes.forEach((node) => {
    const div = document.createElement("div");
    div.className = "flow-node";
    div.innerHTML = `
      <strong>${node.step}. ${node.title}</strong>
      <p>${node.value || "N/A"}</p>
      <small>${node.description || ""}</small>
    `;
    container.appendChild(div);
  });
}

function renderTherapeuticClasses(data) {
  const container = document.getElementById("atcList");
  container.innerHTML = "";

  const atcItems = data.therapeutic_classes?.atc_hierarchy || [];

  if (atcItems.length === 0) {
    container.innerHTML = `<div class="list-item">No ATC hierarchy records returned.</div>`;
    return;
  }

  atcItems.slice(0, 20).forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <strong>${index + 1}. ${item.full_class_id || "N/A"} — ${item.full_class_name || "Unnamed Class"}</strong>
      <div class="list-meta">
        Level 1: ${item.atc_level_1_code || "N/A"} |
        Level 2: ${item.atc_level_2_code || "N/A"} |
        Level 3: ${item.atc_level_3_code || "N/A"} |
        Level 4: ${item.atc_level_4_code || "N/A"}
      </div>
      <div class="list-meta">Source: ${item.rela_source || "RxClass"}</div>
    `;
    container.appendChild(div);
  });
}

function renderNdcCrosswalk(data) {
  const container = document.getElementById("ndcList");
  container.innerHTML = "";

  const ndcItems = data.ndc_crosswalk?.ndc_records || [];

  if (ndcItems.length === 0) {
    container.innerHTML = `<div class="list-item">No NDC records returned.</div>`;
    return;
  }

  ndcItems.slice(0, 30).forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <strong>${index + 1}. NDC11: ${item.ndc11 || "N/A"}</strong>
      <div class="list-meta">
        NDC10: ${item.ndc10 || "N/A"} |
        NDC9: ${item.ndc9 || "N/A"} |
        Clinical RxCUI: ${item.clinical_drug_rxcui || item.rxcui || "N/A"}
      </div>
      <div class="list-meta">Source: ${item.source || "RxNorm Related NDC"}</div>
    `;
    container.appendChild(div);
  });
}
