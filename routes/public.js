// Operative side, opened from the course link sent on WhatsApp: /c/TOKEN.
// One shared link. Each person gives their name, mobile, employer, site and role, and the register is built from that.
// Everything they then do (modules read, questions presented, answers given, declaration) is recorded against them.
const express = require('express');
const { q } = require('../lib/db');
const { token, clean, normPhone, surname, validImage } = require('../lib/util');
const { getSetting } = require('../lib/brand');
const client = require('../lib/client');
const C = require('../lib/course');
const pdf = require('../lib/pdf');
const { course } = C;

const r = express.Router({ mergeParams: true });
const MIN_MODULE_SECONDS = process.env.MIN_MODULE_SECONDS ? Number(process.env.MIN_MODULE_SECONDS) : 10;

// The link must be the current one and the course must have been approved and issued.
async function gate(req, res, next) {
  try {
    if (req.params.link !== (await getSetting('link_token'))) return res.status(404).json({ error: 'This course link is not active. Ask your supervisor for the current link.' });
    if ((await getSetting('course_status')) !== 'issued') return res.status(403).json({ error: 'This course has not been issued yet. Your supervisor will let you know when it is ready.' });
    next();
  } catch (e) { next(e); }
}

async function load(req) {
  const t = req.get('x-enrol-token') || req.query.t;
  if (!t) return null;
  const e = (await q('SELECT * FROM enrolments WHERE token = $1', [String(t)])).rows[0];
  if (!e) return null;
  const person = (await q('SELECT * FROM people WHERE id = $1', [e.person_id])).rows[0];
  const attempts = (await q('SELECT * FROM attempts WHERE enrolment_id = $1 ORDER BY number', [e.id])).rows;
  return { e, person, attempts };
}
function need(fn) {
  return async (req, res, next) => {
    try {
      const s = await load(req);
      if (!s) return res.status(401).json({ error: 'Enter your details to carry on.', identify: true });
      await fn(req, res, s);
    } catch (err) { next(err); }
  };
}

function view(s) {
  const st = C.stage(s.e, s.attempts);
  const submitted = s.attempts.filter(a => a.submitted_at);
  const last = submitted[submitted.length - 1];
  const out = {
    person: { name: s.person.full_name, ref: s.person.ref, phone: s.person.phone, employer: s.person.employer, site: s.person.site, role: s.person.role },
    stage: st, modules_done: C.modulesDone(s.e), attempts: submitted.length, allowed: C.allowedAttempts(s.e),
    completed_at: s.e.completed_at, passed_at: s.e.passed_at,
  };
  if (last) out.last = { number: last.number, score: last.score, total: last.total, pct: Math.round((last.score / last.total) * 100), passed: last.passed, critical_failed: (last.critical_wrong || []).length > 0 };
  if (last && !last.passed) out.feedback = C.feedback(last);
  return out;
}

r.get('/:link', gate, async (req, res) => {
  res.json({
    course: { code: course.code, title: course.title, revision: course.revision, pass_mark: course.pass_mark, questions: course.questions_per_attempt,
      modules: course.modules.map(m => ({ n: m.n, title: m.title, mins: m.mins })), declaration: course.declaration },
    company: client.company, sites: JSON.parse((await getSetting('sites')) || '[]'), roles: client.roles || [],
  });
});

// Who are you. Someone already on the register (same mobile and surname, or an exact name the office added) carries on where they left off.
r.post('/:link/enrol', gate, async (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 120), phone = normPhone(b.phone), employer = clean(b.employer, 120), site = clean(b.site, 160), role = clean(b.role, 60);
  if (!name || name.split(/\s+/).length < 2) return res.status(400).json({ error: 'Enter your first name and surname.' });
  if (phone.length < 10) return res.status(400).json({ error: 'Enter your mobile number.' });
  if (!employer) return res.status(400).json({ error: 'Enter who you work for.' });
  if (!site) return res.status(400).json({ error: 'Choose the site you are working on.' });
  if (!role) return res.status(400).json({ error: 'Choose your role.' });
  let person = (await q('SELECT * FROM people WHERE phone = $1 AND active', [phone])).rows.find(p => surname(p.full_name) === surname(name));
  if (!person) {
    const named = (await q('SELECT * FROM people WHERE LOWER(full_name) = LOWER($1) AND active AND phone IS NULL', [name])).rows;
    if (named.length === 1) person = (await q('UPDATE people SET phone = $2, employer = COALESCE(employer, $3), site = COALESCE(site, $4), role = COALESCE(role, $5) WHERE id = $1 RETURNING *', [named[0].id, phone, employer, site, role])).rows[0];
  }
  if (!person) {
    person = (await q("INSERT INTO people (full_name, phone, employer, site, role, source) VALUES ($1,$2,$3,$4,$5,'link') RETURNING *", [name, phone, employer, site, role])).rows[0];
    person = (await q('UPDATE people SET ref = $2 WHERE id = $1 RETURNING *', [person.id, 'BB-' + String(person.id).padStart(4, '0')])).rows[0];
  }
  let e = (await q('SELECT * FROM enrolments WHERE person_id = $1 AND course_code = $2 AND revision = $3', [person.id, course.code, course.revision])).rows[0];
  if (!e) {
    const issued = new Date(await getSetting('issued_at') || Date.now());
    const issuedAt = person.source === 'office' && new Date(person.created_at) > issued ? person.created_at : issued;
    e = (await q('INSERT INTO enrolments (person_id, course_code, revision, token, issued_at, started_at, device) VALUES ($1,$2,$3,$4,$5,NOW(),$6) RETURNING *',
      [person.id, course.code, course.revision, token(), issuedAt, clean(req.get('user-agent'), 300)])).rows[0];
  }
  const attempts = (await q('SELECT * FROM attempts WHERE enrolment_id = $1 ORDER BY number', [e.id])).rows;
  res.json({ token: e.token, ...view({ e, person, attempts }) });
});

