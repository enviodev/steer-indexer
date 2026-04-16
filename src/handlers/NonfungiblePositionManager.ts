import { NonfungiblePositionManager, type HandlerContext } from "generated";
import { ADDRESS_ZERO, ZERO_BD, ZERO_BI } from "../utils/constants";
import { convertTokenToDecimal, loadTransaction } from "../utils/index";
import { getChainConfig } from "../utils/chainConfig";
import {
  getPositionData,
  getPoolAddress,
} from "../effects/positionManager";
import type { Entities } from "../../generated/envio.d.ts";

async function getPosition(
  event: {
    srcAddress: string;
    chainId: number;
    block: { number: number; timestamp: number };
    transaction: { hash: string; gasPrice: bigint | undefined; from: string | undefined };
  },
  tokenId: bigint,
  context: HandlerContext
): Promise<Entities["Position"] | null> {
  const chainId = event.chainId;
  const positionId = `${chainId}-${tokenId.toString()}`;
  let position = await context.Position.get(positionId);

  if (!position) {
    const positionResultRaw = await context.effect(getPositionData, {
      npmAddress: event.srcAddress,
      tokenId: tokenId.toString(),
      chainId,
    });

    const positionResult = positionResultRaw as {
      token0: string; token1: string; fee: number;
      tickLower: number; tickUpper: number; liquidity: string;
      feeGrowthInside0LastX128: string; feeGrowthInside1LastX128: string;
    } | undefined;

    if (!positionResult) return null;

    const config = getChainConfig(chainId);
    const poolAddr = await context.effect(getPoolAddress, {
      factoryAddress: config.factoryAddress,
      token0: positionResult.token0,
      token1: positionResult.token1,
      fee: positionResult.fee,
      chainId,
    });

    const poolId = `${chainId}-${poolAddr.toLowerCase()}`;
    const token0Id = `${chainId}-${positionResult.token0.toLowerCase()}`;
    const token1Id = `${chainId}-${positionResult.token1.toLowerCase()}`;

    const transaction = await loadTransaction(event, context);

    position = {
      id: positionId,
      owner: ADDRESS_ZERO,
      pool_id: poolId,
      token0_id: token0Id,
      token1_id: token1Id,
      tickLower_id: `${poolId}#${positionResult.tickLower}`,
      tickUpper_id: `${poolId}#${positionResult.tickUpper}`,
      liquidity: ZERO_BI,
      depositedToken0: ZERO_BD,
      depositedToken1: ZERO_BD,
      withdrawnToken0: ZERO_BD,
      withdrawnToken1: ZERO_BD,
      collectedToken0: ZERO_BD,
      collectedToken1: ZERO_BD,
      collectedFeesToken0: ZERO_BD,
      collectedFeesToken1: ZERO_BD,
      transaction_id: transaction.id,
      feeGrowthInside0LastX128: BigInt(
        positionResult.feeGrowthInside0LastX128
      ),
      feeGrowthInside1LastX128: BigInt(
        positionResult.feeGrowthInside1LastX128
      ),
      amountDepositedUSD: ZERO_BD,
      amountWithdrawnUSD: ZERO_BD,
      amountCollectedUSD: ZERO_BD,
    };
  }

  return position;
}

async function updateFeeVars(
  position: Entities["Position"],
  event: { srcAddress: string; chainId: number },
  tokenId: bigint,
  context: HandlerContext
): Promise<Entities["Position"]> {
  const positionResultRaw = await context.effect(getPositionData, {
    npmAddress: event.srcAddress,
    tokenId: tokenId.toString(),
    chainId: event.chainId,
  });

  const posResult = positionResultRaw as {
    feeGrowthInside0LastX128: string; feeGrowthInside1LastX128: string;
  } | undefined;

  if (posResult) {
    return {
      ...position,
      feeGrowthInside0LastX128: BigInt(posResult.feeGrowthInside0LastX128),
      feeGrowthInside1LastX128: BigInt(posResult.feeGrowthInside1LastX128),
    };
  }
  return position;
}

function savePositionSnapshot(
  position: Entities["Position"],
  event: {
    block: { number: number; timestamp: number };
    transaction: { hash: string; gasPrice: bigint | undefined };
    chainId: number;
  },
  context: HandlerContext
): void {
  const snapshotId = `${position.id}#${event.block.number}`;
  const transactionId = `${event.chainId}-${event.transaction.hash}`;

  context.PositionSnapshot.set({
    id: snapshotId,
    owner: position.owner,
    pool_id: position.pool_id,
    position_id: position.id,
    blockNumber: BigInt(event.block.number),
    timestamp: BigInt(event.block.timestamp),
    liquidity: position.liquidity,
    depositedToken0: position.depositedToken0,
    depositedToken1: position.depositedToken1,
    withdrawnToken0: position.withdrawnToken0,
    withdrawnToken1: position.withdrawnToken1,
    collectedFeesToken0: position.collectedFeesToken0,
    collectedFeesToken1: position.collectedFeesToken1,
    transaction_id: transactionId,
    feeGrowthInside0LastX128: position.feeGrowthInside0LastX128,
    feeGrowthInside1LastX128: position.feeGrowthInside1LastX128,
  });
}

