import { describe, it, expect } from "vitest";
import { BigDecimal } from "generated";
import {
  exponentToBigDecimal,
  safeDiv,
  bigDecimalExponated,
  convertTokenToDecimal,
  isNullEthValue,
} from "../utils/index";
import { createTick, feeTierToTickSpacing } from "../utils/tick";
import { sqrtPriceX96ToTokenPrices } from "../utils/pricing";
import { ZERO_BD, ZERO_BI, ONE_BD } from "../utils/constants";

describe("exponentToBigDecimal", () => {
  it("returns 1 for 0 decimals", () => {
    const result = exponentToBigDecimal(0n);
    expect(result.isEqualTo(new BigDecimal(1))).toBe(true);
  });

  it("returns 10 for 1 decimal", () => {
    const result = exponentToBigDecimal(1n);
    expect(result.isEqualTo(new BigDecimal(10))).toBe(true);
  });

  it("returns 1e6 for 6 decimals", () => {
    const result = exponentToBigDecimal(6n);
    expect(result.isEqualTo(new BigDecimal(1_000_000))).toBe(true);
  });

  it("returns 1e18 for 18 decimals", () => {
    const result = exponentToBigDecimal(18n);
    expect(result.isEqualTo(new BigDecimal("1000000000000000000"))).toBe(true);
  });
});

describe("safeDiv", () => {
  it("divides normally when denominator is non-zero", () => {
    const result = safeDiv(new BigDecimal(10), new BigDecimal(2));
    expect(result.isEqualTo(new BigDecimal(5))).toBe(true);
  });

  it("returns zero when denominator is zero", () => {
    const result = safeDiv(new BigDecimal(10), ZERO_BD);
    expect(result.isEqualTo(ZERO_BD)).toBe(true);
  });

  it("handles BigDecimal division with precision", () => {
    const result = safeDiv(new BigDecimal(1), new BigDecimal(3));
    expect(result.isGreaterThan(new BigDecimal("0.333"))).toBe(true);
    expect(result.isLessThan(new BigDecimal("0.334"))).toBe(true);
  });
});

describe("bigDecimalExponated", () => {
  it("returns 1 for power of 0", () => {
    const result = bigDecimalExponated(new BigDecimal(5), 0n);
    expect(result.isEqualTo(ONE_BD)).toBe(true);
  });

  it("returns value for power of 1", () => {
    const result = bigDecimalExponated(new BigDecimal(5), 1n);
    expect(result.isEqualTo(new BigDecimal(5))).toBe(true);
  });

  it("squares value for power of 2", () => {
    const result = bigDecimalExponated(new BigDecimal(3), 2n);
    expect(result.isEqualTo(new BigDecimal(9))).toBe(true);
  });

  it("handles negative powers", () => {
    const result = bigDecimalExponated(new BigDecimal(2), -1n);
    expect(result.isEqualTo(new BigDecimal(0.5))).toBe(true);
  });
});

describe("convertTokenToDecimal", () => {
  it("returns raw amount for 0 decimals", () => {
    const result = convertTokenToDecimal(1000n, 0n);
    expect(result.isEqualTo(new BigDecimal(1000))).toBe(true);
  });

  it("converts 18-decimal token correctly", () => {
    const oneEther = 1_000_000_000_000_000_000n;
    const result = convertTokenToDecimal(oneEther, 18n);
    expect(result.isEqualTo(new BigDecimal(1))).toBe(true);
  });

  it("converts 6-decimal token correctly (USDC-style)", () => {
    const oneMillion = 1_000_000n;
    const result = convertTokenToDecimal(oneMillion, 6n);
    expect(result.isEqualTo(new BigDecimal(1))).toBe(true);
  });

  it("handles fractional amounts", () => {
    const half = 500_000_000_000_000_000n;
    const result = convertTokenToDecimal(half, 18n);
    expect(result.isEqualTo(new BigDecimal("0.5"))).toBe(true);
  });
});

describe("isNullEthValue", () => {
  it("returns true for the null eth value", () => {
    expect(
      isNullEthValue(
        "0x0000000000000000000000000000000000000000000000000000000000000001"
      )
    ).toBe(true);
  });

  it("returns false for other values", () => {
    expect(
      isNullEthValue(
        "0x0000000000000000000000000000000000000000000000000000000000000002"
      )
    ).toBe(false);
  });

  it("returns false for the zero address", () => {
    expect(
      isNullEthValue(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      )
    ).toBe(false);
  });
});

