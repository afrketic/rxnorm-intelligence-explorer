from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.rxnorm_client import get_full_application_payload

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "RxNorm Intelligence Explorer API Running"}

@app.get("/drug/{drug_name}")
def get_drug_intelligence(drug_name: str):
    return get_full_application_payload(drug_name)


@app.get("/graph/{drug_name}")
def get_drug_graph(drug_name: str):
    payload = get_full_application_payload(drug_name)

    identity = payload.get("identity_card", {})
    related = payload.get("related_concepts", {})
    therapeutic = payload.get("therapeutic_classes", {})
    ndc = payload.get("ndc_crosswalk", {})

    nodes = []
    edges = []

    search_term = identity.get("search_term", drug_name)
    primary_rxcui = identity.get("primary_rxcui", "")

    nodes.append({
        "id": "drug",
        "label": search_term,
        "group": "drug",
        "title": "User searched medication"
    })

    nodes.append({
        "id": "rxcui",
        "label": f"RxCUI: {primary_rxcui}",
        "group": "rxcui",
        "title": "Standardized RxNorm concept identifier"
    })

    edges.append({
        "from": "drug",
        "to": "rxcui",
        "label": "standardized as",
        "relationship_type": "Standardized As"
    })

    nodes.append({
        "id": "rxnorm",
        "label": identity.get("concept_name", "RxNorm Concept"),
        "group": "rxnorm",
        "title": identity.get("term_type_description", "RxNorm concept")
    })

    edges.append({
        "from": "rxcui",
        "to": "rxnorm",
        "label": "defines",
        "relationship_type": "Defines"
    })

    for i, item in enumerate(therapeutic.get("atc_hierarchy", [])[:6]):
        node_id = f"atc_{i}"
        nodes.append({
            "id": node_id,
            "label": item.get("full_class_id", "ATC"),
            "group": "atc",
            "title": item.get("full_class_name", "Therapeutic class")
        })
        edges.append({
            "from": "rxnorm",
            "to": node_id,
            "label": "classified into",
            "relationship_type": "Classified Into"
        })

    for i, item in enumerate(ndc.get("ndc_records", [])[:10]):
        node_id = f"ndc_{i}"
        nodes.append({
            "id": node_id,
            "label": item.get("ndc11", "NDC"),
            "group": "ndc",
            "title": "Package / claims-level identifier"
        })
        edges.append({
            "from": "rxnorm",
            "to": node_id,
            "label": "maps to",
            "relationship_type": "Maps To"
        })

    nodes.append({
        "id": "analytics",
        "label": "Claims + AI Analytics",
        "group": "analytics",
        "title": "Normalized data enables analytics, forecasting, and ML features"
    })

    edges.append({
        "from": "rxcui",
        "to": "analytics",
        "label": "enables",
        "relationship_type": "Enables"
    })

    return {
        "drug_name": drug_name,
        "nodes": nodes,
        "edges": edges
    }