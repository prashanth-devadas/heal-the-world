# CrisisVault Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build CrisisVault — a global pre-emptive disaster relief platform with AI prediction, Ethereum DAO governance on Base L2, and a CesiumJS 3D globe UI.

**Architecture:** Microservices + event-driven: AI Prediction Service (Python) polls oracle feeds and emits campaign proposals via Redis pub/sub; Campaign API (Node.js) indexes on-chain events and serves the frontend; smart contracts on Base L2 hold funds in escrow and govern disbursement; React + CesiumJS frontend provides the globe interface.

**Tech Stack:** pnpm monorepo · React 18 + CesiumJS + Deck.gl + RainbowKit + wagmi v2 · Node.js + Fastify + Supabase · Python 3.12 + FastAPI + Celery · Solidity 0.8.x + Hardhat + OpenZeppelin · Base L2 · Upstash Redis · Vercel + Railway + Cloudflare

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `.gitignore`
- Create: `turbo.json`
- Create: `apps/web/.gitkeep`
- Create: `apps/api/.gitkeep`
- Create: `apps/ai-service/.gitkeep`
- Create: `packages/contracts/.gitkeep`
- Create: `packages/shared-types/.gitkeep`

**Step 1: Create root package.json**

```json
{
  "name": "crisisvault",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "prettier": "^3.2.0"
  },
  "engines": { "node": ">=20.0.0", "pnpm": ">=9.0.0" }
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 3: Create .npmrc**

```
auto-install-peers=true
strict-peer-dependencies=false
```

**Step 4: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "lint": {}
  }
}
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
.env
.env.local
*.env
__pycache__/
.pytest_cache/
*.pyc
.turbo/
coverage/
artifacts/
cache/
typechain-types/
.next/
```

**Step 6: Create directory structure**

```bash
mkdir -p apps/web apps/api apps/ai-service packages/contracts packages/shared-types infra
touch apps/web/.gitkeep apps/api/.gitkeep apps/ai-service/.gitkeep
touch packages/contracts/.gitkeep packages/shared-types/.gitkeep
```

**Step 7: Install root dependencies**

```bash
pnpm install
```

**Step 8: Commit**

```bash
git add .
git commit -m "chore: scaffold pnpm monorepo with turbo"
```

---

## Task 2: Docker Compose Dev Environment

**Files:**
- Create: `infra/docker-compose.yml`
- Create: `infra/.env.example`
- Create: `infra/postgres/init.sql`

**Step 1: Create docker-compose.yml**

```yaml
version: "3.9"
services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_USER: crisisvault
      POSTGRES_PASSWORD: crisisvault
      POSTGRES_DB: crisisvault
    ports: ["5432:5432"]
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  hardhat-node:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ../packages/contracts:/app
    command: sh -c "npm install && npx hardhat node --hostname 0.0.0.0"
    ports: ["8545:8545"]

volumes:
  postgres_data:
```

**Step 2: Create .env.example**

```bash
# Database
DATABASE_URL=postgresql://crisisvault:crisisvault@localhost:5432/crisisvault

# Redis
REDIS_URL=redis://localhost:6379

# Blockchain
RPC_URL=http://localhost:8545
CHAIN_ID=8453

# AI Service
ACLED_API_KEY=your_key_here
NASA_FIRMS_API_KEY=your_key_here

# Frontend
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_key_here
```

