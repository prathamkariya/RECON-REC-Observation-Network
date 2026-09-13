# RECON — Proposal Deck Guide

A step-by-step guide to building the RECON proposal presentation (HackOut'26,
Team Synapse'27). Every model, number and technology below is taken from this
repository — cite the file next to each figure so anyone can check it.

---

## Contents

1. [Before you start](#1-before-you-start)
2. [Proposal deck conventions](#2-proposal-deck-conventions)
3. [Visual system](#3-visual-system)
4. [Slide-by-slide build](#4-slide-by-slide-build)
5. [Fact sheet: models, data, results](#5-fact-sheet-models-data-results)
6. [Fact sheet: tech stack](#6-fact-sheet-tech-stack)
7. [Screenshots and diagrams to capture](#7-screenshots-and-diagrams-to-capture)
8. [Speaker notes and rehearsal](#8-speaker-notes-and-rehearsal)
9. [Final checklist](#9-final-checklist)

---

## 1. Before you start

**Step 1 — Know the audience and the time slot.** Hackathon judges score
problem clarity, technical depth, working demo, and impact. Ask the organisers
for the pitch length (usually 5–10 min) and whether a live demo is allowed.

**Step 2 — Write the one-sentence pitch first.** Every slide must support it:

> RECON catches fraudulent Renewable Energy Certificates before they are
> issued — combining an ML anomaly model, trading-ring graph analysis and
> weather physics — and records the verdict immutably on Ethereum.

**Step 3 — Fix open items in the code *before* they go on a slide.**

| Item | Where | Action |
| --- | --- | --- |
| Claude model is `claude-3-5-sonnet-20241022` | `graph_explain/llm/explainer.py:145`, `graph_explain/llm/audit_chat.py:26` | That model is retired by Anthropic, so real calls fail and the app silently falls back to its deterministic explainer. Update to a current model (e.g. `claude-sonnet-5`) and re-test `USE_REAL_EXPLAIN=true` before claiming "Claude-generated explanations". |
| Headline ML metric | `ml/stat_risk.md` states holdout F1 **0.701** | Re-run `python ml/model.py` and copy the printed precision / recall / F1 onto the slide, so the number matches what the code produces today. |
| Docker stack | `docker compose up --build` | Confirm it runs end to end before showing "one-command deploy". |

**Step 4 — Pick a tool.** Google Slides (easy team editing), PowerPoint, or
Keynote. Set **16:9** before adding anything.

---

## 2. Proposal deck conventions

Follow these on every slide.

**Structure**
- **12–14 slides** for a 7–10 minute pitch (roughly 40 seconds per slide). Put
  extra detail in an appendix after the closing slide.
- Standard proposal order: **Problem → Solution → How it works → Proof
  (results/demo) → Impact → Roadmap → Team → Ask.**
- **One idea per slide.** The slide title *is* that idea, written as a claim:
  "Single models miss fraud rings", not "Model limitations".

**Text**
- Maximum **6 bullets, ~6 words each** (the 6×6 rule). Fewer is better.
- Titles 32–40 pt, body **no smaller than 20 pt**, captions/sources 12–14 pt.
- No paragraphs on slides. Anything you'd read aloud goes in **speaker notes**.
- Sentence case for titles. No full stops at the end of bullets.
- Spell out an acronym the first time it appears (REC, ERC-721, MWh).

**Numbers and evidence**
- Every number carries its **unit and source** (file path or citation) in a
  small caption.
- Use the **real** metrics in §5 — don't round up or report only the best
  fraud type.
- State limitations honestly (e.g. weak recall on circular trading from the
  ML model alone). It's why the design is multi-signal, and judges trust it.
- Synthetic data must be labelled **"synthetic dataset"** wherever results appear.

**Visuals**
- Prefer a diagram, chart or screenshot over bullets whenever possible.
- One consistent template: same title position, margins and colours throughout.
- Charts: label axes, remove gridline clutter, highlight the one bar or line
  that matters.
- Screenshots from the real app only — no mock-ups presented as the product.

**Delivery**
- Slide numbers on every slide except the title.
- Put the Sepolia contract link and GitHub repo on the closing slide.
- Always have a **recorded demo video** as a backup to the live demo.

---

## 3. Visual system

Match the deck to the product so screenshots sit naturally on the slides.
Colours come from `dashboard/app/globals.css`.

| Role | Token | Hex |
| --- | --- | --- |
| Slide background | `--recon-bg` | `#F4F5F1` |
| Title / body text | `--recon-ink` | `#131B2E` |
| Secondary text | `--recon-ink-dim` | `#5A6270` |
| Primary accent (brand green) | `--recon-gold` | `#3C6450` |
| Dark section slides | `--recon-forest` | `#0F2A20` |
| Verified / clean | `--recon-verified` | `#2F7A57` |
| Warning / medium risk | `--recon-warn` | `#9A6A14` |
| Fraud / high risk | `--recon-risk` | `#B3261E` |
| Dividers, borders | `--recon-titanium` | `#C1C8C2` |

**Fonts** (the same as the app, all free on Google Fonts):
- Titles: **Geist** (fallback: Inter)
- Body: **Inter**
- Numbers, hashes, addresses, code: **IBM Plex Mono**

**Layout rules**
- Margins of at least 0.5 in / 1.25 cm on all sides.
- Light background for content slides; `#0F2A20` for the title, section
  dividers and closing slide.
- Use red `#B3261E` **only** for fraud/risk — never for decoration.

---

## 4. Slide-by-slide build

Each slide lists: **title** (a claim) · **content** · **visual** · **speaker
note** · **source**.

### Slide 1 — Title

- **Title:** RECON — REC Observation Network
- **Subtitle:** Catching renewable-energy certificate fraud before it's issued
- **Footer:** HackOut'26 · Team Synapse'27 · team member names
- **Visual:** dark `#0F2A20` background; a cropped screenshot of the landing hero (`/`)
- **Note:** "We built a fraud detection and verification layer for renewable energy certificates."

### Slide 2 — The problem

- **Title:** A green certificate is only as honest as its issuer
- **Content (3 bullets):**
  - A REC certifies 1 MWh of renewable generation
  - Companies buy RECs to claim sustainability targets
  - Fraud inflates or double-counts that green claim
- **Visual:** simple flow: plant → certificate → buyer → sustainability report
- **Note:** explain why the buyer can't tell a real certificate from a fake one.
- **Source:** add a cited industry source for REC market size or known fraud cases (I-REC, EPA, IEA, or news). Don't invent figures.

### Slide 3 — The five fraud patterns

- **Title:** Five ways a certificate lies
- **Content:** a table of five rows

| Fraud type | What happens |
| --- | --- |
| Over-capacity | Claims more MWh than the plant can physically produce |
| Impossible timing | Solar generation claimed at night |
| Duplicate serial | The same generation certified twice |
| Timestamp collision | Overlapping claims for one plant and time |
| Circular trading | Certificates cycled between parties to fake demand |

- **Visual:** small icon per row; colour the type name `#B3261E`
- **Source:** `ml/generate_data.py` (`FRAUD_TYPES`)

### Slide 4 — Why current checks fail

- **Title:** No single check catches all five
- **Content:**
  - Rule checks miss novel patterns
  - Per-certificate ML misses trading rings
  - Database records can be edited after the fact
- **Visual:** a 3 × 5 grid (check vs. fraud type) with ticks and crosses. Build it from the per-type recall in §5 — this sets up slide 5.

### Slide 5 — The solution

- **Title:** Three independent signals, one verdict, on-chain
- **Content:**
  - **ML:** statistically unusual certificates
  - **Graph:** trading rings between parties
  - **Physics:** weather and capacity plausibility
  - **Claude:** plain-English explanation for auditors
  - **Ethereum:** certify once, retire once
- **Visual:** five labelled blocks feeding into one "risk score" block, then a chain icon
- **Note:** "Each signal covers the others' blind spots."

### Slide 6 — How it works (pipeline)

- **Title:** From generation record to verified certificate
- **Visual:** horizontal pipeline

```
Generation record
  → Isolation Forest (statistical_risk)
  → Graph analysis (graph_risk)
  → Weather check (weather_mismatch_score)
  → Noisy-OR fusion → risk score 0–1
  → Claude explanation
  → Hash-chained ledger + ERC-721 mint (fraud score 0–100 stored on-chain)
```

- **Note:** explain Noisy-OR in one line: *independent signals compound instead of averaging, so one strong red flag can't be diluted by two clean ones.* Formula for the appendix: `risk = 1 − Π(1 − sᵢ)`.
- **Source:** `backend/app/service.py` (`_combine_risk`, `FLAGGED_THRESHOLD = 0.5`)

### Slide 7 — System architecture

- **Title:** Modular by design — every signal can be swapped
- **Visual:** the architecture diagram from `README.md` (§ Architecture), redrawn cleanly with four layers: **Dashboard → FastAPI → Signal modules → Smart contract**
- **Content (callouts):**
  - Each signal has a mock and a real adapter
  - Failed or slow sources degrade to a heuristic
  - Weather 3 s and Claude 5 s timeouts
- **Source:** `backend/app/clients/`, `backend/.env.example`

### Slide 8 — Models

- **Title:** The models behind the score
- **Content:** a table (details in §5)

| Signal | Model / method | Output |
| --- | --- | --- |
| Statistical | Isolation Forest (scikit-learn), 7 engineered features | `statistical_risk` 0–1 |
| Benchmark | Autoencoder (scikit-learn MLPRegressor) — comparison only | reconstruction error |
| Trading rings | NetworkX cycle detection + Louvain communities | `graph_risk` 0–1 |
| Physical | Open-Meteo archive weather + solar timing + capacity ratio | `weather_mismatch_score` 0–1 |
| Explanation | Anthropic Claude (current model — see §1 Step 3) | plain-English text + audit chat |
| Fusion | Noisy-OR | risk score 0–1 |

### Slide 9 — Results

- **Title:** Isolation Forest vs. autoencoder on held-out data
- **Visual:** grouped bar chart of **recall per fraud type**, Isolation Forest vs. autoencoder (numbers in §5). Highlight duplicate serial and impossible timing.
- **Callouts:**
  - Headline F1 from `python ml/model.py` (documented: 0.701)
  - Tuned: contamination 0.15, max_samples 512
  - Circular trading is weak for ML → handled by the graph signal
- **Caption:** "Synthetic dataset: 1,241 certificates, 3,723 transactions, 210 labelled fraud (16.9%)"
- **Source:** `ml/results/per_fraud_type_metrics.csv`, `ml/results/autoencoder_per_file_metrics.csv`, `ml/stat_risk.md`
- **Optional:** include `ml/results/precision_recall_curve.png`

### Slide 10 — On-chain trust layer

- **Title:** The blockchain holds only what must never change
- **Content:**
  - ERC-721: one token = one generation record
  - Duplicate record → `RecordAlreadyCertified` revert
  - Retirement is final — no resale
  - Fraud score at mint stored immutably
- **Visual:** screenshot of the Etherscan contract page, plus the Investigation Dossier's on-chain proof panel
- **Caption (IBM Plex Mono):** Sepolia `0x28190548E1e84fcaC6EEcc5fECaDE138e6154B59` (verified)
- **Source:** `contracts/contracts/RECRegistry.sol`, `contracts/README.md`

### Slide 11 — Product demo

- **Title:** One console for issuers, auditors and buyers
- **Visual:** 2 × 2 screenshot grid — **Control Room** (`/dashboard`), **Investigation Dossier** (`/certificates/[id]`), **Network Intelligence** (`/network`), **Issue flow** (`/issue`)
- **Demo script (60–90 s):**
  1. Issue a clean certificate → low score → mint
  2. Issue an over-capacity certificate → high score and Claude explanation
  3. Open it in the dossier → evidence pillars and on-chain proof
  4. Public `/verify` → check it against the chain from the browser
- **Note:** switch to the recorded video if the network or chain is slow.

### Slide 12 — Tech stack

- **Title:** Built on a production-grade stack
- **Visual:** logos grouped into four columns — **Frontend · Backend & AI · Blockchain · Infrastructure** (full list in §6). Logos plus names only; no version numbers on the slide.

### Slide 13 — Impact and who uses it

- **Title:** Trust for every party in the REC market
- **Content:**
  - **Registries / issuers:** block fraud before issuance
  - **Auditors:** explainable evidence and a tamper-evident trail
  - **Corporate buyers:** verify before claiming green credits
  - **Regulators:** a network view of suspicious trading
- **Note:** tie back to the problem slide.

### Slide 14 — Roadmap

- **Title:** From hackathon to pilot
- **Visual:** three-column timeline — **Now (built) → Next 3 months → 6–12 months**
- **Now:** everything demonstrated today (pipeline, dashboard, Sepolia contract, Docker)
- **Next:** train on real registry data; move the weather signal to satellite irradiance; mainnet or L2 deployment
- **Later:** registry API integrations; multi-registry network graph
- Only list items the team actually plans — mark future work clearly as future.

### Slide 15 — Team

- **Title:** Team Synapse'27
- **Content:** photo, name and one-line role per member, mapped to the four modules:
  - Role 1: ML and synthetic data (`ml/`)
  - Role 2: Graph, weather and explainability (`graph_explain/`)
  - Role 3: Ledger and deployment (`ledger_cloud/`, `contracts/`)
  - Role 4: Backend API and dashboard (`backend/`, `dashboard/`)

### Slide 16 — Closing / ask

- **Title:** RECON: detect, explain, certify
- **Content:** repeat the one-sentence pitch; what you're asking for (a pilot partner, mentorship, judging criteria); GitHub link; Sepolia contract link; QR code to `/verify`
- **Visual:** dark `#0F2A20` background, matching the title slide

### Appendix (after the closing slide)

- A1 — Feature definitions (7 features)
- A2 — Isolation Forest tuning sweep (contamination 0.17 → 0.15, max_samples auto → 512; F1 0.658 → 0.701)
- A3 — Noisy-OR formula with a worked example
- A4 — Full API endpoint table (from `README.md`)
- A5 — Contract functions and custom errors (from `contracts/README.md`)
- A6 — Limitations: synthetic data; ML score is relative to the dataset, not a probability

---

## 5. Fact sheet: models, data, results

### Dataset — `data/`, generated by `ml/generate_data.py`

| | |
| --- | --- |
| Certificates | 1,241 |
| Transactions | 3,723 |
| Labelled fraud | 210 (16.9%) |
| Fraud types | over_capacity, impossible_timing, duplicate_serial, timestamp_collision, circular_trading |
| Nature | **Synthetic**, with seeded anomalies |

### Isolation Forest — `ml/model.py`, `ml/stat_risk.md`

- scikit-learn `IsolationForest`, unsupervised (labels used only for evaluation)
- `contamination=0.15`, `max_samples=512`, `n_estimators=100`
- Tuning raised holdout F1 from **0.658 to 0.701** (documented; re-run to confirm)
- **7 features:** `capacity_utilization_ratio`, `time_of_day_plausibility`,
  `issuance_velocity`, `buyer_concentration`, `serial_duplicate_flag`,
  `per_plant_utilization_zscore`, `generator_benford_deviation`
- **Output:** `statistical_risk`, min-max normalised to 0–1. It's *relative
  unusualness within the dataset*, **not** a fraud probability — say so on the slide.
- The backend reads precomputed scores from `ml/handoff/final_stat_risk.json`

### Holdout metrics per fraud type

| Fraud type | n | IF precision | IF recall | IF F1 | AE recall | AE F1 |
| --- | --- | --- | --- | --- | --- | --- |
| duplicate_serial | 10 | 0.270 | **1.000** | 0.426 | 1.000 | 0.417 |
| impossible_timing | 8 | 0.216 | **1.000** | 0.356 | 1.000 | 0.348 |
| over_capacity | 7 | 0.162 | **0.857** | 0.273 | 0.429 | 0.133 |
| timestamp_collision | 8 | 0.054 | 0.250 | 0.089 | 0.000 | 0.000 |
| circular_trading | 7 | 0.027 | 0.143 | 0.045 | 0.286 | 0.089 |

IF = Isolation Forest (`per_fraud_type_metrics.csv`); AE = autoencoder
benchmark (`autoencoder_per_file_metrics.csv`).

Per-type precision is low because each row counts every flagged certificate
across all types as a potential false positive for that one type, and each
type has fewer than 10 holdout samples. **Use the overall F1 as the headline**
and per-type **recall** for the chart.

**Talking point:** Isolation Forest matches or beats the autoencoder on four of
five types (clearly on over-capacity, 0.857 vs. 0.429 recall). Both are weak on
circular trading, which is a graph-topology pattern — exactly why RECON adds
the graph signal.

### Autoencoder benchmark — `ml/autoencoder.py`

- scikit-learn `MLPRegressor` trained to reconstruct its input through a bottleneck layer
- Anomaly score = reconstruction MSE; same split and contamination (0.15) as the Isolation Forest
- **Benchmark only** — not wired into the pipeline

### Graph fraud-ring detection — `graph_explain/graph/fraud_ring.py`

- NetworkX `MultiDiGraph` of parties and transfers
- `simple_cycles` finds circular trading paths
- `louvain_communities` (seed 42) finds tightly-trading clusters
- Party risk scores combine into `graph_risk` (0–1) and `graph_flag`
- Whole-dataset results precomputed through `POST /admin/graph-preload`

### Physical plausibility — `graph_explain/weather/weather_client.py`

- Open-Meteo historical archive API, converting IST timestamps to UTC
- Solar-timing mismatch (generation claimed without daylight) plus capacity mismatch (claimed MWh vs. rated capacity)
- Output: `weather_mismatch` and `weather_mismatch_score` (0–1); cached; 3 s timeout with heuristic fallback

### Explanation layer — `graph_explain/llm/`

- `explainer.py` sends Anthropic Claude a plain-English summary that leads with the strongest signal
- `audit_chat.py`: auditor Q&A grounded in the certificate and transaction data; model set by `ANTHROPIC_MODEL`
- 5 s timeout, with a deterministic local fallback explanation
- **Update the pinned model before presenting** (see §1 Step 3)

### Risk fusion — `backend/app/service.py`

- Noisy-OR: `risk = 1 − (1 − ml)(1 − graph)(1 − weather)`
- Flagged when risk ≥ 0.5; stored on-chain as an integer 0–100

### Audit ledger — `ledger_cloud/`

- SHA-256 hash-chained blocks, each linked to the previous hash
- `verify.py` re-verifies the whole chain, so editing any block invalidates every later proof

### Smart contract — `contracts/contracts/RECRegistry.sol`

- Solidity 0.8.20, OpenZeppelin 5.0.2 `ERC721Enumerable` + `Ownable`
- Record key `keccak256(abi.encode(plantId, energyMWh, generationTimestamp))`
- Custom errors: `NotAuthorizedIssuer`, `RecordAlreadyCertified`, `FraudScoreOutOfRange`, `CertificateAlreadyRetired`, `NotCertificateOwner`, `CertificateDoesNotExist`
- Sepolia `0x28190548E1e84fcaC6EEcc5fECaDE138e6154B59`, verified on Etherscan; 17 Hardhat tests

---

## 6. Fact sheet: tech stack

### Frontend — `dashboard/package.json`

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4, shadcn/ui on Base UI, tw-animate-css |
| Motion | Framer Motion, Lenis smooth scroll |
| Data | TanStack React Query, Zod, React Hook Form |
| Charts | Recharts |
| Web3 | wagmi 3, viem 2 (read-only verification in the browser) |
| Auth | Firebase Authentication |
| UI extras | lucide-react icons, sonner toasts, next-themes, date-fns |

### Backend and AI

| Area | Technology |
| --- | --- |
| API | Python, FastAPI, Uvicorn, Pydantic 2 |
| Persistence | SQLAlchemy 2 (SQLite locally, Postgres-ready) |
| ML | scikit-learn (Isolation Forest, MLPRegressor), pandas, NumPy, Faker |
| Graph | NetworkX, python-louvain |
| Physical data | Open-Meteo archive API, timezonefinder, requests |
| LLM | Anthropic Claude via the `anthropic` Python SDK |
| Ledger | SHA-256 hash chain (`hashlib`), cryptography |

### Blockchain

| Area | Technology |
| --- | --- |
| Contract | Solidity 0.8.20, OpenZeppelin Contracts 5.0.2 (ERC-721) |
| Tooling | Hardhat 2 + hardhat-toolbox, Etherscan verification |
| Network | Ethereum Sepolia testnet; local Hardhat node |
| Backend client | web3.py 7 (typed errors mapped from 4-byte selectors) |

### Infrastructure

| Area | Technology |
| --- | --- |
| Containers | Docker, Docker Compose (chain + backend + frontend) |
| CI | GitHub Actions (`.github/workflows/onchain.yml`) |
| Testing | pytest, eth-tester, py-solc-x, Hardhat tests, ESLint |

---

## 7. Screenshots and diagrams to capture

Run the app with real data (`NEXT_PUBLIC_USE_MOCK_DATA=false`, backend
running, some certificates seeded), then capture at **1920×1080**, browser
zoom 100%, bookmarks bar hidden, no personal tabs visible.

| # | Capture | Route | Used on |
| --- | --- | --- | --- |
| 1 | Landing hero | `/` | Slide 1 |
| 2 | Control Room overview | `/dashboard` | Slide 11 |
| 3 | Investigation Dossier of a **high-risk** certificate | `/certificates/[id]` | Slides 10, 11 |
| 4 | Network graph with a flagged cluster | `/network` | Slide 11 |
| 5 | Issue flow, step 2 (AI analysis with explanation) | `/issue` | Slide 11 |
| 6 | Physical check envelope chart | `/physical` | Appendix |
| 7 | Public verification result | `/verify` | Slide 11 |
| 8 | Etherscan contract page | sepolia.etherscan.io | Slide 10 |
| 9 | Precision-recall curve | `ml/results/precision_recall_curve.png` | Slide 9 |

**Diagrams to draw** (Figma, Excalidraw or native slide shapes, in the palette from §3):
1. Five-signal solution diagram (slide 5)
2. Pipeline flow (slide 6)
3. Four-layer architecture (slide 7)
4. Signal-vs-fraud-type coverage grid (slide 4)

**Security check before capturing:** no private keys, `.env` contents, API keys
or Firebase credentials visible anywhere — including terminal windows and
browser devtools.

---

## 8. Speaker notes and rehearsal

1. Write speaker notes for every slide, **2–4 sentences**, in the notes pane.
2. Assign each slide to one speaker; plan hand-offs at section breaks (after slides 4, 8 and 12).
3. Time allocation for 8 minutes: problem 1.5 min · solution and architecture 2 min · results 1 min · demo 2 min · impact, roadmap and ask 1.5 min.
4. Rehearse **at least 3 times with a timer**. Cut slides, not speaking speed.
5. Prepare answers to likely judge questions:
   - *"Isn't it synthetic data?"* — Yes. The pipeline is data-agnostic; the next step is real registry data.
   - *"Why Isolation Forest?"* — Unsupervised (fraud labels are rare in reality), fast, and it beat the autoencoder benchmark on over-capacity recall.
   - *"Why blockchain?"* — Only for the two facts that must never change: single certification and final retirement. Scores and analysis stay off-chain.
   - *"What if Claude is down?"* — A 5 s timeout, then a deterministic explanation; the score never depends on the LLM.
   - *"Circular trading recall is low?"* — For the ML model alone, yes; the graph signal exists for exactly that pattern.

---

## 9. Final checklist

**Content**
- [ ] One-sentence pitch appears on the title and closing slides
- [ ] Every slide title is a claim
- [ ] Every number has a unit and a source caption
- [ ] ML metrics copied from a fresh `python ml/model.py` run
- [ ] "Synthetic dataset" labelled on every results slide
- [ ] The Claude model in the code updated from the retired `claude-3-5-sonnet-20241022`, and the real explanation path tested
- [ ] Limitations stated (appendix A6)
- [ ] Contract address and GitHub link correct and clickable

**Design**
- [ ] 16:9, one template, palette and fonts from §3
- [ ] Body text ≥ 20 pt; at most 6 bullets per slide
- [ ] Red used only for risk/fraud
- [ ] Slide numbers on every slide except the title
- [ ] All screenshots from the real app, with no secrets visible

**Delivery**
- [ ] Recorded demo video embedded or ready offline
- [ ] Deck exported to PDF as a backup
- [ ] Rehearsed to time at least 3 times
- [ ] Laptop charged, HDMI/USB-C adapter packed, notifications off
