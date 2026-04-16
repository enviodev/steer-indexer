import { type HandlerContext, BigDecimal } from "generated";
import { ZERO_BD, ZERO_BI, ONE_BI } from "./constants";
import { getChainConfig } from "./chainConfig";
import type { Entities } from "../../generated/envio.d.ts";

export async function updateUniswapDayData(
  event: { block: { timestamp: number }; chainId: number },
  context: HandlerContext
): Promise<Entities["UniswapDayData"]> {
  const chainId = event.chainId;
  const config = getChainConfig(chainId);
  const factoryId = `${chainId}-${config.factoryAddress}`;
  const uniswap = await context.Factory.getOrThrow(factoryId);

  const timestamp = event.block.timestamp;
  const dayID = Math.floor(timestamp / 86400);
  const dayStartTimestamp = dayID * 86400;
  const id = `${chainId}-${dayID}`;

  let uniswapDayData = await context.UniswapDayData.get(id);
  if (!uniswapDayData) {
    uniswapDayData = {
      id,
      date: dayStartTimestamp,
      volumeETH: ZERO_BD,
      volumeUSD: ZERO_BD,
      volumeUSDUntracked: ZERO_BD,
      feesUSD: ZERO_BD,
      txCount: ZERO_BI,
      tvlUSD: ZERO_BD,
    };
  }

  context.UniswapDayData.set({
    ...uniswapDayData,
    tvlUSD: uniswap.totalValueLockedUSD,
    txCount: uniswap.txCount,
  });

  return {
    ...uniswapDayData,
    tvlUSD: uniswap.totalValueLockedUSD,
    txCount: uniswap.txCount,
  };
}

export async function updatePoolDayData(
  event: {
    block: { timestamp: number };
    srcAddress: string;
    chainId: number;
  },
  context: HandlerContext
): Promise<Entities["PoolDayData"]> {
  const chainId = event.chainId;
  const timestamp = event.block.timestamp;
  const dayID = Math.floor(timestamp / 86400);
  const dayStartTimestamp = dayID * 86400;
  const poolId = `${chainId}-${event.srcAddress.toLowerCase()}`;
  const dayPoolID = `${poolId}-${dayID}`;

  const pool = await context.Pool.getOrThrow(poolId);

  let poolDayData = await context.PoolDayData.get(dayPoolID);
  if (!poolDayData) {
    poolDayData = {
      id: dayPoolID,
      date: dayStartTimestamp,
      pool_id: pool.id,
      volumeToken0: ZERO_BD,
      volumeToken1: ZERO_BD,
      volumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      txCount: ZERO_BI,
      feeGrowthGlobal0X128: ZERO_BI,
      feeGrowthGlobal1X128: ZERO_BI,
      open: pool.token0Price,
      high: pool.token0Price,
      low: pool.token0Price,
      close: pool.token0Price,
      liquidity: ZERO_BI,
      sqrtPrice: ZERO_BI,
      token0Price: ZERO_BD,
      token1Price: ZERO_BD,
      tick: undefined,
      tvlUSD: ZERO_BD,
    };
  }

  let high = poolDayData!.high;
  let low = poolDayData!.low;
  if (pool.token0Price.isGreaterThan(high)) high = pool.token0Price;
  if (pool.token0Price.isLessThan(low)) low = pool.token0Price;

  const updated: Entities["PoolDayData"] = {
    ...poolDayData!,
    high,
    low,
    liquidity: pool.liquidity,
    sqrtPrice: pool.sqrtPrice,
    feeGrowthGlobal0X128: pool.feeGrowthGlobal0X128,
    feeGrowthGlobal1X128: pool.feeGrowthGlobal1X128,
    token0Price: pool.token0Price,
    token1Price: pool.token1Price,
    tick: pool.tick ?? undefined,
    tvlUSD: pool.totalValueLockedUSD,
    txCount: poolDayData!.txCount + ONE_BI,
  };

  context.PoolDayData.set(updated);
  return updated;
}

export async function updatePoolHourData(
  event: {
    block: { timestamp: number };
    srcAddress: string;
    chainId: number;
  },
  context: HandlerContext
): Promise<Entities["PoolHourData"]> {
  const chainId = event.chainId;
  const timestamp = event.block.timestamp;
  const hourIndex = Math.floor(timestamp / 3600);
  const hourStartUnix = hourIndex * 3600;
  const poolId = `${chainId}-${event.srcAddress.toLowerCase()}`;
  const hourPoolID = `${poolId}-${hourIndex}`;

  const pool = await context.Pool.getOrThrow(poolId);

  let poolHourData = await context.PoolHourData.get(hourPoolID);
  if (!poolHourData) {
    poolHourData = {
      id: hourPoolID,
      periodStartUnix: hourStartUnix,
      pool_id: pool.id,
      volumeToken0: ZERO_BD,
      volumeToken1: ZERO_BD,
      volumeUSD: ZERO_BD,
      txCount: ZERO_BI,
      feesUSD: ZERO_BD,
      feeGrowthGlobal0X128: ZERO_BI,
      feeGrowthGlobal1X128: ZERO_BI,
      open: pool.token0Price,
      high: pool.token0Price,
      low: pool.token0Price,
      close: pool.token0Price,
      liquidity: ZERO_BI,
      sqrtPrice: ZERO_BI,
      token0Price: ZERO_BD,
      token1Price: ZERO_BD,
      tick: undefined,
      tvlUSD: ZERO_BD,
    };
  }

  let high = poolHourData!.high;
  let low = poolHourData!.low;
  if (pool.token0Price.isGreaterThan(high)) high = pool.token0Price;
  if (pool.token0Price.isLessThan(low)) low = pool.token0Price;

  const updated: Entities["PoolHourData"] = {
    ...poolHourData!,
    high,
    low,
    liquidity: pool.liquidity,
    sqrtPrice: pool.sqrtPrice,
    token0Price: pool.token0Price,
    token1Price: pool.token1Price,
    feeGrowthGlobal0X128: pool.feeGrowthGlobal0X128,
    feeGrowthGlobal1X128: pool.feeGrowthGlobal1X128,
    close: pool.token0Price,
    tick: pool.tick ?? undefined,
    tvlUSD: pool.totalValueLockedUSD,
    txCount: poolHourData!.txCount + ONE_BI,
  };

  context.PoolHourData.set(updated);
  return updated;
}

