#!/usr/bin/env node

import { Command } from 'commander';
import { makeBalanceCommand } from './commands/balance';
import { makeStatsCommand } from './commands/stats';
import { makeStakeCommand } from './commands/stake';
import { makeWrapCommand, makeUnwrapCommand } from './commands/wrap';
import { makeWithdrawCommand } from './commands/withdraw';
import { makeRewardsCommand } from './commands/rewards';

const pkg = require('../package.json');

const program = new Command();

program
  .name('lido')
  .description('Agent-first CLI for the Lido staking protocol. JSON output by default.')
  .version(pkg.version);

program.addCommand(makeBalanceCommand());
program.addCommand(makeStatsCommand());
program.addCommand(makeStakeCommand());
program.addCommand(makeWrapCommand());
program.addCommand(makeUnwrapCommand());
program.addCommand(makeWithdrawCommand());
program.addCommand(makeRewardsCommand());

// MCP server subcommand
program
  .command('mcp')
  .description('Start MCP server over stdio (for Claude Desktop, Claude Code, etc.)')
  .action(async () => {
    const { startMcpServer } = await import('./mcp');
    await startMcpServer();
  });

program.parse();
