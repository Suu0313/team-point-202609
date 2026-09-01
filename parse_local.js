#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Try to load cheerio; if missing, print helpful instruction and exit.
let cheerio;
try {
  cheerio = require('cheerio');
} catch (e) {
  console.error('Please install "cheerio" to use this script:');
  console.error('  npm install cheerio');
  process.exit(1);
}

const targetVersion = '2026-09-01';
const [, , inputArg, outputArg, flag] = process.argv;
const inputPath = inputArg ? path.resolve(process.cwd(), inputArg) : path.resolve(__dirname, `team_point_${targetVersion}.html`);
const outputPath = outputArg ? path.resolve(process.cwd(), outputArg) : path.resolve(process.cwd(), `team_ranking-${targetVersion}.json`);
const useNdjson = flag === '--ndjson';

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

const html = fs.readFileSync(inputPath, 'utf8');
const $ = cheerio.load(html);

function parseIntOrNull(txt) {
  const n = parseInt(String(txt || '').replace(/[ ,\u0000\s\uFF0C]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

function parseDiffText(txt) {
  if (!txt) return null;
  let s = String(txt).replace(/[()\s]/g, '').replace(/＋/g, '+').replace(/－/g, '-');
  const m = s.match(/([+-]?)([0-9,\uFF0C]+)/);
  if (!m) return null;
  const sign = (m[1] === '-') ? -1 : 1;
  const num = parseInt(m[2].replace(/[,\uFF0C]/g, ''), 10);
  return Number.isNaN(num) ? null : sign * num;
}

function extractTeamRankingFromCheerio(root) {
  const blocks = root('.rank_block').toArray();
  return blocks.map((el) => {
    const $b = root(el);
    const rankTxt = $b.find('.rank_block_rank').first().text().trim();
    const nameTxt = $b.find('.rank_teamname').first().text().trim();
    const pointsTxt = $b.find('.rank_block_team_num').first().text();
    const diffTxt = $b.find('.rank_block_team_diff').first().text();
    const teamCodeInput = $b.find('input[name="teamCode"]').first();

    const rank = rankTxt ? (parseInt(rankTxt.replace(/[^0-9]/g, ''), 10) || null) : null;
    const team = nameTxt || null;
    const points = parseIntOrNull(pointsTxt);
    const diff = parseDiffText(diffTxt);
    const teamCode = teamCodeInput && teamCodeInput.attr('value') ? teamCodeInput.attr('value') : null;

    return { rank, team, points, diff, teamCode };
  });
}

const data = extractTeamRankingFromCheerio($);

if (useNdjson) {
  const ws = fs.createWriteStream(outputPath, { encoding: 'utf8' });
  for (const row of data) ws.write(JSON.stringify(row) + '\n');
  ws.end();
} else {
  // compact JSON for smaller output and faster stringify
  fs.writeFileSync(outputPath, JSON.stringify(data), 'utf8');
}

console.log(`Wrote ${data.length} records to ${outputPath}`);
console.log(data.slice(0, 10));

/*
Usage:
  node parse_local_cheerio.js [input.html] [output.json] [--ndjson]

Notes:
  - This script uses cheerio which is faster and lighter than JSDOM for pure HTML parsing.
  - Pass --ndjson to write NDJSON (one JSON object per line) which is useful for streaming/large outputs.
*/
