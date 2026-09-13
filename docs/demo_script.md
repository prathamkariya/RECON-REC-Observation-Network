# RECON — Live Demo Video Script

**Duration:** ~10 minutes · **Team:** Synapse'27 · **Speakers:** 4

> **Pre-recording checklist:**
> - Backend running: `source myenv/bin/activate && PYTHONPATH=. uvicorn backend.app.main:app --reload --port 8000`
> - Dashboard running: `cd dashboard && npm run dev` → http://localhost:3000
> - Verify backend at http://localhost:8000 shows `"chain.ready": true`
> - Live data: 3 on-chain certificates (REC-00001 through REC-00003)
> - Open Etherscan tab: https://sepolia.etherscan.io/address/0x28190548E1e84fcaC6EEcc5fECaDE138e6154B59#code
> - Pre-load all pages in separate tabs for instant transitions

---

## Speaker 1 — The Problem & Landing Page *(~2 min 30 sec)*

**ROLE:** Sets the stage, explains the problem, walks through the landing page and pipeline.

---

**[SCREEN: Landing page — `localhost:3000`]**

> **Speaker 1:**
>
> "Hey everyone, we're Team Synapse'27, and this is **RECON** — the REC Observation Network.
>
> Here's the problem we're solving. Renewable Energy Certificates — RECs — are the backbone of the clean energy market. Companies buy them to prove their power came from solar, wind, or hydro. But right now, the system has a critical flaw: **there's no reliable way to know if a certificate is genuine.**
>
> A solar plant in Gujarat could claim it generated 40 MWh at 2 AM — when the sun isn't even up. The same generation record could be certified twice and sold to two different buyers. A ring of wallets could pass certificates back and forth to inflate trading volume.
>
> Today, these frauds slip through because certificates live on spreadsheets and centralised databases. Nobody cross-checks the physics. Nobody maps the trading patterns. Nobody connects the dots.
>
> **RECON changes that.** Every certificate runs through a multi-signal AI pipeline — then it's minted as an ERC-721 token on Ethereum, where the facts become permanent and publicly verifiable."

**[SCROLL slowly through the landing page — show the hero, signal marquee, pipeline animation]**

> "As you scroll, you can see the five signals that every certificate passes through:
>
> 1. **ML Risk Scoring** — an Isolation Forest trained on real REC trading data flags statistical anomalies
> 2. **Graph Analysis** — Louvain community detection finds fraud rings and suspicious clusters
> 3. **Weather Plausibility** — cross-checks generation claims against actual solar irradiance at those exact coordinates
> 4. **AI Explanation** — Claude writes a plain-English narrative so a human auditor can understand *why* something was flagged
> 5. **Tamper-Evident Ledger** — every pipeline step is hash-chained so nothing can be altered after the fact

**[SCROLL to the live registry section]**

> "And here's the live registry section — these are real certificates already on the Sepolia testnet. You can see our DAIICT solar plant certificates right here, with their fraud scores.
>
> Below that, the chain-split explainer shows what lives on-chain versus off-chain and why — the certificate's uniqueness is on-chain, the reasoning behind its score stays off-chain where it can evolve.
>
> Let me hand over to **[Speaker 2]** who'll show you the Control Room and issue a real certificate live."

---

## Speaker 2 — Control Room & Live Issuance *(~2 min 30 sec)*

**ROLE:** Shows the Control Room dashboard, then issues a certificate through the 3-step wizard.

---

**[SCREEN: Sign-in page — `/signin`]**

> **Speaker 2:**
>
> "Thanks. To access the console, you need to authenticate — we use **Firebase** for email-based auth. Let me sign in."

**[Sign in → redirected to `/dashboard`]**

> "This is the **Control Room** — the nerve centre of the RECON registry.
>
> At a glance you can see the key metrics: we have 3 certificates on-chain, covering 110 MWh of certified energy from 2 plants. One certificate has been retired — meaning it's been permanently consumed against an environmental claim.
>
> Below, the **Anomaly Matrix** plots every certificate by time and fraud score — anything above the red threshold line is flagged. The **Surveillance Feed** on the right shows live registry events — mints, retirements, transfers — as they happen.
>
> And these trend charts show issuance volume over time and energy per plant — you can immediately spot if one plant is claiming disproportionate output."

**[CLICK "Issue certificate" button → navigate to `/issue`]**

> "Now let's issue a new certificate live. This is a **three-step wizard**.
>
> **Step 1 — Generation Data.** I'll enter a solar plant — let's say plant 'IN-GJ-AHD-SOL-04' in Ahmedabad, 25 MWh, generated this morning at 9 AM. Capacity 10 MW, solar fuel type, coordinates 23.07°N, 72.63°E."

