import { describe, it, expect } from "vitest";
import { createTestIndexer, BigDecimal } from "generated";
import { TestHelpers } from "envio";

const { Addresses } = TestHelpers;

// Import handlers
import "../handlers/V3Factory";
import "../handlers/Pool";
import "../handlers/NonfungiblePositionManager";
import "../handlers/VaultFactory";
import "../handlers/VaultERC20";

const CHAIN_ID = 314;
const ZERO_BD = new BigDecimal(0);
const ONE_BD = new BigDecimal(1);

const factoryAddr = "0xb4c47ed546fc31e26470a186ec2c5f19ef09ba41";
const npmAddr = Addresses.mockAddresses[10]!;
const poolAddr = Addresses.mockAddresses[2]!;
const token0Addr = Addresses.mockAddresses[0]!;
const token1Addr = Addresses.mockAddresses[1]!;
const ownerAddr = Addresses.mockAddresses[3]!;
const recipientAddr = Addresses.mockAddresses[4]!;
const newOwnerAddr = Addresses.mockAddresses[5]!;

/** Sets up prerequisite entities for NPM tests */
async function setupNpmEntities(
  indexer: ReturnType<typeof createTestIndexer>
) {
  const poolId = `${CHAIN_ID}-${poolAddr.toLowerCase()}`;
  const token0Id = `${CHAIN_ID}-${token0Addr.toLowerCase()}`;
  const token1Id = `${CHAIN_ID}-${token1Addr.toLowerCase()}`;
  const factoryId = `${CHAIN_ID}-${factoryAddr}`;
  const bundleId = `${CHAIN_ID}-bundle`;

  indexer.Bundle.set({
    id: bundleId,
    ethPriceUSD: new BigDecimal("2000"),
  });

  indexer.Token.set({
    id: token0Id,
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18n,
    totalSupply: 0n,
    volume: ZERO_BD,
    volumeUSD: ZERO_BD,
    untrackedVolumeUSD: ZERO_BD,
    feesUSD: ZERO_BD,
    txCount: 0n,
    poolCount: 1n,
    totalValueLocked: ZERO_BD,
    totalValueLockedUSD: ZERO_BD,
    totalValueLockedUSDUntracked: ZERO_BD,
    derivedETH: ONE_BD,
    whitelistPools: [],
  });

  indexer.Token.set({
    id: token1Id,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6n,
    totalSupply: 0n,
    volume: ZERO_BD,
    volumeUSD: ZERO_BD,
    untrackedVolumeUSD: ZERO_BD,
    feesUSD: ZERO_BD,
    txCount: 0n,
    poolCount: 1n,
    totalValueLocked: ZERO_BD,
    totalValueLockedUSD: ZERO_BD,
    totalValueLockedUSDUntracked: ZERO_BD,
    derivedETH: new BigDecimal("0.0005"),
    whitelistPools: [],
  });

  indexer.Pool.set({
    id: poolId,
    token0_id: token0Id,
    token1_id: token1Id,
    feeTier: 3000n,
    createdAtTimestamp: 1000n,
    createdAtBlockNumber: 100n,
    liquidityProviderCount: 0n,
    txCount: 0n,
    liquidity: 1000000n,
    sqrtPrice: 79228162514264337593543950336n,
    feeGrowthGlobal0X128: 0n,
    feeGrowthGlobal1X128: 0n,
    token0Price: ONE_BD,
    token1Price: ONE_BD,
    observationIndex: 0n,
    totalValueLockedToken0: new BigDecimal("10"),
    totalValueLockedToken1: new BigDecimal("20000"),
    totalValueLockedUSD: new BigDecimal("40000"),
    totalValueLockedETH: new BigDecimal("20"),
    totalValueLockedUSDUntracked: ZERO_BD,
    volumeToken0: ZERO_BD,
    volumeToken1: ZERO_BD,
    volumeUSD: ZERO_BD,
    feesUSD: ZERO_BD,
    untrackedVolumeUSD: ZERO_BD,
    collectedFeesToken0: ZERO_BD,
    collectedFeesToken1: ZERO_BD,
    collectedFeesUSD: ZERO_BD,
    tick: 0n,
  });

  // Pre-create ticks referenced by positions
  const tickLowerId = `${poolId}#-120`;
  const tickUpperId = `${poolId}#120`;
  const tickBase = {
    pool_id: poolId,
    poolAddress: poolId,
    createdAtTimestamp: 1000n,
    createdAtBlockNumber: 100n,
    liquidityGross: 0n,
    liquidityNet: 0n,
    liquidityProviderCount: 0n,
    price0: ONE_BD,
    price1: ONE_BD,
    volumeToken0: ZERO_BD,
    volumeToken1: ZERO_BD,
    volumeUSD: ZERO_BD,
    untrackedVolumeUSD: ZERO_BD,
    feesUSD: ZERO_BD,
    collectedFeesToken0: ZERO_BD,
    collectedFeesToken1: ZERO_BD,
    collectedFeesUSD: ZERO_BD,
    feeGrowthOutside0X128: 0n,
    feeGrowthOutside1X128: 0n,
  };
  indexer.Tick.set({ ...tickBase, id: tickLowerId, tickIdx: -120n });
  indexer.Tick.set({ ...tickBase, id: tickUpperId, tickIdx: 120n });

  return { poolId, token0Id, token1Id, factoryId, bundleId };
}

