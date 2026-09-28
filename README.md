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
│   ├── aeltc_arrival_analysis_sample_5k.csv  # 5k-row sample (run notebook to regenerate full 588k-row dataset)
│   ├── data_product_metadata.json         # Data Product Hub metadata record
│   └── 01_…09_*.png / *.html              # Pre-rendered chart outputs from the notebook
│
└── docs/
    └── (architecture diagrams and supporting materials)
```

---

## Quick start — Dashboard UI

The dashboard is a **single self-contained HTML file**. No build step, no server, no dependencies.

```bash
# Clone the repo
git clone https://github.com/ganapathyhari/aeltc-data-ai.git
cd aeltc-data-ai

# Open the dashboard
open ui/aeltc-data-ai.html          # macOS
start ui/aeltc-data-ai.html         # Windows
xdg-open ui/aeltc-data-ai.html      # Linux
```

Or visit the live GitHub Pages link directly — no installation required:
**https://ganapathyhari.github.io/aeltc-data-ai/**

The file already contains all data — the `real_data_constants.js` block is inlined. Every chart, KPI and simulation runs entirely in the browser with no network calls.

### Why a single HTML file?

The brief asked us to show the platform in action, not talk through slides. A single file means the client can open the dashboard, share it, and evaluate it with zero IBM infrastructure. It also demonstrates the GitHub-first operating model we're proposing for AELTC — the same approach used to build and ship this prototype is the same approach we'd use for pipelines and infrastructure-as-code.

In a production deployment, the same analytical outputs and visualisations would be served from Power BI consuming governed Iceberg tables via watsonx.data Premium. The GitHub Pages page is the decision-support layer; Power BI carries it into AELTC's operational estate.

### What the dashboard demonstrates

| Tab | What it shows |
|-----|--------------|
| **Live Operations** | Real-time court cards, fan-out delivery monitor, occupancy feed |
| **Analytics** | Arrival histogram, gate breakdown, weather overlay, zone occupancy (The Hill, Tea Lawn, Southern Village) |
| **Predict** | ML-driven arrival time prediction based on ticket tier, nationality, weather |
| **Simulate** | Side-by-side scenario comparison — change weather, tier mix, match schedule |
| **Act** | Actionable operational insights derived from the analysis |
| **Data Foundation** | Data lineage, governance labels, dataset catalogue (as it would appear in watsonx.data Intelligence) |
| **How We're Priced** | Plain-language cost model — X + Y + Z = TCO, what's included, what you don't pay extra for |

### Refreshing the data constants (optional)

If you have access to the raw data files (`Data/` directory), you can regenerate `real_data_constants.js`:

```bash
cd ui
node extract_real_data.js > real_data_constants.js
```

> **Note:** The `Data/` folder containing raw Teamcard JSON, occupancy CSV, weather CSV and court XML is not included in this repository. The dashboard runs fully off the pre-aggregated constants already embedded in `aeltc-data-ai.html`.

---

## Quick start — Analytical Notebook (Scenario 1)

### Prerequisites

- Python 3.11+
- Jupyter Lab (`pip install jupyterlab`)

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

### Why a local notebook and not the platform?

This notebook runs locally on synthetic data so AELTC can evaluate it without provisioning a cloud environment first. It is written as if it is running inside **IBM watsonx.ai Studio** — the data discovery narrative, the Presto SQL join block, the PII masking labels and the Data Product metadata export all mirror exactly what the analyst journey looks like on the real platform.

**The only difference between this notebook and the production version is the query engine.** In production:

```
Local (this repo)                Production (watsonx.data Premium)
─────────────────────────────    ─────────────────────────────────────
pandas merge()              →    Presto SQL on Iceberg tables
synthetic CSV data          →    Governed Iceberg tables via Tableflow
local file export           →    Data Product Hub registration
```

Every cell that would behave differently in production is explicitly labelled. When AELTC runs this inside watsonx.ai Studio against real Iceberg tables, no cells change — only the query engine behind them.

### Why is Spark not needed for this analysis?

Scenario 1 is a four-table join followed by OLS regression on 588,000 rows. That is well within Presto's capability — Presto is watsonx.data's primary interactive query engine and executes this join in under a second against Iceberg tables in Azure Data Lake Gen2. The notebook cost summary reflects this: the four Presto join queries cost ~£0.18 in total.

Spark earns its cost (~£1.80 for 1.5 hours) for iterative ML training loops, large-scale feature engineering across billions of rows, or complex ML libraries that Presto cannot run natively. In this notebook, Spark is used only for the statsmodels OLS fit and matplotlib charts — the data work is Presto. **Right engine for the right job** is the watsonx.data design principle.

### How does Confluent Flink data get into watsonx.data?

Through **Tableflow** — and this is one of the architectural strengths of the Confluent + watsonx.data pairing. No ETL job. No separate connector. No data copy.

```
Source systems (TMS, CIAM, Access Control)
        │
        ▼ Kafka topics
