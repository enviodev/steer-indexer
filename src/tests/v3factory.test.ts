import { describe, it, expect } from "vitest";
import { createTestIndexer, BigDecimal } from "generated";
import { TestHelpers } from "envio";

const { Addresses } = TestHelpers;

// Import handlers to register them
import "../handlers/V3Factory";
import "../handlers/Pool";
import "../handlers/NonfungiblePositionManager";
import "../handlers/VaultFactory";
import "../handlers/VaultERC20";

const CHAIN_ID = 42161;

const token0Addr = Addresses.mockAddresses[0]!.toLowerCase() as `0x${string}`;
const token1Addr = Addresses.mockAddresses[1]!.toLowerCase() as `0x${string}`;
const poolAddr = Addresses.mockAddresses[2]!.toLowerCase() as `0x${string}`;
const factoryAddr = "0x0000000000000000000000000000000000000000"; // default chainConfig factory for non-Filecoin

const ZERO_BD = new BigDecimal(0);

function presetTokens(indexer: ReturnType<typeof createTestIndexer>) {
  indexer.Token.set({
    id: `${CHAIN_ID}-${token0Addr.toLowerCase()}`,
    symbol: "TKN0",
    name: "Token Zero",
    decimals: 18n,
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
    whitelistPools: [],
  });
  indexer.Token.set({
    id: `${CHAIN_ID}-${token1Addr.toLowerCase()}`,
    symbol: "TKN1",
    name: "Token One",
    decimals: 18n,
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
    whitelistPools: [],
  });
}

