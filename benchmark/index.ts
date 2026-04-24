import 'reflect-metadata';
import { performance } from 'perf_hooks';
import { Logger, Logging, withLogging, MaskLog, LogLevel } from '../src';
import { maskObject } from '../src/masker/masker';

const WARMUP = 1_000;
const ITERATIONS = 10_000;
const HEAVY_SIZE = 1_000;

interface BenchmarkResult {
  section: string;
  name: string;
  iterations: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  stddev: number;
}

interface OverheadRow {
  section: string;
  scenario: string;
  baseline: number;
  withRvlog: number;
  overhead: number;
  overheadPct: number;
}

function suppressConsole(): () => void {
  const original = {
    log: console.log,
    info: console.info,
    debug: console.debug,
    warn: console.warn,
    error: console.error,
  };
  const noop = () => {};
  console.log = console.info = console.debug = console.warn = console.error = noop;
  return () => Object.assign(console, original);
}

function computeStats(section: string, name: string, timings: number[]): BenchmarkResult {
  const sorted = [...timings].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const p95 = sorted[Math.floor(n * 0.95)];
  const p99 = sorted[Math.floor(n * 0.99)];
  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  return { section, name, iterations: n, mean, median, p95, p99, min: sorted[0], max: sorted[n - 1], stddev };
}

function measure(section: string, name: string, fn: () => unknown): BenchmarkResult {
  let sink: unknown;

  for (let i = 0; i < WARMUP; i++) {
    sink = fn();
  }

  const timings: number[] = new Array(ITERATIONS);
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    sink = fn();
    timings[i] = (performance.now() - start) * 1_000;
  }

  void sink;
  return computeStats(section, name, timings);
}

async function measureAsync(section: string, name: string, fn: () => Promise<unknown>): Promise<BenchmarkResult> {
  let sink: unknown;

  for (let i = 0; i < WARMUP; i++) {
    sink = await fn();
  }

  const timings: number[] = new Array(ITERATIONS);
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    sink = await fn();
    timings[i] = (performance.now() - start) * 1_000;
  }

  void sink;
  return computeStats(section, name, timings);
}

function buildOverheadRow(
  section: string,
  scenario: string,
  baseline: BenchmarkResult,
  logged: BenchmarkResult,
): OverheadRow {
  const overhead = logged.mean - baseline.mean;
  const overheadPct = baseline.mean > 0.001 ? (overhead / baseline.mean) * 100 : 0;
  return { section, scenario, baseline: baseline.mean, withRvlog: logged.mean, overhead, overheadPct };
}

function noopFn(): void {
  return;
}

function lightWork(data: { name: string; email: string }): object {
  return { ...data, processed: true, hash: data.name.split('').reverse().join('') };
}

function heavyWork(size: number): number {
  const arr = Array.from({ length: size }, () => Math.random());
  arr.sort((a, b) => a - b);
  return arr.length;
}

class LargePayloadDto {
  @MaskLog({ type: 'name' })
  name!: string;

  @MaskLog({ type: 'email' })
  email!: string;

  note!: string;
}

class NestedBuyerDto {
  @MaskLog({ type: 'email' })
  email!: string;
}

class NestedOrderDto {
  @MaskLog({ type: 'name' })
  buyerName!: string;

  buyer!: NestedBuyerDto;
}

class BareService {
  noop(): void {
    return;
  }

  light(data: { name: string; email: string }): object {
    return lightWork(data);
  }

  heavy(size: number): number {
    return heavyWork(size);
  }

  large(dto: LargePayloadDto): string {
    return dto.note;
  }

  nested(dto: NestedOrderDto): string {
    return dto.buyer.email;
  }

  async asyncMethod(): Promise<number> {
    return Promise.resolve(42);
  }
}

@Logging
class LoggedService {
  noop(): void {
    return;
  }

  light(data: { name: string; email: string }): object {
    return lightWork(data);
  }

