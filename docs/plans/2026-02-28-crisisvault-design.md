# CrisisVault — Design Document

**Date:** 2026-02-28
**Status:** Approved
**Version:** 1.0

---

## Overview

CrisisVault is a global pre-emptive disaster relief platform that combines an AI prediction engine, Ethereum DAO governance, and a Google Earth-style 3D globe interface. It raises funds *before* calamities strike, holds them in smart contract escrow, and releases them to verified institutions only when a majority DAO vote approves — with full refunds available to donors if events don't materialize or the DAO votes not to fund.

### Core Properties

- **Pre-emptive**: AI + oracle data triggers campaigns before disasters peak
- **Trustless**: Funds held in smart contract escrow, never in a company account
- **Refund-safe**: Donors get 100% back if event is a false alarm or DAO rejects disbursement
- **Reputation-weighted governance**: Long-term participants and verified experts carry more voting weight
- **Self-sustaining**: 1.5% fee on successful disbursements funds all infrastructure
- **Extensible**: Oracle adapters, feature flags, and UUPS proxy upgrades for future evolution

### Calamity Types Covered

Natural disasters · Humanitarian crises · Climate events · Conflict zones

---

## Architecture (Approach B: Microservices + Event-Driven)

Five independent layers communicating via Redis pub/sub:

```
┌─────────────────────────────────────────────────────────────┐
│                     GLOBE FRONTEND                          │
│         React + CesiumJS + Deck.gl + RainbowKit             │
│  (3D globe, risk heat maps, campaign markers, DAO voting)   │
└──────────────────────────┬──────────────────────────────────┘
                           │ WebSocket + REST
┌──────────────────────────▼──────────────────────────────────┐
│                   CAMPAIGN API (Node.js/TS)                  │
│      Campaign lifecycle, user profiles, on-chain indexer     │
└──────────┬────────────────────────────┬─────────────────────┘
           │ Pub/Sub (Redis)             │ RPC (wagmi/viem)
┌──────────▼──────────┐   ┌─────────────▼────────────────────┐
│  AI PREDICTION SVC  │   │        SMART CONTRACTS (Base)     │
│  Python + FastAPI   │   │  CrisisDAO + CampaignVault +      │
│  (ML, oracle feeds) │   │  ReputationRegistry + InstitReg   │
└──────────┬──────────┘   └──────────────────────────────────┘
           │ HTTP
┌──────────▼──────────────────────────────────────────────────┐
│                    ORACLE DATA SOURCES                       │
│  USGS · NOAA · WHO · GDACS · Copernicus · ACLED · FIRMS     │
└─────────────────────────────────────────────────────────────┘
```

**Trust boundary**: The AI service *proposes* campaigns via events. The Campaign API submits on-chain proposals. The DAO *decides*. The vault *executes*. No single component has unilateral power.

---

## Campaign State Machine

Every campaign follows this lifecycle with two terminal paths — funded or refundable:

```
                    Oracle confirms event
ACTIVE ──────────────────────────────────► TRIGGERED
  │                                              │
  │  Oracle confirms false alarm                 │  DAO voting opens (7-day window)
  │  OR campaign deadline passes                 │
  ▼                                         ┌────▼────┐
EXPIRED ──────────────────────────────────► │  VOTING  │
  │                                         └────┬────┘
  │                                              │
  │                               DAO vote passes│        DAO vote fails /
  │                               (majority yes) │        quorum not met
  │                                              │              │
  │                                         ┌────▼────┐   ┌────▼──────┐
  └─────────────────────────────────────────► FUNDED  │   │REFUNDABLE │
                                            └─────────┘   └─────┬─────┘
                                                                 │
                                                    90-day donor claim window
                                                    Unclaimed → GeneralReliefPool
```

**REFUNDABLE is triggered by any of:**
1. DAO votes "no" (majority reject)
2. DAO quorum not reached within 7-day voting window
3. Oracle confirms false alarm AND campaign deadline passes
4. Campaign deadline reached with no oracle trigger event

---

## Fee Structure

Fees are charged **only on successful disbursements**. Donations and refunds are free.

