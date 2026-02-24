import { describe, it, expect } from "vitest";
import { sanitizeIdentifier, IDENTIFIER_RE } from "./identifier.js";

describe("IDENTIFIER_RE", () => {
  it("accepts valid identifiers", () => {
    expect(IDENTIFIER_RE.test("users")).toBe(true);
    expect(IDENTIFIER_RE.test("users_1")).toBe(true);
    expect(IDENTIFIER_RE.test("_private")).toBe(true);
    expect(IDENTIFIER_RE.test("schema.table")).toBe(true);
    expect(IDENTIFIER_RE.test("public.users")).toBe(true);
  });

  it("rejects invalid identifiers", () => {
    expect(IDENTIFIER_RE.test("1users")).toBe(false);
    expect(IDENTIFIER_RE.test("user-name")).toBe(false);
    expect(IDENTIFIER_RE.test("user name")).toBe(false);
    expect(IDENTIFIER_RE.test("")).toBe(false);
    expect(IDENTIFIER_RE.test("users;")).toBe(false);
    expect(IDENTIFIER_RE.test("users--comment")).toBe(false);
  });
});

describe("sanitizeIdentifier", () => {
  it("returns valid identifiers unchanged", () => {
    expect(sanitizeIdentifier("users", "table_name")).toBe("users");
    expect(sanitizeIdentifier("schema_migrations", "table_name")).toBe("schema_migrations");
    expect(sanitizeIdentifier("logs", "table_name")).toBe("logs");
  });

  it("throws for invalid identifiers with descriptive error", () => {
    expect(() => sanitizeIdentifier("1invalid", "table_name")).toThrow(
      'Invalid table_name: "1invalid". Only alphanumeric characters, underscores, dots, and dollar signs are allowed.'
    );
    expect(() => sanitizeIdentifier("drop table users", "table_name")).toThrow(
      'Invalid table_name: "drop table users"'
    );
    expect(() => sanitizeIdentifier("users;--", "table_name")).toThrow(
      'Invalid table_name: "users;--"'
    );
  });
});
