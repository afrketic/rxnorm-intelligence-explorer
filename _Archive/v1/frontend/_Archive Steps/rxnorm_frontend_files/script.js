const API_BASE_URL = "http://127.0.0.1:8000";

const input = document.getElementById("drugInput");
const button = document.getElementById("searchButton");
const statusMessage = document.getElementById("statusMessage");
const results = document.getElementById("results");

button.addEventListener("click", () => {
  searchDrug(input.value);
});

document.querySelectorAll(".example-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    input.value = btn.textContent;
    searchDrug(btn.textContent);
  });
});

async function searchDrug(drugName) {
  const cleanDrugName = drugName.trim();

  if (!cleanDrugName) {
    statusMessage.textContent = "Please enter a medication name.";
    return;
  }

  statusMessage.textContent = "Loading medication intelligence...";
  results.classList.add("hidden");

  try {
    const response = await fetch(`${API_BASE_URL}/drug/${encodeURIComponent(cleanDrugName)}`);
    const data = await response.json();

    renderResults(data);
    statusMessage.textContent = "Medication intelligence loaded.";
  } catch (error) {
    console.error(error);
    statusMessage.textContent = "Unable to retrieve medication intelligence.";
  }
}

function renderResults(data) {
  results.classList.remove("hidden");

  document.getElementById("searchTerm").textContent = data.search?.search_term || "";
  document.getElementById("primaryRxcui").textContent = data.search?.primary_rxcui || "";
  document.getElementById("conceptName").textContent = data.identity_card?.concept_name || "";
  document.getElementById("termType").textContent =
    `${data.identity_card?.term_type || ""} — ${data.identity_card?.term_type_description || ""}`;

  document.getElementById("relatedCount").textContent =
    data.related_concepts?.related_concepts_count || 0;

  document.getElementById("atcCount").textContent =
    data.therapeutic_classes?.atc_count || 0;

  document.getElementById("ndcCount").textContent =
    data.ndc_crosswalk?.ndc_count || 0;

  renderFlow(data);
  renderATC(data);
  renderNDC(data);
}

function renderFlow(data) {
  const container = document.getElementById("flowNodes");
  container.innerHTML = "";

  const nodes = data.interoperability_graph?.interoperability_flow?.nodes || [];

  nodes.forEach((node) => {
    const div = document.createElement("div");
    div.className = "flow-node";
    div.innerHTML = `
      <strong>${node.step}. ${node.title}</strong>
      <p>${node.value}</p>
      <small>${node.description}</small>
    `;
    container.appendChild(div);
  });
}

function renderATC(data) {
  const container = document.getElementById("atcList");
  container.innerHTML = "";

  const atcItems = data.therapeutic_classes?.atc_hierarchy || [];

  atcItems.slice(0, 10).forEach((item) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <strong>${item.full_class_id}</strong> — ${item.full_class_name}<br/>
      Level 1: ${item.atc_level_1_code} |
      Level 2: ${item.atc_level_2_code} |
      Level 3: ${item.atc_level_3_code} |
      Level 4: ${item.atc_level_4_code}
    `;
    container.appendChild(div);
  });
}

function renderNDC(data) {
  const container = document.getElementById("ndcList");
  container.innerHTML = "";

  const ndcItems = data.ndc_crosswalk?.ndc_records || [];

  ndcItems.slice(0, 15).forEach((item) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <strong>NDC11:</strong> ${item.ndc11}
      | <strong>NDC10:</strong> ${item.ndc10}
      | <strong>NDC9:</strong> ${item.ndc9}
      | <strong>RxCUI:</strong> ${item.clinical_drug_rxcui || item.rxcui}
    `;
    container.appendChild(div);
  });
}