| Event | Fee | Destination |
|-------|-----|-------------|
| Donation | 0% | 100% into vault escrow |
| Refund claimed | 0% | 100% returned to donor |
| Disbursement approved | 1.5% of vault | 0.5% ops · 0.5% voter rewards · 0.5% protocol reserve |
| Unclaimed refund sweep (post 90 days) | 0% | 100% to GeneralReliefPool |

All fee parameters are stored in smart contracts and adjustable only by DAO vote.

**Estimated revenue at scale:**
- $1M/month in disbursements → ~$15K/month in fees
- More than sufficient to cover infrastructure at any growth stage

---

## Cloud Infrastructure

**Stack: Modern cloud-native (low cost, globally distributed)**

```
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare (DNS, DDoS protection, global CDN, SSL)             │
└──────────────┬──────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────┐
│  Vercel — React/CesiumJS Frontend (global CDN, auto-scales)     │
└──────────────┬──────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────┐
│  Railway — Managed Containers                                   │
│  ┌─────────────────┐  ┌────────────────────────────────────────┐│
│  │  Campaign API   │  │  AI Prediction Service                 ││
│  │  Node.js/TS     │  │  Python / FastAPI + Celery             ││
│  │  (scales 0→N)   │  │  (cron + event-driven, scales to zero) ││
│  └─────────────────┘  └────────────────────────────────────────┘│
└──────────────┬────────────────────┬────────────────────────────-┘
               │                    │
┌──────────────▼──────┐  ┌──────────▼──────────┐
│  Supabase           │  │  Upstash Redis       │
│  PostgreSQL + Auth  │  │  Pub/Sub + cache     │
│  (PostGIS, pgBounce)│  │  (pay-per-request)   │
└─────────────────────┘  └─────────────────────┘
```

**Cost estimates:**

| Scale | Monthly Users | Estimated Cost |
|-------|--------------|----------------|
| MVP / launch | <10K | ~$0–30/mo |
| Growth | 10K–100K | ~$80–250/mo |
| Scale | 100K–1M | ~$400–1,200/mo |
| Large scale | 1M+ | Migrate to AWS ECS + Aurora Serverless |

**Cost discipline:**
- Railway charges only for active compute — AI service sleeps between 15-min poll cycles
- Upstash Redis billed per 100K requests (~$0.20), not per hour
- Vercel serves the heavy CesiumJS frontend from CDN edge globally
- Supabase connection pooling (PgBouncer) prevents connection exhaustion under load

---

## Extensibility Architecture

### 1. Oracle Adapter Interface (AI Service)

Each data source is a self-contained adapter implementing a standard protocol:

```
OracleAdapter (abstract)
  ├── USGSEarthquakeAdapter
  ├── NOAAHurricaneAdapter
  ├── WHODiseaseAdapter
  ├── GDACSMultiHazardAdapter
  ├── ACLEDConflictAdapter
  ├── CopernicusFloodAdapter
  ├── NASAFIRMSWildfireAdapter
  └── [NewAdapter] ← drop file, register in config
```

Adding a new data source = implement one adapter class + register in `adapters.yaml`. No core changes required.

### 2. Smart Contract Upgrades (UUPS Proxy Pattern)

All contracts deploy behind upgradeable proxies:

```
CampaignVault (Proxy) → CampaignVaultV1 (Implementation)
                      → CampaignVaultV2 (future, via DAO vote)
```

Governance proposes and votes on upgrades. Proxy address is immutable — wallet integrations never break.

### 3. Feature Flags (Frontend + API)

A `features` table in Supabase and a `FeatureFlag` React context gate UI features:

```
features table:
  conflict_campaigns:         enabled  (production)
  climate_prediction_v2:      disabled (beta only)
  institutional_dashboard:    enabled  (production)
  multi_chain_bridge:         disabled (planned)
  mobile_app:                 disabled (planned)
```

Features toggleable per environment, per region, or per user cohort (beta testers) without a deploy.

### 4. API Versioning

All routes namespaced: `/api/v1/...` → `/api/v2/...`
Old clients continue working. New capabilities added in new versions.

