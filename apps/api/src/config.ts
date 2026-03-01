export const config = {
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  supabaseUrl: process.env.SUPABASE_URL || "http://localhost:54321",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || "local-service-key",
  rpcUrl: process.env.RPC_URL || "http://localhost:8545",
  chainId: Number(process.env.CHAIN_ID || 8453),
  campaignFactoryAddress: (process.env.CAMPAIGN_FACTORY_ADDRESS || "0x") as `0x${string}`,
  oracleWallet: (process.env.ORACLE_WALLET_ADDRESS || "0x") as `0x${string}`,
};