  heavy(size: number): number {
    return heavyWork(size);
  }

  large(dto: LargePayloadDto): string {
    return dto.note;
  }

  nested(dto: NestedOrderDto): string {
    return dto.buyer.email;
  }

  async asyncMethod(): Promise<number> {
    return Promise.resolve(42);
  }
}

function createLargePayloadDto(): LargePayloadDto {
  const dto = new LargePayloadDto();
  dto.name = 'Hong Gildong';
  dto.email = 'hong@example.com';
  dto.note = 'x'.repeat(4_000);
  return dto;
}

function createNestedOrderDto(): NestedOrderDto {
  const dto = new NestedOrderDto();
  dto.buyerName = 'Hong Gildong';
  dto.buyer = new NestedBuyerDto();
  dto.buyer.email = 'hong@example.com';
  return dto;
}

const plainObject = { name: 'Hong Gildong', email: 'hong@example.com', age: 30 };
const nestedObject = {
  user: { name: 'Hong', profile: { address: { city: 'Seoul', zip: '12345' }, tags: ['a', 'b'] } },
  meta: { created: new Date(), count: 10 },
};
const plainLargeBody = {
  name: 'Hong Gildong',
  email: 'hong@example.com',
  note: 'x'.repeat(4_000),
  items: Array.from({ length: 100 }, (_, index) => ({ id: index, label: `item-${index}` })),
};