---

## AI Prediction Pipeline

**Runtime:** Python 3.12 + FastAPI + Celery (task queue) + Redis (broker)

**Data sources polled every 15 minutes:**

| Source | Data | API Type |
|--------|------|----------|
| USGS Earthquake Hazards | Real-time seismic events | Free REST |
| NOAA NHC | Hurricanes, tropical systems | Free RSS/API |
| GDACS | Multi-hazard global alerts | Free GeoRSS |
| WHO Disease Outbreak News | Epidemic/pandemic signals | Free RSS |
| ACLED | Armed conflict events | Free REST (API key) |
| Copernicus EMS | Flood/wildfire satellite data | Free REST |
| NASA FIRMS | Active wildfire hotspots | Free REST |
| ReliefWeb (OCHA) | Humanitarian situation reports | Free REST |

**Pipeline stages:**

```
Stage 1 — Ingest
  Raw API responses → normalized GeoJSON stored in oracle_events table

Stage 2 — Feature Engineering
  Cluster nearby events (DBSCAN spatial clustering)
  Compute velocity (rate of change over 24h/72h/7d windows)
  Cross-reference EM-DAT historical disaster database for regional baselines

Stage 3 — Risk Scoring (ensemble)
  Prophet          → time-series trend forecasting per region
  Gradient Boosted → severity classification (low/medium/high/critical)
  Rule-based       → hard thresholds (e.g. M6.5+ near population center = auto-confirm)

Stage 4 — Campaign Sizing
  fundraising_target = historical_median_cost(event_type, severity)
                     × population_density_weight(bbox)
                     × gdp_adjustment(country)

Stage 5 — Threshold Gate
  IF confidence >= 0.70 AND oracle_confirmed = true:
    → emit CampaignProposal to Redis pub/sub
    → Campaign API picks up, creates on-chain proposal
```

**Prediction event schema:**
```json
{
  "type": "earthquake",
  "region": "Philippines — Luzon",
  "bbox": [120.1, 14.2, 122.5, 18.1],
  "confidence": 0.84,
  "severity": "high",
  "estimated_affected_population": 420000,
  "fundraising_target_usd": 1800000,
  "oracle_sources": ["USGS", "GDACS"],
  "campaign_deadline_days": 21,
  "prediction_window": { "start": "2026-03-01", "end": "2026-03-15" }
}
```

The AI service **never directly creates a campaign**. It publishes proposals. The DAO decides.

---

## Globe UI Design

**Stack:** React 18 + TypeScript + CesiumJS (Apache 2.0) + Deck.gl (MIT) + RainbowKit + wagmi v2 + viem + TailwindCSS + Vite

**Open imagery (no vendor lock-in):**
- Base globe: NASA Blue Marble layer
- Zoom tiles: OpenStreetMap
- 3D terrain: Cesium World Terrain (free tier)

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│ [CrisisVault]  🔍 Search region...  [Filters ▾]  [Connect Wallet]│
├───────────────────────────────────────────┬─────────────────────┤
│                                           │                     │
│                                           │  CAMPAIGN PANEL     │
│         3D GLOBE (CesiumJS)               │  ─────────────────  │
│                                           │  Luzon, Philippines │
│   • Risk heat overlay (Deck.gl heatmap)   │  Earthquake M6.8+   │
│   • Campaign markers (scatter layer)      │  Confidence: 84%    │
│   • Fund flow arcs (arc layer)            │  Raised: Ξ 142.3    │
│                                           │  Target:  Ξ 500     │
│                                           │  ████░░░░ 28%       │
│                                           │                     │
│                                           │  [Donate]  [Details]│
│                                           │                     │
├───────────────────────────────────────────┴─────────────────────┤
│  ACTIVE 12 campaigns · Ξ 4,820 raised · 3 in voting · 1 funded  │
└─────────────────────────────────────────────────────────────────┘
```

**Campaign marker states (Deck.gl ScatterplotLayer):**

| Color | State | Meaning |
|-------|-------|---------|
| Blue pulsing | ACTIVE | Fundraising open |
| Orange | TRIGGERED | Event confirmed, vote pending |
| Red flashing | VOTING | Active DAO vote — action needed |
| Green | FUNDED | Disbursed, complete |
| Amber | REFUNDABLE | Claim your refund |
| Gray | EXPIRED | Archived |

**Key user flows:**
1. **Donate** — Click marker → panel → connect wallet → enter amount → sign transaction
2. **Vote** — Campaign enters VOTING → banner alert → panel shows institution credentials + on-chain history → sign Yes/No
3. **Claim Refund** — REFUNDABLE notification → one-click claim → single Base transaction (~$0.01 gas)
4. **Verify Institution** — Pre-vote: expand institution panel showing UN/charity registration, wallet history, IPFS credential doc

---

## Smart Contract Architecture

Six contracts, all deployed behind UUPS upgradeable proxies on Base L2:

```
CrisisToken.sol (ERC20Votes, soulbound)
  Minted on donation, log-scaled to prevent plutocracy
  Non-transferable — prevents vote-buying on secondary markets
  └─► used by ReputationRegistry for voting power calculation

