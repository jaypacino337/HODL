import * as fs from "fs";
import * as path from "path";
import { renderMarkdown, renderTerminal } from "./report";
import { runScan, ScanOptions } from "./scan";

const HELP = `
MEMESCAN — trending memecoin narrative scanner + rug/scam risk scorer

Usage:
  npm run memescan                       scan the live trending set
  npm run memescan -- --demo             use the bundled demo snapshot (offline)
  npm run memescan -- --query jimothy    scan a specific idea/narrative
  npm run memescan -- --md report.md     also write a markdown report
  npm run memescan -- --json             print raw JSON instead of the dashboard

Options:
  --demo           Use bundled fictional demo data (no network needed)
  --live-only      Error out instead of falling back to demo data
  --query <text>   Search a narrative/idea instead of the trending feed
  --limit <n>      Max tokens to pull (default 60 trending / 40 search)
  --no-rugcheck    Skip RugCheck on-chain lookups (Solana)
  --json           Emit the full ScanResult as JSON on stdout
  --md [file]      Write a markdown report (default reports/scan-<ts>.md)
  --help           This text
`;

interface CliArgs extends ScanOptions {
  json: boolean;
  md?: string | true;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--demo": args.demo = true; break;
      case "--live-only": args.liveOnly = true; break;
      case "--no-rugcheck": args.noRugcheck = true; break;
      case "--json": args.json = true; break;
      case "--help": case "-h": args.help = true; break;
      case "--query": args.query = argv[++i]; break;
      case "--limit": args.limit = Number(argv[++i]) || undefined; break;
      case "--md":
        args.md = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
        break;
      default:
        console.error(`Unknown option: ${a}\n${HELP}`);
        process.exit(2);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const result = await runScan(args);

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(renderTerminal(result));
  }

  if (args.md) {
    const file =
      args.md === true
        ? path.join(process.cwd(), "reports", `scan-${new Date(result.generatedAt).toISOString().replace(/[:.]/g, "-")}.md`)
        : path.resolve(String(args.md));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, renderMarkdown(result));
    console.error(`markdown report written: ${file}`);
  }
}

main().catch((err) => {
  console.error(`memescan failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
