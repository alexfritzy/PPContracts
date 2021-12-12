const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
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
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await booty.owner()).to.equal(owner.address);
    });
  })

  describe("Utility", function () {
    it("Should transfer correctly", async function () {
        const delay = millis => new Promise((resolve, reject) => {
            setTimeout(_ => resolve(), millis)
        });
    })
  })
});