ReputationRegistry.sol
  reputation_score = base_donations × tenure_multiplier × expert_bonus
  Updated by signed oracle messages from AI service
  Expert verification: aid workers, climate scientists, public health officials
  └─► votingPower(address) = sqrt(crisisTokenBalance × reputationScore)

CrisisDAO.sol (OpenZeppelin Governor + TimelockController)
  Voting period: 7 days
  Quorum: 10% of total voting power
  Timelock: 24h delay between approval and execution
  Proposals: disburse(campaignId, institutionAddress)
  └─► calls CampaignFactory / CampaignVault via timelock

CampaignFactory.sol
  deploy(params) → new CampaignVault proxy
  Only callable by DAO or authorized oracle address

CampaignVault.sol  (one instance per campaign)
  donate()          → records exact msg.value per address (no fee taken)
  claimRefund()     → returns 100% if status == REFUNDABLE (CEI pattern)
  disburse()        → 1.5% fee split, remainder to verified institution
  markRefundable()  → callable by DAO or oracle (false alarm confirmation)
  sweep()           → moves unclaimed funds to GeneralReliefPool after 90 days

InstitutionRegistry.sol (3-of-5 multisig managed)
  isVerified(address) → bool
  Credential CID stored on-chain (IPFS document reference)
  DAO can vote to add/remove institutions
  Required gate: disburse() checks this before transferring
```

**Security properties:**
- CEI pattern in all vault functions — reentrancy safe
- TimelockController — 24h window for donors to react before execution
- Soulbound CrisisToken — votes cannot be purchased
- UUPS proxies — upgradeable by DAO vote only
- InstitutionRegistry — no funds can flow to unverified addresses

---

## Data Models

### Off-chain (Supabase PostgreSQL + PostGIS)

**users**
- `id`, `wallet_address` (unique), `reputation_score`, `total_donated_usd`, `verified_expert`, `expert_type`, `created_at`

**campaigns**
- `id`, `onchain_proposal_id`, `type`, `region_name`, `bbox` (JSONB), `centroid` (POINT), `status`, `confidence`, `severity`, `fundraising_target_usd`, `total_raised_usd`, `campaign_deadline`, `refund_deadline`, `contract_address`, `ipfs_metadata_cid`, `institution_id` (FK), `created_at`, `funded_at`, `oracle_sources` (JSONB)

**donations** *(indexed from on-chain events)*
- `id`, `campaign_id` (FK), `donor_address`, `amount_eth`, `amount_usd`, `tx_hash`, `block_number`, `status` (active|refunded), `created_at`

**oracle_events** *(raw AI service ingestion)*
- `id`, `source`, `event_type`, `raw_data` (JSONB), `location` (POINT), `confidence`, `processed`, `campaign_id` (FK nullable), `ingested_at`

**institutions**
- `id`, `name`, `type`, `wallet_address`, `registration_number`, `accreditation_body`, `country`, `verified`, `verified_at`, `ipfs_credentials_cid`, `total_received_usd`

**dao_votes** *(indexed from on-chain events)*
- `id`, `campaign_id` (FK), `voter_address`, `vote` (yes|no|abstain), `voting_power`, `tx_hash`, `created_at`

**features** *(feature flags)*
- `key` (unique), `enabled`, `rollout_pct`, `environments` (JSONB), `updated_at`

### On-chain (Base L2)

- `CampaignVault`: `donations[address]`, `status`, `totalRaised`, `refundDeadline`
- `ReputationRegistry`: `reputationScore[address]`, `expertVerified[address]`
- `CrisisToken`: ERC20 balances (via ERC20Votes)
- `InstitutionRegistry`: `verified[address]`, `credentialsCID[address]`

**IPFS:** campaign metadata blobs, institution credential documents

---

## Donation Refund Mechanism

Funds are held in `CampaignVault` escrow at all times. No fee is taken on deposit.

**Refund contract logic (simplified):**
```solidity
function donate() external payable {
    donations[msg.sender] += msg.value; // exact amount tracked
    totalRaised += msg.value;
}

