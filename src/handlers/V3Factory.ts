import { V3Factory } from "generated";
import { ZERO_BI, ZERO_BD, ONE_BI, ADDRESS_ZERO } from "../utils/constants";
import { getChainConfig } from "../utils/chainConfig";
import { getTokenMetadata } from "../effects/tokenMetadata";

V3Factory.PoolCreated.contractRegister(({ event, context }) => {
  context.addPool(event.params.pool);
});

V3Factory.PoolCreated.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const config = getChainConfig(chainId);

  // Skip excluded pool
  if (
    event.params.pool.toLowerCase() ===
    "0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248"
  ) {
    return;
  }

  const factoryId = `${chainId}-${config.factoryAddress}`;

  // Load or create factory
  let factory = await context.Factory.get(factoryId);
  if (!factory) {
    factory = {
      id: factoryId,
      poolCount: ZERO_BI,
      totalVolumeETH: ZERO_BD,
      totalVolumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      totalFeesUSD: ZERO_BD,
      totalFeesETH: ZERO_BD,
      totalValueLockedETH: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      totalValueLockedETHUntracked: ZERO_BD,
      txCount: ZERO_BI,
      owner: ADDRESS_ZERO,
    };

    // Create bundle for tracking eth price
    context.Bundle.set({
      id: `${chainId}-bundle`,
      ethPriceUSD: ZERO_BD,
    });
  }

  factory = { ...factory, poolCount: factory.poolCount + ONE_BI };

  // Load or create token0
  const token0Id = `${chainId}-${event.params.token0.toLowerCase()}`;
  let token0 = await context.Token.get(token0Id);
  if (!token0) {
    let metadata = { name: "unknown", symbol: "unknown", decimals: 18 as number | undefined, totalSupply: "0" };
    try {
      const result = await context.effect(getTokenMetadata, {
        address: event.params.token0,
        chainId,
      });
      metadata = { ...metadata, ...result };
    } catch {
      // Use defaults if RPC unavailable
    }

    if (metadata.decimals === undefined) {
      context.log.debug("Decimal on token0 was null, skipping");
      return;
    }

    token0 = {
      id: token0Id,
      symbol: metadata.symbol,
      name: metadata.name,
      totalSupply: BigInt(metadata.totalSupply),
      decimals: BigInt(metadata.decimals),
      derivedETH: ZERO_BD,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      totalValueLocked: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      txCount: ZERO_BI,
      poolCount: ZERO_BI,
      whitelistPools: [],
    };
  }

  // Load or create token1
  const token1Id = `${chainId}-${event.params.token1.toLowerCase()}`;
  let token1 = await context.Token.get(token1Id);
  if (!token1) {
    let metadata1 = { name: "unknown", symbol: "unknown", decimals: 18 as number | undefined, totalSupply: "0" };
    try {
      const result = await context.effect(getTokenMetadata, {
        address: event.params.token1,
        chainId,
      });
      metadata1 = { ...metadata1, ...result };
    } catch {
      // Use defaults if RPC unavailable
    }

    if (metadata1.decimals === undefined) {
      context.log.debug("Decimal on token1 was null, skipping");
      return;
    }

    token1 = {
      id: token1Id,
      symbol: metadata1.symbol,
      name: metadata1.name,
      totalSupply: BigInt(metadata1.totalSupply),
      decimals: BigInt(metadata1.decimals),
      derivedETH: ZERO_BD,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      totalValueLocked: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      txCount: ZERO_BI,
      poolCount: ZERO_BI,
      whitelistPools: [],
    };
  }

  // Update whitelist pools
  const poolId = `${chainId}-${event.params.pool.toLowerCase()}`;
  const token0Address = event.params.token0.toLowerCase();
  const token1Address = event.params.token1.toLowerCase();

  if (config.whitelistTokens.includes(token0Address)) {
    token1 = {
      ...token1,
      whitelistPools: [...token1.whitelistPools, poolId],
    };
  }
  if (config.whitelistTokens.includes(token1Address)) {
    token0 = {
      ...token0,
      whitelistPools: [...token0.whitelistPools, poolId],
    };
  }

  // Create pool
  context.Pool.set({
    id: poolId,
    token0_id: token0.id,
    token1_id: token1.id,
    feeTier: event.params.fee,
    createdAtTimestamp: BigInt(event.block.timestamp),
    createdAtBlockNumber: BigInt(event.block.number),
    liquidityProviderCount: ZERO_BI,
    txCount: ZERO_BI,
    liquidity: ZERO_BI,
    sqrtPrice: ZERO_BI,
    feeGrowthGlobal0X128: ZERO_BI,
    feeGrowthGlobal1X128: ZERO_BI,
    token0Price: ZERO_BD,
    token1Price: ZERO_BD,
    observationIndex: ZERO_BI,
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

  context.Token.set(token0);
  context.Token.set(token1);
  context.Factory.set(factory);
});