describe("feeTierToTickSpacing", () => {
  it("maps 10000 bps (1%) to 200 tick spacing", () => {
    expect(feeTierToTickSpacing(10000n)).toBe(200n);
  });

  it("maps 3000 bps (0.3%) to 60 tick spacing", () => {
    expect(feeTierToTickSpacing(3000n)).toBe(60n);
  });

  it("maps 500 bps (0.05%) to 10 tick spacing", () => {
    expect(feeTierToTickSpacing(500n)).toBe(10n);
  });

  it("maps 100 bps (0.01%) to 1 tick spacing", () => {
    expect(feeTierToTickSpacing(100n)).toBe(1n);
  });

  it("throws for unexpected fee tier", () => {
    expect(() => feeTierToTickSpacing(999n)).toThrow("Unexpected fee tier");
  });
});

describe("createTick", () => {
  it("creates a tick with correct initial values", () => {
    const tick = createTick("pool1#0", 0, "pool1", 1000n, 100n);

    expect(tick.id).toBe("pool1#0");
    expect(tick.tickIdx).toBe(0n);
    expect(tick.pool_id).toBe("pool1");
    expect(tick.poolAddress).toBe("pool1");
    expect(tick.createdAtTimestamp).toBe(1000n);
    expect(tick.createdAtBlockNumber).toBe(100n);
    expect(tick.liquidityGross).toBe(0n);
    expect(tick.liquidityNet).toBe(0n);
    expect(tick.feeGrowthOutside0X128).toBe(0n);
    expect(tick.feeGrowthOutside1X128).toBe(0n);
    expect(tick.volumeToken0.isEqualTo(ZERO_BD)).toBe(true);
    expect(tick.feesUSD.isEqualTo(ZERO_BD)).toBe(true);
  });

  it("calculates price correctly for tick index 0", () => {
    const tick = createTick("pool1#0", 0, "pool1", 1000n, 100n);
    // 1.0001^0 = 1
    expect(tick.price0.isEqualTo(ONE_BD)).toBe(true);
    expect(tick.price1.isEqualTo(ONE_BD)).toBe(true);
  });

  it("calculates price correctly for positive tick index", () => {
    const tick = createTick("pool1#1", 1, "pool1", 1000n, 100n);
    // 1.0001^1 = 1.0001
    expect(tick.price0.isEqualTo(new BigDecimal("1.0001"))).toBe(true);
    // price1 = 1 / 1.0001
    expect(tick.price1.isLessThan(ONE_BD)).toBe(true);
    expect(tick.price1.isGreaterThan(new BigDecimal("0.999"))).toBe(true);
  });
});

describe("sqrtPriceX96ToTokenPrices", () => {
  it("computes prices from sqrtPriceX96 for equal-decimal tokens", () => {
    // sqrtPriceX96 for price=1 is 2^96 = 79228162514264337593543950336
    const sqrtPriceX96 = 79228162514264337593543950336n;
    const token0 = {
      id: "t0",
      decimals: 18n,
      symbol: "T0",
      name: "Token0",
      totalSupply: 0n,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      txCount: 0n,
      poolCount: 0n,
      totalValueLocked: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      derivedETH: ZERO_BD,
      whitelistPools: [] as string[],
    };
    const token1 = { ...token0, id: "t1" };

    const [price0, price1] = sqrtPriceX96ToTokenPrices(
      sqrtPriceX96,
      token0,
      token1
    );
    // When sqrtPriceX96 = 2^96, price1 = 1, price0 = 1
    expect(price1.isGreaterThan(new BigDecimal("0.99"))).toBe(true);
    expect(price1.isLessThan(new BigDecimal("1.01"))).toBe(true);
    expect(price0.isGreaterThan(new BigDecimal("0.99"))).toBe(true);
    expect(price0.isLessThan(new BigDecimal("1.01"))).toBe(true);
  });

  it("handles different decimal tokens (18 vs 6)", () => {
    // For a USDC/WETH pool where USDC has 6 decimals and WETH has 18
    // sqrtPriceX96 = 2^96 but need to account for decimal difference
    const sqrtPriceX96 = 79228162514264337593543950336n;
    const token0 = {
      id: "usdc",
      decimals: 6n,
      symbol: "USDC",
      name: "USDC",
      totalSupply: 0n,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      txCount: 0n,
      poolCount: 0n,
      totalValueLocked: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      derivedETH: ZERO_BD,
      whitelistPools: [] as string[],
    };
    const token1 = { ...token0, id: "weth", decimals: 18n, symbol: "WETH", name: "WETH" };

    const [price0, price1] = sqrtPriceX96ToTokenPrices(
      sqrtPriceX96,
      token0,
      token1
    );
    // With 6 vs 18 decimals, prices should differ by 1e12
    expect(price1.isGreaterThan(ZERO_BD)).toBe(true);
    expect(price0.isGreaterThan(ZERO_BD)).toBe(true);
  });
});
