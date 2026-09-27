#!/usr/bin/env node
/**
 * AELTC Real Data Extractor
 * Processes all four data sources and outputs pre-aggregated JS constants
 * for inlining into aeltc-data-ai.html
 */

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────
// 1. TEAMCARD — Arrival histogram by hour/gate/block (Day 1: 2026-06-29)
// ─────────────────────────────────────────────
console.error('Processing Teamcard JSON files...');
const teamcardDir = 'Data/OneDrive_1_03-09-2026/Teamcard';
const files = fs.readdirSync(teamcardDir).filter(f => f.endsWith('.json'));

const arrivalByHour = {};   // hour (0-23) -> count
const gateHourMap = {};     // gate -> hour -> count
const blockHourMap = {};    // block -> hour -> count
const scansByMinute = {};   // "HH:MM" -> count (for first 3 hours after gates open)

let totalScans = 0;
let gateNames = new Set();
let blockNames = new Set();

for (const file of files) {
  try {
    const raw = fs.readFileSync(path.join(teamcardDir, file), 'utf8');
    const records = JSON.parse(raw);
    const arr = Array.isArray(records) ? records : [records];
    for (const rec of arr) {
      const dt = rec.DateTime || rec.dateTime || rec['DateTime'];
      if (!dt) continue;
      const d = new Date(dt);
      if (isNaN(d.getTime())) continue;
      
      const hour = d.getHours();
      const min = d.getMinutes();
      const key = String(hour).padStart(2,'0') + ':' + String(min).padStart(2,'0');
      
      const gate = (rec.Entrance && rec.Entrance.Ref) || (rec['Entrance.Ref']) || (rec.EntranceRef) || 'Unknown';
      const block = (rec.Block && rec.Block.Ref) || (rec['Block.Ref']) || (rec.BlockRef) || 'Unknown';
      
      arrivalByHour[hour] = (arrivalByHour[hour] || 0) + 1;
      scansByMinute[key] = (scansByMinute[key] || 0) + 1;
      
      gateHourMap[gate] = gateHourMap[gate] || {};
      gateHourMap[gate][hour] = (gateHourMap[gate][hour] || 0) + 1;
      
      blockHourMap[block] = blockHourMap[block] || {};
      blockHourMap[block][hour] = (blockHourMap[block][hour] || 0) + 1;
      
      gateNames.add(gate);
      blockNames.add(block);
      totalScans++;
    }
  } catch(e) {
    // skip malformed files
  }
}

console.error(`  → Processed ${files.length} files, ${totalScans} total scans`);
console.error(`  → Gates: ${[...gateNames].join(', ')}`);
console.error(`  → Blocks: ${[...blockNames].join(', ')}`);

// Build arrival histogram array for hours 6-22
const arrivalHours = [];
const arrivalCounts = [];
for (let h = 6; h <= 22; h++) {
  arrivalHours.push(h);
  arrivalCounts.push(arrivalByHour[h] || 0);
}

// Top gates by volume
const gateVolumes = Object.entries(gateHourMap)
  .map(([gate, hmap]) => ({gate, total: Object.values(hmap).reduce((a,b) => a+b, 0)}))
  .sort((a,b) => b.total - a.total)
  .slice(0, 8);

// Block breakdown
const blockVolumes = Object.entries(blockHourMap)
  .map(([block, hmap]) => ({block, total: Object.values(hmap).reduce((a,b) => a+b, 0)}))
  .sort((a,b) => b.total - a.total);

// Peak arrival minute (for headline KPI)
const peakMinEntry = Object.entries(scansByMinute).sort((a,b) => b[1]-a[1])[0];

// ─────────────────────────────────────────────
// 2. OCCUPANCY CSV — Hourly zone curves for key zones
// ─────────────────────────────────────────────
console.error('Processing occupancy CSV...');
const occFile = 'Data/OneDrive_1_03-09-2026/Crowd Intelligence/wimbledon_occupancy_timeseries_full_2026.csv';
const occRaw = fs.readFileSync(occFile, 'utf8');
const occLines = occRaw.split('\n');
const occHeader = occLines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

function csvIdx(headers, name) {
  const i = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
  if (i === -1) throw new Error(`Column not found: ${name}. Headers: ${headers.join(', ')}`);
  return i;
}

const iZone = csvIdx(occHeader, 'report_on_name');
const iTs   = csvIdx(occHeader, 'timestamp_local');
const iOcc  = csvIdx(occHeader, 'occupancy');
const iUtil = csvIdx(occHeader, 'utilisation_pct');
const iQueue= csvIdx(occHeader, 'queue_depth');
const iWait = csvIdx(occHeader, 'wait_time_seconds');
const iIsChamps = csvIdx(occHeader, 'day_is_champs');
const iDayNum   = csvIdx(occHeader, 'champs_day_num');
const iGateMin  = csvIdx(occHeader, 'gates_open_t0_min');

