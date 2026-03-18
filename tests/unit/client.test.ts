const mockReadContract = jest.fn();
const mockGetBalance = jest.fn();

jest.mock('viem', () => {
  const actual = jest.requireActual('viem');
  return {
    ...actual,
    createPublicClient: jest.fn(() => ({
      readContract: mockReadContract,
      getBalance: mockGetBalance,
    })),
    http: jest.fn(),
  };
});

jest.mock('viem/chains', () => ({
  mainnet: { id: 1, name: 'Ethereum' },
}));

import { LidoClient } from '../../src/api/client';

describe('LidoClient', () => {
  let client: LidoClient;

  beforeEach(() => {
    client = new LidoClient('https://test.rpc');
    jest.clearAllMocks();
  });

  describe('getStETHBalance', () => {
    test('returns formatted balance', async () => {
      mockReadContract.mockResolvedValue(BigInt('10500000000000000000'));
      const result = await client.getStETHBalance('0xabc' as `0x${string}`);
      expect(result.formatted).toBe('10.5');
      expect(result.balance).toBe(BigInt('10500000000000000000'));
    });

    test('handles zero balance', async () => {
      mockReadContract.mockResolvedValue(BigInt(0));
      const result = await client.getStETHBalance('0xabc' as `0x${string}`);
      expect(result.formatted).toBe('0');
    });
  });

  describe('getWstETHBalance', () => {
    test('returns formatted balance', async () => {
      mockReadContract.mockResolvedValue(BigInt('5000000000000000000'));
      const result = await client.getWstETHBalance('0xabc' as `0x${string}`);
      expect(result.formatted).toBe('5');
      expect(result.balance).toBe(BigInt('5000000000000000000'));
    });
  });

  describe('getETHBalance', () => {
    test('returns formatted balance', async () => {
      mockGetBalance.mockResolvedValue(BigInt('32147143141872067472'));
      const result = await client.getETHBalance('0xabc' as `0x${string}`);
      expect(result.formatted).toBe('32.147143141872067472');
    });
  });

  describe('getExchangeRate', () => {
    test('returns stEthPerWstEth and computed inverse', async () => {
      // stEthPerToken returns 1.23 * 1e18
      mockReadContract.mockResolvedValue(BigInt('1230000000000000000'));
      const result = await client.getExchangeRate();
      expect(result.stEthPerWstEth).toBe('1.23');
      expect(parseFloat(result.wstEthPerStEth)).toBeCloseTo(0.8130, 3);
    });
  });

  describe('getProtocolStats', () => {
    test('returns all protocol stats', async () => {
      mockReadContract
        .mockResolvedValueOnce(BigInt('9185524972880054590027928'))   // totalPooledEther
        .mockResolvedValueOnce(BigInt('7470491423279998562257104'))   // totalShares
        .mockResolvedValueOnce(BigInt('9185524972880054590027928'));  // totalSupply
      const result = await client.getProtocolStats();
      expect(result.totalPooledEther).toContain('9185524');
      expect(result.totalShares).toContain('7470491');
      expect(result.totalSupply).toContain('9185524');
    });
  });

  describe('getWithdrawalRequests', () => {
    test('returns array of request IDs', async () => {
      mockReadContract.mockResolvedValue([BigInt(100), BigInt(101)]);
      const result = await client.getWithdrawalRequests('0xabc' as `0x${string}`);
      expect(result).toEqual([BigInt(100), BigInt(101)]);
    });

    test('returns empty array when no requests', async () => {
      mockReadContract.mockResolvedValue([]);
      const result = await client.getWithdrawalRequests('0xabc' as `0x${string}`);
      expect(result).toEqual([]);
    });
  });

  describe('getWithdrawalStatus', () => {
    test('returns statuses for request IDs', async () => {
      const statuses = [
        {
          amountOfStETH: BigInt('5000000000000000000'),
          amountOfShares: BigInt('4000000000000000000'),
          owner: '0xabc',
          timestamp: BigInt(1700000000),
          isFinalized: true,
          isClaimed: false,
        },
      ];
      mockReadContract.mockResolvedValue(statuses);
      const result = await client.getWithdrawalStatus([BigInt(100)]);
      expect(result).toHaveLength(1);
      expect(result[0].isFinalized).toBe(true);
      expect(result[0].isClaimed).toBe(false);
    });

    test('returns empty array for empty input', async () => {
      const result = await client.getWithdrawalStatus([]);
      expect(result).toEqual([]);
      expect(mockReadContract).not.toHaveBeenCalled();
    });
  });

  describe('getWithdrawalQueueStats', () => {
    test('returns queue stats', async () => {
      mockReadContract
        .mockResolvedValueOnce(BigInt(117807))  // lastFinalizedRequestId
        .mockResolvedValueOnce(BigInt('35921699851594052926879'));  // unfinalizedStETH
      const result = await client.getWithdrawalQueueStats();
      expect(result.lastFinalizedRequestId).toBe('117807');
      expect(result.unfinalizedStETH).toContain('35921');
    });
  });

  describe('transaction builders', () => {
    test('buildStakeTransaction returns moonpay-compatible payload', () => {
      const tx = client.buildStakeTransaction('1.5');
      expect(tx.to).toBe('0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84');
      expect(tx.chainId).toBe(1);
      expect(tx.data.startsWith('0x')).toBe(true);
      expect(tx.value).toBeDefined();
    });

    test('buildStakeTransaction can include from', () => {
      const wallet = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as `0x${string}`;
      const tx = client.buildStakeTransaction('1', undefined, wallet);
      expect(tx.from).toBe(wallet);
    });

    test('buildStEthApproveTransaction returns encoded data', () => {
      const spender = '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0' as `0x${string}`;
      const tx = client.buildStEthApproveTransaction('5', spender);
      expect(tx.to).toBe('0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84');
      expect(tx.value).toBe('0');
      expect(tx.data.startsWith('0x')).toBe(true);
    });

    test('buildWrapTransaction returns correct contract address', () => {
      const tx = client.buildWrapTransaction('10');
      expect(tx.to).toBe('0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0');
      expect(tx.data.startsWith('0x')).toBe(true);
      expect(tx.description).toContain('10 stETH');
    });

    test('buildUnwrapTransaction returns correct contract address', () => {
      const tx = client.buildUnwrapTransaction('10');
      expect(tx.to).toBe('0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0');
      expect(tx.data.startsWith('0x')).toBe(true);
      expect(tx.description).toContain('10 wstETH');
    });

    test('buildWithdrawTransaction returns correct contract address', () => {
      const wallet = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as `0x${string}`;
      const tx = client.buildWithdrawTransaction('5', wallet, wallet);
      expect(tx.to).toBe('0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1');
      expect(tx.data.startsWith('0x')).toBe(true);
      expect(tx.from).toBe(wallet);
      expect(tx.description).toContain('5 stETH');
    });
  });
});