Confluent Flink SQL
(transforms, enriches, applies business rules)
        │
        ▼ Tableflow
Iceberg table on Azure Data Lake Gen2
        │
        ▼ registered automatically
watsonx.data Intelligence catalogue
(lineage shows: "came from Confluent topic X")
        │
        ▼ Presto SQL
watsonx.ai Studio notebook
(analyst queries it like any other governed table)
        │
        ▼
Data Product Hub → Power BI
```

Tableflow continuously materialises a Kafka topic as an Apache Iceberg table written to Azure Data Lake Gen2. watsonx.data Premium registers that Iceberg table in its catalogue and queries it with Presto — with full lineage, quality scores and masking policies applied. Confluent owns the left side (streaming, transformation, enrichment). Iceberg is the open handshake format both products speak natively. watsonx.data owns the right side (governance, query, sharing). No middleware between them.

### PII / PHI masking — included in watsonx.data Premium

The notebook shows `email` and `full_name` as `[MASKED]` columns, labelled *"masked by watsonx.data Intelligence policy"*. This is not a separate IBM Cloud Pak for Data purchase. **IBM Knowledge Catalog (IKC) — including dynamic data masking — is bundled inside watsonx.data Premium.**

The masking is policy-driven and dynamic:
- The column exists in the Iceberg table
- The analyst role sees `[MASKED]` at query time
- No data copy, no transformation pipeline, no re-engineering required
- Masking policies are defined once in the catalogue and enforced across every query from every tool (Presto, notebooks, Power BI, API consumers)
- GDPR deletion requests are handled at the catalogue layer — a single policy change, not a pipeline rebuild

### Key findings from the notebook

| Factor | Effect on arrival time |
|--------|----------------------|
| Centre Court Debenture holders | Arrive ~48 min earlier than Grounds Pass |
| International visitors | Arrive ~13–17 min earlier than UK domestic |
| Rain day | Visitors arrive ~37 min **later** on average |
| Hot day (>23 °C) | ~4 min earlier vs. cool day |
| Regression R² | **0.68** — tier + nationality + weather explain most of the variance |

---

## Technology context

| Layer | IBM / Partner technology |
|-------|------------------------|
| Streaming ingest | **Confluent** (Kafka topics → Flink SQL → Tableflow → Iceberg) |
| Data lakehouse | **IBM watsonx.data Premium** (Iceberg tables, Presto/Spark queries) |
| Governance & catalogue | **IBM watsonx.data Intelligence + IKC** (catalogue, masking, lineage, quality) |
| Data product distribution | **IBM Data Product Hub** (self-service subscription, versioned data products) |
| Analytical notebooks | **IBM watsonx.ai Studio** (managed Jupyter, embedded in watsonx.data Premium) |
| Operational dashboard | This GitHub Pages prototype — replaceable by Power BI or any BI tool |

---

## What this platform enables next — Agentic AI

The platform is built on open standards: Iceberg tables, Presto SQL, open APIs. That makes it **agent-ready today**.

### watsonx.data as an MCP server

watsonx.data Premium can be connected as a **Model Context Protocol (MCP) server**. This means any MCP-compatible AI agent — including IBM Bob — can connect to the governed data layer and answer questions in natural language, with masking policies and lineage still enforced.

A business user asks:
> *"Which gates are approaching capacity and what does the weather look like for the next two hours?"*

The agent queries the governed Iceberg tables, applies the masking policy for the user's role, and returns an answer — no custom dashboard required.

### The visualisation layer becomes a choice, not a constraint

Because the data layer is governed and open, AELTC's team can choose how they consume it:

| Consumption pattern | How |
|---------------------|-----|
| **Power BI** | Native watsonx.data connector — governed Iceberg tables appear as semantic datasets |
| **This GitHub Pages UI** | Vanilla JS querying pre-aggregated constants — zero infrastructure |
| **Custom application** | Any application consuming the watsonx.data Presto SQL endpoint or REST API |
| **AI agent / natural language** | watsonx.data as MCP server → IBM watsonx.ai agent → chat interface |
| **Jupyter / notebook** | watsonx.ai Studio embedded in watsonx.data Premium — the notebook in this repo, unchanged |

The governed data platform underneath is the same in every case. **The UI is a choice. The governance is non-negotiable.**

### The agentic pattern

```
                    ┌─────────────────────────────────┐
                    │  watsonx.data Premium             │
                    │  Iceberg tables · Presto SQL      │
                    │  IKC governance · masking         │
                    └────────────────┬────────────────┘
                                     │ MCP server
                    ┌────────────────▼────────────────┐
                    │  IBM watsonx.ai agent            │
                    │  (or any MCP-compatible agent)   │
                    └────────────────┬────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                       ▼
        Natural language        Power BI               Custom UI /
        chat interface          dashboard              GitHub Pages