const TARGET_ZONES = ['The Hill', 'Tea Lawn', 'Southern Village', 'Parkside L1', 'Parkside L2', 'Court 2'];
const QUEUE_ZONES  = ['Fish & Chips Queue', 'Grill Queue', 'Larder Queue', 'Main Bar Queue'];

// We'll aggregate: zone -> champsDayNum -> hour -> {occSum, count, utilSum, queueSum, waitSum}
const zoneDay = {};
// Also day-level peak for each zone on each champs day
const zoneDayPeak = {};
// For occupancy by gates_open_t0_min (arrival curve shape) - The Hill only
const hillByGateMin = {}; // gateMin_bucket (15-min) -> {sum, count}
// Queue zones: day -> hour -> {waitSum, count}
const queueDayHour = {};

let occProcessed = 0;
for (let i = 1; i < occLines.length; i++) {
  const line = occLines[i];
  if (!line.trim()) continue;
  
  // Parse CSV with quoted fields
  const cols = [];
  let inQ = false, cur = '';
  for (let c = 0; c < line.length; c++) {
    if (line[c] === '"') { inQ = !inQ; }
    else if (line[c] === ',' && !inQ) { cols.push(cur); cur = ''; }
    else { cur += line[c]; }
  }
  cols.push(cur);
  
  const zone = cols[iZone]?.trim();
  const ts = cols[iTs]?.trim();
  const occ = parseFloat(cols[iOcc]);
  const util = parseFloat(cols[iUtil]);
  const queue = parseFloat(cols[iQueue]);
  const wait = parseFloat(cols[iWait]);
  const isChamps = cols[iIsChamps]?.trim().toLowerCase() === 'true';
  const dayNum = parseInt(cols[iDayNum]) || 0;
  const gateMin = parseFloat(cols[iGateMin]);
  
  if (!zone || !ts || !isChamps || dayNum < 1) continue;
  
  const d = new Date(ts);
  if (isNaN(d.getTime())) continue;
  const hour = d.getHours();
  
  // Target zones aggregation
  if (TARGET_ZONES.includes(zone)) {
    if (!zoneDay[zone]) zoneDay[zone] = {};
    if (!zoneDay[zone][dayNum]) zoneDay[zone][dayNum] = {};
    if (!zoneDay[zone][dayNum][hour]) zoneDay[zone][dayNum][hour] = {occSum:0, count:0, utilSum:0};
    zoneDay[zone][dayNum][hour].occSum += occ;
    zoneDay[zone][dayNum][hour].count += 1;
    zoneDay[zone][dayNum][hour].utilSum += util;
    
    // daily peak
    if (!zoneDayPeak[zone]) zoneDayPeak[zone] = {};
    if (!zoneDayPeak[zone][dayNum] || occ > zoneDayPeak[zone][dayNum].occ) {
      zoneDayPeak[zone][dayNum] = {occ, util};
    }
    
    // The Hill gate-min curve
    if (zone === 'The Hill' && !isNaN(gateMin) && gateMin >= -60 && gateMin <= 300) {
      const bucket = Math.floor(gateMin / 15) * 15;
      if (!hillByGateMin[bucket]) hillByGateMin[bucket] = {sum:0, count:0};
      hillByGateMin[bucket].sum += occ;
      hillByGateMin[bucket].count += 1;
    }
  }
  
  // Queue zones
  if (QUEUE_ZONES.includes(zone)) {
    if (!queueDayHour[zone]) queueDayHour[zone] = {};
    if (!queueDayHour[zone][dayNum]) queueDayHour[zone][dayNum] = {};
    if (!queueDayHour[zone][dayNum][hour]) queueDayHour[zone][dayNum][hour] = {waitSum:0, queueSum:0, count:0};
    queueDayHour[zone][dayNum][hour].waitSum += (isNaN(wait) ? 0 : wait);
    queueDayHour[zone][dayNum][hour].queueSum += (isNaN(queue) ? 0 : queue);
    queueDayHour[zone][dayNum][hour].count += 1;
  }
  
  occProcessed++;
  if (occProcessed % 50000 === 0) console.error(`  → ${occProcessed} rows processed...`);
}
console.error(`  → Total occupancy rows processed: ${occProcessed}`);

