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
    deployer.address
  );
  await reputation.waitForDeployment();
  console.log("ReputationRegistry:", await reputation.getAddress());

  // 4. CampaignFactory
  const Factory = await ethers.getContractFactory("CampaignFactory");
  const factory = await Factory.deploy(
    deployer.address,
    deployer.address,
    await registry.getAddress(),
    deployer.address,
    deployer.address,
    deployer.address
  );
  await factory.waitForDeployment();
  console.log("CampaignFactory:", await factory.getAddress());

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
  console.log(addresses);
}

main().catch(console.error);
