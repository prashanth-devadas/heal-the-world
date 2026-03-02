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

INSERT INTO features (key, description, enabled) VALUES
  ('conflict_campaigns', 'Enable conflict zone campaign type', true),
  ('climate_prediction_v2', 'Next-gen climate ML model', false),
  ('institutional_dashboard', 'Institution analytics panel', true),
  ('multi_chain_bridge', 'Cross-chain donation bridge', false),
  ('risk_heatmap', 'Deck.gl risk heatmap overlay on globe', true);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_centroid ON campaigns USING GIST(centroid);
CREATE INDEX idx_donations_campaign ON donations(campaign_id);
CREATE INDEX idx_donations_donor ON donations(donor_address);