**[Fill in form fields, click Submit]**

> "**Step 2 — AI Analysis.** Watch the screen — the backend is now running the full pipeline in real time. The ML model scores it, the graph engine checks for fraud rings, the weather model checks if solar generation was physically possible at those coordinates and that time..."

**[Wait for analysis — point at the fraud gauge, risk score, AI explanation]**

> "Score: 12 out of 100 — clean. The AI says: legitimate generation window, consistent with solar capacity. No anomalies detected. If this had been a nighttime claim, that gauge would be deep red with a detailed explanation of exactly *what's* wrong.
>
> **Step 3 — Mint on-chain.** I click mint — this sends a real transaction to our smart contract on Ethereum Sepolia. Waiting for on-chain confirmation..."

**[Wait for mint — show token ID and tx hash]**

> "Done. Certificate minted. There's the token ID and the Etherscan transaction link — this is now a permanent, tamper-proof ERC-721 on Ethereum. Nobody can duplicate it, nobody can silently alter it.
>
> **[Speaker 3]**, take us inside the investigation dossier."

---

## Speaker 3 — Investigation Dossier & Network Intelligence *(~2 min 30 sec)*

**ROLE:** Investigates a certificate in depth, then shows the network graph.

---

**[SCREEN: Certificate Archive — `/certificates`]**

> **Speaker 3:**
>
> "Thanks. This is the Certificate Archive — every on-chain certificate, searchable and sortable. You can filter by status — issued, retired — and sort by fraud score to find the riskiest ones first.
>
> Let me open one. Let's look at REC-00002 — this is from the DAIICT plant, 40 MWh."

**[CLICK certificate REC-00002 → navigate to `/certificates/2`]**

> "This is the **Investigation Dossier** — the heart of RECON. This is what an auditor or regulator would use to decide whether a certificate is trustworthy.
>
> At the top: the serial number, the risk assessment — this one shows 'Clear' with a composite score of 13 out of 100. The AI's explanation is right there: why it passed, what was checked.
>
> Now the key part — the **Evidence Pillars**. RECON doesn't rely on one signal. It uses three independent verification methods:
>
> **Physical pillar** — Is this generation claim physically possible? We model the solar irradiance at the exact GPS coordinates using the Haurwitz clear-sky model and NOAA solar position data. If the sun was below the horizon when this plant claimed to generate power — that's a physics violation, automatic red flag.
>
> **Statistical pillar** — Does the energy amount and pattern match what we'd expect from the Isolation Forest model? Are there anomalies in timing, volume, or frequency?
>
> **Custody pillar** — Who owns this certificate? Does this wallet show suspicious concentration? Is it part of a trading ring?"

**[SCROLL to the envelope chart]**

> "Here's the **Physical Validation** chart. The green area is what the plant could physically produce based on its capacity and the solar irradiance at its location. The blue bar is what it claimed. As long as the claim stays inside the envelope — it's consistent with physics."

**[SCROLL to on-chain proof panel]**

> "And at the bottom — the **On-Chain Proof Panel**. This reads directly from the Ethereum blockchain using wagmi and viem — not from our database. You can see the token owner, mint transaction, retirement status, and the fraud score that was locked in at issuance. This is independently verifiable by anyone."

**[NAVIGATE to `/network`]**

> "Now let me show the **Network Intelligence** page. This is a force-directed graph that maps the entire custody flow — plants, issuers, and wallets connected by certificate transfers. Red edges mark flagged certificates.
>
> This is how you spot **trading rings** — clusters of wallets passing the same MWh back and forth. Click any node to drill down into its certificate history and flag rate.
>
> Over to **[Speaker 4]** for the blockchain side and architecture."

---

## Speaker 4 — Blockchain, Public Verification & Architecture *(~2 min 30 sec)*

**ROLE:** Shows the smart contract, public verification, audit trail, and wraps with architecture.

---

**[SCREEN: Etherscan Sepolia — contract page for 0x2819…4B59]**

> **Speaker 4:**
>
> "Thanks. Let me show what's happening under the hood on Ethereum.
>
> This is our **RECRegistry** smart contract — deployed and verified on Sepolia at address `0x2819…4B59`. Anyone can read the source code on Etherscan.
>
> The contract enforces two rules that no off-chain database ever can:
>
> **Rule 1 — Double-certification is impossible.** Every generation record is keyed by `keccak256(plantId, energyMWh, timestamp)`. If anyone tries to mint a duplicate — same plant, same energy, same time — the contract reverts with `RecordAlreadyCertified`. This is the on-chain backstop for the most common REC fraud: double counting.
>
> **Rule 2 — Retirement is final.** Once a certificate is consumed against an environmental claim, it's marked retired on-chain. The contract's `_update` hook blocks all transfers after that. A retired certificate can never be resold. That one retired certificate you saw earlier — REC-00003 for the DAIICT plant — it's done forever."

