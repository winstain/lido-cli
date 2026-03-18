import { Command } from 'commander';
import { type Address } from 'viem';
import { LidoClient } from '../api/client';
import { getRpcUrl } from '../config/store';
import { header, row, jsonError } from '../utils/format';

export function makeStakeCommand(): Command {
  const cmd = new Command('stake')
    .description('Build a transaction to stake ETH via Lido')
    .requiredOption('--amount <eth>', 'Amount of ETH to stake')
    .requiredOption('--wallet <address>', 'Wallet address')
    .option('--referral <address>', 'Referral address (defaults to zero address)')
    .option('--pretty', 'Human-readable colored output')
    .action(async (opts) => {
      try {
        const num = parseFloat(opts.amount);
        if (isNaN(num) || num <= 0) {
          jsonError('Invalid amount. Must be a positive number.', 'INVALID_INPUT', 1);
          return;
        }

        const client = new LidoClient(getRpcUrl());
        const tx = client.buildStakeTransaction(opts.amount, opts.referral as Address | undefined, opts.wallet as Address);

        if (opts.pretty) {
          header(`Stake ${opts.amount} ETH via Lido`);
          row('From', opts.wallet);
          row('To (Lido)', tx.to);
          row('Value', `${opts.amount} ETH`);
          row('Chain ID', String(tx.chainId));
          row('Data', tx.data);
          return;
        }

        console.log(JSON.stringify(tx));
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