// ============================================================
// IncreaseLiquidity
// ============================================================
NonfungiblePositionManager.IncreaseLiquidity.handler(
  async ({ event, context }) => {
    let position = await getPosition(
      event,
      event.params.tokenId,
      context
    );
    if (!position) return;

    // Skip excluded pool
    if (
      position.pool_id.includes(
        "0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248"
      )
    ) {
      return;
    }

    const chainId = event.chainId;
    const bundle = await context.Bundle.getOrThrow(`${chainId}-bundle`);
    const token0 = await context.Token.get(position.token0_id);
    const token1 = await context.Token.get(position.token1_id);

    if (token0 && token1) {
      const amount0 = convertTokenToDecimal(
        event.params.amount0,
        token0.decimals
      );
      const amount1 = convertTokenToDecimal(
        event.params.amount1,
        token1.decimals
      );

      const newDepositUSD = amount0
        .times(token0.derivedETH.times(bundle.ethPriceUSD))
        .plus(amount1.times(token1.derivedETH.times(bundle.ethPriceUSD)));

      position = {
        ...position,
        liquidity: position.liquidity + event.params.liquidity,
        depositedToken0: position.depositedToken0.plus(amount0),
        depositedToken1: position.depositedToken1.plus(amount1),
        amountDepositedUSD: position.amountDepositedUSD.plus(newDepositUSD),
      };

      position = await updateFeeVars(
        position,
        event,
        event.params.tokenId,
        context
      );

      context.Position.set(position);
      savePositionSnapshot(position, event, context);
    }
  }
);

// ============================================================
// DecreaseLiquidity
// ============================================================
NonfungiblePositionManager.DecreaseLiquidity.handler(
  async ({ event, context }) => {
    let position = await getPosition(
      event,
      event.params.tokenId,
      context
    );
    if (!position) return;

    if (
      position.pool_id.includes(
        "0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248"
      )
    ) {
      return;
    }

    const chainId = event.chainId;
    const bundle = await context.Bundle.getOrThrow(`${chainId}-bundle`);
    const token0 = await context.Token.get(position.token0_id);
    const token1 = await context.Token.get(position.token1_id);

    if (token0 && token1) {
      const amount0 = convertTokenToDecimal(
        event.params.amount0,
        token0.decimals
      );
      const amount1 = convertTokenToDecimal(
        event.params.amount1,
        token1.decimals
      );

      const newWithdrawUSD = amount0
        .times(token0.derivedETH.times(bundle.ethPriceUSD))
        .plus(amount1.times(token1.derivedETH.times(bundle.ethPriceUSD)));

      position = {
        ...position,
        liquidity: position.liquidity - event.params.liquidity,
        withdrawnToken0: position.withdrawnToken0.plus(amount0),
        withdrawnToken1: position.withdrawnToken1.plus(amount1),
        amountWithdrawnUSD: position.amountWithdrawnUSD.plus(newWithdrawUSD),
      };

      position = await updateFeeVars(
        position,
        event,
        event.params.tokenId,
        context
      );

      context.Position.set(position);
      savePositionSnapshot(position, event, context);
    }
  }
);

// ============================================================
// NFTCollect
// ============================================================
NonfungiblePositionManager.NFTCollect.handler(
  async ({ event, context }) => {
    let position = await getPosition(
      event,
      event.params.tokenId,
      context
    );
    if (!position) return;

    if (
      position.pool_id.includes(
        "0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248"
      )
    ) {
      return;
    }

    const chainId = event.chainId;
    const bundle = await context.Bundle.getOrThrow(`${chainId}-bundle`);
    const token0 = await context.Token.get(position.token0_id);
    const token1 = await context.Token.get(position.token1_id);

    if (token0 && token1) {
      const amount0 = convertTokenToDecimal(
        event.params.amount0,
        token0.decimals
      );
      const amount1 = convertTokenToDecimal(
        event.params.amount1,
        token1.decimals
      );

      const collectedToken0 = position.collectedToken0.plus(amount0);
      const collectedToken1 = position.collectedToken1.plus(amount1);

      const newCollectUSD = amount0
        .times(token0.derivedETH.times(bundle.ethPriceUSD))
        .plus(amount1.times(token1.derivedETH.times(bundle.ethPriceUSD)));

      position = {
        ...position,
        collectedToken0,
        collectedToken1,
        collectedFeesToken0: collectedToken0.minus(position.withdrawnToken0),
        collectedFeesToken1: collectedToken1.minus(position.withdrawnToken1),
        amountCollectedUSD: position.amountCollectedUSD.plus(newCollectUSD),
      };

      position = await updateFeeVars(
        position,
        event,
        event.params.tokenId,
        context
      );

      context.Position.set(position);
      savePositionSnapshot(position, event, context);
    }
  }
);

// ============================================================
// NFTTransfer
// ============================================================
NonfungiblePositionManager.NFTTransfer.handler(
  async ({ event, context }) => {
    let position = await getPosition(
      event,
      event.params.tokenId,
      context
    );
    if (!position) return;

    position = { ...position, owner: event.params.to };
    context.Position.set(position);
    savePositionSnapshot(position, event, context);
  }
);