**[NAVIGATE to `/verify`]**

> "Now, the **public verification page**. This is critical — **you don't need an account** to verify a certificate. Enter a token ID — let me type '1' — and the system reads directly from the blockchain. No trust required."

**[Type "1", submit, show result]**

> "It confirms: certificate exists, issued status, fraud score 12 at mint time, owned by the issuer wallet. A buyer, auditor, or regulator can independently verify any certificate on the registry. That's the point of putting it on-chain."

**[NAVIGATE to `/audit`]**

> "The **Audit Trail** shows every state change in chronological order — mints, retirements, transfers, and rejected duplicates. Each entry links to its on-chain transaction. The ledger seal hash at the top lets you verify the integrity of the entire trail."

**[NAVIGATE to `/physical`]**

> "And the **Physical Validation** page lets you deep-dive into any certificate's physics check. You can select any certificate from the dropdown and see the full envelope analysis — claimed power versus modelled capacity, irradiance curves, solar geometry, and whether the claim is physically plausible."

**[SWITCH to backend — show `localhost:8000` JSON, then show architecture slide/diagram]**

> "Let me quickly show the architecture. RECON has three layers:
>
> - **Frontend** — Next.js 16, React, Framer Motion, wagmi/viem for direct chain reads, Firebase auth
> - **Backend** — FastAPI in Python orchestrating five independent signal clients — ML, Graph, Weather, LLM, Ledger — each with a real and mock mode. If a real source fails, it degrades to mock automatically. One broken module never takes the system down.
> - **Smart Contract** — `RECRegistry.sol`, ERC-721 on Ethereum Sepolia. Enforces uniqueness and retirement finality.
>
> The entire stack is containerised with Docker Compose — `docker compose up` brings up the chain node, backend, and frontend in one command."

---

**[ALL FOUR SPEAKERS ON SCREEN / CAMERA]**

> **Speaker 4 (closing):**
>
> "To summarise — **RECON** is a production-grade fraud detection and certificate registry for the renewable energy market. It combines:
>
> - **Machine learning** for statistical anomaly detection
> - **Graph analysis** to find trading rings and suspicious clusters
> - **Physics-based validation** using real solar irradiance models
> - **AI-generated explanations** so humans understand the flags
> - **Blockchain-enforced uniqueness** so a certificate can never be duplicated or resold
>
> Every fact that matters is on-chain. Every reason behind a score is off-chain, where it can improve. That's RECON — the REC Observation Network.
>
> Thank you."

---

## Timing Summary

| Segment | Speaker | Duration | Pages Shown |
|---|---|---|---|
| Problem & Landing | Speaker 1 | ~2:30 | `/`, scroll through pipeline and live registry |
| Control Room & Issuance | Speaker 2 | ~2:30 | `/signin`, `/dashboard`, `/issue` (live mint) |
| Investigation & Network | Speaker 3 | ~2:30 | `/certificates`, `/certificates/2`, `/network` |
| Blockchain & Architecture | Speaker 4 | ~2:30 | Etherscan, `/verify`, `/audit`, `/physical`, `localhost:8000` |
| **Total** | | **~10:00** | |

---

## Live Data Reference (for rehearsal)

| Token | Plant | MWh | Score | Status |
|---|---|---|---|---|
| REC-00001 | IN-GJ-AHD-SOL-04 | 35 | 12 | Issued |
| REC-00002 | DAIICT | 40 | 13 | Issued |
| REC-00003 | DAIICT | 35 | 12 | Retired |

**Contract:** [`0x28190548E1e84fcaC6EEcc5fECaDE138e6154B59`](https://sepolia.etherscan.io/address/0x28190548E1e84fcaC6EEcc5fECaDE138e6154B59) on Sepolia

**Issuer wallet:** `0xB81ce4bc1fb783217EB4E331846D917B17970e12`

---

## Tips for Recording

1. **Keep both servers running** — backend on :8000, dashboard on :3000.
2. **Pre-load pages in tabs** so transitions feel instant during recording.
3. **The mint step takes ~12 seconds** on Sepolia — use the pause to narrate what's happening on-chain.
4. **Use 90% browser zoom** for cleaner screen recordings.
5. **If issuing a new cert during recording**, use a plant ID and timestamp you haven't used before — duplicates will revert on-chain (which is actually a great thing to demo if you want to show the double-mint protection).
