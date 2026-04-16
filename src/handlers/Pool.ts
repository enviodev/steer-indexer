import { Pool, BigDecimal } from "generated";
import { ZERO_BI, ZERO_BD, ONE_BI } from "../utils/constants";
import { convertTokenToDecimal, loadTransaction, safeDiv } from "../utils/index";
import { getChainConfig } from "../utils/chainConfig";
import {
  sqrtPriceX96ToTokenPrices,
  getEthPriceInUSD,
  findEthPerToken,
  getTrackedAmountUSD,
} from "../utils/pricing";
import {
  updateUniswapDayData,
  updatePoolDayData,
  updatePoolHourData,
  updateTokenDayData,
  updateTokenHourData,
  updateTickDayData,
} from "../utils/intervalUpdates";
import { createTick, feeTierToTickSpacing } from "../utils/tick";
import { getPoolFeeGrowthGlobal, getPoolTickData } from "../effects/poolState";

// ============================================================
// Initialize
// ============================================================
Pool.Initialize.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolId = `${chainId}-${event.srcAddress.toLowerCase()}`;
  const pool = await context.Pool.getOrThrow(poolId);

  const updatedPool = {
    ...pool,
    sqrtPrice: event.params.sqrtPriceX96,
    tick: event.params.tick,
  };
  context.Pool.set(updatedPool);

  const token0 = await context.Token.getOrThrow(pool.token0_id);
  const token1 = await context.Token.getOrThrow(pool.token1_id);

  // Update ETH price
  const bundle = await context.Bundle.getOrThrow(`${chainId}-bundle`);
  const ethPriceUSD = await getEthPriceInUSD(context, chainId);
  context.Bundle.set({ ...bundle, ethPriceUSD });

  await updatePoolDayData(event, context);
  await updatePoolHourData(event, context);

  // Update token prices
  const token0DerivedETH = await findEthPerToken(token0, context, chainId);
  const token1DerivedETH = await findEthPerToken(token1, context, chainId);
  context.Token.set({ ...token0, derivedETH: token0DerivedETH });
  context.Token.set({ ...token1, derivedETH: token1DerivedETH });
});

