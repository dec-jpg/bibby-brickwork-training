// Office side. Roles: owner (Safety Simplified), admin, manager (edit), viewer (read only).
const express = require('express');
const QRCode = require('qrcode');
const { q } = require('../lib/db');
const { requireUser, hash } = require('../lib/auth');
const { clean, normPhone, csv } = require('../lib/util');
const { getSetting, setSetting } = require('../lib/brand');
const client = require('../lib/client');
const C = require('../lib/course');
const pdf = require('../lib/pdf');
const { course } = C;

const r = express.Router();
const any = requireUser(), edit = requireUser('manager'), admin = requireUser('admin'), owner = requireUser('owner');
const baseUrl = req => (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const date = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);
const wrap = fn => (req, res, next) => fn(req, res).catch(next);

function row(x) {
  const e = x.e, p = x.person;
  return { id: p.id, ref: p.ref, name: p.full_name, phone: p.phone, employer: p.employer, site: p.site, role: p.role, source: p.source,
    identity_confirmed_by: p.identity_confirmed_by, identity_confirmed_at: p.identity_confirmed_at,
    stage: x.stage, overdue: x.overdue, issued_at: x.issued_at, started_at: e && e.started_at, completed_at: e && e.completed_at, declared_at: e && e.declared_at,
    modules_done: C.modulesDone(e), attempts: x.submitted.length, score: x.best ? x.best.score : null, total: x.best ? x.best.total : null, passed_on: x.pass ? x.pass.number : null,
    fit: x.fit ? { tested_on: x.fit.tested_on, make_model: x.fit.make_model, size: x.fit.size, rpe_type: x.fit.rpe_type, method: x.fit.method, tester: x.fit.tester, certificate_ref: x.fit.certificate_ref } : null, fit_status: pdf.fitStatus(x), fit_records: x.fits.length, followups: x.followups.length };
}

async function link(req) { return `${baseUrl(req)}/c/${await getSetting('link_token')}`; }

r.get('/overview', any, wrap(async (req, res) => {
  const d = await pdf.allData();
  res.json({ state: d.state, stats: d.stats, link: await link(req), rows: d.rows.map(row),
    course: { code: course.code, title: course.title, revision: course.revision, revision_date: course.revision_date, minutes: course.minutes, modules: course.modules.length, pass_mark: course.pass_mark, questions: course.questions_per_attempt, bank: course.bank.length },
    sites: JSON.parse((await getSetting('sites')) || '[]') });
}));

r.get('/qr.svg', any, wrap(async (req, res) => res.type('image/svg+xml').send(await QRCode.toString(await link(req), { type: 'svg', margin: 1, width: 320 }))));

// ---------- the course: content, question bank, approval ----------
r.get('/course', any, wrap(async (req, res) => res.json({ course, state: await pdf.courseState() })));

// Safety Simplified reviews the course and approves it. Only then does the link go live.
r.post('/course/approve', owner, wrap(async (req, res) => {
  const name = clean(req.body.name, 120), role = clean(req.body.role, 160);
  if (!name) return res.status(400).json({ error: 'Enter the name of the person approving the alert.' });
  if (req.body.confirmed !== true) return res.status(400).json({ error: 'Tick the box to confirm the alert has been reviewed.' });
  const now = new Date().toISOString();
  await setSetting('approved_by', name); await setSetting('approved_role', role || 'Safety Simplified Ltd'); await setSetting('approved_at', now);
  await setSetting('approved_revision', String(course.revision));
  if (!(await getSetting('issued_at'))) await setSetting('issued_at', now);
  await setSetting('course_status', 'issued');
  res.json({ ok: true });
}));
r.post('/course/withdraw', owner, wrap(async (req, res) => { await setSetting('course_status', 'withdrawn'); res.json({ ok: true }); }));

