# Steer Protocol Vault Holders Indexer

HyperIndex indexer tracking Steer Protocol vault token holders across 27 EVM chains.

Indexes `VaultCreated` events from the Steer VaultFactory to discover vaults, then dynamically tracks all ERC20 `Transfer` events on each vault token to maintain real-time holder balances, total supply, and transfer history.

## Chains

**27 chains with HyperSync** (instant historical sync):
Ethereum, Optimism, Flare, Rootstock, BSC, Unichain, Polygon, Sonic, Manta, Fantom, HyperEVM, Polygon zkEVM, Moonbeam, Sei, Soneium, Mantle, Zeta, Base, Mode, Arbitrum, Celo, Avalanche, Zircuit, Linea, Bera, Blast, Scroll

**20 additional chains** ready to enable in `config.yaml` (need RPC for sync):
Telos, Thundercore, XLayer, Filecoin, Astar, Metis, Core, Ronin, Kava, Peaq, AstarZkevm, Nibiru, Katana, Evmos, Apechain, Hemi, BeraChainBartio, Taiko, ZklinkNova, Saga

## Entities

| Entity | Description |
|--------|-------------|
| `ERC20Contract` | Vault token contracts (name, symbol, decimals, totalSupply) |
| `ERC20Balance` | Per-account balance for each vault token |
| `ERC20Transfer` | Transfer event history with tx hash |
| `VaultAccount` | Unique holder/contract addresses |

The indexer also includes Uniswap V3 entities (Pool, Token, Swap, Mint, Burn, etc.) for future use on chains with V3 deployments.

## Setup

```bash
pnpm install
pnpm codegen
```

### Environment

Copy `.env.example` to `.env` and set:

```bash
ENVIO_API_TOKEN="<your-token>"       # https://envio.dev/app/api-tokens
ENVIO_DRPC_KEY="<your-drpc-key>"     # Single key for all chain RPC calls (effects)
```

Or set per-chain RPC URLs: `ENVIO_RPC_URL_42161="https://..."`.

### Run

```bash
pnpm dev
```

GraphQL playground at http://localhost:8080 (password: `testing`).

### Test

```bash
pnpm test
```

50 tests across 6 files covering all handlers and utility functions.

### Example Queries

```graphql
# All vaults with total supply
{
  ERC20Contract(order_by: { id: asc }) {
    id name symbol decimals
    totalSupply { valueExact }
  }
}

# Top holders across all vaults
{
  ERC20Balance(
    where: { valueExact: { _gt: "0" }, account_id: { _is_null: false } }
    order_by: { valueExact: desc }
    limit: 20
  ) {
    valueExact value
    contract { name }
    account { id }
  }
}

# Recent transfers
{
  ERC20Transfer(order_by: { blockNumber: desc }, limit: 10) {
    blockNumber transactionHash valueExact
    contract { name }
  }
}
```

## Pre-requisites

- [Node.js v22+](https://nodejs.org/en/download/current)
- [pnpm v8+](https://pnpm.io/installation)
- [Docker](https://www.docker.com/products/docker-desktop/) or [Podman](https://podman.io/)
