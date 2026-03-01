import { expect } from "chai";
import { ethers } from "hardhat";

describe("InstitutionRegistry", function () {
  async function deploy() {
    const [admin, signer2, signer3, institution, random] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("InstitutionRegistry");
    const registry = await Registry.deploy([admin.address, signer2.address, signer3.address], 2);
    return { registry, admin, signer2, signer3, institution, random };
  }

  it("admin can add verified institution", async function () {
    const { registry, admin, institution } = await deploy();
    await registry.connect(admin).addInstitution(institution.address, "Red Cross", "ipfs://cid123");
    expect(await registry.isVerified(institution.address)).to.be.true;
  });

  it("non-admin cannot add institution", async function () {
    const { registry, random, institution } = await deploy();
    await expect(registry.connect(random).addInstitution(institution.address, "Scam", "ipfs://x"))
      .to.be.revertedWith("InstitutionRegistry: not admin");
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
