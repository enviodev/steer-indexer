import { VaultERC20, BigDecimal } from "generated";
import { getTokenMetadata } from "../effects/tokenMetadata";

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

function toDecimals(value: bigint, decimals: number): BigDecimal {
  if (decimals === 0) return new BigDecimal(value.toString());
  const divisor = new BigDecimal(10).pow(decimals);
  return new BigDecimal(value.toString()).div(divisor);
}

VaultERC20.VaultTransfer.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const contractAddress = event.srcAddress.toLowerCase();
  const contractId = `${chainId}-${contractAddress}`;
  const fromAddr = event.params.from.toLowerCase();
  const toAddr = event.params.to.toLowerCase();

  // Get or create ERC20Contract
  let contract = await context.ERC20Contract.get(contractId);
  if (!contract) {
    // Fetch metadata via effect (may fail if RPC unavailable)
    let metadata = { name: "unknown", symbol: "unknown", decimals: 18, totalSupply: "0" };
    try {
      const result = await context.effect(getTokenMetadata, {
        address: contractAddress,
        chainId,
      });
      metadata = { ...metadata, ...result, decimals: result.decimals ?? 18 };
    } catch {
      // Use defaults if RPC unavailable
    }

    // Create account for the contract
    const accountId = `${chainId}-${contractAddress}`;
    const account = await context.VaultAccount.getOrCreate({
      id: accountId,
      asERC20_id: contractId,
    });

    // Create totalSupply balance
    const totalSupplyId = `${contractId}/totalSupply`;
    context.ERC20Balance.set({
      id: totalSupplyId,
      contract_id: contractId,
      account_id: undefined,
      value: new BigDecimal(0),
      valueExact: 0n,
    });

    contract = {
      id: contractId,
      asAccount_id: accountId,
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals ?? 18,
      totalSupply_id: totalSupplyId,
    };
    context.ERC20Contract.set(contract);
  }

  const decimals = contract.decimals;

  // Handle mint (from zero address)
  if (fromAddr === ADDRESS_ZERO) {
    const totalSupplyId = `${contractId}/totalSupply`;
    const totalSupply = await context.ERC20Balance.getOrThrow(totalSupplyId);
    const newExact = totalSupply.valueExact + event.params.value;
    context.ERC20Balance.set({
      ...totalSupply,
      valueExact: newExact,
      value: toDecimals(newExact, decimals),
    });
  } else {
    // Update sender balance
    const fromAccountId = `${chainId}-${fromAddr}`;
    let fromAccount = await context.VaultAccount.get(fromAccountId);
    if (!fromAccount) {
      fromAccount = { id: fromAccountId, asERC20_id: undefined };
      context.VaultAccount.set(fromAccount);
    }

    const fromBalanceId = `${contractId}/${fromAddr}`;
    let fromBalance = await context.ERC20Balance.get(fromBalanceId);
    if (!fromBalance) {
      fromBalance = {
        id: fromBalanceId,
        contract_id: contractId,
        account_id: fromAccountId,
        value: new BigDecimal(0),
        valueExact: 0n,
      };
    }

    const newFromExact = fromBalance.valueExact - event.params.value;
    context.ERC20Balance.set({
      ...fromBalance,
      valueExact: newFromExact,
      value: toDecimals(newFromExact, decimals),
    });
  }

  // Handle burn (to zero address)
  if (toAddr === ADDRESS_ZERO) {
    const totalSupplyId = `${contractId}/totalSupply`;
    const totalSupply = await context.ERC20Balance.getOrThrow(totalSupplyId);
    const newExact = totalSupply.valueExact - event.params.value;
    context.ERC20Balance.set({
      ...totalSupply,
      valueExact: newExact,
      value: toDecimals(newExact, decimals),
    });
  } else {
    // Update receiver balance
    const toAccountId = `${chainId}-${toAddr}`;
    let toAccount = await context.VaultAccount.get(toAccountId);
    if (!toAccount) {
      toAccount = { id: toAccountId, asERC20_id: undefined };
      context.VaultAccount.set(toAccount);
    }

    const toBalanceId = `${contractId}/${toAddr}`;
    let toBalance = await context.ERC20Balance.get(toBalanceId);
    if (!toBalance) {
      toBalance = {
        id: toBalanceId,
        contract_id: contractId,
        account_id: toAccountId,
        value: new BigDecimal(0),
        valueExact: 0n,
      };
    }

    const newToExact = toBalance.valueExact + event.params.value;
    context.ERC20Balance.set({
      ...toBalance,
      valueExact: newToExact,
      value: toDecimals(newToExact, decimals),
    });
  }

  // Create transfer record
  const transferId = `${chainId}-${event.transaction.hash}-${event.logIndex}`;
  const emitterId = `${chainId}-${contractAddress}`;

  context.ERC20Transfer.set({
    id: transferId,
    emitter_id: emitterId,
    transactionHash: event.transaction.hash,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    contract_id: contractId,
    from_id:
      fromAddr === ADDRESS_ZERO
        ? undefined
        : `${chainId}-${fromAddr}`,
    fromBalance_id:
      fromAddr === ADDRESS_ZERO
        ? undefined
        : `${contractId}/${fromAddr}`,
    to_id:
      toAddr === ADDRESS_ZERO
        ? undefined
        : `${chainId}-${toAddr}`,
    toBalance_id:
      toAddr === ADDRESS_ZERO
        ? undefined
        : `${contractId}/${toAddr}`,
    value: toDecimals(event.params.value, decimals),
    valueExact: event.params.value,
  });
});