// ============================================================
// Mint
// ============================================================
Pool.Mint.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const config = getChainConfig(chainId);
  const poolAddress = event.srcAddress;
  const poolId = `${chainId}-${poolAddress}`;

  const bundle = await context.Bundle.getOrThrow(`${chainId}-bundle`);
  let pool = await context.Pool.getOrThrow(poolId);
  let factory = await context.Factory.getOrThrow(
    `${chainId}-${config.factoryAddress}`
  );
  let token0 = await context.Token.getOrThrow(pool.token0_id);
  let token1 = await context.Token.getOrThrow(pool.token1_id);

  const amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals);
  const amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals);

  const amountUSD = amount0
    .times(token0.derivedETH.times(bundle.ethPriceUSD))
    .plus(amount1.times(token1.derivedETH.times(bundle.ethPriceUSD)));

  // Reset TVL aggregates
  factory = {
    ...factory,
    totalValueLockedETH: factory.totalValueLockedETH.minus(
      pool.totalValueLockedETH
    ),
    txCount: factory.txCount + ONE_BI,
  };

  // Update token data
  token0 = {
    ...token0,
    txCount: token0.txCount + ONE_BI,
    totalValueLocked: token0.totalValueLocked.plus(amount0),
    totalValueLockedUSD: token0.totalValueLocked
      .plus(amount0)
      .times(token0.derivedETH.times(bundle.ethPriceUSD)),
  };
  token1 = {
    ...token1,
    txCount: token1.txCount + ONE_BI,
    totalValueLocked: token1.totalValueLocked.plus(amount1),
    totalValueLockedUSD: token1.totalValueLocked
      .plus(amount1)
      .times(token1.derivedETH.times(bundle.ethPriceUSD)),
  };

  // Pool data
  let poolLiquidity = pool.liquidity;
  if (
    pool.tick !== null &&
    pool.tick !== undefined &&
    event.params.tickLower <= pool.tick &&
    event.params.tickUpper > pool.tick
  ) {
    poolLiquidity = poolLiquidity + event.params.amount;
  }

  const newTVLToken0 = pool.totalValueLockedToken0.plus(amount0);
  const newTVLToken1 = pool.totalValueLockedToken1.plus(amount1);
  const newTVLETH = newTVLToken0
    .times(token0.derivedETH)
    .plus(newTVLToken1.times(token1.derivedETH));

  pool = {
    ...pool,
    txCount: pool.txCount + ONE_BI,
    liquidity: poolLiquidity,
    totalValueLockedToken0: newTVLToken0,
    totalValueLockedToken1: newTVLToken1,
    totalValueLockedETH: newTVLETH,
    totalValueLockedUSD: newTVLETH.times(bundle.ethPriceUSD),
  };

  factory = {
    ...factory,
    totalValueLockedETH: factory.totalValueLockedETH.plus(
      pool.totalValueLockedETH
    ),
    totalValueLockedUSD: factory.totalValueLockedETH
      .plus(pool.totalValueLockedETH)
      .times(bundle.ethPriceUSD),
  };

  const transaction = await loadTransaction(event, context);
  const mintId = `${transaction.id}#${pool.txCount.toString()}`;
  context.Mint.set({
    id: mintId,
    transaction_id: transaction.id,
    timestamp: transaction.timestamp,
    pool_id: pool.id,
    token0_id: pool.token0_id,
    token1_id: pool.token1_id,
    owner: event.params.owner,
    sender: event.params.sender,
    origin: event.transaction.from ?? "",
    amount: event.params.amount,
    amount0,
    amount1,
    amountUSD,
    tickLower: event.params.tickLower,
    tickUpper: event.params.tickUpper,
    logIndex: BigInt(event.logIndex),
  });

  // Tick entities
  const lowerTickId = `${poolId}#${event.params.tickLower.toString()}`;
  const upperTickId = `${poolId}#${event.params.tickUpper.toString()}`;

  let lowerTick = await context.Tick.get(lowerTickId);
  let upperTick = await context.Tick.get(upperTickId);

  if (!lowerTick) {
    lowerTick = createTick(
      lowerTickId,
      Number(event.params.tickLower),
      pool.id,
      BigInt(event.block.timestamp),
      BigInt(event.block.number)
    );
  }
  if (!upperTick) {
    upperTick = createTick(
      upperTickId,
      Number(event.params.tickUpper),
      pool.id,
      BigInt(event.block.timestamp),
      BigInt(event.block.number)
    );
  }

  lowerTick = {
    ...lowerTick,
    liquidityGross: lowerTick.liquidityGross + event.params.amount,
    liquidityNet: lowerTick.liquidityNet + event.params.amount,
  };
  upperTick = {
    ...upperTick,
    liquidityGross: upperTick.liquidityGross + event.params.amount,
    liquidityNet: upperTick.liquidityNet - event.params.amount,
  };

  // Interval updates
  await updateUniswapDayData(event, context);
  await updatePoolDayData(event, context);
  await updatePoolHourData(event, context);
  await updateTokenDayData(token0, event, context);
  await updateTokenDayData(token1, event, context);
  await updateTokenHourData(token0, event, context);
  await updateTokenHourData(token1, event, context);

  context.Token.set(token0);
  context.Token.set(token1);
  context.Pool.set(pool);
  context.Factory.set(factory);

  // Update tick fee vars and save
  await updateTickFeeVarsAndSave(lowerTick, event, context);
  await updateTickFeeVarsAndSave(upperTick, event, context);
});

