// server.js
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const pdf = require("pdfkit");
const fs = require("fs");
const axios = require("axios");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
cors: { origin: "*" }
});

app.use(cors());
app.use(bodyParser.json());

// ✅ DÉMO : base mémoire simple (à remplacer plus tard par Supabase)
let logements = [
{ code: "codedetest", nomHote: "DemoHost", wifi: "12345678", infos: "Check-in 15h", langue: "fr" }
];

let hotes = [
{ nom: "DemoHost", codeAdmin: "admin123" }
];

// ✅ DÉMO conversation
let conversations = [];

io.on("connection", (socket) => {
console.log("🟢 Socket connecté");

socket.on("message", async ({ code, message, langue }) => {
const trad = await translate(message, langue);
conversations.push({ code, message: trad });
io.emit("new_message", { code, message: trad });
});
});

// ✅ API : vérifier code d’accès (voyageur ou hôte)
app.post("/api/verify-code", (req, res) => {
const { code } = req.body;
if (logements.find(l => l.code === code)) return res.json({ type: "voyageur" });
if (hotes.find(h => h.codeAdmin === code)) return res.json({ type: "hote" });
return res.status(404).json({ type: "inconnu" });
});

// ✅ API : générer un PDF des messages
app.get("/api/generer-pdf/:code", (req, res) => {
const doc = new pdf();
const filename = `conversation-${req.params.code}.pdf`;
res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
res.setHeader("Content-Type", "application/pdf");

doc.pipe(res);
doc.fontSize(14).text(`Conversation - Code : ${req.params.code}`);
doc.moveDown();
conversations
.filter(c => c.code === req.params.code)
.forEach(c => {
doc.text(`• ${c.message}`);
});
doc.end();
});

// ✅ Fonction traduction automatique
async function translate(text, toLang) {
try {
const res = await axios.post("https://libretranslate.de/translate", {
q: text,
source: "auto",
target: toLang,
format: "text"
}, {
headers: { accept: "application/json" }
});
return res.data.translatedText;
} catch (e) {
return text; // fallback si la traduction échoue
}
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
console.log("✅ Serveur Nomavia backend démarré sur le port " + PORT);
});