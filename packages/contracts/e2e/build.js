const solc = require('solc');
const fs = require('fs');
const path = require('path');
const root = require('path').join(__dirname, '..');
const sources = {};
function addDir(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) addDir(p);
    else if (f.name.endsWith('.sol')) sources[path.relative(root, p)] = { content: fs.readFileSync(p, 'utf8') };
  }
}
addDir(path.join(root, 'src'));
const input = {
  language: 'Solidity',
  sources,
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
};
const out = JSON.parse(solc.compile(JSON.stringify(input), {
  import: (imp) => {
    const norm = path.normalize(imp).replace(/^(\.\.\/)+/, '').replace(/\\/g, '/');
    for (const key of Object.keys(sources)) {
      if (key === norm || key.endsWith('/' + norm) || ('src/' + norm) === key) return { contents: sources[key].content };
    }
    return { error: 'File not found: ' + imp };
  },
}));
const errs = (out.errors || []).filter(e => e.severity === 'error');
if (errs.length) { errs.forEach(e => console.log(e.formattedMessage)); process.exit(1); }
const artifacts = {};
for (const [file, contracts] of Object.entries(out.contracts)) {
  for (const [name, c] of Object.entries(contracts)) {
    artifacts[name] = { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };
  }
}
fs.writeFileSync('build.json', JSON.stringify(artifacts));
console.log('built:', Object.keys(artifacts).join(', '));
