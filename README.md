# AELTC Data & AI — Scenario 1: Ticket Holder Arrival Pattern Analysis

> **Client evaluation package** — IBM Technology Sales · All England Lawn Tennis Club  
> This repository contains the working prototype and analytical notebook shared for further exploration and evaluation.

---

## What's in this repo

```
├── ui/
│   ├── aeltc-data-ai.html        # Standalone dashboard — open in any browser, no server needed
│   ├── real_data_constants.js    # Pre-aggregated 2026 Championships data (inlined into the dashboard)
│   └── extract_real_data.js      # Node.js script that produced real_data_constants.js from raw data
│
├── notebook/
│   ├── scenario1_arrival_analysis.ipynb   # Full analytical notebook (Scenario 1)
│   ├── aeltc_arrival_analysis_base.csv    # Curated dataset (588k rows, PII-masked synthetic proxy)
│   ├── data_product_metadata.json         # Data Product Hub metadata record
│   └── 01_overall_arrival.png …           # Pre-rendered chart outputs from the notebook
│
└── docs/
    └── (architecture diagrams and supporting materials — see below)
```

---

## Quick start — Dashboard UI

The dashboard is a **single self-contained HTML file**. No build step, no server, no dependencies.

```bash
# Clone the repo
git clone https://github.com/<your-org>/aeltc-data-ai.git
cd aeltc-data-ai

# Open the dashboard
open ui/aeltc-data-ai.html          # macOS
start ui/aeltc-data-ai.html         # Windows
xdg-open ui/aeltc-data-ai.html      # Linux
```

The file already contains all data — the `real_data_constants.js` block is inlined. You can also open the HTML file directly by double-clicking it in Finder / Explorer.

### What the dashboard demonstrates

| Tab | What it shows |
|-----|--------------|
| **Live Operations** | Real-time court cards, fan-out delivery monitor, occupancy feed |
| **Analytics** | Arrival histogram, gate breakdown, weather overlay, zone occupancy (The Hill, Tea Lawn, Southern Village) |
| **Predict** | ML-driven arrival time prediction based on ticket tier, nationality, weather |
| **Simulate** | Side-by-side scenario comparison — change weather, tier mix, match schedule |
| **Act** | Actionable operational insights derived from the analysis |
| **Data Foundation** | Data lineage, governance labels, dataset catalogue (as it would appear in watsonx.data Intelligence) |

### Refreshing the data constants (optional)

If you have access to the raw data files (`Data/` directory), you can regenerate `real_data_constants.js`:

```bash
cd ui
node extract_real_data.js > real_data_constants.js
```

> **Note:** The `Data/` folder containing raw Teamcard JSON, occupancy CSV, weather CSV and court XML is not included in this repository (it contains operational data). The dashboard runs fully off the pre-aggregated constants already embedded in `aeltc-data-ai.html`.

---

## Quick start — Analytical Notebook (Scenario 1)

### Prerequisites

- Python 3.11+
- Jupyter Lab or Jupyter Notebook (`pip install jupyterlab`)

### Install dependencies

```bash
pip install -r requirements.txt
```

Or let the notebook's first cell handle it automatically — it installs all packages inline.

### Run the notebook

```bash
cd notebook
jupyter lab scenario1_arrival_analysis.ipynb
```

The notebook will:
1. **Generate** a synthetic dataset whose schema and statistical properties match the real AELTC gate-scan, customer profile, weather and match-schedule data
2. **Analyse** arrival patterns by ticket tier, nationality and weather conditions
3. **Build** an OLS regression model to quantify which factors drive early vs. late arrival
4. **Export** `aeltc_arrival_analysis_base.csv` and `data_product_metadata.json` — the artefacts that would be registered as a Data Product in IBM Data Product Hub

### Key findings from the notebook

| Factor | Effect on arrival time |
|--------|----------------------|
| Centre Court Debenture holders | Arrive ~48 min earlier than Grounds Pass |
| International visitors | Arrive ~13–17 min earlier than UK domestic |
| Rain day | Visitors arrive ~37 min **later** on average |
| Hot day (>23 °C) | Small compression — ~4 min earlier vs. cool day |
| Regression R² | **0.68** — tier + nationality + weather explain most of the variance |

---

## Technology context

This prototype demonstrates a pattern that would be deployed on:

| Layer | IBM / Partner technology |
|-------|------------------------|
| Streaming ingest | **Confluent** (Kafka topics → Tableflow → Iceberg) |
| Data lakehouse | **IBM watsonx.data** (Iceberg tables, Presto/Spark queries) |
| Governance & catalogue | **IBM watsonx.data Intelligence** (data catalogue, masking policies, lineage) |
| Data product distribution | **IBM Data Product Hub** (self-service subscription, versioned data products) |
| Analytical notebooks | **IBM watsonx.ai Studio** (managed Jupyter environment) |
| Operational dashboard | Custom React / vanilla JS (this prototype) |

---

## Scenario coverage

This repo covers **Scenario 1** (Arrival Pattern Analysis). Additional scenarios built during the discovery engagement:

| # | Scenario | Status |
|---|----------|--------|
| 1 | Ticket holder arrival pattern analysis | ✅ This repo |
| 2 | Zone occupancy & queue intelligence | Prototype available |
| 3 | Fan engagement & personalisation | Prototype available |

---

## Notes for evaluation

- **All data is synthetic or pre-aggregated.** No raw PII or operational data is included. The CSV uses a synthetic dataset whose marginal distributions match real Championships data; it is safe to share and re-run.
- **The dashboard is fully offline.** Every chart, KPI and simulation runs client-side in vanilla JS with no network calls.
- **The notebook is deterministic.** Set `SEED = 42` controls all random generation; re-running produces identical results.
- The `extract_real_data.js` script is included for transparency — it shows exactly how the aggregation from raw files to the constants block was performed.

---

## Repo structure decisions

| Decision | Rationale |
|----------|-----------|
| Single HTML file for UI | Zero deployment friction — client can open and demo immediately |
| Data inlined in HTML | No CORS issues, works offline, easy to email or share via link |
| Notebook exports CSV | Decouples the analysis from the dashboard; CSV can be loaded into any BI tool |
| `real_data_constants.js` separate | Allows regeneration from new raw data without touching the UI code |

---

## Contact

IBM Technology Sales — Data & AI  
For questions on the platform architecture or next steps, reach out to your IBM account team.
