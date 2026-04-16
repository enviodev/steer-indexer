import { S, createEffect } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { getRpcUrl } from "./rpc";

const NPM_ABI = parseAbi([
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
]);

const FACTORY_ABI = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);

export const getPositionData = createEffect(
  {
    name: "getPositionData",
    input: { npmAddress: S.string, tokenId: S.string, chainId: S.number },
    output: S.nullable(
      S.schema({
        token0: S.string,
        token1: S.string,
        fee: S.number,
        tickLower: S.number,
        tickUpper: S.number,
        liquidity: S.string,
        feeGrowthInside0LastX128: S.string,
        feeGrowthInside1LastX128: S.string,
      })
    ),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    const client = createPublicClient({
      transport: http(getRpcUrl(input.chainId)),
    });
    try {
      const result = await client.readContract({
        address: input.npmAddress as `0x${string}`,
        abi: NPM_ABI,
        functionName: "positions",
        args: [BigInt(input.tokenId)],
      });
      return {
        token0: result[2].toLowerCase(),
        token1: result[3].toLowerCase(),
        fee: Number(result[4]),
        tickLower: Number(result[5]),
        tickUpper: Number(result[6]),
        liquidity: result[7].toString(),
        feeGrowthInside0LastX128: result[8].toString(),
        feeGrowthInside1LastX128: result[9].toString(),
      };
    } catch {
      return undefined;
    }
  }
);

export const getPoolAddress = createEffect(
  {
    name: "getPoolAddress",
    input: {
      factoryAddress: S.string,
      token0: S.string,
      token1: S.string,
      fee: S.number,
      chainId: S.number,
    },
    output: S.string,
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    const client = createPublicClient({
      transport: http(getRpcUrl(input.chainId)),
    });
    const result = await client.readContract({
      address: input.factoryAddress as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: "getPool",
      args: [
        input.token0 as `0x${string}`,
        input.token1 as `0x${string}`,
        input.fee,
      ],
    });
    return result.toLowerCase();
  }
);
