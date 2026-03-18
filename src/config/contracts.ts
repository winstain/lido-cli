// Lido protocol contract addresses on Ethereum Mainnet
export const CONTRACTS = {
  // Lido stETH token / staking entry point
  stETH: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as const,
  // Wrapped stETH (wstETH)
  wstETH: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0' as const,
  // Lido withdrawal queue (stETH -> ETH withdrawals)
  withdrawalQueue: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1' as const,
  // Lido accounting oracle (for APR data)
  accountingOracle: '0x852deD011285fe67063a08005c71a85690503Cee' as const,
  // Lido staking router
  stakingRouter: '0xFdDf38947aFB03C621C71b06C9C70bce73f12999' as const,
} as const;

// Chain ID for Ethereum Mainnet
export const CHAIN_ID = 1;