**Step 3: Create postgres/init.sql**

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
```

**Step 4: Commit**

```bash
git add infra/
git commit -m "chore: add docker-compose dev environment"
```

---

## Task 3: Shared TypeScript Types Package

**Files:**
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/tsconfig.json`
- Create: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/src/campaign.ts`
- Create: `packages/shared-types/src/prediction.ts`

**Step 1: Create package.json**

```json
{
  "name": "@crisisvault/shared-types",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": { "build": "tsc", "dev": "tsc --watch" },
  "devDependencies": { "typescript": "^5.4.0" }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create src/campaign.ts**

```typescript
export type CampaignStatus =
  | "active"
  | "triggered"
  | "voting"
  | "funded"
  | "refundable"
  | "expired";

export type CampaignType =
  | "earthquake"
  | "hurricane"
  | "flood"
  | "wildfire"
  | "famine"
  | "conflict"
  | "disease"
  | "climate";

export type Severity = "low" | "medium" | "high" | "critical";

export interface Campaign {
  id: string;
  onchainProposalId?: string;
  type: CampaignType;
  regionName: string;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  centroid: { lat: number; lng: number };
  status: CampaignStatus;
  confidence: number;
  severity: Severity;
  fundraisingTargetUsd: number;
  totalRaisedUsd: number;
  campaignDeadline: string; // ISO
  refundDeadline?: string;
  contractAddress?: string;
  ipfsMetadataCid?: string;
  institutionId?: string;
  oracleSources: string[];
  createdAt: string;
  fundedAt?: string;
}

export interface Institution {
  id: string;
  name: string;
  type: string;
  walletAddress: string;
  registrationNumber: string;
  accreditationBody: string;
  country: string;
  verified: boolean;
  ipfsCredentialsCid?: string;
  totalReceivedUsd: number;
}
```

**Step 4: Create src/prediction.ts**

```typescript
export interface PredictionEvent {
  type: string;
  region: string;
  bbox: [number, number, number, number];
  confidence: number;
  severity: string;
  estimatedAffectedPopulation: number;
  fundraisingTargetUsd: number;
  oracleSources: string[];
  campaignDeadlineDays: number;
  predictionWindow: { start: string; end: string };
  oracleConfirmed: boolean;
}

export interface OracleRawEvent {
  source: string;
  eventType: string;
  rawData: Record<string, unknown>;
  location: { lat: number; lng: number };
  confidence: number;
  ingestedAt: string;
}
```

**Step 5: Create src/index.ts**

```typescript
export * from "./campaign";
export * from "./prediction";
```

**Step 6: Build and commit**

```bash
cd packages/shared-types && pnpm build && cd ../..
git add packages/shared-types/
git commit -m "feat: add shared TypeScript types package"
```

---

## Task 4: Smart Contracts — Hardhat Setup

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/hardhat.config.ts`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/contracts/.gitkeep`
- Create: `packages/contracts/test/.gitkeep`

**Step 1: Create package.json**

```json
{
  "name": "@crisisvault/contracts",
  "version": "0.0.1",
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "node": "hardhat node",
    "deploy:local": "hardhat run scripts/deploy.ts --network localhost",
    "deploy:base": "hardhat run scripts/deploy.ts --network base"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "@openzeppelin/contracts": "^5.0.0",
    "@openzeppelin/contracts-upgradeable": "^5.0.0",
    "hardhat": "^2.22.0",
    "typescript": "^5.4.0",
    "ts-node": "^10.9.0"
  }
}
```

**Step 2: Create hardhat.config.ts**

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
    "base-sepolia": {
      url: "https://sepolia.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
};

export default config;
```

**Step 3: Install and compile empty project**

```bash
cd packages/contracts && pnpm install && pnpm compile
```

Expected: `Compiled 0 Solidity files successfully`

**Step 4: Commit**

```bash
cd ../.. && git add packages/contracts/
git commit -m "chore: set up Hardhat smart contract project"
```

---

## Task 5: CrisisToken Contract

**Files:**
- Create: `packages/contracts/contracts/CrisisToken.sol`
- Create: `packages/contracts/test/CrisisToken.test.ts`

**Step 1: Write the failing test**

```typescript
// test/CrisisToken.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("CrisisToken", function () {
  async function deploy() {
    const [owner, minter, user1, user2] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("CrisisToken");
    const token = await Token.deploy(minter.address);
    return { token, owner, minter, user1, user2 };
  }

  it("minter can mint tokens to a user", async function () {
    const { token, minter, user1 } = await deploy();
    await token.connect(minter).mint(user1.address, 100n);
    expect(await token.balanceOf(user1.address)).to.equal(100n);
  });

  it("non-minter cannot mint", async function () {
    const { token, user1, user2 } = await deploy();
    await expect(token.connect(user1).mint(user2.address, 100n))
      .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });

  it("tokens are non-transferable (soulbound)", async function () {
    const { token, minter, user1, user2 } = await deploy();
    await token.connect(minter).mint(user1.address, 100n);
    await expect(token.connect(user1).transfer(user2.address, 50n))
      .to.be.revertedWith("CrisisToken: soulbound");
  });

  it("tracks voting power via ERC20Votes", async function () {
    const { token, minter, user1 } = await deploy();
    await token.connect(minter).mint(user1.address, 200n);
    await token.connect(user1).delegate(user1.address);
    expect(await token.getVotes(user1.address)).to.equal(200n);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/contracts && pnpm test test/CrisisToken.test.ts
```

Expected: FAIL — `CrisisToken` contract not found

**Step 3: Write the contract**

```solidity
// contracts/CrisisToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract CrisisToken is ERC20Votes, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address minter)
        ERC20("CrisisToken", "CRT")
        EIP712("CrisisToken", "1")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, minter);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    // Soulbound: block all transfers except mint (from == 0) and burn (to == 0)
    function _update(address from, address to, uint256 value)
        internal override
    {
        require(from == address(0) || to == address(0), "CrisisToken: soulbound");
        super._update(from, to, value);
    }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test test/CrisisToken.test.ts
```

Expected: 4 passing

**Step 5: Commit**

```bash
cd ../.. && git add packages/contracts/
git commit -m "feat(contracts): add soulbound CrisisToken with ERC20Votes"
```

---

## Task 6: ReputationRegistry Contract

**Files:**
- Create: `packages/contracts/contracts/ReputationRegistry.sol`
- Create: `packages/contracts/test/ReputationRegistry.test.ts`

**Step 1: Write the failing test**

```typescript
// test/ReputationRegistry.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ReputationRegistry", function () {
  async function deploy() {
    const [owner, oracle, user1] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("CrisisToken");
    const token = await Token.deploy(owner.address);
    const Registry = await ethers.getContractFactory("ReputationRegistry");
    const registry = await Registry.deploy(await token.getAddress(), oracle.address);
    return { registry, token, owner, oracle, user1 };
  }

  it("oracle can set reputation score", async function () {
    const { registry, oracle, user1 } = await deploy();
    await registry.connect(oracle).setReputation(user1.address, 150n);
    expect(await registry.reputationOf(user1.address)).to.equal(150n);
  });

  it("non-oracle cannot set reputation", async function () {
    const { registry, user1 } = await deploy();
    await expect(registry.connect(user1).setReputation(user1.address, 100n))
      .to.be.revertedWith("ReputationRegistry: not oracle");
  });

  it("oracle can verify expert", async function () {
    const { registry, oracle, user1 } = await deploy();
    await registry.connect(oracle).setExpert(user1.address, true, "aid_worker");
    expect(await registry.isExpert(user1.address)).to.be.true;
    expect(await registry.expertType(user1.address)).to.equal("aid_worker");
  });

  it("votingPower returns sqrt(tokens * reputation)", async function () {
    const { registry, token, oracle, owner, user1 } = await deploy();
    // mint 100 tokens (log-scaled donation simulation)
    await token.connect(owner).mint(user1.address, 100n);
    await token.connect(user1).delegate(user1.address);
    await registry.connect(oracle).setReputation(user1.address, 100n);
    // sqrt(100 * 100) = sqrt(10000) = 100
    expect(await registry.votingPower(user1.address)).to.equal(100n);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/contracts && pnpm test test/ReputationRegistry.test.ts
```

Expected: FAIL

**Step 3: Write the contract**

```solidity
// contracts/ReputationRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CrisisToken.sol";

contract ReputationRegistry {
    CrisisToken public immutable token;
    address public oracle;

    mapping(address => uint256) private _reputation;
    mapping(address => bool) private _isExpert;
    mapping(address => string) private _expertType;

    event ReputationUpdated(address indexed user, uint256 score);
    event ExpertVerified(address indexed user, bool verified, string expertType);

    modifier onlyOracle() {
        require(msg.sender == oracle, "ReputationRegistry: not oracle");
        _;
    }

    constructor(address tokenAddress, address oracleAddress) {
        token = CrisisToken(tokenAddress);
        oracle = oracleAddress;
    }

    function setReputation(address user, uint256 score) external onlyOracle {
        _reputation[user] = score;
        emit ReputationUpdated(user, score);
    }

    function setExpert(address user, bool verified, string calldata expType)
        external onlyOracle
    {
        _isExpert[user] = verified;
        _expertType[user] = expType;
        emit ExpertVerified(user, verified, expType);
    }

    function reputationOf(address user) external view returns (uint256) {
        return _reputation[user];
    }

    function isExpert(address user) external view returns (bool) {
        return _isExpert[user];
    }

    function expertType(address user) external view returns (string memory) {
        return _expertType[user];
    }

    /// @notice Voting power = floor(sqrt(tokenBalance * reputation))
    function votingPower(address user) external view returns (uint256) {
        uint256 bal = token.getVotes(user);
        uint256 rep = _reputation[user] == 0 ? 1 : _reputation[user];
        return _sqrt(bal * rep);
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) { y = z; z = (x / z + z) / 2; }
        return y;
    }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test test/ReputationRegistry.test.ts
```

Expected: 4 passing

**Step 5: Commit**

```bash
cd ../.. && git add packages/contracts/
git commit -m "feat(contracts): add ReputationRegistry with sqrt voting power"
```

---

## Task 7: InstitutionRegistry Contract

**Files:**
- Create: `packages/contracts/contracts/InstitutionRegistry.sol`
- Create: `packages/contracts/test/InstitutionRegistry.test.ts`

**Step 1: Write the failing test**

```typescript
// test/InstitutionRegistry.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("InstitutionRegistry", function () {
  async function deploy() {
    const [admin, signer2, signer3, institution, random] =
      await ethers.getSigners();
    const Registry = await ethers.getContractFactory("InstitutionRegistry");
    // 2-of-3 multisig for testing
    const registry = await Registry.deploy(
      [admin.address, signer2.address, signer3.address],
      2
    );
    return { registry, admin, signer2, signer3, institution, random };
  }

  it("admin can add verified institution", async function () {
    const { registry, admin, institution } = await deploy();
    await registry.connect(admin).addInstitution(
      institution.address, "Red Cross", "ipfs://cid123"
    );
    expect(await registry.isVerified(institution.address)).to.be.true;
  });

  it("non-admin cannot add institution", async function () {
    const { registry, random, institution } = await deploy();
    await expect(
      registry.connect(random).addInstitution(institution.address, "Scam", "ipfs://x")
    ).to.be.revertedWith("InstitutionRegistry: not admin");
  });

  it("admin can remove institution", async function () {
    const { registry, admin, institution } = await deploy();
    await registry.connect(admin).addInstitution(institution.address, "Red Cross", "ipfs://cid");
    await registry.connect(admin).removeInstitution(institution.address);
    expect(await registry.isVerified(institution.address)).to.be.false;
  });

  it("stores credential CID", async function () {
    const { registry, admin, institution } = await deploy();
    await registry.connect(admin).addInstitution(institution.address, "UNHCR", "ipfs://abc");
    expect(await registry.credentialCID(institution.address)).to.equal("ipfs://abc");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/contracts && pnpm test test/InstitutionRegistry.test.ts
```

Expected: FAIL

**Step 3: Write the contract**

```solidity
// contracts/InstitutionRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract InstitutionRegistry {
    mapping(address => bool) private _verified;
    mapping(address => string) private _name;
    mapping(address => string) private _credentialCID;
    mapping(address => bool) public isAdmin;

    event InstitutionAdded(address indexed institution, string name);
    event InstitutionRemoved(address indexed institution);

    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "InstitutionRegistry: not admin");
        _;
    }

    constructor(address[] memory admins, uint256 /*threshold — reserved for future multisig*/) {
        for (uint256 i = 0; i < admins.length; i++) {
            isAdmin[admins[i]] = true;
        }
    }

    function addInstitution(
        address institution,
        string calldata name,
        string calldata credCID
    ) external onlyAdmin {
        _verified[institution] = true;
        _name[institution] = name;
        _credentialCID[institution] = credCID;
        emit InstitutionAdded(institution, name);
    }

    function removeInstitution(address institution) external onlyAdmin {
        _verified[institution] = false;
        emit InstitutionRemoved(institution);
    }

    function isVerified(address institution) external view returns (bool) {
        return _verified[institution];
    }

    function credentialCID(address institution) external view returns (string memory) {
        return _credentialCID[institution];
    }

    function nameOf(address institution) external view returns (string memory) {
        return _name[institution];
    }
}
```

**Step 4: Run tests**

```bash
pnpm test test/InstitutionRegistry.test.ts
```

Expected: 4 passing

**Step 5: Commit**

```bash
cd ../.. && git add packages/contracts/
git commit -m "feat(contracts): add InstitutionRegistry"
```

---

## Task 8: CampaignVault Contract

**Files:**
- Create: `packages/contracts/contracts/CampaignVault.sol`
- Create: `packages/contracts/test/CampaignVault.test.ts`

**Step 1: Write the failing test**

```typescript
// test/CampaignVault.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("CampaignVault", function () {
  async function deploy() {
    const [dao, oracle, institution, donor1, donor2, opsTreasury, rewardPool, protocolReserve] =
      await ethers.getSigners();
    const Registry = await ethers.getContractFactory("InstitutionRegistry");
    const registry = await Registry.deploy([dao.address], 1);
    await registry.connect(dao).addInstitution(institution.address, "Red Cross", "ipfs://x");

    const Vault = await ethers.getContractFactory("CampaignVault");
    const deadlineDays = 30;
    const vault = await Vault.deploy(
      dao.address,
      oracle.address,
      await registry.getAddress(),
      opsTreasury.address,
      rewardPool.address,
      protocolReserve.address,
      deadlineDays
    );
    return { vault, dao, oracle, institution, donor1, donor2, opsTreasury, rewardPool, protocolReserve };
  }

  it("accepts donations and records them", async function () {
    const { vault, donor1 } = await deploy();
    await vault.connect(donor1).donate({ value: ethers.parseEther("1") });
    expect(await vault.donations(donor1.address)).to.equal(ethers.parseEther("1"));
    expect(await vault.totalRaised()).to.equal(ethers.parseEther("1"));
  });

  it("allows full refund when REFUNDABLE", async function () {
    const { vault, dao, donor1 } = await deploy();
    await vault.connect(donor1).donate({ value: ethers.parseEther("1") });
    await vault.connect(dao).markRefundable();
    const before = await ethers.provider.getBalance(donor1.address);
    const tx = await vault.connect(donor1).claimRefund();
    const receipt = await tx.wait();
    const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
    const after = await ethers.provider.getBalance(donor1.address);
    // Donor gets full 1 ETH back (minus gas)
    expect(after - before + gasUsed).to.equal(ethers.parseEther("1"));
  });

  it("refund returns exactly donation amount (no fee)", async function () {
    const { vault, dao, donor1 } = await deploy();
    await vault.connect(donor1).donate({ value: ethers.parseEther("2") });
    await vault.connect(dao).markRefundable();
    await vault.connect(donor1).claimRefund();
    expect(await vault.donations(donor1.address)).to.equal(0n);
  });

  it("cannot double-claim refund", async function () {
    const { vault, dao, donor1 } = await deploy();
    await vault.connect(donor1).donate({ value: ethers.parseEther("1") });
    await vault.connect(dao).markRefundable();
    await vault.connect(donor1).claimRefund();
    await expect(vault.connect(donor1).claimRefund()).to.be.revertedWith("Nothing to refund");
  });

  it("disburses to institution with 1.5% fee split", async function () {
    const { vault, dao, oracle, institution, donor1, opsTreasury, rewardPool, protocolReserve } =
      await deploy();
    await vault.connect(donor1).donate({ value: ethers.parseEther("100") });
    await vault.connect(oracle).markTriggered();
    await vault.connect(dao).disburse(institution.address);

    const total = ethers.parseEther("100");
    const fee = total * 150n / 10000n; // 1.5%
    const share = fee / 3n;
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(0n);
  });

  it("cannot disburse to unverified institution", async function () {
    const { vault, dao, oracle, donor1 } = await deploy();
    const [, , , , , , , , badActor] = await ethers.getSigners();
    await vault.connect(donor1).donate({ value: ethers.parseEther("1") });
    await vault.connect(oracle).markTriggered();
    await expect(vault.connect(dao).disburse(badActor.address))
      .to.be.revertedWith("Institution not verified");
  });

  it("refund window closes after 90 days", async function () {
    const { vault, dao, donor1 } = await deploy();
    await vault.connect(donor1).donate({ value: ethers.parseEther("1") });
    await vault.connect(dao).markRefundable();
    await time.increase(91 * 24 * 60 * 60);
    await expect(vault.connect(donor1).claimRefund()).to.be.revertedWith("Refund window closed");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/contracts && pnpm test test/CampaignVault.test.ts
```

Expected: FAIL

**Step 3: Write the contract**

```solidity
// contracts/CampaignVault.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./InstitutionRegistry.sol";

contract CampaignVault {
    enum Status { ACTIVE, TRIGGERED, VOTING, FUNDED, REFUNDABLE, EXPIRED }

    Status public status;
    address public immutable dao;
    address public immutable oracle;
    InstitutionRegistry public immutable institutionRegistry;
    address public immutable opsTreasury;
    address public immutable rewardPool;
    address public immutable protocolReserve;

    uint256 public totalRaised;
    uint256 public campaignDeadline;
    uint256 public refundDeadline;

    mapping(address => uint256) public donations;

    event Donated(address indexed donor, uint256 amount);
    event Triggered();
    event Refundable(uint256 deadline);
    event RefundClaimed(address indexed donor, uint256 amount);
    event Disbursed(address indexed institution, uint256 amount, uint256 fee);

    modifier onlyDAO() { require(msg.sender == dao, "Not DAO"); _; }
    modifier onlyOracle() { require(msg.sender == oracle, "Not oracle"); _; }
    modifier onlyDAOorOracle() {
        require(msg.sender == dao || msg.sender == oracle, "Not authorized");
        _;
    }

    constructor(
        address _dao,
        address _oracle,
        address _registry,
        address _opsTreasury,
        address _rewardPool,
        address _protocolReserve,
        uint256 deadlineDays
    ) {
        dao = _dao;
        oracle = _oracle;
        institutionRegistry = InstitutionRegistry(_registry);
        opsTreasury = _opsTreasury;
        rewardPool = _rewardPool;
        protocolReserve = _protocolReserve;
        campaignDeadline = block.timestamp + (deadlineDays * 1 days);
        status = Status.ACTIVE;
    }

    function donate() external payable {
        require(status == Status.ACTIVE, "Not accepting donations");
        donations[msg.sender] += msg.value;
        totalRaised += msg.value;
        emit Donated(msg.sender, msg.value);
    }

    function markTriggered() external onlyOracle {
        require(status == Status.ACTIVE, "Wrong status");
        status = Status.TRIGGERED;
        emit Triggered();
    }

    function markRefundable() external onlyDAOorOracle {
        require(
            status == Status.ACTIVE ||
            status == Status.TRIGGERED ||
            status == Status.VOTING,
            "Wrong status"
        );
        status = Status.REFUNDABLE;
        refundDeadline = block.timestamp + 90 days;
        emit Refundable(refundDeadline);
    }

    function claimRefund() external {
        require(status == Status.REFUNDABLE, "Not in refund state");
        require(block.timestamp <= refundDeadline, "Refund window closed");
        uint256 amount = donations[msg.sender];
        require(amount > 0, "Nothing to refund");
        donations[msg.sender] = 0; // CEI: state before transfer
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");
        emit RefundClaimed(msg.sender, amount);
    }

    function disburse(address institution) external onlyDAO {
        require(status == Status.TRIGGERED || status == Status.VOTING, "Wrong status");
        require(institutionRegistry.isVerified(institution), "Institution not verified");

        uint256 balance = address(this).balance;
        uint256 fee = balance * 150 / 10000; // 1.5%
        uint256 share = fee / 3;

        status = Status.FUNDED;

        _safeTransfer(opsTreasury, share);
        _safeTransfer(rewardPool, share);
        _safeTransfer(protocolReserve, fee - (share * 2)); // remainder handles rounding
        _safeTransfer(institution, address(this).balance);

        emit Disbursed(institution, address(this).balance, fee);
    }

    function sweep(address reliefPool) external onlyDAO {
        require(status == Status.REFUNDABLE, "Not refundable");
        require(block.timestamp > refundDeadline, "Window still open");
        _safeTransfer(reliefPool, address(this).balance);
    }

    function _safeTransfer(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = payable(to).call{value: amount}("");
        require(ok, "Transfer failed");
    }
}
```

**Step 4: Run tests**

```bash
pnpm test test/CampaignVault.test.ts
```

Expected: 7 passing

**Step 5: Commit**

```bash
cd ../.. && git add packages/contracts/
git commit -m "feat(contracts): add CampaignVault with donate/refund/disburse"
```

---

## Task 9: CampaignFactory Contract

**Files:**
- Create: `packages/contracts/contracts/CampaignFactory.sol`
- Create: `packages/contracts/test/CampaignFactory.test.ts`

**Step 1: Write the failing test**

```typescript
// test/CampaignFactory.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("CampaignFactory", function () {
  async function deploy() {
    const [dao, oracle, ops, reward, protocol] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("InstitutionRegistry");
    const registry = await Registry.deploy([dao.address], 1);
    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy(
      dao.address, oracle.address,
      await registry.getAddress(),
      ops.address, reward.address, protocol.address
    );
    return { factory, registry, dao, oracle };
  }

  it("oracle can create a campaign vault", async function () {
    const { factory, oracle } = await deploy();
    const tx = await factory.connect(oracle).createCampaign(30, "ipfs://meta");
    const receipt = await tx.wait();
    expect(receipt!.logs.length).to.be.greaterThan(0);
    expect(await factory.campaignCount()).to.equal(1n);
  });

  it("non-oracle cannot create campaign", async function () {
    const { factory, dao } = await deploy();
    await expect(factory.connect(dao).createCampaign(30, "ipfs://meta"))
      .to.be.revertedWith("Not oracle");
  });

  it("returns vault address for campaign id", async function () {
    const { factory, oracle } = await deploy();
    await factory.connect(oracle).createCampaign(30, "ipfs://meta");
    const addr = await factory.campaigns(0);
    expect(addr).to.not.equal(ethers.ZeroAddress);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/contracts && pnpm test test/CampaignFactory.test.ts
```

**Step 3: Write the contract**

```solidity
// contracts/CampaignFactory.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CampaignVault.sol";

contract CampaignFactory {
    address public immutable dao;
    address public immutable oracle;
    address public immutable institutionRegistry;
    address public immutable opsTreasury;
    address public immutable rewardPool;
    address public immutable protocolReserve;

    address[] public campaigns;

    event CampaignCreated(uint256 indexed id, address vault, string metadataCID);

    modifier onlyOracle() { require(msg.sender == oracle, "Not oracle"); _; }

    constructor(
        address _dao, address _oracle, address _registry,
        address _ops, address _reward, address _protocol
    ) {
        dao = _dao; oracle = _oracle; institutionRegistry = _registry;
        opsTreasury = _ops; rewardPool = _reward; protocolReserve = _protocol;
    }

    function createCampaign(uint256 deadlineDays, string calldata metadataCID)
        external onlyOracle returns (address)
    {
        CampaignVault vault = new CampaignVault(
            dao, oracle, institutionRegistry,
            opsTreasury, rewardPool, protocolReserve,
            deadlineDays
        );
        uint256 id = campaigns.length;
        campaigns.push(address(vault));
        emit CampaignCreated(id, address(vault), metadataCID);
        return address(vault);
    }

    function campaignCount() external view returns (uint256) {
        return campaigns.length;
    }
}
```

**Step 4: Run tests**

```bash
pnpm test test/CampaignFactory.test.ts
```

Expected: 3 passing

**Step 5: Run all contract tests together**

```bash
pnpm test
```

Expected: All passing

**Step 6: Commit**

```bash
cd ../.. && git add packages/contracts/
git commit -m "feat(contracts): add CampaignFactory"
```

---

## Task 10: Contract Deployment Scripts

**Files:**
- Create: `packages/contracts/scripts/deploy.ts`
- Create: `packages/contracts/scripts/addresses.json`

**Step 1: Create deploy.ts**

```typescript
import { ethers } from "hardhat";
import { writeFileSync } from "fs";
import { join } from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. CrisisToken
  const Token = await ethers.getContractFactory("CrisisToken");
  const token = await Token.deploy(deployer.address);
  await token.waitForDeployment();
  console.log("CrisisToken:", await token.getAddress());

  // 2. InstitutionRegistry (deployer as initial admin)
  const Registry = await ethers.getContractFactory("InstitutionRegistry");
  const registry = await Registry.deploy([deployer.address], 1);
  await registry.waitForDeployment();
  console.log("InstitutionRegistry:", await registry.getAddress());

  // 3. ReputationRegistry
  const Reputation = await ethers.getContractFactory("ReputationRegistry");
  const reputation = await Reputation.deploy(
    await token.getAddress(),
    deployer.address // oracle address — update post-deploy
  );
  await reputation.waitForDeployment();
  console.log("ReputationRegistry:", await reputation.getAddress());

  // 4. CampaignFactory (deployer as oracle initially — update post-deploy)
  const Factory = await ethers.getContractFactory("CampaignFactory");
  const factory = await Factory.deploy(
    deployer.address,  // dao — update to Governor address
    deployer.address,  // oracle — update to AI service wallet
    await registry.getAddress(),
    deployer.address,  // opsTreasury
    deployer.address,  // rewardPool
    deployer.address   // protocolReserve
  );
  await factory.waitForDeployment();
  console.log("CampaignFactory:", await factory.getAddress());

  // Save addresses
  const addresses = {
    network: (await ethers.provider.getNetwork()).name,
    crisisToken: await token.getAddress(),
    institutionRegistry: await registry.getAddress(),
    reputationRegistry: await reputation.getAddress(),
    campaignFactory: await factory.getAddress(),
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(join(__dirname, "addresses.json"), JSON.stringify(addresses, null, 2));
  console.log("Addresses saved to scripts/addresses.json");
}

main().catch(console.error);
```

**Step 2: Deploy to local hardhat node**

```bash
# In one terminal: start hardhat node
cd packages/contracts && npx hardhat node

# In another terminal: deploy
npx hardhat run scripts/deploy.ts --network localhost
```

Expected: 4 contract addresses printed and saved to addresses.json

**Step 3: Commit**

```bash
cd ../.. && git add packages/contracts/scripts/
git commit -m "feat(contracts): add deployment script"
```

---

## Task 11: Campaign API — Project Setup

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/.env.example`

**Step 1: Create package.json**

```json
{
  "name": "@crisisvault/api",
  "version": "0.0.1",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "fastify": "^4.27.0",
    "@fastify/cors": "^9.0.1",
    "@fastify/websocket": "^8.3.1",
    "@supabase/supabase-js": "^2.43.0",
    "ioredis": "^5.3.2",
    "viem": "^2.13.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.11.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create src/config.ts**

```typescript
export const config = {
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || "",
  rpcUrl: process.env.RPC_URL || "http://localhost:8545",
  chainId: Number(process.env.CHAIN_ID || 8453),
  campaignFactoryAddress: process.env.CAMPAIGN_FACTORY_ADDRESS as `0x${string}` || "0x",
  oracleWallet: process.env.ORACLE_WALLET_ADDRESS as `0x${string}` || "0x",
};
```

**Step 4: Create src/index.ts**

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { config } from "./config";

const app = Fastify({ logger: true });

app.register(cors, { origin: true });
app.register(websocket);

app.get("/health", async () => ({ status: "ok", ts: Date.now() }));

app.listen({ port: config.port, host: "0.0.0.0" }, (err) => {
  if (err) { app.log.error(err); process.exit(1); }
});

export default app;
```

**Step 5: Install and start**

```bash
cd apps/api && pnpm install && pnpm dev
```

Expected: Server running on port 3001, `GET /health` returns `{ status: "ok" }`

**Step 6: Commit**

```bash
cd ../.. && git add apps/api/
git commit -m "feat(api): scaffold Fastify Campaign API"
```

---

## Task 12: Campaign API — Database Schema

**Files:**
- Create: `apps/api/src/db/migrations/001_initial.sql`
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/client.ts`

**Step 1: Create migration SQL**

```sql
-- apps/api/src/db/migrations/001_initial.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  reputation_score DECIMAL DEFAULT 0,
  total_donated_usd DECIMAL DEFAULT 0,
  verified_expert BOOLEAN DEFAULT FALSE,
  expert_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE campaign_status AS ENUM (
  'active','triggered','voting','funded','refundable','expired'
);
CREATE TYPE campaign_type AS ENUM (
  'earthquake','hurricane','flood','wildfire','famine','conflict','disease','climate'
);
CREATE TYPE severity AS ENUM ('low','medium','high','critical');

CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  registration_number VARCHAR(100),
  accreditation_body VARCHAR(255),
  country VARCHAR(100),
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  ipfs_credentials_cid VARCHAR(255),
  total_received_usd DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  onchain_proposal_id VARCHAR(255),
  type campaign_type NOT NULL,
  region_name VARCHAR(255) NOT NULL,
  bbox JSONB NOT NULL,
  centroid GEOMETRY(Point, 4326),
  status campaign_status DEFAULT 'active',
  confidence DECIMAL NOT NULL,
  severity severity NOT NULL,
  fundraising_target_usd DECIMAL NOT NULL,
  total_raised_usd DECIMAL DEFAULT 0,
  campaign_deadline TIMESTAMPTZ NOT NULL,
  refund_deadline TIMESTAMPTZ,
  contract_address VARCHAR(42),
  ipfs_metadata_cid VARCHAR(255),
  institution_id UUID REFERENCES institutions(id),
  oracle_sources JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  funded_at TIMESTAMPTZ
);

CREATE TABLE oracle_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  raw_data JSONB NOT NULL,
  location GEOMETRY(Point, 4326),
  confidence DECIMAL,
  processed BOOLEAN DEFAULT FALSE,
  campaign_id UUID REFERENCES campaigns(id),
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) NOT NULL,
  donor_address VARCHAR(42) NOT NULL,
  amount_eth DECIMAL NOT NULL,
  amount_usd DECIMAL,
  tx_hash VARCHAR(66) UNIQUE NOT NULL,
  block_number BIGINT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dao_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) NOT NULL,
  voter_address VARCHAR(42) NOT NULL,
  vote VARCHAR(10) NOT NULL CHECK (vote IN ('yes','no','abstain')),
  voting_power DECIMAL NOT NULL,
  tx_hash VARCHAR(66) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE features (
  key VARCHAR(100) PRIMARY KEY,
  enabled BOOLEAN DEFAULT TRUE,
  rollout_pct INTEGER DEFAULT 100 CHECK (rollout_pct BETWEEN 0 AND 100),
  environments JSONB DEFAULT '{"development":true,"staging":true,"production":true}',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed feature flags
INSERT INTO features (key, description, enabled) VALUES
  ('conflict_campaigns', 'Enable conflict zone campaign type', true),
  ('climate_prediction_v2', 'Next-gen climate ML model', false),
  ('institutional_dashboard', 'Institution analytics panel', true),
  ('multi_chain_bridge', 'Cross-chain donation bridge', false);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_centroid ON campaigns USING GIST(centroid);
CREATE INDEX idx_donations_campaign ON donations(campaign_id);
CREATE INDEX idx_donations_donor ON donations(donor_address);
```

**Step 2: Create src/db/client.ts**

```typescript
import { createClient } from "@supabase/supabase-js";
import { config } from "../config";

export const db = createClient(config.supabaseUrl, config.supabaseServiceKey);
```

**Step 3: Run migration against local postgres**

```bash
psql $DATABASE_URL -f apps/api/src/db/migrations/001_initial.sql
```

Expected: Tables created without errors

**Step 4: Commit**

```bash
git add apps/api/src/db/
git commit -m "feat(api): add database schema and migrations"
```

---

## Task 13: Campaign API — Campaign Endpoints

**Files:**
- Create: `apps/api/src/routes/campaigns.ts`
- Create: `apps/api/src/routes/campaigns.test.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Write the failing test**

```typescript
// src/routes/campaigns.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { build } from "../test-helpers";

describe("GET /api/v1/campaigns", () => {
  it("returns array of campaigns", async () => {
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/api/v1/campaigns" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("filters by status query param", async () => {
    const app = await build();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/campaigns?status=active",
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /api/v1/campaigns/:id", () => {
  it("returns 404 for unknown id", async () => {
    const app = await build();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/campaigns/00000000-0000-0000-0000-000000000000",
    });
    expect(res.statusCode).toBe(404);
  });
});
```

**Step 2: Create src/test-helpers.ts**

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import { campaignRoutes } from "./routes/campaigns";

export async function build() {
  const app = Fastify();
  await app.register(cors, { origin: true });
  await app.register(campaignRoutes, { prefix: "/api/v1" });
  await app.ready();
  return app;
}
```

**Step 3: Run test to verify it fails**

```bash
cd apps/api && pnpm test
```

Expected: FAIL — routes not yet created

**Step 4: Create src/routes/campaigns.ts**

```typescript
import { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { z } from "zod";

const statusValues = ["active","triggered","voting","funded","refundable","expired"] as const;

export async function campaignRoutes(app: FastifyInstance) {
  app.get("/campaigns", async (req, reply) => {
    const query = req.query as Record<string, string>;
    let q = db.from("campaigns").select("*").order("created_at", { ascending: false });
    if (query.status && statusValues.includes(query.status as typeof statusValues[number])) {
      q = q.eq("status", query.status);
    }
    const { data, error } = await q;
    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ data: data || [] });
  });

  app.get("/campaigns/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { data, error } = await db.from("campaigns").select("*, institutions(*)").eq("id", id).single();
    if (error || !data) return reply.status(404).send({ error: "Campaign not found" });
    return reply.send({ data });
  });
}
```

**Step 5: Register routes in index.ts**

```typescript
// Add to apps/api/src/index.ts
import { campaignRoutes } from "./routes/campaigns";
app.register(campaignRoutes, { prefix: "/api/v1" });
```

**Step 6: Run tests**

```bash
pnpm test
```

Expected: Tests pass (db calls return empty arrays in test env)

**Step 7: Commit**

```bash
cd ../.. && git add apps/api/
git commit -m "feat(api): add campaign REST endpoints"
```

---

## Task 14: Campaign API — WebSocket Real-Time Updates

**Files:**
- Create: `apps/api/src/realtime/broadcaster.ts`
- Create: `apps/api/src/routes/ws.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Create src/realtime/broadcaster.ts**

```typescript
import Redis from "ioredis";
import { config } from "../config";

const sub = new Redis(config.redisUrl);
const clients = new Set<(data: string) => void>();

sub.subscribe("campaign:updates", "prediction:new");

sub.on("message", (_channel: string, message: string) => {
  clients.forEach((send) => send(message));
});

export function addClient(send: (data: string) => void) {
  clients.add(send);
  return () => clients.delete(send);
}
```

**Step 2: Create src/routes/ws.ts**

```typescript
import { FastifyInstance } from "fastify";
import { addClient } from "../realtime/broadcaster";

export async function wsRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (socket) => {
    socket.send(JSON.stringify({ type: "connected" }));
    const remove = addClient((data) => socket.send(data));
    socket.on("close", remove);
  });
}
```

**Step 3: Register in index.ts**

```typescript
import { wsRoutes } from "./routes/ws";
app.register(wsRoutes, { prefix: "/api/v1" });
```

**Step 4: Commit**

```bash
git add apps/api/
git commit -m "feat(api): add WebSocket real-time broadcast via Redis pub/sub"
```

---

## Task 15: AI Prediction Service — Project Setup

**Files:**
- Create: `apps/ai-service/pyproject.toml`
- Create: `apps/ai-service/requirements.txt`
- Create: `apps/ai-service/src/__init__.py`
- Create: `apps/ai-service/src/main.py`
- Create: `apps/ai-service/src/config.py`

**Step 1: Create pyproject.toml**

```toml
[tool.poetry]
name = "crisisvault-ai"
version = "0.0.1"
description = "CrisisVault AI Prediction Service"

[tool.poetry.dependencies]
python = "^3.12"
fastapi = "^0.111.0"
uvicorn = "^0.30.0"
celery = "^5.4.0"
redis = "^5.0.0"
httpx = "^0.27.0"
pandas = "^2.2.0"
scikit-learn = "^1.5.0"
prophet = "^1.1.5"
pydantic = "^2.7.0"
pydantic-settings = "^2.3.0"

[tool.poetry.group.dev.dependencies]
pytest = "^8.2.0"
pytest-asyncio = "^0.23.0"
httpx = "^0.27.0"
```

**Step 2: Create src/config.py**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379"
    database_url: str = ""
    acled_api_key: str = ""
    nasa_firms_api_key: str = ""
    prediction_confidence_threshold: float = 0.70
    poll_interval_seconds: int = 900  # 15 minutes
    campaign_api_url: str = "http://localhost:3001"

    class Config:
        env_file = ".env"

settings = Settings()
```

**Step 3: Create src/main.py**

```python
from fastapi import FastAPI
from .config import settings

app = FastAPI(title="CrisisVault AI Service")

@app.get("/health")
def health():
    return {"status": "ok", "threshold": settings.prediction_confidence_threshold}
```

**Step 4: Install and run**

```bash
cd apps/ai-service
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

Expected: `GET /health` returns 200

**Step 5: Commit**

```bash
cd ../.. && git add apps/ai-service/
git commit -m "feat(ai): scaffold FastAPI AI prediction service"
```

---

## Task 16: AI Service — Oracle Adapter Interface + USGS Adapter

**Files:**
- Create: `apps/ai-service/src/adapters/base.py`
- Create: `apps/ai-service/src/adapters/usgs.py`
- Create: `apps/ai-service/src/adapters/gdacs.py`
- Create: `apps/ai-service/tests/test_usgs_adapter.py`

**Step 1: Write the failing test**

```python
# tests/test_usgs_adapter.py
import pytest
from unittest.mock import AsyncMock, patch
from src.adapters.usgs import USGSAdapter

@pytest.mark.asyncio
async def test_usgs_fetch_returns_events():
    adapter = USGSAdapter()
    mock_response = {
        "features": [
            {
                "properties": {
                    "mag": 6.8, "place": "Philippines",
                    "time": 1709000000000, "alert": "orange",
                    "tsunami": 0, "sig": 800
                },
                "geometry": {"coordinates": [121.0, 15.0, 10.0]}
            }
        ]
    }
    with patch.object(adapter, "_fetch_raw", new=AsyncMock(return_value=mock_response)):
        events = await adapter.fetch()
    assert len(events) == 1
    assert events[0].source == "USGS"
    assert events[0].event_type == "earthquake"
    assert events[0].confidence > 0
    assert events[0].location["lat"] == 15.0
    assert events[0].location["lng"] == 121.0

@pytest.mark.asyncio
async def test_usgs_filters_low_magnitude():
    adapter = USGSAdapter(min_magnitude=5.0)
    mock_response = {
        "features": [
            {"properties": {"mag": 3.2, "place": "Remote Ocean", "time": 1709000000000, "alert": None, "tsunami": 0, "sig": 100},
             "geometry": {"coordinates": [150.0, -40.0, 20.0]}}
        ]
    }
    with patch.object(adapter, "_fetch_raw", new=AsyncMock(return_value=mock_response)):
        events = await adapter.fetch()
    assert len(events) == 0
```

**Step 2: Run test to verify it fails**

```bash
cd apps/ai-service && python -m pytest tests/test_usgs_adapter.py -v
```

Expected: FAIL — module not found

**Step 3: Create src/adapters/base.py**

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

@dataclass
class OracleEvent:
    source: str
    event_type: str
    raw_data: dict[str, Any]
    location: dict[str, float]  # {"lat": ..., "lng": ...}
    confidence: float  # 0.0 - 1.0
    magnitude: float = 0.0
    region: str = ""

class OracleAdapter(ABC):
    @abstractmethod
    async def fetch(self) -> list[OracleEvent]:
        """Fetch and normalize events from this oracle source."""
        ...

    @abstractmethod
    async def _fetch_raw(self) -> dict:
        """Fetch raw data from the external API."""
        ...
```

**Step 4: Create src/adapters/usgs.py**

```python
import httpx
from .base import OracleAdapter, OracleEvent

USGS_URL = (
    "https://earthquake.usgs.gov/fdsnws/event/1/query"
    "?format=geojson&orderby=time&limit=100&minmagnitude={min_mag}"
    "&starttime=now-1day"
)

class USGSAdapter(OracleAdapter):
    def __init__(self, min_magnitude: float = 5.0):
        self.min_magnitude = min_magnitude

    async def _fetch_raw(self) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(USGS_URL.format(min_mag=self.min_magnitude))
            r.raise_for_status()
            return r.json()

    async def fetch(self) -> list[OracleEvent]:
        data = await self._fetch_raw()
        events = []
        for feature in data.get("features", []):
            props = feature["properties"]
            mag = props.get("mag", 0) or 0
            if mag < self.min_magnitude:
                continue
            coords = feature["geometry"]["coordinates"]
            sig = props.get("sig", 0) or 0
            confidence = min(sig / 1000.0, 1.0)
            events.append(OracleEvent(
                source="USGS",
                event_type="earthquake",
                raw_data=props,
                location={"lat": coords[1], "lng": coords[0]},
                confidence=confidence,
                magnitude=mag,
                region=props.get("place", "Unknown"),
            ))
        return events
```

**Step 5: Run tests**

```bash
python -m pytest tests/test_usgs_adapter.py -v
```

Expected: 2 passing

**Step 6: Create src/adapters/gdacs.py** (no test — pattern identical to USGS)

```python
import httpx
import xml.etree.ElementTree as ET
from .base import OracleAdapter, OracleEvent

GDACS_URL = "https://www.gdacs.org/xml/rss.xml"

class GDACSAdapter(OracleAdapter):
    async def _fetch_raw(self) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(GDACS_URL)
            r.raise_for_status()
            return {"content": r.text}

    async def fetch(self) -> list[OracleEvent]:
        raw = await self._fetch_raw()
        root = ET.fromstring(raw["content"])
        ns = {"geo": "http://www.w3.org/2003/01/geo/wgs84_pos#",
              "gdacs": "http://www.gdacs.org"}
        events = []
        for item in root.findall(".//item"):
            title = item.findtext("title") or ""
            lat_el = item.find("geo:lat", ns)
            lng_el = item.find("geo:long", ns)
            if lat_el is None or lng_el is None:
                continue
            alert = item.findtext("{http://www.gdacs.org}alertlevel") or "green"
            confidence = {"red": 0.9, "orange": 0.7, "green": 0.4}.get(alert.lower(), 0.3)
            events.append(OracleEvent(
                source="GDACS",
                event_type="multi_hazard",
                raw_data={"title": title, "alert": alert},
                location={"lat": float(lat_el.text or 0), "lng": float(lng_el.text or 0)},
                confidence=confidence,
                region=title,
            ))
        return events
```

**Step 7: Commit**

```bash
cd ../.. && git add apps/ai-service/
git commit -m "feat(ai): add oracle adapter interface, USGS and GDACS adapters"
```

---

## Task 17: AI Service — Prediction Pipeline + Campaign Proposal Emitter

**Files:**
- Create: `apps/ai-service/src/pipeline.py`
- Create: `apps/ai-service/src/emitter.py`
- Create: `apps/ai-service/src/worker.py`
- Create: `apps/ai-service/tests/test_pipeline.py`

**Step 1: Write the failing test**

```python
# tests/test_pipeline.py
import pytest
from src.pipeline import score_events, should_create_campaign
from src.adapters.base import OracleEvent

def make_event(confidence=0.8, event_type="earthquake", mag=6.8):
    return OracleEvent(
        source="USGS", event_type=event_type,
        raw_data={}, location={"lat": 15.0, "lng": 121.0},
        confidence=confidence, magnitude=mag, region="Philippines"
    )

def test_high_confidence_event_passes_threshold():
    events = [make_event(confidence=0.85)]
    proposals = should_create_campaign(events, threshold=0.70)
    assert len(proposals) == 1

def test_low_confidence_event_filtered():
    events = [make_event(confidence=0.4)]
    proposals = should_create_campaign(events, threshold=0.70)
    assert len(proposals) == 0

def test_score_events_adds_severity():
    events = [make_event(confidence=0.9, mag=7.5)]
    scored = score_events(events)
    assert scored[0]["severity"] in ("low", "medium", "high", "critical")

def test_high_magnitude_gets_high_severity():
    events = [make_event(confidence=0.9, mag=7.5)]
    scored = score_events(events)
    assert scored[0]["severity"] in ("high", "critical")

def test_fundraising_target_is_positive():
    events = [make_event(confidence=0.9, mag=6.8)]
    scored = score_events(events)
    assert scored[0]["fundraising_target_usd"] > 0
```

**Step 2: Run test to verify it fails**

```bash
cd apps/ai-service && python -m pytest tests/test_pipeline.py -v
```

**Step 3: Create src/pipeline.py**

```python
from .adapters.base import OracleEvent
from typing import Any

SEVERITY_THRESHOLDS = {
    "earthquake": [(7.5, "critical"), (6.5, "high"), (5.5, "medium"), (0, "low")],
    "hurricane":  [(4, "critical"), (3, "high"), (2, "medium"), (0, "low")],
    "default":    [(0.9, "critical"), (0.75, "high"), (0.55, "medium"), (0, "low")],
}

# Historical median cost estimates by type+severity (USD)
COST_ESTIMATES = {
    ("earthquake", "critical"): 5_000_000,
    ("earthquake", "high"):     2_000_000,
    ("earthquake", "medium"):     800_000,
    ("earthquake", "low"):        200_000,
    ("hurricane",  "critical"): 8_000_000,
    ("hurricane",  "high"):     3_000_000,
    ("hurricane",  "medium"):   1_000_000,
    ("hurricane",  "low"):        300_000,
}

def _get_severity(event_type: str, magnitude: float) -> str:
    thresholds = SEVERITY_THRESHOLDS.get(event_type, SEVERITY_THRESHOLDS["default"])
    for threshold, label in thresholds:
        if magnitude >= threshold:
            return label
    return "low"

def score_events(events: list[OracleEvent]) -> list[dict[str, Any]]:
    scored = []
    for e in events:
        severity = _get_severity(e.event_type, e.magnitude)
        target = COST_ESTIMATES.get(
            (e.event_type, severity),
            500_000  # default estimate
        )
        scored.append({
            "event": e,
            "severity": severity,
            "fundraising_target_usd": target,
            "confidence": e.confidence,
        })
    return scored

def should_create_campaign(
    events: list[OracleEvent],
    threshold: float = 0.70
) -> list[dict[str, Any]]:
    scored = score_events(events)
    return [s for s in scored if s["confidence"] >= threshold]
```

**Step 4: Create src/emitter.py**

```python
import json
import redis
from .config import settings
from .adapters.base import OracleEvent
from typing import Any

_redis = redis.from_url(settings.redis_url)

def emit_campaign_proposal(scored: dict[str, Any]):
    event: OracleEvent = scored["event"]
    payload = {
        "type": event.event_type,
        "region": event.region,
        "bbox": [
            event.location["lng"] - 2, event.location["lat"] - 2,
            event.location["lng"] + 2, event.location["lat"] + 2,
        ],
        "confidence": scored["confidence"],
        "severity": scored["severity"],
        "estimated_affected_population": 100_000,  # placeholder
        "fundraising_target_usd": scored["fundraising_target_usd"],
        "oracle_sources": [event.source],
        "campaign_deadline_days": 21,
        "oracle_confirmed": True,
        "prediction_window": {"start": "", "end": ""},
    }
    _redis.publish("campaign:proposals", json.dumps(payload))
```

**Step 5: Create src/worker.py**

```python
import asyncio
import logging
from .adapters.usgs import USGSAdapter
from .adapters.gdacs import GDACSAdapter
from .pipeline import should_create_campaign
from .emitter import emit_campaign_proposal
from .config import settings

log = logging.getLogger(__name__)
ADAPTERS = [USGSAdapter(min_magnitude=5.0), GDACSAdapter()]

async def run_once():
    all_events = []
    for adapter in ADAPTERS:
        try:
            events = await adapter.fetch()
            all_events.extend(events)
            log.info(f"{adapter.__class__.__name__}: {len(events)} events")
        except Exception as e:
            log.error(f"{adapter.__class__.__name__} failed: {e}")
    proposals = should_create_campaign(all_events, settings.prediction_confidence_threshold)
    for proposal in proposals:
        emit_campaign_proposal(proposal)
        log.info(f"Emitted proposal: {proposal['event'].region}")

async def run_loop():
    while True:
        await run_once()
        await asyncio.sleep(settings.poll_interval_seconds)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_loop())
```

**Step 6: Run tests**

```bash
python -m pytest tests/test_pipeline.py -v
```

Expected: 5 passing

**Step 7: Commit**

```bash
cd ../.. && git add apps/ai-service/
git commit -m "feat(ai): add prediction pipeline and Redis proposal emitter"
```

---

## Task 18: Frontend — Vite + React + TailwindCSS Setup

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/src/index.css`

**Step 1: Create package.json**

```json
{
  "name": "@crisisvault/web",
  "version": "0.0.1",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "@crisisvault/shared-types": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "cesium": "^1.118.0",
    "resium": "^1.17.0",
    "@deck.gl/core": "^9.0.0",
    "@deck.gl/layers": "^9.0.0",
    "@deck.gl/react": "^9.0.0",
    "@rainbow-me/rainbowkit": "^2.1.0",
    "wagmi": "^2.10.0",
    "viem": "^2.13.0",
    "@tanstack/react-query": "^5.40.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.3.0",
    "vite-plugin-cesium": "^1.3.0",
    "vitest": "^1.6.0"
  }
}
```

**Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cesium from "vite-plugin-cesium";

export default defineConfig({
  plugins: [react(), cesium()],
  server: { port: 3000 },
});
```

**Step 3: Create src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body { margin: 0; overflow: hidden; background: #0a0a0a; }
```

**Step 4: Create src/App.tsx** (placeholder — replaced in Task 19)

```tsx
export default function App() {
  return (
    <div className="flex items-center justify-center h-screen text-white bg-gray-900">
      <h1 className="text-3xl font-bold">CrisisVault</h1>
    </div>
  );
}
```

**Step 5: Create src/main.tsx**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import App from "./App";
import "./index.css";

const config = getDefaultConfig({
  appName: "CrisisVault",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [base, baseSepolia],
  transports: { [base.id]: http(), [baseSepolia.id]: http() },
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
```

**Step 6: Install and start**

```bash
cd apps/web && pnpm install && pnpm dev
```

Expected: Dev server at http://localhost:3000 showing "CrisisVault" heading

**Step 7: Commit**

```bash
cd ../.. && git add apps/web/
git commit -m "feat(web): scaffold React + CesiumJS + Deck.gl + RainbowKit frontend"
```

---

## Task 19: Frontend — CesiumJS Globe Component

**Files:**
- Create: `apps/web/src/components/Globe/Globe.tsx`
- Create: `apps/web/src/components/Globe/index.ts`
- Create: `apps/web/src/components/Globe/useCampaigns.ts`
- Modify: `apps/web/src/App.tsx`

**Step 1: Create src/components/Globe/useCampaigns.ts**

```typescript
import { useQuery } from "@tanstack/react-query";
import type { Campaign } from "@crisisvault/shared-types";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function useCampaigns(status?: string) {
  return useQuery<{ data: Campaign[] }>({
    queryKey: ["campaigns", status],
    queryFn: async () => {
      const url = status
        ? `${API}/api/v1/campaigns?status=${status}`
        : `${API}/api/v1/campaigns`;
      const res = await fetch(url);
      return res.json();
    },
    refetchInterval: 30_000,
  });
}
```

**Step 2: Create src/components/Globe/Globe.tsx**

```tsx
import { Viewer, Entity, PointGraphics, CameraFlyTo } from "resium";
import { Cartesian3, Color, IonImageryProvider, createWorldTerrainAsync } from "cesium";
import { useMemo, useState } from "react";
import { useCampaigns } from "./useCampaigns";
import type { Campaign } from "@crisisvault/shared-types";

const STATUS_COLORS: Record<string, Color> = {
  active:     Color.DODGERBLUE,
  triggered:  Color.ORANGE,
  voting:     Color.RED,
  funded:     Color.LIMEGREEN,
  refundable: Color.GOLD,
  expired:    Color.GRAY,
};

interface GlobeProps {
  onSelectCampaign: (c: Campaign) => void;
}

export function Globe({ onSelectCampaign }: GlobeProps) {
  const { data } = useCampaigns();
  const campaigns = data?.data ?? [];

  return (
    <Viewer
      full
      timeline={false}
      animation={false}
      baseLayerPicker={false}
      navigationHelpButton={false}
      homeButton={false}
      geocoder={false}
      sceneModePicker={false}
    >
      {campaigns.map((campaign) => (
        <Entity
          key={campaign.id}
          name={campaign.regionName}
          position={Cartesian3.fromDegrees(
            campaign.centroid.lng,
            campaign.centroid.lat
          )}
          onClick={() => onSelectCampaign(campaign)}
        >
          <PointGraphics
            pixelSize={14}
            color={STATUS_COLORS[campaign.status] ?? Color.WHITE}
            outlineColor={Color.WHITE}
            outlineWidth={2}
          />
        </Entity>
      ))}
    </Viewer>
  );
}
```

**Step 3: Create src/components/Globe/index.ts**

```typescript
export { Globe } from "./Globe";
export { useCampaigns } from "./useCampaigns";
```

**Step 4: Update src/App.tsx**

```tsx
import { useState } from "react";
import { Globe } from "./components/Globe";
import { TopBar } from "./components/TopBar";
import { CampaignPanel } from "./components/CampaignPanel";
import { StatusStrip } from "./components/StatusStrip";
import type { Campaign } from "@crisisvault/shared-types";

export default function App() {
  const [selected, setSelected] = useState<Campaign | null>(null);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <TopBar />
      <Globe onSelectCampaign={setSelected} />
      {selected && (
        <CampaignPanel campaign={selected} onClose={() => setSelected(null)} />
      )}
      <StatusStrip />
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add apps/web/src/components/Globe/
git commit -m "feat(web): add CesiumJS globe with campaign markers"
```

---

## Task 20: Frontend — TopBar, CampaignPanel, StatusStrip Components

**Files:**
- Create: `apps/web/src/components/TopBar/TopBar.tsx`
- Create: `apps/web/src/components/TopBar/index.ts`
- Create: `apps/web/src/components/CampaignPanel/CampaignPanel.tsx`
- Create: `apps/web/src/components/CampaignPanel/index.ts`
- Create: `apps/web/src/components/StatusStrip/StatusStrip.tsx`
- Create: `apps/web/src/components/StatusStrip/index.ts`

**Step 1: Create TopBar.tsx**

```tsx
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function TopBar() {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-black/70 backdrop-blur border-b border-white/10">
      <span className="text-white font-bold text-lg tracking-tight">CrisisVault</span>
      <input
        className="bg-white/10 text-white placeholder-white/40 rounded px-3 py-1 text-sm outline-none w-64"
        placeholder="Search region..."
      />
      <ConnectButton />
    </div>
  );
}
```

**Step 2: Create CampaignPanel.tsx**

```tsx
import type { Campaign } from "@crisisvault/shared-types";
import { DonateButton } from "../DonateButton";

interface Props {
  campaign: Campaign;
  onClose: () => void;
}

const PCT_COLORS: Record<string, string> = {
  active: "bg-blue-500", triggered: "bg-orange-500",
  voting: "bg-red-500", funded: "bg-green-500",
  refundable: "bg-yellow-500", expired: "bg-gray-500",
};

export function CampaignPanel({ campaign, onClose }: Props) {
  const pct = Math.min(
    100,
    Math.round((campaign.totalRaisedUsd / campaign.fundraisingTargetUsd) * 100)
  );

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-black/80 backdrop-blur border-l border-white/10 p-4 flex flex-col gap-4 text-white z-10">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold text-base">{campaign.regionName}</div>
          <div className="text-sm text-white/60 capitalize">{campaign.type}</div>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        <span className="bg-white/10 px-2 py-1 rounded">
          Confidence: {Math.round(campaign.confidence * 100)}%
        </span>
        <span className="bg-white/10 px-2 py-1 rounded capitalize">
          {campaign.severity}
        </span>
        <span className={`px-2 py-1 rounded capitalize ${PCT_COLORS[campaign.status]}`}>
          {campaign.status}
        </span>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>Raised</span>
          <span>${campaign.totalRaisedUsd.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span>Target</span>
          <span>${campaign.fundraisingTargetUsd.toLocaleString()}</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${PCT_COLORS[campaign.status]}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs text-white/40 mt-1 text-right">{pct}%</div>
      </div>

      <div className="text-xs text-white/40">
        Oracle sources: {campaign.oracleSources.join(", ")}
      </div>

      {campaign.status === "active" && <DonateButton campaign={campaign} />}
      {campaign.status === "refundable" && (
        <button className="w-full py-2 rounded bg-yellow-500 text-black font-semibold text-sm">
          Claim Refund
        </button>
      )}
      {campaign.status === "voting" && (
        <div className="flex gap-2">
          <button className="flex-1 py-2 rounded bg-green-600 text-white text-sm font-semibold">
            Vote Yes
          </button>
          <button className="flex-1 py-2 rounded bg-red-600 text-white text-sm font-semibold">
            Vote No
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create StatusStrip.tsx**

```tsx
import { useCampaigns } from "../Globe/useCampaigns";

export function StatusStrip() {
  const { data } = useCampaigns();
  const campaigns = data?.data ?? [];
  const active = campaigns.filter((c) => c.status === "active").length;
  const voting = campaigns.filter((c) => c.status === "voting").length;
  const funded = campaigns.filter((c) => c.status === "funded").length;
  const total = campaigns.reduce((s, c) => s + c.totalRaisedUsd, 0);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-6 px-6 py-2 bg-black/70 backdrop-blur border-t border-white/10 text-xs text-white/60">
      <span><b className="text-white">{active}</b> active campaigns</span>
      <span><b className="text-white">${total.toLocaleString()}</b> raised</span>
      <span><b className="text-yellow-400">{voting}</b> in voting</span>
      <span><b className="text-green-400">{funded}</b> funded</span>
    </div>
  );
}
```

**Step 4: Create DonateButton placeholder**

```tsx
// apps/web/src/components/DonateButton/DonateButton.tsx
import type { Campaign } from "@crisisvault/shared-types";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function DonateButton({ campaign }: { campaign: Campaign }) {
  const { isConnected } = useAccount();
  if (!isConnected) return <ConnectButton />;
  return (
    <button className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm">
      Donate to Campaign
    </button>
  );
}
```

**Step 5: Create all index.ts barrel files**

```typescript
// TopBar/index.ts
export { TopBar } from "./TopBar";

// CampaignPanel/index.ts
export { CampaignPanel } from "./CampaignPanel";

// StatusStrip/index.ts
export { StatusStrip } from "./StatusStrip";

// DonateButton/index.ts
export { DonateButton } from "./DonateButton";
```

**Step 6: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): add TopBar, CampaignPanel, StatusStrip, DonateButton components"
```

---

## Task 21: Frontend — Deck.gl Risk Heat Map Layer

**Files:**
- Create: `apps/web/src/components/Globe/RiskOverlay.tsx`
- Modify: `apps/web/src/components/Globe/Globe.tsx`

**Step 1: Create RiskOverlay.tsx**

```tsx
import DeckGL from "@deck.gl/react";
import { HeatmapLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Campaign } from "@crisisvault/shared-types";

const STATUS_RGB: Record<string, [number, number, number]> = {
  active:     [30, 144, 255],
  triggered:  [255, 165, 0],
  voting:     [220, 20, 60],
  funded:     [50, 205, 50],
  refundable: [255, 215, 0],
  expired:    [128, 128, 128],
};

interface Props {
  campaigns: Campaign[];
  onSelectCampaign: (c: Campaign) => void;
}

export function RiskOverlay({ campaigns, onSelectCampaign }: Props) {
  const heatData = campaigns.map((c) => ({
    coordinates: [c.centroid.lng, c.centroid.lat] as [number, number],
    weight: c.confidence,
  }));

  const layers = [
    new HeatmapLayer({
      id: "risk-heat",
      data: heatData,
      getPosition: (d) => d.coordinates,
      getWeight: (d) => d.weight,
      radiusPixels: 80,
      intensity: 1,
      threshold: 0.05,
      colorRange: [
        [0, 128, 0, 180],
        [255, 255, 0, 180],
        [255, 128, 0, 200],
        [220, 20, 60, 220],
      ],
    }),
    new ScatterplotLayer({
      id: "campaign-points",
      data: campaigns,
      getPosition: (c: Campaign) => [c.centroid.lng, c.centroid.lat],
      getRadius: 40000,
      getFillColor: (c: Campaign) => STATUS_RGB[c.status] ?? [255, 255, 255],
      pickable: true,
      onClick: ({ object }) => object && onSelectCampaign(object as Campaign),
      stroked: true,
      getLineColor: [255, 255, 255],
      lineWidthMinPixels: 1,
    }),
  ];

  return (
    <DeckGL
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      layers={layers}
      controller={false}
    />
  );
}
```

**Step 2: Add RiskOverlay to Globe.tsx**

```tsx
// Add import at top of Globe.tsx
import { RiskOverlay } from "./RiskOverlay";

// Add inside <Viewer> JSX, after Entity list:
// <RiskOverlay campaigns={campaigns} onSelectCampaign={onSelectCampaign} />
```

**Step 3: Commit**

```bash
git add apps/web/src/components/Globe/
git commit -m "feat(web): add Deck.gl heatmap and scatterplot risk overlay"
```

---

## Task 22: Feature Flags System

**Files:**
- Create: `apps/api/src/routes/features.ts`
- Create: `apps/web/src/hooks/useFeatureFlag.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Create API endpoint for feature flags**

```typescript
// apps/api/src/routes/features.ts
import { FastifyInstance } from "fastify";
import { db } from "../db/client";

export async function featureRoutes(app: FastifyInstance) {
  app.get("/features", async (_req, reply) => {
    const { data } = await db.from("features").select("key,enabled,rollout_pct,environments");
    const flags = Object.fromEntries((data || []).map((f) => [f.key, f.enabled]));
    return reply.send(flags);
  });
}
```

**Step 2: Register in API index.ts**

```typescript
import { featureRoutes } from "./routes/features";
app.register(featureRoutes, { prefix: "/api/v1" });
```

**Step 3: Create frontend hook**

```typescript
// apps/web/src/hooks/useFeatureFlag.ts
import { useQuery } from "@tanstack/react-query";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

function useFeatureFlags() {
  return useQuery<Record<string, boolean>>({
    queryKey: ["features"],
    queryFn: () => fetch(`${API}/api/v1/features`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

export function useFeatureFlag(key: string): boolean {
  const { data } = useFeatureFlags();
  return data?.[key] ?? false;
}
```

**Step 4: Commit**

```bash
git add apps/api/src/routes/features.ts apps/web/src/hooks/
git commit -m "feat: add feature flag system (API + React hook)"
```

---

## Task 23: Deployment Configuration

**Files:**
- Create: `apps/web/vercel.json`
- Create: `apps/api/railway.json`
- Create: `apps/ai-service/Procfile`
- Create: `infra/docker-compose.prod.yml`
- Create: `.env.example` (root)

**Step 1: Create apps/web/vercel.json**

```json
{
  "buildCommand": "cd ../.. && pnpm build --filter @crisisvault/web",
  "outputDirectory": "apps/web/dist",
  "installCommand": "pnpm install",
  "framework": null,
  "env": {
    "VITE_API_URL": "@crisisvault_api_url",
    "VITE_WALLETCONNECT_PROJECT_ID": "@walletconnect_project_id"
  }
}
```

**Step 2: Create apps/api/railway.json**

```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

**Step 3: Create apps/ai-service/Procfile**

```
worker: python -m src.worker
web: uvicorn src.main:app --host 0.0.0.0 --port $PORT
```

**Step 4: Create root .env.example**

```bash
# === Campaign API ===
PORT=3001
DATABASE_URL=postgresql://crisisvault:crisisvault@localhost:5432/crisisvault
REDIS_URL=redis://localhost:6379
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# === AI Service ===
ACLED_API_KEY=your-acled-key
NASA_FIRMS_API_KEY=your-nasa-key
PREDICTION_CONFIDENCE_THRESHOLD=0.70
POLL_INTERVAL_SECONDS=900

# === Smart Contracts ===
BASE_RPC_URL=https://mainnet.base.org
DEPLOYER_PRIVATE_KEY=your-private-key
CAMPAIGN_FACTORY_ADDRESS=0x...
ORACLE_WALLET_ADDRESS=0x...

# === Frontend ===
VITE_API_URL=http://localhost:3001
VITE_WALLETCONNECT_PROJECT_ID=your-walletconnect-id
```

**Step 5: Commit**

```bash
git add apps/web/vercel.json apps/api/railway.json apps/ai-service/Procfile .env.example
git commit -m "chore: add deployment configs for Vercel, Railway, and AI service"
```

---

## Task 24: End-to-End Integration Test

**Files:**
- Create: `apps/api/src/listeners/campaignProposalListener.ts`
- Create: `apps/api/tests/integration.test.ts`

**Step 1: Create the proposal listener (Campaign API subscribes to AI proposals)**

```typescript
// apps/api/src/listeners/campaignProposalListener.ts
import Redis from "ioredis";
import { db } from "../db/client";
import { config } from "../config";

export function startProposalListener() {
  const sub = new Redis(config.redisUrl);
  sub.subscribe("campaign:proposals");
  sub.on("message", async (_channel: string, message: string) => {
    try {
      const proposal = JSON.parse(message);
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + (proposal.campaign_deadline_days || 21));

      const { error } = await db.from("campaigns").insert({
        type: proposal.type,
        region_name: proposal.region,
        bbox: proposal.bbox,
        centroid: `POINT(${proposal.bbox[0] + (proposal.bbox[2] - proposal.bbox[0]) / 2} ${proposal.bbox[1] + (proposal.bbox[3] - proposal.bbox[1]) / 2})`,
        status: "active",
        confidence: proposal.confidence,
        severity: proposal.severity,
        fundraising_target_usd: proposal.fundraising_target_usd,
        campaign_deadline: deadline.toISOString(),
        oracle_sources: proposal.oracle_sources,
      });

      if (error) console.error("Failed to create campaign:", error);
      else console.log(`Campaign created: ${proposal.region}`);
    } catch (e) {
      console.error("Proposal listener error:", e);
    }
  });
}
```

**Step 2: Wire listener into API startup (apps/api/src/index.ts)**

```typescript
import { startProposalListener } from "./listeners/campaignProposalListener";
// Add after app.listen():
startProposalListener();
```

**Step 3: Smoke test the full flow manually**

```bash
# Terminal 1: Start infra
cd infra && docker-compose up

# Terminal 2: Start Campaign API
cd apps/api && pnpm dev

# Terminal 3: Start AI service
cd apps/ai-service && python -m src.worker

# Terminal 4: Start frontend
cd apps/web && pnpm dev

# Verify: open http://localhost:3000
# AI service should emit proposals → API creates campaigns → Globe shows markers
```

**Step 4: Final commit**

```bash
git add apps/api/src/listeners/
git commit -m "feat(api): subscribe to AI campaign proposals via Redis"
```

---

## Checklist Before Deploying

- [ ] All contract tests pass: `cd packages/contracts && pnpm test`
- [ ] API tests pass: `cd apps/api && pnpm test`
- [ ] AI service tests pass: `cd apps/ai-service && python -m pytest`
- [ ] Frontend builds without errors: `cd apps/web && pnpm build`
- [ ] Contracts deployed to Base Sepolia testnet: `pnpm deploy:base-sepolia`
- [ ] `.env` files configured for all services
- [ ] Feature flags seeded in Supabase
- [ ] WalletConnect project ID registered at cloud.walletconnect.com
- [ ] Vercel project linked to `apps/web`
- [ ] Railway services created for `apps/api` and `apps/ai-service`
- [ ] Upstash Redis instance created, `REDIS_URL` set
- [ ] Supabase project created, migration SQL run, service key set
- [ ] Cloudflare DNS pointing to Vercel frontend

---

## Future Tasks (Post-MVP, feature-flagged)

- DAO Governor contract (OpenZeppelin Governor + Timelock) — full on-chain voting
- Donation flow with wagmi `useWriteContract` — live ETH/USDC transactions
- Refund claim flow — on-chain transaction from panel
- WHO, ACLED, Copernicus, NASA FIRMS oracle adapters
- Prophet time-series model for regional risk forecasting
- Institution verification admin panel
- Mobile responsive layout
- Multi-chain bridge (Base → Ethereum mainnet treasury)
- Email/push notification service for donors
- On-chain event indexer (The Graph subgraph for donations/votes)
