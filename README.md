<a id="recon"></a>
<div align="center">

<img src="docs/assets/branding/recon-lockup.svg" alt="RECON — REC Observation Network" width="85%" style="max-width: 860px; margin: 6px 0 12px;" />

<a href="#quick-start">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=17&duration=2600&pause=900&color=10B981&center=true&vCenter=true&width=760&lines=AI-Powered+Renewable+Energy+Certificate+Fraud+Surveillance;Tri-Witness+Cross-Examination%3A+Physics+%C2%B7+Statistics+%C2%B7+Custody;Open-Meteo+Historical+Weather+%26+Diurnal+Solar+Plausibility;Directed+Multigraph+Trading+Cycles+%26+Wash-Trade+Forensics;Isolation+Forest+%2B+Platt-Calibrated+Anomaly+Scoring;Immutable+ERC-721+Registry+with+On-Chain+Double-Sale+Locks" alt="RECON Telemetry Stream" />
</a>

<br/>
<br/>

<p align="center">
  <a href="https://recon-navy-nu.vercel.app/"><img src="https://img.shields.io/badge/Live_Platform-recon--navy--nu.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=38bdf8" alt="Live Console" /></a>
  <a href="https://fastapi.tiangolo.com"><img src="https://img.shields.io/badge/FastAPI-0.115+-000000?style=for-the-badge&logo=fastapi&logoColor=009688" alt="FastAPI" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16_App_Router-000000?style=for-the-badge&logo=next.js&logoColor=ffffff" alt="Next.js 16" /></a>
  <a href="https://ethereum.org"><img src="https://img.shields.io/badge/Solidity-^0.8.20_ERC--721-000000?style=for-the-badge&logo=solidity&logoColor=627EEA" alt="Solidity" /></a>
  <a href="https://scikit-learn.org"><img src="https://img.shields.io/badge/scikit--learn-Isolation_Forest-000000?style=for-the-badge&logo=scikitlearn&logoColor=F7931E" alt="scikit-learn" /></a>
  <a href="https://networkx.org"><img src="https://img.shields.io/badge/NetworkX-MultiDiGraph-000000?style=for-the-badge&logo=python&logoColor=3776AB" alt="NetworkX" /></a>
</p>

<p align="center">
  <a href="backend/tests/"><img src="https://img.shields.io/badge/Tests-199%20Passing%20(176%20pytest%20%2B%2023%20Hardhat)-0A0A0A?style=flat-square&logo=pytest&logoColor=10B981" alt="199 Tests Passing" /></a>
  <a href="backend/tests/"><img src="https://img.shields.io/badge/Coverage-High-0A0A0A?style=flat-square&color=10B981&labelColor=0A0A0A" alt="High Coverage" /></a>
  <a href="contracts/contracts/RECRegistry.sol"><img src="https://img.shields.io/badge/EVM-Local%20(31337)%20%7C%20Sepolia-0A0A0A?style=flat-square&logo=ethereum&logoColor=38BDF8" alt="EVM Compatible" /></a>
  <a href="https://open-meteo.com/"><img src="https://img.shields.io/badge/Weather-Open--Meteo%20Historical%20API-0A0A0A?style=flat-square&logo=googleearth&logoColor=F59E0B" alt="Open-Meteo Historical API" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-0A0A0A?style=flat-square&logo=opensourceinitiative&logoColor=D4A63A" alt="MIT License" /></a>
  <a href="https://github.com/prathamkariya/RECON-REC-Observation-Network/commits/main"><img src="https://img.shields.io/github/last-commit/prathamkariya/RECON-REC-Observation-Network?style=flat-square&color=38BDF8&labelColor=0A0A0A" alt="Last Commit" /></a>
</p>

<img src="docs/assets/branding/recon-pillars-banner.svg" alt="Physical Truth • Statistical Precision • Network Topology • Cryptographic Trust" width="88%" style="max-width: 860px; margin: 8px 0 16px;" />

