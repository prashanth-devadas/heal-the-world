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