```

The platform does not lock AELTC into one interface. It exposes governed data as a service that any tool, agent, or application can consume — today and as AI capabilities evolve.

---

## Scenario coverage

| # | Scenario | Status |
|---|----------|--------|
| 1 | Ticket holder arrival pattern analysis | ✅ This repo |
| 2 | Zone occupancy & queue intelligence | Prototype available |
| 3 | Fan engagement & personalisation | Prototype available |

---

## Notes for evaluation

- **All data is synthetic or pre-aggregated.** No raw PII or operational data is included. The CSV uses a synthetic dataset whose marginal distributions match real Championships data; it is safe to share and re-run.
- **The dashboard is fully offline.** Every chart, KPI and simulation runs client-side in vanilla JS with no network calls.
- **The notebook is deterministic.** `SEED = 42` controls all random generation; re-running produces identical results.
- **PII masking is shown explicitly.** `email` and `full_name` columns are labelled `[MASKED]` throughout — this is not cosmetic, it mirrors the watsonx.data Intelligence dynamic masking policy that would apply in production.
- The `extract_real_data.js` script is included for transparency — it shows exactly how the aggregation from raw files to the constants block was performed.

---

## Repo structure decisions

| Decision | Rationale |
|----------|-----------|
| Single HTML file for UI | Zero deployment friction — open in any browser, share via URL, no IBM infrastructure needed |
| Data inlined in HTML | No CORS issues, works offline, no dependency on external data services |
| Local notebook with synthetic data | Evaluatable without provisioning cloud infrastructure; mirrors production platform behaviour cell-by-cell |
| Notebook exports CSV + metadata JSON | Decouples analysis from dashboard; artefacts register directly into Data Product Hub in production |
| `real_data_constants.js` separate | Allows regeneration from new raw data without touching UI code |
| Presto not Spark for join | Right engine for the workload — Presto handles the 4-table join at pennies; Spark reserved for ML training |

---

## Contact

IBM Technology Sales — Data & AI  
For questions on platform architecture, the agentic AI roadmap, or next steps, reach out to your IBM account team.