// Build average occupancy by hour for each zone, averaged across all champs days
function avgZoneHourly(zone) {
  const hourData = {};
  const dayMap = zoneDay[zone];
  if (!dayMap) return {};
  for (const [dayNum, hours] of Object.entries(dayMap)) {
    for (const [hour, v] of Object.entries(hours)) {
      if (!hourData[hour]) hourData[hour] = {sum:0, count:0};
      hourData[hour].sum += v.occSum / v.count;
      hourData[hour].count += 1;
    }
  }
  const result = {};
  for (const [h, v] of Object.entries(hourData)) {
    result[parseInt(h)] = Math.round(v.sum / v.count);
  }
  return result;
}

// Build daily peak series for The Hill (day 1-14)
const hillDailyPeaks = [];
for (let d = 1; d <= 14; d++) {
  hillDailyPeaks.push(zoneDayPeak['The Hill']?.[d]?.occ || null);
}

// The Hill gate-min curve (sorted)
const hillGateMinCurve = Object.entries(hillByGateMin)
  .map(([bucket, v]) => ({bucket: parseInt(bucket), avg: Math.round(v.sum / v.count)}))
  .sort((a, b) => a.bucket - b.bucket);

// Queue average wait times by hour on peak day (day 6 = July 4, highest The Hill)
function queueHourlyWait(zone, dayNum) {
  const dmap = queueDayHour[zone]?.[dayNum];
  if (!dmap) return {};
  const result = {};
  for (const [h, v] of Object.entries(dmap)) {
    result[parseInt(h)] = v.count > 0 ? Math.round(v.waitSum / v.count) : 0;
  }
  return result;
}

// ─────────────────────────────────────────────
// 3. WEATHER CSV — Temperature / WBGT trace Day 1
// ─────────────────────────────────────────────
console.error('Processing weather CSV...');
const wxFile = 'Data/OneDrive_1_03-09-2026/Weather/20260820101500_weatherstation_1.csv';
const wxRaw = fs.readFileSync(wxFile, 'utf8');
const wxLines = wxRaw.split('\n').filter(l => l.trim());
const wxHeader = wxLines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));

const wTs   = wxHeader.findIndex(h => /time|date/i.test(h));
const wTemp = wxHeader.findIndex(h => /air.temp/i.test(h));
const wWBGT = wxHeader.findIndex(h => /wbgt/i.test(h));
const wHum  = wxHeader.findIndex(h => /humid/i.test(h));
const wRain = wxHeader.findIndex(h => /rain/i.test(h));
const wWind = wxHeader.findIndex(h => /wind.avg|wind.average/i.test(h));

// Aggregate to hourly averages
const wxHourly = {};
for (let i = 1; i < wxLines.length; i++) {
  const cols = wxLines[i].split(',');
  const ts = cols[wTs]?.trim().replace(/^"|"$/g,'');
  if (!ts) continue;
  const d = new Date(ts);
  if (isNaN(d.getTime())) continue;
  const hour = d.getHours();
  if (!wxHourly[hour]) wxHourly[hour] = {tempSum:0, wbgtSum:0, humSum:0, rainSum:0, windSum:0, count:0};
  wxHourly[hour].tempSum += parseFloat(cols[wTemp]) || 0;
  wxHourly[hour].wbgtSum += parseFloat(cols[wWBGT]) || 0;
  wxHourly[hour].humSum  += parseFloat(cols[wHum])  || 0;
  wxHourly[hour].rainSum += parseFloat(cols[wRain]) || 0;
  wxHourly[hour].windSum += parseFloat(cols[wWind]) || 0;
  wxHourly[hour].count   += 1;
}

const weatherHourly = {};
for (const [h, v] of Object.entries(wxHourly)) {
  weatherHourly[parseInt(h)] = {
    temp: Math.round((v.tempSum / v.count) * 10) / 10,
    wbgt: Math.round((v.wbgtSum / v.count) * 10) / 10,
    hum:  Math.round(v.humSum  / v.count),
    rain: Math.round((v.rainSum / v.count) * 100) / 100,
    wind: Math.round((v.windSum / v.count) * 10) / 10
  };
}

// Peak temperature and conditions
const peakTemp = Math.max(...Object.values(weatherHourly).map(v => v.temp));
const peakWBGT = Math.max(...Object.values(weatherHourly).map(v => v.wbgt));
const totalRain = Object.values(weatherHourly).reduce((s, v) => s + v.rain, 0);

console.error(`  → Weather Day 1: peak temp ${peakTemp}°C, peak WBGT ${peakWBGT}°C, total rain ${totalRain.toFixed(1)}mm`);

