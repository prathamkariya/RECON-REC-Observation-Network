// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RECRegistry
 * @notice On-chain registry of Renewable Energy Certificates, one ERC-721 token
 *         per certified generation record.
 *
 * The registry enforces two rules the off-chain fraud pipeline cannot enforce
 * on its own:
 *
 *   1. Double-certification is impossible. A generation record is keyed by
 *      (plantId, energyMWh, generationTimestamp); minting a second certificate
 *      for a key that has already been used reverts. This is the on-chain
 *      backstop for the `duplicate_serial` fraud class.
 *
 *   2. Retirement is final. A retired certificate can never be transferred or
 *      retired again, so a claimed-and-consumed REC cannot be resold.
 *
 * The fraud score assigned at issuance is stored immutably alongside the
 * record, so an auditor can always see what the pipeline believed at mint time.
 */
contract RECRegistry is ERC721Enumerable, Ownable {
    struct Certificate {
        string plantId;
        uint256 energyMWh;
        uint256 generationTimestamp;
        uint256 fraudScore; // 0-100, as scored by the off-chain pipeline at issuance
        bool retired;
    }

    mapping(uint256 => Certificate) private _certificates;
    mapping(bytes32 => bool) private _usedRecords;
    mapping(bytes32 => uint256) private _recordTokenId;
    mapping(address => bool) public authorizedIssuers;

    uint256 public nextTokenId;

    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed to,
        string plantId,
        uint256 energyMWh,
        uint256 generationTimestamp,
        uint256 fraudScore
    );
    event CertificateRetired(uint256 indexed tokenId, address indexed owner);
    event IssuerAuthorized(address indexed issuer);
    event IssuerRevoked(address indexed issuer);

    error NotAuthorizedIssuer(address caller);
    error RecordAlreadyCertified(string plantId, uint256 energyMWh, uint256 generationTimestamp);
    error CertificateDoesNotExist(uint256 tokenId);
    error CertificateAlreadyRetired(uint256 tokenId);
    error NotCertificateOwner(uint256 tokenId, address caller);
    error FraudScoreOutOfRange(uint256 fraudScore);

    modifier onlyIssuer() {
        if (!authorizedIssuers[msg.sender]) revert NotAuthorizedIssuer(msg.sender);
        _;
    }

    constructor(address initialOwner) ERC721("REC Observation Network Certificate", "RECON") Ownable(initialOwner) {
        authorizedIssuers[initialOwner] = true;
        emit IssuerAuthorized(initialOwner);
    }

    // --- issuer administration -------------------------------------------

    function authorizeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = true;
        emit IssuerAuthorized(issuer);
    }

    function revokeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
        emit IssuerRevoked(issuer);
    }

    // --- record keying -----------------------------------------------------

    function recordKey(string memory plantId, uint256 energyMWh, uint256 generationTimestamp)
        public
        pure
        returns (bytes32)
    {
        // abi.encode (not encodePacked) so a plantId containing the boundary of
        // the next field can't be crafted to collide with a different record.
        return keccak256(abi.encode(plantId, energyMWh, generationTimestamp));
    }

    function isRecordUsed(string memory plantId, uint256 energyMWh, uint256 generationTimestamp)
        external
        view
        returns (bool)
    {
        return _usedRecords[recordKey(plantId, energyMWh, generationTimestamp)];
    }

    /// @notice tokenId that already certified this generation record. Reverts if unused.
    function tokenIdForRecord(string memory plantId, uint256 energyMWh, uint256 generationTimestamp)
        external
        view
        returns (uint256)
    {
        bytes32 key = recordKey(plantId, energyMWh, generationTimestamp);
        if (!_usedRecords[key]) revert RecordAlreadyCertified(plantId, energyMWh, generationTimestamp);
        return _recordTokenId[key];
    }

    // --- issuance ----------------------------------------------------------

    function issueCertificate(
        address to,
        string memory plantId,
        uint256 energyMWh,
        uint256 generationTimestamp,
        uint256 fraudScore
    ) external onlyIssuer returns (uint256 tokenId) {
        if (fraudScore > 100) revert FraudScoreOutOfRange(fraudScore);

        bytes32 key = recordKey(plantId, energyMWh, generationTimestamp);
        if (_usedRecords[key]) revert RecordAlreadyCertified(plantId, energyMWh, generationTimestamp);
        _usedRecords[key] = true;

        tokenId = nextTokenId++;
        _recordTokenId[key] = tokenId;
        _certificates[tokenId] = Certificate(plantId, energyMWh, generationTimestamp, fraudScore, false);

        _safeMint(to, tokenId);
        emit CertificateIssued(tokenId, to, plantId, energyMWh, generationTimestamp, fraudScore);
    }

    // --- retirement --------------------------------------------------------

    function retireCertificate(uint256 tokenId) external {
        address owner = _requireCertificate(tokenId);
        if (owner != msg.sender) revert NotCertificateOwner(tokenId, msg.sender);
        if (_certificates[tokenId].retired) revert CertificateAlreadyRetired(tokenId);

        _certificates[tokenId].retired = true;
        emit CertificateRetired(tokenId, owner);
    }

    // --- reads -------------------------------------------------------------

    function getCertificate(uint256 tokenId) external view returns (Certificate memory) {
        _requireCertificate(tokenId);
        return _certificates[tokenId];
    }

    function isRetired(uint256 tokenId) external view returns (bool) {
        _requireCertificate(tokenId);
        return _certificates[tokenId].retired;
    }

    function _requireCertificate(uint256 tokenId) internal view returns (address owner) {
        owner = _ownerOf(tokenId);
        if (owner == address(0)) revert CertificateDoesNotExist(tokenId);
    }

    // --- transfer guard ----------------------------------------------------

    /// @dev A retired certificate has been consumed against a claim; letting it
    ///      move again would let the same MWh be resold. Mints (from == 0) and
    ///      burns are unaffected.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721Enumerable)
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && _certificates[tokenId].retired) {
            revert CertificateAlreadyRetired(tokenId);
        }
        return super._update(to, tokenId, auth);
    }
}
