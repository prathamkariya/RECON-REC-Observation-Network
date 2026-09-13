const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const PLANT = "PLANT-001";
const ENERGY = 250;
const TIMESTAMP = 1758000000;
const SCORE = 12;

describe("RECRegistry", function () {
  async function deployFixture() {
    const [owner, issuer, buyer, stranger] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("RECRegistry");
    const registry = await factory.deploy(owner.address);
    await registry.waitForDeployment();
    return { registry, owner, issuer, buyer, stranger };
  }

  describe("deployment", function () {
    it("names the token and auto-authorizes the deployer", async function () {
      const { registry, owner } = await loadFixture(deployFixture);
      expect(await registry.name()).to.equal("REC Observation Network Certificate");
      expect(await registry.symbol()).to.equal("RECON");
      expect(await registry.authorizedIssuers(owner.address)).to.equal(true);
      expect(await registry.nextTokenId()).to.equal(0);
    });

    it("supports the ERC-721 and ERC-721Enumerable interfaces", async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.supportsInterface("0x80ac58cd")).to.equal(true); // ERC721
      expect(await registry.supportsInterface("0x780e9d63")).to.equal(true); // ERC721Enumerable
    });
  });

  describe("issuance", function () {
    it("mints a certificate and stores the record", async function () {
      const { registry, owner, buyer } = await loadFixture(deployFixture);
      await expect(registry.issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP, SCORE))
        .to.emit(registry, "CertificateIssued")
        .withArgs(0, buyer.address, PLANT, ENERGY, TIMESTAMP, SCORE)
        .and.to.emit(registry, "Transfer")
        .withArgs(ethers.ZeroAddress, buyer.address, 0);

      const cert = await registry.getCertificate(0);
      expect(cert.plantId).to.equal(PLANT);
      expect(cert.energyMWh).to.equal(ENERGY);
      expect(cert.generationTimestamp).to.equal(TIMESTAMP);
      expect(cert.fraudScore).to.equal(SCORE);
      expect(cert.retired).to.equal(false);
      expect(await registry.ownerOf(0)).to.equal(buyer.address);
      expect(await registry.balanceOf(buyer.address)).to.equal(1);
      void owner;
    });

    it("rejects a second certificate for the same generation record", async function () {
      const { registry, buyer } = await loadFixture(deployFixture);
      await registry.issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP, SCORE);
      await expect(registry.issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP, SCORE))
        .to.be.revertedWithCustomError(registry, "RecordAlreadyCertified")
        .withArgs(PLANT, ENERGY, TIMESTAMP);
    });

    it("allows a different record for the same plant", async function () {
      const { registry, buyer } = await loadFixture(deployFixture);
      await registry.issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP, SCORE);
      await registry.issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP + 3600, SCORE);
      expect(await registry.nextTokenId()).to.equal(2);
    });

    it("keys records unambiguously across plantId boundaries", async function () {
      // abi.encode, not encodePacked: "A" + 1 must not collide with "A1" + "".
      const { registry, buyer } = await loadFixture(deployFixture);
      const a = await registry.recordKey("PLANT-1", 11, TIMESTAMP);
      const b = await registry.recordKey("PLANT-11", 1, TIMESTAMP);
      expect(a).to.not.equal(b);
      void buyer;
    });

    it("rejects an unauthorized issuer", async function () {
      const { registry, stranger, buyer } = await loadFixture(deployFixture);
      await expect(
        registry.connect(stranger).issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP, SCORE)
      ).to.be.revertedWithCustomError(registry, "NotAuthorizedIssuer").withArgs(stranger.address);
    });

    it("rejects a fraud score above 100", async function () {
      const { registry, buyer } = await loadFixture(deployFixture);
      await expect(registry.issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP, 101))
        .to.be.revertedWithCustomError(registry, "FraudScoreOutOfRange").withArgs(101);
    });

    it("reports record usage and resolves the token id", async function () {
      const { registry, buyer } = await loadFixture(deployFixture);
      expect(await registry.isRecordUsed(PLANT, ENERGY, TIMESTAMP)).to.equal(false);
      await registry.issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP, SCORE);
      expect(await registry.isRecordUsed(PLANT, ENERGY, TIMESTAMP)).to.equal(true);
      expect(await registry.tokenIdForRecord(PLANT, ENERGY, TIMESTAMP)).to.equal(0);
    });
  });

  describe("issuer administration", function () {
    it("lets the owner authorize and revoke issuers", async function () {
      const { registry, issuer, buyer } = await loadFixture(deployFixture);
      await expect(registry.authorizeIssuer(issuer.address))
        .to.emit(registry, "IssuerAuthorized").withArgs(issuer.address);
      await registry.connect(issuer).issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP, SCORE);

      await expect(registry.revokeIssuer(issuer.address))
        .to.emit(registry, "IssuerRevoked").withArgs(issuer.address);
      await expect(
        registry.connect(issuer).issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP + 1, SCORE)
      ).to.be.revertedWithCustomError(registry, "NotAuthorizedIssuer");
    });

    it("refuses issuer administration from a non-owner", async function () {
      const { registry, stranger } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).authorizeIssuer(stranger.address))
        .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("retirement", function () {
    it("lets the owner retire, once", async function () {
      const { registry, buyer } = await loadFixture(deployFixture);
      await registry.issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP, SCORE);

      await expect(registry.connect(buyer).retireCertificate(0))
        .to.emit(registry, "CertificateRetired").withArgs(0, buyer.address);
      expect(await registry.isRetired(0)).to.equal(true);

      await expect(registry.connect(buyer).retireCertificate(0))
        .to.be.revertedWithCustomError(registry, "CertificateAlreadyRetired").withArgs(0);
    });

    it("refuses retirement by anyone but the current owner", async function () {
      const { registry, buyer, stranger } = await loadFixture(deployFixture);
      await registry.issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP, SCORE);
      await expect(registry.connect(stranger).retireCertificate(0))
        .to.be.revertedWithCustomError(registry, "NotCertificateOwner").withArgs(0, stranger.address);
    });

    it("reverts on an unknown token", async function () {
      const { registry, buyer } = await loadFixture(deployFixture);
      await expect(registry.connect(buyer).retireCertificate(99))
        .to.be.revertedWithCustomError(registry, "CertificateDoesNotExist").withArgs(99);
      await expect(registry.getCertificate(99))
        .to.be.revertedWithCustomError(registry, "CertificateDoesNotExist").withArgs(99);
    });
  });

  describe("transfer", function () {
    it("transfers an active certificate and moves retirement rights with it", async function () {
      const { registry, buyer, stranger } = await loadFixture(deployFixture);
      await registry.issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP, SCORE);

      await registry.connect(buyer).transferFrom(buyer.address, stranger.address, 0);
      expect(await registry.ownerOf(0)).to.equal(stranger.address);

      // the old owner can no longer retire it; the new one can
      await expect(registry.connect(buyer).retireCertificate(0))
        .to.be.revertedWithCustomError(registry, "NotCertificateOwner");
      await expect(registry.connect(stranger).retireCertificate(0)).to.emit(registry, "CertificateRetired");
    });

    it("blocks transfer of a retired certificate", async function () {
      const { registry, buyer, stranger } = await loadFixture(deployFixture);
      await registry.issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP, SCORE);
      await registry.connect(buyer).retireCertificate(0);

      await expect(registry.connect(buyer).transferFrom(buyer.address, stranger.address, 0))
        .to.be.revertedWithCustomError(registry, "CertificateAlreadyRetired").withArgs(0);
    });

    it("keeps enumeration consistent after transfers", async function () {
      const { registry, buyer, stranger } = await loadFixture(deployFixture);
      await registry.issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP, SCORE);
      await registry.issueCertificate(buyer.address, PLANT, ENERGY, TIMESTAMP + 1, SCORE);
      await registry.connect(buyer).transferFrom(buyer.address, stranger.address, 0);

      expect(await registry.totalSupply()).to.equal(2);
      expect(await registry.balanceOf(buyer.address)).to.equal(1);
      expect(await registry.tokenOfOwnerByIndex(stranger.address, 0)).to.equal(0);
    });
  });
});
