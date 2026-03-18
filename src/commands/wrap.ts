import { Command } from 'commander';
import { LidoClient } from '../api/client';
import { getRpcUrl } from '../config/store';
import { formatEth, header, row, jsonError } from '../utils/format';

export function makeWrapCommand(): Command {
  const cmd = new Command('wrap')
    .description('Build a transaction to wrap stETH into wstETH')
    .requiredOption('--amount <stETH>', 'Amount of stETH to wrap')
    .option('--pretty', 'Human-readable colored output')
    .action(async (opts) => {
      try {
        const num = parseFloat(opts.amount);
        if (isNaN(num) || num <= 0) {
          jsonError('Invalid amount. Must be a positive number.', 'INVALID_INPUT', 1);
          return;
        }

        const client = new LidoClient(getRpcUrl());
        const [tx, rate] = await Promise.all([
          Promise.resolve(client.buildWrapTransaction(opts.amount)),
          client.getExchangeRate(),
        ]);
        const estimatedWstETH = num * parseFloat(rate.wstEthPerStEth);
        const data = { ...tx, estimatedOutput: estimatedWstETH.toString(), rate: rate.wstEthPerStEth };

        if (opts.pretty) {
          header(`Wrap ${opts.amount} stETH -> wstETH`);
          row('Input', `${opts.amount} stETH`);
          row('Estimated Output', `${formatEth(estimatedWstETH.toString())} wstETH`);
          row('Rate', `1 wstETH = ${formatEth(rate.stEthPerWstEth)} stETH`);
          row('Contract', tx.to);
          return;
        }

        console.log(JSON.stringify(data));
      } catch (err) {
        if (err instanceof Error) {
          jsonError(err.message, 'RPC_ERROR', 1);
        } else {
          jsonError('Unknown error', 'UNKNOWN', 1);
        }
      }
    });

  return cmd;
}

export function makeUnwrapCommand(): Command {
  const cmd = new Command('unwrap')
    .description('Build a transaction to unwrap wstETH back to stETH')
    .requiredOption('--amount <wstETH>', 'Amount of wstETH to unwrap')
    .option('--pretty', 'Human-readable colored output')
    .action(async (opts) => {
      try {
        const num = parseFloat(opts.amount);
        if (isNaN(num) || num <= 0) {
          jsonError('Invalid amount. Must be a positive number.', 'INVALID_INPUT', 1);
          return;
        }

        const client = new LidoClient(getRpcUrl());
        const [tx, rate] = await Promise.all([
          Promise.resolve(client.buildUnwrapTransaction(opts.amount)),
          client.getExchangeRate(),
        ]);
        const estimatedStETH = num * parseFloat(rate.stEthPerWstEth);
        const data = { ...tx, estimatedOutput: estimatedStETH.toString(), rate: rate.stEthPerWstEth };

        if (opts.pretty) {
          header(`Unwrap ${opts.amount} wstETH -> stETH`);
          row('Input', `${opts.amount} wstETH`);
          row('Estimated Output', `${formatEth(estimatedStETH.toString())} stETH`);
          row('Rate', `1 wstETH = ${formatEth(rate.stEthPerWstEth)} stETH`);
          row('Contract', tx.to);
          return;
        }

        console.log(JSON.stringify(data));
      } catch (err) {
        if (err instanceof Error) {
          jsonError(err.message, 'RPC_ERROR', 1);
        } else {
          jsonError('Unknown error', 'UNKNOWN', 1);
        }
      }
    });

  return cmd;
}
