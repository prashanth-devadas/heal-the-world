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
    await token.connect(owner).mint(user1.address, 100n);
    await token.connect(user1).delegate(user1.address);
    await registry.connect(oracle).setReputation(user1.address, 100n);
    // sqrt(100 * 100) = sqrt(10000) = 100
    expect(await registry.votingPower(user1.address)).to.equal(100n);
  });
});
