import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import http from 'http';

dotenv.config();

const { Pool } = pg;
const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: { rejectUnauthorized: false }
});

// Serveur HTTP + WebSocket
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
clients.add(ws);
ws.on('close', () => clients.delete(ws));

// ✅ Réception message admin via WebSocket
ws.on('message', async (data) => {
try {
const parsed = JSON.parse(data);
if (parsed.type === 'reponse_admin') {
const { code_acces, message } = parsed;

const client = await pool.connect();
const inserted = await client.query(
'INSERT INTO conversations (code_acces, auteur, message, alerte) VALUES ($1, $2, $3, false) RETURNING *',
[code_acces, 'admin', message]
);
client.release();

broadcast({ type: 'nouveau_message', data: inserted.rows[0] });
}
} catch (e) {
console.error('Erreur WebSocket admin :', e);
}
});
});

// Fonction broadcast
const broadcast = (payload) => {
for (const client of clients) {
if (client.readyState === 1) {
client.send(JSON.stringify(payload));
}
}
};

// Test de vie
app.get('/', (req, res) => res.json({ ok: true, message: 'Serveur backend en ligne' }));

// Vérification du code d'accès
app.get('/api/check-code/:code', async (req, res) => {
const { code } = req.params;
try {
const client = await pool.connect();
const rLog = await client.query('SELECT * FROM logements WHERE code_acces = $1', [code]);
if (rLog.rows.length > 0) {
client.release();
return res.json({ type: 'voyageur', logement: rLog.rows[0] });
}
const rHote = await client.query('SELECT * FROM hote_admin WHERE code_acces = $1', [code]);
if (rHote.rows.length > 0) {
const isMainAdmin = code === 'nomavia.io&890983636628';
client.release();
return res.json({ type: isMainAdmin ? 'admin' : 'hote', hote: rHote.rows[0] });
}
client.release();
return res.status(404).json({ error: 'Code inconnu' });
} catch (e) {
console.error(e);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// Tous les logements
app.get('/api/logements-tous', async (req, res) => {
try {
const client = await pool.connect();
const result = await client.query('SELECT * FROM logements');
client.release();
res.json(result.rows);
} catch (e) {
console.error(e);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// Stats messages
app.get('/api/stats/messages', async (req, res) => {
try {
const client = await pool.connect();
const result = await client.query('SELECT COUNT(*) FROM conversations');
client.release();
res.json({ total: parseInt(result.rows[0].count, 10) });
} catch (e) {
console.error(e);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// Logements par hôte
app.get('/api/logements-par-hote/:nom', async (req, res) => {
try {
const client = await pool.connect();
const result = await client.query('SELECT * FROM logements WHERE nom_hote = $1', [req.params.nom]);
client.release();
res.json(result.rows);
} catch (e) {
console.error(e);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// Conversations pour un logement
app.get('/api/conversations/:code_acces', async (req, res) => {
try {
const client = await pool.connect();
const result = await client.query(
'SELECT * FROM conversations WHERE code_acces = $1 ORDER BY horodatage ASC',
[req.params.code_acces]
);
client.release();
res.json(result.rows);
} catch (e) {
console.error(e);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// Codes avec alertes
app.get('/api/logements-avec-alertes', async (_, res) => {
try {
const client = await pool.connect();
const result = await client.query('SELECT DISTINCT code_acces FROM conversations WHERE alerte = true');
client.release();
res.json(result.rows.map(r => r.code_acces));
} catch (e) {
console.error(e);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// 📩 GET messages assistance
app.get('/api/assistance', async (_, res) => {
try {
const client = await pool.connect();
const result = await client.query(`
SELECT a.*, r.reponse
FROM assistance a
LEFT JOIN reponses_assistance r ON a.id = r.id_assistance
ORDER BY a.id DESC
`);
client.release();
res.json(result.rows);
} catch (e) {
console.error(e);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// 📬 POST message assistance (voyageur)
app.post('/api/assistance', async (req, res) => {
const { code_acces, message } = req.body;
if (!code_acces || !message) return res.status(400).json({ error: 'Champs manquants' });

try {
const client = await pool.connect();
const result = await client.query(
'INSERT INTO assistance (code_acces, message) VALUES ($1, $2) RETURNING *',
[code_acces, message]
);
client.release();

broadcast({ type: 'nouvelle_assistance', data: result.rows[0] });
res.status(201).json({ message: 'Assistance enregistrée' });
} catch (e) {
console.error(e);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// ✅ POST réponse admin à un message d’assistance
app.post('/api/assistance/reponse', async (req, res) => {
const { id_assistance, reponse } = req.body;
if (!id_assistance || !reponse) return res.status(400).json({ error: 'Champs manquants' });

try {
const client = await pool.connect();
const result = await client.query(
'INSERT INTO reponses_assistance (id_assistance, reponse) VALUES ($1, $2) RETURNING *',
[id_assistance, reponse]
);
client.release();

broadcast({ type: 'reponse_assistance', data: result.rows[0] });
res.status(201).json({ message: 'Réponse enregistrée' });
} catch (e) {
console.error(e);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// POST conversation (chat)
app.post('/api/conversations', async (req, res) => {
const { code_acces, auteur, message } = req.body;
if (!code_acces || !auteur || !message) return res.status(400).json({ error: 'Champs manquants' });

const motsCritiques = ['urgence', 'coupure', 'wifi', 'problème', 'inondation', 'danger', 'fuite', 'plainte'];
const alerte = motsCritiques.some(m => message.toLowerCase().includes(m));

try {
const client = await pool.connect();
const inserted = await client.query(
'INSERT INTO conversations (code_acces, auteur, message, alerte) VALUES ($1,$2,$3,$4) RETURNING *',
[code_acces, auteur, message, alerte]
);
client.release();

broadcast({ type: 'nouveau_message', data: inserted.rows[0] });
res.status(201).json({ message: 'Ajouté', alerte });
} catch (e) {
console.error(e);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// ✅ Serveur HTTP + WebSocket
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Serveur en ligne sur port ${PORT}`));