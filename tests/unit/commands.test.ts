// Mock viem BEFORE any imports to prevent heavy module loading
jest.mock('viem', () => ({
  createPublicClient: jest.fn(() => ({
    readContract: jest.fn(),
    getBalance: jest.fn(),
  })),
  http: jest.fn(),
  formatEther: (v: bigint) => (Number(v) / 1e18).toString(),
  formatEth: (v: bigint) => (Number(v) / 1e18).toString(),
  parseEther: (v: string) => BigInt(Math.floor(parseFloat(v) * 1e18)),
}));

jest.mock('viem/chains', () => ({
  mainnet: { id: 1, name: 'Ethereum' },
}));

// Mock the LidoClient
const mockGetProtocolStats = jest.fn();
const mockGetExchangeRate = jest.fn();
const mockGetWithdrawalQueueStats = jest.fn();
const mockGetETHBalance = jest.fn();
const mockGetStETHBalance = jest.fn();
const mockGetWstETHBalance = jest.fn();
const mockGetWithdrawalRequests = jest.fn();
const mockGetWithdrawalStatus = jest.fn();
const mockBuildStakeTransaction = jest.fn();
const mockBuildWrapTransaction = jest.fn();
const mockBuildUnwrapTransaction = jest.fn();
const mockBuildWithdrawTransaction = jest.fn();

jest.mock('../../src/api/client', () => ({
  LidoClient: jest.fn().mockImplementation(() => ({
    getProtocolStats: mockGetProtocolStats,
    getExchangeRate: mockGetExchangeRate,
    getWithdrawalQueueStats: mockGetWithdrawalQueueStats,
    getETHBalance: mockGetETHBalance,
    getStETHBalance: mockGetStETHBalance,
    getWstETHBalance: mockGetWstETHBalance,
    getWithdrawalRequests: mockGetWithdrawalRequests,
    getWithdrawalStatus: mockGetWithdrawalStatus,
    buildStakeTransaction: mockBuildStakeTransaction,
    buildWrapTransaction: mockBuildWrapTransaction,
    buildUnwrapTransaction: mockBuildUnwrapTransaction,
    buildWithdrawTransaction: mockBuildWithdrawTransaction,
  })),
}));

jest.mock('../../src/config/store', () => ({
  getRpcUrl: () => 'https://mock.rpc',
  getWallet: () => null,
}));

import { makeStatsCommand } from '../../src/commands/stats';
import { makeBalanceCommand } from '../../src/commands/balance';
import { makeStakeCommand } from '../../src/commands/stake';
import { makeWrapCommand, makeUnwrapCommand } from '../../src/commands/wrap';
import { makeWithdrawCommand } from '../../src/commands/withdraw';
import { makeRewardsCommand } from '../../src/commands/rewards';

const WALLET = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

