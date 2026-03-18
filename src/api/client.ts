import {
  createPublicClient,
  http,
  formatEther,
  parseEther,
  encodeFunctionData,
  type PublicClient,
  type Address,
} from 'viem';
import { mainnet } from 'viem/chains';
import { CONTRACTS } from '../config/contracts';
import { stETHAbi, wstETHAbi, withdrawalQueueAbi } from '../config/abis';

export interface UnsignedEvmTx {
  to: Address;
  data: `0x${string}`;
  value: string;
  chainId: number;
  from?: Address;
  description?: string;
  note?: string;
}

export class LidoClient {
  private client: PublicClient;

  constructor(rpcUrl: string) {
    this.client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    }) as PublicClient;
  }

  async getStETHBalance(address: Address): Promise<{ balance: bigint; formatted: string }> {
    const balance = await this.client.readContract({
      address: CONTRACTS.stETH,
      abi: stETHAbi,
      functionName: 'balanceOf',
      args: [address],
    });
    return { balance, formatted: formatEther(balance) };
  }

  async getWstETHBalance(address: Address): Promise<{ balance: bigint; formatted: string }> {
    const balance = await this.client.readContract({
      address: CONTRACTS.wstETH,
      abi: wstETHAbi,
      functionName: 'balanceOf',
      args: [address],
    });
    return { balance, formatted: formatEther(balance) };
  }

  async getETHBalance(address: Address): Promise<{ balance: bigint; formatted: string }> {
    const balance = await this.client.getBalance({ address });
    return { balance, formatted: formatEther(balance) };
  }

  async getExchangeRate(): Promise<{ stEthPerWstEth: string; wstEthPerStEth: string }> {
    const stEthPerToken = await this.client.readContract({
      address: CONTRACTS.wstETH,
      abi: wstETHAbi,
      functionName: 'stEthPerToken',
    });
    const wstEthPerStEth = (BigInt(10 ** 18) * BigInt(10 ** 18)) / stEthPerToken;
    return {
      stEthPerWstEth: formatEther(stEthPerToken),
      wstEthPerStEth: formatEther(wstEthPerStEth),
    };
  }

  async getProtocolStats(): Promise<{
    totalPooledEther: string;
    totalShares: string;
    totalSupply: string;
  }> {
    const [totalPooledEther, totalShares, totalSupply] = await Promise.all([
      this.client.readContract({
        address: CONTRACTS.stETH,
        abi: stETHAbi,
        functionName: 'getTotalPooledEther',
      }),
      this.client.readContract({
        address: CONTRACTS.stETH,
        abi: stETHAbi,
        functionName: 'getTotalShares',
      }),
      this.client.readContract({
        address: CONTRACTS.stETH,
        abi: stETHAbi,
        functionName: 'totalSupply',
      }),
    ]);
    return {
      totalPooledEther: formatEther(totalPooledEther),
      totalShares: formatEther(totalShares),
      totalSupply: formatEther(totalSupply),
    };
  }

  async getWithdrawalRequests(address: Address): Promise<bigint[]> {
    return [
      ...(await this.client.readContract({
        address: CONTRACTS.withdrawalQueue,
        abi: withdrawalQueueAbi,
        functionName: 'getWithdrawalRequests',
        args: [address],
      })),
    ];
  }

  async getWithdrawalStatus(requestIds: bigint[]): Promise<
    Array<{
      amountOfStETH: bigint;
      amountOfShares: bigint;
      owner: Address;
      timestamp: bigint;
      isFinalized: boolean;
      isClaimed: boolean;
    }>
  > {
    if (requestIds.length === 0) return [];
    const result = await this.client.readContract({
      address: CONTRACTS.withdrawalQueue,
      abi: withdrawalQueueAbi,
      functionName: 'getWithdrawalStatus',
      args: [requestIds],
    });
    return result as any;
  }

  async getWithdrawalQueueStats(): Promise<{
    lastFinalizedRequestId: string;
    unfinalizedStETH: string;
  }> {
    const [lastFinalized, unfinalized] = await Promise.all([
      this.client.readContract({
        address: CONTRACTS.withdrawalQueue,
        abi: withdrawalQueueAbi,
        functionName: 'getLastFinalizedRequestId',
      }),
      this.client.readContract({
        address: CONTRACTS.withdrawalQueue,
        abi: withdrawalQueueAbi,
        functionName: 'unfinalizedStETH',
      }),
    ]);
    return {
      lastFinalizedRequestId: lastFinalized.toString(),
      unfinalizedStETH: formatEther(unfinalized),
    };
  }

  private withCommonTxFields(
    tx: Omit<UnsignedEvmTx, 'chainId'>,
    from?: Address,
  ): UnsignedEvmTx {
    return {
      ...tx,
      chainId: mainnet.id,
      ...(from ? { from } : {}),
    };
  }

  buildStakeTransaction(
    amount: string,
    referral: Address = '0x0000000000000000000000000000000000000000',
    from?: Address,
  ): UnsignedEvmTx {
    const data = encodeFunctionData({
      abi: stETHAbi,
      functionName: 'submit',
      args: [referral],
    });

    return this.withCommonTxFields(
      {
        to: CONTRACTS.stETH,
        value: parseEther(amount).toString(),
        data,
        description: `Stake ${amount} ETH via Lido to receive stETH`,
      },
      from,
    );
  }

  buildStEthApproveTransaction(amount: string, spender: Address, from?: Address): UnsignedEvmTx {
    const data = encodeFunctionData({
      abi: stETHAbi,
      functionName: 'approve',
      args: [spender, parseEther(amount)],
    });

    return this.withCommonTxFields(
      {
        to: CONTRACTS.stETH,
        value: '0',
        data,
        description: `Approve ${amount} stETH for ${spender}`,
      },
      from,
    );
  }

  buildWrapTransaction(stETHAmount: string, from?: Address): UnsignedEvmTx {
    const data = encodeFunctionData({
      abi: wstETHAbi,
      functionName: 'wrap',
      args: [parseEther(stETHAmount)],
    });

    return this.withCommonTxFields(
      {
        to: CONTRACTS.wstETH,
        value: '0',
        data,
        description: `Wrap ${stETHAmount} stETH into wstETH`,
      },
      from,
    );
  }

  buildUnwrapTransaction(wstETHAmount: string, from?: Address): UnsignedEvmTx {
    const data = encodeFunctionData({
      abi: wstETHAbi,
      functionName: 'unwrap',
      args: [parseEther(wstETHAmount)],
    });

    return this.withCommonTxFields(
      {
        to: CONTRACTS.wstETH,
        value: '0',
        data,
        description: `Unwrap ${wstETHAmount} wstETH back to stETH`,
      },
      from,
    );
  }

  buildWithdrawTransaction(stETHAmount: string, owner: Address, from?: Address): UnsignedEvmTx {
    const data = encodeFunctionData({
      abi: withdrawalQueueAbi,
      functionName: 'requestWithdrawals',
      args: [[parseEther(stETHAmount)], owner],
    });

    return this.withCommonTxFields(
      {
        to: CONTRACTS.withdrawalQueue,
        value: '0',
        data,
        description: `Request withdrawal of ${stETHAmount} stETH to ETH`,
      },
      from,
    );
  }
}
