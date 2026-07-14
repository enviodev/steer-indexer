import { indexer } from "envio";

indexer.contractRegister(
  { contract: "VaultFactory", event: "VaultCreated" },
  async ({ event, context }) => {
  context.chain.VaultERC20.add(event.params.vault);
}
);

indexer.onEvent(
  { contract: "VaultFactory", event: "VaultCreated" },
  async ({ event, context }) => {
  context.log.info(
    `VaultCreated: ${event.params.vault} by ${event.params.deployer} (beacon: ${event.params.beaconName})`
  );
}
);
