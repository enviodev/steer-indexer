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
// Use lowercase addresses directly to avoid checksummed-vs-lowercase issues in test framework
const token0Addr = Addresses.mockAddresses[0]!.toLowerCase() as `0x${string}`;
const token1Addr = Addresses.mockAddresses[1]!.toLowerCase() as `0x${string}`;
const poolAddr = Addresses.mockAddresses[2]!.toLowerCase() as `0x${string}`;
const userAddr = Addresses.mockAddresses[3]!.toLowerCase() as `0x${string}`;
const senderAddr = Addresses.mockAddresses[4]!.toLowerCase() as `0x${string}`;

const poolAddrLower = poolAddr;
const token0AddrLower = token0Addr;
const token1AddrLower = token1Addr;

/** Helper to set up a pool with factory, tokens, and bundle for Pool event testing */
async function setupPool(indexer: ReturnType<typeof createTestIndexer>) {
  const poolId = `${CHAIN_ID}-${poolAddrLower}`;
  const token0Id = `${CHAIN_ID}-${token0AddrLower}`;
  const token1Id = `${CHAIN_ID}-${token1AddrLower}`;
  const factoryId = `${CHAIN_ID}-${factoryAddr}`;
  const bundleId = `${CHAIN_ID}-bundle`;

  indexer.Factory.set({
    id: factoryId,
    poolCount: 1n,
    txCount: 0n,
    totalVolumeUSD: ZERO_BD,
    totalVolumeETH: ZERO_BD,
    totalFeesUSD: ZERO_BD,
    totalFeesETH: ZERO_BD,
    untrackedVolumeUSD: ZERO_BD,
    totalValueLockedUSD: ZERO_BD,
    totalValueLockedETH: ZERO_BD,
    totalValueLockedUSDUntracked: ZERO_BD,
    totalValueLockedETHUntracked: ZERO_BD,
    owner: "0x0000000000000000000000000000000000000000",
  });

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
    derivedETH: ZERO_BD,
    whitelistPools: [],
  });

  indexer.Token.set({
    id: token1Id,
    symbol: "USDC",
    name: "USD Coin",
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
    derivedETH: ZERO_BD,
    whitelistPools: [] as string[],
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
    liquidity: 0n,
    sqrtPrice: 0n,
    feeGrowthGlobal0X128: 0n,
    feeGrowthGlobal1X128: 0n,
    token0Price: ZERO_BD,
    token1Price: ZERO_BD,
    observationIndex: 0n,
    totalValueLockedToken0: ZERO_BD,
    totalValueLockedToken1: ZERO_BD,
    totalValueLockedUSD: ZERO_BD,
    totalValueLockedETH: ZERO_BD,
    totalValueLockedUSDUntracked: ZERO_BD,
    volumeToken0: ZERO_BD,
    volumeToken1: ZERO_BD,
    volumeUSD: ZERO_BD,
    feesUSD: ZERO_BD,
    untrackedVolumeUSD: ZERO_BD,
    collectedFeesToken0: ZERO_BD,
    collectedFeesToken1: ZERO_BD,
    collectedFeesUSD: ZERO_BD,
    tick: undefined,
  });

  return { poolId, token0Id, token1Id, factoryId, bundleId };
}

describe("Pool.Initialize", () => {
  it("should set sqrtPrice and tick on the pool", async () => {
    const indexer = createTestIndexer();
    const { poolId } = await setupPool(indexer);

    // sqrtPriceX96 for approximately price=1 with equal decimals
    const sqrtPriceX96 = 79228162514264337593543950336n;
    const tick = 0n;

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "Pool",
              event: "Initialize",
              params: { sqrtPriceX96, tick },
              srcAddress: poolAddr,
            },
          ],
        },
      },
    });

    const pool = await indexer.Pool.getOrThrow(poolId);
    expect(pool.sqrtPrice).toBe(sqrtPriceX96);
    expect(pool.tick).toBe(tick);
  });
});

