import { readFile } from 'node:fs/promises';
import { generateImage, loadConfig, safeError, status } from './engine.mjs';

let config;
try {
  config = await loadConfig();
  const [command, inputFile] = process.argv.slice(2);
  let result;
  if (command === 'status') result = await status(config);
  else if (command === 'generate' && inputFile) {
    result = await generateImage(JSON.parse(await readFile(inputFile, 'utf8')), config);
  } else throw new Error('Usage: node tools/image-gen/cli.mjs status | generate <brief.json>');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(safeError(error, config?.apiKey));
  process.exitCode = 1;
}
