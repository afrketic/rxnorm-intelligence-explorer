"""
rxnorm_client.py
---------------------------------------------------------
Core RxNorm API client for the AI - Alex Intelligence
Healthcare Interoperability Platform

Purpose:
- Centralized RxNorm API communication layer
- Shared utility functions for future Flask/FastAPI app
- Lightweight + modular foundation for:
    • Drug name lookup
    • RxCUI resolution
    • NDC crosswalks
    • RxClass integration
    • ATC hierarchy mapping
    • Future AI-ready interoperability workflows

Author: Alex Frketic
---------------------------------------------------------
"""

import requests
import pandas as pd
import time
from typing import Dict, List, Optional, Any
import json

# =========================================================
# API CONFIGURATION
# =========================================================

RXNORM_BASE_URL = "https://rxnav.nlm.nih.gov/REST"
REQUEST_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_SLEEP_SECONDS = 1.5

HEADERS = {
    "User-Agent": "AlexKnowsAI-RxNormClient/1.0"
}


# =========================================================
# DATA PRESERVATION UTILITIES
# =========================================================

def preserve_leading_zeros(value):
    """
    Preserves leading zeros for NDC values and identifiers.

    Parameters
    ----------
    value : Any

    Returns
    -------
    str
    """

    if pd.isna(value):
        return ""

    return str(value).strip()


def preserve_nested_values(data):
    """
    Recursively preserves nested JSON values.

    Prevents:
    - accidental integer conversion
    - dropped leading zeros
    - malformed nested structures

    Parameters
    ----------
    data : Any

    Returns
    -------
    Any
    """

    if isinstance(data, dict):
        return {
            k: preserve_nested_values(v)
            for k, v in data.items()
        }

    elif isinstance(data, list):
        return [
            preserve_nested_values(item)
            for item in data
        ]

    elif isinstance(data, (int, float)):
        return str(data)

    return data


# =========================================================
# API REQUEST ENGINE
# =========================================================

def adaptive_get_json(
    endpoint: str,
    params: Optional[Dict] = None,
    max_retries: int = MAX_RETRIES
) -> Optional[Dict]:
    """
    Performs resilient GET request against RxNorm APIs.

    Features
    --------
    - Retry handling
    - Timeout protection
    - JSON validation
    - Rate limit mitigation
    - Safe error handling

    Parameters
    ----------
    endpoint : str
        API endpoint path

    params : dict
        Query parameters

    max_retries : int
        Retry attempts

    Returns
    -------
    dict or None
    """

    url = f"{RXNORM_BASE_URL}/{endpoint}"

    for attempt in range(1, max_retries + 1):

        try:

            response = requests.get(
                url,
                params=params,
                headers=HEADERS,
                timeout=REQUEST_TIMEOUT
            )

            response.raise_for_status()

            json_data = response.json()

            return preserve_nested_values(json_data)

        except requests.exceptions.HTTPError as http_err:

            print(
                f"[HTTP ERROR] Attempt {attempt}/{max_retries}"
                f" | Endpoint: {endpoint}"
                f" | Error: {http_err}"
            )

        except requests.exceptions.Timeout:

            print(
                f"[TIMEOUT] Attempt {attempt}/{max_retries}"
                f" | Endpoint: {endpoint}"
            )

        except requests.exceptions.RequestException as req_err:

            print(
                f"[REQUEST ERROR] Attempt {attempt}/{max_retries}"
                f" | Endpoint: {endpoint}"
                f" | Error: {req_err}"
            )

        except ValueError as json_err:

            print(
                f"[JSON ERROR] Attempt {attempt}/{max_retries}"
                f" | Endpoint: {endpoint}"
                f" | Error: {json_err}"
            )

        time.sleep(RETRY_SLEEP_SECONDS)

    print(f"[FAILED] Unable to retrieve data from {endpoint}")

    return None


# =========================================================
# RXCUI LOOKUP FUNCTIONS
# =========================================================

def search_rxcui_by_drug_name(
    drug_name: str
) -> Dict[str, Any]:
    """
    Searches RxNorm for a drug name and returns
    normalized RxCUI results.

    Example
    -------
    >>> search_rxcui_by_drug_name("atorvastatin")

    Parameters
    ----------
    drug_name : str

    Returns
    -------
    dict
    """

    endpoint = "rxcui.json"

    params = {
        "name": drug_name,
        "search": 1
    }

    data = adaptive_get_json(endpoint, params=params)

    if not data:
        return {
            "success": False,
            "drug_name": drug_name,
            "rxcui_list": [],
            "message": "No response returned from API."
        }

    try:

        rxcui_list = (
            data
            .get("idGroup", {})
            .get("rxnormId", [])
        )

        return {
            "success": True,
            "drug_name": drug_name,
            "rxcui_list": rxcui_list,
            "rxcui_count": len(rxcui_list)
        }

    except Exception as e:

        return {
            "success": False,
            "drug_name": drug_name,
            "rxcui_list": [],
            "message": str(e)
        }

# =========================================================
# MEDICATION IDENTITY ENRICHMENT
# =========================================================

