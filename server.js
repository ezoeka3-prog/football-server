const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

async function scrapeSofascore(home, away) {
  try {
    const searchUrl = `https://www.sofascore.com/api/v1/search/multi/?q=${encodeURIComponent(home)}&t=1`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120', 'Accept': 'application/json' }
    });
    return await res.json();
  } catch(e) { return null; }
}

async function scrapeFbref(team) {
  try {
    const url = `https://fbref.com/en/search/search.fcgi?search=${encodeURIComponent(team)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const stats = {};
    $('table').first().find('tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length > 0) {
        stats[`row_${i}`] = cells.map((j, cell) => $(cell).text().trim()).get().join(' | ');
      }
    });
    return { raw: html.slice(0, 3000), stats };
  } catch(e) { return null; }
}

async function scrapeTransfermarkt(team) {
  try {
    const url = `https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(team)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120', 'Accept-Language': 'fr-FR' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const players = [];
    $('table.items tbody tr').each((i, row) => {
      const name = $(row).find('td.hauptlink a').first().text().trim();
      const injury = $(row).find('td.zentriert img[title]').attr('title');
      if (name && injury) players.push({ name, status: injury });
    });
    return players;
  } catch(e) { return []; }
}

async function getAIAnalysis(home, away, scrapedData) {
  const GEMINI_KEY = process.env.GEMINI_KEY || 'AIzaSyB9wy077Ei7mALC6u1yENRBIckTpifEPyg';
  const contextStr = JSON.stringify(scrapedData).slice(0, 2000);
  const prompt = `Tu es expert statistiques football. Analyse : ${home} vs ${away} saison 2025/2026. Données scrapées : ${contextStr}. Réponds UNIQUEMENT JSON pur sans markdown. Format: {"score":"2-1","winner":"home","winner_label":"${home}","proba_home":55,"proba_draw":25,"proba_away":20,"cote_home":1.75,"cote_draw":3.20,"cote_away":4.50,"confidence":4,"verdict_text":"Résumé stats réelles 2025/2026","home_form":[{"result":"W","score":"2-1","opponent":"Équipe","date":"JJ/MM/AAAA","competition":"Ligue","corners":6,"cartons_j":2,"cartons_r":0,"fautes":11,"possession":58},{"result":"D","score":"1-1","opponent":"Équipe","date":"JJ/MM/AAAA","competition":"Ligue","corners":4,"cartons_j":1,"cartons_r":0,"fautes":9,"possession":52},{"result":"W","score":"3-0","opponent":"Équipe","date":"JJ/MM/AAAA","competition":"Ligue","corners":8,"cartons_j":0,"cartons_r":0,"fautes":7,"possession":61},{"result":"L","score":"0-1","opponent":"Équipe","date":"JJ/MM/AAAA","competition":"Ligue","corners":3,"cartons_j":3,"cartons_r":1,"fautes":14,"possession":45},{"result":"W","score":"2-0","opponent":"Équipe","date":"JJ/MM/AAAA","competition":"Ligue","corners":7,"cartons_j":1,"cartons_r":0,"fautes":8,"possession":55}],"away_form":[{"result":"W","score":"1-0","opponent":"Équipe","date":"JJ/MM/AAAA","competition":"Ligue","corners":5,"cartons_j":1,"cartons_r":0,"fautes":10,"possession":54},{"result":"D","score":"2-2","opponent":"Équipe","date":"JJ/MM/AAAA","competition":"Ligue","corners":6,"cartons_j":2,"cartons_r":0,"fautes":12,"possession":49},{"result":"L","score":"0-2","opponent":"Équipe","date":"JJ/MM/AAAA","competition":"Ligue","corners":3,"cartons_j":1,"cartons_r":0,"fautes":13,"possession":43},{"result":"W","score":"3-1","opponent":"Équipe","date":"JJ/MM/AAAA","competition":"Ligue","corners":9,"cartons_j":0,"cartons_r":0,"fautes":8,"possession":62},{"result":"D","score":"0-0","opponent":"Équipe","date":"JJ/MM/AAAA","competition":"Ligue","corners":4,"cartons_j":2,"cartons_r":0,"fautes":11,"possession":50}],"home_stats_avg":{"corners_par_match":6.2,"cartons_j_par_match":1.4,"cartons_r_par_match":0.2,"fautes_par_match":10.8,"possession_moyenne":54.2,"buts_marques_par_match":1.8,"buts_encaisses_par_match":0.9},"away_stats_avg":{"corners_par_match":5.4,"cartons_j_par_match":1.2,"cartons_r_par_match":0.1,"fautes_par_match":10.8,"possession_moyenne":51.6,"buts_marques_par_match":1.6,"buts_encaisses_par_match":1.2},"h2h":[{"date":"JJ/MM/AAAA","competition":"Ligue","score_home":2,"score_away":1,"winner":"home","corners_home":6,"corners_away":4,"cartons_j_home":1,"cartons_j_away":2,"fautes_home":10,"fautes_away":13},{"date":"JJ/MM/AAAA","competition":"Ligue","score_home":1,"score_away":1,"winner":"draw","corners_home":5,"corners_away":5,"cartons_j_home":2,"cartons_j_away":1,"fautes_home":11,"fautes_away":10},{"date":"JJ/MM/AAAA","competition":"Coupe","score_home":0,"score_away":2,"winner":"away","corners_home":3,"corners_away":7,"cartons_j_home":2,"cartons_j_away":0,"fautes_home":14,"fautes_away":8},{"date":"JJ/MM/AAAA","competition":"Ligue","score_home":2,"score_away":0,"winner":"home","corners_home":8,"corners_away":3,"cartons_j_home":0,"cartons_j_away":2,"fautes_home":8,"fautes_away":12},{"date":"JJ/MM/AAAA","competition":"Ligue","score_home":1,"score_away":2,"winner":"away","corners_home":4,"corners_away":6,"cartons_j_home":1,"cartons_j_away":1,"fautes_home":9,"fautes_away":10}],"home_objective":"Objectif ${home} 2025/2026","home_enjeu":"normal","away_objective":"Objectif ${away} 2025/2026","away_enjeu":"normal","home_lineup":{"formation":"4-3-3","players":[{"num":1,"name":"Gardien","pos":"GB","form":"ok"},{"num":2,"name":"Défenseur","pos":"DD","form":"ok"},{"num":5,"name":"Défenseur","pos":"DC","form":"ok"},{"num":6,"name":"Défenseur","pos":"DC","form":"ok"},{"num":3,"name":"Défenseur","pos":"DG","form":"ok"},{"num":8,"name":"Milieu","pos":"MC","form":"hot"},{"num":14,"name":"Milieu","pos":"MC","form":"ok"},{"num":10,"name":"Milieu","pos":"MO","form":"hot"},{"num":11,"name":"Ailier","pos":"AG","form":"ok"},{"num":9,"name":"Attaquant","pos":"AT","form":"hot"},{"num":7,"name":"Ailier","pos":"AD","form":"ok"}]},"away_lineup":{"formation":"4-2-3-1","players":[{"num":1,"name":"Gardien","pos":"GB","form":"ok"},{"num":2,"name":"Défenseur","pos":"DD","form":"ok"},{"num":4,"name":"Défenseur","pos":"DC","form":"ok"},{"num":5,"name":"Défenseur","pos":"DC","form":"ok"},{"num":3,"name":"Défenseur","pos":"DG","form":"ok"},{"num":8,"name":"Milieu","pos":"MDC","form":"ok"},{"num":16,"name":"Milieu","pos":"MDC","form":"ok"},{"num":11,"name":"Milieu","pos":"MO","form":"hot"},{"num":10,"name":"Milieu","pos":"MO","form":"hot"},{"num":7,"name":"Milieu","pos":"MO","form":"ok"},{"num":9,"name":"Attaquant","pos":"AT","form":"hot"}]},"home_absents":[],"away_absents":[],"data_sources":"SofaScore + FBref + Transfermarkt + Gemini AI 2025/2026","analysis":"Analyse 4-5 paragraphes avec corners, cartons, fautes, possession réels 2025/2026."}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 4000, temperature: 0.5 } })
  });
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON introuvable');
  return JSON.parse(jsonMatch[0]);
}

app.post('/analyze', async (req, res) => {
  const { home, away } = req.body;
  if (!home || !away) return res.status(400).json({ error: 'Équipes manquantes' });
  try {
    const [sofascore, fbrefHome, fbrefAway, tmHome, tmAway] = await Promise.allSettled([
      scrapeSofascore(home, away),
      scrapeFbref(home),
      scrapeFbref(away),
      scrapeTransfermarkt(home),
      scrapeTransfermarkt(away)
    ]);
    const scrapedData = {
      sofascore: sofascore.value,
      fbrefHome: fbrefHome.value,
      fbrefAway: fbrefAway.value,
      absentsHome: tmHome.value || [],
      absentsAway: tmAway.value || []
    };
    const result = await getAIAnalysis(home, away, scrapedData);
    if (tmHome.value?.length) result.home_absents = tmHome.value;
    if (tmAway.value?.length) result.away_absents = tmAway.value;
    res.json({ success: true, data: result });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'Football Prediction Server actif ✅ v2' }));
app.listen(PORT, () => console.log(`Serveur démarré sur port ${PORT}`));
