// 📁 server.js complet mis à jour

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 📩 POST - Enregistrer un message d'assistance
app.post('/api/assistance', async (req, res) => {
  const { code_acces, message, auteur } = req.body;
  const { error } = await supabase.from('assistance').insert({
    code_acces,
    message,
    auteur,
    lu_admin: false,
    lu_voyageur: auteur === 'admin'
  });
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ success: true });
});

// 📥 GET - Récupérer tous les messages d’assistance
app.get('/api/assistance', async (req, res) => {
  const { data, error } = await supabase
    .from('assistance')
    .select('*')
    .order('horodatage', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 📥 GET - Récupérer les messages pour un logement spécifique
app.get('/api/assistance/:code_acces', async (req, res) => {
  const code = req.params.code_acces;
  const { data, error } = await supabase
    .from('assistance')
    .select('*')
    .eq('code_acces', code)
    .order('horodatage', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ✅ PATCH - Marquer messages comme lus (admin ou voyageur)
app.patch('/api/assistance/lu', async (req, res) => {
  const { code_acces, lu_par } = req.body;
  const colonne = lu_par === 'admin' ? 'lu_admin' : 'lu_voyageur';
  const { error } = await supabase
    .from('assistance')
    .update({ [colonne]: true })
    .eq('code_acces', code_acces);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// 🔴 GET - Compter les messages non lus pour un utilisateur
app.get('/api/assistance/non-lus/:code_acces/:role', async (req, res) => {
  const { code_acces, role } = req.params;
  const colonne = role === 'admin' ? 'lu_admin' : 'lu_voyageur';
  const { count, error } = await supabase
    .from('assistance')
    .select('*', { count: 'exact', head: true })
    .eq('code_acces', code_acces)
    .eq(colonne, false);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ nonLus: count });
});

// ✅ Serveur en ligne
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Serveur Nomavia en ligne sur le port ${PORT}`);
});