// ============================================================
// Burn
// ============================================================
Pool.Burn.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const config = getChainConfig(chainId);
  const poolAddress = event.srcAddress;
  const poolId = `${chainId}-${poolAddress}`;

  const bundle = await context.Bundle.getOrThrow(`${chainId}-bundle`);
  let pool = await context.Pool.getOrThrow(poolId);
  let factory = await context.Factory.getOrThrow(
    `${chainId}-${config.factoryAddress}`
  );
  let token0 = await context.Token.getOrThrow(pool.token0_id);
  let token1 = await context.Token.getOrThrow(pool.token1_id);

  const amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals);
  const amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals);

  const amountUSD = amount0
    .times(token0.derivedETH.times(bundle.ethPriceUSD))
    .plus(amount1.times(token1.derivedETH.times(bundle.ethPriceUSD)));

  factory = {
    ...factory,
    totalValueLockedETH: factory.totalValueLockedETH.minus(
      pool.totalValueLockedETH
    ),
    txCount: factory.txCount + ONE_BI,
  };

  token0 = {
    ...token0,
    txCount: token0.txCount + ONE_BI,
    totalValueLocked: token0.totalValueLocked.minus(amount0),
    totalValueLockedUSD: token0.totalValueLocked
      .minus(amount0)
      .times(token0.derivedETH.times(bundle.ethPriceUSD)),
  };
  token1 = {
    ...token1,
    txCount: token1.txCount + ONE_BI,
    totalValueLocked: token1.totalValueLocked.minus(amount1),
    totalValueLockedUSD: token1.totalValueLocked
      .minus(amount1)
      .times(token1.derivedETH.times(bundle.ethPriceUSD)),
  };

  let poolLiquidity = pool.liquidity;
  if (
    pool.tick !== null &&
    pool.tick !== undefined &&
    event.params.tickLower <= pool.tick &&
    event.params.tickUpper > pool.tick
  ) {
    poolLiquidity = poolLiquidity - event.params.amount;
  }

  const newTVLToken0 = pool.totalValueLockedToken0.minus(amount0);
  const newTVLToken1 = pool.totalValueLockedToken1.minus(amount1);
  const newTVLETH = newTVLToken0
    .times(token0.derivedETH)
    .plus(newTVLToken1.times(token1.derivedETH));

  pool = {
    ...pool,
    txCount: pool.txCount + ONE_BI,
    liquidity: poolLiquidity,
    totalValueLockedToken0: newTVLToken0,
    totalValueLockedToken1: newTVLToken1,
    totalValueLockedETH: newTVLETH,
    totalValueLockedUSD: newTVLETH.times(bundle.ethPriceUSD),
  };

  factory = {
    ...factory,
    totalValueLockedETH: factory.totalValueLockedETH.plus(
      pool.totalValueLockedETH
    ),
    totalValueLockedUSD: factory.totalValueLockedETH
      .plus(pool.totalValueLockedETH)
      .times(bundle.ethPriceUSD),
  };

  const transaction = await loadTransaction(event, context);
  context.Burn.set({
    id: `${transaction.id}#${pool.txCount.toString()}`,
    transaction_id: transaction.id,
    timestamp: transaction.timestamp,
    pool_id: pool.id,
    token0_id: pool.token0_id,
    token1_id: pool.token1_id,
    owner: event.params.owner,
    origin: event.transaction.from ?? "",
    amount: event.params.amount,
    amount0,
    amount1,
    amountUSD,
    tickLower: event.params.tickLower,
    tickUpper: event.params.tickUpper,
    logIndex: BigInt(event.logIndex),
  });

  // Tick entities
  const lowerTickId = `${poolId}#${event.params.tickLower.toString()}`;
  const upperTickId = `${poolId}#${event.params.tickUpper.toString()}`;
  let lowerTick = await context.Tick.get(lowerTickId);
  let upperTick = await context.Tick.get(upperTickId);

  if (lowerTick && upperTick) {
    lowerTick = {
      ...lowerTick,
      liquidityGross: lowerTick.liquidityGross - event.params.amount,
      liquidityNet: lowerTick.liquidityNet - event.params.amount,
    };
    upperTick = {
      ...upperTick,
      liquidityGross: upperTick.liquidityGross - event.params.amount,
      liquidityNet: upperTick.liquidityNet + event.params.amount,
    };
    await updateTickFeeVarsAndSave(lowerTick, event, context);
    await updateTickFeeVarsAndSave(upperTick, event, context);
  }

  await updateUniswapDayData(event, context);
  await updatePoolDayData(event, context);
  await updatePoolHourData(event, context);
  await updateTokenDayData(token0, event, context);
  await updateTokenDayData(token1, event, context);
  await updateTokenHourData(token0, event, context);
  await updateTokenHourData(token1, event, context);

  context.Token.set(token0);
  context.Token.set(token1);
  context.Pool.set(pool);
  context.Factory.set(factory);
});