r.put('/settings', admin, wrap(async (req, res) => {
  const b = req.body || {};
  if (Array.isArray(b.sites)) await setSetting('sites', JSON.stringify(b.sites.map(s => clean(s, 160)).filter(Boolean)));
  if ('due_date' in b) await setSetting('due_date', date(b.due_date) || '');
  if ('expected_headcount' in b) await setSetting('expected_headcount', String(parseInt(b.expected_headcount, 10) || ''));
  res.json({ ok: true });
}));

// ---------- people ----------
r.get('/people/:id', any, wrap(async (req, res) => {
  const d = await pdf.personData(req.params.id);
  if (!d) return res.status(404).json({ error: 'Not found.' });
  res.json({ ...row(d), modules: course.modules.map(m => ({ n: m.n, title: m.title, ...((d.e && d.e.modules && d.e.modules[m.n]) || {}) })),
    attempt_list: d.attempts.map(a => ({ number: a.number, started_at: a.started_at, submitted_at: a.submitted_at, score: a.score, total: a.total, passed: a.passed, critical_wrong: a.critical_wrong || [],
      questions: a.submitted_at ? C.detail(a) : [], review: a.review || {}, review_modules: a.submitted_at && !a.passed ? C.reviewModules(a).map(n => ({ n, title: C.moduleTitle(n) })) : [] })),
    followup_list: d.followups, fit_list: d.fits, declaration: d.e && d.e.declared_at ? { text: d.e.declaration, name: d.e.declared_name, at: d.e.declared_at } : null, locked: !!(d.e && d.e.locked) });
}));

r.get('/people/:id/signature', any, wrap(async (req, res) => {
  const e = (await q('SELECT signature FROM enrolments WHERE person_id = $1 AND course_code = $2 AND revision = $3', [req.params.id, course.code, course.revision])).rows[0];
  if (!e || !e.signature) return res.status(404).end();
  const m = e.signature.match(/^data:(image\/\w+);base64,(.+)$/);
  res.type(m[1]).send(Buffer.from(m[2], 'base64'));
}));

// The office can add the names it expects, so that people who have not opened the link show as outstanding.
r.post('/people', edit, wrap(async (req, res) => {
  const names = String(req.body.names || '').split(/\n+/).map(s => clean(s, 120)).filter(s => s && s.split(/\s+/).length >= 2);
  if (!names.length) return res.status(400).json({ error: 'Enter at least one first name and surname, one person per line.' });
  let added = 0;
  for (const n of names) {
    if ((await q('SELECT 1 FROM people WHERE LOWER(full_name) = LOWER($1) AND active', [n])).rows[0]) continue;
    const p = (await q("INSERT INTO people (full_name, employer, site, role, source) VALUES ($1,$2,$3,$4,'office') RETURNING id", [n, clean(req.body.employer, 120) || client.company, clean(req.body.site, 160), clean(req.body.role, 60)])).rows[0];
    await q('UPDATE people SET ref = $2 WHERE id = $1', [p.id, 'BB-' + String(p.id).padStart(4, '0')]);
    added++;
  }
  res.json({ added, skipped: names.length - added });
}));

r.put('/people/:id', edit, wrap(async (req, res) => {
  const b = req.body || {};
  const p = (await q('SELECT * FROM people WHERE id = $1', [req.params.id])).rows[0];
  if (!p) return res.status(404).json({ error: 'Not found.' });
  if (b.confirm_identity === true) await q('UPDATE people SET identity_confirmed_by = $2, identity_confirmed_at = NOW() WHERE id = $1', [p.id, req.user.name]);
  if (b.confirm_identity === false) await q('UPDATE people SET identity_confirmed_by = NULL, identity_confirmed_at = NULL WHERE id = $1', [p.id]);
  if ('name' in b) {
    if (!clean(b.name)) return res.status(400).json({ error: 'Enter a name.' });
    await q('UPDATE people SET full_name = $2, phone = $3, employer = $4, site = $5, role = $6 WHERE id = $1', [p.id, clean(b.name, 120), normPhone(b.phone) || null, clean(b.employer, 120), clean(b.site, 160), clean(b.role, 60)]);
  }
  res.json({ ok: true });
}));

