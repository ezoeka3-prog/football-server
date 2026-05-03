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

async function scrapeTransfermarkt(team) {
  try {
    const url = `https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(team)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120', 'Accept-Language': 'fr-FR' }
    });
    const html = await res.text();
    const cheerio = require('cheerio');
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
  const contextStr = JSON.stringify(scrapedData).slice(0, 1500);
  const prompt = `Tu es expert football. Analyse : ${home} vs ${away}. Données temps réel : ${contextStr}. Réponds UNIQUEMENT JSON pur sans markdown. Format: {"score":"2-1","winner":"home","winner_label":"${home}","proba_home":55,"proba_draw":25,"proba_away":20,"cote_home":1.75,"cote_draw":3.20,"cote_away":4.50,"confidence":4,"verdict_text":"Résumé","home_form":[{"result":"W","score":"2-1","opponent":"Équipe","date":"JJ/MM"}],"away_form":[{"result":"W","score":"1-0","opponent":"Équipe","date":"JJ/MM"}],"h2h":[{"date":"15/03/2025","competition":"Liga","score_home":2,"score_away":1,"winner":"home"}],"home_objective":"Objectif ${home}","home_enjeu":"normal","away_objective":"Objectif ${away}","away_enjeu":"normal","home_lineup":{"formation":"4-3-3","players":[{"num":1,"name":"Gardien","pos":"GB","form":"ok"},{"num":2,"name":"Défenseur","pos":"DD","form":"ok"},{"num":5,"name":"Défenseur","pos":"DC","form":"ok"},{"num":6,"name":"Défenseur","pos":"DC","form":"ok"},{"num":3,"name":"Défenseur","pos":"DG","form":"ok"},{"num":8,"name":"Milieu","pos":"MC","form":"hot"},{"num":14,"name":"Milieu","pos":"MC","form":"ok"},{"num":10,"name":"Milieu","pos":"MO","form":"hot"},{"num":11,"name":"Ailier","pos":"AG","form":"ok"},{"num":9,"name":"Attaquant","pos":"AT","form":"hot"},{"num":7,"name":"Ailier","pos":"AD","form":"ok"}]},"away_lineup":{"formation":"4-2-3-1","players":[{"num":1,"name":"Gardien","pos":"GB","form":"ok"},{"num":2,"name":"Défenseur","pos":"DD","form":"ok"},{"num":4,"name":"Défenseur","pos":"DC","form":"ok"},{"num":5,"name":"Défenseur","pos":"DC","form":"ok"},{"num":3,"name":"Défenseur","pos":"DG","form":"ok"},{"num":8,"name":"Milieu","pos":"MDC","form":"ok"},{"num":16,"name":"Milieu","pos":"MDC","form":"ok"},{"num":11,"name":"Milieu","pos":"MO","form":"hot"},{"num":10,"name":"Milieu","pos":"MO","form":"hot"},{"num":7,"name":"Milieu","pos":"MO","form":"ok"},{"num":9,"name":"Attaquant","pos":"AT","form":"hot"}]},"home_absents":[],"away_absents":[],"data_sources":"Scraping temps réel + Gemini AI","analysis":"Analyse complète 4-5 paragraphes."}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 3000, temperature: 0.7 } })
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
    const [sofascore, tmHome, tmAway] = await Promise.allSettled([
      scrapeSofascore(home, away),
      scrapeTransfermarkt(home),
      scrapeTransfermarkt(away)
    ]);
    const scrapedData = { sofascore: sofascore.value, absentsHome: tmHome.value || [], absentsAway: tmAway.value || [] };
    const result = await getAIAnalysis(home, away, scrapedData);
    if (tmHome.value?.length) result.home_absents = tmHome.value;
    if (tmAway.value?.length) result.away_absents = tmAway.value;
    res.json({ success: true, data: result });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'Football Prediction Server actif ✅' }));
app.listen(PORT, () => console.log(`Serveur démarré sur port ${PORT}`));