describe("Pool.Mint", () => {
  it("should create tick entities and update pool TVL", async () => {
    const indexer = createTestIndexer();
    // Use inline setup instead of setupPool to match working debug test
    const poolId = `${CHAIN_ID}-${poolAddrLower}`;
    const token0Id = `${CHAIN_ID}-${token0AddrLower}`;
    const token1Id = `${CHAIN_ID}-${token1AddrLower}`;
    const factoryId = `${CHAIN_ID}-${factoryAddr}`;

    indexer.Factory.set({id:factoryId,poolCount:1n,txCount:0n,totalVolumeUSD:ZERO_BD,totalVolumeETH:ZERO_BD,totalFeesUSD:ZERO_BD,totalFeesETH:ZERO_BD,untrackedVolumeUSD:ZERO_BD,totalValueLockedUSD:ZERO_BD,totalValueLockedETH:ZERO_BD,totalValueLockedUSDUntracked:ZERO_BD,totalValueLockedETHUntracked:ZERO_BD,owner:"0x0000000000000000000000000000000000000000"});
    indexer.Bundle.set({id:`${CHAIN_ID}-bundle`,ethPriceUSD:ZERO_BD});
    indexer.Token.set({id:token0Id,symbol:"T0",name:"Token0",decimals:18n,totalSupply:0n,volume:ZERO_BD,volumeUSD:ZERO_BD,untrackedVolumeUSD:ZERO_BD,feesUSD:ZERO_BD,txCount:0n,poolCount:1n,totalValueLocked:ZERO_BD,totalValueLockedUSD:ZERO_BD,totalValueLockedUSDUntracked:ZERO_BD,derivedETH:ZERO_BD,whitelistPools:[]});
    indexer.Token.set({id:token1Id,symbol:"T1",name:"Token1",decimals:18n,totalSupply:0n,volume:ZERO_BD,volumeUSD:ZERO_BD,untrackedVolumeUSD:ZERO_BD,feesUSD:ZERO_BD,txCount:0n,poolCount:1n,totalValueLocked:ZERO_BD,totalValueLockedUSD:ZERO_BD,totalValueLockedUSDUntracked:ZERO_BD,derivedETH:ZERO_BD,whitelistPools:[]});
    indexer.Pool.set({id:poolId,token0_id:token0Id,token1_id:token1Id,feeTier:3000n,createdAtTimestamp:1000n,createdAtBlockNumber:100n,liquidityProviderCount:0n,txCount:0n,liquidity:0n,sqrtPrice:0n,feeGrowthGlobal0X128:0n,feeGrowthGlobal1X128:0n,token0Price:ZERO_BD,token1Price:ZERO_BD,observationIndex:0n,totalValueLockedToken0:ZERO_BD,totalValueLockedToken1:ZERO_BD,totalValueLockedUSD:ZERO_BD,totalValueLockedETH:ZERO_BD,totalValueLockedUSDUntracked:ZERO_BD,volumeToken0:ZERO_BD,volumeToken1:ZERO_BD,volumeUSD:ZERO_BD,feesUSD:ZERO_BD,untrackedVolumeUSD:ZERO_BD,collectedFeesToken0:ZERO_BD,collectedFeesToken1:ZERO_BD,collectedFeesUSD:ZERO_BD,tick:0n});

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "Pool",
              event: "Mint",
              params: {
                sender: senderAddr,
                owner: userAddr,
                tickLower: 0n,
                tickUpper: 60n,
                amount: 1000n,
                amount0: 1000n,
                amount1: 1000n,
              },
              srcAddress: poolAddr,
            },
          ],
        },
      },
    });

    // Pool should have updated TVL
    const updatedPool = await indexer.Pool.getOrThrow(poolId);
    expect(updatedPool.txCount).toBe(1n);
    expect(
      updatedPool.totalValueLockedToken0.isGreaterThan(ZERO_BD)
    ).toBe(true);
    expect(
      updatedPool.totalValueLockedToken1.isGreaterThan(ZERO_BD)
    ).toBe(true);

    // Pool liquidity should be updated (tick 0 is between 0 and 60)
    expect(updatedPool.liquidity).toBe(1000n);

    // Factory txCount should be incremented
    const factory = await indexer.Factory.getOrThrow(factoryId);
    expect(factory.txCount).toBe(1n);

    // Token txCounts should be incremented
    const token0 = await indexer.Token.getOrThrow(token0Id);
    expect(token0.txCount).toBe(1n);
    expect(token0.totalValueLocked.isGreaterThan(ZERO_BD)).toBe(true);

    // Mint entity should be created
    const allMints = await indexer.Mint.getAll();
    expect(allMints.length).toBe(1);
    expect(allMints[0]!.pool_id).toBe(poolId);
    expect(allMints[0]!.owner).toBe(userAddr);
    expect(allMints[0]!.tickLower).toBe(0n);
    expect(allMints[0]!.tickUpper).toBe(60n);
    expect(allMints[0]!.amount).toBe(1000n);

    // Transaction entity should be created
    const allTxs = await indexer.Transaction.getAll();
    expect(allTxs.length).toBe(1);

    // Ticks should be created
    const lowerTick = await indexer.Tick.get(`${poolId}#0`);
    const upperTick = await indexer.Tick.get(`${poolId}#60`);
    expect(lowerTick).toBeDefined();
    expect(upperTick).toBeDefined();
    expect(lowerTick!.liquidityGross).toBe(1000n);
    expect(lowerTick!.liquidityNet).toBe(1000n);
    expect(upperTick!.liquidityGross).toBe(1000n);
    expect(upperTick!.liquidityNet).toBe(-1000n);

    // Day/hour data should be created
    const dayData = await indexer.UniswapDayData.getAll();
    expect(dayData.length).toBeGreaterThan(0);

    const poolDayData = await indexer.PoolDayData.getAll();
    expect(poolDayData.length).toBeGreaterThan(0);
  });

  it("should not update liquidity when tick is outside minted range", async () => {
    const indexer = createTestIndexer();
    const poolId = `${CHAIN_ID}-${poolAddrLower}`;
    const token0Id = `${CHAIN_ID}-${token0AddrLower}`;
    const token1Id = `${CHAIN_ID}-${token1AddrLower}`;
    const factoryId = `${CHAIN_ID}-${factoryAddr}`;

    indexer.Factory.set({id:factoryId,poolCount:1n,txCount:0n,totalVolumeUSD:ZERO_BD,totalVolumeETH:ZERO_BD,totalFeesUSD:ZERO_BD,totalFeesETH:ZERO_BD,untrackedVolumeUSD:ZERO_BD,totalValueLockedUSD:ZERO_BD,totalValueLockedETH:ZERO_BD,totalValueLockedUSDUntracked:ZERO_BD,totalValueLockedETHUntracked:ZERO_BD,owner:"0x0000000000000000000000000000000000000000"});
    indexer.Bundle.set({id:`${CHAIN_ID}-bundle`,ethPriceUSD:ZERO_BD});
    indexer.Token.set({id:token0Id,symbol:"T0",name:"Token0",decimals:18n,totalSupply:0n,volume:ZERO_BD,volumeUSD:ZERO_BD,untrackedVolumeUSD:ZERO_BD,feesUSD:ZERO_BD,txCount:0n,poolCount:1n,totalValueLocked:ZERO_BD,totalValueLockedUSD:ZERO_BD,totalValueLockedUSDUntracked:ZERO_BD,derivedETH:ZERO_BD,whitelistPools:[]});
    indexer.Token.set({id:token1Id,symbol:"T1",name:"Token1",decimals:18n,totalSupply:0n,volume:ZERO_BD,volumeUSD:ZERO_BD,untrackedVolumeUSD:ZERO_BD,feesUSD:ZERO_BD,txCount:0n,poolCount:1n,totalValueLocked:ZERO_BD,totalValueLockedUSD:ZERO_BD,totalValueLockedUSDUntracked:ZERO_BD,derivedETH:ZERO_BD,whitelistPools:[]});
    // Set pool tick to 100 (outside 0 to 60 range)
    indexer.Pool.set({id:poolId,token0_id:token0Id,token1_id:token1Id,feeTier:3000n,createdAtTimestamp:1000n,createdAtBlockNumber:100n,liquidityProviderCount:0n,txCount:0n,liquidity:0n,sqrtPrice:79228162514264337593543950336n,feeGrowthGlobal0X128:0n,feeGrowthGlobal1X128:0n,token0Price:ZERO_BD,token1Price:ZERO_BD,observationIndex:0n,totalValueLockedToken0:ZERO_BD,totalValueLockedToken1:ZERO_BD,totalValueLockedUSD:ZERO_BD,totalValueLockedETH:ZERO_BD,totalValueLockedUSDUntracked:ZERO_BD,volumeToken0:ZERO_BD,volumeToken1:ZERO_BD,volumeUSD:ZERO_BD,feesUSD:ZERO_BD,untrackedVolumeUSD:ZERO_BD,collectedFeesToken0:ZERO_BD,collectedFeesToken1:ZERO_BD,collectedFeesUSD:ZERO_BD,tick:100n});

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "Pool",
              event: "Mint",
              params: {
                sender: senderAddr,
                owner: userAddr,
                tickLower: 0n,
                tickUpper: 60n,
                amount: 1000n,
                amount0: 1000n,
                amount1: 1000n,
              },
              srcAddress: poolAddr,
            },
          ],
        },
      },
    });

    const updatedPool = await indexer.Pool.getOrThrow(poolId);
    // Liquidity should NOT be updated because tick 100 > tickUpper 60
    expect(updatedPool.liquidity).toBe(0n);
  });
});

