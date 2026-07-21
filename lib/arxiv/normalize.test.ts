import { describe, expect, it } from "vitest";

import {
  ArxivInputError,
  MAX_ARXIV_INPUT_LENGTH,
  normalizeArxivInput,
} from "./normalize";

describe("normalizeArxivInput accepted forms", () => {
  it.each([
    "1706.03762",
    "https://arxiv.org/abs/1706.03762",
    "https://arxiv.org/pdf/1706.03762",
    "https://arxiv.org/pdf/1706.03762.pdf",
  ])("normalizes the unversioned form %s", (input) => {
    expect(normalizeArxivInput(input)).toEqual({
      id: "1706.03762",
      baseId: "1706.03762",
      versionSuffix: null,
      recordUrl: "https://arxiv.org/abs/1706.03762",
      pdfUrl: "https://arxiv.org/pdf/1706.03762.pdf",
    });
  });

  it.each([
    "1706.03762v7",
    "https://arxiv.org/abs/1706.03762v7",
    "https://arxiv.org/pdf/1706.03762v7",
    "https://arxiv.org/pdf/1706.03762v7.pdf",
  ])("preserves the version suffix in %s", (input) => {
    expect(normalizeArxivInput(input)).toEqual({
      id: "1706.03762v7",
      baseId: "1706.03762",
      versionSuffix: "v7",
      recordUrl: "https://arxiv.org/abs/1706.03762v7",
      pdfUrl: "https://arxiv.org/pdf/1706.03762v7.pdf",
    });
  });

  it.each([
    "0704.0001",
    "1412.9999v2",
    "1501.00001",
    "9912.99999",
  ])("accepts valid era and sequence-width boundaries: %s", (input) => {
    expect(normalizeArxivInput(input).id).toBe(input);
  });

  it("returns a deterministic immutable value", () => {
    const first = normalizeArxivInput("1706.03762v7");
    const replay = normalizeArxivInput("1706.03762v7");

    expect(replay).toEqual(first);
    expect(replay).not.toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
  });
});

describe("normalizeArxivInput rejection boundary", () => {
  it.each([
    "https://example.com/abs/1706.03762",
    "https://arxiv.org.evil.test/abs/1706.03762",
    "https://evil.test/?next=https://arxiv.org/abs/1706.03762",
    "https://www.arxiv.org/abs/1706.03762",
    "https://user@arxiv.org/abs/1706.03762",
    "https://user:secret@arxiv.org/abs/1706.03762",
    "https://arxiv.org:443/abs/1706.03762",
  ])("rejects alternate domains, ports, and credentials: %s", (input) => {
    expect(() => normalizeArxivInput(input)).toThrow(ArxivInputError);
  });

  it.each([
    "https://arxiv.org/help",
    "https://arxiv.org/",
    "https://arxiv.org/export/arxiv/1706.03762",
    "https://arxiv.org/abs/1706.03762/extra",
    "https://arxiv.org/pdf/1706.03762.pdf/download",
    "https://arxiv.org//abs/1706.03762",
  ])("rejects arbitrary or expanded arxiv.org paths: %s", (input) => {
    expect(() => normalizeArxivInput(input)).toThrow(ArxivInputError);
  });

  it.each([
    "http://arxiv.org/abs/1706.03762",
    "ftp://arxiv.org/pdf/1706.03762",
    "//arxiv.org/abs/1706.03762",
    "HTTPS://arxiv.org/abs/1706.03762",
    "arXiv:1706.03762",
  ])("rejects unsupported protocols and prefixes: %s", (input) => {
    expect(() => normalizeArxivInput(input)).toThrow(ArxivInputError);
  });

  it.each([
    "https://arxiv.org/abs/1706.03762?download=1",
    "https://arxiv.org/abs/1706.03762?",
    "https://arxiv.org/pdf/1706.03762#page=2",
    "https://arxiv.org/pdf/1706.03762#",
    "https://arxiv.org/abs/1706.03762%3Fdownload=1",
  ])("rejects query and fragment tricks: %s", (input) => {
    expect(() => normalizeArxivInput(input)).toThrow(ArxivInputError);
  });

  it.each([
    " 1706.03762",
    "1706.03762 ",
    "1706. 03762",
    "1706.03762\n",
    "https://arxiv.org/abs/1706.03762\t",
    "https://arxiv.org/abs/1706.03762%20",
  ])("rejects literal or encoded whitespace injection: %s", (input) => {
    expect(() => normalizeArxivInput(input)).toThrow(ArxivInputError);
  });

  it("rejects oversized and non-string input", () => {
    const oversized = "1".repeat(MAX_ARXIV_INPUT_LENGTH + 1);

    expect(() => normalizeArxivInput(oversized)).toThrow(ArxivInputError);
    expect(() => normalizeArxivInput(null as unknown as string)).toThrow(
      ArxivInputError,
    );
  });

  it.each([
    "",
    "1706.376",
    "1706.037620",
    "1700.03762",
    "1713.03762",
    "1706.00000",
    "1706.03762v",
    "1706.03762v0",
    "1706.03762v01",
    "1706.03762V7",
    "1706.03762.pdf",
    "1706/03762",
    "hep-th/9901001",
    "0001.0001",
    "0703.0001",
    "0704.00001",
    "1412.00001",
    "1501.0001",
    "2501.0001",
    "https://arxiv.org/abs/1706.03762.pdf",
    "https://arxiv.org/pdf/1706.03762.pdfv7",
    "https://arxiv.org/pdf/../1706.03762",
  ])("rejects malformed or unauthorized identifier form: %s", (input) => {
    expect(() => normalizeArxivInput(input)).toThrow(ArxivInputError);
  });
});
