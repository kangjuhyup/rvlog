/** Limits used when sanitizing and stringifying log payloads. */
export interface LogSerializeOptions {
  /** Maximum object traversal depth before values are summarized. */
  maxDepth?: number;
  /** Maximum number of characters preserved for a single string. */
  maxStringLength?: number;
  /** Maximum number of characters preserved for an Error stack trace. */
  maxStackLength?: number;
  /** Maximum number of array items preserved before truncation markers are added. */
  maxArrayLength?: number;
  /** Maximum number of object keys preserved before `__truncatedKeys` is added. */
  maxObjectKeys?: number;
  /** Suffix appended when a string is truncated. */
  truncateSuffix?: string;
}

const DEFAULT_SERIALIZE_OPTIONS: Required<LogSerializeOptions> = {
  maxDepth: 4,
  maxStringLength: 200,
  maxStackLength: 4000,
  maxArrayLength: 20,
  maxObjectKeys: 30,
  truncateSuffix: '...<truncated>',
};

export interface ErrorStackLocation {
  raw: string;
  functionName?: string;
  file?: string;
  line?: number;
  column?: number;
}

export interface SerializedError {
  [key: string]: unknown;
  name: string;
  message: string;
  stack?: string;
  location?: ErrorStackLocation;
  cause?: unknown;
}

function resolveOptions(options?: LogSerializeOptions): Required<LogSerializeOptions> {
  return {
    ...DEFAULT_SERIALIZE_OPTIONS,
    ...options,
  };
}

function truncateString(
  value: string,
  options: Required<LogSerializeOptions>,
  maxLength = options.maxStringLength,
): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}${options.truncateSuffix}`;
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function summarizeDepthLimited(value: unknown): string {
  if (Array.isArray(value)) {
    return `[Array(${value.length})]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isObjectLike(value)) {
    return '[Object]';
  }

  return String(value);
}

export function parseErrorStackLocation(stack?: string): ErrorStackLocation | undefined {
  const frame = stack
    ?.split('\n')
    .slice(1)
    .map((line) => line.trim())
    .find((line) => line.startsWith('at '));

  if (!frame) {
    return undefined;
  }

  const withoutPrefix = frame.slice(3);
  const match = /^(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/.exec(withoutPrefix);

  if (!match) {
    return {
      raw: frame,
    };
  }

  const [, functionName, file, line, column] = match;

  return {
    raw: frame,
    functionName: functionName || undefined,
    file,
    line: Number(line),
    column: Number(column),
  };
}

function sanitizeError(
  error: Error,
  options: Required<LogSerializeOptions>,
  depth: number,
  visited: WeakMap<object, unknown>,
): SerializedError {
  const serialized: SerializedError = {
    name: error.name,
    message: truncateString(error.message, options),
  };

  if (error.stack) {
    serialized.stack = truncateString(error.stack, options, options.maxStackLength);
    serialized.location = parseErrorStackLocation(error.stack);
  }

  if ('cause' in error && error.cause !== undefined) {
    serialized.cause = sanitizeInternal(error.cause, options, depth + 1, visited);
  }

  const customEntries = Object.entries(error);
  for (const [key, nestedValue] of customEntries) {
    if (key in serialized) {
      continue;
    }

    serialized[key as keyof SerializedError] = sanitizeInternal(
      nestedValue,
      options,
      depth + 1,
      visited,
    ) as never;
  }

  return serialized;
}

function sanitizeInternal(
  value: unknown,
  options: Required<LogSerializeOptions>,
  depth: number,
  visited: WeakMap<object, unknown>,
): unknown {
  if (typeof value === 'string') {
    return truncateString(value, options);
  }

  if (!isObjectLike(value)) {
    return value;
  }

  if (visited.has(value)) {
    return '[Circular]';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    visited.set(value, '[Error]');
    return sanitizeError(value, options, depth, visited);
  }

  if (depth >= options.maxDepth) {
    return summarizeDepthLimited(value);
  }

  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    visited.set(value, clone);

    const limitedItems = value.slice(0, options.maxArrayLength);
    for (const item of limitedItems) {
      clone.push(sanitizeInternal(item, options, depth + 1, visited));
    }

    if (value.length > options.maxArrayLength) {
      clone.push(`[... ${value.length - options.maxArrayLength} more items]`);
    }

    return clone;
  }

  const clone: Record<string, unknown> = {};
  visited.set(value, clone);

  const entries = Object.entries(value);
  const limitedEntries = entries.slice(0, options.maxObjectKeys);

  for (const [key, nestedValue] of limitedEntries) {
    clone[key] = sanitizeInternal(nestedValue, options, depth + 1, visited);
  }

  if (entries.length > options.maxObjectKeys) {
    clone.__truncatedKeys = entries.length - options.maxObjectKeys;
  }

  return clone;
}

/** Returns a JSON-safe value suitable for structured logging. */
export function sanitizeLogValue(value: unknown, options?: LogSerializeOptions): unknown {
  return sanitizeInternal(value, resolveOptions(options), 0, new WeakMap<object, unknown>());
}

/** Converts a value into a log-friendly string using the configured limits. */
export function stringifyLogValue(value: unknown, options?: LogSerializeOptions): string {
  if (typeof value === 'string') {
    return truncateString(value, resolveOptions(options));
  }

  try {
    return JSON.stringify(sanitizeLogValue(value, options));
  } catch {
    return String(value);
  }
}
