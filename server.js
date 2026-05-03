const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3000;

async function scrapeSofascore(home) {
  try {
    const res = await fetch(`https://www.sofascore.com/api/v1/search/multi/?q=${encodeURIComponent(home)}&t=1`, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120', 'Accept': 'application/json' }
    });
    const d = await res.json();
    return JSON.stringify(d).slice(0, 800);
  } catch(e) { return ''; }
}

async function scrapeTransfermarkt(team) {
  try {
    const res = await fetch(`https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(team)}`, {
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

async function getAIAnalysis(home, away, context) {
  const GEMINI_KEY = process.env.GEMINI_KEY || 'AIzaSyB9wy077Ei7mALC6u1yENRBIckTpifEPyg';

  const prompt = `Expert football. Match: ${home} vs ${away}, saison 2025/2026. Contexte: ${context}

Retourne UNIQUEMENT ce JSON (commence { finit }) sans markdown:
{"score":"2-1","winner":"home","winner_label":"${home}","proba_home":55,"proba_draw":25,"proba_away":20,"cote_home":1.75,"cote_draw":3.20,"cote_away":4.50,"confidence":4,"verdict_text":"texte","home_form":[{"result":"W","score":"2-0","opponent":"Nom","date":"01/05/2026","competition":"Liga","corners":6,"cartons_j":1,"cartons_r":0,"fautes":10,"possession":55},{"result":"W","score":"1-0","opponent":"Nom","date":"25/04/2026","competition":"Liga","corners":5,"cartons_j":2,"cartons_r":0,"fautes":12,"possession":52},{"result":"D","score":"1-1","opponent":"Nom","date":"20/04/2026","competition":"Copa","corners":4,"cartons_j":1,"cartons_r":0,"fautes":9,"possession":48},{"result":"L","score":"0-2","opponent":"Nom","date":"13/04/2026","competition":"Liga","corners":3,"cartons_j":3,"cartons_r":1,"fautes":15,"possession":42},{"result":"W","score":"3-1","opponent":"Nom","date":"06/04/2026","competition":"Liga","corners":8,"cartons_j":0,"cartons_r":0,"fautes":8,"possession":60}],"away_form":[{"result":"W","score":"3-0","opponent":"Nom","date":"02/05/2026","competition":"Liga","corners":9,"cartons_j":1,"cartons_r":0,"fautes":8,"possession":65},{"result":"W","score":"2-1","opponent":"Nom","date":"26/04/2026","competition":"Liga","corners":7,"cartons_j":2,"cartons_r":0,"fautes":10,"possession":61},{"result":"W","score":"1-0","opponent":"Nom","date":"21/04/2026","competition":"UCL","corners":6,"cartons_j":1,"cartons_r":0,"fautes":9,"possession":58},{"result":"D","score":"2-2","opponent":"Nom","date":"14/04/2026","competition":"Liga","corners":5,"cartons_j":2,"cartons_r":0,"fautes":11,"possession":55},{"result":"W","score":"4-0","opponent":"Nom","date":"07/04/2026","competition":"Liga","corners":10,"cartons_j":0,"cartons_r":0,"fautes":7,"possession":67}],"home_stats_avg":{"corners_par_match":5.2,"cartons_j_par_match":1.4,"cartons_r_par_match":0.2,"fautes_par_match":10.8,"possession_moyenne":51.4,"buts_marques_par_match":1.4,"buts_encaisses_par_match":1.2},"away_stats_avg":{"corners_par_match":7.4,"cartons_j_par_match":1.2,"cartons_r_par_match":0.0,"fautes_par_match":9.0,"possession_moyenne":61.2,"buts_marques_par_match":2.4,"buts_encaisses_par_match":0.6},"h2h":[{"date":"15/12/2025","competition":"Liga","score_home":1,"score_away":2,"winner":"away","corners_home":4,"corners_away":7,"cartons_j_home":2,"cartons_j_away":1,"fautes_home":13,"fautes_away":9},{"date":"20/04/2025","competition":"Liga","score_home":0,"score_away":1,"winner":"away","corners_home":3,"corners_away":8,"cartons_j_home":1,"cartons_j_away":2,"fautes_home":12,"fautes_away":10},{"date":"10/11/2024","competition":"Liga","score_home":1,"score_away":3,"winner":"away","corners_home":2,"corners_away":9,"cartons_j_home":2,"cartons_j_away":0,"fautes_home":14,"fautes_away":8},{"date":"05/03/2024","competition":"Copa","score_home":0,"score_away":2,"winner":"away","corners_home":3,"corners_away":6,"cartons_j_home":1,"cartons_j_away":1,"fautes_home":11,"fautes_away":9},{"date":"18/09/2023","competition":"Liga","score_home":1,"score_away":1,"winner":"draw","corners_home":5,"corners_away":5,"cartons_j_home":2,"cartons_j_away":2,"fautes_home":10,"fautes_away":10}],"home_objective":"Objectif ${home}","home_enjeu":"normal","away_objective":"Objectif ${away}","away_enjeu":"normal","home_lineup":{"formation":"4-3-3","players":[{"num":1,"name":"Gardien","pos":"GB","form":"ok"},{"num":2,"name":"Défenseur D","pos":"DD","form":"ok"},{"num":5,"name":"Défenseur C","pos":"DC","form":"ok"},{"num":6,"name":"Défenseur C","pos":"DC","form":"ok"},{"num":3,"name":"Défenseur G","pos":"DG","form":"ok"},{"num":8,"name":"Milieu","pos":"MC","form":"hot"},{"num":14,"name":"Milieu","pos":"MC","form":"ok"},{"num":10,"name":"Milieu","pos":"MO","form":"hot"},{"num":11,"name":"Ailier","pos":"AG","form":"ok"},{"num":9,"name":"Attaquant","pos":"AT","form":"hot"},{"num":7,"name":"Ailier","pos":"AD","form":"ok"}]},"away_lineup":{"formation":"4-3-3","players":[{"num":1,"name":"Gardien","pos":"GB","form":"ok"},{"num":2,"name":"Défenseur D","pos":"DD","form":"ok"},{"num":4,"name":"Défenseur C","pos":"DC","form":"ok"},{"num":5,"name":"Défenseur C","pos":"DC","form":"ok"},{"num":3,"name":"Défenseur G","pos":"DG","form":"ok"},{"num":8,"name":"Milieu","pos":"MC","form":"ok"},{"num":16,"name":"Milieu","pos":"MC","form":"ok"},{"num":10,"name":"Milieu","pos":"MO","form":"hot"},{"num":11,"name":"Ailier","pos":"AG","form":"hot"},{"num":9,"name":"Attaquant","pos":"AT","form":"hot"},{"num":7,"name":"Ailier","pos":"AD","form":"ok"}]},"home_absents":[],"away_absents":[],"data_sources":"SofaScore + Transfermarkt + Gemini AI 2025/2026","analysis":"Analyse complète ici."}

Remplace TOUTES les valeurs par les données RÉELLES de ${home} vs ${away} en 2025/2026.`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 4000, temperature: 0.3, responseMimeType: "application/json" }
    })
  });

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON introuvable - Réponse: ' + cleaned.slice(0, 200));
  return JSON.parse(jsonMatch[0]);
}

app.post('/analyze', async (req, res) => {
  const { home, away } = req.body;
  if (!home || !away) return res.status(400).json({ error: 'Équipes manquantes' });
  try {
    const [sofa, tmHome, tmAway] = await Promise.allSettled([
      scrapeSofascore(home),
      scrapeTransfermarkt(home),
      scrapeTransfermarkt(away)
    ]);
    const context = `Sofascore: ${sofa.value || 'N/A'} | Absents ${home}: ${JSON.stringify(tmHome.value || [])} | Absents ${away}: ${JSON.stringify(tmAway.value || [])}`.slice(0, 1000);
    const result = await getAIAnalysis(home, away, context);
    if (tmHome.value?.length) result.home_absents = tmHome.value;
    if (tmAway.value?.length) result.away_absents = tmAway.value;
    res.json({ success: true, data: result });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'Football Prediction Server v3 ✅' }));
app.listen(PORT, () => console.log(`Port ${PORT}`));
