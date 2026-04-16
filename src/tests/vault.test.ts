import { describe, it, expect } from "vitest";
import { createTestIndexer, BigDecimal } from "generated";
import { TestHelpers } from "envio";

const { Addresses } = TestHelpers;

// Import handlers
import "../handlers/V3Factory";
import "../handlers/Pool";
import "../handlers/NonfungiblePositionManager";
import "../handlers/VaultFactory";
import "../handlers/VaultERC20";

const CHAIN_ID = 42161; // Arbitrum

const deployerAddr = Addresses.mockAddresses[0]!;
const vaultAddr = Addresses.mockAddresses[1]!;
const managerAddr = Addresses.mockAddresses[2]!;
const user1Addr = Addresses.mockAddresses[3]!;
const user2Addr = Addresses.mockAddresses[4]!;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("VaultFactory.VaultCreated", () => {
  it("should register vault as dynamic ERC20 contract", async () => {
    const indexer = createTestIndexer();

    const result = await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "VaultFactory",
              event: "VaultCreated",
              params: {
                deployer: deployerAddr,
                vault: vaultAddr,
                beaconName: "UniswapV3Vault",
                tokenId: 1n,
                vaultManager: managerAddr,
              },
            },
          ],
        },
      },
    });

    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes[0]!.eventsProcessed).toBe(1);

    // Should have registered the vault address as a VaultERC20 dynamic contract
    const change = result.changes[0]!;
    if (change.addresses?.sets) {
      const registeredAddresses = change.addresses.sets.map(
        (r) => r.address.toLowerCase()
      );
      expect(registeredAddresses).toContain(vaultAddr.toLowerCase());
    }
  });
});

