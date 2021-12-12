const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");
const { BigNumber } = require("ethers");

describe("Booty Contract", function () {
  let Pirates;
  let pirates;
  let Booty;
  let booty;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    Pirates = await ethers.getContractFactory("Pirates");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    pirates = await Pirates.deploy();
    Booty = await ethers.getContractFactory("Booty");
    booty = await Booty.deploy();
    await pirates.setBooty(booty.address);
    await booty.setPirates(pirates.address);
    await booty.setAllowedAddresses(owner.address, true);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await booty.owner()).to.equal(owner.address);
    });

    describe("Pausing", function () {
      it("Transfers should be off by default", async function () {
        await booty.mint(addr1.address, 10);
        await expect(booty.connect(addr1).transfer(addr2.address, 10)).to.be.reverted;
      })
  
      it("Transfers should be flipable", async function () {
        await booty.mint(addr1.address, 10);
        await booty.toggleTransfers();
        await booty.connect(addr1).transfer(addr2.address, 10);
        expect(await booty.balanceOf(addr1.address)).to.equal(0);
        expect(await booty.balanceOf(addr2.address)).to.equal(10);
  
        await booty.toggleTransfers();
        await expect(booty.connect(addr2).transfer(addr1.address, 10)).to.be.reverted;
      })
  
      it("Rewards should be on by default", async function () {
        //Mint 1 to Wallet 1
        await pirates.setPublicSaleState(true);
        let overrides = { value: ethers.utils.parseEther("0.06") };
        await pirates.connect(addr1).mintNFT(1, overrides);
      })
    })
  })

  describe("Mint/Burn", function () {
    it("Only allowed can mint/burn", async function () {
      await booty.mint(addr1.address, 10);
      expect(await booty.balanceOf(addr1.address)).to.equal(10);
      await booty.burn(addr1.address, 10);
      expect(await booty.balanceOf(addr1.address)).to.equal(0);
      await expect(booty.connect(addr1).mint(addr1.address, 10)).to.be.reverted;
      await expect(booty.connect(addr1).burn(addr1.address, 10)).to.be.reverted;
    })
  })

  describe("Utility", function () {
    it("getTotalClaimable should return correct value", async function () {
      //Mint 3 (one of each, 4.5x value) to Wallet 1
      await pirates.setPublicSaleState(true);
      let overrides = { value: ethers.utils.parseEther("0.18") };
      await pirates.connect(addr1).mintNFT(3, overrides);
      expect(await booty.getTotalClaimable(addr1.address)).to.equal(ethers.utils.parseUnits("0", "wei"));

      await network.provider.send("evm_increaseTime", [15]);
      await network.provider.send("evm_mine");

      //15 seconds
      expect(await booty.getTotalClaimable(addr1.address)).to.equal(ethers.utils.parseUnits("7812499999999999", "wei"));

      //Transfer captain
      await pirates.connect(addr1).transferFrom(addr1.address, addr2.address, 0);

      await network.provider.send("evm_increaseTime", [4]);
      await network.provider.send("evm_mine");

      //Another 5
      expect(await booty.getTotalClaimable(addr1.address)).to.equal(ethers.utils.parseUnits("9490740740740737", "wei"));
      expect(await booty.getTotalClaimable(addr2.address)).to.equal(ethers.utils.parseUnits("925925925925925", "wei"));
    })
  })
});
