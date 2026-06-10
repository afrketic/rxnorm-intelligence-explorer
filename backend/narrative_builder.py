from typing import Any, Dict, List


def _items(classifications: Dict[str, Any], bucket: str) -> List[Dict[str, Any]]:
    values = classifications.get(bucket, [])
    return values if isinstance(values, list) else []


def _first_name(classifications: Dict[str, Any], bucket: str) -> str:
    for item in _items(classifications, bucket):
        name = item.get("class_name") or item.get("class_id")
        if name:
            return str(name)
    return ""


def build_medication_narrative(
    drug: Dict[str, Any],
    classifications: Dict[str, Any],
    scorecard: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    scorecard = scorecard or {}

    name = (
        drug.get("rxnorm_name")
        or drug.get("drug_name")
        or drug.get("name")
        or "This medication"
    )

    atc1 = _first_name(classifications, "ATC1")
    atc2 = _first_name(classifications, "ATC2")
    atc3 = _first_name(classifications, "ATC3")
    atc4 = _first_name(classifications, "ATC4")
    moa = _first_name(classifications, "MOA")
    epc = _first_name(classifications, "EPC")

    disease_count = len(_items(classifications, "DISEASE"))
    atc_depth = sum(
        1 for bucket in ["ATC1", "ATC2", "ATC3", "ATC4"]
        if len(_items(classifications, bucket)) > 0
    )

    total_classifications = sum(
        len(v) for v in classifications.values() if isinstance(v, list)
    )

    therapeutic_class = atc4 or atc3 or atc2 or atc1 or "Not available"

    sentence_1 = (
        f"{name} is classified within the {therapeutic_class} therapeutic hierarchy."
        if therapeutic_class != "Not available"
        else f"{name} has limited therapeutic hierarchy information available."
    )

    sentence_2_parts = []
    if moa:
        sentence_2_parts.append(f"mechanism evidence such as {moa}")
    if epc:
        sentence_2_parts.append(f"pharmacologic class evidence such as {epc}")
    if disease_count:
        sentence_2_parts.append(f"{disease_count} disease association mappings")

    if sentence_2_parts:
        sentence_2 = (
            "The profile includes "
            + ", ".join(sentence_2_parts)
            + "."
        )
    else:
        sentence_2 = (
            "The profile contains limited clinical semantic mappings at this stage."
        )

    sentence_3 = (
        f"Its {atc_depth}/4 ATC hierarchy depth and {total_classifications} mapped "
        "classification records support claims analytics, medication explainability, "
        "and downstream AI-readiness evaluation."
    )

    ai_summary_text = f"{sentence_1} {sentence_2} {sentence_3}"

    return {
        "ai_summary_text": ai_summary_text,
        "therapeutic_class": therapeutic_class,
        "primary_moa": moa or "Not available",
        "primary_epc": epc or "Not available",
        "disease_association_count": disease_count,
        "atc_hierarchy_depth": atc_depth,
        "total_classifications": total_classifications,
    }