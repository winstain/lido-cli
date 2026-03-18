import { Command } from 'commander';
import { type Address } from 'viem';
import { LidoClient } from '../api/client';
import { getRpcUrl } from '../config/store';
import { formatEth, header, row, jsonError } from '../utils/format';

export function makeRewardsCommand(): Command {
  const cmd = new Command('rewards')
    .description('Get staking rewards and protocol APR information')
    .option('--wallet <address>', 'Wallet address (optional, shows personal position)')
    .option('--pretty', 'Human-readable colored output')
    .action(async (opts) => {
      try {
        const client = new LidoClient(getRpcUrl());

        const [protocol, rate, queue] = await Promise.all([
          client.getProtocolStats(),
          client.getExchangeRate(),
          client.getWithdrawalQueueStats(),
        ]);

        const stEthPerWstEth = parseFloat(rate.stEthPerWstEth);
        let walletData: any = null;

        if (opts.wallet) {
          const address = opts.wallet as Address;
          const [stETH, wstETH] = await Promise.all([
            client.getStETHBalance(address),
            client.getWstETHBalance(address),
          ]);
          const wstETHInStETH = parseFloat(wstETH.formatted) * stEthPerWstEth;
          walletData = {
            wallet: address,
            stETH: stETH.formatted,
            wstETH: wstETH.formatted,
            totalStakedStETH: (parseFloat(stETH.formatted) + wstETHInStETH).toString(),
          };
        }

        const data = {
          protocol: {
            totalPooledEther: protocol.totalPooledEther,
            exchangeRate: rate.stEthPerWstEth,
            unfinalizedWithdrawals: queue.unfinalizedStETH,
          },
          ...(walletData ? { wallet: walletData } : {}),
        };

        if (opts.pretty) {
          header('Lido Staking Rewards');
          row('Total Pooled ETH', `${formatEth(protocol.totalPooledEther)} ETH`);
          row('Exchange Rate', `1 wstETH = ${formatEth(rate.stEthPerWstEth)} stETH`);
          row('Pending Withdrawals', `${formatEth(queue.unfinalizedStETH)} stETH`);
          if (walletData) {
            console.log();
            header(`Your Position (${walletData.wallet.slice(0, 6)}...${walletData.wallet.slice(-4)})`);
            row('stETH Balance', `${formatEth(walletData.stETH)} stETH`);
            row('wstETH Balance', `${formatEth(walletData.wstETH)} wstETH`);
            row('Total Staked', `${formatEth(walletData.totalStakedStETH)} stETH`);
          }
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
