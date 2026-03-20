# lido-cli

Agent-first CLI for the Lido staking protocol. JSON output by default.

## Install

```bash
npm install -g lido-cli
```

## Usage

```bash
lido --help
lido stats
lido balance --wallet 0x...
lido rewards --wallet 0x...
lido stake --amount 1.0 --wallet 0x...
lido wrap --amount 1.0
lido unwrap --amount 1.0
lido withdraw status --wallet 0x...
lido withdraw request --amount 1.0 --wallet 0x...
```

## Configuration

The CLI reads configuration from:

- `LIDO_RPC_URL`
- `LIDO_WALLET`
- `~/.lido-cli/config.json`

If no RPC URL is configured, it defaults to:

```bash
https://eth.llamarpc.com
```

## Output contract

State-reading commands return JSON by default.

Transaction-building commands return unsigned EVM transaction payloads so they can be signed and broadcast by an external wallet or signing CLI.

## MCP server

```bash
lido mcp
```

Starts the MCP server over stdio for agent/tool integrations.

## Development

```bash
npm ci
npm run build
npm test
```
