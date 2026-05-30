"""
RxTerms + RxClass API Program with Persistent Cache System

Current tables created:
1. Table1_RxTerms_getAllRxTermsProducts.csv
2. Table2_RxTerms_getAllRxTermInfo.csv
3. Table3_RxClass_getClassbyRxNormDrugId.csv
4. Table4_RxClass_getClassByRxNormDrugName.csv
5. Table5_RxClass_getAllClasses.csv
6. Table6_RxNorm_getNDCProperties.csv
7. Table7_RxNorm_getRxNormName.csv
8. Table8_RxNorm_getDrugs.csv

Step 3 manipulated files created:
1. final_master_rxcui.csv
2. merged_RxTerms_Info.csv
3. merged_RxClass_Info.csv
4. merged_classTypes.csv
5. rxcui_therapeutic_classes.csv
6. final_rxcui_ATC1-4_Info.csv
7. final_rxcui_DISEASE_Info.csv
8. final_rxcui_CHEM_Info.csv
9. final_rxcui_MOA_Info.csv
10. final_rxcui_PE_Info.csv
11. final_rxcui_DISPOS_Info.csv
12. final_rxcui_STRUCT_Info.csv
13. final_rxcui_EPC_Info.csv
14. final_rxcui_VA_Info.csv
15. final_rxcui_PK_Info.csv
16. final_rxcui_CVX_Info.csv
17. final_rxcui_TC_Info.csv
18. final_rxcui_SCHEDULE_Info.csv
19. classType_crosswalk.csv
20. RxCUIs by ClassType/ final_rxcui_*_Info.csv subset files
21. RxCUI_ACT1_4_TheraClassBreakdown.csv
22. Normalized_NDC_Crosswalk.csv
23. ACT1-4_TheraClassNDC.csv
24. merged_ACT1-4_TheraNDCName.csv
25. Crosswalks folder

Folder structure created:

Selected Folder/
├── API Cache/
│   ├── Table1_cache.csv
│   ├── Table2_cache.csv
│   ├── Table3_cache.csv
│   ├── Table4_cache.csv
│   ├── Table5_cache.csv
│   ├── Table6_cache.csv
│   ├── Table7_cache.csv
│   └── Table8_cache.csv
│
├── API Program Run Date MM.DD.YY/
│   ├── Raw Data Files/
│   ├── Manipulated Data Files/
│   └── Crosswalks/

Program requirements incorporated:
- Step 0 checks required Python packages and installs missing packages automatically.
- User is prompted for a valid storage folder path.
- A dated run folder is created using MM.DD.YY format.
- "Raw Data Files" and "Manipulated Data Files" folders are created automatically.
- A persistent "API Cache" folder is created outside the dated run folder.
- Every API call uses adaptive retry logic.
- Every API pull has a progress bar with adaptive estimated time remaining.
- Every API output is saved automatically into "Raw Data Files".
- Leading zeros are preserved across all API output values.
- API failures are logged without crashing the full program.
- Each table has its own persistent cache file.
- Table1 is refreshed every run and compared against the prior Table1 cache.
- Tables 2, 3, and 4 only call APIs for values not already present in cache.
- Each table produces an audit CSV file.
- Table5 is refreshed every run and compared against the prior Table5 cache.
- Table6 uses unique RXCUIs from Tables 1, 3, and 4 and pulls NDC properties with ndcstatus=all.
- Table7 uses unique RXCUIs from final_master_rxcui logic and pulls RxNorm concept names.
- Table8 filters Table3 where minConcept.tty = IN and uses unique minConcept.name values to pull related drugs.
- After Table6 is complete, the user is prompted to continue to Step 3.
- Step 3 creates manipulated merge outputs in the Manipulated Data Files folder.
- At the end of the program, a final popup appears stating:
  "Program now complete!  Closing program."
- After the final popup, the program safely closes using sys.exit(0).
"""

# ============================================================
# Step 0: Package Check / Auto Install
# ============================================================

import sys
import subprocess
import importlib.util


REQUIRED_PACKAGES = {
    "requests": "requests",
    "pandas": "pandas"
}


def install_missing_packages(required_packages: dict) -> None:
    """
    Checks whether required packages are installed.
    If any are missing, installs them automatically.
    """
    missing_packages = []

    for import_name, pip_name in required_packages.items():
        if importlib.util.find_spec(import_name) is None:
            missing_packages.append(pip_name)

    if missing_packages:
        print("Step 0 - Missing packages identified.")
        print(f"Installing missing packages: {', '.join(missing_packages)}")

        for package in missing_packages:
            subprocess.check_call([
                sys.executable,
                "-m",
                "pip",
                "install",
                package
            ])

        print("Step 0 Complete - Missing packages installed. Proceeding to user input for Step 1.")
    else:
        print("Step 0 Complete - All packages are installed. Proceeding to user input for Step 1.")


install_missing_packages(REQUIRED_PACKAGES)


# ============================================================
# Imports After Package Validation
# ============================================================

import time
import random
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List
from concurrent.futures import ThreadPoolExecutor, as_completed

import tkinter as tk
from tkinter import simpledialog, messagebox

import requests
import pandas as pd
# ============================================================
# Global API Settings
# ============================================================

API_TIMEOUT_SECONDS = 60
API_MAX_RETRIES = 5
API_BASE_SLEEP_SECONDS = 0.25
API_MAX_SLEEP_SECONDS = 10
API_PROGRESS_BAR_WIDTH = 40

# Controlled parallelism for high-volume API steps.
# Start conservative to avoid overwhelming RxNav/NLM endpoints.
# Increase slowly only if 429/rate-limit failures remain low.
API_PARALLEL_ENABLED = True
API_MAX_WORKERS = 12





# ============================================================
# Step 1: User Input and Folder Creation
# ============================================================

def get_valid_user_folder_path() -> Path:
    """
    Opens a popup asking the user to provide a valid folder path.
    Continues asking until a valid folder path is provided.
    """
    root = tk.Tk()
    root.withdraw()

    while True:
        user_input = simpledialog.askstring(
            title="Step 1 - Storage Location",
            prompt="Where would you like to original information to be stored?  Provide a clear file path to store data: "
        )

        if user_input is None:
            messagebox.showwarning(
                "Input Required",
                "A valid file path is required to continue."
            )
            continue

        user_input = user_input.strip().strip('"').strip("'")
        folder_path = Path(user_input)

        if folder_path.exists() and folder_path.is_dir():
            return folder_path

        messagebox.showerror(
            "Invalid File Path",
            "The file path entered is not valid. Please enter a valid folder path."
        )


def create_run_folders(base_folder: Path) -> dict:
    """
    Creates:
    - API Cache folder
    - dated run folder
    - Raw Data Files folder
    - Manipulated Data Files folder
    """
    run_date = datetime.now().strftime("%m.%d.%y")

    cache_folder = base_folder / "API Cache"
    run_folder = base_folder / f"API Program Run Date {run_date}"
    raw_data_folder = run_folder / "Raw Data Files"
    manipulated_data_folder = run_folder / "Manipulated Data Files"

    cache_folder.mkdir(parents=True, exist_ok=True)
    raw_data_folder.mkdir(parents=True, exist_ok=True)
    manipulated_data_folder.mkdir(parents=True, exist_ok=True)

    messagebox.showinfo(
        "Step 1 Complete",
        "Run Date & Data Folders Created.  Proceeding to Step 2."
    )

    return {
        "cache_folder": cache_folder,
        "run_folder": run_folder,
        "raw_data_folder": raw_data_folder,
        "manipulated_data_folder": manipulated_data_folder
    }


# ============================================================
# Leading Zero Preservation Helpers
# ============================================================

def preserve_leading_zeros(value):
    """
    Converts a value to string while preserving leading zeros.
    """
    if value is None:
        return ""

    if isinstance(value, str):
        return value

    return str(value)


def preserve_nested_values(obj):
    """
    Recursively converts scalar nested values to strings while keeping dict/list structure.
    This protects leading zeros before pandas normalization.
    """
    if isinstance(obj, dict):
        return {k: preserve_nested_values(v) for k, v in obj.items()}

    if isinstance(obj, list):
        return [preserve_nested_values(item) for item in obj]

    return preserve_leading_zeros(obj)


def preserve_dataframe_leading_zeros(df: pd.DataFrame) -> pd.DataFrame:
    """
    Converts all dataframe cells to string values before CSV save.
    """
    if df.empty:
        return df

    df = df.copy()

    for col in df.columns:
        df[col] = df[col].apply(preserve_leading_zeros)

    return df


# ============================================================
# Adaptive Time Remaining + Progress Bar Helpers
# ============================================================

def format_seconds(seconds: Optional[float]) -> str:
    """
    Formats seconds into h/m/s text.
    """
    if seconds is None:
        return "Calculating..."

    seconds = max(int(round(seconds)), 0)

    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    if hours > 0:
        return f"{hours}h {minutes}m {secs}s"
    if minutes > 0:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def estimate_time_remaining(start_time: float, completed: int, total: int) -> Optional[float]:
    """
    Calculates adaptive estimated time remaining.
    """
    if completed <= 0 or total <= 0:
        return None

    elapsed_seconds = time.time() - start_time
    avg_seconds_per_item = elapsed_seconds / completed
    remaining_items = max(total - completed, 0)

    return avg_seconds_per_item * remaining_items


