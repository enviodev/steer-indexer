import { BigDecimal, type HandlerContext } from "generated";
import { ZERO_BI, ZERO_BD, ONE_BD, ONE_BI } from "./constants";
import type { Entities } from "../../generated/envio.d.ts";

export function exponentToBigDecimal(decimals: bigint): BigDecimal {
  let bd = new BigDecimal(1);
  for (let i = ZERO_BI; i < decimals; i = i + ONE_BI) {
    bd = bd.times(new BigDecimal(10));
  }
  return bd;
}

export function safeDiv(
  amount0: BigDecimal,
  amount1: BigDecimal
): BigDecimal {
  if (amount1.isEqualTo(ZERO_BD)) {
    return ZERO_BD;
  }
  return amount0.div(amount1);
}

export function bigDecimalExponated(
  value: BigDecimal,
  power: bigint
): BigDecimal {
  if (power === ZERO_BI) {
    return ONE_BD;
  }
  let negativePower = power < ZERO_BI;
  let result = new BigDecimal(0).plus(value);
  let powerAbs = negativePower ? -power : power;
  for (let i = ONE_BI; i < powerAbs; i = i + ONE_BI) {
    result = result.times(value);
  }
  if (negativePower) {
    result = safeDiv(ONE_BD, result);
  }
  return result;
}

export function convertTokenToDecimal(
  tokenAmount: bigint,
  exchangeDecimals: bigint
): BigDecimal {
  if (exchangeDecimals === ZERO_BI) {
    return new BigDecimal(tokenAmount.toString());
  }
  return new BigDecimal(tokenAmount.toString()).div(
    exponentToBigDecimal(exchangeDecimals)
  );
}

export function isNullEthValue(value: string): boolean {
  return (
    value ===
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );
}

export async function loadTransaction(
  event: {
    block: { number: number; timestamp: number };
    transaction: { hash: string; gasPrice: bigint | undefined; from?: string | undefined };
    chainId: number;
  },
  context: HandlerContext
): Promise<Entities["Transaction"]> {
  const id = `${event.chainId}-${event.transaction.hash}`;
  const existing = await context.Transaction.get(id);
  if (existing) {
    return existing;
  }
  const transaction: Entities["Transaction"] = {
    id,
    blockNumber: BigInt(event.block.number),
    timestamp: BigInt(event.block.timestamp),
    gasUsed: 0n,
    gasPrice: event.transaction.gasPrice ?? 0n,
  };
  context.Transaction.set(transaction);
  return transaction;
}