describe("Pool.Burn", () => {
  it("should decrease TVL and tick liquidity", async () => {
    const indexer = createTestIndexer();
    const poolId = `${CHAIN_ID}-${poolAddrLower}`;
    const token0Id = `${CHAIN_ID}-${token0AddrLower}`;
    const token1Id = `${CHAIN_ID}-${token1AddrLower}`;
    const factoryId = `${CHAIN_ID}-${factoryAddr}`;

    indexer.Factory.set({id:factoryId,poolCount:1n,txCount:0n,totalVolumeUSD:ZERO_BD,totalVolumeETH:ZERO_BD,totalFeesUSD:ZERO_BD,totalFeesETH:ZERO_BD,untrackedVolumeUSD:ZERO_BD,totalValueLockedUSD:ZERO_BD,totalValueLockedETH:ZERO_BD,totalValueLockedUSDUntracked:ZERO_BD,totalValueLockedETHUntracked:ZERO_BD,owner:"0x0000000000000000000000000000000000000000"});
    indexer.Bundle.set({id:`${CHAIN_ID}-bundle`,ethPriceUSD:ZERO_BD});
    indexer.Token.set({id:token0Id,symbol:"T0",name:"Token0",decimals:18n,totalSupply:0n,volume:ZERO_BD,volumeUSD:ZERO_BD,untrackedVolumeUSD:ZERO_BD,feesUSD:ZERO_BD,txCount:0n,poolCount:1n,totalValueLocked:ZERO_BD,totalValueLockedUSD:ZERO_BD,totalValueLockedUSDUntracked:ZERO_BD,derivedETH:ZERO_BD,whitelistPools:[]});
    indexer.Token.set({id:token1Id,symbol:"T1",name:"Token1",decimals:18n,totalSupply:0n,volume:ZERO_BD,volumeUSD:ZERO_BD,untrackedVolumeUSD:ZERO_BD,feesUSD:ZERO_BD,txCount:0n,poolCount:1n,totalValueLocked:ZERO_BD,totalValueLockedUSD:ZERO_BD,totalValueLockedUSDUntracked:ZERO_BD,derivedETH:ZERO_BD,whitelistPools:[]});
    // Pool with existing liquidity
    indexer.Pool.set({id:poolId,token0_id:token0Id,token1_id:token1Id,feeTier:3000n,createdAtTimestamp:1000n,createdAtBlockNumber:100n,liquidityProviderCount:0n,txCount:5n,liquidity:2000n,sqrtPrice:79228162514264337593543950336n,feeGrowthGlobal0X128:0n,feeGrowthGlobal1X128:0n,token0Price:ZERO_BD,token1Price:ZERO_BD,observationIndex:0n,totalValueLockedToken0:new BigDecimal("2"),totalValueLockedToken1:new BigDecimal("4000"),totalValueLockedUSD:ZERO_BD,totalValueLockedETH:ZERO_BD,totalValueLockedUSDUntracked:ZERO_BD,volumeToken0:ZERO_BD,volumeToken1:ZERO_BD,volumeUSD:ZERO_BD,feesUSD:ZERO_BD,untrackedVolumeUSD:ZERO_BD,collectedFeesToken0:ZERO_BD,collectedFeesToken1:ZERO_BD,collectedFeesUSD:ZERO_BD,tick:0n});

    // Pre-set ticks
    const lowerTickId = `${poolId}#0`;
    const upperTickId = `${poolId}#60`;
    const tickBase = {pool_id:poolId,poolAddress:poolId,createdAtTimestamp:1000n,createdAtBlockNumber:100n,liquidityProviderCount:0n,price0:ONE_BD,price1:ONE_BD,volumeToken0:ZERO_BD,volumeToken1:ZERO_BD,volumeUSD:ZERO_BD,untrackedVolumeUSD:ZERO_BD,feesUSD:ZERO_BD,collectedFeesToken0:ZERO_BD,collectedFeesToken1:ZERO_BD,collectedFeesUSD:ZERO_BD,feeGrowthOutside0X128:0n,feeGrowthOutside1X128:0n};
    indexer.Tick.set({...tickBase,id:lowerTickId,tickIdx:0n,liquidityGross:2000n,liquidityNet:2000n});
    indexer.Tick.set({...tickBase,id:upperTickId,tickIdx:60n,liquidityGross:2000n,liquidityNet:-2000n});

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "Pool",
              event: "Burn",
              params: {
                owner: userAddr,
                tickLower: 0n,
                tickUpper: 60n,
                amount: 1000n,
                amount0: 500n,
                amount1: 1000n,
              },
              srcAddress: poolAddr,
            },
          ],
        },
      },
    });

    // Pool liquidity should decrease
    const updatedPool = await indexer.Pool.getOrThrow(poolId);
    expect(updatedPool.liquidity).toBe(1000n);
    expect(updatedPool.txCount).toBe(6n);

    // Burn entity should be created
    const allBurns = await indexer.Burn.getAll();
    expect(allBurns.length).toBe(1);
    expect(allBurns[0]!.pool_id).toBe(poolId);
    expect(allBurns[0]!.amount).toBe(1000n);

    // Tick liquidity should be updated
    const lowerTick = await indexer.Tick.getOrThrow(lowerTickId);
    expect(lowerTick.liquidityGross).toBe(1000n);
    expect(lowerTick.liquidityNet).toBe(1000n);

    const upperTick = await indexer.Tick.getOrThrow(upperTickId);
    expect(upperTick.liquidityGross).toBe(1000n);
    expect(upperTick.liquidityNet).toBe(-1000n);
  });
});