/** Create a pre-existing position for tests that need one */
function setupPosition(
  indexer: ReturnType<typeof createTestIndexer>,
  poolId: string,
  token0Id: string,
  token1Id: string
) {
  const positionId = `${CHAIN_ID}-42`;
  const transactionId = `${CHAIN_ID}-0xabc123`;

  indexer.Transaction.set({
    id: transactionId,
    blockNumber: 100n,
    timestamp: 1000n,
    gasUsed: 0n,
    gasPrice: 0n,
  });

  indexer.Position.set({
    id: positionId,
    owner: ownerAddr,
    pool_id: poolId,
    token0_id: token0Id,
    token1_id: token1Id,
    tickLower_id: `${poolId}#-120`,
    tickUpper_id: `${poolId}#120`,
    liquidity: 500000n,
    depositedToken0: new BigDecimal("1"),
    depositedToken1: new BigDecimal("2000"),
    withdrawnToken0: ZERO_BD,
    withdrawnToken1: ZERO_BD,
    collectedToken0: ZERO_BD,
    collectedToken1: ZERO_BD,
    collectedFeesToken0: ZERO_BD,
    collectedFeesToken1: ZERO_BD,
    transaction_id: transactionId,
    feeGrowthInside0LastX128: 0n,
    feeGrowthInside1LastX128: 0n,
    amountDepositedUSD: new BigDecimal("4000"),
    amountWithdrawnUSD: ZERO_BD,
    amountCollectedUSD: ZERO_BD,
  });

  return positionId;
}

describe("NonfungiblePositionManager.NFTTransfer", () => {
  it("should update position owner and create snapshot", async () => {
    const indexer = createTestIndexer();
    const { poolId, token0Id, token1Id } = await setupNpmEntities(indexer);
    const positionId = setupPosition(indexer, poolId, token0Id, token1Id);

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "NonfungiblePositionManager",
              event: "NFTTransfer",
              params: {
                from: ownerAddr,
                to: newOwnerAddr,
                tokenId: 42n,
              },
              srcAddress: npmAddr,
            },
          ],
        },
      },
    });

    // Position owner should be updated
    const position = await indexer.Position.getOrThrow(positionId);
    expect(position.owner).toBe(newOwnerAddr);

    // PositionSnapshot should be created
    const allSnapshots = await indexer.PositionSnapshot.getAll();
    expect(allSnapshots.length).toBe(1);
    expect(allSnapshots[0]!.owner).toBe(newOwnerAddr);
    expect(allSnapshots[0]!.position_id).toBe(positionId);
    expect(allSnapshots[0]!.pool_id).toBe(poolId);
  });
});

