// Cross-platform `rm -rf` for build output directories.
import { rmSync } from 'node:fs';

for (const target of process.argv.slice(2)) {
  rmSync(target, { recursive: true, force: true });
}
