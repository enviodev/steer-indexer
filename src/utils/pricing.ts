import { BigDecimal, type HandlerContext } from "generated";
import { ZERO_BD, ZERO_BI, ONE_BD } from "./constants";
import { exponentToBigDecimal, safeDiv } from "./index";
import { getChainConfig } from "./chainConfig";
import type { Entities } from "../../generated/envio.d.ts";

const Q192 = 2n ** 192n;

export function sqrtPriceX96ToTokenPrices(
  sqrtPriceX96: bigint,
  token0: Entities["Token"],
  token1: Entities["Token"]
): [BigDecimal, BigDecimal] {
  const num = new BigDecimal((sqrtPriceX96 * sqrtPriceX96).toString());
  const denom = new BigDecimal(Q192.toString());
  const price1 = num
    .div(denom)
    .times(exponentToBigDecimal(token0.decimals))
    .div(exponentToBigDecimal(token1.decimals));
  const price0 = safeDiv(new BigDecimal("1"), price1);
  return [price0, price1];
}

export async function getEthPriceInUSD(
  context: HandlerContext,
  chainId: number
): Promise<BigDecimal> {
  const config = getChainConfig(chainId);
  const poolId = `${chainId}-${config.usdcWethPool}`;
  const usdcPool = await context.Pool.get(poolId);
  if (usdcPool) {
    return usdcPool.token0Price;
  }
  return ZERO_BD;
}

export async function findEthPerToken(
  token: Entities["Token"],
  context: HandlerContext,
  chainId: number
): Promise<BigDecimal> {
  const config = getChainConfig(chainId);
  const wethId = `${chainId}-${config.wethAddress}`;
  if (token.id === wethId) {
    return ONE_BD;
  }

  const whiteList = token.whitelistPools;
  let largestLiquidityETH = ZERO_BD;
  let priceSoFar = ZERO_BD;
  const bundle = await context.Bundle.get(`${chainId}-bundle`);
  if (!bundle) return ZERO_BD;

  // Strip chainId prefix from token.id to get raw address for stablecoin check
  const parts = token.id.split("-");
  const tokenAddress = (parts.length > 1 ? parts[1] : token.id) as string;
  if (config.stableCoins.includes(tokenAddress)) {
    priceSoFar = safeDiv(ONE_BD, bundle.ethPriceUSD);
  } else {
    for (let i = 0; i < whiteList.length; i++) {
      const poolId = whiteList[i]!;
      const pool = await context.Pool.get(poolId);
      if (!pool) continue;
      if (pool.liquidity <= ZERO_BI) continue;

      if (pool.token0_id === token.id) {
        const token1 = await context.Token.get(pool.token1_id);
        if (token1) {
          const ethLocked = pool.totalValueLockedToken1.times(
            token1.derivedETH
          );
          if (
            ethLocked.isGreaterThan(largestLiquidityETH) &&
            ethLocked.isGreaterThan(config.minimumEthLocked)
          ) {
            largestLiquidityETH = ethLocked;
            priceSoFar = pool.token1Price.times(token1.derivedETH);
          }
        }
      }

      if (pool.token1_id === token.id) {
        const token0 = await context.Token.get(pool.token0_id);
        if (token0) {
          const ethLocked = pool.totalValueLockedToken0.times(
            token0.derivedETH
          );
          if (
            ethLocked.isGreaterThan(largestLiquidityETH) &&
            ethLocked.isGreaterThan(config.minimumEthLocked)
          ) {
            largestLiquidityETH = ethLocked;
            priceSoFar = pool.token0Price.times(token0.derivedETH);
          }
        }
      }
    }
  }

  return priceSoFar;
}

export async function getTrackedAmountUSD(
  tokenAmount0: BigDecimal,
  token0: Entities["Token"],
  tokenAmount1: BigDecimal,
  token1: Entities["Token"],
  context: HandlerContext,
  chainId: number
): Promise<BigDecimal> {
  const config = getChainConfig(chainId);
  const bundle = await context.Bundle.get(`${chainId}-bundle`);
  if (!bundle) return ZERO_BD;

  const price0USD = token0.derivedETH.times(bundle.ethPriceUSD);
  const price1USD = token1.derivedETH.times(bundle.ethPriceUSD);

  const token0Parts = token0.id.split("-");
  const token0Address = (token0Parts.length > 1 ? token0Parts[1] : token0.id) as string;
  const token1Parts = token1.id.split("-");
  const token1Address = (token1Parts.length > 1 ? token1Parts[1] : token1.id) as string;

  const token0InWhitelist = config.whitelistTokens.includes(token0Address);
  const token1InWhitelist = config.whitelistTokens.includes(token1Address);

  if (token0InWhitelist && token1InWhitelist) {
    return tokenAmount0
      .times(price0USD)
      .plus(tokenAmount1.times(price1USD));
  }

  if (token0InWhitelist && !token1InWhitelist) {
    return tokenAmount0.times(price0USD).times(new BigDecimal("2"));
  }

  if (!token0InWhitelist && token1InWhitelist) {
    return tokenAmount1.times(price1USD).times(new BigDecimal("2"));
  }

  return ZERO_BD;
}