<p align="center">
  <a href="#overview"><b>Overview</b></a> •
  <a href="#the-trust-problem"><b>The Trust Problem</b></a> •
  <a href="#observation-workflow"><b>Observation Workflow</b></a> •
  <a href="#three-intelligence-witnesses"><b>Three Witnesses</b></a> •
  <a href="#investigation-dossier"><b>Investigation</b></a> •
  <a href="#blockchain-verification"><b>Blockchain</b></a> •
  <a href="#system-architecture"><b>Architecture</b></a> •
  <a href="#tech-stack-deep-dive"><b>Tech Stack</b></a> •
  <a href="#quick-start"><b>Quick Start</b></a>
</p>

</div>

---
<a id="overview"></a>

## 🛰️ Overview

> **RECON** (REC Observation Network) is an institutional fraud surveillance engine and forensic intelligence platform for Renewable Energy Certificate (REC) markets.

A Renewable Energy Certificate represents proof that 1 megawatt-hour (MWh) of green power was generated and fed into the power grid. Today's certification registries rely on delayed manual auditing and trust assumptions. Fraudulent issuances, impossible night solar generation, duplicate certificates, and wash-trading rings regularly slip through undetected.

RECON cross-examines every certificate claim from three independent perspectives—**atmospheric physics**, **statistical anomalies**, and **custody graph topology**—before a single token is minted. Clean claims receive cryptographic ERC-721 certificates on-chain; fraudulent claims produce an immutable forensic dossier for regulatory enforcement.

<br/>

### Comparison Matrix

| Capability | Legacy REC Registries | RECON Observation Network |
| :--- | :--- | :--- |
| **Verification Basis** | Unverified self-reported utility spreadsheets | **Tri-witness cross-examination (Physics + Stats + Graph)** |
| **Physics Verification** | None; trusted blindly | **Open-Meteo hourly weather cross-check & diurnal solar envelope** |
| **Trading Surveillance** | Isolated counterparty records | **NetworkX multigraph cycle detection & Louvain cluster density** |
| **Detection Speed** | Months-delayed annual audit reconciliations | **Sub-second pre-flight scoring prior to on-chain minting** |
| **Explainability** | Opaque pass/fail or black-box manual review | **Ranked evidence hierarchy & plain-English forensic findings** |
| **Double-Sale Prevention**| Centralized database flag susceptible to race conditions | **On-chain `keccak256` generation key & permanent retirement locks** |

---
<a id="the-trust-problem"></a>

## ⚡ The Trust Problem

> **"Can you trust a clean energy certificate just because a database entry exists?"**

Existing certification ecosystems face four critical failure modes that distort sustainability reporting and green finance:

1. **Impossible Timing**: Solar facilities claiming power production at 02:00 AM local time (outside daylight irradiance hours).
2. **Over-Capacity Generation**: Claimed output exceeding 100% of physical nameplate capacity ($> 1.0\times \rightarrow 2.0\times$).
3. **Statistical Volumetric Cliffs & Drift**: Rapid issuance velocity anomalies and artificial meter readouts that violate Benford’s law ($p < 0.05$).
4. **Recirculating Trading Rings**: Colluding counterparties washing certificates in closed cycles to inflate clean energy trading volume.

<br/>

<div align="center">
  <img src="docs/assets/fraud-scenario.svg" alt="Physical Mismatch Fraud Case Study" width="100%" style="border-radius: 12px; border: 1px solid #1e293b;" />
</div>

---
<a id="observation-workflow"></a>

## 🔄 Observation Workflow

RECON operates on a strict principle: **No certificate enters circulation without passing multi-dimensional cross-examination.**

Claims pass through pre-flight analytical pipelines where atmospheric weather models, unsupervised machine learning, and custody graph analytics evaluate risk simultaneously.

<br/>

<div align="center">
  <img src="docs/assets/workflows/recon-workflow.svg" alt="RECON End-to-End Workflow" width="100%" style="border-radius: 12px; border: 1px solid #1e293b;" />
</div>

<br/>

