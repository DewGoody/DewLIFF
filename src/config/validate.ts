import { validateAll } from './loader.js';

const results = await validateAll();
console.log(`Validated ${results.length} campaign(s):`);
for (const r of results) {
  console.log(`  ${r.id}@${r.version}`);
}
