import { VaultFactory } from "generated";

VaultFactory.VaultCreated.contractRegister(({ event, context }) => {
  context.addVaultERC20(event.params.vault);
});

VaultFactory.VaultCreated.handler(async ({ event, context }) => {
  context.log.info(
    `VaultCreated: ${event.params.vault} by ${event.params.deployer} (beacon: ${event.params.beaconName})`
  );
});