### Surveillance in Action

When a high-risk claim enters the platform, the telemetry pulse triggers immediate multi-engine disqualification:

<div align="center">
  <img src="docs/assets/workflows/detection-flow.svg" alt="Detection Pipeline in Action" width="100%" style="border-radius: 12px; border: 1px solid #1e293b;" />
</div>

---
<a id="three-intelligence-witnesses"></a>

## 🧠 Three Intelligence Witnesses

A single fraud detector can be gamed. Three independent witnesses that share no common inputs cannot be fooled at once.

<br/>

<div align="center">
  <img src="docs/assets/hero/recon-hero.svg" alt="Tri-Witness Observation Pipeline" width="100%" style="border-radius: 12px; border: 1px solid #1e293b;" />
</div>

<br/>

### 1. Statistical Intelligence
*“Does this certificate behave abnormally compared to its historical and regional peers?”*

An unsupervised Isolation Forest model (100 estimators, contamination=0.17 calibrated against the 16.9% benchmark fraud rate across 1,242 certificates) evaluates 9 engineered domain features:
* `capacity_utilization_ratio`: Claimed output versus plant rated nameplate capacity.
* `per_plant_min_gap_hours`: Inter-issuance gap detecting timestamp collisions (Single-Feature AUC: **0.965**).
* `transfer_velocity`: Trading churn velocity targeting circular trading rings (Single-Feature AUC: **0.740**).
* `generator_benford_deviation`: Chi-square goodness-of-fit against Benford's law for artificial meter readouts ($p < 0.05$).
* `per_plant_utilization_zscore`, `issuance_velocity`, `buyer_concentration`, `time_of_day_plausibility`, and `serial_duplicate_flag`.

Raw tree isolation depths are calibrated into genuine probabilities ($r_{\text{stat}} \in [0, 1]$) via **Platt scaling** (logistic calibration), with deterministic physical anchors enforcing $P = 1.0$ on binary timestamp collisions and duplicate serials.

<div align="center">
  <img src="docs/assets/intelligence/statistical.svg" alt="Statistical Intelligence Scatter and Feature Weights" width="100%" style="border-radius: 12px; border: 1px solid #1e293b;" />
</div>

<br/>

### 2. Network Intelligence
*“Does trading behavior form a suspicious circular or wash-trading network?”*

RECON models certificate transfers across generators, aggregators, and buyers as a directed multigraph (`NetworkX MultiDiGraph`). It uncovers elementary cycles ($\text{length} \le 15$) where certificates loop back to issuer affiliates, alongside subgraphs exhibiting transfer densities $> 3.0\times$ the market baseline.

<div align="center">
  <img src="docs/assets/intelligence/network.svg" alt="Network Intelligence Trading Cycle Detection" width="100%" style="border-radius: 12px; border: 1px solid #1e293b;" />
</div>

<br/>

### 3. Physical Validation
*“Could this generation physically have occurred at the plant's GPS coordinates?”*

Generation claims are cross-examined against historical hourly weather reanalysis from **Open-Meteo** (`archive-api.open-meteo.com`) at the plant’s exact latitude and longitude:
* **Solar Diurnal Envelope**: Solar claims outside daylight hours (06:00–18:00 IST) trigger immediate physical disqualification ($r_{\text{timing}} = 1.0$). Within daylight hours, low surface shortwave radiation ($< 50\text{ W/m}^2$) contributes gradient evidence ($0.4$). Wind generation is uniform 24h and exempt from day/night timing checks.
* **Capacity Plausibility**: Claimed output exceeding rated capacity triggers a linear ramp ($1.0\times \rightarrow 2.0\times$) up to maximum physical impossibility ($r_{\text{capacity}} = 1.0$).

<div align="center">
  <img src="docs/assets/intelligence/physical.svg" alt="Physical Validation Solar Irradiance Envelope" width="100%" style="border-radius: 12px; border: 1px solid #1e293b;" />
</div>