describe("Pool.Swap", () => {
  it("should update volumes, fees, and create Swap entity", async () => {
    const indexer = createTestIndexer();
    const { poolId, factoryId } = await setupPool(indexer);

    // Set pool with active tick and price
    const pool = await indexer.Pool.getOrThrow(poolId);
    indexer.Pool.set({
      ...pool,
      tick: 0n,
      sqrtPrice: 79228162514264337593543950336n,
      liquidity: 1000000n,
      token0Price: ONE_BD,
      token1Price: ONE_BD,
      totalValueLockedToken0: new BigDecimal("10"),
      totalValueLockedToken1: new BigDecimal("20000"),
    });

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "Pool",
              event: "Swap",
              params: {
                sender: senderAddr,
                recipient: userAddr,
                amount0: 1_000_000_000_000_000_000n, // +1 ETH in
                amount1: -2000_000_000n, // -2000 USDC out (negative = out)
                sqrtPriceX96: 79228162514264337593543950336n,
                liquidity: 1000000n,
                tick: -1n,
              },
              srcAddress: poolAddr,
            },
          ],
        },
      },
    });

    // Pool should have updated
    const updatedPool = await indexer.Pool.getOrThrow(poolId);
    expect(updatedPool.txCount).toBe(1n);
    expect(updatedPool.tick).toBe(-1n);
    expect(updatedPool.liquidity).toBe(1000000n);
    expect(updatedPool.volumeToken0.isGreaterThan(ZERO_BD)).toBe(true);
    expect(updatedPool.volumeToken1.isGreaterThan(ZERO_BD)).toBe(true);

    // Factory should have updated volumes
    const factory = await indexer.Factory.getOrThrow(factoryId);
    expect(factory.txCount).toBe(1n);

    // Swap entity should be created
    const allSwaps = await indexer.Swap.getAll();
    expect(allSwaps.length).toBe(1);
    expect(allSwaps[0]!.pool_id).toBe(poolId);
    expect(allSwaps[0]!.sender).toBe(senderAddr);
    expect(allSwaps[0]!.recipient).toBe(userAddr);
    expect(allSwaps[0]!.tick).toBe(-1n);

    // UniswapDayData should be created
    const dayData = await indexer.UniswapDayData.getAll();
    expect(dayData.length).toBeGreaterThan(0);
  });
});

describe("Pool.Flash", () => {
  it("should be handled without errors", async () => {
    const indexer = createTestIndexer();
    const { poolId } = await setupPool(indexer);

    // Set pool with existing state
    const pool = await indexer.Pool.getOrThrow(poolId);
    indexer.Pool.set({
      ...pool,
      tick: 0n,
      sqrtPrice: 79228162514264337593543950336n,
      feeGrowthGlobal0X128: 100n,
      feeGrowthGlobal1X128: 200n,
    });

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "Pool",
              event: "Flash",
              params: {
                sender: senderAddr,
                recipient: userAddr,
                amount0: 1_000_000_000_000_000_000n,
                amount1: 2000_000_000n,
                paid0: 3_000_000_000_000_000n, // 0.003 ETH fee
                paid1: 6_000_000n, // 6 USDC fee
              },
              srcAddress: poolAddr,
            },
          ],
        },
      },
    });

    // Pool should still exist (flash doesn't create new entities, just updates pool)
    const updatedPool = await indexer.Pool.getOrThrow(poolId);
    expect(updatedPool).toBeDefined();
  });
});
