import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');
const envPath = join(rootDir, '.env');

/**
 * Updates or appends a key-value pair in the root .env file.
 */
export function updateEnvVariable(key, value) {
  try {
    let content = '';
    if (existsSync(envPath)) {
      content = readFileSync(envPath, 'utf8');
    }

    const regex = new RegExp(`^#?\\s*${key}=.*$`, 'gm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content.trim() + `\n${key}=${value}\n`;
    }

    writeFileSync(envPath, content.trim() + '\n', 'utf8');
    console.log(`[EnvService] 💾 Updated ${key} in .env`);
    return true;
  } catch (err) {
    console.error(`[EnvService] Failed to update ${key} in .env:`, err.message);
    return false;
  }
}
