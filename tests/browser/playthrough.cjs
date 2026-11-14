// Optional browser test: plays the whole game in a real browser through the same actions a player uses
// (walking, bumping doors, using switches, taking stairs, fighting the Queen), then checks the victory screen.
// Monsters on floors 1-3 are cleared and the Queen is held in place so the run is deterministic.
//
//   python3 -m http.server 8000      # in one terminal, from the repo root
//   node tests/browser/playthrough.cjs [url] [screenshot.png]
//
// Needs Playwright (npm i -D playwright, then npx playwright install chromium). Not part of `npm test`.
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8000/', SHOT = process.argv[3];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1100,height:700}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto(URL); await p.click('#startBtn');
  const result = await p.evaluate(async () => {
    const { game: g, act, attack } = __game;
    const DX=[0,1,0,-1], DY=[-1,0,1,0], SOLID='#DLGM';
    const log = [];
    const tile = (x,y)=> (x<0||y<0||x>=g.map.w||y>=g.map.h)?'#':g.map.grid[y][x];
    const passable = (x,y)=>{ const t=tile(x,y); if (g.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y)) return false;
      if (!SOLID.includes(t)) return true; if (t==='D') return true;
      if (t==='L') return g.bag.includes(g.map.locks[`${x},${y}`]);
      if (t==='M') return (g.map.sockets[`${x},${y}`]||[]).every(id=>g.bag.includes(id)||(g.map.placed?.[`${x},${y}`]||[]).includes(id));
      return false; };
    const face = d => { let n=(d-g.dir+4)%4; if(n===1) act('turnR'); else if(n===3) act('turnL'); else if(n===2){act('turnR');act('turnR');} };
    const bfs = (tx,ty)=>{ const prev={}, q=[[g.x,g.y]]; prev[`${g.x},${g.y}`]=null;
      for (let i=0;i<q.length;i++){ const [x,y]=q[i]; if(x===tx&&y===ty) break;
        for(let d=0;d<4;d++){ const nx=x+DX[d], ny=y+DY[d], k=`${nx},${ny}`; if(k in prev||!passable(nx,ny)) continue; prev[k]=[x,y,d]; q.push([nx,ny]); } }
      const path=[]; let k=`${tx},${ty}`; if(!(k in prev)) return null;
      while(prev[k]){ const [px,py,d]=prev[k]; path.unshift([d,+k.split(',')[0],+k.split(',')[1]]); k=`${px},${py}`; } return path; };
    const walkTo = (tx,ty)=>{ const startFloor=g.floor; let guard=0;
      while((g.x!==tx||g.y!==ty) && g.floor===startFloor){ if(++guard>400) throw new Error(`stuck going to ${tx},${ty} on floor ${g.floor+1} at ${g.x},${g.y}`);
        const path=bfs(tx,ty); if(!path) throw new Error(`no path to ${tx},${ty} on floor ${g.floor+1} from ${g.x},${g.y}`);
        const [d,nx,ny]=path[0]; face(d); const t=tile(nx,ny); const before=[g.x,g.y,g.floor];
        if (t==='L') act('use'); else if (t==='X' && g.map.traps[`${nx},${ny}`].found) act('use'); else act('fwd');
        if (g.floor===startFloor && (g.x!==nx||g.y!==ny) && (g.x!==before[0]||g.y!==before[1])) break;   // teleported or spun away
      } };
    const faceUse = (d)=>{ face(d); act('use'); };
    const clear = ()=>{ g.enemies.length=0; };
    const must = (cond,msg)=>{ if(!cond) throw new Error(msg); };

    // ---- Floor 1
    clear(); log.push(g.map.name);
    walkTo(9,8); must(g.bag.includes('bronze'),'no bronze key');
    walkTo(9,2); faceUse(1); must(tile(10,2)==='d','locked door did not open');
    walkTo(12,2); must(tile(13,4)==='g','plate did not open the gate');
    walkTo(5,6); faceUse(3); must(tile(4,8)==='g','hidden switch did not open the cache');
    for (const [x,y] of [[1,8],[1,9],[2,9],[3,3],[14,3],[14,1]]) walkTo(x,y);
    walkTo(12,12); must(g.floor===1,'did not descend to floor 2'); log.push(g.map.name);
    // ---- Floor 2
    clear();
    walkTo(10,1); walkTo(6,6); must(g.x===3&&g.y===7,'teleporter did not send us to the pocket');
    walkTo(2,8); walkTo(1,6); must(g.x===6&&g.y===7,'return teleporter failed');
    must(g.bag.includes('redgem')&&g.bag.includes('bluegem'),'missing gems');
    walkTo(13,9); face(2); act('fwd'); must(tile(13,10)==='d','socket door did not open');
    walkTo(13,8); face(1); must(g.map.switches[0].found,'hidden switch not noticed'); act('use'); must(tile(14,9)==='g','bonus gate stayed shut');
    for (const [x,y] of [[15,9],[16,9],[16,10]]) walkTo(x,y);
    walkTo(13,12); must(g.floor===2,'did not descend to floor 3'); log.push(g.map.name);
    // ---- Floor 3 (dark, pits)
    clear();
    walkTo(16,1); must(g.bag.includes('ember'),'no ember key');
    must(tile(9,2)==='.'&&tile(11,2)==='.','pits were not disarmed on the way');
    walkTo(16,2); faceUse(1); must(tile(13,4)==='g','spider-room switch did not open the cache');
    walkTo(13,5); walkTo(13,9); must(tile(7,11)==='g','plate did not open the stairs gate');
    walkTo(9,8); must(tile(10,8)==='d','ember door did not open');
    walkTo(7,12); must(g.floor===3,'did not descend to the Queen'); log.push(g.map.name);
    // ---- Floor 4: the real boss fight, with the Queen held in place
    g.enemies = g.enemies.filter(e=>e.type==='veshara'); const q=g.enemies[0]; q.atkCd=1e9; q.moveCd=1e9;
    walkTo(3,2); faceUse(3); walkTo(11,2); faceUse(1);
    walkTo(7,3); face(0);
    for (let i=0;i<4;i++) { g.party[i].cd=0; attack(i); }
    must(q.hp===70,'Queen was hurt while lamps burned: '+q.hp);
    walkTo(7,1); faceUse(0); must(g.map.lamps.every(l=>!l.lit),'lamps not all out');
    walkTo(7,3); face(0);
    const sleep = ms=>new Promise(r=>setTimeout(r,ms));
    for (let n=0;n<400 && !g.won;n++){ for(let i=0;i<4;i++) attack(i); await sleep(100); }
    must(g.won,'the Queen was never defeated; hp '+q.hp);
    await sleep(300);
    return { log, floor: g.floor+1, won: g.won, xp: g.party.map(h=>h.level+':'+h.xp), bag: g.bag, rations: g.rations };
  });
  console.log(JSON.stringify(result));
  console.log('overlay:', JSON.stringify(await p.textContent('#overlayText')), '| button:', await p.textContent('#retryBtn'));
  if (SHOT) await p.screenshot({ path: SHOT });
  console.log('console errors:', errs);
  if (errs.length) throw new Error('console errors during the run');
  await b.close();
})().catch(e=>{ console.error('BOT FAILED:', e.message.split('\n')[0]); process.exit(1); });