export async function updateTokenDayData(
  token: Entities["Token"],
  event: { block: { timestamp: number }; chainId: number },
  context: HandlerContext
): Promise<Entities["TokenDayData"]> {
  const chainId = event.chainId;
  const bundle = await context.Bundle.getOrThrow(`${chainId}-bundle`);
  const timestamp = event.block.timestamp;
  const dayID = Math.floor(timestamp / 86400);
  const dayStartTimestamp = dayID * 86400;
  const tokenDayID = `${token.id}-${dayID}`;
  const tokenPrice = token.derivedETH.times(bundle.ethPriceUSD);

  let tokenDayData = await context.TokenDayData.get(tokenDayID);
  if (!tokenDayData) {
    tokenDayData = {
      id: tokenDayID,
      date: dayStartTimestamp,
      token_id: token.id,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      open: tokenPrice,
      high: tokenPrice,
      low: tokenPrice,
      close: tokenPrice,
      priceUSD: ZERO_BD,
      totalValueLocked: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
    };
  }

  let high = tokenDayData.high;
  let low = tokenDayData.low;
  if (tokenPrice.isGreaterThan(high)) high = tokenPrice;
  if (tokenPrice.isLessThan(low)) low = tokenPrice;

  const updated: Entities["TokenDayData"] = {
    ...tokenDayData,
    high,
    low,
    close: tokenPrice,
    priceUSD: token.derivedETH.times(bundle.ethPriceUSD),
    totalValueLocked: token.totalValueLocked,
    totalValueLockedUSD: token.totalValueLockedUSD,
  };

  context.TokenDayData.set(updated);
  return updated;
}

export async function updateTokenHourData(
  token: Entities["Token"],
  event: { block: { timestamp: number }; chainId: number },
  context: HandlerContext
): Promise<Entities["TokenHourData"]> {
  const chainId = event.chainId;
  const bundle = await context.Bundle.getOrThrow(`${chainId}-bundle`);
  const timestamp = event.block.timestamp;
  const hourIndex = Math.floor(timestamp / 3600);
  const hourStartUnix = hourIndex * 3600;
  const tokenHourID = `${token.id}-${hourIndex}`;
  const tokenPrice = token.derivedETH.times(bundle.ethPriceUSD);

  let tokenHourData = await context.TokenHourData.get(tokenHourID);
  if (!tokenHourData) {
    tokenHourData = {
      id: tokenHourID,
      periodStartUnix: hourStartUnix,
      token_id: token.id,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      open: tokenPrice,
      high: tokenPrice,
      low: tokenPrice,
      close: tokenPrice,
      priceUSD: ZERO_BD,
      totalValueLocked: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
    };
  }

  let high = tokenHourData.high;
  let low = tokenHourData.low;
  if (tokenPrice.isGreaterThan(high)) high = tokenPrice;
  if (tokenPrice.isLessThan(low)) low = tokenPrice;

  const updated: Entities["TokenHourData"] = {
    ...tokenHourData,
    high,
    low,
    close: tokenPrice,
    priceUSD: tokenPrice,
    totalValueLocked: token.totalValueLocked,
    totalValueLockedUSD: token.totalValueLockedUSD,
  };

  context.TokenHourData.set(updated);
  return updated;
}

export function updateTickDayData(
  tick: Entities["Tick"],
  event: { block: { timestamp: number }; chainId: number },
  context: HandlerContext
): Entities["TickDayData"] {
  const chainId = event.chainId;
  const timestamp = event.block.timestamp;
  const dayID = Math.floor(timestamp / 86400);
  const dayStartTimestamp = dayID * 86400;
  const tickDayDataID = `${tick.id}-${dayID}`;

  const tickDayData: Entities["TickDayData"] = {
    id: tickDayDataID,
    date: dayStartTimestamp,
    pool_id: tick.pool_id,
    tick_id: tick.id,
    liquidityGross: tick.liquidityGross,
    liquidityNet: tick.liquidityNet,
    volumeToken0: tick.volumeToken0,
    volumeToken1: tick.volumeToken1,
    volumeUSD: tick.volumeUSD,
    feesUSD: tick.feesUSD,
    feeGrowthOutside0X128: tick.feeGrowthOutside0X128,
    feeGrowthOutside1X128: tick.feeGrowthOutside1X128,
  };

  context.TickDayData.set(tickDayData);
  return tickDayData;
}
