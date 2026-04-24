/** Limits used when sanitizing and stringifying log payloads. */
export interface LogSerializeOptions {
  /** Maximum object traversal depth before values are summarized. */
  maxDepth?: number;
  /** Maximum number of characters preserved for a single string. */
  maxStringLength?: number;
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
  maxArrayLength: 20,
  maxObjectKeys: 30,
  truncateSuffix: '...<truncated>',
};

function resolveOptions(options?: LogSerializeOptions): Required<LogSerializeOptions> {
  return {
    ...DEFAULT_SERIALIZE_OPTIONS,
    ...options,
  };
}

function truncateString(value: string, options: Required<LogSerializeOptions>): string {
  if (value.length <= options.maxStringLength) {
    return value;
  }

  return `${value.slice(0, options.maxStringLength)}${options.truncateSuffix}`;
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
