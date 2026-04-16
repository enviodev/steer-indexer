import { S, createEffect } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { getRpcUrl } from "./rpc";

const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
]);

const ERC20_BYTES_ABI = parseAbi([
  "function name() view returns (bytes32)",
  "function symbol() view returns (bytes32)",
]);

function sanitizeString(s: string): string {
  // Remove null bytes and other control characters that Postgres can't store
  return s.replace(/\0/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function bytes32ToString(bytes: string): string {
  let hex = bytes.startsWith("0x") ? bytes.slice(2) : bytes;
  hex = hex.replace(/00+$/, "");
  let result = "";
  for (let i = 0; i < hex.length; i += 2) {
    result += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return sanitizeString(result);
}

export const getTokenMetadata = createEffect(
  {
    name: "getTokenMetadata",
    input: { address: S.string, chainId: S.number },
    output: {
      name: S.string,
      symbol: S.string,
      decimals: S.nullable(S.number),
      totalSupply: S.string,
    },
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    const client = createPublicClient({
      transport: http(getRpcUrl(input.chainId)),
    });
    const address = input.address as `0x${string}`;

    let symbol = "unknown";
    try {
      symbol = sanitizeString(await client.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }));
    } catch {
      try {
        const bytesResult = await client.readContract({ address, abi: ERC20_BYTES_ABI, functionName: "symbol" });
        symbol = bytes32ToString(bytesResult);
      } catch { /* keep "unknown" */ }
    }

    let name = "unknown";
    try {
      name = sanitizeString(await client.readContract({ address, abi: ERC20_ABI, functionName: "name" }));
    } catch {
      try {
        const bytesResult = await client.readContract({ address, abi: ERC20_BYTES_ABI, functionName: "name" });
        name = bytes32ToString(bytesResult);
      } catch { /* keep "unknown" */ }
    }

    let decimals: number | undefined = undefined;
    try {
      const d = await client.readContract({ address, abi: ERC20_ABI, functionName: "decimals" });
      if (d < 255) decimals = Number(d);
    } catch { /* undefined */ }

    let totalSupply = "0";
    try {
      const ts = await client.readContract({ address, abi: ERC20_ABI, functionName: "totalSupply" });
      totalSupply = ts.toString();
    } catch { /* keep "0" */ }

    return { name, symbol, decimals, totalSupply };
  }
);