<div align="center">
  <img src="docs/assets/intelligence/observation-signals.svg" alt="Three Observation Signals Combined" width="100%" style="border-radius: 12px; border: 1px solid #1e293b;" />
</div>

<br/>

### Probabilistic Risk Fusion

The three engine scores are synthesized into a composite fraud probability ($R \in [0, 100]$) using **Noisy-OR probabilistic fusion**:

$$R = 100 \times \left( 1 - \prod_{i \in \{\text{phys}, \text{stat}, \text{graph}\}} (1 - r_i) \right)$$

* Claims with $R < 50$ are certified as clean and approved for on-chain ERC-721 minting.
* Claims with $R \ge 50$ are quarantined, logged to the tamper-evident hash-chain audit ledger, and barred from tokenization.

---
<a id="investigation-dossier"></a>

## 📋 Investigation Dossier

> **Detection tells you WHAT is suspicious. Evidence tells you WHY.**

RECON replaces opaque risk numbers with deterministic evidence dossiers. Every flagged certificate surfaces the exact physical laws violated, peer standard deviations crossed, and counterparty entities involved.

<br/>

<div align="center">
  <img src="docs/assets/investigation/investigation-dossier.svg" alt="Investigation Dossier Hierarchy" width="100%" style="border-radius: 12px; border: 1px solid #1e293b;" />
</div>

<br/>

Each investigation record contains:
* **Composite Risk Score (0–100)**: Probability outcome synthesized across all three observation engines.
* **Primary Evidence (Smoking Gun)**: The highest-ranking determining factor (e.g., night solar generation at $0\text{ W/m}^2$).
* **Supporting Corroboration**: Secondary anomalies including trading velocity spikes, peer capacity cliffs, and Benford drift.
* **Synthesized Finding**: Plain-English narrative generated via Groq API (with deterministic rule-based fallback).
* **Cryptographic Verification Proof**: On-chain token ID, transaction hash, and immutable generation record key.

---

## 🎯 Explainability Pipeline

Regulatory enforcement demands defensible findings. RECON ranks signals through an immutable precedence hierarchy:

```mermaid
flowchart LR
    A["Raw Multimodal Signals"] --> B["Deterministic Precedence"]
    
    subgraph Precedence ["Evidence Priority"]
        B1["1. PHYSICAL MISMATCH<br/>(Hard Thermodynamic Limit)"]
        B2["2. GRAPH TRADING CYCLE<br/>(Wash-Trading Recirculation)"]
        B3["3. GRAPH CLUSTER DENSITY<br/>(Abnormal Colocation Ring)"]
        B4["4. STATISTICAL OUTLIER<br/>(Isolation Forest Drift)"]
    end
    
    B --> B1
    B1 --> B2
    B2 --> B3
    B3 --> B4
    
    Precedence --> C["Forensic Context Assembly"]
    C --> D["Groq API / Rule Engine"]
    D --> E["Court-Defensible Finding"]

    classDef default fill:#0f172a,stroke:#334155,stroke-width:1px,color:#f8fafc;
    classDef priority fill:#300d14,stroke:#ef4444,stroke-width:1.5px,color:#fca5a5;
    classDef result fill:#064e3b,stroke:#10b981,stroke-width:1.5px,color:#6ee7b7;

    class B1 priority;
    class E result;
```

---
<a id="blockchain-verification"></a>

## 🔒 Blockchain Verification

> **AI detects. Blockchain preserves. Anyone can verify.**

Blockchains cannot determine whether an energy generation claim was physically honest. Writing unverified data to a blockchain merely immortalizes fraud.

RECON uses AI off-chain to detect fraud *before* minting. Once validated, the smart contract (`RECRegistry.sol`) guarantees mathematical uniqueness, prevents double-spending, and provides public auditability.

<br/>

<div align="center">
  <img src="docs/assets/workflows/verification-flow.svg" alt="Blockchain Verification Architecture" width="100%" style="border-radius: 12px; border: 1px solid #1e293b;" />
</div>

<br/>

