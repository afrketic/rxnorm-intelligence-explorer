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
