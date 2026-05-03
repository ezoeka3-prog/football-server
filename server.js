const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3000;

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

async function getAIAnalysis(home, away) {
  const GEMINI_KEY = process.env.GEMINI_KEY || 'AIzaSyB9wy077Ei7mALC6u1yENRBIckTpifEPyg';

  const prompt = `Tu es un expert football. Analyse le match ${home} vs ${away} pour la saison 2025/2026.

Génère une prédiction complète avec les vraies données de cette saison.
Réponds UNIQUEMENT avec du JSON valide, sans texte avant ou après, sans markdown.

Le JSON doit avoir exactement cette structure:
{
  "score": "score prédit",
  "winner": "home ou draw ou away",
  "winner_label": "nom équipe gagnante",
  "proba_home": nombre,
  "proba_draw": nombre,
  "proba_away": nombre,
  "cote_home": nombre,
  "cote_draw": nombre,
  "cote_away": nombre,
  "confidence": nombre entre 1 et 5,
  "verdict_text": "résumé du pronostic",
  "home_form": [
    {"result":"W ou D ou L","score":"2-1","opponent":"nom adversaire","date":"JJ/MM/AAAA","competition":"nom compétition","corners":6,"cartons_j":1,"cartons_r":0,"fautes":10,"possession":55}
  ],
  "away_form": [
    {"result":"W ou D ou L","score":"1-0","opponent":"nom adversaire","date":"JJ/MM/AAAA","competition":"nom compétition","corners":5,"cartons_j":2,"cartons_r":0,"fautes":11,"possession":52}
  ],
  "home_stats_avg": {
    "corners_par_match": nombre,
    "cartons_j_par_match": nombre,
    "cartons_r_par_match": nombre,
    "fautes_par_match": nombre,
    "possession_moyenne": nombre,
    "buts_marques_par_match": nombre,
    "buts_encaisses_par_match": nombre
  },
  "away_stats_avg": {
    "corners_par_match": nombre,
    "cartons_j_par_match": nombre,
    "cartons_r_par_match": nombre,
    "fautes_par_match": nombre,
    "possession_moyenne": nombre,
    "buts_marques_par_match": nombre,
    "buts_encaisses_par_match": nombre
  },
  "h2h": [
    {"date":"JJ/MM/AAAA","competition":"nom","score_home":1,"score_away":2,"winner":"home ou draw ou away","corners_home":4,"corners_away":7,"cartons_j_home":1,"cartons_j_away":2,"fautes_home":11,"fautes_away":9}
  ],
  "home_objective": "objectif de ${home} cette saison",
  "home_enjeu": "normal ou important ou crucial",
  "away_objective": "objectif de ${away} cette saison",
  "away_enjeu": "normal ou important ou crucial",
  "home_lineup": {
    "formation": "4-3-3",
    "players": [
      {"num":1,"name":"nom","pos":"GB","form":"ok ou hot ou cold"},
      {"num":2,"name":"nom","pos":"DD","form":"ok"},
      {"num":5,"name":"nom","pos":"DC","form":"ok"},
      {"num":6,"name":"nom","pos":"DC","form":"ok"},
      {"num":3,"name":"nom","pos":"DG","form":"ok"},
      {"num":8,"name":"nom","pos":"MC","form":"ok"},
      {"num":14,"name":"nom","pos":"MC","form":"ok"},
      {"num":10,"name":"nom","pos":"MO","form":"hot"},
      {"num":11,"name":"nom","pos":"AG","form":"ok"},
      {"num":9,"name":"nom","pos":"AT","form":"hot"},
      {"num":7,"name":"nom","pos":"AD","form":"ok"}
    ]
  },
  "away_lineup": {
    "formation": "4-3-3",
    "players": [
      {"num":1,"name":"nom","pos":"GB","form":"ok"},
      {"num":2,"name":"nom","pos":"DD","form":"ok"},
      {"num":4,"name":"nom","pos":"DC","form":"ok"},
      {"num":5,"name":"nom","pos":"DC","form":"ok"},
      {"num":3,"name":"nom","pos":"DG","form":"ok"},
      {"num":8,"name":"nom","pos":"MC","form":"ok"},
      {"num":16,"name":"nom","pos":"MC","form":"ok"},
      {"num":10,"name":"nom","pos":"MO","form":"hot"},
      {"num":11,"name":"nom","pos":"AG","form":"hot"},
      {"num":9,"name":"nom","pos":"AT","form":"hot"},
      {"num":7,"name":"nom","pos":"AD","form":"ok"}
    ]
  },
  "home_absents": [],
  "away_absents": [],
  "data_sources": "Gemini AI analyse 2025/2026",
  "analysis": "analyse détaillée du match en 3 paragraphes"
}

Mets 5 matchs dans home_form, 5 dans away_form, et 5 dans h2h. Utilise les vraies données 2025/2026.`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 4000, temperature: 0.2 }
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Erreur Gemini');
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!raw) throw new Error('Réponse vide de Gemini');
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON introuvable - Réponse: ' + cleaned.slice(0, 150));
  return JSON.parse(jsonMatch[0]);
}

app.post('/analyze', async (req, res) => {
  const { home, away } = req.body;
  if (!home || !away) return res.status(400).json({ error: 'Équipes manquantes' });
  try {
    const [tmHome, tmAway] = await Promise.allSettled([
      scrapeTransfermarkt(home),
      scrapeTransfermarkt(away)
    ]);
    const result = await getAIAnalysis(home, away);
    if (tmHome.value?.length) result.home_absents = tmHome.value;
    if (tmAway.value?.length) result.away_absents = tmAway.value;
    res.json({ success: true, data: result });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'Football Prediction Server v4 ✅' }));
app.listen(PORT, () => console.log(`Port ${PORT}`));
