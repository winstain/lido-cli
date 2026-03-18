import { Command } from 'commander';
import { type Address } from 'viem';
import chalk from 'chalk';
import { LidoClient } from '../api/client';
import { getRpcUrl } from '../config/store';
import { formatEth, header, row, jsonError } from '../utils/format';

export function makeBalanceCommand(): Command {
  const cmd = new Command('balance')
    .description('Get stETH, wstETH, and ETH balances for a wallet')
    .requiredOption('--wallet <address>', 'Ethereum wallet address')
    .option('--pretty', 'Human-readable colored output')
    .action(async (opts) => {
      try {
        const address = opts.wallet as Address;
        const client = new LidoClient(getRpcUrl());

        const [eth, stETH, wstETH, rate] = await Promise.all([
          client.getETHBalance(address),
          client.getStETHBalance(address),
          client.getWstETHBalance(address),
          client.getExchangeRate(),
        ]);

        const wstETHInStETH = parseFloat(wstETH.formatted) * parseFloat(rate.stEthPerWstEth);
        const totalStETH = parseFloat(stETH.formatted) + wstETHInStETH;

        const data = {
          wallet: address,
          eth: eth.formatted,
          stETH: stETH.formatted,
          wstETH: wstETH.formatted,
          wstETHValueInStETH: wstETHInStETH.toString(),
          totalStETHEquivalent: totalStETH.toString(),
          exchangeRate: rate.stEthPerWstEth,
        };

        if (opts.pretty) {
          header(`Balances for ${address.slice(0, 6)}...${address.slice(-4)}`);
          row('ETH', `${formatEth(eth.formatted)} ETH`);
          row('stETH', `${formatEth(stETH.formatted)} stETH`);
          row('wstETH', `${formatEth(wstETH.formatted)} wstETH`);
          row('wstETH (in stETH)', `${formatEth(wstETHInStETH.toString())} stETH`);
          console.log(chalk.cyan('  ' + '-'.repeat(40)));
          row('Total stETH equivalent', `${formatEth(totalStETH.toString())} stETH`);
          row('Exchange rate', `1 wstETH = ${formatEth(rate.stEthPerWstEth)} stETH`);
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
