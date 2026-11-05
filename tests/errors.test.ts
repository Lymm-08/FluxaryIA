import { describe, expect, it } from "vitest";
import { formatErrorDetails } from "../src/utils/errors";

describe("formatErrorDetails", () => {
  it("preserves structured Supabase errors", () => {
    expect(formatErrorDetails({
      message: "insert violates a constraint",
      code: "23503",
      details: "Key is not present",
      hint: "Check the account foreign key",
    }, "unknown")).toBe(
      "insert violates a constraint · code: 23503 · details: Key is not present · hint: Check the account foreign key",
    );
  });

  it("redacts credentials from error text", () => {
    expect(formatErrorDetails({
      message: "Request failed",
      details: "Bearer abc.def and access_token=secret",
    }, "unknown")).toBe("Request failed · details: [redigido] and [redigido]");
  });

  it("uses a fallback only when the error has no usable detail", () => {
    expect(formatErrorDetails({ code: 42 }, "Unknown failure")).toBe("Unknown failure");
  });
});