def get_rxconcept_properties_by_rxcui(
    rxcui: str
) -> Dict[str, Any]:
    """
    Retrieves RxNorm concept properties for a specific RxCUI.

    This function enriches a raw RxCUI into a medication identity record.

    Example endpoint:
    https://rxnav.nlm.nih.gov/REST/rxcui/83367/properties.json

    Parameters
    ----------
    rxcui : str
        RxNorm Concept Unique Identifier.

    Returns
    -------
    dict
        Normalized RxNorm concept property result.
    """

    cleaned_rxcui = preserve_leading_zeros(rxcui)

    endpoint = f"rxcui/{cleaned_rxcui}/properties.json"

    data = adaptive_get_json(endpoint)

    if not data:
        return {
            "success": False,
            "rxcui": cleaned_rxcui,
            "message": "No response returned from RxNorm concept properties API.",
            "source": "RxNorm / RxNav API"
        }

    properties = data.get("properties", {})

    if not properties:
        return {
            "success": False,
            "rxcui": cleaned_rxcui,
            "message": "No concept properties returned. RxCUI may be inactive or unavailable.",
            "source": "RxNorm / RxNav API"
        }

    return {
        "success": True,
        "rxcui": preserve_leading_zeros(properties.get("rxcui", cleaned_rxcui)),
        "concept_name": preserve_leading_zeros(properties.get("name", "")),
        "synonym": preserve_leading_zeros(properties.get("synonym", "")),
        "term_type": preserve_leading_zeros(properties.get("tty", "")),
        "language": preserve_leading_zeros(properties.get("language", "")),
        "suppress": preserve_leading_zeros(properties.get("suppress", "")),
        "umlscui": preserve_leading_zeros(properties.get("umlscui", "")),
        "source_vocabulary": "RXNORM",
        "source": "RxNorm / RxNav API"
    }


def classify_rxnorm_term_type(
    term_type: str
) -> str:
    """
    Converts RxNorm TTY values into user-friendly medication identity categories.

    Common examples:
    IN  = Ingredient
    BN  = Brand Name
    SCD = Semantic Clinical Drug
    SBD = Semantic Branded Drug
    GPCK = Generic Pack
    BPCK = Branded Pack

    Parameters
    ----------
    term_type : str

    Returns
    -------
    str
    """

    tty = preserve_leading_zeros(term_type).upper()

    tty_map = {
        "IN": "Ingredient",
        "MIN": "Multiple Ingredient",
        "PIN": "Precise Ingredient",
        "BN": "Brand Name",
        "SCD": "Semantic Clinical Drug",
        "SBD": "Semantic Branded Drug",
        "SCDF": "Semantic Clinical Drug Form",
        "SBDF": "Semantic Branded Drug Form",
        "SCDC": "Semantic Clinical Drug Component",
        "SBDC": "Semantic Branded Drug Component",
        "DF": "Dose Form",
        "DFG": "Dose Form Group",
        "GPCK": "Generic Pack",
        "BPCK": "Branded Pack"
    }

    return tty_map.get(tty, "Other / Unclassified")


def get_medication_identity_by_drug_name(
    drug_name: str
) -> Dict[str, Any]:
    """
    Full Step 1C workflow.

    Converts a user-entered drug name into an enriched RxNorm medication identity.

    Flow:
    Drug Name → RxCUI → RxNorm Concept Properties

    Parameters
    ----------
    drug_name : str

    Returns
    -------
    dict
    """

    cleaned_drug_name = preserve_leading_zeros(drug_name)

    if cleaned_drug_name == "":
        return {
            "success": False,
            "search_term": cleaned_drug_name,
            "message": "Drug name cannot be blank.",
            "source": "RxNorm / RxNav API"
        }

    rxcui_lookup = search_rxcui_by_drug_name(cleaned_drug_name)

    if not rxcui_lookup.get("success"):
        return {
            "success": False,
            "search_term": cleaned_drug_name,
            "message": rxcui_lookup.get("message", "RxCUI lookup failed."),
            "source": "RxNorm / RxNav API"
        }

    rxcui_list = rxcui_lookup.get("rxcui_list", [])

    if not rxcui_list:
        return {
            "success": False,
            "search_term": cleaned_drug_name,
            "message": "No RxCUI match found. Try searching by generic name, brand name, or ingredient.",
            "source": "RxNorm / RxNav API"
        }

    primary_rxcui = preserve_leading_zeros(rxcui_list[0])

    concept_properties = get_rxconcept_properties_by_rxcui(primary_rxcui)

    if not concept_properties.get("success"):
        return {
            "success": False,
            "search_term": cleaned_drug_name,
            "primary_rxcui": primary_rxcui,
            "match_status": "RxCUI Found - Concept Properties Unavailable",
            "message": concept_properties.get("message", "Concept properties unavailable."),
            "source": "RxNorm / RxNav API"
        }

    term_type = concept_properties.get("term_type", "")

    return {
        "success": True,
        "search_term": cleaned_drug_name,
        "primary_rxcui": primary_rxcui,
        "match_status": "RxCUI Found",
        "concept_name": concept_properties.get("concept_name", ""),
        "synonym": concept_properties.get("synonym", ""),
        "term_type": term_type,
        "term_type_description": classify_rxnorm_term_type(term_type),
        "language": concept_properties.get("language", ""),
        "suppress": concept_properties.get("suppress", ""),
        "umlscui": concept_properties.get("umlscui", ""),
        "source_vocabulary": concept_properties.get("source_vocabulary", "RXNORM"),
        "source": "RxNorm / RxNav API"
    }


