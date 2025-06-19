import express from 'express';
import PDFDocument from 'pdfkit';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/api/generer-pdf/:code', (req, res) => {
const code = req.params.code;

const doc = new PDFDocument();
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `inline; filename="logement-${code}.pdf"`);

doc.pipe(res);
doc.fontSize(20).text(`Informations du logement pour le code : ${code}`);
doc.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`Serveur en ligne sur le port ${PORT}`);
});