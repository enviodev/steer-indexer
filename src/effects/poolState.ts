import { S, createEffect } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { getRpcUrl } from "./rpc";

const POOL_ABI = parseAbi([
  "function feeGrowthGlobal0X128() view returns (uint256)",
  "function feeGrowthGlobal1X128() view returns (uint256)",
  "function ticks(int24) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)",
]);

export const getPoolFeeGrowthGlobal = createEffect(
  {
    name: "getPoolFeeGrowthGlobal",
    input: { poolAddress: S.string, chainId: S.number },
    output: {
      feeGrowthGlobal0X128: S.string,
      feeGrowthGlobal1X128: S.string,
    },
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      const client = createPublicClient({
        transport: http(getRpcUrl(input.chainId)),
      });
      const address = input.poolAddress as `0x${string}`;

      const [fg0, fg1] = await Promise.all([
        client.readContract({ address, abi: POOL_ABI, functionName: "feeGrowthGlobal0X128" }),
        client.readContract({ address, abi: POOL_ABI, functionName: "feeGrowthGlobal1X128" }),
      ]);

      return {
        feeGrowthGlobal0X128: fg0.toString(),
        feeGrowthGlobal1X128: fg1.toString(),
      };
    } catch {
      return {
        feeGrowthGlobal0X128: "0",
        feeGrowthGlobal1X128: "0",
      };
    }
  }
);

export const getPoolTickData = createEffect(
  {
    name: "getPoolTickData",
    input: { poolAddress: S.string, tickIdx: S.number, chainId: S.number },
    output: {
      feeGrowthOutside0X128: S.string,
      feeGrowthOutside1X128: S.string,
    },
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      const client = createPublicClient({
        transport: http(getRpcUrl(input.chainId)),
      });
      const address = input.poolAddress as `0x${string}`;

      const result = await client.readContract({
        address,
        abi: POOL_ABI,
        functionName: "ticks",
        args: [input.tickIdx],
      });

      return {
        feeGrowthOutside0X128: result[2].toString(),
        feeGrowthOutside1X128: result[3].toString(),
      };
    } catch {
      // Return zeros if RPC call fails (e.g., in test mode)
      return {
        feeGrowthOutside0X128: "0",
        feeGrowthOutside1X128: "0",
      };
    }
  }
);
