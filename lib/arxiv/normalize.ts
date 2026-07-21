export const MAX_ARXIV_INPUT_LENGTH = 200;

export type ArxivInputErrorCode =
  | "invalid-type"
  | "empty"
  | "too-long"
  | "whitespace"
  | "query-or-fragment"
  | "unsupported-protocol"
  | "invalid-url"
  | "malformed-id";

export interface NormalizedArxivInput {
  /** Canonical modern arXiv identifier, including a supplied version suffix. */
  readonly id: string;
  /** Identifier without its optional version suffix. */
  readonly baseId: string;
  /** Exact lowercase suffix such as `v7`, or null for the latest version. */
  readonly versionSuffix: string | null;
  readonly recordUrl: string;
  readonly pdfUrl: string;
}

export class ArxivInputError extends Error {
  readonly code: ArxivInputErrorCode;

  constructor(code: ArxivInputErrorCode, message: string) {
    super(message);
    this.name = "ArxivInputError";
    this.code = code;
  }
}

const FOUR_DIGIT_NON_ZERO_SEQUENCE =
  "(?:[1-9][0-9]{3}|[0-9][1-9][0-9]{2}|[0-9]{2}[1-9][0-9]|[0-9]{3}[1-9])";
const FIVE_DIGIT_NON_ZERO_SEQUENCE =
  "(?:[1-9][0-9]{4}|[0-9][1-9][0-9]{3}|[0-9]{2}[1-9][0-9]{2}|[0-9]{3}[1-9][0-9]|[0-9]{4}[1-9])";

/**
 * Modern identifiers began at 0704. They used four sequence digits through
 * 1412 and five sequence digits from 1501 onward.
 */
export const CANONICAL_ARXIV_ID_PATTERN = new RegExp(
  `^(?:(?:07(?:0[4-9]|1[0-2])|(?:0[89]|1[0-4])(?:0[1-9]|1[0-2]))\\.${FOUR_DIGIT_NON_ZERO_SEQUENCE}|(?:1[5-9]|[2-9][0-9])(?:0[1-9]|1[0-2])\\.${FIVE_DIGIT_NON_ZERO_SEQUENCE})(?:v[1-9][0-9]*)?$`,
);
const AUTHORIZED_URL_PATTERN =
  /^https:\/\/arxiv\.org\/(abs|pdf)\/([^/?#]+)$/;
const PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

/**
 * Normalizes an explicitly supported modern arXiv ID or arxiv.org URL.
 *
 * Accepted inputs are bare IDs, exact `/abs/<id>` URLs, and exact `/pdf/<id>`
 * URLs with an optional `.pdf` extension. Input is never trimmed, decoded, or
 * repaired: all other forms fail closed.
 */
export function normalizeArxivInput(input: string): NormalizedArxivInput {
  if (typeof input !== "string") {
    throw new ArxivInputError("invalid-type", "arXiv input must be a string.");
  }
  if (input.length === 0) {
    throw new ArxivInputError("empty", "arXiv input cannot be empty.");
  }
  if (input.length > MAX_ARXIV_INPUT_LENGTH) {
    throw new ArxivInputError(
      "too-long",
      `arXiv input cannot exceed ${MAX_ARXIV_INPUT_LENGTH} characters.`,
    );
  }
  if (/\s/u.test(input)) {
    throw new ArxivInputError(
      "whitespace",
      "arXiv input cannot contain whitespace.",
    );
  }
  if (input.includes("?") || input.includes("#")) {
    throw new ArxivInputError(
      "query-or-fragment",
      "arXiv URLs cannot contain a query or fragment.",
    );
  }

  const bareId = parseModernId(input);
  if (bareId) {
    return buildNormalizedInput(bareId);
  }

  if (PROTOCOL_PATTERN.test(input) && !input.startsWith("https://")) {
    throw new ArxivInputError(
      "unsupported-protocol",
      "Only exact https://arxiv.org URLs are supported.",
    );
  }

  if (input.startsWith("//") || input.includes("://")) {
    if (!input.startsWith("https://")) {
      throw new ArxivInputError(
        "unsupported-protocol",
        "Only exact https://arxiv.org URLs are supported.",
      );
    }

    const urlMatch = AUTHORIZED_URL_PATTERN.exec(input);
    if (!urlMatch) {
      throw new ArxivInputError(
        "invalid-url",
        "Use an exact arxiv.org abstract or PDF URL without credentials, ports, or extra path segments.",
      );
    }

    const route = urlMatch[1];
    const pathId =
      route === "pdf" && urlMatch[2].endsWith(".pdf")
        ? urlMatch[2].slice(0, -4)
        : urlMatch[2];
    const parsedId = parseModernId(pathId);

    if (!parsedId) {
      throw new ArxivInputError(
        "malformed-id",
        "The arXiv URL does not contain a valid modern identifier.",
      );
    }

    return buildNormalizedInput(parsedId);
  }

  throw new ArxivInputError(
    "malformed-id",
    "Use a modern arXiv ID such as 1706.03762 or an exact arxiv.org URL.",
  );
}

interface ParsedArxivId {
  readonly id: string;
  readonly baseId: string;
  readonly versionSuffix: string | null;
}

function parseModernId(candidate: string): ParsedArxivId | null {
  if (!CANONICAL_ARXIV_ID_PATTERN.test(candidate)) {
    return null;
  }

  const versionMatch = candidate.match(/v[1-9][0-9]*$/);
  const versionSuffix = versionMatch?.[0] ?? null;
  const baseId = versionSuffix
    ? candidate.slice(0, -versionSuffix.length)
    : candidate;
  return {
    id: `${baseId}${versionSuffix ?? ""}`,
    baseId,
    versionSuffix,
  };
}

function buildNormalizedInput(parsed: ParsedArxivId): NormalizedArxivInput {
  return Object.freeze({
    ...parsed,
    recordUrl: `https://arxiv.org/abs/${parsed.id}`,
    pdfUrl: `https://arxiv.org/pdf/${parsed.id}.pdf`,
  });
}
