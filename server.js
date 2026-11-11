// Bibby Brickwork Training: the dust and RPE course (operatives, from a WhatsApp link) and the office side (register, records, evidence pack).
const express = require('express');
const path = require('path');
const { migrate } = require('./lib/db');
const { loadSecret } = require('./lib/auth');
const { css, publicBrand } = require('./lib/brand');
const client = require('./lib/client');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.get('/healthz', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/c', require('./routes/public'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/brand', (req, res) => res.json(publicBrand()));
app.get('/brand.css', (req, res) => res.type('text/css').set('Cache-Control', 'no-cache').send(css()));
app.get('/logo', (req, res) => {
  if (!client.logo) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=3600').type(client.logo.type).sendFile(client.logo.file);
});

const pub = path.join(__dirname, 'public');
app.use(express.static(pub, { index: false, maxAge: 0 }));
app.get('/', (req, res) => res.redirect('/admin'));
app.get('/admin', (req, res) => res.sendFile(path.join(pub, 'admin.html')));
app.get('/c/:token', (req, res) => res.sendFile(path.join(pub, 'course.html')));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Try again, and if it keeps happening let Safety Simplified know.' });
});

(async () => {
  await migrate();
  await loadSecret();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Training portal listening on ${port}`));
})().catch(e => { console.error('Startup failed:', e); process.exit(1); });