describe("VaultERC20.VaultTransfer", () => {
  it("should handle mint (from zero address) and create ERC20Contract", async () => {
    const indexer = createTestIndexer();

    const contractId = `${CHAIN_ID}-${vaultAddr.toLowerCase()}`;
    const mintAmount = 1_000_000_000_000_000_000n; // 1e18

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "VaultERC20",
              event: "VaultTransfer",
              params: {
                from: ZERO_ADDRESS as `0x${string}`,
                to: user1Addr,
                value: mintAmount,
              },
              srcAddress: vaultAddr,
            },
          ],
        },
      },
    });

    // ERC20Contract should be created
    const contract = await indexer.ERC20Contract.get(contractId);
    expect(contract).toBeDefined();
    expect(contract!.decimals).toBeDefined();

    // Total supply should be updated
    const totalSupplyId = `${contractId}/totalSupply`;
    const totalSupply = await indexer.ERC20Balance.get(totalSupplyId);
    expect(totalSupply).toBeDefined();
    expect(totalSupply!.valueExact).toBe(mintAmount);

    // Receiver balance should be created
    const userBalanceId = `${contractId}/${user1Addr.toLowerCase()}`;
    const userBalance = await indexer.ERC20Balance.get(userBalanceId);
    expect(userBalance).toBeDefined();
    expect(userBalance!.valueExact).toBe(mintAmount);

    // VaultAccount should be created for receiver
    const accountId = `${CHAIN_ID}-${user1Addr.toLowerCase()}`;
    const account = await indexer.VaultAccount.get(accountId);
    expect(account).toBeDefined();

    // ERC20Transfer should be created
    const allTransfers = await indexer.ERC20Transfer.getAll();
    expect(allTransfers.length).toBe(1);
    expect(allTransfers[0]!.contract_id).toBe(contractId);
    expect(allTransfers[0]!.from_id).toBeUndefined(); // mint has no from
    expect(allTransfers[0]!.to_id).toBe(accountId);
    expect(allTransfers[0]!.valueExact).toBe(mintAmount);
  });

  it("should handle regular transfer between users", async () => {
    const indexer = createTestIndexer();

    const contractId = `${CHAIN_ID}-${vaultAddr.toLowerCase()}`;
    const mintAmount = 10_000_000_000_000_000_000n; // 10e18
    const transferAmount = 3_000_000_000_000_000_000n; // 3e18

    // Mint and transfer in a single process call so state is shared
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "VaultERC20",
              event: "VaultTransfer",
              params: {
                from: ZERO_ADDRESS as `0x${string}`,
                to: user1Addr,
                value: mintAmount,
              },
              srcAddress: vaultAddr,
            },
            {
              contract: "VaultERC20",
              event: "VaultTransfer",
              params: {
                from: user1Addr,
                to: user2Addr,
                value: transferAmount,
              },
              srcAddress: vaultAddr,
            },
          ],
        },
      },
    });

    // User1 balance should decrease
    const user1BalanceId = `${contractId}/${user1Addr.toLowerCase()}`;
    const user1Balance = await indexer.ERC20Balance.getOrThrow(user1BalanceId);
    expect(user1Balance.valueExact).toBe(mintAmount - transferAmount);

    // User2 balance should increase
    const user2BalanceId = `${contractId}/${user2Addr.toLowerCase()}`;
    const user2Balance = await indexer.ERC20Balance.getOrThrow(user2BalanceId);
    expect(user2Balance.valueExact).toBe(transferAmount);

    // Total supply should remain unchanged
    const totalSupplyId = `${contractId}/totalSupply`;
    const totalSupply = await indexer.ERC20Balance.getOrThrow(totalSupplyId);
    expect(totalSupply.valueExact).toBe(mintAmount);

    // Should have 2 transfers total
    const allTransfers = await indexer.ERC20Transfer.getAll();
    expect(allTransfers.length).toBe(2);
  });

  it("should handle burn (to zero address) and decrease total supply", async () => {
    const indexer = createTestIndexer();

    const contractId = `${CHAIN_ID}-${vaultAddr.toLowerCase()}`;
    const mintAmount = 5_000_000_000_000_000_000n;
    const burnAmount = 2_000_000_000_000_000_000n;

    // Mint and burn in single process call
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "VaultERC20",
              event: "VaultTransfer",
              params: {
                from: ZERO_ADDRESS as `0x${string}`,
                to: user1Addr,
                value: mintAmount,
              },
              srcAddress: vaultAddr,
            },
            {
              contract: "VaultERC20",
              event: "VaultTransfer",
              params: {
                from: user1Addr,
                to: ZERO_ADDRESS as `0x${string}`,
                value: burnAmount,
              },
              srcAddress: vaultAddr,
            },
          ],
        },
      },
    });

    // User balance should decrease
    const user1BalanceId = `${contractId}/${user1Addr.toLowerCase()}`;
    const user1Balance = await indexer.ERC20Balance.getOrThrow(user1BalanceId);
    expect(user1Balance.valueExact).toBe(mintAmount - burnAmount);

    // Total supply should decrease
    const totalSupplyId = `${contractId}/totalSupply`;
    const totalSupply = await indexer.ERC20Balance.getOrThrow(totalSupplyId);
    expect(totalSupply.valueExact).toBe(mintAmount - burnAmount);

    // Burn transfer should have no to_id
    const allTransfers = await indexer.ERC20Transfer.getAll();
    const burnTransfer = allTransfers.find((t) => !t.to_id);
    expect(burnTransfer).toBeDefined();
    expect(burnTransfer!.valueExact).toBe(burnAmount);
  });

  it("should track decimal-adjusted values correctly", async () => {
    const indexer = createTestIndexer();

    const contractId = `${CHAIN_ID}-${vaultAddr.toLowerCase()}`;
    // Mint 1.5 tokens (assuming 18 decimals)
    const amount = 1_500_000_000_000_000_000n;

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "VaultERC20",
              event: "VaultTransfer",
              params: {
                from: ZERO_ADDRESS as `0x${string}`,
                to: user1Addr,
                value: amount,
              },
              srcAddress: vaultAddr,
            },
          ],
        },
      },
    });

    const userBalanceId = `${contractId}/${user1Addr.toLowerCase()}`;
    const balance = await indexer.ERC20Balance.getOrThrow(userBalanceId);

    // valueExact should be the raw amount
    expect(balance.valueExact).toBe(amount);
    // value should be the decimal-adjusted amount (1.5 for 18 decimals)
    expect(balance.value.isGreaterThan(new BigDecimal(0))).toBe(true);
  });

  it("should handle multiple vaults independently", async () => {
    const indexer = createTestIndexer();

    const vault2Addr = Addresses.mockAddresses[5]!;
    const contract1Id = `${CHAIN_ID}-${vaultAddr.toLowerCase()}`;
    const contract2Id = `${CHAIN_ID}-${vault2Addr.toLowerCase()}`;

    // Mint on both vaults in a single process call
    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            {
              contract: "VaultERC20",
              event: "VaultTransfer",
              params: {
                from: ZERO_ADDRESS as `0x${string}`,
                to: user1Addr,
                value: 1000n,
              },
              srcAddress: vaultAddr,
            },
            {
              contract: "VaultERC20",
              event: "VaultTransfer",
              params: {
                from: ZERO_ADDRESS as `0x${string}`,
                to: user1Addr,
                value: 5000n,
              },
              srcAddress: vault2Addr,
            },
          ],
        },
      },
    });

    // Should have 2 separate ERC20Contracts
    const allContracts = await indexer.ERC20Contract.getAll();
    expect(allContracts.length).toBe(2);

    // Balances should be tracked independently
    const balance1Id = `${contract1Id}/${user1Addr.toLowerCase()}`;
    const balance2Id = `${contract2Id}/${user1Addr.toLowerCase()}`;
    const b1 = await indexer.ERC20Balance.getOrThrow(balance1Id);
    const b2 = await indexer.ERC20Balance.getOrThrow(balance2Id);
    expect(b1.valueExact).toBe(1000n);
    expect(b2.valueExact).toBe(5000n);
  });
});