function claimRefund() external {
    require(status == Status.REFUNDABLE, "Not refundable");
    require(block.timestamp <= refundDeadline, "Window closed");
    uint256 amount = donations[msg.sender];
    require(amount > 0, "Nothing to refund");
    donations[msg.sender] = 0;  // CEI: state before transfer
    (bool ok,) = payable(msg.sender).call{value: amount}("");
    require(ok, "Transfer failed");
}
```

**UX:** Globe shows amber "Refund Available" marker. Donors receive in-app + push notification. Countdown timer in UI. One transaction on Base L2 (~$0.01 gas).

**Unclaimed funds:** After 90-day window, `sweep()` moves remaining balance to `GeneralReliefPool` — a DAO-governed fund for undesignated relief. Destination surfaced transparently in UI.

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, CesiumJS, Deck.gl, RainbowKit, wagmi v2, viem, TailwindCSS, Vite |
| Campaign API | Node.js, TypeScript, Fastify, Supabase client, viem |
| AI Service | Python 3.12, FastAPI, Celery, Prophet, scikit-learn, pandas, httpx |
| Smart Contracts | Solidity 0.8.x, OpenZeppelin, Hardhat, deployed on Base L2 |
| Database | Supabase (PostgreSQL + PostGIS + Auth + Realtime) |
| Cache / Pub-Sub | Upstash Redis |
| Frontend hosting | Vercel |
| Backend hosting | Railway |
| CDN / DDoS | Cloudflare |
| Decentralized storage | IPFS (via web3.storage or Pinata) |
| Blockchain | Base L2 (Ethereum L2, EVM-compatible, low gas) |

---

## Project Structure

```
crisisvault/
├── apps/
│   ├── web/                  # React frontend (CesiumJS + Deck.gl)
│   ├── api/                  # Campaign API (Node.js/Fastify)
│   └── ai-service/           # AI Prediction Service (Python)
├── packages/
│   ├── contracts/            # Solidity smart contracts (Hardhat)
│   ├── shared-types/         # TypeScript types shared across apps
│   └── oracle-adapters/      # Pluggable oracle data source adapters
├── docs/
│   └── plans/
│       └── 2026-02-28-crisisvault-design.md
├── infra/
│   ├── docker-compose.yml    # Local dev environment
│   └── railway/              # Railway service configs
└── package.json              # Monorepo root (pnpm workspaces)
```

---

## Open Questions / Future Considerations

- **Sybil resistance**: Reputation system may need Worldcoin/Proof-of-Humanity integration for expert verification at scale
- **Multi-currency**: Initially ETH + USDC on Base; future bridge to accept donations from other chains
- **Mobile app**: Feature-flagged; native iOS/Android with wallet deep-link support
- **AI model transparency**: Prediction confidence scores and model weights should be published for auditability
- **Legal structure**: DAO legal wrapper (e.g. Wyoming DAO LLC or Marshall Islands foundation) for institutional compliance
- **GeneralReliefPool governance**: Separate DAO proposal type for allocating pooled unclaimed funds