### Smart Contract Guarantees (`RECRegistry.sol`)
* **Unique Generation Key**: Prevents double-certification by enforcing a cryptographic fingerprint:
  $$\text{RecordKey} = \text{keccak256}(\text{abi.encode}(\text{plantId}, \text{energyMWh}, \text{generationTimestamp}))$$
  Submitting the same generation slice twice reverts on-chain with `RecordAlreadyCertified(...)`. The backend pre-flights this with the free `isRecordUsed()` view function prior to gas estimation.
* **On-Chain Risk Scores**: The fraud score (0–100) is permanently stored in the token's `Certificate` struct at mint time (`issueCertificate`). Downstream green markets can programmatically inspect and reject high-risk certificates.
* **Permanent Retirement Protection**: Calling `retireCertificate(tokenId)` permanently sets `retired = true`. The contract overrides `_update()` to revert with `CertificateAlreadyRetired(tokenId)` if any transfer of a retired certificate is attempted.
* **Zero-Auth Public Verification**: Any market participant can query the smart contract via JSON-RPC or call `GET /verify/{id}` to inspect on-chain state without an account or API key.

---
<a id="system-architecture"></a>

## 🏗️ System Architecture

RECON pairs a modern Next.js 16 frontend with high-performance Python analytical microservices, in-process Hardhat EVM testing, and live Ethereum Sepolia deployment.

<br/>

<div align="center">
  <img src="docs/assets/architecture/recon-architecture.svg" alt="RECON System Architecture Diagram" width="100%" style="border-radius: 12px; border: 1px solid #1e293b;" />
</div>

<br/>

```mermaid
graph TB
    subgraph Client ["Frontend Tier (:3000)"]
        UI["Next.js 16 Dashboard · React 19"]
        Wagmi["viem / wagmi Web3 Client"]
    end

    subgraph Gateway ["API Gateway Tier (:8000)"]
        API["FastAPI Orchestrator"]
        Router["Certificate & Analysis Routers"]
        Web3Client["web3.py Connector"]
    end

    subgraph Intelligence ["Observation & Intelligence Layer"]
        ML["Statistical Engine<br/>(Isolation Forest + Platt)"]
        Graph["Network Engine<br/>(NetworkX MultiDiGraph)"]
        Weather["Physical Engine<br/>(Open-Meteo Weather API)"]
        Fusion["Noisy-OR Risk Fusion Engine"]
        Explain["Forensic Explainer<br/>(Groq API / Rule Fallback)"]
    end

    subgraph Persistence ["Storage & Settlement Tier"]
        Ledger["Append-Only Hash Chain<br/>(SQLite / PostgreSQL)"]
        EVM["ERC-721 RECRegistry.sol<br/>(Hardhat :8545 / Sepolia)"]
    end

    UI --> API
    Wagmi -.->|"Direct RPC Call"| EVM
    API --> Router
    Router --> ML & Graph & Weather
    ML & Graph & Weather --> Fusion
    Fusion --> Explain
    Explain --> Router
    Router --> Ledger
    Router --> Web3Client
    Web3Client --> EVM

    classDef default fill:#0f172a,stroke:#334155,stroke-width:1px,color:#f8fafc;
    classDef client fill:#172554,stroke:#3b82f6,stroke-width:1.5px,color:#93c5fd;
    classDef engine fill:#1e1b4b,stroke:#8b5cf6,stroke-width:1.5px,color:#c084fc;
    classDef chain fill:#064e3b,stroke:#10b981,stroke-width:1.5px,color:#6ee7b7;

    class UI,Wagmi client;
    class ML,Graph,Weather,Fusion,Explain engine;
    class EVM chain;
```

---
<a id="tech-stack-deep-dive"></a>

## 💻 Tech Stack Deep Dive

RECON's architecture is organized into five specialized engineering tiers, balancing high-speed statistical computing, deterministic blockchain guarantees, and real-time visual surveillance.

<br/>

