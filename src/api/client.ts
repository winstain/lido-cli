import { createPublicClient, http, formatEther, parseEther, type PublicClient, type Address } from 'viem';
import { mainnet } from 'viem/chains';
import { CONTRACTS } from '../config/contracts';
import { stETHAbi, wstETHAbi, withdrawalQueueAbi } from '../config/abis';

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
    // Compute inverse: wstETH per stETH = 1e18 * 1e18 / stEthPerToken
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
    return [...await this.client.readContract({
      address: CONTRACTS.withdrawalQueue,
      abi: withdrawalQueueAbi,
      functionName: 'getWithdrawalRequests',
      args: [address],
    })];
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

  // Build transaction calldata (does not execute)
  buildStakeTransaction(amount: string, referral: Address = '0x0000000000000000000000000000000000000000') {
    return {
      to: CONTRACTS.stETH,
      value: parseEther(amount).toString(),
      data: `submit(${referral})`,
      description: `Stake ${amount} ETH via Lido to receive stETH`,
    };
  }

  buildWrapTransaction(stETHAmount: string) {
    return {
      to: CONTRACTS.wstETH,
      data: `wrap(${parseEther(stETHAmount).toString()})`,
      description: `Wrap ${stETHAmount} stETH into wstETH`,
      note: 'Requires stETH approval for wstETH contract first',
    };
  }

  buildUnwrapTransaction(wstETHAmount: string) {
    return {
      to: CONTRACTS.wstETH,
      data: `unwrap(${parseEther(wstETHAmount).toString()})`,
      description: `Unwrap ${wstETHAmount} wstETH back to stETH`,
    };
  }

  buildWithdrawTransaction(stETHAmount: string, owner: Address) {
    return {
      to: CONTRACTS.withdrawalQueue,
      data: `requestWithdrawals([${parseEther(stETHAmount).toString()}], ${owner})`,
      description: `Request withdrawal of ${stETHAmount} stETH to ETH`,
      note: 'Requires stETH approval for withdrawal queue contract first',
    };
  }
}
