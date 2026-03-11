import { HardhatUserConfig, subtask } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names";
import path from "path";

// Override compiler acquisition to use bundled solc npm package (offline-safe)
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args: any) => {
  const solcPath = path.join(
    __dirname,
    "../../node_modules/.pnpm/solc@0.8.26_debug@4.4.3/node_modules/solc/soljson.js",
  );
  return {
    compilerPath: solcPath,
    isSolcJs: true,
    version: args.solcVersion,
    longVersion: "0.8.26+commit.8a97fa7a",
  };
});

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
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
      accounts: process.env.TESTNET_DEPLOYER_PRIVATE_KEY
        ? [process.env.TESTNET_DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
  paths: {
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
