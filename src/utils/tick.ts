import { bigDecimalExponated, safeDiv } from "./index";
import { BigDecimal } from "generated";
import { ONE_BD, ZERO_BD, ZERO_BI } from "./constants";
import type { Entities } from "../../generated/envio.d.ts";

export function createTick(
  tickId: string,
  tickIdx: number,
  poolId: string,
  blockTimestamp: bigint,
  blockNumber: bigint
): Entities["Tick"] {
  const price0 = bigDecimalExponated(
    new BigDecimal("1.0001"),
    BigInt(tickIdx)
  );

  return {
    id: tickId,
    tickIdx: BigInt(tickIdx),
    pool_id: poolId,
    poolAddress: poolId,
    createdAtTimestamp: blockTimestamp,
    createdAtBlockNumber: blockNumber,
    liquidityGross: ZERO_BI,
    liquidityNet: ZERO_BI,
    liquidityProviderCount: ZERO_BI,
    price0,
    price1: safeDiv(ONE_BD, price0),
    volumeToken0: ZERO_BD,
    volumeToken1: ZERO_BD,
    volumeUSD: ZERO_BD,
    feesUSD: ZERO_BD,
    untrackedVolumeUSD: ZERO_BD,
    collectedFeesToken0: ZERO_BD,
    collectedFeesToken1: ZERO_BD,
    collectedFeesUSD: ZERO_BD,
    feeGrowthOutside0X128: ZERO_BI,
    feeGrowthOutside1X128: ZERO_BI,
  };
}

export function feeTierToTickSpacing(feeTier: bigint): bigint {
  if (feeTier === 10000n) return 200n;
  if (feeTier === 3000n) return 60n;
  if (feeTier === 500n) return 10n;
  if (feeTier === 100n) return 1n;
  throw Error("Unexpected fee tier");
}
