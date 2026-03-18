import { Command } from 'commander';
import { type Address, formatEther } from 'viem';
import chalk from 'chalk';
import { LidoClient } from '../api/client';
import { getRpcUrl } from '../config/store';
import { formatEth, formatTimestamp, header, row, jsonError } from '../utils/format';

export function makeWithdrawCommand(): Command {
  const cmd = new Command('withdraw')
    .description('Manage stETH -> ETH withdrawals');

  cmd
    .command('status')
    .description('Check withdrawal request status')
    .requiredOption('--wallet <address>', 'Wallet address')
    .option('--pretty', 'Human-readable colored output')
    .action(async (opts) => {
      try {
        const address = opts.wallet as Address;
        const client = new LidoClient(getRpcUrl());

        const requestIds = await client.getWithdrawalRequests(address);

        if (requestIds.length === 0) {
          if (opts.pretty) {
            header('Withdrawal Requests');
            console.log('  No pending withdrawal requests found.');
            return;
          }
          console.log(JSON.stringify({ wallet: address, requests: [] }));
          return;
        }

        const statuses = await client.getWithdrawalStatus(requestIds);
        const requests = requestIds.map((id, i) => ({
          requestId: id.toString(),
          amountStETH: formatEther(statuses[i].amountOfStETH),
          timestamp: formatTimestamp(statuses[i].timestamp),
          isFinalized: statuses[i].isFinalized,
          isClaimed: statuses[i].isClaimed,
          status: statuses[i].isClaimed ? 'claimed' : statuses[i].isFinalized ? 'ready_to_claim' : 'pending',
        }));

        if (opts.pretty) {
          header(`Withdrawal Requests for ${address.slice(0, 6)}...${address.slice(-4)}`);
          console.log();
          for (const r of requests) {
            const statusLabel = r.status === 'claimed'
              ? chalk.gray('Claimed')
              : r.status === 'ready_to_claim'
              ? chalk.green('Ready to claim')
              : chalk.yellow('Pending');
            row(`Request #${r.requestId}`, '');
            row('  Amount', `${formatEth(r.amountStETH)} stETH`);
            row('  Requested', r.timestamp);
            row('  Status', statusLabel);
            console.log();
          }
          return;
        }

        console.log(JSON.stringify({ wallet: address, requests }));
      } catch (err) {
        if (err instanceof Error) {
          jsonError(err.message, 'RPC_ERROR', 1);
        } else {
          jsonError('Unknown error', 'UNKNOWN', 1);
        }
      }
    });

  cmd
    .command('request')
    .description('Build a transaction to request a withdrawal')
    .requiredOption('--amount <stETH>', 'Amount of stETH to withdraw')
    .requiredOption('--wallet <address>', 'Wallet address (owner of withdrawal)')
    .option('--pretty', 'Human-readable colored output')
    .action(async (opts) => {
      try {
        const num = parseFloat(opts.amount);
        if (isNaN(num) || num <= 0) {
          jsonError('Invalid amount. Must be a positive number.', 'INVALID_INPUT', 1);
          return;
        }

        const client = new LidoClient(getRpcUrl());
        const tx = client.buildWithdrawTransaction(opts.amount, opts.wallet as Address);
        const data = { ...tx, from: opts.wallet };

        if (opts.pretty) {
          header(`Request Withdrawal: ${opts.amount} stETH -> ETH`);
          row('From', opts.wallet);
          row('Amount', `${opts.amount} stETH`);
          row('Contract', tx.to);
          row('Action', tx.description);
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
