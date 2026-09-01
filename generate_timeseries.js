const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => /^team_ranking-2026-09-.*\.json$/.test(f));
if (files.length === 0) {
  console.error('No team_ranking JSON files found');
  process.exit(1);
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

const teams = {}; // teamCode -> { name, pointsByDate: {date: points} }
const datesSet = new Set();

files.forEach(fname => {
  const full = path.join(dir, fname);
  let dateMatch = fname.match(/(\d{4}-\d{2}-\d{2})/);
  let date;
  if (dateMatch) {
    date = dateMatch[1];
  } else {
    // fallback to file mtime
    const stat = fs.statSync(full);
    date = formatDate(new Date(stat.mtime));
  }
  datesSet.add(date);

  let raw;
  try {
    raw = fs.readFileSync(full, 'utf8');
  } catch (e) {
    console.error('Failed to read', full, e);
    return;
  }
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON in', full, e);
    return;
  }
  if (!Array.isArray(arr)) return;

  arr.forEach(item => {
    const code = item.teamCode || item.team || 'UNKNOWN';
    const name = item.team || item.teamName || code;
    const points = typeof item.points === 'number' ? item.points : Number(item.points) || null;
    if (!teams[code]) teams[code] = { teamCode: code, teamName: name, pointsByDate: {} };
    teams[code].teamName = name; // update to latest name if changed
    teams[code].pointsByDate[date] = points;
  });
});

const dates = Array.from(datesSet).sort();

const teamList = Object.values(teams).map(t => ({
  teamCode: t.teamCode,
  teamName: t.teamName,
  points: dates.map(d => (d in t.pointsByDate ? t.pointsByDate[d] : null))
})).sort((a, b) => {
  // sort by latest points desc
  const aLatest = a.points.at(-1) ?? -1;
  const bLatest = b.points.at(-1) ?? -1;
  return bLatest - aLatest;
});

const output = { dates, teams: teamList };
fs.writeFileSync(path.join(dir, 'timeseries.json'), JSON.stringify(output, null, 2), 'utf8');
console.log('Wrote timeseries.json with', dates.length, 'dates and', teamList.length, 'teams.');

// Also write a simple HTML viewer that embeds the data
const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Team Points Over Time</title>
  <style>
    body{font-family:Arial, Helvetica, sans-serif;margin:20px}
    #controls{margin-bottom:10px}
    canvas{max-width:1000px}
    .team-checkbox{margin-right:8px}
  </style>
</head>
<body>
  <h2>Team Points Over Time</h2>
  <div id="controls">
    <label>表示上限 (最新ポイントで上位 N チーム): <input id="topN" type="number" value="20" min="1" max="200" style="width:60px"/> </label>
    <button id="redraw">再描画</button>
    <span>（チェックで表示切替）</span>
  </div>
  <canvas id="chart" width="1000" height="400"></canvas>
  <div id="checkboxes"></div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    const data = ${JSON.stringify(output)};
    const ctx = document.getElementById('chart').getContext('2d');

    function makeDatasets(selectedCodes) {
      const colors = [];
      // simple color generator
      for (let i=0;i<1000;i++) colors.push('hsl('+((i*37)%360)+',70%,'+ (30 + (i%6)*8) + '%)');

      return data.teams
        .filter(t => selectedCodes.includes(t.teamCode))
        .map((t,i) => ({
          label: t.teamName,
          data: t.points,
          borderColor: colors[i%colors.length],
          backgroundColor: colors[i%colors.length],
          fill: false,
          spanGaps: false,
        }));
    }

    let chart = null;
    function draw(selectedCodes) {
      const datasets = makeDatasets(selectedCodes);
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.dates,
          datasets
        },
        options: {
          interaction: {mode:'nearest',axis:'x',intersect:false},
          plugins: {legend:{display:true,position:'bottom'}},
          scales: {
            y: {type:'linear', beginAtZero:false, ticks:{callback: v => v >= 1000000 ? (v/1000000)+'M' : v}}
          }
        }
      });
    }

    function topNLatest(n) {
      // get latest points index
      const lastIdx = data.dates.length - 1;
      const arr = data.teams.map(t => ({code:t.teamCode, name:t.teamName, latest: t.points[lastIdx]}));
      arr.sort((a,b) => (b.latest||0) - (a.latest||0));
      return arr.slice(0,n).map(x => x.code);
    }

    function renderCheckboxes(defaultSelected) {
      const container = document.getElementById('checkboxes');
      container.innerHTML = '';
      data.teams.forEach(t => {
        const id = 'cb_'+t.teamCode;
        const div = document.createElement('span');
        div.className = 'team-checkbox';
        const inp = document.createElement('input');
        inp.type = 'checkbox'; inp.id = id; inp.value = t.teamCode;
        if (defaultSelected.includes(t.teamCode)) inp.checked = true;
        const lab = document.createElement('label');
        lab.htmlFor = id;
        lab.textContent = t.teamName;
        div.appendChild(inp); div.appendChild(lab);
        container.appendChild(div);
      });
    }

    document.getElementById('redraw').addEventListener('click', () => {
      const n = Number(document.getElementById('topN').value) || 20;
      const selected = topNLatest(n);
      renderCheckboxes(selected);
      draw(selected);
    });

    // initial
    const initial = topNLatest(20);
    renderCheckboxes(initial);
    draw(initial);

    // live toggling via checkboxes
    document.getElementById('checkboxes').addEventListener('change', () => {
      const checked = Array.from(document.querySelectorAll('#checkboxes input:checked')).map(i=>i.value);
      draw(checked);
    });
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(dir, 'team_points.html'), html, 'utf8');
console.log('Wrote team_points.html');
