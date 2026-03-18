import { CONTRACTS, CHAIN_ID } from '../../src/config/contracts';

describe('contracts', () => {
  test('stETH address is valid', () => {
    expect(CONTRACTS.stETH).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  test('wstETH address is valid', () => {
    expect(CONTRACTS.wstETH).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  test('withdrawalQueue address is valid', () => {
    expect(CONTRACTS.withdrawalQueue).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  test('accountingOracle address is valid', () => {
    expect(CONTRACTS.accountingOracle).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  test('stakingRouter address is valid', () => {
    expect(CONTRACTS.stakingRouter).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  test('chain ID is Ethereum mainnet', () => {
    expect(CHAIN_ID).toBe(1);
  });

  test('all addresses are unique', () => {
    const addresses = Object.values(CONTRACTS);
    const unique = new Set(addresses);
    expect(unique.size).toBe(addresses.length);
  });
});