describe("NonfungiblePositionManager.IncreaseLiquidity", () => {
  it("should increase position liquidity and deposited amounts", async () => {
    const indexer = createTestIndexer();
    const { poolId, token0Id, token1Id } = await setupNpmEntities(indexer);
    const positionId = setupPosition(indexer, poolId, token0Id, token1Id);

    const amount0 = 500_000_000_000_000_000n; // 0.5 ETH
    const amount1 = 1000_000_000n; // 1000 USDC
    const addLiquidity = 250000n;

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "NonfungiblePositionManager",
              event: "IncreaseLiquidity",
              params: {
                tokenId: 42n,
                liquidity: addLiquidity,
                amount0,
                amount1,
              },
              srcAddress: npmAddr,
            },
          ],
        },
      },
    });

    const position = await indexer.Position.getOrThrow(positionId);
    // Liquidity should increase
    expect(position.liquidity).toBe(500000n + addLiquidity);
    // Deposited amounts should increase
    expect(position.depositedToken0.isGreaterThan(new BigDecimal("1"))).toBe(
      true
    ); // was 1, added 0.5
    expect(position.depositedToken1.isGreaterThan(new BigDecimal("2000"))).toBe(
      true
    ); // was 2000, added 1000
    // USD deposit amount should increase
    expect(
      position.amountDepositedUSD.isGreaterThan(new BigDecimal("4000"))
    ).toBe(true);

    // Snapshot should be created
    const allSnapshots = await indexer.PositionSnapshot.getAll();
    expect(allSnapshots.length).toBe(1);
    expect(allSnapshots[0]!.liquidity).toBe(500000n + addLiquidity);
  });
});

describe("NonfungiblePositionManager.DecreaseLiquidity", () => {
  it("should decrease position liquidity and track withdrawals", async () => {
    const indexer = createTestIndexer();
    const { poolId, token0Id, token1Id } = await setupNpmEntities(indexer);
    const positionId = setupPosition(indexer, poolId, token0Id, token1Id);

    const amount0 = 250_000_000_000_000_000n; // 0.25 ETH
    const amount1 = 500_000_000n; // 500 USDC
    const removeLiquidity = 100000n;

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "NonfungiblePositionManager",
              event: "DecreaseLiquidity",
              params: {
                tokenId: 42n,
                liquidity: removeLiquidity,
                amount0,
                amount1,
              },
              srcAddress: npmAddr,
            },
          ],
        },
      },
    });

    const position = await indexer.Position.getOrThrow(positionId);
    // Liquidity should decrease
    expect(position.liquidity).toBe(500000n - removeLiquidity);
    // Withdrawn amounts should increase from zero
    expect(position.withdrawnToken0.isGreaterThan(ZERO_BD)).toBe(true);
    expect(position.withdrawnToken1.isGreaterThan(ZERO_BD)).toBe(true);
    expect(
      position.amountWithdrawnUSD.isGreaterThan(ZERO_BD)
    ).toBe(true);
  });
});

describe("NonfungiblePositionManager.NFTCollect", () => {
  it("should track collected fees", async () => {
    const indexer = createTestIndexer();
    const { poolId, token0Id, token1Id } = await setupNpmEntities(indexer);
    const positionId = setupPosition(indexer, poolId, token0Id, token1Id);

    // Set some withdrawn amounts to test fee calculation
    const pos = await indexer.Position.getOrThrow(positionId);
    indexer.Position.set({
      ...pos,
      withdrawnToken0: new BigDecimal("0.1"),
      withdrawnToken1: new BigDecimal("200"),
    });

    const collectAmount0 = 150_000_000_000_000_000n; // 0.15 ETH
    const collectAmount1 = 300_000_000n; // 300 USDC

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "NonfungiblePositionManager",
              event: "NFTCollect",
              params: {
                tokenId: 42n,
                recipient: ownerAddr,
                amount0: collectAmount0,
                amount1: collectAmount1,
              },
              srcAddress: npmAddr,
            },
          ],
        },
      },
    });

    const position = await indexer.Position.getOrThrow(positionId);
    // Collected amounts should increase
    expect(position.collectedToken0.isGreaterThan(ZERO_BD)).toBe(true);
    expect(position.collectedToken1.isGreaterThan(ZERO_BD)).toBe(true);
    // Fees = collected - withdrawn
    expect(position.collectedFeesToken0.isGreaterThan(ZERO_BD)).toBe(true);
    expect(position.collectedFeesToken1.isGreaterThan(ZERO_BD)).toBe(true);
    // USD amount should be tracked
    expect(position.amountCollectedUSD.isGreaterThan(ZERO_BD)).toBe(true);

    // Snapshot should be created
    const allSnapshots = await indexer.PositionSnapshot.getAll();
    expect(allSnapshots.length).toBe(1);
  });
});
