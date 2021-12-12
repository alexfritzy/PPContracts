const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

describe("Pirates Contract", function () {
  let Pirates;
  let pirates;
  let Keys;
  let keys;
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
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await pirates.owner()).to.equal(owner.address);
    });

    it("Should set all sale states default false", async function () {
      expect(await pirates.isKeyMintActive()).to.equal(false);
      expect(await pirates.isAllowListActive()).to.equal(false);
      expect(await pirates.isPublicSaleActive()).to.equal(false);
    });

    it("Should set price to 0.06 Ethers", async function () {
      expect(await pirates.PRICE_PER_TOKEN()).to.equal("60000000000000000");
    });
  })

  describe("Minting", function () {
    //Reserve
    describe("Reserve", function () {
      it("Should reserve 17 pirates", async function () {
        await pirates.reserve();
        expect(await pirates.totalSupply()).to.equal(17);
        expect(await pirates.balanceOf(owner.address)).to.equal(17);
      });

      it("Should fail if called more than once", async function () {
        await pirates.reserve();
        await expect(pirates.reserve()).to.be.reverted;
      });
  
      it("Should fail if called by non-owner", async function () {
        await expect(pirates.connect(addr1).reserve()).to.be.reverted;
      })
    })

    //Keymint
    describe("Key Minting", function () {
      it("Should fail if key minting is not active", async function () {
        Keys = await ethers.getContractFactory("Keys");
        keys = await Keys.deploy();
        await pirates.setKeys(keys.address);
        //Mint key
        await keys.setPublicSaleState(true);
        let overrides = { value: ethers.utils.parseEther("0.01337") };
        await keys.connect(addr1).mintNFT(1, overrides);

        //Try key mint
        await expect(pirates.connect(addr1).mintWithKey([0])).to.be.reverted;
      });

      it("Should fail minting over total supply cap (500 for testing)", async function () {
        Keys = await ethers.getContractFactory("Keys");
        keys = await Keys.deploy();
        await pirates.setKeys(keys.address);
        //Mint key
        await keys.setPublicSaleState(true);
        let overrides = { value: ethers.utils.parseEther("0.01337") };
        await keys.connect(addr1).mintNFT(1, overrides); 

        //Mint to 10,000
        await pirates.setKeyMintActive(true);
        await pirates.setPublicSaleState(true);
        overrides.value = ethers.utils.parseEther("0.3");
        for (let i = 0; i < 100 ; i ++) {
          await pirates.connect(addr1).mintNFT(5, overrides);
        }

        //Try to key mint
        await expect(pirates.connect(addr1).mintWithKey([0])).to.be.reverted;
        expect(await pirates.totalSupply()).to.equal(500);
      })

      it("Should fail minting with someone else's/unminted key", async function () {
        Keys = await ethers.getContractFactory("Keys");
        keys = await Keys.deploy();
        await pirates.setKeys(keys.address);
        //Mint keys
        await keys.setPublicSaleState(true);
        let overrides = { value: ethers.utils.parseEther("0.01337") };
        await keys.connect(addr1).mintNFT(1, overrides); 
        await keys.connect(addr2).mintNFT(1, overrides);

        await pirates.setKeyMintActive(true);

        await expect(pirates.connect(addr1).mintWithKey([2])).to.be.reverted;
        await expect(pirates.connect(addr2).mintWithKey([0])).to.be.reverted;
      })

      it("Should fail minting with same key twice", async function () {
        Keys = await ethers.getContractFactory("Keys");
        keys = await Keys.deploy();
        await pirates.setKeys(keys.address);
        //Mint key
        await keys.setPublicSaleState(true);
        let overrides = { value: ethers.utils.parseEther("0.01337") };
        await keys.connect(addr1).mintNFT(1, overrides); 

        await pirates.setKeyMintActive(true);

        await expect(pirates.connect(addr1).mintWithKey([0, 0])).to.be.reverted;
        await pirates.connect(addr1).mintWithKey([0]);
        await expect(pirates.connect(addr1).mintWithKey([0])).to.be.reverted;

        await keys.connect(addr1).transferFrom(addr1.address, addr2.address, 0);
        expect(await keys.ownerOf(0)).to.equal(addr2.address);
        await expect(pirates.connect(addr2).mintWithKey([0])).to.be.reverted;
      })

      it("Should mint correctly", async function () {
        Keys = await ethers.getContractFactory("Keys");
        keys = await Keys.deploy();
        await pirates.setKeys(keys.address);
        //Mint keys
        await keys.setPublicSaleState(true);
        let overrides = { value: ethers.utils.parseEther("0.01337") };
        await keys.connect(addr1).mintNFT(1, overrides); 
        await keys.connect(addr2).mintNFT(1, overrides);
        await keys.connect(addr2).mintNFT(1, overrides);

        await pirates.setKeyMintActive(true);

        await pirates.connect(addr1).mintWithKey([0]);
        expect(await pirates.ownerOf(0)).to.equal(addr1.address);
        expect(await pirates.totalSupply()).to.equal(1);

        await pirates.connect(addr2).mintWithKey([1, 2]);
        expect(await pirates.balanceOf(addr2.address)).to.equal(2);
        expect(await pirates.totalSupply()).to.equal(3);
      })
    })

    //AllowList
    describe("Allowlist Minting", function () {
      it("Should fail if allowlist sale is not active", async function () {
        await pirates.setAllowList([addr1.address], 1);
        let overrides = { value: ethers.utils.parseEther("0.06") };

        await expect(pirates.connect(addr1).mintAllowList(1, overrides)).to.be.reverted;
      });

      it("Should fail minting over total supply cap (500 for testing)", async function () {
        await pirates.setIsAllowListActive(true);
        let overrides = { value: ethers.utils.parseEther("0.3") };

        for (let i = 0; i < 100 ; i ++) {
          await pirates.setAllowList([addr1.address], 5);
          await pirates.connect(addr1).mintAllowList(5, overrides);
        }

        overrides.value = ethers.utils.parseEther("0.06")
        await pirates.setAllowList([addr1.address], 1);
        await expect(pirates.connect(addr1).mintAllowList(1, overrides)).to.be.reverted;
        expect(await pirates.totalSupply()).to.equal(500);
      })

      it("Should fail minting over allowed mints", async function () {
        await pirates.setIsAllowListActive(true);
        await pirates.setAllowList([addr2.address], 1);
        let overrides = { value: ethers.utils.parseEther("0.12") };

        await expect(pirates.connect(addr1).mintAllowList(1, overrides)).to.be.reverted;

        await expect(pirates.connect(addr2).mintAllowList(2, overrides)).to.be.reverted;
        await pirates.connect(addr2).mintAllowList(1, overrides);
        await expect(pirates.connect(addr2).mintAllowList(1, overrides)).to.be.reverted;
      })

      it("Should fail if ether value too low (0.06)", async function () {
        await pirates.setIsAllowListActive(true);
        await pirates.setAllowList([addr1.address], 1);
        let overrides = { value: ethers.utils.parseEther("0.05999") };

        await expect(pirates.connect(addr1).mintAllowList(1, overrides)).to.be.reverted;
      })

      it("Should mint correctly", async function () {
        await pirates.setIsAllowListActive(true);
        await pirates.setAllowList([addr1.address], 1);
        await pirates.setAllowList([addr2.address], 2);
        let overrides = { value: ethers.utils.parseEther("0.06") };

        await pirates.connect(addr1).mintAllowList(1, overrides);
        expect(await pirates.ownerOf(0)).to.equal(addr1.address);
        expect(await pirates.totalSupply()).to.equal(1);

        overrides.value = ethers.utils.parseEther("0.12")
        await pirates.connect(addr2).mintAllowList(2, overrides);
        expect(await pirates.balanceOf(addr2.address)).to.equal(2);
        expect(await pirates.totalSupply()).to.equal(3);
      })
    })

    //Public
    describe("Public Minting", function () {
      it("Should fail if public sale is not active", async function () {
        let overrides = { value: ethers.utils.parseEther("0.06") };

        await expect(pirates.connect(addr1).mintNFT(1, overrides)).to.be.reverted;
      });

      it("Should fail minting over total supply cap (500 for testing)", async function () {
        await pirates.setPublicSaleState(true);
        let overrides = { value: ethers.utils.parseEther("0.3") };

        for (let i = 0; i < 100 ; i ++) {
          await pirates.connect(addr1).mintNFT(5, overrides);
        }

        await expect(pirates.connect(addr1).mintNFT(5, overrides)).to.be.reverted;
        expect(await pirates.totalSupply()).to.equal(500);
      })

      it("Should fail minting over transaction cap (5)", async function () {
        await pirates.setPublicSaleState(true);
        let overrides = { value: ethers.utils.parseEther("0.36") };

        await expect(pirates.connect(addr1).mintNFT(6, overrides)).to.be.reverted;
      })

      it("Should fail if ether value too low (0.06)", async function () {
        await pirates.setPublicSaleState(true);
        let overrides = { value: ethers.utils.parseEther("0.05999") };

        await expect(pirates.connect(addr1).mintNFT(1, overrides)).to.be.reverted;
      })

      it("Should mint correctly", async function () {
        //Setup
        await pirates.setPublicSaleState(true);
        let overrides = { value: ethers.utils.parseEther("0.06") };

        //Mint 1
        await pirates.connect(addr1).mintNFT(1, overrides);
        expect(await pirates.ownerOf(0)).to.equal(addr1.address);
        expect(await pirates.totalSupply()).to.equal(1);

        //Mint 2
        overrides.value = ethers.utils.parseEther("0.12")
        await pirates.connect(addr2).mintNFT(2, overrides);
        expect(await pirates.balanceOf(addr2.address)).to.equal(2);
        expect(await pirates.totalSupply()).to.equal(3);
      })
    })
  })

  describe("Utility", function () {
    it("Withdraw should withdraw all funds to owner", async function () {
      //Mint 1
      await pirates.setPublicSaleState(true);
      let overrides = { value: ethers.utils.parseEther("0.06") };
      await pirates.connect(addr1).mintNFT(1, overrides);

      //Withdraw
      await expect(await pirates.withdraw()).to.changeEtherBalance(owner, ethers.utils.parseEther("0.06"));
    })

    it("WalletOfOwner should return correct owner's wallet", async function () {
      //Mint 1 to Wallet 1
      await pirates.setPublicSaleState(true);
      let overrides = { value: ethers.utils.parseEther("0.06") };
      await pirates.connect(addr1).mintNFT(1, overrides);

      //Mint 2 to Wallet 2
      overrides.value = ethers.utils.parseEther("0.12")
      await pirates.connect(addr2).mintNFT(2, overrides);

      //Mint 1 to Wallet 1
      overrides.value = ethers.utils.parseEther("0.06")
      await pirates.connect(addr1).mintNFT(1, overrides);

      //Check Wallet 1
      wallet1 = await pirates.walletOfOwner(addr1.address);
      assert.equal(wallet1[0], 0);
      assert.equal(wallet1[1], 3);
      assert.equal(wallet1.length, 2);

      //Check Wallet 2
      wallet2 = await pirates.walletOfOwner(addr2.address);
      assert.equal(wallet2[0], 1);
      assert.equal(wallet2[1], 2);      
      assert.equal(wallet2.length, 2);
    })

    it("Captain (1 for test) and First Mate (2 for tests) should mint/transfer correctly", async function() {
      //Mint 1 to Wallet 1
      await pirates.setPublicSaleState(true);
      let overrides = { value: ethers.utils.parseEther("0.06") };
      await pirates.connect(addr1).mintNFT(1, overrides);

      //Mint 2 to Wallet 2
      overrides.value = ethers.utils.parseEther("0.12")
      await pirates.connect(addr2).mintNFT(2, overrides);

      expect(await pirates.captainBalance(addr1.address)).to.equal(1);
      expect(await pirates.captainBalance(addr2.address)).to.equal(0);
      expect(await pirates.firstmateBalance(addr1.address)).to.equal(0);
      expect(await pirates.firstmateBalance(addr2.address)).to.equal(1);

      await pirates.connect(addr1).transferFrom(addr1.address, addr2.address, 0);
      await pirates.connect(addr2).transferFrom(addr2.address, addr1.address, 1);

      expect(await pirates.captainBalance(addr1.address)).to.equal(0);
      expect(await pirates.captainBalance(addr2.address)).to.equal(1);
      expect(await pirates.firstmateBalance(addr1.address)).to.equal(1);
      expect(await pirates.firstmateBalance(addr2.address)).to.equal(0);
    })
  })
});