// ============================================================
// Swap (most complex handler)
// ============================================================
Pool.Swap.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const config = getChainConfig(chainId);
  const poolId = `${chainId}-${event.srcAddress.toLowerCase()}`;

  const bundle = await context.Bundle.getOrThrow(`${chainId}-bundle`);
  let factory = await context.Factory.getOrThrow(
    `${chainId}-${config.factoryAddress}`
  );
  let pool = await context.Pool.getOrThrow(poolId);

  // Hot fix for bad pricing
  if (
    pool.id ===
    `${chainId}-0x9663f2ca0454accad3e094448ea6f77443880454`
  ) {
    return;
  }

  let token0 = await context.Token.getOrThrow(pool.token0_id);
  let token1 = await context.Token.getOrThrow(pool.token1_id);

  const oldTick = pool.tick;

  const amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals);
  const amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals);

  let amount0Abs = amount0;
  if (amount0.isLessThan(ZERO_BD)) amount0Abs = amount0.times(new BigDecimal(-1));
  let amount1Abs = amount1;
  if (amount1.isLessThan(ZERO_BD)) amount1Abs = amount1.times(new BigDecimal(-1));

  const amount0ETH = amount0Abs.times(token0.derivedETH);
  const amount1ETH = amount1Abs.times(token1.derivedETH);
  const amount0USD = amount0ETH.times(bundle.ethPriceUSD);
  const amount1USD = amount1ETH.times(bundle.ethPriceUSD);

  const amountTotalUSDTracked = (
    await getTrackedAmountUSD(
      amount0Abs,
      token0,
      amount1Abs,
      token1,
      context,
      chainId
    )
  ).div(new BigDecimal("2"));
  const amountTotalETHTracked = safeDiv(
    amountTotalUSDTracked,
    bundle.ethPriceUSD
  );
  const amountTotalUSDUntracked = amount0USD
    .plus(amount1USD)
    .div(new BigDecimal("2"));

  const feesETH = amountTotalETHTracked
    .times(new BigDecimal(pool.feeTier.toString()))
    .div(new BigDecimal("1000000"));
  const feesUSD = amountTotalUSDTracked
    .times(new BigDecimal(pool.feeTier.toString()))
    .div(new BigDecimal("1000000"));

  // Global updates
  factory = {
    ...factory,
    txCount: factory.txCount + ONE_BI,
    totalVolumeETH: factory.totalVolumeETH.plus(amountTotalETHTracked),
    totalVolumeUSD: factory.totalVolumeUSD.plus(amountTotalUSDTracked),
    untrackedVolumeUSD: factory.untrackedVolumeUSD.plus(
      amountTotalUSDUntracked
    ),
    totalFeesETH: factory.totalFeesETH.plus(feesETH),
    totalFeesUSD: factory.totalFeesUSD.plus(feesUSD),
    totalValueLockedETH: factory.totalValueLockedETH.minus(
      pool.totalValueLockedETH
    ),
  };

  // Pool volume
  pool = {
    ...pool,
    volumeToken0: pool.volumeToken0.plus(amount0Abs),
    volumeToken1: pool.volumeToken1.plus(amount1Abs),
    volumeUSD: pool.volumeUSD.plus(amountTotalUSDTracked),
    untrackedVolumeUSD: pool.untrackedVolumeUSD.plus(amountTotalUSDUntracked),
    feesUSD: pool.feesUSD.plus(feesUSD),
    txCount: pool.txCount + ONE_BI,
    liquidity: event.params.liquidity,
    tick: event.params.tick,
    sqrtPrice: event.params.sqrtPriceX96,
    totalValueLockedToken0: pool.totalValueLockedToken0.plus(amount0),
    totalValueLockedToken1: pool.totalValueLockedToken1.plus(amount1),
  };

  // Token updates
  token0 = {
    ...token0,
    volume: token0.volume.plus(amount0Abs),
    totalValueLocked: token0.totalValueLocked.plus(amount0),
    volumeUSD: token0.volumeUSD.plus(amountTotalUSDTracked),
    untrackedVolumeUSD: token0.untrackedVolumeUSD.plus(
      amountTotalUSDUntracked
    ),
    feesUSD: token0.feesUSD.plus(feesUSD),
    txCount: token0.txCount + ONE_BI,
  };
  token1 = {
    ...token1,
    volume: token1.volume.plus(amount1Abs),
    totalValueLocked: token1.totalValueLocked.plus(amount1),
    volumeUSD: token1.volumeUSD.plus(amountTotalUSDTracked),
    untrackedVolumeUSD: token1.untrackedVolumeUSD.plus(
      amountTotalUSDUntracked
    ),
    feesUSD: token1.feesUSD.plus(feesUSD),
    txCount: token1.txCount + ONE_BI,
  };

  // Update pool prices
  const prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0, token1);
  pool = { ...pool, token0Price: prices[0], token1Price: prices[1] };
  context.Pool.set(pool);

  // Update USD pricing
  const ethPriceUSD = await getEthPriceInUSD(context, chainId);
  context.Bundle.set({ ...bundle, ethPriceUSD });

  token0 = {
    ...token0,
    derivedETH: await findEthPerToken(token0, context, chainId),
  };
  token1 = {
    ...token1,
    derivedETH: await findEthPerToken(token1, context, chainId),
  };

  // Things affected by new USD rates
  const poolTVLETH = pool.totalValueLockedToken0
    .times(token0.derivedETH)
    .plus(pool.totalValueLockedToken1.times(token1.derivedETH));
  pool = {
    ...pool,
    totalValueLockedETH: poolTVLETH,
    totalValueLockedUSD: poolTVLETH.times(ethPriceUSD),
  };

  factory = {
    ...factory,
    totalValueLockedETH: factory.totalValueLockedETH.plus(
      pool.totalValueLockedETH
    ),
    totalValueLockedUSD: factory.totalValueLockedETH
      .plus(pool.totalValueLockedETH)
      .times(ethPriceUSD),
  };

  token0 = {
    ...token0,
    totalValueLockedUSD: token0.totalValueLocked
      .times(token0.derivedETH)
      .times(ethPriceUSD),
  };
  token1 = {
    ...token1,
    totalValueLockedUSD: token1.totalValueLocked
      .times(token1.derivedETH)
      .times(ethPriceUSD),
  };

  // Create Swap entity
  const transaction = await loadTransaction(event, context);
  context.Swap.set({
    id: `${transaction.id}#${pool.txCount.toString()}`,
    transaction_id: transaction.id,
    timestamp: transaction.timestamp,
    pool_id: pool.id,
    token0_id: pool.token0_id,
    token1_id: pool.token1_id,
    sender: event.params.sender,
    origin: event.transaction.from ?? "",
    recipient: event.params.recipient,
    amount0,
    amount1,
    amountUSD: amountTotalUSDTracked,
    tick: event.params.tick,
    sqrtPriceX96: event.params.sqrtPriceX96,
    logIndex: BigInt(event.logIndex),
  });

  // Update fee growth via RPC
  try {
    const feeGrowth = await context.effect(getPoolFeeGrowthGlobal, {
      poolAddress: event.srcAddress,
      chainId,
    });
    pool = {
      ...pool,
      feeGrowthGlobal0X128: BigInt(feeGrowth.feeGrowthGlobal0X128),
      feeGrowthGlobal1X128: BigInt(feeGrowth.feeGrowthGlobal1X128),
    };
  } catch {
    // RPC may be unavailable — keep existing fee growth values
  }

  // Interval data
  let uniswapDayData = await updateUniswapDayData(event, context);
  let poolDayData = await updatePoolDayData(event, context);
  let poolHourData = await updatePoolHourData(event, context);
  let token0DayData = await updateTokenDayData(token0, event, context);
  let token1DayData = await updateTokenDayData(token1, event, context);
  let token0HourData = await updateTokenHourData(token0, event, context);
  let token1HourData = await updateTokenHourData(token1, event, context);

  // Update volume metrics on interval data
  context.UniswapDayData.set({
    ...uniswapDayData,
    volumeETH: uniswapDayData.volumeETH.plus(amountTotalETHTracked),
    volumeUSD: uniswapDayData.volumeUSD.plus(amountTotalUSDTracked),
    feesUSD: uniswapDayData.feesUSD.plus(feesUSD),
  });

  context.PoolDayData.set({
    ...poolDayData,
    volumeUSD: poolDayData.volumeUSD.plus(amountTotalUSDTracked),
    volumeToken0: poolDayData.volumeToken0.plus(amount0Abs),
    volumeToken1: poolDayData.volumeToken1.plus(amount1Abs),
    feesUSD: poolDayData.feesUSD.plus(feesUSD),
  });

  context.PoolHourData.set({
    ...poolHourData,
    volumeUSD: poolHourData.volumeUSD.plus(amountTotalUSDTracked),
    volumeToken0: poolHourData.volumeToken0.plus(amount0Abs),
    volumeToken1: poolHourData.volumeToken1.plus(amount1Abs),
    feesUSD: poolHourData.feesUSD.plus(feesUSD),
  });

  context.TokenDayData.set({
    ...token0DayData,
    volume: token0DayData.volume.plus(amount0Abs),
    volumeUSD: token0DayData.volumeUSD.plus(amountTotalUSDTracked),
    untrackedVolumeUSD: token0DayData.untrackedVolumeUSD.plus(
      amountTotalUSDTracked
    ),
    feesUSD: token0DayData.feesUSD.plus(feesUSD),
  });

  context.TokenHourData.set({
    ...token0HourData,
    volume: token0HourData.volume.plus(amount0Abs),
    volumeUSD: token0HourData.volumeUSD.plus(amountTotalUSDTracked),
    untrackedVolumeUSD: token0HourData.untrackedVolumeUSD.plus(
      amountTotalUSDTracked
    ),
    feesUSD: token0HourData.feesUSD.plus(feesUSD),
  });

  context.TokenDayData.set({
    ...token1DayData,
    volume: token1DayData.volume.plus(amount1Abs),
    volumeUSD: token1DayData.volumeUSD.plus(amountTotalUSDTracked),
    untrackedVolumeUSD: token1DayData.untrackedVolumeUSD.plus(
      amountTotalUSDTracked
    ),
    feesUSD: token1DayData.feesUSD.plus(feesUSD),
  });

  context.TokenHourData.set({
    ...token1HourData,
    volume: token1HourData.volume.plus(amount1Abs),
    volumeUSD: token1HourData.volumeUSD.plus(amountTotalUSDTracked),
    untrackedVolumeUSD: token1HourData.untrackedVolumeUSD.plus(
      amountTotalUSDTracked
    ),
    feesUSD: token1HourData.feesUSD.plus(feesUSD),
  });

  context.Factory.set(factory);
  context.Pool.set(pool);
  context.Token.set(token0);
  context.Token.set(token1);

  // Update inner vars of current or crossed ticks
  const newTick = pool.tick;
  if (newTick !== null && newTick !== undefined) {
    const tickSpacing = feeTierToTickSpacing(pool.feeTier);
    const modulo =
      ((newTick % tickSpacing) + tickSpacing) % tickSpacing;
    if (modulo === 0n) {
      await loadTickUpdateFeeVarsAndSave(
        Number(newTick),
        event,
        context
      );
    }

    if (oldTick !== null && oldTick !== undefined) {
      const numIters =
        (oldTick > newTick ? oldTick - newTick : newTick - oldTick) /
        tickSpacing;

      if (numIters <= 100n) {
        if (newTick > oldTick) {
          const firstInitialized = oldTick + tickSpacing - modulo;
          for (
            let i = firstInitialized;
            i <= newTick;
            i = i + tickSpacing
          ) {
            await loadTickUpdateFeeVarsAndSave(Number(i), event, context);
          }
        } else if (newTick < oldTick) {
          const firstInitialized = oldTick - modulo;
          for (
            let i = firstInitialized;
            i >= newTick;
            i = i - tickSpacing
          ) {
            await loadTickUpdateFeeVarsAndSave(Number(i), event, context);
          }
        }
      }
    }
  }
});

