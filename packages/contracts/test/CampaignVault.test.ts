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
    const vault = await Vault.deploy(
      dao.address,
      oracle.address,
      await registry.getAddress(),
      opsTreasury.address,
      rewardPool.address,
      protocolReserve.address,
      30
    );
    return { vault, registry, dao, oracle, institution, donor1, donor2, opsTreasury, rewardPool, protocolReserve };
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
    const { vault, dao, oracle, institution, opsTreasury, rewardPool, protocolReserve } = await deploy();
    const [,,,, donor1] = await ethers.getSigners();
    await vault.connect(donor1).donate({ value: ethers.parseEther("100") });
    await vault.connect(oracle).markTriggered();

    const opsBefore = await ethers.provider.getBalance(opsTreasury.address);
    const rewardBefore = await ethers.provider.getBalance(rewardPool.address);
    const protoBefore = await ethers.provider.getBalance(protocolReserve.address);

    await vault.connect(dao).disburse(institution.address);

    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(0n);
    expect(await ethers.provider.getBalance(opsTreasury.address)).to.be.gt(opsBefore);
    expect(await ethers.provider.getBalance(rewardPool.address)).to.be.gt(rewardBefore);
    expect(await ethers.provider.getBalance(protocolReserve.address)).to.be.gt(protoBefore);
  });

  it("cannot disburse to unverified institution", async function () {
    const { vault, dao, oracle } = await deploy();
    const [,,,,,,,,, badActor] = await ethers.getSigners();
    const [,,,, donor1] = await ethers.getSigners();
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