describe("V3Factory.PoolCreated", () => {
  it("should create Factory, Bundle, Token0, Token1, and Pool entities", async (t) => {
    const indexer = createTestIndexer();
    presetTokens(indexer);

    const result = await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "V3Factory",
              event: "PoolCreated",
              params: {
                token0: token0Addr,
                token1: token1Addr,
                fee: 3000n,
                tickSpacing: 60n,
                pool: poolAddr,
              },
            },
          ],
        },
      },
    });

    // Should have processed 1 event
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes[0]!.eventsProcessed).toBe(1);

    // Factory should be created
    const factory = await indexer.Factory.get(`${CHAIN_ID}-${factoryAddr}`);
    expect(factory).toBeDefined();
    expect(factory!.poolCount).toBe(1n);
    expect(factory!.txCount).toBe(0n);
    expect(factory!.totalVolumeUSD.isEqualTo(new BigDecimal(0))).toBe(true);
    expect(factory!.owner).toBe(
      "0x0000000000000000000000000000000000000000"
    );

    // Bundle should be created
    const bundle = await indexer.Bundle.get(`${CHAIN_ID}-bundle`);
    expect(bundle).toBeDefined();
    expect(bundle!.ethPriceUSD.isEqualTo(new BigDecimal(0))).toBe(true);

    // Pool should be created with correct references
    const pool = await indexer.Pool.get(
      `${CHAIN_ID}-${poolAddr.toLowerCase()}`
    );
    expect(pool).toBeDefined();
    expect(pool!.token0_id).toBe(`${CHAIN_ID}-${token0Addr.toLowerCase()}`);
    expect(pool!.token1_id).toBe(`${CHAIN_ID}-${token1Addr.toLowerCase()}`);
    expect(pool!.feeTier).toBe(3000n);
    expect(pool!.liquidity).toBe(0n);
    expect(pool!.sqrtPrice).toBe(0n);
    expect(pool!.txCount).toBe(0n);
    expect(pool!.totalValueLockedUSD.isEqualTo(new BigDecimal(0))).toBe(true);

    // Tokens should be created
    const token0 = await indexer.Token.get(
      `${CHAIN_ID}-${token0Addr.toLowerCase()}`
    );
    expect(token0).toBeDefined();
    expect(token0!.volume.isEqualTo(new BigDecimal(0))).toBe(true);
    expect(token0!.txCount).toBe(0n);
    expect(token0!.poolCount).toBe(0n);
    expect(token0!.derivedETH.isEqualTo(new BigDecimal(0))).toBe(true);

    const token1 = await indexer.Token.get(
      `${CHAIN_ID}-${token1Addr.toLowerCase()}`
    );
    expect(token1).toBeDefined();
  });

  it("should increment poolCount on subsequent PoolCreated events", async (t) => {
    const indexer = createTestIndexer();
    presetTokens(indexer);

    const pool2Addr = Addresses.mockAddresses[3]!;
    const token2Addr = Addresses.mockAddresses[4]!;

    // Also preset token2
    indexer.Token.set({
      id: `${CHAIN_ID}-${token2Addr.toLowerCase()}`,
      symbol: "TKN2",
      name: "Token Two",
      decimals: 18n,
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
      whitelistPools: [],
    });

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "V3Factory",
              event: "PoolCreated",
              params: {
                token0: token0Addr,
                token1: token1Addr,
                fee: 3000n,
                tickSpacing: 60n,
                pool: poolAddr,
              },
            },
            {
              contract: "V3Factory",
              event: "PoolCreated",
              params: {
                token0: token0Addr,
                token1: token2Addr,
                fee: 500n,
                tickSpacing: 10n,
                pool: pool2Addr,
              },
            },
          ],
        },
      },
    });

    const factory = await indexer.Factory.get(`${CHAIN_ID}-${factoryAddr}`);
    expect(factory).toBeDefined();
    expect(factory!.poolCount).toBe(2n);

    // Both pools should exist
    const p1 = await indexer.Pool.get(
      `${CHAIN_ID}-${poolAddr.toLowerCase()}`
    );
    const p2 = await indexer.Pool.get(
      `${CHAIN_ID}-${pool2Addr.toLowerCase()}`
    );
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    expect(p2!.feeTier).toBe(500n);
  });

  it("should skip excluded pool address", async (t) => {
    const indexer = createTestIndexer();

    const excludedPool = "0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248";

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "V3Factory",
              event: "PoolCreated",
              params: {
                token0: token0Addr,
                token1: token1Addr,
                fee: 3000n,
                tickSpacing: 60n,
                pool: excludedPool as `0x${string}`,
              },
            },
          ],
        },
      },
    });

    // Factory should not be created since the only event was skipped
    const factory = await indexer.Factory.get(`${CHAIN_ID}-${factoryAddr}`);
    expect(factory).toBeUndefined();
  });

  it("should reuse existing tokens when creating a new pool with known tokens", async (t) => {
    const indexer = createTestIndexer();
    presetTokens(indexer);

    const pool2Addr = Addresses.mockAddresses[5]!;

    // Create both pools in a single process call
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "V3Factory",
              event: "PoolCreated",
              params: {
                token0: token0Addr,
                token1: token1Addr,
                fee: 3000n,
                tickSpacing: 60n,
                pool: poolAddr,
              },
            },
            {
              contract: "V3Factory",
              event: "PoolCreated",
              params: {
                token0: token0Addr,
                token1: token1Addr,
                fee: 500n,
                tickSpacing: 10n,
                pool: pool2Addr,
              },
            },
          ],
        },
      },
    });

    // Should still only have 2 token entities (not 4)
    const allTokens = await indexer.Token.getAll();
    expect(allTokens.length).toBe(2);

    // Factory should have 2 pools
    const factory = await indexer.Factory.get(`${CHAIN_ID}-${factoryAddr}`);
    expect(factory!.poolCount).toBe(2n);
  });

  it("should register Pool as dynamic contract via contractRegister", async (t) => {
    const indexer = createTestIndexer();

    const result = await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "V3Factory",
              event: "PoolCreated",
              params: {
                token0: token0Addr,
                token1: token1Addr,
                fee: 3000n,
                tickSpacing: 60n,
                pool: poolAddr,
              },
            },
          ],
        },
      },
    });

    // The dynamic contract registration should appear in address changes
    const change = result.changes[0]!;
    if (change.addresses?.sets) {
      const registeredAddresses = change.addresses.sets.map(
        (r) => r.address
      );
      expect(
        registeredAddresses.some(
          (a) => a.toLowerCase() === poolAddr.toLowerCase()
        )
      ).toBe(true);
    }
  });
});