// ============================================================
// Flash
// ============================================================
Pool.Flash.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const poolId = `${chainId}-${event.srcAddress.toLowerCase()}`;
  const pool = await context.Pool.getOrThrow(poolId);

  try {
    const feeGrowth = await context.effect(getPoolFeeGrowthGlobal, {
      poolAddress: event.srcAddress,
      chainId,
    });

    context.Pool.set({
      ...pool,
      feeGrowthGlobal0X128: BigInt(feeGrowth.feeGrowthGlobal0X128),
      feeGrowthGlobal1X128: BigInt(feeGrowth.feeGrowthGlobal1X128),
    });
  } catch {
    // RPC may be unavailable — pool remains unchanged
  }
});

// ============================================================
// Tick helpers
// ============================================================
async function updateTickFeeVarsAndSave(
  tick: any,
  event: any,
  context: any
): Promise<void> {
  context.Tick.set(tick);
  updateTickDayData(tick, event, context);
}

async function loadTickUpdateFeeVarsAndSave(
  tickId: number,
  event: any,
  context: any
): Promise<void> {
  const chainId = event.chainId;
  const poolId = `${chainId}-${event.srcAddress.toLowerCase()}`;
  const id = `${poolId}#${tickId}`;
  const tick = await context.Tick.get(id);
  if (tick) {
    await updateTickFeeVarsAndSave(tick, event, context);
  }
}
