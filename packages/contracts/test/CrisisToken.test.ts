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
