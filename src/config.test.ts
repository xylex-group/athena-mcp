import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

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

  it("rejects a default client outside the configured allowlist", () => {
    process.env.ATHENA_CLIENT = "primary";
    process.env.ATHENA_AVAILABLE_CLIENTS = "analytics";

    expect(() => loadConfig()).toThrow(
      'Default Athena client "primary" is not in ATHENA_AVAILABLE_CLIENTS.',
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
