import chalk from 'chalk';

export function formatEth(value: string, decimals: number = 6): string {
  const num = parseFloat(value);
  if (num === 0) return '0';
  return num.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Write a structured JSON error to stderr and set exit code.
 */
export function jsonError(message: string, code: string, exitCode: number): void {
  process.stderr.write(JSON.stringify({ error: message, code, exitCode }) + '\n');
  process.exitCode = exitCode;
}

/**
 * Print a styled header (for --pretty mode).
 */
export function header(text: string): void {
  console.log();
  console.log(chalk.bold.cyan(text));
  console.log(chalk.cyan('-'.repeat(text.length)));
}

/**
 * Print a label-value row (for --pretty mode).
 */
export function row(label: string, value: string): void {
  console.log(`  ${chalk.gray(label.padEnd(22))} ${value}`);
}

export function formatTimestamp(timestamp: bigint): string {
  const date = new Date(Number(timestamp) * 1000);
  return date.toISOString();
}
