# RECRegistry — on-chain REC certificate registry

`RECRegistry.sol` is an ERC-721 (OpenZeppelin `ERC721Enumerable` + `Ownable`)
where one token is one certified generation record.

## Live deployment

| | |
| --- | --- |
| Network | Ethereum Sepolia (chainId 11155111) |
| Address | [`0x28190548E1e84fcaC6EEcc5fECaDE138e6154B59`](https://sepolia.etherscan.io/address/0x28190548E1e84fcaC6EEcc5fECaDE138e6154B59#code) |
| Source | verified on Etherscan |
| Issuer | `0xB81ce4bc1fb783217EB4E331846D917B17970e12` |

A local Hardhat deployment is kept alongside it. Both live in the same
generated artifact, keyed by chain id, and the app resolves the address from
the chain it's *connected* to — so pointing `RPC_URL` at a local node can never
accidentally talk to the Sepolia contract, or the other way round.

## Why it exists

Everything else in RECON is a *judgement*: the ML model scores a certificate,
the graph layer looks for trading rings, the LLM explains the result. Those can
all be wrong, and they can all be re-run with different answers. The registry
holds the two facts that must be *settled*:

1. **A generation record can only be certified once.** Records are keyed by
   `keccak256(abi.encode(plantId, energyMWh, generationTimestamp))`; a second
   mint for the same key reverts with `RecordAlreadyCertified`. This is the
   on-chain backstop for the `duplicate_serial` fraud class — no amount of
   database tampering can produce two valid certificates for one record.
2. **Retirement is final.** A retired certificate can't be retired again or
   transferred, so a REC that's been claimed against a sustainability target
   can't be resold. Enforced in `_update`, which covers every ERC-721 transfer
   path rather than just the one function.

The fraud score assigned at issuance is stored immutably alongside the record,
so an auditor can always see what the pipeline believed at mint time, even if
the model is retrained later.

`abi.encode` is deliberate where `abi.encodePacked` would be the obvious
choice: packed encoding lets `("PLANT-1", 11)` and `("PLANT-11", 1)` hash to
the same key, which would let one record block an unrelated one.

## Local setup

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test          # 17 tests
```

Then, in one terminal:

```bash
npx hardhat node          # leave running — prints funded test accounts
```

and in another:

```bash
npm run deploy:local
```

`deploy.js` writes the **compiled** ABI plus the deployed address to two
generated files:

- `backend/app/contracts/RECRegistry.json` — what `web3_client.py` loads
- `dashboard/lib/contract-artifact.json` — the read-only ABI the browser uses

Neither should ever be hand-edited. They used to be, and a hand-written ABI
means a signature drift between the backend and the deployed contract shows up
only as a runtime failure, with nothing in the test suite able to catch it.

Because the address is recorded in the artifact, a local backend run needs no
`.env` edit at all — set `CONTRACT_ADDRESS` only to point at a different
deployment. You do need `BACKEND_PRIVATE_KEY`; locally, use Account #0 from
`npx hardhat node` (it's the deployer, and therefore already an authorized
issuer).

## Sepolia

Credentials go in `contracts/.env` (gitignored — never commit them):

```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<key>
DEPLOYER_PRIVATE_KEY=0x...        # funded with Sepolia ETH
BACKEND_PRIVATE_KEY=0x...         # authorized automatically if different
ETHERSCAN_API_KEY=...
```

```bash
npm run deploy:sepolia
npx hardhat verify --network sepolia <address> <deployer-address>
```

The deployer becomes the owner and an authorized issuer. If
`BACKEND_PRIVATE_KEY` names a different wallet, the script authorizes it too.

Note that Etherscan API v2 takes a single `apiKey` string; the per-network map
(`apiKey: { sepolia: ... }`) is the v1 shape and is now rejected outright.

## Docker

`docker compose up --build` starts a `chain` service that runs a Hardhat node
and deploys the registry into it on boot, publishing the address to a shared
volume the backend reads. That means the stack has a working chain with no
setup, and the backend always uses the address that container actually
deployed rather than one committed in the repo.

The frontend can't read that volume — `NEXT_PUBLIC_*` is inlined at build
time, before the chain container exists — so compose passes the address as a
build arg. That's safe because a fresh Hardhat node always deploys the registry
to `0x5FbDB2315678afecb367f032d93F642f64180aa3`: the deployer is account #0 at
nonce 0, and a CREATE address is a pure function of (sender, nonce).

## Access model

- **Owner** (`Ownable`) — can authorize and revoke issuers. Nothing else.
- **Authorized issuer** — can call `issueCertificate`. The backend wallet.
- **Token owner** — can transfer, and is the only account that can retire.

Note the consequence for the backend: it signs only as its own wallet, so it
can retire or transfer a certificate only while it custodies it. Certificates
minted straight to an end-user wallet must be retired by that user's own
wallet, client-side. `web3_client.retire_certificate` and
`transfer_certificate` check this up front and raise `NotAuthorizedError`
rather than sending a transaction that would revert.

## Contract surface

| Function | Access | Notes |
| --- | --- | --- |
| `issueCertificate(to, plantId, energyMWh, generationTimestamp, fraudScore)` | issuer | reverts `RecordAlreadyCertified`, `FraudScoreOutOfRange` (>100) |
| `retireCertificate(tokenId)` | token owner | reverts `CertificateAlreadyRetired`, `NotCertificateOwner` |
| `transferFrom` / `safeTransferFrom` | token owner / approved | reverts `CertificateAlreadyRetired` for a retired token |
| `getCertificate(tokenId)` | view | reverts `CertificateDoesNotExist` |
| `isRecordUsed(plantId, energyMWh, generationTimestamp)` | view | free pre-flight duplicate check |
| `tokenIdForRecord(...)` | view | which token certified a record |
| `isRetired(tokenId)` | view | |
| `authorizeIssuer` / `revokeIssuer` | owner | |

All failures are custom errors, not `require` strings. `web3_client.py` maps
them to typed Python exceptions by 4-byte selector computed from the ABI, so
classification can't drift with wording — and `CertificateAlreadyRetired` can't
be mistaken for `RecordAlreadyCertified`, which is what happened when the
mapping was substring matching on the word "already".