// Removing a person deletes their record entirely. Kept to Safety Simplified, for test entries and duplicates.
r.delete('/people/:id', owner, wrap(async (req, res) => { await q('DELETE FROM people WHERE id = $1', [req.params.id]); res.json({ ok: true }); }));

// Supervisory follow-up. Recording additional instruction for someone whose assessment is locked releases one further attempt.
r.post('/people/:id/followups', edit, wrap(async (req, res) => {
  const b = req.body || {};
  const kind = ['instruction', 'chase', 'note'].includes(b.kind) ? b.kind : 'note';
  const by = clean(b.by_name, 120);
  if (!by) return res.status(400).json({ error: 'Enter who carried this out.' });
  if (kind === 'instruction' && !clean(b.notes)) return res.status(400).json({ error: 'Describe the instruction that was given.' });
  const e = (await q('SELECT * FROM enrolments WHERE person_id = $1 AND course_code = $2 AND revision = $3', [req.params.id, course.code, course.revision])).rows[0];
  const unlock = kind === 'instruction' && e && e.locked && !e.passed_at;
  await q('INSERT INTO followups (person_id, kind, by_name, by_role, happened_on, notes, unlocked, recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [req.params.id, kind, by, clean(b.by_role, 120), date(b.happened_on) || new Date().toISOString().slice(0, 10), clean(b.notes, 2000), unlock, req.user.name]);
  if (unlock) {
    await q('UPDATE enrolments SET locked = FALSE, extra_attempts = extra_attempts + 1 WHERE id = $1', [e.id]);
    await q(`UPDATE attempts SET review = review || $2::jsonb WHERE id = (SELECT id FROM attempts WHERE enrolment_id = $1 AND submitted_at IS NOT NULL AND NOT passed ORDER BY number DESC LIMIT 1)`,
      [e.id, JSON.stringify({ supervisor: new Date().toISOString() })]);
  }
  res.json({ ok: true, unlocked: unlock });
}));

// Face-fit test records: practical records, kept apart from the training record.
r.post('/people/:id/fit', edit, wrap(async (req, res) => {
  const b = req.body || {};
  if (!date(b.tested_on)) return res.status(400).json({ error: 'Enter the date.' });
  if (b.tested_on > new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: 'The date cannot be in the future.' });
  if (!clean(b.make_model)) return res.status(400).json({ error: 'Enter the make and model of the respirator.' });
  const loose = pdf.isLoose({ rpe_type: b.rpe_type });
  await q('INSERT INTO fit_records (person_id, tested_on, rpe_type, make_model, size, method, tester, certificate_ref, notes, recorded_by, result) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [req.params.id, b.tested_on, clean(b.rpe_type, 80), clean(b.make_model, 160), clean(b.size, 40), loose ? '' : clean(b.method, 40), clean(b.tester, 160), clean(b.certificate_ref, 80), clean(b.notes, 1000), req.user.name, !loose && b.result === 'Fail' ? 'Fail' : 'Pass']);
  res.json({ ok: true });
}));
r.delete('/fit/:id', edit, wrap(async (req, res) => { await q('DELETE FROM fit_records WHERE id = $1', [req.params.id]); res.json({ ok: true }); }));

// ---------- exports ----------
r.get('/people/:id/record.pdf', any, wrap(async (req, res) => {
  const d = await pdf.personData(req.params.id);
  if (!d) return res.status(404).json({ error: 'Not found.' });
  res.type('application/pdf').set('Content-Disposition', `inline; filename="training-record-${d.person.ref}-${d.person.full_name.replace(/[^a-z0-9]+/gi, '-')}.pdf"`);
  pdf.personRecord(d).pipe(res);
}));
r.get('/summary.pdf', any, wrap(async (req, res) => {
  res.type('application/pdf').set('Content-Disposition', 'inline; filename="bibby-brickwork-training-summary.pdf"');
  (await pdf.summary()).pipe(res);
}));
r.get('/evidence-pack.pdf', any, wrap(async (req, res) => {
  if ((await getSetting('course_status')) !== 'issued') return res.status(400).json({ error: 'The evidence pack is available once the alert has been approved and issued.' });
  res.type('application/pdf').set('Content-Disposition', 'inline; filename="bibby-brickwork-dust-rpe-corrective-action-training-report.pdf"');
  (await pdf.evidencePack()).pipe(res);
}));
r.get('/fit-matrix.pdf', any, wrap(async (req, res) => {
  res.type('application/pdf').set('Content-Disposition', 'inline; filename="bibby-brickwork-face-fit-matrix.pdf"');
  (await pdf.fitMatrix()).pipe(res);
}));
r.get('/register.csv', any, wrap(async (req, res) => {
  const d = await pdf.allData();
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="bibby-brickwork-training-register.csv"').send(csv(d.rows.map(row), [
    { label: 'ID', key: 'ref' }, { label: 'Name', key: 'name' }, { label: 'Mobile', key: 'phone' }, { label: 'Employer', key: 'employer' }, { label: 'Site', key: 'site' }, { label: 'Role', key: 'role' },
    { label: 'Issued', get: x => pdf.dt(x.issued_at) }, { label: 'Commenced', get: x => pdf.dt(x.started_at) }, { label: 'Alert read', get: x => (x.modules_done ? 'Yes' : 'No') },
    { label: 'Attempts', key: 'attempts' }, { label: 'Score', get: x => (x.score == null ? '' : `${x.score}/${x.total}`) }, { label: 'Training status', get: x => x.stage.label + (x.overdue ? ' (overdue)' : '') },
    { label: 'Declaration signed', get: x => pdf.dt(x.declared_at) }, { label: 'Completed', get: x => pdf.dt(x.completed_at) }, { label: 'Face-fit record held', get: x => (x.fit ? `${x.fit.make_model} (${pdf.day(x.fit.tested_on)})` : 'None entered') }, { label: 'Face-fit status', key: 'fit_status' },
  ]));
}));

