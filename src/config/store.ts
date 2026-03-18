import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface Config {
  rpcUrl?: string;
  defaultWallet?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.lido-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigFile(): string {
  return CONFIG_FILE;
}

export function loadConfig(configFile?: string): Config {
  const file = configFile || CONFIG_FILE;
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      return JSON.parse(raw) as Config;
    }
  } catch {
    // Corrupted file, return defaults
  }
  return {};
}

export function saveConfig(config: Partial<Config>, configFile?: string): void {
  const file = configFile || CONFIG_FILE;
  const dir = path.dirname(file);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const existing = loadConfig(file);
  const merged = { ...existing, ...config };
  fs.writeFileSync(file, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
}

export function getRpcUrl(configFile?: string): string {
  const envUrl = process.env.LIDO_RPC_URL;
  if (envUrl) return envUrl;

  const config = loadConfig(configFile);
  if (config.rpcUrl) return config.rpcUrl;

  // Default to public Cloudflare Ethereum RPC
  return 'https://eth.llamarpc.com';
}

export function getWallet(configFile?: string): string | null {
  const envWallet = process.env.LIDO_WALLET;
  if (envWallet) return envWallet;

  const config = loadConfig(configFile);
  return config.defaultWallet || null;
}
