import { describe, it, expect } from "vitest";

// Import all handlers to register them
import "./handlers/V3Factory";
import "./handlers/Pool";
import "./handlers/NonfungiblePositionManager";
import "./handlers/VaultFactory";
import "./handlers/VaultERC20";

describe("Handler Registration", () => {
  it("should compile and register all handlers without errors", () => {
    expect(true).toBe(true);
  });
});
