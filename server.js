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

// ✅ Route test pour voir si le backend répond
app.get('/', (req, res) => {
res.send('✅ Serveur backend en ligne');
});

// ✅ Route de vérification du code d'accès
app.get('/api/check-code/:code', async (req, res) => {
const { code } = req.params;

try {
const client = await pool.connect();

// Vérifie d'abord dans les logements
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

// Sinon, vérifie dans les hôtes
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`✅ Serveur backend en ligne sur le port ${PORT}`);
});