describe('commands', () => {
  const originalLog = console.log;
  const originalStderrWrite = process.stderr.write;
  let stdoutOutput: string[] = [];
  let stderrOutput: string[] = [];

  beforeEach(() => {
    stdoutOutput = [];
    stderrOutput = [];
    console.log = (...args: unknown[]) => { stdoutOutput.push(args.map(String).join(' ')); };
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrOutput.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    process.exitCode = undefined;

    mockGetProtocolStats.mockResolvedValue({
      totalPooledEther: '9185524.972880054590027928',
      totalShares: '7470491.423279998562257104',
      totalSupply: '9185524.972880054590027928',
    });
    mockGetExchangeRate.mockResolvedValue({
      stEthPerWstEth: '1.229574395100108734',
      wstEthPerStEth: '0.813289544727858954',
    });
    mockGetWithdrawalQueueStats.mockResolvedValue({
      lastFinalizedRequestId: '117807',
      unfinalizedStETH: '35921.699851594052926879',
    });
    mockGetETHBalance.mockResolvedValue({ balance: BigInt(0), formatted: '32.147143141872067472' });
    mockGetStETHBalance.mockResolvedValue({ balance: BigInt(0), formatted: '10.5' });
    mockGetWstETHBalance.mockResolvedValue({ balance: BigInt(0), formatted: '5.0' });
    mockGetWithdrawalRequests.mockResolvedValue([]);
  });

  afterEach(() => {
    console.log = originalLog;
    process.stderr.write = originalStderrWrite;
    process.exitCode = undefined;
    jest.clearAllMocks();
  });

  describe('stats', () => {
    test('outputs JSON by default', async () => {
      const cmd = makeStatsCommand();
      await cmd.parseAsync([], { from: 'user' });
      const output = JSON.parse(stdoutOutput.join(''));
      expect(output.totalPooledEther).toBe('9185524.972880054590027928');
      expect(output.exchangeRate).toBeDefined();
      expect(output.withdrawalQueue).toBeDefined();
      expect(output.contracts).toBeDefined();
    });

    test('outputs pretty format with --pretty', async () => {
      const cmd = makeStatsCommand();
      await cmd.parseAsync(['--pretty'], { from: 'user' });
      const output = stdoutOutput.join('\n');
      expect(output).toContain('Lido Protocol Statistics');
      expect(output).toContain('ETH');
    });

    test('outputs JSON error on failure', async () => {
      mockGetProtocolStats.mockRejectedValue(new Error('RPC timeout'));
      const cmd = makeStatsCommand();
      await cmd.parseAsync([], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('RPC_ERROR');
      expect(err.error).toContain('RPC timeout');
    });

    test('handles non-Error thrown value', async () => {
      mockGetProtocolStats.mockRejectedValue('string error');
      const cmd = makeStatsCommand();
      await cmd.parseAsync([], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('UNKNOWN');
    });
  });

  describe('balance', () => {
    test('outputs JSON by default', async () => {
      const cmd = makeBalanceCommand();
      await cmd.parseAsync(['--wallet', WALLET], { from: 'user' });
      const output = JSON.parse(stdoutOutput.join(''));
      expect(output.wallet).toBe(WALLET);
      expect(output.eth).toBe('32.147143141872067472');
      expect(output.stETH).toBe('10.5');
      expect(output.wstETH).toBe('5.0');
      expect(output.exchangeRate).toBeDefined();
      expect(output.totalStETHEquivalent).toBeDefined();
      expect(output.wstETHValueInStETH).toBeDefined();
    });

    test('outputs pretty format with --pretty', async () => {
      const cmd = makeBalanceCommand();
      await cmd.parseAsync(['--wallet', WALLET, '--pretty'], { from: 'user' });
      const output = stdoutOutput.join('\n');
      expect(output).toContain('Balances for');
      expect(output).toContain('stETH');
    });

    test('outputs JSON error on failure', async () => {
      mockGetETHBalance.mockRejectedValue(new Error('Connection refused'));
      const cmd = makeBalanceCommand();
      await cmd.parseAsync(['--wallet', WALLET], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('RPC_ERROR');
    });

    test('handles non-Error thrown value', async () => {
      mockGetETHBalance.mockRejectedValue(42);
      const cmd = makeBalanceCommand();
      await cmd.parseAsync(['--wallet', WALLET], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('UNKNOWN');
    });
  });

  describe('stake', () => {
    beforeEach(() => {
      mockBuildStakeTransaction.mockReturnValue({
        to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        value: '1000000000000000000',
        data: 'submit(0x0000000000000000000000000000000000000000)',
        description: 'Stake 1 ETH via Lido to receive stETH',
      });
    });

    test('outputs JSON by default', async () => {
      const cmd = makeStakeCommand();
      await cmd.parseAsync(['--amount', '1', '--wallet', WALLET], { from: 'user' });
      const output = JSON.parse(stdoutOutput.join(''));
      expect(output.to).toBe('0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84');
      expect(output.from).toBe(WALLET);
      expect(output.description).toBeDefined();
    });

    test('rejects invalid amount', async () => {
      const cmd = makeStakeCommand();
      await cmd.parseAsync(['--amount', '-5', '--wallet', WALLET], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('INVALID_INPUT');
    });

    test('rejects non-numeric amount', async () => {
      const cmd = makeStakeCommand();
      await cmd.parseAsync(['--amount', 'abc', '--wallet', WALLET], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('INVALID_INPUT');
    });

    test('rejects zero amount', async () => {
      const cmd = makeStakeCommand();
      await cmd.parseAsync(['--amount', '0', '--wallet', WALLET], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('INVALID_INPUT');
    });

    test('outputs pretty format with --pretty', async () => {
      const cmd = makeStakeCommand();
      await cmd.parseAsync(['--amount', '1', '--wallet', WALLET, '--pretty'], { from: 'user' });
      const output = stdoutOutput.join('\n');
      expect(output).toContain('Stake');
      expect(output).toContain('ETH');
    });

    test('outputs JSON error on failure', async () => {
      mockBuildStakeTransaction.mockImplementation(() => { throw new Error('fail'); });
      const cmd = makeStakeCommand();
      await cmd.parseAsync(['--amount', '1', '--wallet', WALLET], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('RPC_ERROR');
    });

    test('handles non-Error thrown value', async () => {
      mockBuildStakeTransaction.mockImplementation(() => { throw null; });
      const cmd = makeStakeCommand();
      await cmd.parseAsync(['--amount', '1', '--wallet', WALLET], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('UNKNOWN');
    });
  });

  describe('wrap', () => {
    beforeEach(() => {
      mockBuildWrapTransaction.mockReturnValue({
        to: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
        data: 'wrap(...)',
        description: 'Wrap 10 stETH into wstETH',
        note: 'Requires stETH approval for wstETH contract first',
      });
    });

    test('outputs JSON by default', async () => {
      const cmd = makeWrapCommand();
      await cmd.parseAsync(['--amount', '10'], { from: 'user' });
      const output = JSON.parse(stdoutOutput.join(''));
      expect(output.to).toBe('0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0');
      expect(output.estimatedOutput).toBeDefined();
      expect(output.rate).toBeDefined();
    });

    test('rejects zero amount', async () => {
      const cmd = makeWrapCommand();
      await cmd.parseAsync(['--amount', '0'], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('INVALID_INPUT');
    });

    test('rejects negative amount', async () => {
      const cmd = makeWrapCommand();
      await cmd.parseAsync(['--amount', '-1'], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('INVALID_INPUT');
    });

    test('rejects non-numeric amount', async () => {
      const cmd = makeWrapCommand();
      await cmd.parseAsync(['--amount', 'xyz'], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('INVALID_INPUT');
    });

    test('outputs pretty format with --pretty', async () => {
      const cmd = makeWrapCommand();
      await cmd.parseAsync(['--amount', '10', '--pretty'], { from: 'user' });
      const output = stdoutOutput.join('\n');
      expect(output).toContain('Wrap');
      expect(output).toContain('stETH');
    });

    test('outputs JSON error on failure', async () => {
      mockGetExchangeRate.mockRejectedValue(new Error('fail'));
      const cmd = makeWrapCommand();
      await cmd.parseAsync(['--amount', '10'], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('RPC_ERROR');
    });

    test('handles non-Error thrown value', async () => {
      mockGetExchangeRate.mockRejectedValue(undefined);
      const cmd = makeWrapCommand();
      await cmd.parseAsync(['--amount', '10'], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('UNKNOWN');
    });
  });

  describe('unwrap', () => {
    beforeEach(() => {
      mockBuildUnwrapTransaction.mockReturnValue({
        to: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
        data: 'unwrap(...)',
        description: 'Unwrap 5 wstETH back to stETH',
      });
    });

    test('outputs JSON by default', async () => {
      const cmd = makeUnwrapCommand();
      await cmd.parseAsync(['--amount', '5'], { from: 'user' });
      const output = JSON.parse(stdoutOutput.join(''));
      expect(output.to).toBe('0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0');
      expect(output.estimatedOutput).toBeDefined();
    });

    test('rejects negative amount', async () => {
      const cmd = makeUnwrapCommand();
      await cmd.parseAsync(['--amount', '-1'], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('INVALID_INPUT');
    });

    test('rejects zero amount', async () => {
      const cmd = makeUnwrapCommand();
      await cmd.parseAsync(['--amount', '0'], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('INVALID_INPUT');
    });

    test('rejects non-numeric amount', async () => {
      const cmd = makeUnwrapCommand();
      await cmd.parseAsync(['--amount', 'abc'], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('INVALID_INPUT');
    });

    test('outputs pretty format with --pretty', async () => {
      const cmd = makeUnwrapCommand();
      await cmd.parseAsync(['--amount', '5', '--pretty'], { from: 'user' });
      const output = stdoutOutput.join('\n');
      expect(output).toContain('Unwrap');
      expect(output).toContain('stETH');
    });

    test('outputs JSON error on failure', async () => {
      mockGetExchangeRate.mockRejectedValue(new Error('fail'));
      const cmd = makeUnwrapCommand();
      await cmd.parseAsync(['--amount', '5'], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('RPC_ERROR');
    });

    test('handles non-Error thrown value', async () => {
      mockGetExchangeRate.mockRejectedValue(false);
      const cmd = makeUnwrapCommand();
      await cmd.parseAsync(['--amount', '5'], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('UNKNOWN');
    });
  });

  describe('rewards', () => {
    test('outputs JSON without wallet', async () => {
      const cmd = makeRewardsCommand();
      await cmd.parseAsync([], { from: 'user' });
      const output = JSON.parse(stdoutOutput.join(''));
      expect(output.protocol).toBeDefined();
      expect(output.protocol.totalPooledEther).toBeDefined();
      expect(output.wallet).toBeUndefined();
    });

    test('includes wallet data when provided', async () => {
      const cmd = makeRewardsCommand();
      await cmd.parseAsync(['--wallet', WALLET], { from: 'user' });
      const output = JSON.parse(stdoutOutput.join(''));
      expect(output.wallet).toBeDefined();
      expect(output.wallet.stETH).toBe('10.5');
      expect(output.wallet.totalStakedStETH).toBeDefined();
    });

    test('outputs pretty format with --pretty', async () => {
      const cmd = makeRewardsCommand();
      await cmd.parseAsync(['--pretty'], { from: 'user' });
      const output = stdoutOutput.join('\n');
      expect(output).toContain('Lido Staking Rewards');
    });

    test('outputs pretty with wallet', async () => {
      const cmd = makeRewardsCommand();
      await cmd.parseAsync(['--wallet', WALLET, '--pretty'], { from: 'user' });
      const output = stdoutOutput.join('\n');
      expect(output).toContain('Your Position');
    });

    test('outputs JSON error on failure', async () => {
      mockGetProtocolStats.mockRejectedValue(new Error('fail'));
      const cmd = makeRewardsCommand();
      await cmd.parseAsync([], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('RPC_ERROR');
    });

    test('handles non-Error thrown value', async () => {
      mockGetProtocolStats.mockRejectedValue(0);
      const cmd = makeRewardsCommand();
      await cmd.parseAsync([], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('UNKNOWN');
    });
  });

  describe('withdraw', () => {
    test('status outputs JSON with no requests', async () => {
      mockGetWithdrawalRequests.mockResolvedValue([]);
      const cmd = makeWithdrawCommand();
      await cmd.parseAsync(['status', '--wallet', WALLET], { from: 'user' });
      const output = JSON.parse(stdoutOutput.join(''));
      expect(output.wallet).toBe(WALLET);
      expect(output.requests).toEqual([]);
    });

    test('status outputs JSON with requests', async () => {
      mockGetWithdrawalRequests.mockResolvedValue([BigInt(100), BigInt(101)]);
      mockGetWithdrawalStatus.mockResolvedValue([
        {
          amountOfStETH: BigInt('5000000000000000000'),
          amountOfShares: BigInt('4000000000000000000'),
          owner: WALLET,
          timestamp: BigInt(1700000000),
          isFinalized: true,
          isClaimed: false,
        },
        {
          amountOfStETH: BigInt('3000000000000000000'),
          amountOfShares: BigInt('2400000000000000000'),
          owner: WALLET,
          timestamp: BigInt(1700100000),
          isFinalized: false,
          isClaimed: false,
        },
      ]);
      const cmd = makeWithdrawCommand();
      await cmd.parseAsync(['status', '--wallet', WALLET], { from: 'user' });
      const output = JSON.parse(stdoutOutput.join(''));
      expect(output.requests).toHaveLength(2);
      expect(output.requests[0].status).toBe('ready_to_claim');
      expect(output.requests[1].status).toBe('pending');
    });

    test('status with claimed request', async () => {
      mockGetWithdrawalRequests.mockResolvedValue([BigInt(99)]);
      mockGetWithdrawalStatus.mockResolvedValue([
        {
          amountOfStETH: BigInt('1000000000000000000'),
          amountOfShares: BigInt('800000000000000000'),
          owner: WALLET,
          timestamp: BigInt(1700000000),
          isFinalized: true,
          isClaimed: true,
        },
      ]);
      const cmd = makeWithdrawCommand();
      await cmd.parseAsync(['status', '--wallet', WALLET], { from: 'user' });
      const output = JSON.parse(stdoutOutput.join(''));
      expect(output.requests[0].status).toBe('claimed');
    });

    test('status pretty with no requests', async () => {
      mockGetWithdrawalRequests.mockResolvedValue([]);
      const cmd = makeWithdrawCommand();
      await cmd.parseAsync(['status', '--wallet', WALLET, '--pretty'], { from: 'user' });
      const output = stdoutOutput.join('\n');
      expect(output).toContain('No pending withdrawal requests found');
    });

    test('status pretty with requests', async () => {
      mockGetWithdrawalRequests.mockResolvedValue([BigInt(100)]);
      mockGetWithdrawalStatus.mockResolvedValue([
        {
          amountOfStETH: BigInt('5000000000000000000'),
          amountOfShares: BigInt('4000000000000000000'),
          owner: WALLET,
          timestamp: BigInt(1700000000),
          isFinalized: true,
          isClaimed: false,
        },
      ]);
      const cmd = makeWithdrawCommand();
      await cmd.parseAsync(['status', '--wallet', WALLET, '--pretty'], { from: 'user' });
      const output = stdoutOutput.join('\n');
      expect(output).toContain('Withdrawal Requests');
    });

    test('status outputs JSON error on failure', async () => {
      mockGetWithdrawalRequests.mockRejectedValue(new Error('fail'));
      const cmd = makeWithdrawCommand();
      await cmd.parseAsync(['status', '--wallet', WALLET], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('RPC_ERROR');
    });

    test('status handles non-Error thrown value', async () => {
      mockGetWithdrawalRequests.mockRejectedValue(null);
      const cmd = makeWithdrawCommand();
      await cmd.parseAsync(['status', '--wallet', WALLET], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('UNKNOWN');
    });

    test('request outputs JSON', async () => {
      mockBuildWithdrawTransaction.mockReturnValue({
        to: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1',
        data: 'requestWithdrawals(...)',
        description: 'Request withdrawal of 5 stETH to ETH',
        note: 'Requires stETH approval',
      });
      const cmd = makeWithdrawCommand();
      await cmd.parseAsync(['request', '--amount', '5', '--wallet', WALLET], { from: 'user' });
      const output = JSON.parse(stdoutOutput.join(''));
      expect(output.to).toBe('0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1');
      expect(output.from).toBe(WALLET);
    });

    test('request pretty output', async () => {
      mockBuildWithdrawTransaction.mockReturnValue({
        to: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1',
        data: 'requestWithdrawals(...)',
        description: 'Request withdrawal of 5 stETH to ETH',
        note: 'Requires stETH approval',
      });
      const cmd = makeWithdrawCommand();
      await cmd.parseAsync(['request', '--amount', '5', '--wallet', WALLET, '--pretty'], { from: 'user' });
      const output = stdoutOutput.join('\n');
      expect(output).toContain('Request Withdrawal');
    });

    test('request rejects invalid amount', async () => {
      const cmd = makeWithdrawCommand();
      await cmd.parseAsync(['request', '--amount', '0', '--wallet', WALLET], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('INVALID_INPUT');
    });

    test('request rejects non-numeric amount', async () => {
      const cmd = makeWithdrawCommand();
      await cmd.parseAsync(['request', '--amount', 'abc', '--wallet', WALLET], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('INVALID_INPUT');
    });

    test('request outputs JSON error on failure', async () => {
      mockBuildWithdrawTransaction.mockImplementation(() => { throw new Error('fail'); });
      const cmd = makeWithdrawCommand();
      await cmd.parseAsync(['request', '--amount', '5', '--wallet', WALLET], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('RPC_ERROR');
    });

    test('request handles non-Error thrown value', async () => {
      mockBuildWithdrawTransaction.mockImplementation(() => { throw 'oops'; });
      const cmd = makeWithdrawCommand();
      await cmd.parseAsync(['request', '--amount', '5', '--wallet', WALLET], { from: 'user' });
      const err = JSON.parse(stderrOutput[0]);
      expect(err.code).toBe('UNKNOWN');
    });
  });
});
