// dRPC network name mapping for all supported chains
const DRPC_NETWORKS: Record<number, string> = {
  1: "ethereum",
  10: "optimism",
  14: "flare",
  30: "rootstock",
  56: "bsc",
  130: "unichain",
  137: "polygon",
  146: "sonic",
  169: "manta",
  250: "fantom",
  999: "hyperliquid",
  1101: "polygon-zkevm",
  1284: "moonbeam",
  1329: "sei",
  1868: "soneium",
  5000: "mantle",
  7000: "zetachain",
  8453: "base",
  34443: "mode",
  42161: "arbitrum",
  42220: "celo",
  43114: "avalanche",
  48900: "zircuit",
  59144: "linea",
  80094: "berachain",
  81457: "blast",
  534352: "scroll",
};

export function getRpcUrl(chainId: number): string {
  // Check for per-chain env var first
  const envKey = `ENVIO_RPC_URL_${chainId}`;
  const url = process.env[envKey];
  if (url) return url;

  // Check for a generic dRPC key
  const drpcKey = process.env.ENVIO_DRPC_KEY;
  const network = DRPC_NETWORKS[chainId];
  if (drpcKey && network) {
    return `https://lb.drpc.org/ogrpc?network=${network}&dkey=${drpcKey}`;
  }

  throw new Error(
    `No RPC URL for chain ${chainId}. Set ENVIO_RPC_URL_${chainId} or ENVIO_DRPC_KEY.`
  );
}