<div align="center">
  <img src="docs/assets/architecture/tech-stack.svg" alt="RECON Tech Stack 5-Pillar Architecture" width="100%" style="border-radius: 12px; border: 1px solid #1e293b;" />
</div>

<br/>

### 1. Machine Learning & Scientific Computing
<p>
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.11" />
  <img src="https://img.shields.io/badge/scikit--learn-1.4+-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white" alt="scikit-learn" />
  <img src="https://img.shields.io/badge/NetworkX-3.2+-000000?style=for-the-badge&logo=python&logoColor=white" alt="NetworkX" />
  <img src="https://img.shields.io/badge/pandas-2.2+-150458?style=for-the-badge&logo=pandas&logoColor=white" alt="pandas" />
  <img src="https://img.shields.io/badge/NumPy-1.26+-013243?style=for-the-badge&logo=numpy&logoColor=white" alt="NumPy" />
</p>

* **`scikit-learn` (Isolation Forest + Platt Scaling)**: Unsupervised anomaly detection isolating out-of-distribution volumetric claims. Raw tree isolation depths are calibrated via sigmoid logistic regression (Platt scaling) to yield probabilistic risk values $r_{\text{stat}} \in [0, 1]$.
* **`NetworkX` (MultiDiGraph)**: Directed multigraph representation of market participants. Implements Johnson's elementary cycle algorithm ($\text{length} \le 15$) to detect circular wash-trading loops, and Louvain modularity to flag high-density collusive clusters ($> 3.0\times$ market baseline).
* **`pandas` & `NumPy`**: Vectorized domain feature engineering (9 features including capacity factor z-scores, issuance velocity derivatives, and Benford first-digit Kolmogorov-Smirnov p-values).

### 2. Backend Orchestration & Microservices
<p>
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Pydantic-v2-E92063?style=for-the-badge&logo=pydantic&logoColor=white" alt="Pydantic" />
  <img src="https://img.shields.io/badge/SQLAlchemy-2.0+-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white" alt="SQLAlchemy" />
  <img src="https://img.shields.io/badge/Web3.py-7.x-F16822?style=for-the-badge&logo=ethereum&logoColor=white" alt="Web3.py" />
  <img src="https://img.shields.io/badge/Uvicorn-ASGI-499848?style=for-the-badge&logo=gunicorn&logoColor=white" alt="Uvicorn" />
</p>

* **`FastAPI`**: High-performance asynchronous REST gateway serving sub-second inference pipelines (`/certificates/analyze` for pre-flight scoring, `/certificates/issue` for on-chain minting).
* **`Pydantic v2`**: Strict runtime schema enforcement ensuring certificate payloads conform to telemetry standards before reaching models.
* **`SQLAlchemy`**: Manages the append-only audit trail and local persistence with cryptographic hash chaining (`prev_hash` $\rightarrow$ `current_hash`).
* **`Web3.py`**: Interacts with local Hardhat EVM nodes and Ethereum Sepolia contracts, packaging and dispatching minting transactions with dynamic gas estimation.

### 3. Smart Contracts & Trust Layer
<p>
  <img src="https://img.shields.io/badge/Solidity-^0.8.20-363636?style=for-the-badge&logo=solidity&logoColor=white" alt="Solidity" />
  <img src="https://img.shields.io/badge/OpenZeppelin-5.x-4E5EE4?style=for-the-badge&logo=openzeppelin&logoColor=white" alt="OpenZeppelin" />
  <img src="https://img.shields.io/badge/Hardhat-2.22+-FFF100?style=for-the-badge&logo=hardhat&logoColor=black" alt="Hardhat" />
  <img src="https://img.shields.io/badge/Ethereum-Sepolia-627EEA?style=for-the-badge&logo=ethereum&logoColor=white" alt="Sepolia" />
</p>

* **`Solidity ^0.8.20` (`RECRegistry.sol`)**: ERC-721 standard implementation extended with an on-chain mapping `recordKeyUsed[bytes32]`. Enforces generation uniqueness:
  $$\text{Key} = \text{keccak256}(\text{abi.encode}(\text{plantId}, \text{energyMWh}, \text{generationTimestamp}))$$