# =========================================================
# RELATED RXNORM CONCEPTS
# =========================================================

def get_related_rxnorm_concepts_by_rxcui(
    rxcui: str,
    tty_filter: Optional[List[str]] = None
) -> Dict[str, Any]:

    cleaned_rxcui = preserve_leading_zeros(rxcui)

    if tty_filter is None:
        tty_filter = [
            "IN",
            "MIN",
            "PIN",
            "BN",
            "SCD",
            "SBD",
            "SCDF",
            "SBDF",
            "SCDC",
            "SBDC",
            "GPCK",
            "BPCK"
        ]

    endpoint = f"rxcui/{cleaned_rxcui}/related.json"

    normalized_records = []
    failed_ttys = []

    for tty in tty_filter:

        params = {
            "tty": tty
        }

        data = adaptive_get_json(endpoint, params=params)

        if not data:
            failed_ttys.append(tty)
            continue

        related_groups = (
            data
            .get("relatedGroup", {})
            .get("conceptGroup", [])
        )

        if isinstance(related_groups, dict):
            related_groups = [related_groups]

        for group in related_groups:
            group_tty = preserve_leading_zeros(group.get("tty", ""))

            concept_properties = group.get("conceptProperties", [])

            if isinstance(concept_properties, dict):
                concept_properties = [concept_properties]

            for concept in concept_properties:
                concept_tty = preserve_leading_zeros(concept.get("tty", group_tty))

                normalized_records.append({
                    "rxcui": preserve_leading_zeros(concept.get("rxcui", "")),
                    "name": preserve_leading_zeros(concept.get("name", "")),
                    "synonym": preserve_leading_zeros(concept.get("synonym", "")),
                    "term_type": concept_tty,
                    "term_type_description": classify_rxnorm_term_type(concept_tty),
                    "language": preserve_leading_zeros(concept.get("language", "")),
                    "suppress": preserve_leading_zeros(concept.get("suppress", "")),
                    "umlscui": preserve_leading_zeros(concept.get("umlscui", "")),
                    "source_group_tty": group_tty
                })

    deduped_records = []
    seen_keys = set()

    for record in normalized_records:
        key = (
            record.get("rxcui", ""),
            record.get("name", ""),
            record.get("term_type", "")
        )

        if key not in seen_keys:
            seen_keys.add(key)
            deduped_records.append(record)

    return {
        "success": True,
        "rxcui": cleaned_rxcui,
        "related_concepts_count": len(deduped_records),
        "related_concepts": deduped_records,
        "failed_ttys": failed_ttys,
        "source": "RxNorm / RxNav API"
    }


def get_full_medication_identity_package(
    drug_name: str
) -> Dict[str, Any]:
    """
    Step 1D complete workflow.

    Combines:
    - drug name search
    - primary RxCUI
    - medication identity
    - related RxNorm concepts

    Flow:
    Drug Name → RxCUI → Concept Properties → Related Concepts

    Parameters
    ----------
    drug_name : str

    Returns
    -------
    dict
    """

    identity = get_medication_identity_by_drug_name(drug_name)

    if not identity.get("success"):
        return {
            "success": False,
            "search_term": drug_name,
            "identity": identity,
            "related_concepts": [],
            "message": identity.get("message", "Medication identity lookup failed."),
            "source": "RxNorm / RxNav API"
        }

    primary_rxcui = identity.get("primary_rxcui", "")

    related = get_related_rxnorm_concepts_by_rxcui(primary_rxcui)

    return {
        "success": True,
        "search_term": drug_name,
        "primary_rxcui": primary_rxcui,
        "identity": identity,
        "related_concepts_count": related.get("related_concepts_count", 0),
        "related_concepts": related.get("related_concepts", []),
        "source": "RxNorm / RxNav API"
    }

# =========================================================
# RELATED CONCEPT GROUPING
# =========================================================

