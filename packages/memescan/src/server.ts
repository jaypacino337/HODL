import * as http from "http";
import { URL } from "url";
import { runScan } from "./scan";
import { ScanResult } from "./types";

const PORT = Number(process.env.PORT || 5150);

let cache: { key: string; at: number; result: ScanResult } | null = null;
const CACHE_MS = 60_000;

async function scanCached(demo: boolean, query?: string): Promise<ScanResult> {
  const key = `${demo}:${query ?? ""}`;
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) return cache.result;
  const result = await runScan({ demo, query });
  cache = { key, at: Date.now(), result };
  return result;
}

const PAGE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MEMESCAN — narrative radar + rug scanner</title>
<style>
  :root{--bg:#0b0d12;--card:#131722;--line:#232a3b;--txt:#e6e9f2;--dim:#8b93a7;
        --red:#ff5c72;--yel:#ffc857;--grn:#4ade80;--cyn:#38d6f0;--mag:#c77dff}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);
    font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
  header{padding:20px 24px;border-bottom:1px solid var(--line);display:flex;gap:16px;
    align-items:baseline;flex-wrap:wrap}
  h1{margin:0;font-size:20px;color:var(--mag)} h1 span{color:var(--txt)}
  header small{color:var(--dim)}
  .controls{margin-left:auto;display:flex;gap:8px}
  input,button{background:var(--card);color:var(--txt);border:1px solid var(--line);
    border-radius:6px;padding:6px 10px;font:inherit}
  button{cursor:pointer} button:hover{border-color:var(--mag)}
  main{padding:20px 24px;max-width:1200px;margin:0 auto}
  .note{background:#2a2110;border:1px solid #6b5518;color:var(--yel);
    border-radius:8px;padding:10px 14px;margin-bottom:16px}
  h2{font-size:15px;color:var(--dim);letter-spacing:.08em;text-transform:uppercase;margin:26px 0 10px}
  .tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
  table{border-collapse:collapse;width:100%;min-width:720px}
  th,td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
  th{color:var(--dim);font-weight:600;font-size:12px}
  tr:last-child td{border-bottom:none}
  .emergent{color:var(--cyn)} .pos{color:var(--grn)} .neg{color:var(--red)}
  .verdict{font-weight:700;border-radius:5px;padding:2px 8px;font-size:12px}
  .v-AVOID,.v-HIGH{background:#3a1520;color:var(--red)}
  .v-SKETCHY,.v-DYOR{background:#3a2f12;color:var(--yel)}
  .v-CLEAN{background:#12321e;color:var(--grn)}
  .flags{white-space:normal;color:var(--dim);font-size:12px;max-width:520px}
  .flags b{color:var(--txt);font-weight:600}
  .danger b{color:var(--red)} .warn b{color:var(--yel)}
  footer{color:var(--dim);padding:24px;text-align:center;font-size:12px}
  .spin{color:var(--dim);padding:40px;text-align:center}
</style></head><body>
<header>
  <h1>▄▖MEMESCAN <span>narrative radar + rug scanner</span></h1>
  <small id="meta">loading…</small>
  <div class="controls">
    <input id="q" placeholder='search an idea… e.g. "jimothy"'>
    <button onclick="load()">scan</button>
    <button onclick="load(true)">demo</button>
  </div>
</header>
<main id="main"><div class="spin">scanning the trenches…</div></main>
<footer>Heuristics only — not financial advice, not proof of fraud; a low score is not an endorsement.<br>
Data: DexScreener public API · RugCheck (Solana). Memecoins can (and mostly do) go to zero.</footer>
<script>
const usd=n=>n==null?"—":n>=1e9?"$"+(n/1e9).toFixed(1)+"B":n>=1e6?"$"+(n/1e6).toFixed(1)+"M":n>=1e3?"$"+(n/1e3).toFixed(1)+"K":"$"+n.toFixed(0);
const pct=n=>n==null?"—":(n>=0?"+":"")+n.toFixed(0)+"%";
const age=(t,now)=>{if(t==null)return"—";const h=(now-t)/36e5;return h<1?Math.round(h*60)+"m":h<48?h.toFixed(0)+"h":(h/24).toFixed(0)+"d"};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const vclass=v=>v==="AVOID"||v==="HIGH RISK"?"v-AVOID":v==="LOOKS CLEANER"?"v-CLEAN":"v-SKETCHY";

async function load(demo){
  const q=document.getElementById('q').value.trim();
  document.getElementById('main').innerHTML='<div class="spin">scanning the trenches…</div>';
  const params=new URLSearchParams(); if(demo)params.set('demo','1'); if(q&&!demo)params.set('query',q);
  let r;
  try{ r=await (await fetch('/api/scan?'+params)).json(); }
  catch(e){ document.getElementById('main').innerHTML='<div class="note">scan failed: '+esc(e)+'</div>'; return; }
  render(r);
}

function render(r){
  const now=r.generatedAt;
  document.getElementById('meta').textContent=
    'source: '+r.source+(r.query?' ("'+r.query+'")':'')+' · '+r.tokens.length+' tokens · '+new Date(now).toLocaleString();
  let h='';
  for(const n of r.notes) h+='<div class="note">⚠ '+esc(n)+'</div>';

  h+='<h2>🔥 Narrative leaderboard</h2><div class="tablewrap"><table><tr><th>#</th><th>narrative</th><th>tokens</th><th>new 24h</th><th>vol 24h</th><th>median Δ24h</th><th>avg risk</th></tr>';
  r.narratives.slice(0,12).forEach((n,i)=>{
    h+='<tr><td>'+(i+1)+'</td><td class="'+(n.kind==='emergent'?'emergent':'')+'">'+esc(n.label)+'</td><td>'+n.stats.tokenCount+
      '</td><td>'+n.stats.newTokens24h+'</td><td>'+usd(n.stats.totalVolume24hUsd)+
      '</td><td class="'+((n.stats.medianChange24h??0)>=0?'pos':'neg')+'">'+pct(n.stats.medianChange24h)+
      '</td><td>'+n.stats.avgRiskScore+'/100</td></tr>';});
  h+='</table></div>';

  const risky=r.reports.filter(x=>x.score>=25);
  h+='<h2>☠ Scam wall ('+risky.length+' flagged of '+r.reports.length+')</h2><div class="tablewrap"><table><tr><th>verdict</th><th>token</th><th>risk</th><th>liq</th><th>FDV</th><th>Δ24h</th><th>age</th><th>red flags</th></tr>';
  for(const x of risky.slice(0,20)){const t=x.token;
    h+='<tr><td><span class="verdict '+vclass(x.verdict)+'">'+x.verdict+'</span></td>'+
      '<td>'+(t.url?'<a style="color:inherit" target="_blank" rel="noopener" href="'+esc(t.url)+'">':'')+'<b>'+esc(t.symbol)+'</b> '+esc(t.name)+(t.url?'</a>':'')+'</td>'+
      '<td>'+x.score+'/100</td><td>'+usd(t.liquidityUsd)+'</td><td>'+usd(t.fdvUsd)+'</td>'+
      '<td class="'+((t.priceChange.h24??0)>=0?'pos':'neg')+'">'+pct(t.priceChange.h24)+'</td>'+
      '<td>'+age(t.pairCreatedAt,now)+'</td><td class="flags">'+
      x.flags.slice(0,4).map(f=>'<span class="'+f.severity+'"><b>'+esc(f.label)+'</b></span>').join(' · ')+'</td></tr>';}
  h+='</table></div>';

  const clean=[...r.reports].sort((a,b)=>a.score-b.score).slice(0,8);
  h+='<h2>🧼 Cleanest of the trending set (least red flags ≠ safe)</h2><div class="tablewrap"><table><tr><th>risk</th><th>token</th><th>liq</th><th>vol 24h</th><th>Δ24h</th><th>age</th></tr>';
  for(const x of clean){const t=x.token;
    h+='<tr><td class="pos">'+x.score+'/100</td><td><b>'+esc(t.symbol)+'</b> '+esc(t.name)+'</td><td>'+usd(t.liquidityUsd)+
      '</td><td>'+usd(t.volume24hUsd)+'</td><td class="'+((t.priceChange.h24??0)>=0?'pos':'neg')+'">'+pct(t.priceChange.h24)+
      '</td><td>'+age(t.pairCreatedAt,now)+'</td></tr>';}
  h+='</table></div>';

  document.getElementById('main').innerHTML=h;
}
load();
</script>
</body></html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/api/scan") {
      const result = await scanCached(url.searchParams.get("demo") === "1", url.searchParams.get("query") || undefined);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
    } else if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(PAGE);
    } else {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    }
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`MEMESCAN dashboard → http://localhost:${PORT}`);
  console.log(`API: /api/scan · /api/scan?demo=1 · /api/scan?query=jimothy`);
});