* **`OpenZeppelin Contracts`**: Production-grade `ERC721Enumerable` and `Ownable` primitives ensuring standardized compliance and verified access control.
* **`Hardhat`**: Automated compilation, deployment scripting, and fast in-process EVM test execution.

### 4. Analyst Console & Frontend
<p>
  <img src="https://img.shields.io/badge/Next.js-16_App_Router-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19.0-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/wagmi-2.x-000000?style=for-the-badge&logo=ethereum&logoColor=white" alt="wagmi" />
</p>

* **`Next.js 16` & `React 19`**: App router architecture leveraging React Server Components for initial load speed and reactive client components for interactive surveillance.
* **`Tailwind CSS v4`**: Custom Stitch "Fidelity Technical Editorial" theme utilizing translucent liquid glass panels, obsidian backgrounds, and calibrated signal indicators.
* **`viem` / `wagmi`**: Lightweight Web3 hooks enabling instant, zero-auth public reading of on-chain certificate state directly from RPC providers.

### 5. Oracles, AI Explainability & Infrastructure
<p>
  <img src="https://img.shields.io/badge/Open--Meteo-Historical_API-F59E0B?style=for-the-badge&logo=googleearth&logoColor=white" alt="Open-Meteo" />
  <img src="https://img.shields.io/badge/Groq-LPU_Inference_API-F55036?style=for-the-badge&logo=groq&logoColor=white" alt="Groq API" />
  <a href="https://recon-navy-nu.vercel.app/"><img src="https://img.shields.io/badge/Vercel-Cloud_Deployment-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" /></a>
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
</p>

