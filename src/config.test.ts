import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { AthenaRuntime } from "./runtime.js";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_ARGV = [...process.argv];

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.argv = [...ORIGINAL_ARGV];
});

describe("loadConfig", () => {
  it("uses the configured allowlist and default client", () => {
    process.env.ATHENA_CLIENT = "primary";
    process.env.ATHENA_AVAILABLE_CLIENTS = "primary, analytics";
    process.env.ATHENA_ADMIN_EXPERIMENTAL_ENABLED = "true";

    const config = loadConfig();

    expect(config.defaultClient).toBe("primary");
    expect(config.availableClients).toEqual(["primary", "analytics"]);
    expect(config.adminExperimentalEnabled).toBe(true);
  });

  it("allows load with default outside allowlist but resolveClientName rejects it", () => {
    process.env.ATHENA_CLIENT = "primary";
    process.env.ATHENA_AVAILABLE_CLIENTS = "analytics";

    const config = loadConfig();
    // load succeeds (prevents MCP server startup crashes on misconfig)
    expect(config.defaultClient).toBe("analytics"); // fell back to first in list
    expect(config.availableClients).toEqual(["analytics"]);

    const runtime = new AthenaRuntime(config);
    // default now uses the (only) allowed one
    expect(runtime.resolveClientName()).toBe("analytics");
    // override to disallowed still errors (at use time)
    expect(() => runtime.resolveClientName("primary")).toThrow(
      'Athena client "primary" is not allowed',
    );
  });

  it("supports CLI overrides for client selection", () => {
    process.env.ATHENA_CLIENT = "primary";
    process.argv = [
      ...ORIGINAL_ARGV.slice(0, 2),
      "--athena-client=analytics",
      "--athena-available-clients=primary,analytics",
    ];

    const config = loadConfig();

    expect(config.defaultClient).toBe("analytics");
    expect(config.availableClients).toEqual(["primary", "analytics"]);
  });
});
