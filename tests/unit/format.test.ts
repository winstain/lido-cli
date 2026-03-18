import { formatEth, formatTimestamp, jsonError, header, row } from '../../src/utils/format';

describe('formatEth', () => {
  test('formats zero', () => {
    expect(formatEth('0')).toBe('0');
  });

  test('formats whole number', () => {
    expect(formatEth('100')).toBe('100');
  });

  test('formats decimal with default precision', () => {
    expect(formatEth('1.234567890')).toBe('1.234568');
  });

  test('trims trailing zeros', () => {
    expect(formatEth('1.500000')).toBe('1.5');
  });

  test('respects custom decimal places', () => {
    expect(formatEth('1.123456789', 8)).toBe('1.12345679');
  });

  test('handles very small numbers', () => {
    expect(formatEth('0.000001', 8)).toBe('0.000001');
  });

  test('handles large numbers', () => {
    expect(formatEth('9185524.972880054590027928')).toBe('9185524.97288');
  });
});

describe('formatTimestamp', () => {
  test('converts unix timestamp to ISO string', () => {
    const result = formatTimestamp(BigInt(1700000000));
    expect(result).toBe('2023-11-14T22:13:20.000Z');
  });

  test('handles zero timestamp', () => {
    const result = formatTimestamp(BigInt(0));
    expect(result).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('jsonError', () => {
  const originalWrite = process.stderr.write;
  const originalExitCode = process.exitCode;
  let stderrOutput: string[] = [];

  beforeEach(() => {
    stderrOutput = [];
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrOutput.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.stderr.write = originalWrite;
    process.exitCode = originalExitCode;
  });

  test('writes structured JSON error to stderr', () => {
    jsonError('Something failed', 'RPC_ERROR', 1);
    const output = JSON.parse(stderrOutput[0]);
    expect(output).toEqual({ error: 'Something failed', code: 'RPC_ERROR', exitCode: 1 });
  });

  test('sets process exit code', () => {
    jsonError('Bad input', 'INVALID_INPUT', 2);
    expect(process.exitCode).toBe(2);
  });
});

describe('header', () => {
  const originalLog = console.log;
  let output: string[] = [];

  beforeEach(() => {
    output = [];
    console.log = (...args: unknown[]) => { output.push(args.map(String).join(' ')); };
  });

  afterEach(() => { console.log = originalLog; });

  test('prints header text', () => {
    header('Test Header');
    expect(output.length).toBe(3); // blank line, text, underline
  });
});

describe('row', () => {
  const originalLog = console.log;
  let output: string[] = [];

  beforeEach(() => {
    output = [];
    console.log = (...args: unknown[]) => { output.push(args.map(String).join(' ')); };
  });

  afterEach(() => { console.log = originalLog; });

  test('prints label-value pair', () => {
    row('Label', 'Value');
    expect(output.length).toBe(1);
    expect(output[0]).toContain('Value');
  });
});
