import { Command } from 'commander';
import { type Address } from 'viem';
import { LidoClient } from '../api/client';
import { CONTRACTS } from '../config/contracts';
import { getRpcUrl } from '../config/store';
import { formatEth, header, row, jsonError } from '../utils/format';

export function makeWrapCommand(): Command {
  const cmd = new Command('wrap')
    .description('Build a transaction to wrap stETH into wstETH')
    .requiredOption('--amount <stETH>', 'Amount of stETH to wrap')
    .option('--wallet <address>', 'Wallet address (adds from to tx payload)')
    .option('--with-approval', 'Output an approval tx before wrap tx')
    .option('--pretty', 'Human-readable colored output')
    .action(async (opts) => {
      try {
        const num = parseFloat(opts.amount);
        if (isNaN(num) || num <= 0) {
          jsonError('Invalid amount. Must be a positive number.', 'INVALID_INPUT', 1);
          return;
        }

        if (opts.withApproval && !opts.wallet) {
          jsonError('--wallet is required when using --with-approval', 'INVALID_INPUT', 1);
          return;
        }

        const from = opts.wallet as Address | undefined;
        const client = new LidoClient(getRpcUrl());
        const [rate] = await Promise.all([client.getExchangeRate()]);
        const estimatedWstETH = num * parseFloat(rate.wstEthPerStEth);

        const wrapTx = client.buildWrapTransaction(opts.amount, from);
        const transactions = opts.withApproval
          ? [
              client.buildStEthApproveTransaction(opts.amount, CONTRACTS.wstETH, from),
              wrapTx,
            ]
          : [wrapTx];

        const data = {
          flow: opts.withApproval ? 'approve_then_wrap' : 'wrap',
          estimatedOutput: estimatedWstETH.toString(),
          rate: rate.wstEthPerStEth,
          transactions,
        };

        if (opts.pretty) {
          header(`Wrap ${opts.amount} stETH -> wstETH`);
          row('Input', `${opts.amount} stETH`);
          row('Estimated Output', `${formatEth(estimatedWstETH.toString())} wstETH`);
          row('Rate', `1 wstETH = ${formatEth(rate.stEthPerWstEth)} stETH`);
          row('Tx Count', String(transactions.length));
          row('Contract', wrapTx.to);
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
    .option('--wallet <address>', 'Wallet address (adds from to tx payload)')
    .option('--pretty', 'Human-readable colored output')
    .action(async (opts) => {
      try {
        const num = parseFloat(opts.amount);
        if (isNaN(num) || num <= 0) {
          jsonError('Invalid amount. Must be a positive number.', 'INVALID_INPUT', 1);
          return;
        }

        const from = opts.wallet as Address | undefined;
        const client = new LidoClient(getRpcUrl());
        const [tx, rate] = await Promise.all([
          Promise.resolve(client.buildUnwrapTransaction(opts.amount, from)),
          client.getExchangeRate(),
        ]);
        const estimatedStETH = num * parseFloat(rate.stEthPerWstEth);
        const data = {
          flow: 'unwrap',
          estimatedOutput: estimatedStETH.toString(),
          rate: rate.stEthPerWstEth,
          transactions: [tx],
        };

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