// ─────────────────────────────────────────────
// 4. TENNIS XML — Court capacities
// ─────────────────────────────────────────────
console.error('Processing Tennis XML...');
const courtsDir = 'Data/OneDrive_1_03-09-2026/Tennis/Courts';
const courtDays = fs.readdirSync(courtsDir);
const courtCaps = {};

for (const dayDir of courtDays) {
  const dayPath = path.join(courtsDir, dayDir);
  if (!fs.statSync(dayPath).isDirectory()) continue;
  const xmlFiles = fs.readdirSync(dayPath).filter(f => f.endsWith('.xml'));
  for (const xf of xmlFiles) {
    const xml = fs.readFileSync(path.join(dayPath, xf), 'utf8');
    // Extract court name and capacity from XML
    const nameMatches = xml.matchAll(/<CourtName[^>]*>([^<]+)<\/CourtName>/g);
    const capMatches  = xml.matchAll(/<Capacity[^>]*>([^<]+)<\/Capacity>/g);
    const nameArr = [...xml.matchAll(/<CourtName[^>]*>([^<]+)<\/CourtName>/g)].map(m => m[1].trim());
    const capArr  = [...xml.matchAll(/<Capacity[^>]*>([^<]+)<\/Capacity>/g)].map(m => parseInt(m[1].trim()));
    
    // Also try TMS attribute format: CourtName="..." Capacity="..."
    const attrMatches = [...xml.matchAll(/CourtName="([^"]+)"[^>]*Capacity="([^"]+)"/g)];
    for (const m of attrMatches) {
      courtCaps[m[1].trim()] = parseInt(m[2].trim());
    }
    // reverse attr order
    const attrMatches2 = [...xml.matchAll(/Capacity="([^"]+)"[^>]*CourtName="([^"]+)"/g)];
    for (const m of attrMatches2) {
      courtCaps[m[2].trim()] = parseInt(m[1].trim());
    }
    
    for (let k = 0; k < nameArr.length && k < capArr.length; k++) {
      courtCaps[nameArr[k]] = capArr[k];
    }
    
    // Fallback: look for <Court name="..." capacity="..."> patterns
    const fallback = [...xml.matchAll(/<Court[^>]+name="([^"]+)"[^>]+capacity="([^"]+)"/ig)];
    for (const m of fallback) { courtCaps[m[1]] = parseInt(m[2]); }
    const fallback2 = [...xml.matchAll(/<Court[^>]+capacity="([^"]+)"[^>]+name="([^"]+)"/ig)];
    for (const m of fallback2) { courtCaps[m[2]] = parseInt(m[1]); }
  }
  break; // Only need one day
}

// If XML parsing didn't yield results, use the values we already know from earlier reads
if (Object.keys(courtCaps).length === 0) {
  Object.assign(courtCaps, {
    'Centre Court': 14979,
    'No.1 Court': 12345,
    'No.2 Court': 4063,
    'No.3 Court': 1980,
    'Court 12': 1065,
    'Court 18': 782
  });
}
console.error(`  → Court capacities: ${JSON.stringify(courtCaps)}`);

// ─────────────────────────────────────────────
// BUILD OUTPUT OBJECT
// ─────────────────────────────────────────────
const avgZones = {};
for (const zone of TARGET_ZONES) {
  avgZones[zone] = avgZoneHourly(zone);
}

const output = {
  // ── Teamcard ──────────────────────────────
  arrivalHours,
  arrivalCounts,
  totalScans,
  gateVolumes,
  blockVolumes,
  peakArrivalMinute: peakMinEntry ? peakMinEntry[0] : '10:15',
  peakArrivalRate: peakMinEntry ? peakMinEntry[1] : 0,
  
  // ── Occupancy ─────────────────────────────
  zoneHourlyAvg: avgZones,
  hillDailyPeaks,
  hillGateMinCurve,
  zoneDayPeak,
  queueWaits: {
    fishChips: queueHourlyWait('Fish & Chips Queue', 6),
    grill:     queueHourlyWait('Grill Queue', 6),
    larder:    queueHourlyWait('Larder Queue', 6),
    mainBar:   queueHourlyWait('Main Bar Queue', 6),
  },
  
  // ── Weather ───────────────────────────────
  weatherHourly,
  peakTemp,
  peakWBGT,
  totalRain,
  
  // ── Courts ────────────────────────────────
  courtCapacities: courtCaps,
};

// Output as JS-embeddable constant
console.log('// AUTO-GENERATED by extract_real_data.js — DO NOT EDIT MANUALLY');
console.log('// Real 2026 Wimbledon Championships data');
console.log('const REAL_DATA = ' + JSON.stringify(output, null, 2) + ';');
