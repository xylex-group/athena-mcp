import { describe, it, expect } from "vitest";
import { isWriteQuery } from "./query.js";

describe("isWriteQuery", () => {
  it("returns true for write operations", () => {
    expect(isWriteQuery("INSERT INTO users VALUES (1)")).toBe(true);
    expect(isWriteQuery("UPDATE users SET name = 'x'")).toBe(true);
    expect(isWriteQuery("DELETE FROM users WHERE id = 1")).toBe(true);
    expect(isWriteQuery("DROP TABLE users")).toBe(true);
    expect(isWriteQuery("CREATE TABLE foo (id int)")).toBe(true);
    expect(isWriteQuery("ALTER TABLE users ADD COLUMN x int")).toBe(true);
    expect(isWriteQuery("TRUNCATE users")).toBe(true);
    expect(isWriteQuery("GRANT SELECT ON users TO alice")).toBe(true);
    expect(isWriteQuery("REVOKE SELECT ON users FROM alice")).toBe(true);
    expect(isWriteQuery("REPLACE INTO users VALUES (1)")).toBe(true);
  });

  it("returns false when write keyword is substring (no word boundary)", () => {
    expect(isWriteQuery("SELECT * FROM insert_log")).toBe(false);
    expect(isWriteQuery("SELECT delete_flag FROM config")).toBe(false);
  });

  it("returns true when write keyword is standalone", () => {
    expect(isWriteQuery("/* INSERT comment */ SELECT 1")).toBe(true);
  });

  it("returns false for read-only queries", () => {
    expect(isWriteQuery("SELECT * FROM users")).toBe(false);
    expect(isWriteQuery("SELECT 1")).toBe(false);
    expect(isWriteQuery("WITH cte AS (SELECT 1) SELECT * FROM cte")).toBe(false);
    expect(isWriteQuery("SELECT count(*) FROM logs")).toBe(false);
  });
});
