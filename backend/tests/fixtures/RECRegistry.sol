// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Test-only implementation matching the documented RECRegistry.sol interface,
// used to exercise backend/app/clients/web3_client.py against a real EVM
// (compiled + deployed to an in-process test chain) instead of mocks.
contract RECRegistry {
    struct Certificate {
        string plantId;
        uint256 energyMWh;
        uint256 generationTimestamp;
        uint256 fraudScore;
        bool retired;
    }

    mapping(uint256 => Certificate) private _certificates;
    mapping(uint256 => address) private _owners;
    mapping(bytes32 => bool) private _usedRecords;
    mapping(address => bool) public authorizedIssuers;

    uint256 public nextTokenId;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed to,
        string plantId,
        uint256 energyMWh,
        uint256 generationTimestamp,
        uint256 fraudScore
    );
    event CertificateRetired(uint256 indexed tokenId, address indexed owner);

    modifier onlyIssuer() {
        require(authorizedIssuers[msg.sender], "Not an authorized issuer");
        _;
    }

    constructor() {
        authorizedIssuers[msg.sender] = true;
    }

    function _recordKey(string memory plantId, uint256 energyMWh, uint256 generationTimestamp)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(plantId, energyMWh, generationTimestamp));
    }

    function issueCertificate(
        address to,
        string memory plantId,
        uint256 energyMWh,
        uint256 generationTimestamp,
        uint256 fraudScore
    ) external onlyIssuer returns (uint256 tokenId) {
        bytes32 key = _recordKey(plantId, energyMWh, generationTimestamp);
        require(!_usedRecords[key], "Record already certified");
        _usedRecords[key] = true;

        tokenId = nextTokenId++;
        _certificates[tokenId] = Certificate(plantId, energyMWh, generationTimestamp, fraudScore, false);
        _owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
        emit CertificateIssued(tokenId, to, plantId, energyMWh, generationTimestamp, fraudScore);
    }

    function retireCertificate(uint256 tokenId) external {
        require(_owners[tokenId] == msg.sender, "Not the token owner");
        require(!_certificates[tokenId].retired, "Already retired");
        _certificates[tokenId].retired = true;
        emit CertificateRetired(tokenId, msg.sender);
    }

    function getCertificate(uint256 tokenId) external view returns (Certificate memory) {
        require(_owners[tokenId] != address(0), "No such certificate");
        return _certificates[tokenId];
    }

    function isRecordUsed(string memory plantId, uint256 energyMWh, uint256 generationTimestamp)
        external
        view
        returns (bool)
    {
        return _usedRecords[_recordKey(plantId, energyMWh, generationTimestamp)];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address o = _owners[tokenId];
        require(o != address(0), "No such token");
        return o;
    }
}
