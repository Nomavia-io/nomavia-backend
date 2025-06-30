import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: { rejectUnauthorized: false }
});

// ✅ Route test
app.get('/', (req, res) => {
res.send('✅ Serveur backend en ligne');
});

// ✅ Vérification du code d'accès
app.get('/api/check-code/:code', async (req, res) => {
const { code } = req.params;

try {
const client = await pool.connect();

const resultLogement = await client.query(
'SELECT * FROM logements WHERE code_acces = $1',
[code]
);

if (resultLogement.rows.length > 0) {
client.release();
return res.json({
type: 'voyageur',
logement: resultLogement.rows[0]
});
}

const resultHote = await client.query(
'SELECT * FROM hote_admin WHERE code_acces = $1',
[code]
);

if (resultHote.rows.length > 0) {
const isMainAdmin = code === 'nomavia.io&890983636628';
client.release();
return res.json({
type: isMainAdmin ? 'admin' : 'hote',
hote: resultHote.rows[0]
});
}

client.release();
res.status(404).json({ error: 'Code inconnu' });
} catch (error) {
console.error('Erreur lors de la vérification du code :', error);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// ✅ Tous les logements
app.get('/api/logements-tous', async (req, res) => {
try {
const client = await pool.connect();
const result = await client.query('SELECT * FROM logements');
res.json(result.rows);
client.release();
} catch (error) {
console.error('Erreur /api/logements-tous :', error);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// ✅ Statistiques globales (📊)
app.get('/api/stats/messages', async (req, res) => {
try {
const client = await pool.connect();
const result = await client.query('SELECT COUNT(*) FROM conversations');
client.release();
res.json({ total: parseInt(result.rows[0].count) });
} catch (error) {
console.error('Erreur statistiques :', error);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// ✅ Tous les logements d’un hôte
app.get('/api/logements-par-hote/:nom', async (req, res) => {
const { nom } = req.params;

try {
const client = await pool.connect();
const result = await client.query(
'SELECT * FROM logements WHERE nom_hote = $1',
[nom]
);
res.json(result.rows);
client.release();
} catch (error) {
console.error(error);
res.status(500).json({ error: 'Erreur lors du chargement des logements.' });
}
});

// ✅ Toutes les conversations d’un logement
app.get('/api/conversations/:code_acces', async (req, res) => {
const { code_acces } = req.params;

try {
const client = await pool.connect();
const result = await client.query(
'SELECT * FROM conversations WHERE code_acces = $1 ORDER BY horodatage ASC',
[code_acces]
);
res.json(result.rows);
client.release();
} catch (error) {
console.error('Erreur récupération conversations :', error);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// ✅ Récupère les logements qui ont une alerte
app.get('/api/logements-avec-alertes', async (req, res) => {
try {
const client = await pool.connect();
const result = await client.query(
'SELECT DISTINCT code_acces FROM conversations WHERE alerte = true'
);
const codes = result.rows.map(row => row.code_acces);
client.release();
res.json(codes);
} catch (error) {
console.error('Erreur récupération alertes :', error);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// ✅ Ajouter une intervention d’admin ou message utilisateur
app.post('/api/conversations', async (req, res) => {
const { code_acces, auteur, message } = req.body;

if (!code_acces || !auteur || !message) {
return res.status(400).json({ error: 'Champs manquants' });
}

const motsCritiques = ['urgence', 'coupure', 'wifi', 'problème', 'inondation', 'danger', 'fuite', 'plainte'];
const alerte = motsCritiques.some(mot =>
message.toLowerCase().includes(mot.toLowerCase())
);

try {
const client = await pool.connect();
await client.query(
'INSERT INTO conversations (code_acces, auteur, message, alerte) VALUES ($1, $2, $3, $4)',
[code_acces, auteur, message, alerte]
);
client.release();
res.status(201).json({ message: 'Message ajouté', alerte });
} catch (error) {
console.error('Erreur ajout message :', error);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// ✅ NOUVELLE ROUTE : Envoi assistance depuis voyageur
app.post('/api/assistance', async (req, res) => {
const { code_acces, message } = req.body;

if (!code_acces || !message) {
return res.status(400).json({ error: 'Champs manquants' });
}

try {
const client = await pool.connect();
await client.query(
'INSERT INTO assistance (code_acces, message) VALUES ($1, $2)',
[code_acces, message]
);
client.release();
res.status(201).json({ message: 'Demande d’assistance enregistrée' });
} catch (error) {
console.error('Erreur ajout assistance :', error);
res.status(500).json({ error: 'Erreur serveur' });
}
});

// ✅ Lancement du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`✅ Serveur backend en ligne sur le port ${PORT}`);
});