// Gives each clone its own blank .env to paste a key into. The real .env stays
// out of git, so a key pasted there cannot be committed by accident.
import { copyFileSync, existsSync } from 'node:fs';

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('Created .env. Paste your AI API key there to use the assistant locally.');
}
