import { afterEach, describe, expect, it, vi } from "vitest";

import { createClientSubmissionId } from "./client-submission-id";

describe("createClientSubmissionId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses randomUUID when the browser exposes it", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "12345678-1234-4123-8123-123456789abc",
    });

    expect(createClientSubmissionId()).toBe(
      "12345678-1234-4123-8123-123456789abc",
    );
  });

  it("creates a UUID when randomUUID is unavailable in an insecure context", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.forEach((_, index) => {
          bytes[index] = index;
        });
        return bytes;
      },
    });

    expect(createClientSubmissionId()).toBe(
      "00010203-0405-4607-8809-0a0b0c0d0e0f",
    );
  });
});
