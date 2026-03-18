import { Command } from 'commander';
import { LidoClient } from '../api/client';
import { getRpcUrl } from '../config/store';
import { CONTRACTS } from '../config/contracts';
import { formatEth, header, row, jsonError } from '../utils/format';

export function makeStatsCommand(): Command {
  const cmd = new Command('stats')
    .description('Get Lido protocol statistics')
    .option('--pretty', 'Human-readable colored output')
    .action(async (opts) => {
      try {
        const client = new LidoClient(getRpcUrl());

        const [protocol, rate, queue] = await Promise.all([
          client.getProtocolStats(),
          client.getExchangeRate(),
          client.getWithdrawalQueueStats(),
        ]);

        const data = {
          totalPooledEther: protocol.totalPooledEther,
          totalShares: protocol.totalShares,
          totalSupply: protocol.totalSupply,
          exchangeRate: rate,
          withdrawalQueue: queue,
          contracts: CONTRACTS,
        };

        if (opts.pretty) {
          header('Lido Protocol Statistics');
          row('Total Pooled ETH', `${formatEth(protocol.totalPooledEther)} ETH`);
          row('Total stETH Supply', `${formatEth(protocol.totalSupply)} stETH`);
          row('Total Shares', formatEth(protocol.totalShares));
          console.log();
          row('stETH per wstETH', formatEth(rate.stEthPerWstEth));
          row('wstETH per stETH', formatEth(rate.wstEthPerStEth));
          console.log();
          row('Last Finalized ID', queue.lastFinalizedRequestId);
          row('Unfinalized stETH', `${formatEth(queue.unfinalizedStETH)} stETH`);
          console.log();
          row('stETH Contract', CONTRACTS.stETH);
          row('wstETH Contract', CONTRACTS.wstETH);
          row('Withdrawal Queue', CONTRACTS.withdrawalQueue);
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