r.get('/:link/me', gate, need(async (req, res, s) => res.json(view(s))));

r.get('/:link/content', gate, need(async (req, res) => res.json({ modules: course.modules })));

// A module is opened, then completed. Modules are taken in order.
r.post('/:link/module', gate, need(async (req, res, s) => {
  const n = parseInt(req.body.n, 10), action = req.body.action;
  if (!course.modules.find(m => m.n === n)) return res.status(400).json({ error: 'That module does not exist.' });
  const mods = s.e.modules || {}, done = C.modulesDone(s.e), now = new Date().toISOString();
  if (n > done + 1) return res.status(400).json({ error: `Complete module ${done + 1} first.` });
  // Re-reading a module after a failed attempt counts as additional instruction and is recorded on that attempt.
  const st = C.stage(s.e, s.attempts);
  if (st.key === 'review' && action === 'complete' && st.review_modules.includes(n)) {
    const last = s.attempts.filter(a => a.submitted_at && !a.passed).pop();
    await q('UPDATE attempts SET review = review || $2::jsonb WHERE id = $1', [last.id, JSON.stringify({ [n]: now })]);
  }
  if (mods[n] && mods[n].c) return res.json(view(await load(req)));
  if (action === 'open') { if (!mods[n]) mods[n] = { o: now }; }
  else {
    const opened = mods[n] && mods[n].o ? new Date(mods[n].o) : null;
    if (!opened || (Date.now() - opened) / 1000 < MIN_MODULE_SECONDS) return res.status(400).json({ error: 'Read the module to the end before moving on.' });
    mods[n] = { o: mods[n].o, c: now };
  }
  await q('UPDATE enrolments SET modules = $2 WHERE id = $1', [s.e.id, JSON.stringify(mods)]);
  res.json(view(await load(req)));
}));

// Start (or carry on with) an assessment. The paper is fixed when it is drawn, so reloading the page does not give a new one.
r.post('/:link/attempt', gate, need(async (req, res, s) => {
  const st = C.stage(s.e, s.attempts);
  if (st.key !== 'assessment') return res.status(400).json({ error: st.key === 'locked' ? 'Speak to your supervisor before you take the assessment again.' : st.key === 'review' ? 'Go back over the modules listed before you take the assessment again.' : 'The assessment is not available yet.' });
  let open = s.attempts.find(a => !a.submitted_at);
  if (!open) {
    const prev = s.attempts[s.attempts.length - 1];
    open = (await q('INSERT INTO attempts (enrolment_id, number, presented) VALUES ($1,$2,$3) RETURNING *', [s.e.id, s.attempts.length + 1, JSON.stringify(C.draw(prev && prev.presented))])).rows[0];
  }
  res.json({ number: open.number, questions: C.paper(open.presented), pass_mark: course.pass_mark });
}));

r.post('/:link/attempt/submit', gate, need(async (req, res, s) => {
  const open = s.attempts.find(a => !a.submitted_at);
  if (!open) return res.status(400).json({ error: 'There is no assessment in progress.' });
  const answers = Array.isArray(req.body.answers) ? req.body.answers.map(a => (Number.isInteger(a) ? a : null)) : [];
  if (answers.length !== open.presented.length || answers.some(a => a == null)) return res.status(400).json({ error: 'Answer every question before you submit.' });
  const m = C.mark(open.presented, answers);
  await q('UPDATE attempts SET answers = $2, score = $3, total = $4, critical_wrong = $5, passed = $6, submitted_at = NOW() WHERE id = $1',
    [open.id, JSON.stringify(answers), m.score, m.total, JSON.stringify(m.critical_wrong), m.passed]);
  if (m.passed) await q('UPDATE enrolments SET passed_at = NOW() WHERE id = $1', [s.e.id]);
  else {
    const failed = s.attempts.filter(a => a.submitted_at && !a.passed).length + 1;
    if (failed >= C.allowedAttempts(s.e)) await q('UPDATE enrolments SET locked = TRUE WHERE id = $1', [s.e.id]);
  }
  res.json(view(await load(req)));
}));

r.post('/:link/declare', gate, need(async (req, res, s) => {
  if (!s.e.passed_at) return res.status(400).json({ error: 'Pass the assessment first.' });
  if (s.e.completed_at) return res.json(view(s));
  const name = clean(req.body.name, 120);
  if (req.body.agreed !== true) return res.status(400).json({ error: 'Tick the box to confirm the declaration.' });
  if (!name || surname(name) !== surname(s.person.full_name)) return res.status(400).json({ error: 'Type your full name as you entered it at the start.' });
  if (!validImage(req.body.signature, 400_000)) return res.status(400).json({ error: 'Sign in the box to confirm.' });
  await q('UPDATE enrolments SET declared_at = NOW(), completed_at = NOW(), declared_name = $2, declaration = $3, signature = $4 WHERE id = $1', [s.e.id, name, course.declaration, req.body.signature]);
  res.json(view(await load(req)));
}));

// Their own training record.
r.get('/:link/record.pdf', gate, need(async (req, res, s) => {
  if (!s.e.completed_at) return res.status(400).json({ error: 'Your record is available once the course is complete.' });
  const data = await pdf.personData(s.person.id);
  res.type('application/pdf').set('Content-Disposition', `inline; filename="training-record-${s.person.ref}.pdf"`);
  pdf.personRecord(data).pipe(res);
}));

module.exports = r;