* **`Open-Meteo REST API`**: Historical archive endpoint (`archive-api.open-meteo.com`) delivering hourly shortwave radiation, cloud cover, and wind speed at plant GPS coordinates, cached locally in `weather_cache.json`.
* **`Groq API`**: High-speed, low-latency LLM inference engine synthesizing multi-engine anomalies into concise, court-defensible plain-English dossiers, backed by a deterministic rule-based fallback.
* **`Vercel Cloud Deployment`**: Production edge hosting for the Next.js 16 surveillance console and interactive analyst dashboard at [`recon-navy-nu.vercel.app`](https://recon-navy-nu.vercel.app/) with automated continuous deployment.
* **`Docker Compose`**: Multi-container declarative orchestration packaging Next.js, FastAPI, and local Hardhat into a unified local environment.
* **`PostgreSQL 15`**: Relational persistence and audit ledger storing historical plant telemetry, certificate lineage, and analysis logs.

---
<a id="quick-start"></a>

## 🚀 Quick Start

Launch the complete RECON platform locally with one command:

```bash
# 1. Clone repository
git clone https://github.com/prathamkariya/RECON-REC-Observation-Network.git
cd RECON-REC-Observation-Network

# 2. Start full stack (Frontend, Backend, and Hardhat EVM node)
docker compose up --build
```

### Access Endpoints

| Service | Address | Role |
| :--- | :--- | :--- |
| **Live Production Console** | [recon-navy-nu.vercel.app](https://recon-navy-nu.vercel.app/) | Cloud edge surveillance console deployed on Vercel |
| **Surveillance Dashboard** | `http://localhost:3000` | Local operator console, registry, and analysis views |
| **API Documentation** | `http://localhost:8000/docs` | Interactive Swagger API explorer and schema contracts |
| **Hardhat EVM Node** | `http://localhost:8545` | Local in-process Ethereum test environment |

---

## 📊 Verified Metrics

All statistics are verified directly against repository test suites, benchmarks, and source code:

<div align="center">

| Metric | Verified Value | Benchmark Reference |
| :---: | :---: | :--- |
| **Automated Tests** | **199 Passing** | 176 backend pytest tests (12 suites) + 23 Hardhat unit & integration tests |
| **Benchmark Dataset** | **1,242 Records** | 689 solar, 553 wind certificates across 310 market parties (16.9% fraud baseline) |
| **Detection Witnesses** | **3 Independent** | Atmospheric physics (Open-Meteo), Isolation Forest statistics, custody multigraph |
| **Decision Threshold** | **50 / 100 (0.50)** | Calibrated Noisy-OR cut point for high-risk flags (`FLAGGED_THRESHOLD = 0.5`) |
| **Duplicate Prevention** | **100% Guaranteed** | Reverts on-chain via unique `keccak256` generation key in `RECRegistry.sol` |

</div>

---

<details>
<summary><b>Technical Implementation &amp; Deep Dive</b></summary>

<br/>

### Five Mock-or-Real Adapters
RECON backend services are designed for zero-config local development with instant opt-in to live production integrations via environment variables in `backend/.env`:

* `USE_REAL_ML` (default: `false`): When `true`, executes the trained `IsolationForest` model (`ml/model.joblib`) with Platt scaling. When `false`, uses the calibrated statistical mock.
* `USE_REAL_GRAPH` (default: `false`): When `true`, runs cycle detection and Louvain community analysis against the full NetworkX market graph. When `false`, uses the deterministic graph mock.
* `USE_REAL_WEATHER` (default: `false`): When `true`, queries historical weather reanalysis and diurnal solar models via Open-Meteo REST API with local disk caching. When `false`, uses the physical calculation mock.
* `USE_REAL_EXPLAIN` (default: `false`): When `true`, calls the Groq API to synthesize plain-English findings with ultra-low latency. When `false`, uses the deterministic rule-based ranking engine.
* `USE_REAL_LEDGER` (default: `false`): When `true`, writes every analysis event to PostgreSQL. When `false`, records to local SQLite.

### Running Test Suites
```bash
# Run backend pytest suite (176 tests across 12 suites)
cd backend
pytest -v

# Run smart contract Hardhat tests (23 tests)
cd contracts
npx hardhat test
```

### Repository Structure
```
RECON-REC-Observation-Network/
├── backend/                  # FastAPI orchestration server
│   ├── app/
│   │   ├── routers/          # /certificates, /recs, /status
│   │   ├── service.py        # Noisy-OR fusion & pipeline orchestration
│   │   ├── config.py         # 5 adapter flags & environment configuration
│   │   └── web3_client.py    # Hardhat / Sepolia smart contract connector
│   └── tests/                # 12 comprehensive pytest test suites (176 tests)
├── contracts/                # Solidity smart contract suite
│   ├── contracts/            # RECRegistry.sol (ERC-721 + unique record key)
│   ├── scripts/              # Deployment and seed minting scripts
│   └── test/                 # Hardhat unit tests (23 tests)
├── dashboard/                # Next.js 16 / React 19 surveillance console (deployed on Vercel)
│   ├── app/                  # App router pages (dashboard, verify, issue, etc.)
│   ├── components/           # UI components, control room charts, glass panels
│   └── lib/                  # Web3 configuration (viem/wagmi) and API client
├── graph_explain/            # Graph analytics and explainability modules
│   ├── graph/                # NetworkX cycle detection & Louvain clustering
│   ├── weather/              # Open-Meteo historical weather & physical check
│   └── llm/                  # Groq API explainer & deterministic rule fallback
├── ml/                       # Machine learning pipeline
│   ├── model.py              # Isolation Forest + Platt scaling calibration
│   └── feature_engineering.py# 9 engineered domain features
├── ledger_cloud/             # Append-only hash chain audit ledger
└── docs/assets/              # Architectural diagrams and branding assets
```

</details>

---

<div align="center">

<img src="docs/assets/branding/recon-mark.svg" alt="RECON Mark" width="44" height="44" style="vertical-align: middle; margin-bottom: 6px;" />

<br/>

**RECON — REC OBSERVATION NETWORK**  
*AI Fraud Intelligence &amp; Cryptographic Verification for Clean Energy Markets*

[Return to Top ↑](#recon)

</div>