def print_progress_bar(
    step_name: str,
    completed: int,
    total: int,
    start_time: Optional[float] = None
) -> None:
    """
    Prints a progress bar with percent complete and adaptive time remaining.
    """
    if total <= 0:
        percent = 100
        filled_length = API_PROGRESS_BAR_WIDTH
    else:
        percent = int((completed / total) * 100)
        filled_length = int(API_PROGRESS_BAR_WIDTH * completed // total)

    bar = "#" * filled_length + "-" * (API_PROGRESS_BAR_WIDTH - filled_length)

    time_remaining_seconds = None
    if start_time is not None:
        time_remaining_seconds = estimate_time_remaining(
            start_time=start_time,
            completed=completed,
            total=total
        )

    time_remaining_text = format_seconds(time_remaining_seconds)

    print(
        f"\r{step_name}: |{bar}| {percent:3d}% complete "
        f"({completed:,}/{total:,}) | Time Remaining: {time_remaining_text}",
        end="",
        flush=True
    )

    if completed >= total:
        print()


# ============================================================
# Adaptive API Call Helper
# ============================================================

def adaptive_get_json(
    session: requests.Session,
    url: str,
    step_name: str,
    identifier: Optional[str] = None,
    params: Optional[dict] = None,
    max_retries: int = API_MAX_RETRIES,
    timeout: int = API_TIMEOUT_SECONDS
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """
    Adaptive API GET helper.

    Returns:
    - json data when successful
    - structured failure dictionary when unsuccessful

    This prevents one API failure from crashing the entire program.
    """
    last_error = None
    status_code = None

    for attempt in range(1, max_retries + 1):
        try:
            response = session.get(url, params=params, timeout=timeout)
            status_code = response.status_code

            if response.status_code == 200:
                try:
                    data = response.json()
                    data = preserve_nested_values(data)
                    return data, None

                except Exception as json_error:
                    return None, {
                        "step_name": step_name,
                        "identifier": identifier,
                        "url": response.url,
                        "status_code": response.status_code,
                        "attempts": attempt,
                        "error_type": "JSON_PARSE_ERROR",
                        "error": str(json_error)
                    }

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")

                if retry_after and retry_after.isdigit():
                    sleep_seconds = min(int(retry_after), API_MAX_SLEEP_SECONDS)
                else:
                    sleep_seconds = min(
                        API_BASE_SLEEP_SECONDS * (2 ** (attempt - 1)) + random.uniform(0, 0.5),
                        API_MAX_SLEEP_SECONDS
                    )

                last_error = f"Rate limited with status 429. Sleeping {sleep_seconds:.2f} seconds."
                time.sleep(sleep_seconds)
                continue

            if response.status_code in [500, 502, 503, 504]:
                sleep_seconds = min(
                    API_BASE_SLEEP_SECONDS * (2 ** (attempt - 1)) + random.uniform(0, 0.5),
                    API_MAX_SLEEP_SECONDS
                )

                last_error = f"Temporary server error {response.status_code}. Sleeping {sleep_seconds:.2f} seconds."
                time.sleep(sleep_seconds)
                continue

            return None, {
                "step_name": step_name,
                "identifier": identifier,
                "url": response.url,
                "status_code": response.status_code,
                "attempts": attempt,
                "error_type": "NON_RETRYABLE_STATUS_CODE",
                "error": response.text[:500]
            }

        except requests.exceptions.Timeout as timeout_error:
            last_error = str(timeout_error)
            sleep_seconds = min(
                API_BASE_SLEEP_SECONDS * (2 ** (attempt - 1)) + random.uniform(0, 0.5),
                API_MAX_SLEEP_SECONDS
            )
            time.sleep(sleep_seconds)

        except requests.exceptions.ConnectionError as connection_error:
            last_error = str(connection_error)
            sleep_seconds = min(
                API_BASE_SLEEP_SECONDS * (2 ** (attempt - 1)) + random.uniform(0, 0.5),
                API_MAX_SLEEP_SECONDS
            )
            time.sleep(sleep_seconds)

        except Exception as general_error:
            return None, {
                "step_name": step_name,
                "identifier": identifier,
                "url": url,
                "status_code": status_code,
                "attempts": attempt,
                "error_type": "UNEXPECTED_ERROR",
                "error": str(general_error)
            }

    return None, {
        "step_name": step_name,
        "identifier": identifier,
        "url": url,
        "status_code": status_code,
        "attempts": max_retries,
        "error_type": "MAX_RETRIES_EXCEEDED",
        "error": last_error
    }


# ============================================================
# CSV / Save Helpers
# ============================================================

def read_csv_as_string(file_path: Path) -> pd.DataFrame:
    """
    Reads a CSV with all columns as strings.
    """
    if not file_path.exists():
        return pd.DataFrame()

    try:
        return pd.read_csv(file_path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    except Exception:
        return pd.read_csv(file_path, dtype=str, keep_default_na=False)


def save_csv_string_safe(df: pd.DataFrame, output_file: Path) -> Path:
    """
    Saves dataframe to CSV after preserving all values as strings.
    """
    df = preserve_dataframe_leading_zeros(df)

    output_file.parent.mkdir(parents=True, exist_ok=True)

    df.to_csv(
        output_file,
        index=False,
        encoding="utf-8-sig"
    )

    return output_file


def save_raw_api_file(df: pd.DataFrame, raw_data_folder: Path, file_name: str) -> Path:
    """
    Saves current-run raw API output.
    """
    output_file = raw_data_folder / file_name
    save_csv_string_safe(df, output_file)

    print(f"Raw API file saved: {output_file}")
    print(f"Raw API file row count: {len(df):,}")
    print("Leading zeros preserved for all values.")

    return output_file


def save_failures_if_any(failures: list, raw_data_folder: Path, file_name: str) -> Optional[Path]:
    """
    Saves failures to the Raw Data Files folder when failures exist.
    """
    if not failures:
        return None

    failures_df = pd.DataFrame(failures)

    return save_raw_api_file(
        df=failures_df,
        raw_data_folder=raw_data_folder,
        file_name=file_name
    )


# ============================================================
# Cache Helpers
# ============================================================

def normalize_cache_columns(df: pd.DataFrame, required_columns: List[str]) -> pd.DataFrame:
    """
    Ensures required cache key columns exist.
    """
    df = preserve_dataframe_leading_zeros(df)

    for col in required_columns:
        if col not in df.columns:
            df[col] = ""

    return df


def load_cache(cache_folder: Path, cache_file_name: str, required_columns: Optional[List[str]] = None) -> pd.DataFrame:
    """
    Loads a cache file if it exists.
    """
    cache_path = cache_folder / cache_file_name

    cache_df = read_csv_as_string(cache_path)

    if required_columns:
        cache_df = normalize_cache_columns(cache_df, required_columns)

    return cache_df


def get_cached_values(cache_df: pd.DataFrame, key_column: str) -> set:
    """
    Gets a set of cached values from one key column.
    """
    if cache_df.empty or key_column not in cache_df.columns:
        return set()

    return set(
        cache_df[key_column]
        .dropna()
        .astype(str)
        .str.strip()
        .loc[lambda s: s != ""]
        .tolist()
    )


def append_and_dedupe_cache(
    existing_cache_df: pd.DataFrame,
    new_df: pd.DataFrame,
    cache_folder: Path,
    cache_file_name: str,
    dedupe_key_columns: List[str]
) -> pd.DataFrame:
    """
    Appends newly pulled records to existing cache and deduplicates using table-specific keys.
    """
    cache_path = cache_folder / cache_file_name

    existing_cache_df = normalize_cache_columns(existing_cache_df, dedupe_key_columns)
    new_df = normalize_cache_columns(new_df, dedupe_key_columns)

    if existing_cache_df.empty and new_df.empty:
        final_cache_df = pd.DataFrame(columns=dedupe_key_columns)
    elif existing_cache_df.empty:
        final_cache_df = new_df.copy()
    elif new_df.empty:
        final_cache_df = existing_cache_df.copy()
    else:
        final_cache_df = pd.concat([existing_cache_df, new_df], ignore_index=True, sort=False)

    final_cache_df = normalize_cache_columns(final_cache_df, dedupe_key_columns)

    # Drop exact duplicates first, then deduplicate by table-specific keys.
    final_cache_df = final_cache_df.drop_duplicates()
    final_cache_df = final_cache_df.drop_duplicates(subset=dedupe_key_columns, keep="last")

    save_csv_string_safe(final_cache_df, cache_path)

    print(f"Cache updated: {cache_path}")
    print(f"Cache row count: {len(final_cache_df):,}")

    return final_cache_df


def create_cache_audit_file(
    table_name: str,
    raw_data_folder: Path,
    total_input_values: int,
    values_already_cached: int,
    values_newly_pulled: int,
    api_failures: int,
    final_cache_row_count: int,
    extra_metrics: Optional[Dict[str, Any]] = None
) -> Path:
    """
    Creates an audit file for a table's cache behavior.
    """
    audit_data = {
        "table_name": table_name,
        "run_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_input_values": preserve_leading_zeros(total_input_values),
        "values_already_cached": preserve_leading_zeros(values_already_cached),
        "values_newly_pulled": preserve_leading_zeros(values_newly_pulled),
        "api_failures": preserve_leading_zeros(api_failures),
        "final_cache_row_count": preserve_leading_zeros(final_cache_row_count)
    }

    if extra_metrics:
        for key, value in extra_metrics.items():
            audit_data[key] = preserve_leading_zeros(value)

    audit_df = pd.DataFrame([audit_data])
    audit_file = raw_data_folder / f"{table_name}_cache_audit.csv"

    save_csv_string_safe(audit_df, audit_file)

    print(f"Cache audit file saved: {audit_file}")

    return audit_file


def save_delta_values(
    values: List[str],
    raw_data_folder: Path,
    file_name: str,
    column_name: str
) -> Path:
    """
    Saves a one-column delta list for traceability.
    """
    delta_df = pd.DataFrame({column_name: values})
    return save_raw_api_file(delta_df, raw_data_folder, file_name)


# ============================================================
# Value Extraction Helpers
# ============================================================

def get_unique_rxcuis_from_table1(table1_df: pd.DataFrame) -> List[str]:
    """
    Gets unique RXCUIs from Table1.
    """
    if table1_df.empty:
        return []

    if "rxcui" not in table1_df.columns:
        raise ValueError("Table 1 does not contain a column named 'rxcui'.")

    return (
        table1_df["rxcui"]
        .dropna()
        .astype(str)
        .str.strip()
        .loc[lambda s: s != ""]
        .drop_duplicates()
        .tolist()
    )


def get_unique_drug_names_from_table3(table3_df: pd.DataFrame) -> List[str]:
    """
    Pulls unique drug names from Table 3.

    The RxClass API structure usually places the drug name under:
    - minConcept.name after pandas normalization

    This helper also checks for a direct "name" field to support future schema changes.
    """
    if table3_df.empty:
        return []

    possible_name_columns = [
        "name",
        "minConcept.name"
    ]

    name_column = None

    for col in possible_name_columns:
        if col in table3_df.columns:
            name_column = col
            break

    if name_column is None:
        name_like_columns = [
            col for col in table3_df.columns
            if col.lower() == "name" or col.lower().endswith(".name")
        ]

        if name_like_columns:
            name_column = name_like_columns[0]

    if name_column is None:
        raise ValueError(
            "Table 3 does not contain a drug name column. "
            "Expected one of: 'name' or 'minConcept.name'."
        )

    return (
        table3_df[name_column]
        .dropna()
        .astype(str)
        .str.strip()
        .loc[lambda s: s != ""]
        .drop_duplicates()
        .tolist()
    )



def get_unique_rxcuis_from_tables_1_3_4(
    table1_df: pd.DataFrame,
    table3_df: pd.DataFrame,
    table4_df: pd.DataFrame
) -> List[str]:
    """
    Gets all unique RXCUIs found across Table 1, Table 3, and Table 4.

    Table 1 expected RXCUI column:
    - rxcui

    Table 3 expected RXCUI columns may include:
    - api_rxcui
    - minConcept.rxcui
    - rxcui

    Table 4 expected RXCUI columns may include:
    - minConcept.rxcui
    - rxcui

    Returns a sorted list of unique RXCUIs as strings with leading zeros preserved.
    """
    rxcui_values = []

    table_column_map = {
        "Table1": {
            "df": table1_df,
            "columns": ["rxcui"]
        },
        "Table3": {
            "df": table3_df,
            "columns": ["api_rxcui", "minConcept.rxcui", "rxcui"]
        },
        "Table4": {
            "df": table4_df,
            "columns": ["minConcept.rxcui", "rxcui"]
        }
    }

    for table_info in table_column_map.values():
        df = table_info["df"]

        if df is None or df.empty:
            continue

        for col in table_info["columns"]:
            if col in df.columns:
                values = (
                    df[col]
                    .dropna()
                    .astype(str)
                    .str.strip()
                    .loc[lambda s: s != ""]
                    .tolist()
                )

                rxcui_values.extend(values)

    unique_rxcuis = sorted(list(set(preserve_leading_zeros(value) for value in rxcui_values if str(value).strip() != "")))

    return unique_rxcuis



def get_unique_ingredient_names_from_table3(table3_df: pd.DataFrame) -> List[str]:
    """
    Gets distinct ingredient names from Table 3 where minConcept.tty = IN.

    Expected Table 3 columns:
    - minConcept.tty
    - minConcept.name

    The function is schema-tolerant and also checks fallback columns:
    - tty
    - name
    """
    if table3_df is None or table3_df.empty:
        return []

    df = table3_df.copy()
    df = preserve_dataframe_leading_zeros(df)

    tty_column = None
    name_column = None

    possible_tty_columns = [
        "minConcept.tty",
        "tty"
    ]

    possible_name_columns = [
        "minConcept.name",
        "name"
    ]

    for col in possible_tty_columns:
        if col in df.columns:
            tty_column = col
            break

    for col in possible_name_columns:
        if col in df.columns:
            name_column = col
            break

    if tty_column is None:
        tty_like_columns = [
            col for col in df.columns
            if col.lower() == "tty" or col.lower().endswith(".tty")
        ]

        if tty_like_columns:
            tty_column = tty_like_columns[0]

    if name_column is None:
        name_like_columns = [
            col for col in df.columns
            if col.lower() == "name" or col.lower().endswith(".name")
        ]

        if name_like_columns:
            name_column = name_like_columns[0]

    if tty_column is None or name_column is None:
        print(
            "Table 8 ingredient-name extraction skipped because Table 3 does not contain "
            "the expected minConcept.tty and minConcept.name fields."
        )
        return []

    ingredient_df = df[
        df[tty_column]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
        == "IN"
    ].copy()

    ingredient_names = (
        ingredient_df[name_column]
        .dropna()
        .astype(str)
        .str.strip()
        .loc[lambda s: s != ""]
        .drop_duplicates()
        .tolist()
    )

    ingredient_names = sorted(list(set(
        preserve_leading_zeros(name)
        for name in ingredient_names
        if str(name).strip() != ""
    )))

    return ingredient_names


# ============================================================
# Step 2A: Table 1 - RxTerms getAllRxTermsProducts
# ============================================================

def pull_table1_rxterms_products(
    raw_data_folder: Path,
    cache_folder: Path,
    session: requests.Session
) -> pd.DataFrame:
    """
    Table 1 behavior:
    - Always calls the full API every run.
    - Saves current API pull to Raw Data Files.
    - Compares current RXCUIs against prior Table1 cache.
    - Produces added / removed / unchanged RXCUI delta files.
    - Updates Table1_cache.csv.
    """
    table_name = "Table1"
    cache_file_name = "Table1_cache.csv"
    cache_key = "rxcui"

    step_name = "Table 1 API - getAllRxTermsProducts"
    url = "https://rxnav.nlm.nih.gov/REST/RxTerms/allconcepts.json"
    step_start_time = time.time()

    prior_cache_df = load_cache(
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        required_columns=[cache_key]
    )

    prior_rxcuis = get_cached_values(prior_cache_df, cache_key)

    print(f"\nCalling {step_name}...")
    print_progress_bar(step_name, completed=0, total=1, start_time=step_start_time)

    data, failure = adaptive_get_json(
        session=session,
        url=url,
        step_name=step_name,
        identifier="allconcepts"
    )

    if failure:
        print_progress_bar(step_name, completed=1, total=1, start_time=step_start_time)

        save_failures_if_any(
            failures=[failure],
            raw_data_folder=raw_data_folder,
            file_name="Table1_RxTerms_getAllRxTermsProducts_failures.csv"
        )

        create_cache_audit_file(
            table_name=table_name,
            raw_data_folder=raw_data_folder,
            total_input_values=1,
            values_already_cached=len(prior_rxcuis),
            values_newly_pulled=0,
            api_failures=1,
            final_cache_row_count=len(prior_cache_df),
            extra_metrics={
                "newly_added_rxcuis": 0,
                "removed_rxcuis": 0,
                "unchanged_rxcuis": 0
            }
        )

        print("Table 1 API failed, but the program did not crash.")
        return prior_cache_df

    records = (
        data
        .get("minConceptGroup", {})
        .get("minConcept", [])
    )

    table1_df = pd.json_normalize(records)
    table1_df = preserve_dataframe_leading_zeros(table1_df)

    print_progress_bar(step_name, completed=1, total=1, start_time=step_start_time)

    save_raw_api_file(
        df=table1_df,
        raw_data_folder=raw_data_folder,
        file_name="Table1_RxTerms_getAllRxTermsProducts.csv"
    )

    current_rxcuis = set(get_unique_rxcuis_from_table1(table1_df))

    newly_added_rxcuis = sorted(list(current_rxcuis - prior_rxcuis))
    removed_rxcuis = sorted(list(prior_rxcuis - current_rxcuis))
    unchanged_rxcuis = sorted(list(current_rxcuis & prior_rxcuis))

    save_delta_values(
        values=newly_added_rxcuis,
        raw_data_folder=raw_data_folder,
        file_name="Table1_newly_added_rxcuis.csv",
        column_name="rxcui"
    )

    save_delta_values(
        values=removed_rxcuis,
        raw_data_folder=raw_data_folder,
        file_name="Table1_removed_rxcuis.csv",
        column_name="rxcui"
    )

    save_delta_values(
        values=unchanged_rxcuis,
        raw_data_folder=raw_data_folder,
        file_name="Table1_unchanged_rxcuis.csv",
        column_name="rxcui"
    )

    final_cache_df = append_and_dedupe_cache(
        existing_cache_df=pd.DataFrame(),
        new_df=table1_df,
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        dedupe_key_columns=[cache_key]
    )

    create_cache_audit_file(
        table_name=table_name,
        raw_data_folder=raw_data_folder,
        total_input_values=len(current_rxcuis),
        values_already_cached=len(unchanged_rxcuis),
        values_newly_pulled=len(newly_added_rxcuis),
        api_failures=0,
        final_cache_row_count=len(final_cache_df),
        extra_metrics={
            "newly_added_rxcuis": len(newly_added_rxcuis),
            "removed_rxcuis": len(removed_rxcuis),
            "unchanged_rxcuis": len(unchanged_rxcuis)
        }
    )

    return table1_df


# ============================================================
# Step 2B: Table 2 - RxTerms getAllRxTermInfo
# ============================================================

def pull_table2_rxterm_info(
    table1_df: pd.DataFrame,
    raw_data_folder: Path,
    cache_folder: Path,
    session: requests.Session,
    sleep_seconds: float = 0.1
) -> pd.DataFrame:
    """
    Table 2 behavior:
    - Uses unique RXCUIs from Table1.
    - Loads Table2_cache.csv.
    - Only calls API for RXCUIs not already present in Table2 cache.
    - Saves new pull to Raw Data Files.
    - Appends new pull to Table2 cache and deduplicates by api_rxcui.
    """
    table_name = "Table2"
    cache_file_name = "Table2_cache.csv"
    cache_key = "api_rxcui"

    step_name = "Table 2 API - getAllRxTermInfo"
    step_start_time = time.time()

    input_rxcuis = get_unique_rxcuis_from_table1(table1_df)
    total_input_values = len(input_rxcuis)

    cache_df = load_cache(
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        required_columns=[cache_key]
    )

    cached_rxcuis = get_cached_values(cache_df, cache_key)

    rxcuis_to_call = [
        rxcui for rxcui in input_rxcuis
        if preserve_leading_zeros(rxcui) not in cached_rxcuis
    ]

    already_cached_count = total_input_values - len(rxcuis_to_call)

    if not input_rxcuis:
        print("Table 2 skipped because no RXCUIs were available from Table 1.")

        create_cache_audit_file(
            table_name=table_name,
            raw_data_folder=raw_data_folder,
            total_input_values=0,
            values_already_cached=0,
            values_newly_pulled=0,
            api_failures=0,
            final_cache_row_count=len(cache_df)
        )

        return cache_df

    if not rxcuis_to_call:
        print("\nTable 2 API - All RXCUIs are already present in cache. No API calls needed.")

        save_raw_api_file(
            df=pd.DataFrame(),
            raw_data_folder=raw_data_folder,
            file_name="Table2_RxTerms_getAllRxTermInfo_new_pull.csv"
        )

        create_cache_audit_file(
            table_name=table_name,
            raw_data_folder=raw_data_folder,
            total_input_values=total_input_values,
            values_already_cached=already_cached_count,
            values_newly_pulled=0,
            api_failures=0,
            final_cache_row_count=len(cache_df)
        )

        return cache_df

    total_to_call = len(rxcuis_to_call)

    print(f"\nCalling {step_name} for {total_to_call:,} uncached RXCUIs out of {total_input_values:,} total RXCUIs...")
    print_progress_bar(
        step_name=step_name,
        completed=0,
        total=total_to_call,
        start_time=step_start_time
    )

    all_records = []
    failed_records = []

    for i, rxcui in enumerate(rxcuis_to_call, start=1):
        rxcui = preserve_leading_zeros(rxcui)

        url = f"https://rxnav.nlm.nih.gov/REST/RxTerms/rxcui/{rxcui}/allinfo.json"

        data, failure = adaptive_get_json(
            session=session,
            url=url,
            step_name=step_name,
            identifier=rxcui
        )

        if failure:
            failed_records.append(failure)
        else:
            record = data.get("rxtermsProperties", {})

            if record:
                cleaned_record = preserve_nested_values(record)
                cleaned_record["api_rxcui"] = preserve_leading_zeros(rxcui)
                all_records.append(cleaned_record)
            else:
                failed_records.append({
                    "step_name": step_name,
                    "identifier": rxcui,
                    "url": url,
                    "status_code": "200",
                    "attempts": "1",
                    "error_type": "NO_RXTERMS_PROPERTIES_RETURNED",
                    "error": "No rxtermsProperties returned"
                })

        print_progress_bar(
            step_name=step_name,
            completed=i,
            total=total_to_call,
            start_time=step_start_time
        )

        time.sleep(sleep_seconds)

    new_pull_df = pd.json_normalize(all_records)
    new_pull_df = preserve_dataframe_leading_zeros(new_pull_df)

    save_raw_api_file(
        df=new_pull_df,
        raw_data_folder=raw_data_folder,
        file_name="Table2_RxTerms_getAllRxTermInfo_new_pull.csv"
    )

    # Also save an all-available file for the run, combining cache + new pull after update.
    final_cache_df = append_and_dedupe_cache(
        existing_cache_df=cache_df,
        new_df=new_pull_df,
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        dedupe_key_columns=[cache_key]
    )

    save_raw_api_file(
        df=final_cache_df,
        raw_data_folder=raw_data_folder,
        file_name="Table2_RxTerms_getAllRxTermInfo.csv"
    )

    save_failures_if_any(
        failures=failed_records,
        raw_data_folder=raw_data_folder,
        file_name="Table2_RxTerms_getAllRxTermInfo_failures.csv"
    )

    create_cache_audit_file(
        table_name=table_name,
        raw_data_folder=raw_data_folder,
        total_input_values=total_input_values,
        values_already_cached=already_cached_count,
        values_newly_pulled=len(new_pull_df),
        api_failures=len(failed_records),
        final_cache_row_count=len(final_cache_df)
    )

    print("Table 2 API connection step complete.")
    print(f"Table 2 new successful record count: {len(new_pull_df):,}")
    print(f"Table 2 failed RXCUI count: {len(failed_records):,}")

    return final_cache_df


# ============================================================
# Step 2C: Table 3 - RxClass getClassByRxNormDrugId
# ============================================================

def pull_table3_rxclass_get_class_by_rxnorm_drug_id(
    table1_df: pd.DataFrame,
    raw_data_folder: Path,
    cache_folder: Path,
    session: requests.Session,
    sleep_seconds: float = 0.1
) -> pd.DataFrame:
    """
    Table 3 behavior:
    - Uses unique RXCUIs from Table1.
    - Loads Table3_cache.csv.
    - Only calls API for RXCUIs not already present in Table3 cache.
    - Saves new pull to Raw Data Files.
    - Appends new pull to Table3 cache and deduplicates by:
      api_rxcui + rxclassMinConceptItem.classId + rela + relaSource
    """
    table_name = "Table3"
    cache_file_name = "Table3_cache.csv"
    cache_pull_key = "api_rxcui"
    dedupe_keys = [
        "api_rxcui",
        "rxclassMinConceptItem.classId",
        "rela",
        "relaSource"
    ]

    step_name = "Table 3 API - RxClass getClassByRxNormDrugId"
    step_start_time = time.time()

    input_rxcuis = get_unique_rxcuis_from_table1(table1_df)
    total_input_values = len(input_rxcuis)

    cache_df = load_cache(
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        required_columns=dedupe_keys
    )

    cached_rxcuis = get_cached_values(cache_df, cache_pull_key)

    rxcuis_to_call = [
        rxcui for rxcui in input_rxcuis
        if preserve_leading_zeros(rxcui) not in cached_rxcuis
    ]

    already_cached_count = total_input_values - len(rxcuis_to_call)

    if not input_rxcuis:
        print("Table 3 skipped because no RXCUIs were available from Table 1.")

        create_cache_audit_file(
            table_name=table_name,
            raw_data_folder=raw_data_folder,
            total_input_values=0,
            values_already_cached=0,
            values_newly_pulled=0,
            api_failures=0,
            final_cache_row_count=len(cache_df)
        )

        return cache_df

    if not rxcuis_to_call:
        print("\nTable 3 API - All RXCUIs are already present in cache. No API calls needed.")

        save_raw_api_file(
            df=pd.DataFrame(),
            raw_data_folder=raw_data_folder,
            file_name="Table3_RxClass_getClassbyRxNormDrugId_new_pull.csv"
        )

        create_cache_audit_file(
            table_name=table_name,
            raw_data_folder=raw_data_folder,
            total_input_values=total_input_values,
            values_already_cached=already_cached_count,
            values_newly_pulled=0,
            api_failures=0,
            final_cache_row_count=len(cache_df)
        )

        return cache_df

    total_to_call = len(rxcuis_to_call)

    print(f"\nCalling {step_name} for {total_to_call:,} uncached RXCUIs out of {total_input_values:,} total RXCUIs...")
    print_progress_bar(
        step_name=step_name,
        completed=0,
        total=total_to_call,
        start_time=step_start_time
    )

    all_records = []
    failed_records = []

    base_url = "https://rxnav.nlm.nih.gov/REST/rxclass/class/byRxcui.json"

    for i, rxcui in enumerate(rxcuis_to_call, start=1):
        rxcui = preserve_leading_zeros(rxcui)

        params = {
            "rxcui": rxcui
        }

        data, failure = adaptive_get_json(
            session=session,
            url=base_url,
            params=params,
            step_name=step_name,
            identifier=rxcui
        )

        if failure:
            failed_records.append(failure)
        else:
            rxclass_info = (
                data
                .get("rxclassDrugInfoList", {})
                .get("rxclassDrugInfo", [])
            )

            if isinstance(rxclass_info, dict):
                rxclass_info = [rxclass_info]

            if rxclass_info:
                for record in rxclass_info:
                    record = preserve_nested_values(record)
                    record["api_rxcui"] = preserve_leading_zeros(rxcui)
                    all_records.append(record)
            else:
                failed_records.append({
                    "step_name": step_name,
                    "identifier": rxcui,
                    "url": f"{base_url}?rxcui={rxcui}",
                    "status_code": "200",
                    "attempts": "1",
                    "error_type": "NO_RXCLASS_DRUG_INFO_RETURNED",
                    "error": "No rxclassDrugInfo returned"
                })

        print_progress_bar(
            step_name=step_name,
            completed=i,
            total=total_to_call,
            start_time=step_start_time
        )

        time.sleep(sleep_seconds)

    new_pull_df = pd.json_normalize(all_records)
    new_pull_df = preserve_dataframe_leading_zeros(new_pull_df)

    save_raw_api_file(
        df=new_pull_df,
        raw_data_folder=raw_data_folder,
        file_name="Table3_RxClass_getClassbyRxNormDrugId_new_pull.csv"
    )

    final_cache_df = append_and_dedupe_cache(
        existing_cache_df=cache_df,
        new_df=new_pull_df,
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        dedupe_key_columns=dedupe_keys
    )

    save_raw_api_file(
        df=final_cache_df,
        raw_data_folder=raw_data_folder,
        file_name="Table3_RxClass_getClassbyRxNormDrugId.csv"
    )

    save_failures_if_any(
        failures=failed_records,
        raw_data_folder=raw_data_folder,
        file_name="Table3_RxClass_getClassbyRxNormDrugId_failures.csv"
    )

    create_cache_audit_file(
        table_name=table_name,
        raw_data_folder=raw_data_folder,
        total_input_values=total_input_values,
        values_already_cached=already_cached_count,
        values_newly_pulled=len(new_pull_df),
        api_failures=len(failed_records),
        final_cache_row_count=len(final_cache_df)
    )

    print("Table 3 API connection step complete.")
    print(f"Table 3 new successful record count: {len(new_pull_df):,}")
    print(f"Table 3 failed RXCUI count: {len(failed_records):,}")

    return final_cache_df


# ============================================================
# Step 2D: Table 4 - RxClass getClassByRxNormDrugName
# ============================================================

def pull_table4_rxclass_get_class_by_rxnorm_drug_name(
    table3_df: pd.DataFrame,
    raw_data_folder: Path,
    cache_folder: Path,
    session: requests.Session,
    sleep_seconds: float = 0.1
) -> pd.DataFrame:
    """
    Table 4 behavior:
    - Uses unique drug names from Table3.
    - Loads Table4_cache.csv.
    - Only calls API for drug names not already present in Table4 cache.
    - Saves new pull to Raw Data Files.
    - Appends new pull to Table4 cache and deduplicates by:
      api_drugName + rxclassMinConceptItem.classId + rela + relaSource
    """
    table_name = "Table4"
    cache_file_name = "Table4_cache.csv"
    cache_pull_key = "api_drugName"
    dedupe_keys = [
        "api_drugName",
        "rxclassMinConceptItem.classId",
        "rela",
        "relaSource"
    ]

    step_name = "Table 4 API - RxClass getClassByRxNormDrugName"
    step_start_time = time.time()

    drug_names = get_unique_drug_names_from_table3(table3_df)
    total_input_values = len(drug_names)

    cache_df = load_cache(
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        required_columns=dedupe_keys
    )

    cached_drug_names = get_cached_values(cache_df, cache_pull_key)

    drug_names_to_call = [
        drug_name for drug_name in drug_names
        if preserve_leading_zeros(drug_name) not in cached_drug_names
    ]

    already_cached_count = total_input_values - len(drug_names_to_call)

    if not drug_names:
        print("Table 4 skipped because no drug names were available from Table 3.")

        create_cache_audit_file(
            table_name=table_name,
            raw_data_folder=raw_data_folder,
            total_input_values=0,
            values_already_cached=0,
            values_newly_pulled=0,
            api_failures=0,
            final_cache_row_count=len(cache_df)
        )

        return cache_df

    if not drug_names_to_call:
        print("\nTable 4 API - All drug names are already present in cache. No API calls needed.")

        save_raw_api_file(
            df=pd.DataFrame(),
            raw_data_folder=raw_data_folder,
            file_name="Table4_RxClass_getClassByRxNormDrugName_new_pull.csv"
        )

        create_cache_audit_file(
            table_name=table_name,
            raw_data_folder=raw_data_folder,
            total_input_values=total_input_values,
            values_already_cached=already_cached_count,
            values_newly_pulled=0,
            api_failures=0,
            final_cache_row_count=len(cache_df)
        )

        return cache_df

    total_to_call = len(drug_names_to_call)

    print(f"\nCalling {step_name} for {total_to_call:,} uncached drug names out of {total_input_values:,} total drug names...")
    print_progress_bar(
        step_name=step_name,
        completed=0,
        total=total_to_call,
        start_time=step_start_time
    )

    all_records = []
    failed_records = []

    base_url = "https://rxnav.nlm.nih.gov/REST/rxclass/class/byDrugName.json"

    for i, drug_name in enumerate(drug_names_to_call, start=1):
        drug_name = preserve_leading_zeros(drug_name)

        params = {
            "drugName": drug_name
        }

        data, failure = adaptive_get_json(
            session=session,
            url=base_url,
            params=params,
            step_name=step_name,
            identifier=drug_name
        )

        if failure:
            failed_records.append(failure)
        else:
            rxclass_info = (
                data
                .get("rxclassDrugInfoList", {})
                .get("rxclassDrugInfo", [])
            )

            if isinstance(rxclass_info, dict):
                rxclass_info = [rxclass_info]

            if rxclass_info:
                for record in rxclass_info:
                    record = preserve_nested_values(record)
                    record["api_drugName"] = preserve_leading_zeros(drug_name)
                    all_records.append(record)
            else:
                failed_records.append({
                    "step_name": step_name,
                    "identifier": drug_name,
                    "url": f"{base_url}?drugName={drug_name}",
                    "status_code": "200",
                    "attempts": "1",
                    "error_type": "NO_RXCLASS_DRUG_INFO_RETURNED",
                    "error": "No rxclassDrugInfo returned"
                })

        print_progress_bar(
            step_name=step_name,
            completed=i,
            total=total_to_call,
            start_time=step_start_time
        )

        time.sleep(sleep_seconds)

    new_pull_df = pd.json_normalize(all_records)
    new_pull_df = preserve_dataframe_leading_zeros(new_pull_df)

    save_raw_api_file(
        df=new_pull_df,
        raw_data_folder=raw_data_folder,
        file_name="Table4_RxClass_getClassByRxNormDrugName_new_pull.csv"
    )

    final_cache_df = append_and_dedupe_cache(
        existing_cache_df=cache_df,
        new_df=new_pull_df,
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        dedupe_key_columns=dedupe_keys
    )

    save_raw_api_file(
        df=final_cache_df,
        raw_data_folder=raw_data_folder,
        file_name="Table4_RxClass_getClassByRxNormDrugName.csv"
    )

    save_failures_if_any(
        failures=failed_records,
        raw_data_folder=raw_data_folder,
        file_name="Table4_RxClass_getClassByRxNormDrugName_failures.csv"
    )

    create_cache_audit_file(
        table_name=table_name,
        raw_data_folder=raw_data_folder,
        total_input_values=total_input_values,
        values_already_cached=already_cached_count,
        values_newly_pulled=len(new_pull_df),
        api_failures=len(failed_records),
        final_cache_row_count=len(final_cache_df)
    )

    print("Table 4 API connection step complete.")
    print(f"Table 4 new successful record count: {len(new_pull_df):,}")
    print(f"Table 4 failed drug name count: {len(failed_records):,}")

    return final_cache_df



# ============================================================
# Step 2E: Table 5 - RxClass getAllClasses
# ============================================================

def pull_table5_rxclass_get_all_classes(
    raw_data_folder: Path,
    cache_folder: Path,
    session: requests.Session
) -> pd.DataFrame:
    """
    Table 5 behavior:
    - Calls the RxClass getAllClasses API every run.
    - Pulls all available class information using default classTypes = ALL.
    - Saves the current API pull to Raw Data Files.
    - Compares current classIds against prior Table5 cache.
    - Produces added / removed / unchanged classId delta files.
    - Updates Table5_cache.csv and deduplicates by classId.
    - Creates a Table5 cache audit file.

    Endpoint:
    https://rxnav.nlm.nih.gov/REST/rxclass/allClasses.json

    Optional parameter intentionally omitted:
    - classTypes = ALL
    """
    table_name = "Table5"
    cache_file_name = "Table5_cache.csv"
    cache_key = "classId"

    step_name = "Table 5 API - RxClass getAllClasses"
    url = "https://rxnav.nlm.nih.gov/REST/rxclass/allClasses.json"
    step_start_time = time.time()

    prior_cache_df = load_cache(
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        required_columns=[cache_key]
    )

    prior_class_ids = get_cached_values(prior_cache_df, cache_key)

    print(f"\nCalling {step_name}...")
    print_progress_bar(step_name, completed=0, total=1, start_time=step_start_time)

    data, failure = adaptive_get_json(
        session=session,
        url=url,
        step_name=step_name,
        identifier="allClasses"
    )

    if failure:
        print_progress_bar(step_name, completed=1, total=1, start_time=step_start_time)

        save_failures_if_any(
            failures=[failure],
            raw_data_folder=raw_data_folder,
            file_name="Table5_RxClass_getAllClasses_failures.csv"
        )

        create_cache_audit_file(
            table_name=table_name,
            raw_data_folder=raw_data_folder,
            total_input_values=1,
            values_already_cached=len(prior_class_ids),
            values_newly_pulled=0,
            api_failures=1,
            final_cache_row_count=len(prior_cache_df),
            extra_metrics={
                "newly_added_classIds": 0,
                "removed_classIds": 0,
                "unchanged_classIds": 0
            }
        )

        print("Table 5 API failed, but the program did not crash.")
        return prior_cache_df

    # Expected JSON structure:
    # {
    #   "rxclassMinConceptList": {
    #       "rxclassMinConcept": [
    #           {
    #               "classId": "...",
    #               "className": "...",
    #               "classType": "...",
    #               "classUrl": "..."
    #           }
    #       ]
    #   }
    # }
    records = (
        data
        .get("rxclassMinConceptList", {})
        .get("rxclassMinConcept", [])
    )

    if isinstance(records, dict):
        records = [records]

    table5_df = pd.json_normalize(records)
    table5_df = preserve_dataframe_leading_zeros(table5_df)

    print_progress_bar(step_name, completed=1, total=1, start_time=step_start_time)

    save_raw_api_file(
        df=table5_df,
        raw_data_folder=raw_data_folder,
        file_name="Table5_RxClass_getAllClasses.csv"
    )

    if cache_key not in table5_df.columns:
        table5_df[cache_key] = ""

    current_class_ids = set(
        table5_df[cache_key]
        .dropna()
        .astype(str)
        .str.strip()
        .loc[lambda s: s != ""]
        .tolist()
    )

    newly_added_class_ids = sorted(list(current_class_ids - prior_class_ids))
    removed_class_ids = sorted(list(prior_class_ids - current_class_ids))
    unchanged_class_ids = sorted(list(current_class_ids & prior_class_ids))

    save_delta_values(
        values=newly_added_class_ids,
        raw_data_folder=raw_data_folder,
        file_name="Table5_newly_added_classIds.csv",
        column_name="classId"
    )

    save_delta_values(
        values=removed_class_ids,
        raw_data_folder=raw_data_folder,
        file_name="Table5_removed_classIds.csv",
        column_name="classId"
    )

    save_delta_values(
        values=unchanged_class_ids,
        raw_data_folder=raw_data_folder,
        file_name="Table5_unchanged_classIds.csv",
        column_name="classId"
    )

    final_cache_df = append_and_dedupe_cache(
        existing_cache_df=pd.DataFrame(),
        new_df=table5_df,
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        dedupe_key_columns=[cache_key]
    )

    create_cache_audit_file(
        table_name=table_name,
        raw_data_folder=raw_data_folder,
        total_input_values=len(current_class_ids),
        values_already_cached=len(unchanged_class_ids),
        values_newly_pulled=len(newly_added_class_ids),
        api_failures=0,
        final_cache_row_count=len(final_cache_df),
        extra_metrics={
            "newly_added_classIds": len(newly_added_class_ids),
            "removed_classIds": len(removed_class_ids),
            "unchanged_classIds": len(unchanged_class_ids)
        }
    )

    print("Table 5 API connection step complete.")
    print(f"Table 5 final row count: {len(table5_df):,}")
    print(f"Table 5 newly added classId count: {len(newly_added_class_ids):,}")
    print(f"Table 5 removed classId count: {len(removed_class_ids):,}")
    print(f"Table 5 unchanged classId count: {len(unchanged_class_ids):,}")

    return table5_df



# ============================================================
# Step 2F: Table 6 - RxNorm getNDCProperties
# ============================================================

def pull_table6_rxnorm_get_ndc_properties(
    table1_df: pd.DataFrame,
    table3_df: pd.DataFrame,
    table4_df: pd.DataFrame,
    raw_data_folder: Path,
    cache_folder: Path,
    session: requests.Session,
    sleep_seconds: float = 0.1
) -> pd.DataFrame:
    """
    Table 6 behavior:
    - Builds a master list of unique RXCUIs from Tables 1, 3, and 4.
    - Uses each RXCUI as the required id field in the RxNorm getNDCProperties API.
    - Sets ndcstatus=all so active, obsolete, alien, and any available NDC statuses are returned.
    - Loads Table6_cache.csv.
    - Only calls API for RXCUIs not already present in Table6 cache.
    - Saves the new pull to Raw Data Files.
    - Appends new pull to Table6 cache and deduplicates by:
      api_id + ndcItem + rxcui + ndc9 + ndc10 + splSetIdItem + source
    - Creates a Table6 cache audit file.

    Endpoint:
    https://rxnav.nlm.nih.gov/REST/ndcproperties.json?id={RXCUI}&ndcstatus=all
    """
    table_name = "Table6"
    cache_file_name = "Table6_cache.csv"
    cache_pull_key = "api_id"

    # These keys are intentionally broad enough to preserve multiple NDC/RXCUI combinations.
    # propertyConceptList and packagingList can expand into nested fields after normalization,
    # but these core fields are consistently expected from the API output structure.
    dedupe_keys = [
        "api_id",
        "ndcItem",
        "rxcui",
        "ndc9",
        "ndc10",
        "splSetIdItem",
        "source"
    ]

    step_name = "Table 6 API - RxNorm getNDCProperties"
    step_start_time = time.time()

    input_rxcuis = get_unique_rxcuis_from_tables_1_3_4(
        table1_df=table1_df,
        table3_df=table3_df,
        table4_df=table4_df
    )

    total_input_values = len(input_rxcuis)

    cache_df = load_cache(
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        required_columns=dedupe_keys
    )

    cached_ids = get_cached_values(cache_df, cache_pull_key)

    rxcuis_to_call = [
        rxcui for rxcui in input_rxcuis
        if preserve_leading_zeros(rxcui) not in cached_ids
    ]

    already_cached_count = total_input_values - len(rxcuis_to_call)

    if not input_rxcuis:
        print("Table 6 skipped because no RXCUIs were available from Tables 1, 3, or 4.")

        create_cache_audit_file(
            table_name=table_name,
            raw_data_folder=raw_data_folder,
            total_input_values=0,
            values_already_cached=0,
            values_newly_pulled=0,
            api_failures=0,
            final_cache_row_count=len(cache_df)
        )

        return cache_df

    if not rxcuis_to_call:
        print("\nTable 6 API - All RXCUIs are already present in cache. No API calls needed.")

        save_raw_api_file(
            df=pd.DataFrame(),
            raw_data_folder=raw_data_folder,
            file_name="Table6_RxNorm_getNDCProperties_new_pull.csv"
        )

        save_raw_api_file(
            df=cache_df,
            raw_data_folder=raw_data_folder,
            file_name="Table6_RxNorm_getNDCProperties.csv"
        )

        create_cache_audit_file(
            table_name=table_name,
            raw_data_folder=raw_data_folder,
            total_input_values=total_input_values,
            values_already_cached=already_cached_count,
            values_newly_pulled=0,
            api_failures=0,
            final_cache_row_count=len(cache_df)
        )

        return cache_df

    total_to_call = len(rxcuis_to_call)

    print(f"\nCalling {step_name} for {total_to_call:,} uncached RXCUIs out of {total_input_values:,} total RXCUIs...")
    print_progress_bar(
        step_name=step_name,
        completed=0,
        total=total_to_call,
        start_time=step_start_time
    )

    all_records = []
    failed_records = []

    base_url = "https://rxnav.nlm.nih.gov/REST/ndcproperties.json"

    for i, rxcui in enumerate(rxcuis_to_call, start=1):
        rxcui = preserve_leading_zeros(rxcui)

        params = {
            "id": rxcui,
            "ndcstatus": "all"
        }

        data, failure = adaptive_get_json(
            session=session,
            url=base_url,
            params=params,
            step_name=step_name,
            identifier=rxcui
        )

        if failure:
            failed_records.append(failure)
        else:
            # Expected JSON structure:
            # {
            #   "ndcPropertyList": {
            #       "ndcProperty": [
            #           {
            #               "ndcItem": "...",
            #               "ndc9": "...",
            #               "ndc10": "...",
            #               "rxcui": "...",
            #               "splSetIdItem": "...",
            #               "packagingList": {...},
            #               "propertyConceptList": {...},
            #               "source": "..."
            #           }
            #       ]
            #   }
            # }
            ndc_properties = (
                data
                .get("ndcPropertyList", {})
                .get("ndcProperty", [])
            )

            if isinstance(ndc_properties, dict):
                ndc_properties = [ndc_properties]

            if ndc_properties:
                for record in ndc_properties:
                    record = preserve_nested_values(record)
                    record["api_id"] = preserve_leading_zeros(rxcui)
                    record["api_ndcstatus"] = "all"
                    all_records.append(record)
            else:
                failed_records.append({
                    "step_name": step_name,
                    "identifier": rxcui,
                    "url": f"{base_url}?id={rxcui}&ndcstatus=all",
                    "status_code": "200",
                    "attempts": "1",
                    "error_type": "NO_NDC_PROPERTIES_RETURNED",
                    "error": "No ndcProperty returned"
                })

        print_progress_bar(
            step_name=step_name,
            completed=i,
            total=total_to_call,
            start_time=step_start_time
        )

        time.sleep(sleep_seconds)

    new_pull_df = pd.json_normalize(all_records)
    new_pull_df = preserve_dataframe_leading_zeros(new_pull_df)

    save_raw_api_file(
        df=new_pull_df,
        raw_data_folder=raw_data_folder,
        file_name="Table6_RxNorm_getNDCProperties_new_pull.csv"
    )

    final_cache_df = append_and_dedupe_cache(
        existing_cache_df=cache_df,
        new_df=new_pull_df,
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        dedupe_key_columns=dedupe_keys
    )

    save_raw_api_file(
        df=final_cache_df,
        raw_data_folder=raw_data_folder,
        file_name="Table6_RxNorm_getNDCProperties.csv"
    )

    save_failures_if_any(
        failures=failed_records,
        raw_data_folder=raw_data_folder,
        file_name="Table6_RxNorm_getNDCProperties_failures.csv"
    )

    create_cache_audit_file(
        table_name=table_name,
        raw_data_folder=raw_data_folder,
        total_input_values=total_input_values,
        values_already_cached=already_cached_count,
        values_newly_pulled=len(new_pull_df),
        api_failures=len(failed_records),
        final_cache_row_count=len(final_cache_df),
        extra_metrics={
            "unique_rxcuis_from_tables_1_3_4": total_input_values,
            "uncached_rxcuis_called": total_to_call
        }
    )

    print("Table 6 API connection step complete.")
    print(f"Table 6 new successful record count: {len(new_pull_df):,}")
    print(f"Table 6 failed RXCUI count: {len(failed_records):,}")

    return final_cache_df




# ============================================================
# Step 2G: Table 7 - RxNorm getRxNormName
# ============================================================

def pull_table7_rxnorm_get_rxnorm_name(
    table1_df: pd.DataFrame,
    table2_df: pd.DataFrame,
    table3_df: pd.DataFrame,
    table4_df: pd.DataFrame,
    table5_df: pd.DataFrame,
    table6_df: pd.DataFrame,
    raw_data_folder: Path,
    cache_folder: Path,
    session: requests.Session,
    sleep_seconds: float = 0.1
) -> pd.DataFrame:
    """
    Table 7 behavior:
    - Builds the same final master RXCUI list used in Step 3.
    - Uses each unique RXCUI as the required rxcui path parameter in the RxNorm getRxNormName API.
    - Loads Table7_cache.csv.
    - Only calls API for RXCUIs not already present in Table7 cache.
    - Saves the new pull to Raw Data Files.
    - Appends new pull to Table7 cache and deduplicates by api_rxcui.
    - Creates a Table7 cache audit file.

    Endpoint:
    https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}.json

    Expected JSON structure:
    {
        "idGroup": {
            "name": "RxNorm concept name"
        }
    }
    """
    table_name = "Table7"
    cache_file_name = "Table7_cache.csv"
    cache_key = "api_rxcui"

    step_name = "Table 7 API - RxNorm getRxNormName"
    step_start_time = time.time()

    input_rxcuis = []

    input_rxcuis.extend(collect_unique_values_from_columns(table1_df, ["rxcui"]))
    input_rxcuis.extend(collect_unique_values_from_columns(table2_df, ["rxcui", "api_rxcui", "genericRxcui"]))
    input_rxcuis.extend(collect_unique_values_from_columns(table3_df, ["rxcui", "api_rxcui", "minConcept.rxcui"]))
    input_rxcuis.extend(collect_unique_values_from_columns(table4_df, ["rxcui", "minConcept.rxcui"]))
    input_rxcuis.extend(collect_unique_values_from_columns(table5_df, ["rxcui", "api_rxcui", "minConcept.rxcui"]))
    input_rxcuis.extend(collect_unique_values_from_columns(table6_df, ["rxcui", "api_id"]))

    input_rxcuis = sorted(list(set(
        preserve_leading_zeros(value)
        for value in input_rxcuis
        if str(value).strip() != ""
    )))

    total_input_values = len(input_rxcuis)

    cache_df = load_cache(
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        required_columns=[cache_key]
    )

    cached_rxcuis = get_cached_values(cache_df, cache_key)

    rxcuis_to_call = [
        rxcui for rxcui in input_rxcuis
        if preserve_leading_zeros(rxcui) not in cached_rxcuis
    ]

    already_cached_count = total_input_values - len(rxcuis_to_call)

    if not input_rxcuis:
        print("Table 7 skipped because no RXCUIs were available from the final master RXCUI logic.")

        create_cache_audit_file(
            table_name=table_name,
            raw_data_folder=raw_data_folder,
            total_input_values=0,
            values_already_cached=0,
            values_newly_pulled=0,
            api_failures=0,
            final_cache_row_count=len(cache_df)
        )

        return cache_df

    if not rxcuis_to_call:
        print("\nTable 7 API - All RXCUIs are already present in cache. No API calls needed.")

        save_raw_api_file(
            df=pd.DataFrame(),
            raw_data_folder=raw_data_folder,
            file_name="Table7_RxNorm_getRxNormName_new_pull.csv"
        )

        save_raw_api_file(
            df=cache_df,
            raw_data_folder=raw_data_folder,
            file_name="Table7_RxNorm_getRxNormName.csv"
        )

        create_cache_audit_file(
            table_name=table_name,
            raw_data_folder=raw_data_folder,
            total_input_values=total_input_values,
            values_already_cached=already_cached_count,
            values_newly_pulled=0,
            api_failures=0,
            final_cache_row_count=len(cache_df)
        )

        return cache_df

    total_to_call = len(rxcuis_to_call)

    print(f"\nCalling {step_name} for {total_to_call:,} uncached RXCUIs out of {total_input_values:,} total RXCUIs...")
    print_progress_bar(
        step_name=step_name,
        completed=0,
        total=total_to_call,
        start_time=step_start_time
    )

    all_records = []
    failed_records = []

    for i, rxcui in enumerate(rxcuis_to_call, start=1):
        rxcui = preserve_leading_zeros(rxcui)

        url = f"https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}.json"

        data, failure = adaptive_get_json(
            session=session,
            url=url,
            step_name=step_name,
            identifier=rxcui
        )

        if failure:
            failed_records.append(failure)
        else:
            id_group = data.get("idGroup", {})
            rxnorm_name = preserve_leading_zeros(id_group.get("name", ""))

            if rxnorm_name:
                all_records.append({
                    "api_rxcui": preserve_leading_zeros(rxcui),
                    "rxnormName": rxnorm_name
                })
            else:
                failed_records.append({
                    "step_name": step_name,
                    "identifier": rxcui,
                    "url": url,
                    "status_code": "200",
                    "attempts": "1",
                    "error_type": "NO_RXNORM_NAME_RETURNED",
                    "error": "No idGroup.name returned"
                })

        print_progress_bar(
            step_name=step_name,
            completed=i,
            total=total_to_call,
            start_time=step_start_time
        )

        time.sleep(sleep_seconds)

    new_pull_df = pd.DataFrame(all_records)
    new_pull_df = preserve_dataframe_leading_zeros(new_pull_df)

    save_raw_api_file(
        df=new_pull_df,
        raw_data_folder=raw_data_folder,
        file_name="Table7_RxNorm_getRxNormName_new_pull.csv"
    )

    final_cache_df = append_and_dedupe_cache(
        existing_cache_df=cache_df,
        new_df=new_pull_df,
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        dedupe_key_columns=[cache_key]
    )

    save_raw_api_file(
        df=final_cache_df,
        raw_data_folder=raw_data_folder,
        file_name="Table7_RxNorm_getRxNormName.csv"
    )

    save_failures_if_any(
        failures=failed_records,
        raw_data_folder=raw_data_folder,
        file_name="Table7_RxNorm_getRxNormName_failures.csv"
    )

    create_cache_audit_file(
        table_name=table_name,
        raw_data_folder=raw_data_folder,
        total_input_values=total_input_values,
        values_already_cached=already_cached_count,
        values_newly_pulled=len(new_pull_df),
        api_failures=len(failed_records),
        final_cache_row_count=len(final_cache_df),
        extra_metrics={
            "unique_rxcuis_from_final_master_logic": total_input_values,
            "uncached_rxcuis_called": total_to_call
        }
    )

    print("Table 7 API connection step complete.")
    print(f"Table 7 new successful record count: {len(new_pull_df):,}")
    print(f"Table 7 failed RXCUI count: {len(failed_records):,}")

    return final_cache_df



# ============================================================
# Step 2H: Table 8 - RxNorm getDrugs
# ============================================================

def pull_table8_rxnorm_get_drugs(
    table3_df: pd.DataFrame,
    raw_data_folder: Path,
    cache_folder: Path,
    session: requests.Session,
    sleep_seconds: float = 0.1
) -> pd.DataFrame:
    """
    Table 8 behavior:
    - Filters Table3_RxClass_getClassbyRxNormDrugId where minConcept.tty = "IN".
    - Selects distinct unique values of minConcept.name from that filtered Table3 data.
    - Uses each distinct ingredient name as the required name query parameter
      in the RxNorm getDrugs API.
    - Loads Table8_cache.csv.
    - Only calls API for ingredient names not already present in Table8 cache.
    - Saves the new pull to Raw Data Files.
    - Appends new pull to Table8 cache and deduplicates by:
      api_name + tty + rxcui + name + synonym + language + suppress + umlscui + psn.
    - Creates a Table8 cache audit file.

    Endpoint:
    https://rxnav.nlm.nih.gov/REST/drugs.json?name={ingredient_name}

    Optional expand parameter is intentionally omitted because the default API result
    already returns the fields shown in the documentation. If RxNav returns psn,
    this program captures it automatically.
    """
    table_name = "Table8"
    cache_file_name = "Table8_cache.csv"
    cache_pull_key = "api_name"

    dedupe_keys = [
        "api_name",
        "tty",
        "rxcui",
        "name",
        "synonym",
        "language",
        "suppress",
        "umlscui",
        "psn"
    ]

    step_name = "Table 8 API - RxNorm getDrugs"
    step_start_time = time.time()

    ingredient_names = get_unique_ingredient_names_from_table3(table3_df)
    total_input_values = len(ingredient_names)

    cache_df = load_cache(
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        required_columns=dedupe_keys
    )

    cached_names = get_cached_values(cache_df, cache_pull_key)

    names_to_call = [
        ingredient_name for ingredient_name in ingredient_names
        if preserve_leading_zeros(ingredient_name) not in cached_names
    ]

    already_cached_count = total_input_values - len(names_to_call)

    if not ingredient_names:
        print("Table 8 skipped because no ingredient names were available from Table 3 where minConcept.tty = IN.")

        create_cache_audit_file(
            table_name=table_name,
            raw_data_folder=raw_data_folder,
            total_input_values=0,
            values_already_cached=0,
            values_newly_pulled=0,
            api_failures=0,
            final_cache_row_count=len(cache_df)
        )

        return cache_df

    if not names_to_call:
        print("\nTable 8 API - All ingredient names are already present in cache. No API calls needed.")

        save_raw_api_file(
            df=pd.DataFrame(),
            raw_data_folder=raw_data_folder,
            file_name="Table8_RxNorm_getDrugs_new_pull.csv"
        )

        save_raw_api_file(
            df=cache_df,
            raw_data_folder=raw_data_folder,
            file_name="Table8_RxNorm_getDrugs.csv"
        )

        create_cache_audit_file(
            table_name=table_name,
            raw_data_folder=raw_data_folder,
            total_input_values=total_input_values,
            values_already_cached=already_cached_count,
            values_newly_pulled=0,
            api_failures=0,
            final_cache_row_count=len(cache_df)
        )

        return cache_df

    total_to_call = len(names_to_call)

    print(f"\nCalling {step_name} for {total_to_call:,} uncached ingredient names out of {total_input_values:,} total ingredient names...")
    print_progress_bar(
        step_name=step_name,
        completed=0,
        total=total_to_call,
        start_time=step_start_time
    )

    all_records = []
    failed_records = []

    base_url = "https://rxnav.nlm.nih.gov/REST/drugs.json"

    for i, ingredient_name in enumerate(names_to_call, start=1):
        ingredient_name = preserve_leading_zeros(ingredient_name)

        params = {
            "name": ingredient_name
        }

        data, failure = adaptive_get_json(
            session=session,
            url=base_url,
            params=params,
            step_name=step_name,
            identifier=ingredient_name
        )

        if failure:
            failed_records.append(failure)
        else:
            # Expected JSON structure:
            # {
            #   "drugGroup": {
            #       "name": "",
            #       "conceptGroup": [
            #           {
            #               "tty": "SCD",
            #               "conceptProperties": [
            #                   {
            #                       "rxcui": "...",
            #                       "name": "...",
            #                       "synonym": "...",
            #                       "tty": "...",
            #                       "language": "...",
            #                       "suppress": "...",
            #                       "umlscui": "...",
            #                       "psn": "..."
            #                   }
            #               ]
            #           }
            #       ]
            #   }
            # }
            concept_groups = (
                data
                .get("drugGroup", {})
                .get("conceptGroup", [])
            )

            if isinstance(concept_groups, dict):
                concept_groups = [concept_groups]

            records_found_for_name = 0

            for concept_group in concept_groups:
                group_tty = preserve_leading_zeros(concept_group.get("tty", ""))

                concept_properties = concept_group.get("conceptProperties", [])

                if isinstance(concept_properties, dict):
                    concept_properties = [concept_properties]

                for record in concept_properties:
                    record = preserve_nested_values(record)
                    record["api_name"] = ingredient_name
                    record["conceptGroup_tty"] = group_tty
                    all_records.append(record)
                    records_found_for_name += 1

            if records_found_for_name == 0:
                failed_records.append({
                    "step_name": step_name,
                    "identifier": ingredient_name,
                    "url": f"{base_url}?name={ingredient_name}",
                    "status_code": "200",
                    "attempts": "1",
                    "error_type": "NO_CONCEPT_PROPERTIES_RETURNED",
                    "error": "No drugGroup.conceptGroup.conceptProperties returned"
                })

        print_progress_bar(
            step_name=step_name,
            completed=i,
            total=total_to_call,
            start_time=step_start_time
        )

        time.sleep(sleep_seconds)

    new_pull_df = pd.json_normalize(all_records)
    new_pull_df = preserve_dataframe_leading_zeros(new_pull_df)

    # Make sure all dedupe columns exist, even if the API omits some optional fields.
    for col in dedupe_keys:
        if col not in new_pull_df.columns:
            new_pull_df[col] = ""

    save_raw_api_file(
        df=new_pull_df,
        raw_data_folder=raw_data_folder,
        file_name="Table8_RxNorm_getDrugs_new_pull.csv"
    )

    final_cache_df = append_and_dedupe_cache(
        existing_cache_df=cache_df,
        new_df=new_pull_df,
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        dedupe_key_columns=dedupe_keys
    )

    save_raw_api_file(
        df=final_cache_df,
        raw_data_folder=raw_data_folder,
        file_name="Table8_RxNorm_getDrugs.csv"
    )

    save_failures_if_any(
        failures=failed_records,
        raw_data_folder=raw_data_folder,
        file_name="Table8_RxNorm_getDrugs_failures.csv"
    )

    create_cache_audit_file(
        table_name=table_name,
        raw_data_folder=raw_data_folder,
        total_input_values=total_input_values,
        values_already_cached=already_cached_count,
        values_newly_pulled=len(new_pull_df),
        api_failures=len(failed_records),
        final_cache_row_count=len(final_cache_df),
        extra_metrics={
            "unique_ingredient_names_from_table3_where_tty_IN": total_input_values,
            "uncached_ingredient_names_called": total_to_call
        }
    )

    print("Table 8 API connection step complete.")
    print(f"Table 8 new successful record count: {len(new_pull_df):,}")
    print(f"Table 8 failed ingredient name count: {len(failed_records):,}")

    return final_cache_df


# ============================================================
# Step 3 Prompt Helper
# ============================================================

def ask_user_to_start_step3() -> str:
    """
    Displays a popup asking the user whether they are ready to start Step 3.

    Returns:
    - "Y" when the user selects yes
    - "N" when the user selects no or closes the popup
    """
    selection_result = {"value": "N"}

    step3_window = tk.Toplevel()
    step3_window.title("Step 3 Confirmation")
    step3_window.geometry("650x220")
    step3_window.resizable(False, False)

    # Bring the popup to the front.
    step3_window.lift()
    step3_window.attributes("-topmost", True)
    step3_window.after_idle(step3_window.attributes, "-topmost", False)

    message_label = tk.Label(
        step3_window,
        text=(
            "Raw Table builds are complete from RxTerms, RxClass & RxNorm.  "
            "Proceeding to Step 3: Merging Data Together. Are you ready to start Step 3?"
        ),
        wraplength=600,
        justify="left",
        padx=20,
        pady=20
    )
    message_label.pack()

    selected_value = tk.StringVar(value="Y")

    dropdown = tk.OptionMenu(step3_window, selected_value, "Y", "N")
    dropdown.config(width=10)
    dropdown.pack(pady=10)

    def submit_selection():
        selection_result["value"] = selected_value.get().strip().upper()
        step3_window.destroy()

    submit_button = tk.Button(
        step3_window,
        text="Submit",
        command=submit_selection,
        width=15
    )
    submit_button.pack(pady=10)

    step3_window.protocol("WM_DELETE_WINDOW", lambda: step3_window.destroy())
    step3_window.grab_set()
    step3_window.wait_window()

    if selection_result["value"] not in ["Y", "N"]:
        return "N"

    return selection_result["value"]


# ============================================================
# Step 3 Merge Helpers
# ============================================================

def collect_unique_values_from_columns(
    df: pd.DataFrame,
    possible_columns: List[str]
) -> List[str]:
    """
    Collects unique non-blank values from any matching columns in a dataframe.
    Values are returned as strings to preserve leading zeros.
    """
    if df is None or df.empty:
        return []

    values = []

    for col in possible_columns:
        if col in df.columns:
            col_values = (
                df[col]
                .dropna()
                .astype(str)
                .str.strip()
                .loc[lambda s: s != ""]
                .tolist()
            )
            values.extend(col_values)

    return [
        preserve_leading_zeros(value)
        for value in values
        if str(value).strip() != ""
    ]


def create_final_master_rxcui(
    table1_df: pd.DataFrame,
    table2_df: pd.DataFrame,
    table3_df: pd.DataFrame,
    table4_df: pd.DataFrame,
    table5_df: pd.DataFrame,
    table6_df: pd.DataFrame,
    manipulated_data_folder: Path
) -> pd.DataFrame:
    """
    Creates final_master_rxcui.csv.

    This file includes the distinct RXCUI list from all Step 2 tables where RXCUI values exist.

    Required special inclusion:
    - Include unique genericRxcui values from Table2.
    """
    print("\nStep 3A Starting - Creating final_master_rxcui.csv...")

    all_rxcui_values = []

    # Table1 RXCUI values.
    all_rxcui_values.extend(
        collect_unique_values_from_columns(
            table1_df,
            ["rxcui"]
        )
    )

    # Table2 RXCUI values, including required genericRxcui values.
    all_rxcui_values.extend(
        collect_unique_values_from_columns(
            table2_df,
            ["rxcui", "api_rxcui", "genericRxcui"]
        )
    )

    # Table3 RXCUI values.
    all_rxcui_values.extend(
        collect_unique_values_from_columns(
            table3_df,
            ["rxcui", "api_rxcui", "minConcept.rxcui"]
        )
    )

    # Table4 RXCUI values.
    all_rxcui_values.extend(
        collect_unique_values_from_columns(
            table4_df,
            ["rxcui", "minConcept.rxcui"]
        )
    )

    # Table5 is a class table and usually does not include RXCUI,
    # but this keeps the process adaptive if the schema changes.
    all_rxcui_values.extend(
        collect_unique_values_from_columns(
            table5_df,
            ["rxcui", "api_rxcui", "minConcept.rxcui"]
        )
    )

    # Table6 RXCUI values.
    all_rxcui_values.extend(
        collect_unique_values_from_columns(
            table6_df,
            ["rxcui", "api_id"]
        )
    )

    unique_rxcuis = sorted(list(set(all_rxcui_values)))

    final_master_rxcui_df = pd.DataFrame({
        "rxcui": unique_rxcuis
    })

    final_master_rxcui_df = preserve_dataframe_leading_zeros(final_master_rxcui_df)

    output_file = manipulated_data_folder / "final_master_rxcui.csv"
    save_csv_string_safe(final_master_rxcui_df, output_file)

    print(f"Step 3A Complete - final_master_rxcui saved: {output_file}")
    print(f"final_master_rxcui row count: {len(final_master_rxcui_df):,}")

    return final_master_rxcui_df


def create_merged_rxterms_info(
    table1_df: pd.DataFrame,
    table2_df: pd.DataFrame,
    manipulated_data_folder: Path
) -> pd.DataFrame:
    """
    Creates merged_RxTerms_Info.csv.

    Join logic:
    - Table1 joins to Table2 on:
      1. fullName
      2. termType
      3. rxcui

    Join type:
    - all possible values / full outer join

    Final output columns:
    - fullName
    - termType
    - rxcui
    - brandName
    - displayName
    - fullGenericName
    - genericRxcui
    """
    print("\nStep 3B Starting - Creating merged_RxTerms_Info.csv...")

    join_keys = ["fullName", "termType", "rxcui"]

    table1_required_columns = ["fullName", "termType", "rxcui"]
    table2_required_columns = [
        "brandName",
        "displayName",
        "fullName",
        "fullGenericName",
        "termType",
        "rxcui",
        "genericRxcui"
    ]

    table1_clean = table1_df.copy() if table1_df is not None else pd.DataFrame()
    table2_clean = table2_df.copy() if table2_df is not None else pd.DataFrame()

    # Make the process schema-safe by adding any missing required columns as blanks.
    for col in table1_required_columns:
        if col not in table1_clean.columns:
            table1_clean[col] = ""

    for col in table2_required_columns:
        if col not in table2_clean.columns:
            table2_clean[col] = ""

    table1_clean = table1_clean[table1_required_columns].copy()
    table2_clean = table2_clean[table2_required_columns].copy()

    table1_clean = preserve_dataframe_leading_zeros(table1_clean)
    table2_clean = preserve_dataframe_leading_zeros(table2_clean)

    # Deduplicate before merge to reduce duplicate row inflation.
    table1_clean = table1_clean.drop_duplicates()
    table2_clean = table2_clean.drop_duplicates()

    merged_df = pd.merge(
        table1_clean,
        table2_clean,
        how="outer",
        on=join_keys
    )

    final_columns = [
        "fullName",
        "termType",
        "rxcui",
        "brandName",
        "displayName",
        "fullGenericName",
        "genericRxcui"
    ]

    for col in final_columns:
        if col not in merged_df.columns:
            merged_df[col] = ""

    merged_df = merged_df[final_columns].copy()
    merged_df = preserve_dataframe_leading_zeros(merged_df)
    merged_df = merged_df.drop_duplicates()

    output_file = manipulated_data_folder / "merged_RxTerms_Info.csv"
    save_csv_string_safe(merged_df, output_file)

    print(f"Step 3B Complete - merged_RxTerms_Info saved: {output_file}")
    print(f"merged_RxTerms_Info row count: {len(merged_df):,}")

    return merged_df



def coalesce_columns(df: pd.DataFrame, possible_columns: List[str], output_column: str) -> pd.Series:
    """
    Creates one output series by taking the first non-blank value across possible columns.

    This is used because pandas json_normalize can return fields such as:
    - minConcept.rxcui
    - rxclassMinConceptItem.classId
    - classId

    The function preserves leading zeros and avoids hard failures when one schema variation is missing.
    """
    if df is None or df.empty:
        return pd.Series(dtype=str)

    result = pd.Series([""] * len(df), index=df.index, dtype="object")

    for col in possible_columns:
        if col in df.columns:
            candidate = (
                df[col]
                .fillna("")
                .astype(str)
                .str.strip()
            )

            result = result.where(result.astype(str).str.strip() != "", candidate)

    return result.apply(preserve_leading_zeros)


def standardize_rxclass_relationship_table(
    source_df: pd.DataFrame,
    source_table_name: str
) -> pd.DataFrame:
    """
    Standardizes RxClass relationship records from Table 3 or Table 4.

    Output columns:
    - rxcui
    - classId
    - className
    - classType
    - rela
    - relaSource
    - name
    - tty
    - source_table
    """
    if source_df is None or source_df.empty:
        return pd.DataFrame(columns=[
            "rxcui",
            "classId",
            "className",
            "classType",
            "rela",
            "relaSource",
            "name",
            "tty",
            "source_table"
        ])

    df = source_df.copy()
    df = preserve_dataframe_leading_zeros(df)

    standardized_df = pd.DataFrame()

    standardized_df["rxcui"] = coalesce_columns(
        df,
        ["rxcui", "minConcept.rxcui", "api_rxcui"],
        "rxcui"
    )

    standardized_df["classId"] = coalesce_columns(
        df,
        ["classId", "rxclassMinConceptItem.classId"],
        "classId"
    )

    standardized_df["className"] = coalesce_columns(
        df,
        ["className", "rxclassMinConceptItem.className"],
        "className"
    )

    standardized_df["classType"] = coalesce_columns(
        df,
        ["classType", "rxclassMinConceptItem.classType"],
        "classType"
    )

    standardized_df["rela"] = coalesce_columns(
        df,
        ["rela"],
        "rela"
    )

    standardized_df["relaSource"] = coalesce_columns(
        df,
        ["relaSource"],
        "relaSource"
    )

    standardized_df["name"] = coalesce_columns(
        df,
        ["name", "minConcept.name", "api_drugName"],
        "name"
    )

    standardized_df["tty"] = coalesce_columns(
        df,
        ["tty", "minConcept.tty"],
        "tty"
    )

    standardized_df["source_table"] = source_table_name

    standardized_df = preserve_dataframe_leading_zeros(standardized_df)
    standardized_df = standardized_df.drop_duplicates()

    return standardized_df


def standardize_rxclass_all_classes_table(table5_df: pd.DataFrame) -> pd.DataFrame:
    """
    Standardizes Table 5 all-classes data.

    Output columns:
    - classId
    - className
    - classType
    - classUrl
    """
    if table5_df is None or table5_df.empty:
        return pd.DataFrame(columns=[
            "classId",
            "className",
            "classType",
            "classUrl"
        ])

    df = table5_df.copy()
    df = preserve_dataframe_leading_zeros(df)

    standardized_df = pd.DataFrame()

    standardized_df["classId"] = coalesce_columns(
        df,
        ["classId", "rxclassMinConcept.classId", "rxclassMinConceptItem.classId"],
        "classId"
    )

    standardized_df["className"] = coalesce_columns(
        df,
        ["className", "rxclassMinConcept.className", "rxclassMinConceptItem.className"],
        "className"
    )

    standardized_df["classType"] = coalesce_columns(
        df,
        ["classType", "rxclassMinConcept.classType", "rxclassMinConceptItem.classType"],
        "classType"
    )

    standardized_df["classUrl"] = coalesce_columns(
        df,
        ["classUrl", "classUrl ", "rxclassMinConcept.classUrl", "rxclassMinConceptItem.classUrl"],
        "classUrl"
    )

    standardized_df = preserve_dataframe_leading_zeros(standardized_df)
    standardized_df = standardized_df.drop_duplicates()

    return standardized_df


def create_merged_rxclass_info(
    final_master_rxcui_df: pd.DataFrame,
    table3_df: pd.DataFrame,
    table4_df: pd.DataFrame,
    table5_df: pd.DataFrame,
    manipulated_data_folder: Path
) -> pd.DataFrame:
    """
    Creates merged_RxClass_Info.csv.

    Merge logic:
    1. Start with the unique rxcui values from final_master_rxcui.csv.
    2. Merge those RXCUIs to standardized Table 3 and Table 4 relationship data.
    3. Join the Table 3 / Table 4 relationship data to Table 5 class reference data using:
       - classId
       - className
       - classType

    Final output columns:
    - rxcui                 from final_master_rxcui
    - classId               from Table 5 when matched, otherwise relationship table classId
    - className             from Table 5 when matched, otherwise relationship table className
    - classType             from Table 5 when matched, otherwise relationship table classType
    - classUrl              from Table 5
    - rela                  from Tables 3 / 4
    - relaSource            from Tables 3 / 4
    - name                  from Tables 3 / 4
    - tty                   from Tables 3 / 4
    """
    print("\nStep 3C Starting - Creating merged_RxClass_Info.csv...")

    final_columns = [
        "rxcui",
        "classId",
        "className",
        "classType",
        "classUrl",
        "rela",
        "relaSource",
        "name",
        "tty"
    ]

    if final_master_rxcui_df is None or final_master_rxcui_df.empty:
        print("final_master_rxcui is empty. Creating empty merged_RxClass_Info.csv.")
        empty_df = pd.DataFrame(columns=final_columns)
        output_file = manipulated_data_folder / "merged_RxClass_Info.csv"
        save_csv_string_safe(empty_df, output_file)
        return empty_df

    master_rxcui_df = final_master_rxcui_df.copy()

    if "rxcui" not in master_rxcui_df.columns:
        master_rxcui_df["rxcui"] = ""

    master_rxcui_df = master_rxcui_df[["rxcui"]].copy()
    master_rxcui_df = preserve_dataframe_leading_zeros(master_rxcui_df)
    master_rxcui_df = master_rxcui_df.drop_duplicates()

    table3_standardized = standardize_rxclass_relationship_table(
        source_df=table3_df,
        source_table_name="Table3"
    )

    table4_standardized = standardize_rxclass_relationship_table(
        source_df=table4_df,
        source_table_name="Table4"
    )

    rxclass_relationships_df = pd.concat(
        [table3_standardized, table4_standardized],
        ignore_index=True,
        sort=False
    )

    rxclass_relationships_df = preserve_dataframe_leading_zeros(rxclass_relationships_df)
    rxclass_relationships_df = rxclass_relationships_df.drop_duplicates()

    table5_standardized = standardize_rxclass_all_classes_table(table5_df)
    table5_standardized = preserve_dataframe_leading_zeros(table5_standardized)
    table5_standardized = table5_standardized.drop_duplicates()

    # Merge final master RXCUIs to Table 3 / 4 relationship records.
    # This preserves every RXCUI from final_master_rxcui while attaching any available class relationships.
    master_relationship_merge_df = pd.merge(
        master_rxcui_df,
        rxclass_relationships_df,
        how="left",
        on="rxcui"
    )

    join_keys = ["classId", "className", "classType"]

    for col in join_keys:
        if col not in master_relationship_merge_df.columns:
            master_relationship_merge_df[col] = ""

        if col not in table5_standardized.columns:
            table5_standardized[col] = ""

    # Join relationship records to Table 5 class reference information.
    merged_df = pd.merge(
        master_relationship_merge_df,
        table5_standardized,
        how="left",
        on=join_keys,
        suffixes=("", "_table5")
    )

    # Ensure final columns exist.
    for col in final_columns:
        if col not in merged_df.columns:
            merged_df[col] = ""

    merged_df = merged_df[final_columns].copy()
    merged_df = preserve_dataframe_leading_zeros(merged_df)
    merged_df = merged_df.drop_duplicates()

    output_file = manipulated_data_folder / "merged_RxClass_Info.csv"
    save_csv_string_safe(merged_df, output_file)

    print(f"Step 3C Complete - merged_RxClass_Info saved: {output_file}")
    print(f"merged_RxClass_Info row count: {len(merged_df):,}")

    return merged_df



def create_merged_class_types_and_therapeutic_outputs(
    final_master_rxcui_df: pd.DataFrame,
    table3_df: pd.DataFrame,
    table4_df: pd.DataFrame,
    table5_df: pd.DataFrame,
    manipulated_data_folder: Path
) -> dict:
    """
    Creates the therapeutic class Step 3 outputs.

    Outputs created:
    1. merged_classTypes.csv
    2. rxcui_therapeutic_classes.csv
    3. 13 classType-specific files stored in:
       Manipulated Data Files/RxCUIs by ClassType/
    """
    print("\nStep 3D Starting - Creating merged_classTypes and therapeutic class outputs...")

    final_columns = [
        "rxcui",
        "name",
        "tty",
        "classId",
        "className",
        "classType",
        "classUrl",
        "rela",
        "relaSource"
    ]

    expected_class_types = [
        "ATC1-4",
        "DISEASE",
        "CHEM",
        "MOA",
        "PE",
        "DISPOS",
        "STRUCT",
        "EPC",
        "VA",
        "PK",
        "CVX",
        "TC",
        "SCHEDULE"
    ]

    class_type_subfolder = manipulated_data_folder / "RxCUIs by ClassType"
    class_type_subfolder.mkdir(parents=True, exist_ok=True)

    if final_master_rxcui_df is None or final_master_rxcui_df.empty:
        print("final_master_rxcui is empty. Creating empty therapeutic class files.")

        empty_df = pd.DataFrame(columns=final_columns)

        merged_class_types_file = manipulated_data_folder / "merged_classTypes.csv"
        therapeutic_classes_file = manipulated_data_folder / "rxcui_therapeutic_classes.csv"

        save_csv_string_safe(empty_df, merged_class_types_file)
        save_csv_string_safe(empty_df, therapeutic_classes_file)

        output_map = {
            "merged_classTypes_df": empty_df,
            "rxcui_therapeutic_classes_df": empty_df,
            "class_type_subfolder": class_type_subfolder
        }

        for class_type in expected_class_types:
            file_name = f"final_rxcui_{class_type}_Info.csv"
            output_file = class_type_subfolder / file_name
            save_csv_string_safe(empty_df, output_file)
            output_map[f"final_rxcui_{class_type}_Info_df"] = empty_df

        return output_map

    master_rxcui_df = final_master_rxcui_df.copy()

    if "rxcui" not in master_rxcui_df.columns:
        master_rxcui_df["rxcui"] = ""

    master_rxcui_df = master_rxcui_df[["rxcui"]].copy()
    master_rxcui_df = preserve_dataframe_leading_zeros(master_rxcui_df)
    master_rxcui_df = master_rxcui_df.drop_duplicates()

    table3_standardized = standardize_rxclass_relationship_table(
        source_df=table3_df,
        source_table_name="Table3"
    )

    table4_standardized = standardize_rxclass_relationship_table(
        source_df=table4_df,
        source_table_name="Table4"
    )

    rxclass_relationships_df = pd.concat(
        [table3_standardized, table4_standardized],
        ignore_index=True,
        sort=False
    )

    rxclass_relationships_df = preserve_dataframe_leading_zeros(rxclass_relationships_df)
    rxclass_relationships_df = rxclass_relationships_df.drop_duplicates()

    table5_standardized = standardize_rxclass_all_classes_table(table5_df)
    table5_standardized = preserve_dataframe_leading_zeros(table5_standardized)
    table5_standardized = table5_standardized.drop_duplicates()

    merged_class_types_df = pd.merge(
        master_rxcui_df,
        rxclass_relationships_df,
        how="left",
        on="rxcui"
    )

    join_keys = ["classId", "className", "classType"]

    for col in join_keys:
        if col not in merged_class_types_df.columns:
            merged_class_types_df[col] = ""

        if col not in table5_standardized.columns:
            table5_standardized[col] = ""

    merged_class_types_df = pd.merge(
        merged_class_types_df,
        table5_standardized,
        how="left",
        on=join_keys,
        suffixes=("", "_table5")
    )

    for col in final_columns:
        if col not in merged_class_types_df.columns:
            merged_class_types_df[col] = ""

    merged_class_types_df = merged_class_types_df[final_columns].copy()
    merged_class_types_df = preserve_dataframe_leading_zeros(merged_class_types_df)
    merged_class_types_df = merged_class_types_df.drop_duplicates()

    merged_class_types_file = manipulated_data_folder / "merged_classTypes.csv"
    save_csv_string_safe(merged_class_types_df, merged_class_types_file)

    rxcui_therapeutic_classes_df = merged_class_types_df.copy()
    therapeutic_classes_file = manipulated_data_folder / "rxcui_therapeutic_classes.csv"
    save_csv_string_safe(rxcui_therapeutic_classes_df, therapeutic_classes_file)

    print(f"Step 3D - merged_classTypes saved: {merged_class_types_file}")
    print(f"Step 3D - rxcui_therapeutic_classes saved: {therapeutic_classes_file}")
    print(f"Step 3D - classType subset files will be stored in: {class_type_subfolder}")
    print(f"merged_classTypes row count: {len(merged_class_types_df):,}")

    output_map = {
        "merged_classTypes_df": merged_class_types_df,
        "rxcui_therapeutic_classes_df": rxcui_therapeutic_classes_df,
        "class_type_subfolder": class_type_subfolder
    }

    for class_type in expected_class_types:
        class_type_df = merged_class_types_df[
            merged_class_types_df["classType"].astype(str).str.strip().str.upper() == class_type.upper()
        ].copy()

        class_type_df = preserve_dataframe_leading_zeros(class_type_df)
        class_type_df = class_type_df.drop_duplicates()

        file_name = f"final_rxcui_{class_type}_Info.csv"
        output_file = class_type_subfolder / file_name

        save_csv_string_safe(class_type_df, output_file)

        old_output_file = manipulated_data_folder / file_name
        if old_output_file.exists() and old_output_file != output_file:
            try:
                old_output_file.unlink()
            except Exception as cleanup_error:
                print(f"Could not remove older subset file {old_output_file}: {cleanup_error}")

        print(f"Step 3D - {file_name} saved with {len(class_type_df):,} rows.")

        output_map[f"final_rxcui_{class_type}_Info_df"] = class_type_df

    print("Step 3D Complete - Therapeutic class files created and organized.")

    return output_map



def create_class_type_crosswalk(
    merged_class_types_df: pd.DataFrame,
    manipulated_data_folder: Path
) -> pd.DataFrame:
    """
    Creates classType_crosswalk.csv outside both Raw Data Files and Manipulated Data Files.

    Source:
    - merged_classTypes.csv / merged_class_types_df

    Logic:
    - Select distinct classType, classId, className combinations.
    - Add ClassDefinition based on the 13 expected RxClass classTypes.

    Output location:
    - Parent run folder, outside both:
      - Raw Data Files
      - Manipulated Data Files

    Final columns:
    - classType
    - ClassDefinition
    - classId
    - className
    """
    print("\nStep 3E Starting - Creating classType_crosswalk.csv...")

    class_definition_map = {
        "ATC1-4": "Anatomical Therapeutic Chemical",
        "DISEASE": "Disease",
        "CHEM": "Chemical",
        "MOA": "Mechanism of Action",
        "PE": "Physiologic Effect",
        "DISPOS": "Disposition",
        "STRUCT": "Structure",
        "EPC": "Established Pharmacologic Class",
        "VA": "Veterans Affairs",
        "PK": "Pharmacokinetics",
        "CVX": "Vaccines",
        "TC": "Therapeutic Categories",
        "SCHEDULE": "Controlled Substance Act Schedule"
    }

    final_columns = [
        "classType",
        "ClassDefinition",
        "classId",
        "className"
    ]

    if merged_class_types_df is None or merged_class_types_df.empty:
        print("merged_classTypes is empty. Creating empty classType_crosswalk.csv.")
        crosswalk_df = pd.DataFrame(columns=final_columns)
    else:
        crosswalk_df = merged_class_types_df.copy()
        crosswalk_df = preserve_dataframe_leading_zeros(crosswalk_df)

        for col in ["classType", "classId", "className"]:
            if col not in crosswalk_df.columns:
                crosswalk_df[col] = ""

        crosswalk_df = crosswalk_df[["classType", "classId", "className"]].copy()

        # Keep only the 13 expected classTypes and remove blank classType rows.
        crosswalk_df["classType"] = crosswalk_df["classType"].fillna("").astype(str).str.strip()
        crosswalk_df["classId"] = crosswalk_df["classId"].fillna("").astype(str).str.strip()
        crosswalk_df["className"] = crosswalk_df["className"].fillna("").astype(str).str.strip()

        crosswalk_df = crosswalk_df[
            crosswalk_df["classType"].str.upper().isin([x.upper() for x in class_definition_map.keys()])
        ].copy()

        # Normalize classType casing to the official key casing in the definition map.
        official_class_type_lookup = {
            key.upper(): key
            for key in class_definition_map.keys()
        }

        crosswalk_df["classType"] = crosswalk_df["classType"].str.upper().map(official_class_type_lookup)

        crosswalk_df["ClassDefinition"] = crosswalk_df["classType"].map(class_definition_map)

        crosswalk_df = crosswalk_df[final_columns].copy()
        crosswalk_df = preserve_dataframe_leading_zeros(crosswalk_df)
        crosswalk_df = crosswalk_df.drop_duplicates()
        crosswalk_df = crosswalk_df.sort_values(
            by=["classType", "classId", "className"],
            kind="stable"
        )

    # Store crosswalk outside both Raw Data Files and Manipulated Data Files.
    # manipulated_data_folder = <run_folder>/Manipulated Data Files
    # output should be <run_folder>/classType_crosswalk.csv
    run_folder = manipulated_data_folder.parent
    output_file = run_folder / "classType_crosswalk.csv"

    save_csv_string_safe(crosswalk_df, output_file)

    print(f"Step 3E Complete - classType_crosswalk saved: {output_file}")
    print(f"classType_crosswalk row count: {len(crosswalk_df):,}")

    return crosswalk_df



def create_rxcui_atc1_4_thera_class_breakdown(
    final_master_rxcui_df: pd.DataFrame,
    table5_df: pd.DataFrame,
    manipulated_data_folder: Path,
    class_type_subfolder: Path
) -> pd.DataFrame:
    """
    Creates RxCUI_ACT1_4_TheraClassBreakdown.csv in the Manipulated Data Files folder.

    Source file:
    - Manipulated Data Files/RxCUIs by ClassType/final_rxcui_ATC1-4_Info.csv

    Lookup source:
    - Table5_RxClass_getAllClasses data.

    Mapping logic:
    - TherapeuticClass_1 = className where Table5.classId = first 1 character of classId.
    - TherapeuticClass_2 = className where Table5.classId = first 3 characters of classId.
    - TherapeuticClass_3 = className where Table5.classId = first 4 characters of classId.
    - TherapeuticClass4  = className where Table5.classId = first 5 characters of classId.
    """
    print("\nStep 3F Starting - Creating RxCUI_ACT1_4_TheraClassBreakdown.csv...")

    output_columns = [
        "rxcui",
        "classId",
        "classType",
        "TherapeuticClass_1",
        "TherapeuticClass_2",
        "TherapeuticClass_3",
        "TherapeuticClass4"
    ]

    atc_source_file = class_type_subfolder / "final_rxcui_ATC1-4_Info.csv"

    if atc_source_file.exists():
        atc_df = read_csv_as_string(atc_source_file)
    else:
        print(f"ATC1-4 source file not found at {atc_source_file}. Creating empty breakdown file.")
        atc_df = pd.DataFrame(columns=["rxcui", "classId", "classType"])

    atc_df = preserve_dataframe_leading_zeros(atc_df)

    for col in ["rxcui", "classId", "classType"]:
        if col not in atc_df.columns:
            atc_df[col] = ""

    atc_df = atc_df[["rxcui", "classId", "classType"]].copy()
    atc_df = atc_df.drop_duplicates()

    table5_standardized = standardize_rxclass_all_classes_table(table5_df)
    table5_standardized = preserve_dataframe_leading_zeros(table5_standardized)

    for col in ["classId", "className"]:
        if col not in table5_standardized.columns:
            table5_standardized[col] = ""

    table5_lookup_df = (
        table5_standardized[["classId", "className"]]
        .drop_duplicates()
        .copy()
    )

    table5_lookup_df["classId"] = table5_lookup_df["classId"].astype(str).str.strip()
    table5_lookup_df["className"] = table5_lookup_df["className"].astype(str).str.strip()

    class_name_lookup = dict(
        zip(
            table5_lookup_df["classId"],
            table5_lookup_df["className"]
        )
    )

    def lookup_class_name(class_id_value: str, prefix_length: int) -> str:
        class_id_value = preserve_leading_zeros(class_id_value).strip()

        if class_id_value == "":
            return ""

        class_prefix = class_id_value[:prefix_length]

        return preserve_leading_zeros(class_name_lookup.get(class_prefix, ""))

    breakdown_df = atc_df.copy()

    breakdown_df["TherapeuticClass_1"] = breakdown_df["classId"].apply(lambda x: lookup_class_name(x, 1))
    breakdown_df["TherapeuticClass_2"] = breakdown_df["classId"].apply(lambda x: lookup_class_name(x, 3))
    breakdown_df["TherapeuticClass_3"] = breakdown_df["classId"].apply(lambda x: lookup_class_name(x, 4))
    breakdown_df["TherapeuticClass4"] = breakdown_df["classId"].apply(lambda x: lookup_class_name(x, 5))

    for col in output_columns:
        if col not in breakdown_df.columns:
            breakdown_df[col] = ""

    breakdown_df = breakdown_df[output_columns].copy()
    breakdown_df = preserve_dataframe_leading_zeros(breakdown_df)
    breakdown_df = breakdown_df.drop_duplicates()

    output_file = manipulated_data_folder / "RxCUI_ACT1_4_TheraClassBreakdown.csv"
    save_csv_string_safe(breakdown_df, output_file)

    print(f"Step 3F Complete - RxCUI_ACT1_4_TheraClassBreakdown saved: {output_file}")
    print(f"RxCUI_ACT1_4_TheraClassBreakdown row count: {len(breakdown_df):,}")

    return breakdown_df



def create_normalized_ndc_crosswalk_and_atc_ndc_output(
    rxcui_atc1_4_breakdown_df: pd.DataFrame,
    table6_df: pd.DataFrame,
    manipulated_data_folder: Path
) -> dict:
    """
    Creates the NDC-normalized Step 3 outputs.

    Output 1:
    - Normalized_NDC_Crosswalk.csv

    Structure:
    - rxcui
    - ndc11
    - ndc9
    - ndc10

    Output 2:
    - ACT1-4_TheraClassNDC.csv
    - merged_ACT1-4_TheraNDCName.csv
    - Crosswalks folder

    Structure:
    - rxcui
    - classId
    - TherapeuticClass_1
    - TherapeuticClass_2
    - TherapeuticClass_3
    - TherapeuticClass4
    - ndc11
    - ndc9
    - ndc10

    Logic:
    - RxCUI_ACT1_4_TheraClassBreakdown is the anchor table.
    - Table6_RxNorm_getNDCProperties is normalized into one row per unique:
      rxcui + ndc11 + ndc9 + ndc10.
    - The anchor table is left joined to the normalized NDC crosswalk by rxcui.
    - Leading zeros are preserved for all NDC values.
    """
    print("\nStep 3G Starting - Creating Normalized_NDC_Crosswalk and ACT1-4_TheraClassNDC...")

    ndc_crosswalk_columns = [
        "rxcui",
        "ndc11",
        "ndc9",
        "ndc10"
    ]

    final_atc_ndc_columns = [
        "rxcui",
        "classId",
        "TherapeuticClass_1",
        "TherapeuticClass_2",
        "TherapeuticClass_3",
        "TherapeuticClass4",
        "ndc11",
        "ndc9",
        "ndc10"
    ]

    # -----------------------------
    # Step 3G.1: Normalize Table6 NDC data
    # -----------------------------

    if table6_df is None or table6_df.empty:
        print("Table6 data is empty. Creating empty Normalized_NDC_Crosswalk.csv.")
        normalized_ndc_df = pd.DataFrame(columns=ndc_crosswalk_columns)
    else:
        table6_clean = table6_df.copy()
        table6_clean = preserve_dataframe_leading_zeros(table6_clean)

        # Table6 expected columns from API normalization:
        # - rxcui
        # - ndcItem
        # - ndc9
        # - ndc10
        #
        # Some records also include api_id from the RXCUI used in the API call.
        # We prefer the returned rxcui, but fall back to api_id if rxcui is missing.
        if "rxcui" not in table6_clean.columns:
            table6_clean["rxcui"] = ""

        if "api_id" not in table6_clean.columns:
            table6_clean["api_id"] = ""

        if "ndcItem" not in table6_clean.columns:
            table6_clean["ndcItem"] = ""

        if "ndc9" not in table6_clean.columns:
            table6_clean["ndc9"] = ""

        if "ndc10" not in table6_clean.columns:
            table6_clean["ndc10"] = ""

        normalized_ndc_df = pd.DataFrame()

        normalized_ndc_df["rxcui"] = table6_clean["rxcui"].fillna("").astype(str).str.strip()
        fallback_api_id = table6_clean["api_id"].fillna("").astype(str).str.strip()

        normalized_ndc_df["rxcui"] = normalized_ndc_df["rxcui"].where(
            normalized_ndc_df["rxcui"] != "",
            fallback_api_id
        )

        normalized_ndc_df["ndc11"] = table6_clean["ndcItem"].fillna("").astype(str).str.strip()
        normalized_ndc_df["ndc9"] = table6_clean["ndc9"].fillna("").astype(str).str.strip()
        normalized_ndc_df["ndc10"] = table6_clean["ndc10"].fillna("").astype(str).str.strip()

        normalized_ndc_df = preserve_dataframe_leading_zeros(normalized_ndc_df)

        # Remove rows that do not have an RXCUI.
        normalized_ndc_df = normalized_ndc_df[
            normalized_ndc_df["rxcui"].astype(str).str.strip() != ""
        ].copy()

        # Remove rows where all NDC fields are blank.
        normalized_ndc_df = normalized_ndc_df[
            ~(
                (normalized_ndc_df["ndc11"].astype(str).str.strip() == "") &
                (normalized_ndc_df["ndc9"].astype(str).str.strip() == "") &
                (normalized_ndc_df["ndc10"].astype(str).str.strip() == "")
            )
        ].copy()

        normalized_ndc_df = normalized_ndc_df[ndc_crosswalk_columns].copy()
        normalized_ndc_df = normalized_ndc_df.drop_duplicates(
            subset=ndc_crosswalk_columns,
            keep="first"
        )

    normalized_ndc_file = manipulated_data_folder / "Normalized_NDC_Crosswalk.csv"
    save_csv_string_safe(normalized_ndc_df, normalized_ndc_file)

    print(f"Step 3G.1 Complete - Normalized_NDC_Crosswalk saved: {normalized_ndc_file}")
    print(f"Normalized_NDC_Crosswalk row count: {len(normalized_ndc_df):,}")

    # -----------------------------
    # Step 3G.2: Build ACT1-4_TheraClassNDC
    # -----------------------------

    if rxcui_atc1_4_breakdown_df is None or rxcui_atc1_4_breakdown_df.empty:
        print("RxCUI_ACT1_4_TheraClassBreakdown is empty. Creating empty ACT1-4_TheraClassNDC.csv.")
        final_atc_ndc_df = pd.DataFrame(columns=final_atc_ndc_columns)
    else:
        anchor_df = rxcui_atc1_4_breakdown_df.copy()
        anchor_df = preserve_dataframe_leading_zeros(anchor_df)

        required_anchor_columns = [
            "rxcui",
            "classId",
            "TherapeuticClass_1",
            "TherapeuticClass_2",
            "TherapeuticClass_3",
            "TherapeuticClass4"
        ]

        for col in required_anchor_columns:
            if col not in anchor_df.columns:
                anchor_df[col] = ""

        anchor_df = anchor_df[required_anchor_columns].copy()
        anchor_df = anchor_df.drop_duplicates()

        final_atc_ndc_df = pd.merge(
            anchor_df,
            normalized_ndc_df,
            how="left",
            on="rxcui"
        )

        for col in final_atc_ndc_columns:
            if col not in final_atc_ndc_df.columns:
                final_atc_ndc_df[col] = ""

        final_atc_ndc_df = final_atc_ndc_df[final_atc_ndc_columns].copy()
        final_atc_ndc_df = preserve_dataframe_leading_zeros(final_atc_ndc_df)

        # Deduplicate normalized output.
        final_atc_ndc_df = final_atc_ndc_df.drop_duplicates(
            subset=final_atc_ndc_columns,
            keep="first"
        )

    final_atc_ndc_file = manipulated_data_folder / "ACT1-4_TheraClassNDC.csv"
    save_csv_string_safe(final_atc_ndc_df, final_atc_ndc_file)

    print(f"Step 3G.2 Complete - ACT1-4_TheraClassNDC saved: {final_atc_ndc_file}")
    print(f"ACT1-4_TheraClassNDC row count: {len(final_atc_ndc_df):,}")

    return {
        "normalized_ndc_crosswalk_df": normalized_ndc_df,
        "act1_4_thera_class_ndc_df": final_atc_ndc_df
    }





def create_merged_act1_4_thera_ndc_name(
    act1_4_thera_class_ndc_df: pd.DataFrame,
    table7_df: pd.DataFrame,
    table8_df: pd.DataFrame,
    manipulated_data_folder: Path
) -> pd.DataFrame:
    """
    Creates merged_ACT1-4_TheraNDCName.csv.

    Anchor:
    - ACT1-4_TheraClassNDC

    Required output fields:
    - rxcui
    - ndc11
    - ndc9
    - ndc10
    - rxnormName from Table7_RxNorm_getRxNormName
    - name and tty from Table8_RxNorm_getDrugs
    """
    print("\nStep 3H Starting - Creating merged_ACT1-4_TheraNDCName.csv...")

    final_columns = ["rxcui", "ndc11", "ndc9", "ndc10", "rxnormName", "name", "tty"]

    if act1_4_thera_class_ndc_df is None or act1_4_thera_class_ndc_df.empty:
        final_df = pd.DataFrame(columns=final_columns)
        save_csv_string_safe(final_df, manipulated_data_folder / "merged_ACT1-4_TheraNDCName.csv")
        return final_df

    anchor_df = preserve_dataframe_leading_zeros(act1_4_thera_class_ndc_df.copy())

    for col in ["rxcui", "ndc11", "ndc9", "ndc10"]:
        if col not in anchor_df.columns:
            anchor_df[col] = ""

    anchor_df = anchor_df[["rxcui", "ndc11", "ndc9", "ndc10"]].copy()
    anchor_df = anchor_df[anchor_df["rxcui"].astype(str).str.strip() != ""]
    anchor_df = anchor_df.drop_duplicates()

    # Table7 lookup: api_rxcui -> rxnormName.
    if table7_df is None or table7_df.empty:
        table7_lookup_df = pd.DataFrame(columns=["rxcui", "rxnormName"])
    else:
        table7_lookup_df = preserve_dataframe_leading_zeros(table7_df.copy())

        if "api_rxcui" not in table7_lookup_df.columns:
            table7_lookup_df["api_rxcui"] = ""

        if "rxnormName" not in table7_lookup_df.columns:
            table7_lookup_df["rxnormName"] = ""

        table7_lookup_df = table7_lookup_df[["api_rxcui", "rxnormName"]].rename(
            columns={"api_rxcui": "rxcui"}
        )
        table7_lookup_df = table7_lookup_df.drop_duplicates()

    # Table8 lookup: rxcui -> name, tty.
    if table8_df is None or table8_df.empty:
        table8_lookup_df = pd.DataFrame(columns=["rxcui", "name", "tty"])
    else:
        table8_lookup_df = preserve_dataframe_leading_zeros(table8_df.copy())

        for col in ["rxcui", "name", "tty"]:
            if col not in table8_lookup_df.columns:
                table8_lookup_df[col] = ""

        table8_lookup_df = table8_lookup_df[["rxcui", "name", "tty"]].copy()
        table8_lookup_df = table8_lookup_df.drop_duplicates()

    merged_df = pd.merge(anchor_df, table7_lookup_df, how="left", on="rxcui")
    merged_df = pd.merge(merged_df, table8_lookup_df, how="left", on="rxcui")

    for col in final_columns:
        if col not in merged_df.columns:
            merged_df[col] = ""

    final_df = merged_df[final_columns].copy()
    final_df = preserve_dataframe_leading_zeros(final_df)
    final_df = final_df.drop_duplicates()

    output_file = manipulated_data_folder / "merged_ACT1-4_TheraNDCName.csv"
    save_csv_string_safe(final_df, output_file)

    print(f"Step 3H Complete - merged_ACT1-4_TheraNDCName saved: {output_file}")
    print(f"merged_ACT1-4_TheraNDCName row count: {len(final_df):,}")

    return final_df


def copy_file_if_exists(source_file: Path, destination_folder: Path) -> Optional[Path]:
    """
    Copies a file into destination_folder while preserving the original.
    """
    if not source_file.exists():
        print(f"Copy skipped; source file does not exist: {source_file}")
        return None

    destination_folder.mkdir(parents=True, exist_ok=True)
    destination_file = destination_folder / source_file.name
    shutil.copy2(source_file, destination_file)

    print(f"Copied file: {destination_file}")

    return destination_file


def move_file_if_exists(source_file: Path, destination_folder: Path) -> Optional[Path]:
    """
    Moves a file into destination_folder. Replaces an existing destination file.
    """
    if not source_file.exists():
        print(f"Move skipped; source file does not exist: {source_file}")
        return None

    destination_folder.mkdir(parents=True, exist_ok=True)
    destination_file = destination_folder / source_file.name

    if destination_file.exists():
        destination_file.unlink()

    shutil.move(str(source_file), str(destination_file))

    print(f"Moved file: {destination_file}")

    return destination_file


def organize_step3_output_folders(
    raw_data_folder: Path,
    manipulated_data_folder: Path
) -> dict:
    """
    Organizes final run outputs after all Step 3 files are built.

    Folder structure created:
    - <Run Folder>/Crosswalks

    Key behavior:
    1. Move crosswalk files into the Crosswalks folder:
       - Normalized_NDC_Crosswalk.csv
       - classType_crosswalk.csv

    Important:
    - Output organization is limited to local CSV folder cleanup.
    """
    print("\nStep 3I Starting - Organizing output folders...")

    run_folder = manipulated_data_folder.parent
    crosswalks_folder = run_folder / "Crosswalks"
    crosswalks_folder.mkdir(parents=True, exist_ok=True)

    normalized_ndc_moved = move_file_if_exists(
        manipulated_data_folder / "Normalized_NDC_Crosswalk.csv",
        crosswalks_folder
    )

    class_type_crosswalk_moved = move_file_if_exists(
        run_folder / "classType_crosswalk.csv",
        crosswalks_folder
    )

    audit_df = pd.DataFrame([{
        "run_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "crosswalks_folder": str(crosswalks_folder),
        "normalized_ndc_crosswalk_moved": "Y" if normalized_ndc_moved is not None else "N",
        "class_type_crosswalk_moved": "Y" if class_type_crosswalk_moved is not None else "N",
        "database_export_removed": "Y"
    }])

    audit_file = run_folder / "Step3_Output_Organization_Audit.csv"
    save_csv_string_safe(audit_df, audit_file)

    print("Step 3I Complete - Output folders organized.")
    print(f"Crosswalks folder: {crosswalks_folder}")

    return {
        "crosswalks_folder": crosswalks_folder,
        "organization_audit_file": audit_file
    }



def run_step3_merge_process(
    table1_df: pd.DataFrame,
    table2_df: pd.DataFrame,
    table3_df: pd.DataFrame,
    table4_df: pd.DataFrame,
    table5_df: pd.DataFrame,
    table6_df: pd.DataFrame,
    table7_df: pd.DataFrame,
    table8_df: pd.DataFrame,
    raw_data_folder: Path,
    manipulated_data_folder: Path
) -> dict:
    """
    Runs Step 3 manipulated data build process.

    Current Step 3 outputs:
    - final_master_rxcui.csv
    - merged_RxTerms_Info.csv
    - merged_RxClass_Info.csv
    - merged_classTypes.csv
    - rxcui_therapeutic_classes.csv
    - 13 classType-specific final_rxcui_*_Info.csv files
    - classType_crosswalk.csv
    - RxCUIs by ClassType subfolder
    - RxCUI_ACT1_4_TheraClassBreakdown.csv
    - Normalized_NDC_Crosswalk.csv
    - ACT1-4_TheraClassNDC.csv
    - merged_ACT1-4_TheraNDCName.csv
    - Crosswalks folder
    """
    print("\nStep 3 Starting - Merging Data Together...")

    manipulated_data_folder.mkdir(parents=True, exist_ok=True)

    final_master_rxcui_df = create_final_master_rxcui(
        table1_df=table1_df,
        table2_df=table2_df,
        table3_df=table3_df,
        table4_df=table4_df,
        table5_df=table5_df,
        table6_df=table6_df,
        manipulated_data_folder=manipulated_data_folder
    )

    merged_rxterms_info_df = create_merged_rxterms_info(
        table1_df=table1_df,
        table2_df=table2_df,
        manipulated_data_folder=manipulated_data_folder
    )

    merged_rxclass_info_df = create_merged_rxclass_info(
        final_master_rxcui_df=final_master_rxcui_df,
        table3_df=table3_df,
        table4_df=table4_df,
        table5_df=table5_df,
        manipulated_data_folder=manipulated_data_folder
    )

    therapeutic_class_outputs = create_merged_class_types_and_therapeutic_outputs(
        final_master_rxcui_df=final_master_rxcui_df,
        table3_df=table3_df,
        table4_df=table4_df,
        table5_df=table5_df,
        manipulated_data_folder=manipulated_data_folder
    )

    class_type_crosswalk_df = create_class_type_crosswalk(
        merged_class_types_df=therapeutic_class_outputs["merged_classTypes_df"],
        manipulated_data_folder=manipulated_data_folder
    )

    rxcui_atc1_4_breakdown_df = create_rxcui_atc1_4_thera_class_breakdown(
        final_master_rxcui_df=final_master_rxcui_df,
        table5_df=table5_df,
        manipulated_data_folder=manipulated_data_folder,
        class_type_subfolder=therapeutic_class_outputs["class_type_subfolder"]
    )

    ndc_outputs = create_normalized_ndc_crosswalk_and_atc_ndc_output(
        rxcui_atc1_4_breakdown_df=rxcui_atc1_4_breakdown_df,
        table6_df=table6_df,
        manipulated_data_folder=manipulated_data_folder
    )

    merged_act1_4_thera_ndc_name_df = create_merged_act1_4_thera_ndc_name(
        act1_4_thera_class_ndc_df=ndc_outputs["act1_4_thera_class_ndc_df"],
        table7_df=table7_df,
        table8_df=table8_df,
        manipulated_data_folder=manipulated_data_folder
    )

    organization_outputs = organize_step3_output_folders(
        raw_data_folder=raw_data_folder,
        manipulated_data_folder=manipulated_data_folder
    )

    print("\nStep 3 current merge process complete.")
    print(f"Manipulated files stored in: {manipulated_data_folder}")
    print(f"classType subset files stored in: {therapeutic_class_outputs['class_type_subfolder']}")
    print(f"Crosswalks folder stored in: {organization_outputs['crosswalks_folder']}")

    return {
        "final_master_rxcui_df": final_master_rxcui_df,
        "merged_rxterms_info_df": merged_rxterms_info_df,
        "merged_rxclass_info_df": merged_rxclass_info_df,
        "merged_classTypes_df": therapeutic_class_outputs["merged_classTypes_df"],
        "rxcui_therapeutic_classes_df": therapeutic_class_outputs["rxcui_therapeutic_classes_df"],
        "class_type_crosswalk_df": class_type_crosswalk_df,
        "rxcui_atc1_4_breakdown_df": rxcui_atc1_4_breakdown_df,
        "normalized_ndc_crosswalk_df": ndc_outputs["normalized_ndc_crosswalk_df"],
        "act1_4_thera_class_ndc_df": ndc_outputs["act1_4_thera_class_ndc_df"],
        "merged_act1_4_thera_ndc_name_df": merged_act1_4_thera_ndc_name_df,
        "organization_outputs": organization_outputs
    }




# ============================================================
# Program Completion / Safe Close Helper
# ============================================================

def close_program() -> None:
    """
    Displays the final completion popup and then safely ends the program.
    """
    messagebox.showinfo(
        "Program Complete",
        "Program now complete!  Closing program."
    )

    print("\nProgram now complete! Closing program.")

    try:
        sys.exit(0)

    except SystemExit:
        raise

    except Exception as close_error:
        print(f"Program close encountered an unexpected issue: {close_error}")
        sys.exit(0)


# ============================================================
# Main Process
# ============================================================


# ============================================================
# Parallel API Overrides for Step 2 High-Volume Tables
# ============================================================

def run_parallel_api_items(
    items: List[str],
    worker_function,
    step_name: str,
    start_time: float,
    max_workers: int = API_MAX_WORKERS
) -> Tuple[list, list]:
    """
    Runs API calls in controlled parallel batches.

    Why this exists:
    - The original process called APIs one at a time.
    - This keeps the same adaptive retry logic but allows multiple API calls
      to run at once.
    - This can significantly reduce runtime for high-volume API tables.

    Safety rules:
    - Uses a conservative worker count by default.
    - Each worker uses its own requests.Session.
    - Failures are returned and logged instead of crashing the full program.
    - Progress bar still updates based on completed futures.
    """
    all_records = []
    failed_records = []

    total = len(items)

    if total == 0:
        return all_records, failed_records

    if not API_PARALLEL_ENABLED:
        for i, item in enumerate(items, start=1):
            records, failures = worker_function(item)

            if records:
                all_records.extend(records)

            if failures:
                failed_records.extend(failures)

            print_progress_bar(
                step_name=step_name,
                completed=i,
                total=total,
                start_time=start_time
            )

        return all_records, failed_records

    safe_worker_count = max(1, min(int(max_workers), total))

    print(f"Parallel API mode enabled for {step_name}.")
    print(f"Using {safe_worker_count:,} worker(s).")

    with ThreadPoolExecutor(max_workers=safe_worker_count) as executor:
        future_map = {
            executor.submit(worker_function, item): item
            for item in items
        }

        completed_count = 0

        for future in as_completed(future_map):
            completed_count += 1
            item = future_map[future]

            try:
                records, failures = future.result()

                if records:
                    all_records.extend(records)

                if failures:
                    failed_records.extend(failures)

            except Exception as worker_error:
                failed_records.append({
                    "step_name": step_name,
                    "identifier": preserve_leading_zeros(item),
                    "url": "",
                    "status_code": None,
                    "attempts": "0",
                    "error_type": "PARALLEL_WORKER_ERROR",
                    "error": str(worker_error)
                })

            print_progress_bar(
                step_name=step_name,
                completed=completed_count,
                total=total,
                start_time=start_time
            )

    return all_records, failed_records


# ============================================================
# Parallel Override: Table 2 - RxTerms getAllRxTermInfo
# ============================================================

def pull_table2_rxterm_info(
    table1_df: pd.DataFrame,
    raw_data_folder: Path,
    cache_folder: Path,
    session: requests.Session,
    sleep_seconds: float = 0.0
) -> pd.DataFrame:
    """
    Parallelized Table 2 API pull.

    Same business logic as before:
    - Uses unique RXCUIs from Table1.
    - Skips RXCUIs already in Table2_cache.csv.
    - Saves new pull, final cache output, failures, and cache audit.
    """
    table_name = "Table2"
    cache_file_name = "Table2_cache.csv"
    cache_key = "api_rxcui"

    step_name = "Table 2 API - getAllRxTermInfo"
    step_start_time = time.time()

    input_rxcuis = get_unique_rxcuis_from_table1(table1_df)
    total_input_values = len(input_rxcuis)

    cache_df = load_cache(
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        required_columns=[cache_key]
    )

    cached_rxcuis = get_cached_values(cache_df, cache_key)

    rxcuis_to_call = [
        preserve_leading_zeros(rxcui)
        for rxcui in input_rxcuis
        if preserve_leading_zeros(rxcui) not in cached_rxcuis
    ]

    already_cached_count = total_input_values - len(rxcuis_to_call)

    if not input_rxcuis:
        print("Table 2 skipped because no RXCUIs were available from Table 1.")
        create_cache_audit_file(table_name, raw_data_folder, 0, 0, 0, 0, len(cache_df))
        return cache_df

    if not rxcuis_to_call:
        print("\nTable 2 API - All RXCUIs are already present in cache. No API calls needed.")
        save_raw_api_file(pd.DataFrame(), raw_data_folder, "Table2_RxTerms_getAllRxTermInfo_new_pull.csv")
        save_raw_api_file(cache_df, raw_data_folder, "Table2_RxTerms_getAllRxTermInfo.csv")
        create_cache_audit_file(table_name, raw_data_folder, total_input_values, already_cached_count, 0, 0, len(cache_df))
        return cache_df

    print(f"\nCalling {step_name} for {len(rxcuis_to_call):,} uncached RXCUIs out of {total_input_values:,} total RXCUIs...")
    print_progress_bar(step_name, 0, len(rxcuis_to_call), step_start_time)

    def fetch_one(rxcui: str) -> Tuple[list, list]:
        url = f"https://rxnav.nlm.nih.gov/REST/RxTerms/rxcui/{rxcui}/allinfo.json"

        with requests.Session() as worker_session:
            data, failure = adaptive_get_json(
                session=worker_session,
                url=url,
                step_name=step_name,
                identifier=rxcui
            )

        if sleep_seconds:
            time.sleep(sleep_seconds)

        if failure:
            return [], [failure]

        record = data.get("rxtermsProperties", {}) if data else {}

        if record:
            cleaned_record = preserve_nested_values(record)
            cleaned_record["api_rxcui"] = preserve_leading_zeros(rxcui)
            return [cleaned_record], []

        return [], [{
            "step_name": step_name,
            "identifier": rxcui,
            "url": url,
            "status_code": "200",
            "attempts": "1",
            "error_type": "NO_RXTERMS_PROPERTIES_RETURNED",
            "error": "No rxtermsProperties returned"
        }]

    all_records, failed_records = run_parallel_api_items(
        items=rxcuis_to_call,
        worker_function=fetch_one,
        step_name=step_name,
        start_time=step_start_time
    )

    new_pull_df = pd.json_normalize(all_records)
    new_pull_df = preserve_dataframe_leading_zeros(new_pull_df)

    save_raw_api_file(new_pull_df, raw_data_folder, "Table2_RxTerms_getAllRxTermInfo_new_pull.csv")

    final_cache_df = append_and_dedupe_cache(
        existing_cache_df=cache_df,
        new_df=new_pull_df,
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        dedupe_key_columns=[cache_key]
    )

    save_raw_api_file(final_cache_df, raw_data_folder, "Table2_RxTerms_getAllRxTermInfo.csv")
    save_failures_if_any(failed_records, raw_data_folder, "Table2_RxTerms_getAllRxTermInfo_failures.csv")

    create_cache_audit_file(
        table_name=table_name,
        raw_data_folder=raw_data_folder,
        total_input_values=total_input_values,
        values_already_cached=already_cached_count,
        values_newly_pulled=len(new_pull_df),
        api_failures=len(failed_records),
        final_cache_row_count=len(final_cache_df),
        extra_metrics={"parallel_workers": API_MAX_WORKERS if API_PARALLEL_ENABLED else 1}
    )

    print("Table 2 API connection step complete.")
    print(f"Table 2 new successful record count: {len(new_pull_df):,}")
    print(f"Table 2 failed RXCUI count: {len(failed_records):,}")

    return final_cache_df


# ============================================================
# Parallel Override: Table 3 - RxClass getClassByRxNormDrugId
# ============================================================

def pull_table3_rxclass_get_class_by_rxnorm_drug_id(
    table1_df: pd.DataFrame,
    raw_data_folder: Path,
    cache_folder: Path,
    session: requests.Session,
    sleep_seconds: float = 0.0
) -> pd.DataFrame:
    """
    Parallelized Table 3 API pull.
    """
    table_name = "Table3"
    cache_file_name = "Table3_cache.csv"
    cache_pull_key = "api_rxcui"
    dedupe_keys = ["api_rxcui", "rxclassMinConceptItem.classId", "rela", "relaSource"]

    step_name = "Table 3 API - RxClass getClassByRxNormDrugId"
    step_start_time = time.time()

    input_rxcuis = get_unique_rxcuis_from_table1(table1_df)
    total_input_values = len(input_rxcuis)

    cache_df = load_cache(cache_folder, cache_file_name, required_columns=dedupe_keys)
    cached_rxcuis = get_cached_values(cache_df, cache_pull_key)

    rxcuis_to_call = [
        preserve_leading_zeros(rxcui)
        for rxcui in input_rxcuis
        if preserve_leading_zeros(rxcui) not in cached_rxcuis
    ]

    already_cached_count = total_input_values - len(rxcuis_to_call)

    if not input_rxcuis:
        print("Table 3 skipped because no RXCUIs were available from Table 1.")
        create_cache_audit_file(table_name, raw_data_folder, 0, 0, 0, 0, len(cache_df))
        return cache_df

    if not rxcuis_to_call:
        print("\nTable 3 API - All RXCUIs are already present in cache. No API calls needed.")
        save_raw_api_file(pd.DataFrame(), raw_data_folder, "Table3_RxClass_getClassbyRxNormDrugId_new_pull.csv")
        save_raw_api_file(cache_df, raw_data_folder, "Table3_RxClass_getClassbyRxNormDrugId.csv")
        create_cache_audit_file(table_name, raw_data_folder, total_input_values, already_cached_count, 0, 0, len(cache_df))
        return cache_df

    print(f"\nCalling {step_name} for {len(rxcuis_to_call):,} uncached RXCUIs out of {total_input_values:,} total RXCUIs...")
    print_progress_bar(step_name, 0, len(rxcuis_to_call), step_start_time)

    base_url = "https://rxnav.nlm.nih.gov/REST/rxclass/class/byRxcui.json"

    def fetch_one(rxcui: str) -> Tuple[list, list]:
        params = {"rxcui": rxcui}

        with requests.Session() as worker_session:
            data, failure = adaptive_get_json(
                session=worker_session,
                url=base_url,
                params=params,
                step_name=step_name,
                identifier=rxcui
            )

        if sleep_seconds:
            time.sleep(sleep_seconds)

        if failure:
            return [], [failure]

        rxclass_info = (
            data
            .get("rxclassDrugInfoList", {})
            .get("rxclassDrugInfo", [])
        ) if data else []

        if isinstance(rxclass_info, dict):
            rxclass_info = [rxclass_info]

        if rxclass_info:
            records = []
            for record in rxclass_info:
                record = preserve_nested_values(record)
                record["api_rxcui"] = preserve_leading_zeros(rxcui)
                records.append(record)
            return records, []

        return [], [{
            "step_name": step_name,
            "identifier": rxcui,
            "url": f"{base_url}?rxcui={rxcui}",
            "status_code": "200",
            "attempts": "1",
            "error_type": "NO_RXCLASS_DRUG_INFO_RETURNED",
            "error": "No rxclassDrugInfo returned"
        }]

    all_records, failed_records = run_parallel_api_items(
        items=rxcuis_to_call,
        worker_function=fetch_one,
        step_name=step_name,
        start_time=step_start_time
    )

    new_pull_df = pd.json_normalize(all_records)
    new_pull_df = preserve_dataframe_leading_zeros(new_pull_df)

    save_raw_api_file(new_pull_df, raw_data_folder, "Table3_RxClass_getClassbyRxNormDrugId_new_pull.csv")

    final_cache_df = append_and_dedupe_cache(
        existing_cache_df=cache_df,
        new_df=new_pull_df,
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        dedupe_key_columns=dedupe_keys
    )

    save_raw_api_file(final_cache_df, raw_data_folder, "Table3_RxClass_getClassbyRxNormDrugId.csv")
    save_failures_if_any(failed_records, raw_data_folder, "Table3_RxClass_getClassbyRxNormDrugId_failures.csv")

    create_cache_audit_file(
        table_name,
        raw_data_folder,
        total_input_values,
        already_cached_count,
        len(new_pull_df),
        len(failed_records),
        len(final_cache_df),
        extra_metrics={"parallel_workers": API_MAX_WORKERS if API_PARALLEL_ENABLED else 1}
    )

    print("Table 3 API connection step complete.")
    print(f"Table 3 new successful record count: {len(new_pull_df):,}")
    print(f"Table 3 failed RXCUI count: {len(failed_records):,}")

    return final_cache_df


# ============================================================
# Parallel Override: Table 4 - RxClass getClassByRxNormDrugName
# ============================================================

def pull_table4_rxclass_get_class_by_rxnorm_drug_name(
    table3_df: pd.DataFrame,
    raw_data_folder: Path,
    cache_folder: Path,
    session: requests.Session,
    sleep_seconds: float = 0.0
) -> pd.DataFrame:
    """
    Parallelized Table 4 API pull.
    """
    table_name = "Table4"
    cache_file_name = "Table4_cache.csv"
    cache_pull_key = "api_drugName"
    dedupe_keys = ["api_drugName", "rxclassMinConceptItem.classId", "rela", "relaSource"]

    step_name = "Table 4 API - RxClass getClassByRxNormDrugName"
    step_start_time = time.time()

    drug_names = get_unique_drug_names_from_table3(table3_df)
    total_input_values = len(drug_names)

    cache_df = load_cache(cache_folder, cache_file_name, required_columns=dedupe_keys)
    cached_drug_names = get_cached_values(cache_df, cache_pull_key)

    drug_names_to_call = [
        preserve_leading_zeros(drug_name)
        for drug_name in drug_names
        if preserve_leading_zeros(drug_name) not in cached_drug_names
    ]

    already_cached_count = total_input_values - len(drug_names_to_call)

    if not drug_names:
        print("Table 4 skipped because no drug names were available from Table 3.")
        create_cache_audit_file(table_name, raw_data_folder, 0, 0, 0, 0, len(cache_df))
        return cache_df

    if not drug_names_to_call:
        print("\nTable 4 API - All drug names are already present in cache. No API calls needed.")
        save_raw_api_file(pd.DataFrame(), raw_data_folder, "Table4_RxClass_getClassByRxNormDrugName_new_pull.csv")
        save_raw_api_file(cache_df, raw_data_folder, "Table4_RxClass_getClassByRxNormDrugName.csv")
        create_cache_audit_file(table_name, raw_data_folder, total_input_values, already_cached_count, 0, 0, len(cache_df))
        return cache_df

    print(f"\nCalling {step_name} for {len(drug_names_to_call):,} uncached drug names out of {total_input_values:,} total drug names...")
    print_progress_bar(step_name, 0, len(drug_names_to_call), step_start_time)

    base_url = "https://rxnav.nlm.nih.gov/REST/rxclass/class/byDrugName.json"

    def fetch_one(drug_name: str) -> Tuple[list, list]:
        params = {"drugName": drug_name}

        with requests.Session() as worker_session:
            data, failure = adaptive_get_json(
                session=worker_session,
                url=base_url,
                params=params,
                step_name=step_name,
                identifier=drug_name
            )

        if sleep_seconds:
            time.sleep(sleep_seconds)

        if failure:
            return [], [failure]

        rxclass_info = (
            data
            .get("rxclassDrugInfoList", {})
            .get("rxclassDrugInfo", [])
        ) if data else []

        if isinstance(rxclass_info, dict):
            rxclass_info = [rxclass_info]

        if rxclass_info:
            records = []
            for record in rxclass_info:
                record = preserve_nested_values(record)
                record["api_drugName"] = preserve_leading_zeros(drug_name)
                records.append(record)
            return records, []

        return [], [{
            "step_name": step_name,
            "identifier": drug_name,
            "url": f"{base_url}?drugName={drug_name}",
            "status_code": "200",
            "attempts": "1",
            "error_type": "NO_RXCLASS_DRUG_INFO_RETURNED",
            "error": "No rxclassDrugInfo returned"
        }]

    all_records, failed_records = run_parallel_api_items(
        items=drug_names_to_call,
        worker_function=fetch_one,
        step_name=step_name,
        start_time=step_start_time
    )

    new_pull_df = pd.json_normalize(all_records)
    new_pull_df = preserve_dataframe_leading_zeros(new_pull_df)

    save_raw_api_file(new_pull_df, raw_data_folder, "Table4_RxClass_getClassByRxNormDrugName_new_pull.csv")

    final_cache_df = append_and_dedupe_cache(
        existing_cache_df=cache_df,
        new_df=new_pull_df,
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        dedupe_key_columns=dedupe_keys
    )

    save_raw_api_file(final_cache_df, raw_data_folder, "Table4_RxClass_getClassByRxNormDrugName.csv")
    save_failures_if_any(failed_records, raw_data_folder, "Table4_RxClass_getClassByRxNormDrugName_failures.csv")

    create_cache_audit_file(
        table_name,
        raw_data_folder,
        total_input_values,
        already_cached_count,
        len(new_pull_df),
        len(failed_records),
        len(final_cache_df),
        extra_metrics={"parallel_workers": API_MAX_WORKERS if API_PARALLEL_ENABLED else 1}
    )

    print("Table 4 API connection step complete.")
    print(f"Table 4 new successful record count: {len(new_pull_df):,}")
    print(f"Table 4 failed drug name count: {len(failed_records):,}")

    return final_cache_df


# ============================================================
# Parallel Override: Table 6 - RxNorm getNDCProperties
# ============================================================

def pull_table6_rxnorm_get_ndc_properties(
    table1_df: pd.DataFrame,
    table3_df: pd.DataFrame,
    table4_df: pd.DataFrame,
    raw_data_folder: Path,
    cache_folder: Path,
    session: requests.Session,
    sleep_seconds: float = 0.0
) -> pd.DataFrame:
    """
    Parallelized Table 6 API pull.
    """
    table_name = "Table6"
    cache_file_name = "Table6_cache.csv"
    cache_pull_key = "api_id"
    dedupe_keys = ["api_id", "ndcItem", "rxcui", "ndc9", "ndc10", "splSetIdItem", "source"]

    step_name = "Table 6 API - RxNorm getNDCProperties"
    step_start_time = time.time()

    input_rxcuis = get_unique_rxcuis_from_tables_1_3_4(table1_df, table3_df, table4_df)
    total_input_values = len(input_rxcuis)

    cache_df = load_cache(cache_folder, cache_file_name, required_columns=dedupe_keys)
    cached_ids = get_cached_values(cache_df, cache_pull_key)

    rxcuis_to_call = [
        preserve_leading_zeros(rxcui)
        for rxcui in input_rxcuis
        if preserve_leading_zeros(rxcui) not in cached_ids
    ]

    already_cached_count = total_input_values - len(rxcuis_to_call)

    if not input_rxcuis:
        print("Table 6 skipped because no RXCUIs were available from Tables 1, 3, or 4.")
        create_cache_audit_file(table_name, raw_data_folder, 0, 0, 0, 0, len(cache_df))
        return cache_df

    if not rxcuis_to_call:
        print("\nTable 6 API - All RXCUIs are already present in cache. No API calls needed.")
        save_raw_api_file(pd.DataFrame(), raw_data_folder, "Table6_RxNorm_getNDCProperties_new_pull.csv")
        save_raw_api_file(cache_df, raw_data_folder, "Table6_RxNorm_getNDCProperties.csv")
        create_cache_audit_file(table_name, raw_data_folder, total_input_values, already_cached_count, 0, 0, len(cache_df))
        return cache_df

    print(f"\nCalling {step_name} for {len(rxcuis_to_call):,} uncached RXCUIs out of {total_input_values:,} total RXCUIs...")
    print_progress_bar(step_name, 0, len(rxcuis_to_call), step_start_time)

    base_url = "https://rxnav.nlm.nih.gov/REST/ndcproperties.json"

    def fetch_one(rxcui: str) -> Tuple[list, list]:
        params = {"id": rxcui, "ndcstatus": "all"}

        with requests.Session() as worker_session:
            data, failure = adaptive_get_json(
                session=worker_session,
                url=base_url,
                params=params,
                step_name=step_name,
                identifier=rxcui
            )

        if sleep_seconds:
            time.sleep(sleep_seconds)

        if failure:
            return [], [failure]

        ndc_properties = (
            data
            .get("ndcPropertyList", {})
            .get("ndcProperty", [])
        ) if data else []

        if isinstance(ndc_properties, dict):
            ndc_properties = [ndc_properties]

        if ndc_properties:
            records = []
            for record in ndc_properties:
                record = preserve_nested_values(record)
                record["api_id"] = preserve_leading_zeros(rxcui)
                record["api_ndcstatus"] = "all"
                records.append(record)
            return records, []

        return [], [{
            "step_name": step_name,
            "identifier": rxcui,
            "url": f"{base_url}?id={rxcui}&ndcstatus=all",
            "status_code": "200",
            "attempts": "1",
            "error_type": "NO_NDC_PROPERTIES_RETURNED",
            "error": "No ndcProperty returned"
        }]

    all_records, failed_records = run_parallel_api_items(
        items=rxcuis_to_call,
        worker_function=fetch_one,
        step_name=step_name,
        start_time=step_start_time
    )

    new_pull_df = pd.json_normalize(all_records)
    new_pull_df = preserve_dataframe_leading_zeros(new_pull_df)

    save_raw_api_file(new_pull_df, raw_data_folder, "Table6_RxNorm_getNDCProperties_new_pull.csv")

    final_cache_df = append_and_dedupe_cache(
        existing_cache_df=cache_df,
        new_df=new_pull_df,
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        dedupe_key_columns=dedupe_keys
    )

    save_raw_api_file(final_cache_df, raw_data_folder, "Table6_RxNorm_getNDCProperties.csv")
    save_failures_if_any(failed_records, raw_data_folder, "Table6_RxNorm_getNDCProperties_failures.csv")

    create_cache_audit_file(
        table_name,
        raw_data_folder,
        total_input_values,
        already_cached_count,
        len(new_pull_df),
        len(failed_records),
        len(final_cache_df),
        extra_metrics={"parallel_workers": API_MAX_WORKERS if API_PARALLEL_ENABLED else 1}
    )

    print("Table 6 API connection step complete.")
    print(f"Table 6 new successful record count: {len(new_pull_df):,}")
    print(f"Table 6 failed RXCUI count: {len(failed_records):,}")

    return final_cache_df


# ============================================================
# Parallel Override: Table 7 - RxNorm getRxNormName
# ============================================================

def pull_table7_rxnorm_get_rxnorm_name(
    table1_df: pd.DataFrame,
    table2_df: pd.DataFrame,
    table3_df: pd.DataFrame,
    table4_df: pd.DataFrame,
    table5_df: pd.DataFrame,
    table6_df: pd.DataFrame,
    raw_data_folder: Path,
    cache_folder: Path,
    session: requests.Session,
    sleep_seconds: float = 0.0
) -> pd.DataFrame:
    """
    Parallelized Table 7 API pull.
    """
    table_name = "Table7"
    cache_file_name = "Table7_cache.csv"
    cache_key = "api_rxcui"

    step_name = "Table 7 API - RxNorm getRxNormName"
    step_start_time = time.time()

    input_rxcuis = []
    input_rxcuis.extend(collect_unique_values_from_columns(table1_df, ["rxcui"]))
    input_rxcuis.extend(collect_unique_values_from_columns(table2_df, ["rxcui", "api_rxcui", "genericRxcui"]))
    input_rxcuis.extend(collect_unique_values_from_columns(table3_df, ["rxcui", "api_rxcui", "minConcept.rxcui"]))
    input_rxcuis.extend(collect_unique_values_from_columns(table4_df, ["rxcui", "minConcept.rxcui"]))
    input_rxcuis.extend(collect_unique_values_from_columns(table5_df, ["rxcui", "api_rxcui", "minConcept.rxcui"]))
    input_rxcuis.extend(collect_unique_values_from_columns(table6_df, ["rxcui", "api_id"]))

    input_rxcuis = sorted(list(set(
        preserve_leading_zeros(value)
        for value in input_rxcuis
        if str(value).strip() != ""
    )))

    total_input_values = len(input_rxcuis)

    cache_df = load_cache(cache_folder, cache_file_name, required_columns=[cache_key])
    cached_rxcuis = get_cached_values(cache_df, cache_key)

    rxcuis_to_call = [
        preserve_leading_zeros(rxcui)
        for rxcui in input_rxcuis
        if preserve_leading_zeros(rxcui) not in cached_rxcuis
    ]

    already_cached_count = total_input_values - len(rxcuis_to_call)

    if not input_rxcuis:
        print("Table 7 skipped because no RXCUIs were available from the final master RXCUI logic.")
        create_cache_audit_file(table_name, raw_data_folder, 0, 0, 0, 0, len(cache_df))
        return cache_df

    if not rxcuis_to_call:
        print("\nTable 7 API - All RXCUIs are already present in cache. No API calls needed.")
        save_raw_api_file(pd.DataFrame(), raw_data_folder, "Table7_RxNorm_getRxNormName_new_pull.csv")
        save_raw_api_file(cache_df, raw_data_folder, "Table7_RxNorm_getRxNormName.csv")
        create_cache_audit_file(table_name, raw_data_folder, total_input_values, already_cached_count, 0, 0, len(cache_df))
        return cache_df

    print(f"\nCalling {step_name} for {len(rxcuis_to_call):,} uncached RXCUIs out of {total_input_values:,} total RXCUIs...")
    print_progress_bar(step_name, 0, len(rxcuis_to_call), step_start_time)

    def fetch_one(rxcui: str) -> Tuple[list, list]:
        url = f"https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}.json"

        with requests.Session() as worker_session:
            data, failure = adaptive_get_json(
                session=worker_session,
                url=url,
                step_name=step_name,
                identifier=rxcui
            )

        if sleep_seconds:
            time.sleep(sleep_seconds)

        if failure:
            return [], [failure]

        id_group = data.get("idGroup", {}) if data else {}
        rxnorm_name = preserve_leading_zeros(id_group.get("name", ""))

        if rxnorm_name:
            return [{
                "api_rxcui": preserve_leading_zeros(rxcui),
                "rxnormName": rxnorm_name
            }], []

        return [], [{
            "step_name": step_name,
            "identifier": rxcui,
            "url": url,
            "status_code": "200",
            "attempts": "1",
            "error_type": "NO_RXNORM_NAME_RETURNED",
            "error": "No idGroup.name returned"
        }]

    all_records, failed_records = run_parallel_api_items(
        items=rxcuis_to_call,
        worker_function=fetch_one,
        step_name=step_name,
        start_time=step_start_time
    )

    new_pull_df = pd.DataFrame(all_records)
    new_pull_df = preserve_dataframe_leading_zeros(new_pull_df)

    save_raw_api_file(new_pull_df, raw_data_folder, "Table7_RxNorm_getRxNormName_new_pull.csv")

    final_cache_df = append_and_dedupe_cache(
        existing_cache_df=cache_df,
        new_df=new_pull_df,
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        dedupe_key_columns=[cache_key]
    )

    save_raw_api_file(final_cache_df, raw_data_folder, "Table7_RxNorm_getRxNormName.csv")
    save_failures_if_any(failed_records, raw_data_folder, "Table7_RxNorm_getRxNormName_failures.csv")

    create_cache_audit_file(
        table_name,
        raw_data_folder,
        total_input_values,
        already_cached_count,
        len(new_pull_df),
        len(failed_records),
        len(final_cache_df),
        extra_metrics={"parallel_workers": API_MAX_WORKERS if API_PARALLEL_ENABLED else 1}
    )

    print("Table 7 API connection step complete.")
    print(f"Table 7 new successful record count: {len(new_pull_df):,}")
    print(f"Table 7 failed RXCUI count: {len(failed_records):,}")

    return final_cache_df


# ============================================================
# Parallel Override: Table 8 - RxNorm getDrugs
# ============================================================

def pull_table8_rxnorm_get_drugs(
    table3_df: pd.DataFrame,
    raw_data_folder: Path,
    cache_folder: Path,
    session: requests.Session,
    sleep_seconds: float = 0.0
) -> pd.DataFrame:
    """
    Parallelized Table 8 API pull.
    """
    table_name = "Table8"
    cache_file_name = "Table8_cache.csv"
    cache_pull_key = "api_name"
    dedupe_keys = ["api_name", "tty", "rxcui", "name", "synonym", "language", "suppress", "umlscui", "psn"]

    step_name = "Table 8 API - RxNorm getDrugs"
    step_start_time = time.time()

    ingredient_names = get_unique_ingredient_names_from_table3(table3_df)
    total_input_values = len(ingredient_names)

    cache_df = load_cache(cache_folder, cache_file_name, required_columns=dedupe_keys)
    cached_names = get_cached_values(cache_df, cache_pull_key)

    names_to_call = [
        preserve_leading_zeros(ingredient_name)
        for ingredient_name in ingredient_names
        if preserve_leading_zeros(ingredient_name) not in cached_names
    ]

    already_cached_count = total_input_values - len(names_to_call)

    if not ingredient_names:
        print("Table 8 skipped because no ingredient names were available from Table 3 where minConcept.tty = IN.")
        create_cache_audit_file(table_name, raw_data_folder, 0, 0, 0, 0, len(cache_df))
        return cache_df

    if not names_to_call:
        print("\nTable 8 API - All ingredient names are already present in cache. No API calls needed.")
        save_raw_api_file(pd.DataFrame(), raw_data_folder, "Table8_RxNorm_getDrugs_new_pull.csv")
        save_raw_api_file(cache_df, raw_data_folder, "Table8_RxNorm_getDrugs.csv")
        create_cache_audit_file(table_name, raw_data_folder, total_input_values, already_cached_count, 0, 0, len(cache_df))
        return cache_df

    print(f"\nCalling {step_name} for {len(names_to_call):,} uncached ingredient names out of {total_input_values:,} total ingredient names...")
    print_progress_bar(step_name, 0, len(names_to_call), step_start_time)

    base_url = "https://rxnav.nlm.nih.gov/REST/drugs.json"

    def fetch_one(ingredient_name: str) -> Tuple[list, list]:
        params = {"name": ingredient_name}

        with requests.Session() as worker_session:
            data, failure = adaptive_get_json(
                session=worker_session,
                url=base_url,
                params=params,
                step_name=step_name,
                identifier=ingredient_name
            )

        if sleep_seconds:
            time.sleep(sleep_seconds)

        if failure:
            return [], [failure]

        concept_groups = (
            data
            .get("drugGroup", {})
            .get("conceptGroup", [])
        ) if data else []

        if isinstance(concept_groups, dict):
            concept_groups = [concept_groups]

        records = []

        for concept_group in concept_groups:
            group_tty = preserve_leading_zeros(concept_group.get("tty", ""))
            concept_properties = concept_group.get("conceptProperties", [])

            if isinstance(concept_properties, dict):
                concept_properties = [concept_properties]

            for record in concept_properties:
                record = preserve_nested_values(record)
                record["api_name"] = ingredient_name
                record["conceptGroup_tty"] = group_tty
                records.append(record)

        if records:
            return records, []

        return [], [{
            "step_name": step_name,
            "identifier": ingredient_name,
            "url": f"{base_url}?name={ingredient_name}",
            "status_code": "200",
            "attempts": "1",
            "error_type": "NO_CONCEPT_PROPERTIES_RETURNED",
            "error": "No drugGroup.conceptGroup.conceptProperties returned"
        }]

    all_records, failed_records = run_parallel_api_items(
        items=names_to_call,
        worker_function=fetch_one,
        step_name=step_name,
        start_time=step_start_time
    )

    new_pull_df = pd.json_normalize(all_records)
    new_pull_df = preserve_dataframe_leading_zeros(new_pull_df)

    for col in dedupe_keys:
        if col not in new_pull_df.columns:
            new_pull_df[col] = ""

    save_raw_api_file(new_pull_df, raw_data_folder, "Table8_RxNorm_getDrugs_new_pull.csv")

    final_cache_df = append_and_dedupe_cache(
        existing_cache_df=cache_df,
        new_df=new_pull_df,
        cache_folder=cache_folder,
        cache_file_name=cache_file_name,
        dedupe_key_columns=dedupe_keys
    )

    save_raw_api_file(final_cache_df, raw_data_folder, "Table8_RxNorm_getDrugs.csv")
    save_failures_if_any(failed_records, raw_data_folder, "Table8_RxNorm_getDrugs_failures.csv")

    create_cache_audit_file(
        table_name,
        raw_data_folder,
        total_input_values,
        already_cached_count,
        len(new_pull_df),
        len(failed_records),
        len(final_cache_df),
        extra_metrics={"parallel_workers": API_MAX_WORKERS if API_PARALLEL_ENABLED else 1}
    )

    print("Table 8 API connection step complete.")
    print(f"Table 8 new successful record count: {len(new_pull_df):,}")
    print(f"Table 8 failed ingredient name count: {len(failed_records):,}")

    return final_cache_df


def main() -> None:
    """
    Main program orchestration.
    """
    print("Starting RxTerms + RxClass API Program with Cache System...")

    base_folder = get_valid_user_folder_path()
    folders = create_run_folders(base_folder)

    cache_folder = folders["cache_folder"]
    raw_data_folder = folders["raw_data_folder"]
    manipulated_data_folder = folders["manipulated_data_folder"]

    print(f"Cache folder created/confirmed: {cache_folder}")
    print(f"Run folder created: {folders['run_folder']}")
    print(f"Raw data folder created: {raw_data_folder}")
    print(f"Manipulated data folder created: {manipulated_data_folder}")

    print("\nStep 2 Starting - Pulling API data with adaptive API controls and persistent cache...")

    with requests.Session() as session:
        session.headers.update({
            "User-Agent": "RxTerms-RxClass-API-Program/1.0",
            "Accept": "application/json"
        })

        table1_df = pull_table1_rxterms_products(
            raw_data_folder=raw_data_folder,
            cache_folder=cache_folder,
            session=session
        )

        table2_df = pull_table2_rxterm_info(
            table1_df=table1_df,
            raw_data_folder=raw_data_folder,
            cache_folder=cache_folder,
            session=session,
            sleep_seconds=0.1
        )

        table3_df = pull_table3_rxclass_get_class_by_rxnorm_drug_id(
            table1_df=table1_df,
            raw_data_folder=raw_data_folder,
            cache_folder=cache_folder,
            session=session,
            sleep_seconds=0.1
        )

        table4_df = pull_table4_rxclass_get_class_by_rxnorm_drug_name(
            table3_df=table3_df,
            raw_data_folder=raw_data_folder,
            cache_folder=cache_folder,
            session=session,
            sleep_seconds=0.1
        )

        table5_df = pull_table5_rxclass_get_all_classes(
            raw_data_folder=raw_data_folder,
            cache_folder=cache_folder,
            session=session
        )

        table6_df = pull_table6_rxnorm_get_ndc_properties(
            table1_df=table1_df,
            table3_df=table3_df,
            table4_df=table4_df,
            raw_data_folder=raw_data_folder,
            cache_folder=cache_folder,
            session=session,
            sleep_seconds=0.1
        )

        table7_df = pull_table7_rxnorm_get_rxnorm_name(
            table1_df=table1_df,
            table2_df=table2_df,
            table3_df=table3_df,
            table4_df=table4_df,
            table5_df=table5_df,
            table6_df=table6_df,
            raw_data_folder=raw_data_folder,
            cache_folder=cache_folder,
            session=session,
            sleep_seconds=0.1
        )

        table8_df = pull_table8_rxnorm_get_drugs(
            table3_df=table3_df,
            raw_data_folder=raw_data_folder,
            cache_folder=cache_folder,
            session=session,
            sleep_seconds=0.1
        )

    # Step 3 user gate:
    # After all raw API tables are built, ask the user whether to continue.
    step3_response = ask_user_to_start_step3()

    if step3_response == "N":
        messagebox.showinfo(
            "Program Stopped",
            "Step 3 was not started. Program will now stop and exit."
        )
        close_program()

    step3_outputs = run_step3_merge_process(
        table1_df=table1_df,
        table2_df=table2_df,
        table3_df=table3_df,
        table4_df=table4_df,
        table5_df=table5_df,
        table6_df=table6_df,
        table7_df=table7_df,
        table8_df=table8_df,
        raw_data_folder=raw_data_folder,
        manipulated_data_folder=manipulated_data_folder
    )

    print("\nProcess complete.")
    print(f"Table 1 final row count: {len(table1_df):,}")
    print(f"Table 2 final/cache row count: {len(table2_df):,}")
    print(f"Table 3 final/cache row count: {len(table3_df):,}")
    print(f"Table 4 final/cache row count: {len(table4_df):,}")
    print(f"Table 5 final/cache row count: {len(table5_df):,}")
    print(f"Table 6 final/cache row count: {len(table6_df):,}")
    print(f"Table 7 final/cache row count: {len(table7_df):,}")
    print(f"Table 8 final/cache row count: {len(table8_df):,}")
    print("All leading zeros were preserved across all API outputs.")
    print(f"All API files were stored in: {raw_data_folder}")
    print(f"All API cache files were stored in: {cache_folder}")
    print(f"Step 3 manipulated files were stored in: {manipulated_data_folder}")
    print(f"final_master_rxcui rows: {len(step3_outputs['final_master_rxcui_df']):,}")
    print(f"merged_RxTerms_Info rows: {len(step3_outputs['merged_rxterms_info_df']):,}")
    print(f"merged_RxClass_Info rows: {len(step3_outputs['merged_rxclass_info_df']):,}")
    print(f"merged_classTypes rows: {len(step3_outputs['merged_classTypes_df']):,}")
    print(f"rxcui_therapeutic_classes rows: {len(step3_outputs['rxcui_therapeutic_classes_df']):,}")
    print(f"classType_crosswalk rows: {len(step3_outputs['class_type_crosswalk_df']):,}")
    print(f"RxCUI_ACT1_4_TheraClassBreakdown rows: {len(step3_outputs['rxcui_atc1_4_breakdown_df']):,}")
    print(f"Normalized_NDC_Crosswalk rows: {len(step3_outputs['normalized_ndc_crosswalk_df']):,}")
    print(f"ACT1-4_TheraClassNDC rows: {len(step3_outputs['act1_4_thera_class_ndc_df']):,}")
    print(f"merged_ACT1-4_TheraNDCName rows: {len(step3_outputs['merged_act1_4_thera_ndc_name_df']):,}")
    print(f"Crosswalks folder: {step3_outputs['organization_outputs']['crosswalks_folder']}")

    messagebox.showinfo(
        "Step 3 Complete",
        "Step 3 - Merging Data Files is complete."
    )

    messagebox.showinfo(
        "Process Complete",
        f"RxTerms + RxClass + RxNorm API program completed successfully.\n\n"
        f"Table 1 rows: {len(table1_df):,}\n"
        f"Table 2 final/cache rows: {len(table2_df):,}\n"
        f"Table 3 final/cache rows: {len(table3_df):,}\n"
        f"Table 4 final/cache rows: {len(table4_df):,}\n"
        f"Table 5 final/cache rows: {len(table5_df):,}\n"
        f"Table 6 final/cache rows: {len(table6_df):,}\n"
        f"Table 7 final/cache rows: {len(table7_df):,}\n"
        f"Table 8 final/cache rows: {len(table8_df):,}\n\n"
        f"Step 3 manipulated files stored in:\n{manipulated_data_folder}\n\n"
        f"Crosswalks folder:\n{step3_outputs['organization_outputs']['crosswalks_folder']}\n\n"
    )

    close_program()


if __name__ == "__main__":
    main()
