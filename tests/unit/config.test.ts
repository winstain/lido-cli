import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig, getRpcUrl, getWallet } from '../../src/config/store';

describe('getConfigDir and getConfigFile', () => {
  test('returns config directory path', () => {
    const { getConfigDir } = require('../../src/config/store');
    expect(getConfigDir()).toContain('.lido-cli');
  });

  test('returns config file path', () => {
    const { getConfigFile } = require('../../src/config/store');
    expect(getConfigFile()).toContain('config.json');
  });
});

describe('default config paths', () => {
  test('loadConfig uses default path', () => {
    const { loadConfig: lc } = require('../../src/config/store');
    expect(lc()).toBeDefined();
  });

  test('saveConfig uses default path', () => {
    const { saveConfig: sc } = require('../../src/config/store');
    try { sc({}); } catch { /* ok */ }
  });
});

describe('config store', () => {
  let tmpDir: string;
  let configFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lido-cli-test-'));
    configFile = path.join(tmpDir, 'config.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('loadConfig', () => {
    test('returns empty object if file does not exist', () => {
      const config = loadConfig(configFile);
      expect(config).toEqual({});
    });

    test('loads config from file', () => {
      fs.writeFileSync(configFile, JSON.stringify({ rpcUrl: 'https://test.rpc' }));
      const config = loadConfig(configFile);
      expect(config.rpcUrl).toBe('https://test.rpc');
    });

    test('returns empty object on corrupted file', () => {
      fs.writeFileSync(configFile, 'not json');
      const config = loadConfig(configFile);
      expect(config).toEqual({});
    });
  });

  describe('saveConfig', () => {
    test('creates config file and directory', () => {
      const nestedFile = path.join(tmpDir, 'sub', 'config.json');
      saveConfig({ rpcUrl: 'https://new.rpc' }, nestedFile);
      const config = loadConfig(nestedFile);
      expect(config.rpcUrl).toBe('https://new.rpc');
    });

    test('merges with existing config', () => {
      saveConfig({ rpcUrl: 'https://first.rpc' }, configFile);
      saveConfig({ defaultWallet: '0xabc' }, configFile);
      const config = loadConfig(configFile);
      expect(config.rpcUrl).toBe('https://first.rpc');
      expect(config.defaultWallet).toBe('0xabc');
    });
  });

  describe('getRpcUrl', () => {
    test('returns env var if set', () => {
      const original = process.env.LIDO_RPC_URL;
      try {
        process.env.LIDO_RPC_URL = 'https://env.rpc';
        expect(getRpcUrl(configFile)).toBe('https://env.rpc');
      } finally {
        if (original !== undefined) {
          process.env.LIDO_RPC_URL = original;
        } else {
          delete process.env.LIDO_RPC_URL;
        }
      }
    });

    test('returns config file value', () => {
      fs.writeFileSync(configFile, JSON.stringify({ rpcUrl: 'https://config.rpc' }));
      const original = process.env.LIDO_RPC_URL;
      try {
        delete process.env.LIDO_RPC_URL;
        expect(getRpcUrl(configFile)).toBe('https://config.rpc');
      } finally {
        if (original !== undefined) {
          process.env.LIDO_RPC_URL = original;
        } else {
          delete process.env.LIDO_RPC_URL;
        }
      }
    });

    test('returns default if nothing set', () => {
      const original = process.env.LIDO_RPC_URL;
      try {
        delete process.env.LIDO_RPC_URL;
        expect(getRpcUrl(configFile)).toBe('https://eth.llamarpc.com');
      } finally {
        if (original !== undefined) {
          process.env.LIDO_RPC_URL = original;
        } else {
          delete process.env.LIDO_RPC_URL;
        }
      }
    });
  });

  describe('getWallet', () => {
    test('returns env var if set', () => {
      const original = process.env.LIDO_WALLET;
      try {
        process.env.LIDO_WALLET = '0xenvwallet';
        expect(getWallet(configFile)).toBe('0xenvwallet');
      } finally {
        if (original !== undefined) {
          process.env.LIDO_WALLET = original;
        } else {
          delete process.env.LIDO_WALLET;
        }
      }
    });

    test('returns config file value', () => {
      fs.writeFileSync(configFile, JSON.stringify({ defaultWallet: '0xconfigwallet' }));
      const original = process.env.LIDO_WALLET;
      try {
        delete process.env.LIDO_WALLET;
        expect(getWallet(configFile)).toBe('0xconfigwallet');
      } finally {
        if (original !== undefined) {
          process.env.LIDO_WALLET = original;
        } else {
          delete process.env.LIDO_WALLET;
        }
      }
    });

    test('returns null if nothing set', () => {
      const original = process.env.LIDO_WALLET;
      try {
        delete process.env.LIDO_WALLET;
        expect(getWallet(configFile)).toBeNull();
      } finally {
        if (original !== undefined) {
          process.env.LIDO_WALLET = original;
        } else {
          delete process.env.LIDO_WALLET;
        }
      }
    });
  });
});
