import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { type Address } from 'viem';
import { LidoClient } from './api/client';
import { getRpcUrl } from './config/store';

const pkg = require('../package.json');

function getClient(): LidoClient {
  return new LidoClient(getRpcUrl());
}

export async function startMcpServer() {
  const server = new McpServer({
    name: 'lido-cli',
    version: pkg.version,
  });

  // Balance tool
  server.tool(
    'lido_balance',
    'Get stETH, wstETH, and ETH balances for a wallet',
    { wallet: z.string().describe('Ethereum wallet address') },
    async ({ wallet }) => {
      const client = getClient();
      const address = wallet as Address;
      const [eth, stETH, wstETH, rate] = await Promise.all([
        client.getETHBalance(address),
        client.getStETHBalance(address),
        client.getWstETHBalance(address),
        client.getExchangeRate(),
      ]);
      const wstETHInStETH = parseFloat(wstETH.formatted) * parseFloat(rate.stEthPerWstEth);
      const totalStETH = parseFloat(stETH.formatted) + wstETHInStETH;
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            wallet: address,
            eth: eth.formatted,
            stETH: stETH.formatted,
            wstETH: wstETH.formatted,
            wstETHValueInStETH: wstETHInStETH.toString(),
            totalStETHEquivalent: totalStETH.toString(),
            exchangeRate: rate.stEthPerWstEth,
          }, null, 2),
        }],
      };
    },
  );

  // Stats tool
  server.tool(
    'lido_stats',
    'Get Lido protocol statistics (total pooled ETH, exchange rates, withdrawal queue)',
    {},
    async () => {
      const client = getClient();
      const [protocol, rate, queue] = await Promise.all([
        client.getProtocolStats(),
        client.getExchangeRate(),
        client.getWithdrawalQueueStats(),
      ]);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            totalPooledEther: protocol.totalPooledEther,
            totalShares: protocol.totalShares,
            totalSupply: protocol.totalSupply,
            exchangeRate: rate,
            withdrawalQueue: queue,
          }, null, 2),
        }],
      };
    },
  );

  // Rewards tool
  server.tool(
    'lido_rewards',
    'Get staking rewards info and optionally a wallet position',
    { wallet: z.string().optional().describe('Ethereum wallet address (optional)') },
    async ({ wallet }) => {
      const client = getClient();
      const [protocol, rate, queue] = await Promise.all([
        client.getProtocolStats(),
        client.getExchangeRate(),
        client.getWithdrawalQueueStats(),
      ]);

      let walletData: any = null;
      if (wallet) {
        const address = wallet as Address;
        const [stETH, wstETH] = await Promise.all([
          client.getStETHBalance(address),
          client.getWstETHBalance(address),
        ]);
        const wstETHInStETH = parseFloat(wstETH.formatted) * parseFloat(rate.stEthPerWstEth);
        walletData = {
          wallet: address,
          stETH: stETH.formatted,
          wstETH: wstETH.formatted,
          totalStakedStETH: (parseFloat(stETH.formatted) + wstETHInStETH).toString(),
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            protocol: {
              totalPooledEther: protocol.totalPooledEther,
              exchangeRate: rate.stEthPerWstEth,
              unfinalizedWithdrawals: queue.unfinalizedStETH,
            },
            ...(walletData ? { wallet: walletData } : {}),
          }, null, 2),
        }],
      };
    },
  );

  // Stake tool
  server.tool(
    'lido_stake',
    'Build a transaction to stake ETH via Lido (returns calldata, does not execute)',
    {
      amount: z.string().describe('Amount of ETH to stake'),
      wallet: z.string().describe('Wallet address'),
    },
    async ({ amount, wallet }) => {
      const client = getClient();
      const tx = client.buildStakeTransaction(amount);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ...tx, from: wallet }, null, 2),
        }],
      };
    },
  );

  // Wrap tool
  server.tool(
    'lido_wrap',
    'Build a transaction to wrap stETH into wstETH',
    { amount: z.string().describe('Amount of stETH to wrap') },
    async ({ amount }) => {
      const client = getClient();
      const [tx, rate] = await Promise.all([
        Promise.resolve(client.buildWrapTransaction(amount)),
        client.getExchangeRate(),
      ]);
      const estimatedWstETH = parseFloat(amount) * parseFloat(rate.wstEthPerStEth);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ...tx, estimatedOutput: estimatedWstETH.toString(), rate: rate.wstEthPerStEth }, null, 2),
        }],
      };
    },
  );

  // Unwrap tool
  server.tool(
    'lido_unwrap',
    'Build a transaction to unwrap wstETH back to stETH',
    { amount: z.string().describe('Amount of wstETH to unwrap') },
    async ({ amount }) => {
      const client = getClient();
      const [tx, rate] = await Promise.all([
        Promise.resolve(client.buildUnwrapTransaction(amount)),
        client.getExchangeRate(),
      ]);
      const estimatedStETH = parseFloat(amount) * parseFloat(rate.stEthPerWstEth);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ...tx, estimatedOutput: estimatedStETH.toString(), rate: rate.stEthPerWstEth }, null, 2),
        }],
      };
    },
  );

  // Withdrawal status tool
  server.tool(
    'lido_withdrawal_status',
    'Check withdrawal request status for a wallet',
    { wallet: z.string().describe('Ethereum wallet address') },
    async ({ wallet }) => {
      const client = getClient();
      const address = wallet as Address;
      const requestIds = await client.getWithdrawalRequests(address);

      if (requestIds.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ wallet: address, requests: [] }, null, 2),
          }],
        };
      }

      const { formatEther } = await import('viem');
      const statuses = await client.getWithdrawalStatus(requestIds);
      const requests = requestIds.map((id, i) => ({
        requestId: id.toString(),
        amountStETH: formatEther(statuses[i].amountOfStETH),
        timestamp: new Date(Number(statuses[i].timestamp) * 1000).toISOString(),
        isFinalized: statuses[i].isFinalized,
        isClaimed: statuses[i].isClaimed,
        status: statuses[i].isClaimed ? 'claimed' : statuses[i].isFinalized ? 'ready_to_claim' : 'pending',
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ wallet: address, requests }, null, 2),
        }],
      };
    },
  );

  // Withdraw request tool
  server.tool(
    'lido_withdraw_request',
    'Build a transaction to request a withdrawal of stETH to ETH',
    {
      amount: z.string().describe('Amount of stETH to withdraw'),
      wallet: z.string().describe('Wallet address (owner of withdrawal)'),
    },
    async ({ amount, wallet }) => {
      const client = getClient();
      const tx = client.buildWithdrawTransaction(amount, wallet as Address);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ...tx, from: wallet }, null, 2),
        }],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
