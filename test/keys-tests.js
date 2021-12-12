const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

describe("Keys Contract", function () {
  let Keys;
  let keys;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    Keys = await ethers.getContractFactory("Keys");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    keys = await Keys.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await keys.owner()).to.equal(owner.address);
    });

    it("Should set all sale states default false", async function () {
      expect(await keys.isFreeListActive()).to.equal(false);
      expect(await keys.isAllowListActive()).to.equal(false);
      expect(await keys.isPublicSaleActive()).to.equal(false);
    });

    it("Should set price to 0.01337 Ethers", async function () {
      expect(await keys.PRICE_PER_TOKEN()).to.equal("13370000000000000");
    });
  })

  describe("Minting", function () {
    //Reserve
    describe("Reserve", function () {
      it("Should reserve 12 keys", async function () {
        await keys.reserve();
        expect(await keys.totalSupply()).to.equal(12);
        expect(await keys.balanceOf(owner.address)).to.equal(12);
      });

      it("Should fail if called more than once", async function () {
        await keys.reserve();
        await expect(keys.reserve()).to.be.reverted;
      });
  
      it("Should fail if called by non-owner", async function () {
        await expect(keys.connect(addr1).reserve()).to.be.reverted;
      })
    })

    //FreeList
    describe("Freelist Minting", function () {
      it("Should fail if freelist sale is not active", async function () {
        await keys.setFreeList([addr1.address], 1);

        await expect(keys.connect(addr1).mintFreeList(1)).to.be.reverted;
      });

      it("Should fail minting over total supply cap (500)", async function () {
        await keys.setIsFreeListActive(true);

        for (let i = 0; i < 100 ; i ++) {
          await keys.setFreeList([addr1.address], 5);
          await keys.connect(addr1).mintFreeList(5);
        }

        await keys.setFreeList([addr1.address], 1);
        await expect(keys.connect(addr1).mintFreeList(1)).to.be.reverted;
        expect(await keys.totalSupply()).to.equal(500);
      })

      it("Should fail minting over free mints", async function () {
        await keys.setIsFreeListActive(true);
        await keys.setFreeList([addr2.address], 1);

        await expect(keys.connect(addr1).mintFreeList(1)).to.be.reverted;

        await expect(keys.connect(addr2).mintFreeList(2)).to.be.reverted;
        await keys.connect(addr2).mintFreeList(1);
        await expect(keys.connect(addr2).mintFreeList(1)).to.be.reverted;
      })

      it("Should mint correctly", async function () {
        await keys.setIsFreeListActive(true);
        await keys.setFreeList([addr1.address], 1);
        await keys.setFreeList([addr2.address], 2);

        await keys.connect(addr1).mintFreeList(1);
        expect(await keys.ownerOf(0)).to.equal(addr1.address);
        expect(await keys.totalSupply()).to.equal(1);

        await keys.connect(addr2).mintFreeList(2);
        expect(await keys.balanceOf(addr2.address)).to.equal(2);
        expect(await keys.totalSupply()).to.equal(3);
      })
    })

    //AllowList
    describe("Allowlist Minting", function () {
      it("Should fail if allowlist sale is not active", async function () {
        await keys.setAllowList([addr1.address], 1);
        let overrides = { value: ethers.utils.parseEther("0.01337") };

        await expect(keys.connect(addr1).mintAllowList(1, overrides)).to.be.reverted;
      });

      it("Should fail minting over total supply cap (500)", async function () {
        await keys.setIsAllowListActive(true);
        let overrides = { value: ethers.utils.parseEther("0.06685") };

        for (let i = 0; i < 100 ; i ++) {
          await keys.setAllowList([addr1.address], 5);
          await keys.connect(addr1).mintAllowList(5, overrides);
        }

        overrides.value = ethers.utils.parseEther("0.01337")
        await keys.setAllowList([addr1.address], 1);
        await expect(keys.connect(addr1).mintAllowList(1, overrides)).to.be.reverted;
        expect(await keys.totalSupply()).to.equal(500);
      })

      it("Should fail minting over allowed mints", async function () {
        await keys.setIsAllowListActive(true);
        await keys.setAllowList([addr2.address], 1);
        let overrides = { value: ethers.utils.parseEther("0.02674") };

        await expect(keys.connect(addr1).mintAllowList(1, overrides)).to.be.reverted;

        await expect(keys.connect(addr2).mintAllowList(2, overrides)).to.be.reverted;
        await keys.connect(addr2).mintAllowList(1, overrides);
        await expect(keys.connect(addr2).mintAllowList(1, overrides)).to.be.reverted;
      })

      it("Should fail if ether value too low (0.01337)", async function () {
        await keys.setIsAllowListActive(true);
        await keys.setAllowList([addr1.address], 1);
        let overrides = { value: ethers.utils.parseEther("0.01336") };

        await expect(keys.connect(addr1).mintAllowList(1, overrides)).to.be.reverted;
      })

      it("Should mint correctly", async function () {
        await keys.setIsAllowListActive(true);
        await keys.setAllowList([addr1.address], 1);
        await keys.setAllowList([addr2.address], 2);
        let overrides = { value: ethers.utils.parseEther("0.01337") };

        await keys.connect(addr1).mintAllowList(1, overrides);
        expect(await keys.ownerOf(0)).to.equal(addr1.address);
        expect(await keys.totalSupply()).to.equal(1);

        overrides.value = ethers.utils.parseEther("0.02674")
        await keys.connect(addr2).mintAllowList(2, overrides);
        expect(await keys.balanceOf(addr2.address)).to.equal(2);
        expect(await keys.totalSupply()).to.equal(3);
      })
    })

    //Public
    describe("Public Minting", function () {
      it("Should fail if public sale is not active", async function () {
        let overrides = { value: ethers.utils.parseEther("0.01337") };

        await expect(keys.connect(addr1).mintNFT(1, overrides)).to.be.reverted;
      });

      it("Should fail minting over total supply cap (500)", async function () {
        await keys.setPublicSaleState(true);
        let overrides = { value: ethers.utils.parseEther("0.06685") };

        for (let i = 0; i < 100 ; i ++) {
          await keys.connect(addr1).mintNFT(5, overrides);
        }

        await expect(keys.connect(addr1).mintNFT(5, overrides)).to.be.reverted;
        expect(await keys.totalSupply()).to.equal(500);
      })

      it("Should fail minting over transaction cap (5)", async function () {
        await keys.setPublicSaleState(true);
        let overrides = { value: ethers.utils.parseEther("0.08022") };

        await expect(keys.connect(addr1).mintNFT(6, overrides)).to.be.reverted;
      })

      it("Should fail if ether value too low (0.01337)", async function () {
        await keys.setPublicSaleState(true);
        let overrides = { value: ethers.utils.parseEther("0.01336") };

        await expect(keys.connect(addr1).mintNFT(1, overrides)).to.be.reverted;
      })

      it("Should mint correctly", async function () {
        //Setup
        await keys.setPublicSaleState(true);
        let overrides = { value: ethers.utils.parseEther("0.01337") };

        //Mint 1
        await keys.connect(addr1).mintNFT(1, overrides);
        expect(await keys.ownerOf(0)).to.equal(addr1.address);
        expect(await keys.totalSupply()).to.equal(1);

        //Mint 2
        overrides.value = ethers.utils.parseEther("0.02674")
        await keys.connect(addr2).mintNFT(2, overrides);
        expect(await keys.balanceOf(addr2.address)).to.equal(2);
        expect(await keys.totalSupply()).to.equal(3);
      })
    })
  })

  describe("Utility", function () {
    it("Withdraw should withdraw all funds to owner", async function () {
      //Mint 1
      await keys.setPublicSaleState(true);
      let overrides = { value: ethers.utils.parseEther("0.01337") };
      await keys.connect(addr1).mintNFT(1, overrides);

      //Withdraw
      await expect(await keys.withdraw()).to.changeEtherBalance(owner, ethers.utils.parseEther("0.01337"));
    })

    it("WalletOfOwner should return correct owner's wallet", async function () {
      //Mint 1 to Wallet 1
      await keys.setPublicSaleState(true);
      let overrides = { value: ethers.utils.parseEther("0.01337") };
      await keys.connect(addr1).mintNFT(1, overrides);

      //Mint 2 to Wallet 2
      overrides.value = ethers.utils.parseEther("0.02674")
      await keys.connect(addr2).mintNFT(2, overrides);

      //Mint 1 to Wallet 1
      overrides.value = ethers.utils.parseEther("0.01337")
      await keys.connect(addr1).mintNFT(1, overrides);

      //Check Wallet 1
      wallet1 = await keys.walletOfOwner(addr1.address);
      assert.equal(wallet1[0], 0);
      assert.equal(wallet1[1], 3);
      assert.equal(wallet1.length, 2);

      //Check Wallet 2
      wallet2 = await keys.walletOfOwner(addr2.address);
      assert.equal(wallet2[0], 1);
      assert.equal(wallet2[1], 2);      
      assert.equal(wallet2.length, 2);
    })
  })
});