// ---------- users ----------
r.get('/users', admin, wrap(async (req, res) => {
  res.json({ rows: (await q(`SELECT id, name, email, role, active, created_at FROM users WHERE $1 OR role <> 'owner' ORDER BY name`, [req.user.role === 'owner'])).rows });
}));
r.post('/users', admin, wrap(async (req, res) => {
  const b = req.body || {};
  if (!clean(b.name) || !clean(b.email) || !b.password || b.password.length < 8) return res.status(400).json({ error: 'Enter a name, an email and a password of at least 8 characters.' });
  const roles = req.user.role === 'owner' ? ['owner', 'admin', 'manager', 'viewer'] : ['admin', 'manager', 'viewer'];
  try {
    const u = (await q('INSERT INTO users (name, email, password_hash, role) VALUES ($1, LOWER($2), $3, $4) RETURNING id', [clean(b.name, 120), clean(b.email, 160), await hash(b.password), roles.includes(b.role) ? b.role : 'manager'])).rows[0];
    res.json({ id: u.id });
  } catch (e) { if (e.code === '23505') return res.status(400).json({ error: 'There is already an account with that email.' }); throw e; }
}));
r.put('/users/:id', admin, wrap(async (req, res) => {
  const b = req.body || {};
  const target = (await q('SELECT role FROM users WHERE id = $1', [req.params.id])).rows[0];
  if (!target) return res.status(404).json({ error: 'Not found.' });
  if (target.role === 'owner' && req.user.role !== 'owner') return res.status(403).json({ error: 'Only Safety Simplified can change this account.' });
  if (Number(req.params.id) === req.user.id && b.active === false) return res.status(400).json({ error: 'You cannot remove your own access.' });
  if (b.password && b.password.length < 8) return res.status(400).json({ error: 'Passwords need at least 8 characters.' });
  if (typeof b.active === 'boolean') await q('UPDATE users SET active = $1 WHERE id = $2', [b.active, req.params.id]);
  if (b.password) await q('UPDATE users SET password_hash = $1 WHERE id = $2', [await hash(b.password), req.params.id]);
  res.json({ ok: true });
}));

module.exports = r;
