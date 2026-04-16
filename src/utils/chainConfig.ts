import { BigDecimal } from "generated";

export interface ChainConfig {
  factoryAddress: string;
  wethAddress: string;
  usdcWethPool: string;
  whitelistTokens: string[];
  stableCoins: string[];
  minimumEthLocked: BigDecimal;
}

// Steer VaultFactory/Registry address — same on all chains
export const VAULT_FACTORY_ADDRESS =
  "0x9f5b097ad23e2cf4f34e502a3e41d941678877dc";

// V3 Factory configs per chain (only used by Uniswap V3 handlers)
const configs: Record<number, ChainConfig> = {
  314: {
    // Filecoin
    factoryAddress: "0xb4c47ed546fc31e26470a186ec2c5f19ef09ba41",
    wethAddress: "0x60e1773636cf5e4a227d9ac24f20feca034ee25a",
    usdcWethPool: "0x41d81e6f66590fb6f3315a4a622dc5570c2b91c1",
    whitelistTokens: [
      "0x60e1773636cf5e4a227d9ac24f20feca034ee25a",
      "0x522b61755b5ff8176b2931da7bf1a5f9414eb710",
      "0x2421db204968a367cc2c866cd057fa754cb84edf",
      "0xeb466342c4d449bc9f53a865d5cb90586f405215",
    ],
    stableCoins: ["0x2421db204968a367cc2c866cd057fa754cb84edf"],
    minimumEthLocked: new BigDecimal("5"),
  },
};

// Default config for chains without specific V3 pricing setup
const defaultConfig: ChainConfig = {
  factoryAddress: "0x0000000000000000000000000000000000000000",
  wethAddress: "0x0000000000000000000000000000000000000000",
  usdcWethPool: "0x0000000000000000000000000000000000000000",
  whitelistTokens: [],
  stableCoins: [],
  minimumEthLocked: new BigDecimal("5"),
};

export function getChainConfig(chainId: number): ChainConfig {
  return configs[chainId] ?? defaultConfig;
}