function pad(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function rpad(str: string, len: number): string {
  return str.length >= len ? str : ' '.repeat(len - str.length) + str;
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function printStatsTable(results: BenchmarkResult[]): void {
  const grouped = new Map<string, BenchmarkResult[]>();

  for (const result of results) {
    const list = grouped.get(result.section) ?? [];
    list.push(result);
    grouped.set(result.section, list);
  }

  for (const [section, rows] of grouped.entries()) {
    console.log(`[ ${section} ]`);
    console.log('');

    const header = [
      pad('Scenario', 34),
      rpad('Mean(us)', 10),
      rpad('Median(us)', 12),
      rpad('P95(us)', 10),
      rpad('P99(us)', 10),
      rpad('StdDev(us)', 12),
    ].join('  ');

    console.log(header);
    console.log('-'.repeat(header.length));

    for (const r of rows) {
      console.log(
        [
          pad(r.name, 34),
          rpad(fmt(r.mean), 10),
          rpad(fmt(r.median), 12),
          rpad(fmt(r.p95), 10),
          rpad(fmt(r.p99), 10),
          rpad(fmt(r.stddev), 12),
        ].join('  '),
      );
    }

    console.log('');
  }
}

function printOverheadTable(rows: OverheadRow[]): void {
  const header = [
    pad('Section', 16),
    pad('Scenario', 30),
    rpad('Baseline(us)', 14),
    rpad('With-rvlog(us)', 16),
    rpad('Overhead(us)', 14),
    rpad('Overhead(%)', 13),
  ].join('  ');

  console.log(header);
  console.log('-'.repeat(header.length));

  for (const row of rows) {
    console.log(
      [
        pad(row.section, 16),
        pad(row.scenario, 30),
        rpad(fmt(row.baseline), 14),
        rpad(fmt(row.withRvlog), 16),
        rpad(fmt(row.overhead), 14),
        rpad(row.baseline > 0.001 ? fmt(row.overheadPct) + '%' : 'N/A', 13),
      ].join('  '),
    );
  }
}

async function main(): Promise<void> {
  const restore = suppressConsole();
  const results: BenchmarkResult[] = [];
  const overheadRows: OverheadRow[] = [];

  const sampleData = { name: 'Hong Gildong', email: 'hong@example.com' };
  const largeDto = createLargePayloadDto();
  const nestedDto = createNestedOrderDto();
  const bare = new BareService();
  const logged = new LoggedService();

  Logger.resetForTesting();
  Logger.configure({});

  const decNoopBare = measure('Decorator', 'noop:bare', () => bare.noop());
  const decNoopLogged = measure('Decorator', 'noop:logged', () => logged.noop());
  const decLightBare = measure('Decorator', 'light:bare', () => bare.light(sampleData));
  const decLightLogged = measure('Decorator', 'light:logged', () => logged.light(sampleData));
  const decNestedBare = measure('Decorator', 'nested:bare', () => bare.nested(nestedDto));
  const decNestedLogged = measure('Decorator', 'nested:logged', () => logged.nested(nestedDto));
  const decLargeBare = measure('Decorator', 'large-payload:bare', () => bare.large(largeDto));
  const decLargeLogged = measure('Decorator', 'large-payload:logged', () => logged.large(largeDto));
  const decHeavyBare = measure('Decorator', 'heavy:bare', () => bare.heavy(HEAVY_SIZE));
  const decHeavyLogged = measure('Decorator', 'heavy:logged', () => logged.heavy(HEAVY_SIZE));

  results.push(
    decNoopBare,
    decNoopLogged,
    decLightBare,
    decLightLogged,
    decNestedBare,
    decNestedLogged,
    decLargeBare,
    decLargeLogged,
    decHeavyBare,
    decHeavyLogged,
  );
  overheadRows.push(
    buildOverheadRow('Decorator', 'noop', decNoopBare, decNoopLogged),
    buildOverheadRow('Decorator', 'light', decLightBare, decLightLogged),
    buildOverheadRow('Decorator', 'nested', decNestedBare, decNestedLogged),
    buildOverheadRow('Decorator', 'large-payload', decLargeBare, decLargeLogged),
    buildOverheadRow('Decorator', 'heavy', decHeavyBare, decHeavyLogged),
  );

  Logger.resetForTesting();
  Logger.configure({ minLevel: LogLevel.ERROR });
  const decNoopDisabled = measure('Decorator', 'noop:disabled', () => logged.noop());
  const decLargeDisabled = measure('Decorator', 'large-payload:disabled', () => logged.large(largeDto));
  results.push(decNoopDisabled, decLargeDisabled);
  overheadRows.push(
    buildOverheadRow('Decorator', 'noop:disabled', decNoopBare, decNoopDisabled),
    buildOverheadRow('Decorator', 'large-payload:disabled', decLargeBare, decLargeDisabled),
  );

  Logger.resetForTesting();
  Logger.configure({});
  const wrappedNoop = withLogging(noopFn, { context: 'Bench' });
  const wrappedLight = withLogging(lightWork, { context: 'Bench' });
  const wrappedLarge = withLogging((dto: LargePayloadDto) => dto.note, { context: 'Bench', name: 'large' });

  const hofNoopBare = measure('withLogging', 'noop:bare', () => noopFn());
  const hofNoopWrapped = measure('withLogging', 'noop:wrapped', () => wrappedNoop());
  const hofLightBare = measure('withLogging', 'light:bare', () => lightWork(sampleData));
  const hofLightWrapped = measure('withLogging', 'light:wrapped', () => wrappedLight(sampleData));
  const hofLargeBare = measure('withLogging', 'large-payload:bare', () => largeDto.note);
  const hofLargeWrapped = measure('withLogging', 'large-payload:wrapped', () => wrappedLarge(largeDto));

  results.push(hofNoopBare, hofNoopWrapped, hofLightBare, hofLightWrapped, hofLargeBare, hofLargeWrapped);
  overheadRows.push(
    buildOverheadRow('withLogging', 'noop', hofNoopBare, hofNoopWrapped),
    buildOverheadRow('withLogging', 'light', hofLightBare, hofLightWrapped),
    buildOverheadRow('withLogging', 'large-payload', hofLargeBare, hofLargeWrapped),
  );

  Logger.resetForTesting();
  Logger.configure({});
  const plainLogger = new Logger('Bench');
  const logSimple = measure('Logger', 'info:simple', () => plainLogger.info('benchmark message'));
  const logArgs = measure('Logger', 'info:with-args', () => plainLogger.info('msg', { a: 1 }, [1, 2]));
  const logPretty = (() => {
    Logger.resetForTesting();
    Logger.configure({ pretty: true });
    const prettyLogger = new Logger('Bench');
    return measure('Logger', 'info:pretty', () => prettyLogger.info('benchmark message'));
  })();
  const logSerialize = (() => {
    Logger.resetForTesting();
    Logger.configure({
      pretty: true,
      serialize: {
        maxStringLength: 64,
        maxArrayLength: 10,
        maxObjectKeys: 10,
        maxDepth: 3,
      },
    });
    const serializeLogger = new Logger('Bench');
    return measure('Logger', 'info:serialize-large', () => serializeLogger.info('large', plainLargeBody));
  })();
  const logRequestContext = (() => {
    Logger.resetForTesting();
    Logger.configure({
      pretty: true,
      contextResolver: () => ({ requestId: 'bench-request-id' }),
    });
    const ctxLogger = new Logger('Bench');
    return measure('Logger', 'info:request-context', () => ctxLogger.info('benchmark message'));
  })();

  Logger.resetForTesting();
  Logger.configure({ minLevel: LogLevel.ERROR });
  const filteredLogger = new Logger('Bench');
  const logDisabled = measure('Logger', 'info:disabled', () => filteredLogger.info('skipped message'));

  results.push(logSimple, logArgs, logPretty, logSerialize, logRequestContext, logDisabled);
  overheadRows.push(
    buildOverheadRow('Logger', 'pretty', logSimple, logPretty),
    buildOverheadRow('Logger', 'serialize-large', logSimple, logSerialize),
    buildOverheadRow('Logger', 'request-context', logSimple, logRequestContext),
  );

  const maskPlain = measure('Masking', 'plain-object', () => maskObject(plainObject));
  const maskFallback = measure('Masking', 'plain-object:fallback', () => maskObject({ name: 'Hong', email: 'hong@example.com' }));
  const maskDecorated = measure('Masking', 'decorated-dto', () => maskObject(largeDto));
  const maskNested = measure('Masking', 'nested-dto', () => maskObject(nestedDto));
  const maskLarge = measure('Masking', 'large-payload', () => maskObject(plainLargeBody));
  results.push(maskPlain, maskFallback, maskDecorated, maskNested, maskLarge);

  const asyncBare = await measureAsync('Async', 'async:bare', () => bare.asyncMethod());
  Logger.resetForTesting();
  Logger.configure({});
  const asyncLogged = await measureAsync('Async', 'async:logged', () => logged.asyncMethod());
  results.push(asyncBare, asyncLogged);
  overheadRows.push(buildOverheadRow('Async', 'async', asyncBare, asyncLogged));

  restore();

  console.log('');
  console.log('='.repeat(96));
  console.log('  rvlog Performance Benchmark Report');
  console.log('='.repeat(96));
  console.log(`  Date       : ${new Date().toISOString()}`);
  console.log(`  Node       : ${process.version}`);
  console.log(`  Iterations : ${ITERATIONS.toLocaleString()}`);
  console.log(`  Warmup     : ${WARMUP.toLocaleString()}`);
  console.log('='.repeat(96));
  console.log('');

  console.log('[ Raw Statistics ]');
  console.log('');
  printStatsTable(results);

  console.log('[ Overhead Analysis ]');
  console.log('');
  printOverheadTable(overheadRows);

  console.log('');
  console.log('-'.repeat(96));
  console.log('  * Mean/Median/P95/P99 are in microseconds (us)');
  console.log('  * Serializer scenarios include string truncation, array/key limiting, and depth limiting');
  console.log('  * Masking includes plain objects, decorated DTOs, nested DTOs, and large payloads');
  console.log('  * Framework adapters such as rvlog-nest should be benchmarked in their own package environment');
  console.log('-'.repeat(96));
  console.log('');
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