def group_related_concepts_by_term_type(
    related_concepts: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Groups related RxNorm concepts by user-friendly term type category.

    This prepares the backend response for frontend sections/cards.

    Parameters
    ----------
    related_concepts : list[dict]
        Flat related concept records from get_related_rxnorm_concepts_by_rxcui().

    Returns
    -------
    dict
        Grouped related concepts by clinical category.
    """

    grouped = {}

    for concept in related_concepts:
        term_type = preserve_leading_zeros(concept.get("term_type", ""))
        category = classify_rxnorm_term_type(term_type)

        if category not in grouped:
            grouped[category] = []

        grouped[category].append(concept)

    summary = []

    for category, records in grouped.items():
        summary.append({
            "category": category,
            "count": len(records)
        })

    summary = sorted(
        summary,
        key=lambda x: x["category"]
    )

    return {
        "group_count": len(grouped),
        "total_related_concepts": len(related_concepts),
        "summary": summary,
        "groups": grouped
    }


def get_grouped_medication_identity_package(
    drug_name: str
) -> Dict[str, Any]:
    """
    Step 1E complete workflow.

    Combines:
    - drug name search
    - RxCUI lookup
    - medication identity enrichment
    - related concepts
    - grouped related concepts

    Flow:
    Drug Name → RxCUI → Identity → Related Concepts → Grouped Clinical Categories

    Parameters
    ----------
    drug_name : str

    Returns
    -------
    dict
    """

    package = get_full_medication_identity_package(drug_name)

    if not package.get("success"):
        return {
            "success": False,
            "search_term": drug_name,
            "message": package.get("message", "Medication package lookup failed."),
            "identity": package.get("identity", {}),
            "related_concepts": [],
            "grouped_related_concepts": {},
            "source": "RxNorm / RxNav API"
        }

    related_concepts = package.get("related_concepts", [])

    grouped_related_concepts = group_related_concepts_by_term_type(
        related_concepts=related_concepts
    )

    package["grouped_related_concepts"] = grouped_related_concepts

    return package


# =========================================================
# INTEROPERABILITY VISUALIZATION LAYER
# =========================================================

def build_interoperability_flow(
    package: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Builds a frontend-ready interoperability flow.

    This prepares the response for visual rendering as:
    Drug Name → RxCUI → RxNorm Concept → Related Concepts → Analytics Use Cases

    Parameters
    ----------
    package : dict
        Output from get_grouped_medication_identity_package().

    Returns
    -------
    dict
        Frontend-ready flow structure.
    """

    identity = package.get("identity", {})
    grouped = package.get("grouped_related_concepts", {})
    summary = grouped.get("summary", [])

    search_term = package.get("search_term", "")
    primary_rxcui = package.get("primary_rxcui", "")

    flow_nodes = [
        {
            "step": 1,
            "node_key": "drug_search",
            "title": "Drug Search",
            "value": search_term,
            "description": "User-entered medication name.",
            "status": "complete" if search_term else "missing"
        },
        {
            "step": 2,
            "node_key": "rxcui_resolution",
            "title": "RxCUI Resolution",
            "value": primary_rxcui,
            "description": "RxNorm assigns a standardized concept identifier used to connect medication data across systems.",
            "status": "complete" if primary_rxcui else "missing"
        },
        {
            "step": 3,
            "node_key": "rxnorm_identity",
            "title": "RxNorm Medication Identity",
            "value": identity.get("concept_name", ""),
            "description": f"Concept classified as {identity.get('term_type_description', 'Unknown')} using RxNorm term type {identity.get('term_type', 'N/A')}.",
            "status": "complete" if identity.get("concept_name") else "missing"
        },
        {
            "step": 4,
            "node_key": "related_concepts",
            "title": "Related RxNorm Concepts",
            "value": str(package.get("related_concepts_count", 0)),
            "description": "Related ingredients, brand names, clinical drugs, branded drugs, dose forms, and drug components.",
            "status": "complete" if package.get("related_concepts_count", 0) > 0 else "missing"
        },
        {
            "step": 5,
            "node_key": "analytics_use_cases",
            "title": "Analytics-Ready Medication Intelligence",
            "value": "Enabled",
            "description": "Standardized medication relationships can support formulary analytics, claims normalization, therapy trend analysis, predictive modeling, and AI-ready healthcare intelligence.",
            "status": "complete" if package.get("related_concepts_count", 0) > 0 else "pending"
        }
    ]

    flow_edges = [
        {
            "from": "drug_search",
            "to": "rxcui_resolution",
            "label": "standardized into"
        },
        {
            "from": "rxcui_resolution",
            "to": "rxnorm_identity",
            "label": "defines"
        },
        {
            "from": "rxnorm_identity",
            "to": "related_concepts",
            "label": "connects to"
        },
        {
            "from": "related_concepts",
            "to": "analytics_use_cases",
            "label": "enables"
        }
    ]

    relationship_summary_cards = []

    for item in summary:
        relationship_summary_cards.append({
            "category": item.get("category", ""),
            "count": item.get("count", 0),
            "description": get_relationship_category_description(
                item.get("category", "")
            )
        })

    return {
        "flow_title": "Medication Interoperability Flow",
        "flow_subtitle": "How one medication search becomes standardized, connected, and analytics-ready.",
        "nodes": flow_nodes,
        "edges": flow_edges,
        "relationship_summary_cards": relationship_summary_cards
    }


def get_relationship_category_description(
    category: str
) -> str:
    """
    Provides user-friendly descriptions for RxNorm relationship categories.

    Parameters
    ----------
    category : str

    Returns
    -------
    str
    """

    description_map = {
        "Ingredient": "The base medication ingredient concept.",
        "Multiple Ingredient": "Combination ingredient concepts involving more than one active ingredient.",
        "Precise Ingredient": "More specific ingredient-level variations, salts, or chemical forms.",
        "Brand Name": "Commercial or manufacturer-associated medication names.",
        "Semantic Clinical Drug": "Clinical drug concepts that include ingredient, strength, and dose form.",
        "Semantic Branded Drug": "Branded drug concepts that include ingredient, strength, dose form, and brand.",
        "Semantic Clinical Drug Form": "Clinical medication form concepts without full strength detail.",
        "Semantic Branded Drug Form": "Branded medication form concepts.",
        "Semantic Clinical Drug Component": "Ingredient-strength components within clinical drug concepts.",
        "Semantic Branded Drug Component": "Ingredient-strength components within branded drug concepts.",
        "Generic Pack": "Packaged medication groupings without brand specificity.",
        "Branded Pack": "Packaged medication groupings associated with a brand.",
        "Other / Unclassified": "Additional RxNorm relationships not mapped to a primary display category."
    }

    return description_map.get(
        category,
        "RxNorm relationship category used to connect medication concepts."
    )


def get_visual_medication_intelligence_package(
    drug_name: str
) -> Dict[str, Any]:
    """
    Step 1F complete workflow.

    Combines:
    - drug name search
    - RxCUI lookup
    - medication identity enrichment
    - related concepts
    - grouped concepts
    - interoperability visualization layer

    Parameters
    ----------
    drug_name : str

    Returns
    -------
    dict
    """

    package = get_grouped_medication_identity_package(drug_name)

    if not package.get("success"):
        package["interoperability_flow"] = {
            "flow_title": "Medication Interoperability Flow",
            "flow_subtitle": "No flow available because medication lookup failed.",
            "nodes": [],
            "edges": [],
            "relationship_summary_cards": []
        }

        return package

    interoperability_flow = build_interoperability_flow(package)

    package["interoperability_flow"] = interoperability_flow

    return package

# =========================================================
# THERAPEUTIC CLASS EXPLORER
# =========================================================

def get_rxclass_by_rxcui(rxcui: str) -> Dict[str, Any]:
    cleaned_rxcui = preserve_leading_zeros(rxcui)

    endpoint = "rxclass/class/byRxcui.json"

    params = {
        "rxcui": cleaned_rxcui
    }

    data = adaptive_get_json(endpoint, params=params)

    if not data:
        return {
            "success": False,
            "rxcui": cleaned_rxcui,
            "rxclass_records": [],
            "message": "No RxClass response returned.",
            "source": "RxClass / RxNav API"
        }

    rxclass_info = (
        data
        .get("rxclassDrugInfoList", {})
        .get("rxclassDrugInfo", [])
    )

    if isinstance(rxclass_info, dict):
        rxclass_info = [rxclass_info]

    records = []

    for item in rxclass_info:
        min_concept = item.get("minConcept", {})
        class_concept = item.get("rxclassMinConceptItem", {})

        class_id = preserve_leading_zeros(class_concept.get("classId", ""))
        class_name = preserve_leading_zeros(class_concept.get("className", ""))
        class_type = preserve_leading_zeros(class_concept.get("classType", ""))

        records.append({
            "rxcui": preserve_leading_zeros(min_concept.get("rxcui", cleaned_rxcui)),
            "drug_name": preserve_leading_zeros(min_concept.get("name", "")),
            "drug_tty": preserve_leading_zeros(min_concept.get("tty", "")),
            "class_id": class_id,
            "class_name": class_name,
            "class_type": class_type,
            "rela": preserve_leading_zeros(item.get("rela", "")),
            "rela_source": preserve_leading_zeros(item.get("relaSource", "")),
            "source": "RxClass / RxNav API"
        })

    return {
        "success": True,
        "rxcui": cleaned_rxcui,
        "rxclass_count": len(records),
        "rxclass_records": records,
        "source": "RxClass / RxNav API"
    }


def filter_atc_therapeutic_classes(
    rxclass_records: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Keeps only ATC1-4 therapeutic class records.
    """

    atc_records = []

    for record in rxclass_records:
        class_type = preserve_leading_zeros(record.get("class_type", "")).upper()

        if class_type == "ATC1-4":
            atc_records.append(record)

    return atc_records


def build_atc_hierarchy_from_class_id(
    class_id: str,
    class_name: str = ""
) -> Dict[str, Any]:
    """
    Builds ATC hierarchy prefixes from an ATC classId.

    Example:
    C10AA05 becomes:
    C      = ATC Level 1
    C10    = ATC Level 2
    C10A   = ATC Level 3
    C10AA  = ATC Level 4
    C10AA05 = Full classId
    """

    cleaned_class_id = preserve_leading_zeros(class_id).strip()

    return {
        "full_class_id": cleaned_class_id,
        "full_class_name": preserve_leading_zeros(class_name),
        "atc_level_1_code": cleaned_class_id[:1] if len(cleaned_class_id) >= 1 else "",
        "atc_level_2_code": cleaned_class_id[:3] if len(cleaned_class_id) >= 3 else "",
        "atc_level_3_code": cleaned_class_id[:4] if len(cleaned_class_id) >= 4 else "",
        "atc_level_4_code": cleaned_class_id[:5] if len(cleaned_class_id) >= 5 else "",
        "atc_full_code": cleaned_class_id
    }


def get_therapeutic_class_explorer_package(
    drug_name: str
) -> Dict[str, Any]:
    """
    Step 1G complete workflow.

    Flow:
    Drug Name → RxCUI → RxClass → ATC Therapeutic Class Intelligence
    """

    package = get_visual_medication_intelligence_package(drug_name)

    if not package.get("success"):
        package["therapeutic_class_explorer"] = {
            "success": False,
            "message": "Therapeutic class lookup unavailable because medication lookup failed.",
            "rxclass_records": [],
            "atc_records": [],
            "atc_hierarchy": []
        }

        return package

    primary_rxcui = package.get("primary_rxcui", "")

    rxclass_result = get_rxclass_by_rxcui(primary_rxcui)

    rxclass_records = rxclass_result.get("rxclass_records", [])
    atc_records = filter_atc_therapeutic_classes(rxclass_records)

    atc_hierarchy = []

    for record in atc_records:
        hierarchy = build_atc_hierarchy_from_class_id(
            class_id=record.get("class_id", ""),
            class_name=record.get("class_name", "")
        )

        hierarchy["rxcui"] = record.get("rxcui", "")
        hierarchy["drug_name"] = record.get("drug_name", "")
        hierarchy["class_type"] = record.get("class_type", "")
        hierarchy["rela"] = record.get("rela", "")
        hierarchy["rela_source"] = record.get("rela_source", "")

        atc_hierarchy.append(hierarchy)

    package["therapeutic_class_explorer"] = {
        "success": True,
        "rxcui": primary_rxcui,
        "rxclass_count": len(rxclass_records),
        "atc_count": len(atc_records),
        "rxclass_records": rxclass_records,
        "atc_records": atc_records,
        "atc_hierarchy": atc_hierarchy,
        "source": "RxClass / RxNav API"
    }

    return package

# =========================================================
# NDC CROSSWALK INTELLIGENCE
# =========================================================

# =========================================================
# NDC CROSSWALK INTELLIGENCE
# =========================================================

def get_ndc_properties_by_rxcui(
    rxcui: str,
    debug: bool = False
) -> Dict[str, Any]:
    """
    Retrieves NDC mappings for a medication by expanding an ingredient-level
    RxCUI into related clinical/branded drug concepts first.

    Why this matters:
    - Ingredient-level RxCUIs often do not directly map to NDCs.
    - NDCs are usually tied to package/product-level or clinical drug concepts.
    - This function follows the practical interoperability path:
      Ingredient RxCUI -> SCD/SBD RxCUIs -> Related NDCs.

    Parameters
    ----------
    rxcui : str
        Primary medication RxCUI, often an ingredient-level RxCUI.

    debug : bool
        When True, prints raw related NDC API responses for troubleshooting.

    Returns
    -------
    dict
        Normalized NDC crosswalk package.
    """

    cleaned_rxcui = preserve_leading_zeros(rxcui)

    related_package = get_related_rxnorm_concepts_by_rxcui(cleaned_rxcui)

    if not related_package.get("success"):
        return {
            "success": False,
            "ingredient_rxcui": cleaned_rxcui,
            "clinical_drug_rxcui_count": 0,
            "ndc_count": 0,
            "ndc_records": [],
            "message": "Unable to retrieve related RxNorm concepts.",
            "source": "RxNorm / RxNav API"
        }

    related_concepts = related_package.get("related_concepts", [])

    # Related concept records created earlier use the key "term_type",
    # not "tty". This was the root cause of the empty clinical drug list.
    clinical_drug_ttys = {"SCD", "SBD", "GPCK", "BPCK"}
    clinical_drug_rxcuis = []

    for concept in related_concepts:
        term_type = preserve_leading_zeros(concept.get("term_type", "")).upper()

        if term_type in clinical_drug_ttys:
            concept_rxcui = preserve_leading_zeros(concept.get("rxcui", ""))

            if concept_rxcui:
                clinical_drug_rxcuis.append(concept_rxcui)

    clinical_drug_rxcuis = sorted(set(clinical_drug_rxcuis))

    all_ndc_records = []
    failed_clinical_rxcuis = []

    for clinical_rxcui in clinical_drug_rxcuis:
        clinical_rxcui = preserve_leading_zeros(clinical_rxcui)

        endpoint = f"rxcui/{clinical_rxcui}/ndcs.json"

        params = {
            "status": "all"
        }

        data = adaptive_get_json(endpoint, params=params)

        data = adaptive_get_json(endpoint, params=params)

        if debug:
            print("\n================ DEBUG NDC LOOKUP ================")
            print(f"Clinical Drug RxCUI: {clinical_rxcui}")
            print(f"Endpoint: {endpoint}")
            print(f"Params: {params}")
            print("Raw Response:")
            print(json.dumps(data, indent=2)[:3000])
            print("==================================================")

        if not data:
            failed_clinical_rxcuis.append({
                "clinical_drug_rxcui": clinical_rxcui,
                "reason": "No response returned from relatedndc endpoint."
            })
            continue

        ndc_values = (
            data
            .get("ndcGroup", {})
            .get("ndcList", {})
            .get("ndc", [])
        )

        if isinstance(ndc_values, str):
            ndc_values = [ndc_values]

        if isinstance(ndc_values, dict):
            # Defensive handling for unexpected payload shapes.
            ndc_values = list(ndc_values.values())

        for ndc11 in ndc_values:
            ndc11 = preserve_leading_zeros(ndc11)

            if not ndc11:
                continue

            all_ndc_records.append({
                "ingredient_rxcui": cleaned_rxcui,
                "clinical_drug_rxcui": clinical_rxcui,
                "rxcui": clinical_rxcui,
                "ndc11": ndc11,
                "ndc10": ndc11[:10],
                "ndc9": ndc11[:9],
                "source": "RxNorm Related NDC",
                "spl_set_id": "",
                "ndc_status": "all"
            })

    deduped_records = []
    seen = set()

    for record in all_ndc_records:
        key = (
            record.get("clinical_drug_rxcui", ""),
            record.get("ndc11", "")
        )

        if key not in seen:
            seen.add(key)
            deduped_records.append(record)

    return {
        "success": True,
        "ingredient_rxcui": cleaned_rxcui,
        "clinical_drug_rxcui_count": len(clinical_drug_rxcuis),
        "clinical_drug_rxcuis": clinical_drug_rxcuis,
        "failed_clinical_rxcuis": failed_clinical_rxcuis,
        "ndc_count": len(deduped_records),
        "ndc_records": deduped_records,
        "source": "RxNorm / RxNav API"
    }


def build_ndc_crosswalk_summary(
    ndc_records: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Builds summary metrics for NDC crosswalk results.
    """

    unique_ndc11 = sorted(set(
        record.get("ndc11", "")
        for record in ndc_records
        if record.get("ndc11", "")
    ))

    unique_ndc10 = sorted(set(
        record.get("ndc10", "")
        for record in ndc_records
        if record.get("ndc10", "")
    ))

    unique_ndc9 = sorted(set(
        record.get("ndc9", "")
        for record in ndc_records
        if record.get("ndc9", "")
    ))

    sources = sorted(set(
        record.get("source", "")
        for record in ndc_records
        if record.get("source", "")
    ))

    return {
        "total_ndc_records": len(ndc_records),
        "unique_ndc11_count": len(unique_ndc11),
        "unique_ndc10_count": len(unique_ndc10),
        "unique_ndc9_count": len(unique_ndc9),
        "source_count": len(sources),
        "sources": sources
    }


def get_ndc_crosswalk_intelligence_package(
    drug_name: str
) -> Dict[str, Any]:
    """
    Step 1H complete workflow.

    Flow:
    Drug Name → RxCUI → RxClass → ATC → NDC9/NDC10/NDC11 → Claims Intelligence
    """

    package = get_therapeutic_class_explorer_package(drug_name)

    if not package.get("success"):
        package["ndc_crosswalk_intelligence"] = {
            "success": False,
            "message": "NDC lookup unavailable because medication lookup failed.",
            "ndc_records": [],
            "summary": {}
        }

        return package

    primary_rxcui = package.get("primary_rxcui", "")

    ndc_result = get_ndc_properties_by_rxcui(primary_rxcui)

    ndc_records = ndc_result.get("ndc_records", [])
    summary = build_ndc_crosswalk_summary(ndc_records)

    package["ndc_crosswalk_intelligence"] = {
        "success": ndc_result.get("success", False),
        "rxcui": primary_rxcui,
        "ndc_count": ndc_result.get("ndc_count", 0),
        "summary": summary,
        "ndc_records": ndc_records,
        "claims_intelligence_note": (
            "NDC identifiers connect standardized medication concepts to pharmacy claims, "
            "billing records, package-level drug products, and downstream analytics workflows."
        ),
        "source": "RxNorm / RxNav API"
    }

    return package


# =========================================================
# STEP 2A — APPLICATION SERVICE LAYER
# =========================================================

def search_drug(drug_name: str) -> Dict[str, Any]:
    """
    Frontend-ready drug search service.
    Returns the primary RxCUI and match status.
    """
    identity = get_medication_identity_by_drug_name(drug_name)

    return {
        "success": identity.get("success", False),
        "search_term": identity.get("search_term", drug_name),
        "primary_rxcui": identity.get("primary_rxcui", ""),
        "match_status": identity.get("match_status", ""),
        "message": identity.get("message", ""),
        "source": "RxNorm / RxNav API"
    }


def get_identity_card(drug_name: str) -> Dict[str, Any]:
    """
    Frontend-ready Medication Identity Card.
    """
    identity = get_medication_identity_by_drug_name(drug_name)

    return {
        "card_title": "Medication Identity",
        "success": identity.get("success", False),
        "search_term": identity.get("search_term", drug_name),
        "primary_rxcui": identity.get("primary_rxcui", ""),
        "concept_name": identity.get("concept_name", ""),
        "term_type": identity.get("term_type", ""),
        "term_type_description": identity.get("term_type_description", ""),
        "synonym": identity.get("synonym", ""),
        "language": identity.get("language", ""),
        "suppress": identity.get("suppress", ""),
        "source_vocabulary": identity.get("source_vocabulary", "RXNORM"),
        "source": identity.get("source", "RxNorm / RxNav API")
    }


def get_related_concepts(drug_name: str) -> Dict[str, Any]:
    """
    Frontend-ready related concept explorer.
    """
    package = get_grouped_medication_identity_package(drug_name)

    return {
        "section_title": "Related RxNorm Concepts",
        "success": package.get("success", False),
        "search_term": package.get("search_term", drug_name),
        "primary_rxcui": package.get("primary_rxcui", ""),
        "related_concepts_count": package.get("related_concepts_count", 0),
        "related_concepts": package.get("related_concepts", []),
        "grouped_related_concepts": package.get("grouped_related_concepts", {}),
        "source": "RxNorm / RxNav API"
    }


def get_therapeutic_classes(drug_name: str) -> Dict[str, Any]:
    """
    Frontend-ready therapeutic class explorer.
    """
    package = get_therapeutic_class_explorer_package(drug_name)
    therapeutic = package.get("therapeutic_class_explorer", {})

    return {
        "section_title": "Therapeutic Class Explorer",
        "success": therapeutic.get("success", False),
        "search_term": package.get("search_term", drug_name),
        "primary_rxcui": package.get("primary_rxcui", ""),
        "rxclass_count": therapeutic.get("rxclass_count", 0),
        "atc_count": therapeutic.get("atc_count", 0),
        "rxclass_records": therapeutic.get("rxclass_records", []),
        "atc_records": therapeutic.get("atc_records", []),
        "atc_hierarchy": therapeutic.get("atc_hierarchy", []),
        "source": therapeutic.get("source", "RxClass / RxNav API")
    }


def get_ndc_crosswalk(drug_name: str) -> Dict[str, Any]:
    """
    Frontend-ready NDC crosswalk explorer.
    """
    package = get_ndc_crosswalk_intelligence_package(drug_name)
    ndc = package.get("ndc_crosswalk_intelligence", {})

    return {
        "section_title": "NDC Crosswalk Intelligence",
        "success": ndc.get("success", False),
        "search_term": package.get("search_term", drug_name),
        "primary_rxcui": package.get("primary_rxcui", ""),
        "ndc_count": ndc.get("ndc_count", 0),
        "summary": ndc.get("summary", {}),
        "ndc_records": ndc.get("ndc_records", []),
        "claims_intelligence_note": ndc.get("claims_intelligence_note", ""),
        "source": ndc.get("source", "RxNorm / RxNav API")
    }


def build_interoperability_graph(drug_name: str) -> Dict[str, Any]:
    """
    Frontend-ready interoperability graph structure.
    """
    package = get_ndc_crosswalk_intelligence_package(drug_name)

    return {
        "section_title": "Medication Interoperability Graph",
        "success": package.get("success", False),
        "search_term": package.get("search_term", drug_name),
        "primary_rxcui": package.get("primary_rxcui", ""),
        "interoperability_flow": package.get("interoperability_flow", {}),
        "therapeutic_class_explorer": package.get("therapeutic_class_explorer", {}),
        "ndc_crosswalk_intelligence": package.get("ndc_crosswalk_intelligence", {}),
        "source": "RxNorm / RxNav API"
    }


def get_full_application_payload(drug_name: str) -> Dict[str, Any]:
    """
    Master service function for the future frontend/API.

    This is the main function the web app can eventually call.
    """
    return {
        "app_name": "RxNorm Intelligence Explorer",
        "subtitle": "Visualizing how medication data becomes standardized, interoperable, and AI-ready.",
        "search": search_drug(drug_name),
        "identity_card": get_identity_card(drug_name),
        "related_concepts": get_related_concepts(drug_name),
        "therapeutic_classes": get_therapeutic_classes(drug_name),
        "ndc_crosswalk": get_ndc_crosswalk(drug_name),
        "interoperability_graph": build_interoperability_graph(drug_name)
    }
















# =========================================================
# TESTING / LOCAL EXECUTION
# =========================================================

if __name__ == "__main__":

    test_drug = "atorvastatin"

    payload = get_full_application_payload(test_drug)

    print("\n==============================")
    print("RXNORM APPLICATION PAYLOAD TEST")
    print("==============================")
    print(f"App Name: {payload.get('app_name')}")
    print(f"Search Term: {payload.get('search', {}).get('search_term')}")
    print(f"Primary RxCUI: {payload.get('search', {}).get('primary_rxcui')}")
    print(f"Identity Concept: {payload.get('identity_card', {}).get('concept_name')}")
    print(f"Related Concepts: {payload.get('related_concepts', {}).get('related_concepts_count')}")
    print(f"ATC Count: {payload.get('therapeutic_classes', {}).get('atc_count')}")
    print(f"NDC Count: {payload.get('ndc_crosswalk', {}).get('ndc_count')}")
    print("==============================\n")