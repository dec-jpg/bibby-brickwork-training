// PDFs: an individual training record, the company-wide summary, and the HSE evidence pack.
// Every figure is read from the database when the PDF is made. Nothing is written in that the records do not show.
const PDFDocument = require('pdfkit');
const { q } = require('./db');
const { getSetting } = require('./brand');
const client = require('./client');
const C = require('./course');
const { course } = C;

const INK = '#17150f', FAINT = '#6f685d', LINE = '#d9d4c9', BAND = '#f3f1ec', OK = '#1e7a4a', BAD = '#b3261e', WARN = '#8a6219';
const BRAND = client.colour || '#1f3a5f';
const M = 42;

const fmtDT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dt = d => (d ? fmtDT.format(new Date(d)).replace(',', '') : '');
const day = d => (d ? (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : dt(d).slice(0, 10)) : '');
const longDay = d => new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T12:00:00Z' : d).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric' });

// ---------- data ----------
async function courseState() {
  return {
    status: await getSetting('course_status'), approved_by: await getSetting('approved_by'), approved_role: await getSetting('approved_role'),
    approved_at: await getSetting('approved_at'), issued_at: await getSetting('issued_at'), due_date: await getSetting('due_date'),
    expected: parseInt(await getSetting('expected_headcount'), 10) || null,
  };
}

function shape(person, e, attempts, followups, fits, state) {
  const st = C.stage(e, attempts);
  const submitted = attempts.filter(a => a.submitted_at);
  const pass = submitted.find(a => a.passed);
  const issued = e ? e.issued_at : (state.issued_at ? (person.source === 'office' && new Date(person.created_at) > new Date(state.issued_at) ? person.created_at : state.issued_at) : null);
  const overdue = !!state.due_date && st.key !== 'complete' && new Date().toISOString().slice(0, 10) > state.due_date;
  // The record that counts on the matrix: the latest pass, or loose-fitting powered air issued (no fit test needed).
  const fit = fits.find(f => f.result !== 'Fail') || null;
  return { person, e, attempts, submitted, followups, fits, fit, stage: st, pass, issued_at: issued, overdue,
    best: pass || submitted[submitted.length - 1] || null };
}

async function allData() {
  const state = await courseState();
  const people = (await q('SELECT * FROM people WHERE active ORDER BY full_name')).rows;
  const enrol = (await q('SELECT * FROM enrolments WHERE course_code = $1 AND revision = $2', [course.code, course.revision])).rows;
  const atts = (await q('SELECT a.* FROM attempts a JOIN enrolments e ON e.id = a.enrolment_id WHERE e.course_code = $1 AND e.revision = $2 ORDER BY a.number', [course.code, course.revision])).rows;
  const fol = (await q('SELECT * FROM followups ORDER BY created_at')).rows;
  const fit = (await q('SELECT * FROM fit_records ORDER BY tested_on DESC, id DESC')).rows;
  const rows = people.map(p => {
    const e = enrol.find(x => x.person_id === p.id) || null;
    return shape(p, e, e ? atts.filter(a => a.enrolment_id === e.id) : [], fol.filter(f => f.person_id === p.id), fit.filter(f => f.person_id === p.id), state);
  });
  return { state, rows, stats: stats(rows, state) };
}

async function personData(id) {
  const d = await allData();
  const row = d.rows.find(r => r.person.id === Number(id));
  return row ? { ...row, state: d.state } : null;
}

function stats(rows, state) {
  const n = k => rows.filter(r => r.stage.key === k).length;
  const submitted = rows.flatMap(r => r.submitted);
  const passed = rows.filter(r => r.pass);
  const first = passed.filter(r => r.pass.number === 1).length;
  const missed = {};
  for (const r of rows) for (const a of r.submitted) for (const d of C.detail(a)) if (!d.correct) missed[d.id] = (missed[d.id] || 0) + 1;
  return {
    register: rows.length, expected: state.expected,
    complete: n('complete'), passed_not_signed: n('passed'), in_progress: n('in_progress'), assessment: n('assessment'), review: n('review'), locked: n('locked'), not_started: n('not_started'),
    started: rows.filter(r => r.e && r.e.started_at).length,
    overdue: rows.filter(r => r.overdue).length,
    attempts: submitted.length, failed_attempts: submitted.filter(a => !a.passed).length,
    passed: passed.length, first_time: first, after_reassessment: passed.length - first,
    avg_pass_pct: passed.length ? Math.round(passed.reduce((s, r) => s + (r.pass.score / r.pass.total) * 100, 0) / passed.length) : null,
    fit_held: rows.filter(r => r.fit).length,
    missed: Object.entries(missed).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, count]) => ({ id, count, q: (C.byId[id] || {}).q || id })),
  };
}

// ---------- drawing helpers ----------
function newDoc(title, layout = 'portrait') {
  const doc = new PDFDocument({ size: 'A4', layout, margins: { top: M, bottom: 54, left: M, right: M }, bufferPages: true, info: { Title: title, Author: 'Safety Simplified Ltd' } });
  doc.W = () => doc.page.width - 2 * M;
  return doc;
}
const room = (doc, h) => { if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage(); };

function h1(doc, text) {
  room(doc, 60);
  doc.moveDown(0.6).font('Helvetica-Bold').fontSize(13).fillColor(INK).text(text, M, doc.y, { width: doc.W() });
  doc.rect(M, doc.y + 3, doc.W(), 1.5).fill(BRAND);
  doc.y += 12; doc.x = M;
}
function h2(doc, text) { room(doc, 40); doc.moveDown(0.5).font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(text, M, doc.y, { width: doc.W() }); doc.moveDown(0.25); }
function para(doc, text, o = {}) { doc.font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(o.size || 9.5).fillColor(o.color || INK).text(text, M, doc.y, { width: doc.W(), lineGap: 2 }); doc.moveDown(0.5); }
function bullets(doc, items) {
  for (const it of items) {
    doc.font('Helvetica').fontSize(9.5);
    room(doc, doc.heightOfString(it, { width: doc.W() - 14 }) + 4);
    const y = doc.y;
    doc.fillColor(BRAND).circle(M + 4, y + 5, 1.8).fill();
    doc.fillColor(INK).text(it, M + 14, y, { width: doc.W() - 14, lineGap: 1.5 });
    doc.y += 3;
  }
  doc.moveDown(0.3); doc.x = M;
}
function kv(doc, pairs, lw = 150) {
  for (const [k, v] of pairs) {
    const val = v == null || v === '' ? 'Not recorded' : String(v);
    const label = k.toUpperCase();
    doc.font('Helvetica-Bold').fontSize(8);
    const lh = doc.heightOfString(label, { width: lw - 10, characterSpacing: 0.4 });
    doc.font('Helvetica').fontSize(9.5);
    const h = Math.max(doc.heightOfString(val, { width: doc.W() - lw }), lh + 2, 11) + 6;
    room(doc, h);
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(FAINT).text(label, M, y + 1.5, { width: lw - 10, characterSpacing: 0.4 });
    doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(val, M + lw, y, { width: doc.W() - lw });
    doc.y = y + h - 2;
    doc.strokeColor(LINE).lineWidth(0.5).moveTo(M, doc.y).lineTo(M + doc.W(), doc.y).stroke();
    doc.y += 4;
  }
  doc.moveDown(0.3); doc.x = M;
}
// cols: [{ label, w (share), align, color(row) }]. rows: arrays of strings.
function table(doc, cols, rows, o = {}) {
  const fs = o.size || 8.5, pad = 4;
  const sum = cols.reduce((s, c) => s + c.w, 0);
  const widths = cols.map(c => (c.w / sum) * doc.W());
  const xs = widths.map((_, i) => M + widths.slice(0, i).reduce((s, w) => s + w, 0));
  const head = () => {
    doc.font('Helvetica-Bold').fontSize(7.2);
    const hh = Math.max(...cols.map((c, i) => doc.heightOfString(c.label.toUpperCase(), { width: widths[i] - 2 * pad }))) + 2 * pad;
    doc.rect(M, doc.y, doc.W(), hh).fill(BAND);
    const y = doc.y;
    cols.forEach((c, i) => doc.fillColor(FAINT).text(c.label.toUpperCase(), xs[i] + pad, y + pad, { width: widths[i] - 2 * pad, align: c.align || 'left' }));
    doc.y = y + hh;
  };
  room(doc, 50); head();
  rows.forEach(row => {
    doc.font('Helvetica').fontSize(fs);
    const rh = Math.max(...row.map((cell, i) => doc.heightOfString(String(cell ?? ''), { width: widths[i] - 2 * pad }))) + 2 * pad;
    if (doc.y + rh > doc.page.height - doc.page.margins.bottom) { doc.addPage(); head(); }
    const y = doc.y;
    row.forEach((cell, i) => {
      const c = cols[i]; const text = String(cell ?? '');
      const col = c.color ? c.color(text, row) : INK;
      doc.font(c.bold || col !== INK ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs).fillColor(col).text(text, xs[i] + pad, y + pad, { width: widths[i] - 2 * pad, align: c.align || 'left' });
    });
    doc.y = y + rh;
    doc.strokeColor(LINE).lineWidth(0.5).moveTo(M, doc.y).lineTo(M + doc.W(), doc.y).stroke();
  });
  doc.moveDown(0.8); doc.x = M;
}
function note(doc, text, color = WARN) {
  doc.font('Helvetica-Bold').fontSize(9);
  const h = doc.heightOfString(text, { width: doc.W() - 24, lineGap: 2 }) + 16;
  room(doc, h + 6);
  const y = doc.y;
  doc.rect(M, y, doc.W(), h).fill('#faf6ec'); doc.rect(M, y, 3.5, h).fill(color);
  doc.fillColor(INK).text(text, M + 14, y + 8, { width: doc.W() - 24, lineGap: 2 });
  doc.y = y + h + 8; doc.x = M;
}
function banner(doc, kicker, title, sub) {
  doc.rect(0, 0, doc.page.width, 6).fill(BRAND);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND).text(kicker.toUpperCase(), M, M, { characterSpacing: 0.8 });
  doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text(title, M, doc.y + 3, { width: doc.W() });
  if (sub) doc.font('Helvetica').fontSize(9.5).fillColor(FAINT).text(sub, M, doc.y + 2, { width: doc.W() });
  doc.moveDown(0.8);
}
function finish(doc, footText, line2) {
  const range = doc.bufferedPageRange();
  const made = `Produced ${dt(new Date())}`;
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const keep = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    const y = doc.page.height - 34, w = doc.page.width - 2 * M;
    doc.strokeColor(LINE).lineWidth(0.5).moveTo(M, y - 6).lineTo(M + w, y - 6).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(FAINT);
    doc.text(footText, M, y, { width: w * 0.7, lineBreak: false });
    doc.text(`${made}   Page ${i + 1} of ${range.count}`, M, y, { width: w, align: 'right', lineBreak: false });
    doc.text(line2 || 'Prepared by Safety Simplified Ltd from the Bibby Brickwork training system. Training records only: not evidence of face-fit testing or site compliance.', M, y + 10, { width: w, lineBreak: false });
    doc.page.margins.bottom = keep;
  }
  doc.end();
  return doc;
}

// ---------- individual training record ----------
const SEPARATE = 'This record shows that the operative completed the training course and was assessed on their understanding of it. It is not evidence that the operative has passed a face-fit test, or that they are following the requirements on site. Face-fit testing is carried out by a competent fit tester and site compliance is checked through recorded supervisor monitoring. Both are recorded separately.';

function renderPerson(doc, d) {
  const { person: p, e, stage: st, state } = d;
  banner(doc, `${client.company}: individual training record`, p.full_name, `${course.title}. Revision ${course.revision}.`);
  kv(doc, [
    ['Name', p.full_name], ['Identifier', p.ref], ['Mobile number', p.phone], ['Employer', p.employer], ['Site', p.site], ['Role', p.role],
    ['Identity', p.identity_confirmed_by ? `Confirmed by ${p.identity_confirmed_by} on ${dt(p.identity_confirmed_at)}` : (p.source === 'office' ? 'Added to the register by the office' : 'Name and mobile number given by the operative on enrolment')],
  ]);
  h1(doc, 'Course and status');
  kv(doc, [
    ['Course', `${course.title} (${course.code})`], ['Revision', `Revision ${course.revision}, dated ${day(course.revision_date)}`],
    ['Approved for issue', state.approved_at ? `${state.approved_by}${state.approved_role ? ', ' + state.approved_role : ''}, ${dt(state.approved_at)}` : null],
    ['Issued', dt(d.issued_at)], ['Commenced', e ? dt(e.started_at) : 'Not started'],
    ['Modules completed', `${C.modulesDone(e)} of ${course.modules.length}`],
    ['Assessment', d.pass ? `Passed on attempt ${d.pass.number}: ${d.pass.score} of ${d.pass.total} (${Math.round(d.pass.score / d.pass.total * 100)}%), ${dt(d.pass.submitted_at)}` : (d.submitted.length ? `Not passed. ${d.submitted.length} attempt${d.submitted.length > 1 ? 's' : ''} made` : 'Not taken')],
    ['Declaration', e && e.declared_at ? `Signed ${dt(e.declared_at)}` : 'Not signed'],
    ['Completed', e && e.completed_at ? dt(e.completed_at) : 'Not complete'],
    ['Status', st.label + (d.overdue ? ' (overdue)' : '')],
  ]);
  note(doc, SEPARATE);

  h1(doc, 'Modules completed');
  table(doc, [{ label: 'No.', w: 6 }, { label: 'Module', w: 54 }, { label: 'Opened', w: 20 }, { label: 'Completed', w: 20 }],
    course.modules.map(m => { const x = (e && e.modules && e.modules[m.n]) || {}; return [m.n, m.title, dt(x.o), x.c ? dt(x.c) : 'Not completed']; }));

  h1(doc, 'Assessment and reassessment history');
  if (!d.attempts.length) para(doc, 'No assessment has been started.');
  para(doc, `Pass mark ${course.pass_mark}%. Questions marked (C) are safety-critical and must all be answered correctly to pass, whatever the overall score. Each paper is ${course.questions_per_attempt} questions drawn from a bank of ${course.bank.length}, with the question order and answer order changed for each attempt.`, { size: 8.5, color: FAINT });
  for (const a of d.attempts) {
    h2(doc, `Attempt ${a.number}`);
    if (!a.submitted_at) { kv(doc, [['Started', dt(a.started_at)], ['Result', 'In progress, not yet submitted']]); continue; }
    const cw = (a.critical_wrong || []).length;
    kv(doc, [['Started', dt(a.started_at)], ['Submitted', dt(a.submitted_at)], ['Score', `${a.score} of ${a.total} (${Math.round(a.score / a.total * 100)}%)`],
      ['Safety-critical questions', cw ? `${cw} answered incorrectly` : 'All answered correctly'], ['Result', a.passed ? 'PASS' : 'FAIL']]);
    table(doc, [{ label: 'No.', w: 5 }, { label: 'Question presented', w: 45 }, { label: 'Answer given', w: 40 }, { label: 'Result', w: 10, color: t => (t === 'Correct' ? OK : BAD) }],
      C.detail(a).map(x => [x.n, (x.critical ? '(C) ' : '') + x.q, x.given || 'No answer', x.correct ? 'Correct' : 'Incorrect']), { size: 8 });
    if (!a.passed) {
      const rev = a.review || {}; const mods = C.reviewModules(a);
      const lines = mods.map(n => `Module ${n}, ${C.moduleTitle(n)}: ${rev[n] ? 're-read ' + dt(rev[n]) : 'not yet re-read'}`);
      h2(doc, `Additional instruction after attempt ${a.number}`);
      para(doc, 'After a failed attempt the operative is shown why each incorrect answer was wrong and must go back over the modules below before the assessment can be taken again.', { size: 8.5, color: FAINT });
      bullets(doc, lines);
      if (rev.supervisor) para(doc, `Supervisor instruction recorded ${dt(rev.supervisor)} (see supervisory follow-up).`);
    }
  }

  h1(doc, 'Supervisory follow-up');
  if (!d.followups.length) para(doc, 'No supervisory follow-up has been recorded for this operative.');
  else table(doc, [{ label: 'Date', w: 12 }, { label: 'Type', w: 18 }, { label: 'Carried out by', w: 22 }, { label: 'Notes', w: 48 }],
    d.followups.map(f => [day(f.happened_on) || day(f.created_at), FOLLOW[f.kind] || f.kind, f.by_name + (f.by_role ? `, ${f.by_role}` : ''), (f.notes || '') + (f.unlocked ? ' (Reassessment released.)' : '')]));

  h1(doc, 'Individual acknowledgement');
  if (e && e.declared_at) {
    room(doc, 150);
    para(doc, `"${e.declaration}"`);
    kv(doc, [['Name entered', e.declared_name], ['Date and time', dt(e.declared_at)]]);
    if (e.signature) { room(doc, 80); const y = doc.y; doc.font('Helvetica-Bold').fontSize(8).fillColor(FAINT).text('SIGNATURE', M, y); try { doc.image(e.signature, M, y + 12, { fit: [220, 60] }); } catch { /* unreadable image */ } doc.y = y + 78; }
  } else para(doc, 'The declaration has not been signed. It can only be signed after the assessment has been passed.');

  h1(doc, 'Practical competence (recorded separately from training)');
  para(doc, 'Face-fit test records entered in this system for this operative:');
  if (!d.fits.length) para(doc, 'None. No face-fit test record has been entered in this system for this operative.', { bold: true });
  else table(doc, [{ label: 'Date', w: 11 }, { label: 'RPE type', w: 20 }, { label: 'Make, model and size', w: 25 }, { label: 'Method', w: 11 }, { label: 'Fit tester', w: 15 }, { label: 'Certificate', w: 10 }, { label: 'Result', w: 8, color: t => (t === 'Fail' ? BAD : OK) }],
    d.fits.map(f => [day(f.tested_on), f.rpe_type, [f.make_model, f.size].filter(Boolean).join(', '), f.method, f.tester, f.certificate_ref, isLoose(f) ? 'Issued' : f.result]));
  para(doc, 'A face-fit test record applies only to the make, model and size of respirator shown.', { size: 8.5, color: FAINT });
}
const isLoose = f => /loose|powered/i.test(f.rpe_type || '');
const fitStatus = r => (!r.fit ? (r.fits.length ? 'Fit test failed, no pass held' : 'No record') : isLoose(r.fit) ? 'Powered air issued' : 'Fit tested');
const FOLLOW = { instruction: 'Additional instruction', chase: 'Reminder to complete', note: 'Note' };

function personRecord(d) {
  const doc = newDoc(`Training record: ${d.person.full_name}`);
  renderPerson(doc, d);
  return finish(doc, `${client.company}. Training record: ${d.person.full_name} (${d.person.ref}).`);
}

// ---------- company-wide summary ----------
const scoreOf = r => (r.best ? `${r.best.score}/${r.best.total}` : '');
function summaryTable(doc, rows) {
  table(doc, [
    { label: 'ID', w: 6 }, { label: 'Name', w: 14, bold: true }, { label: 'Employer', w: 10.5 }, { label: 'Site', w: 11 }, { label: 'Role', w: 8 },
    { label: 'Issued', w: 9 }, { label: 'Commenced', w: 9 }, { label: 'Completed', w: 9 }, { label: 'Attempts', w: 7.5, align: 'center' }, { label: 'Score', w: 6, align: 'center' },
    { label: 'Training status', w: 13.5, color: t => (t.startsWith('Complete') ? OK : /Failed|overdue/i.test(t) ? BAD : WARN) }, { label: 'Declaration', w: 9.5 }, { label: 'Face-fit record held', w: 9 },
  ], rows.map(r => [r.person.ref, r.person.full_name, r.person.employer, r.person.site, r.person.role, dt(r.issued_at), r.e ? dt(r.e.started_at) : '', r.e && r.e.completed_at ? dt(r.e.completed_at) : '',
    r.submitted.length || '', scoreOf(r), r.stage.label + (r.overdue ? ' (overdue)' : ''), r.e && r.e.declared_at ? 'Signed' : 'Not signed', r.fit ? `Yes (${day(r.fit.tested_on)})` : 'None entered']), { size: 7.2 });
}
function figures(s) {
  return [
    ['Operatives on the training register', s.register],
    ['Expected workforce', s.expected ? `Approximately ${s.expected}` : null],
    ['Course commenced', s.started],
    ['Training complete (modules, assessment passed, declaration signed)', s.complete],
    ['Assessment passed, declaration not yet signed', s.passed_not_signed],
    ['Modules in progress', s.in_progress],
    ['Modules complete, assessment or reassessment outstanding', s.assessment + s.review],
    ['Failed, supervisor instruction required before reassessment', s.locked],
    ['On the register, not started', s.not_started],
  ];
}
async function summary() {
  const d = await allData();
  const doc = newDoc('Training summary', 'landscape');
  banner(doc, `${client.company}: company training summary`, course.title, `Revision ${course.revision}. Records as at ${dt(new Date())}.`);
  if (!d.rows.length) para(doc, 'No operative is on the training register yet.');
  else { kv(doc, figures(d.stats), 330); summaryTable(doc, d.rows); }
  note(doc, 'The "Training status" column records training and assessment only. "Face-fit record held" shows whether a face-fit test record has been entered in this system. Passing the course is not a face-fit test and is not evidence of compliance on site.');
  return finish(doc, `${client.company}. Company training summary.`);
}

// ---------- face-fit matrix ----------
async function fitMatrix() {
  const d = await allData();
  const doc = newDoc('Face-fit test matrix', 'landscape');
  banner(doc, `${client.company}: face-fit test matrix`, 'Face-fit testing and RPE issued', `Records as at ${dt(new Date())}. ${d.rows.filter(r => r.fit).length} of ${d.rows.length} on the register have a record.`);
  if (!d.rows.length) para(doc, 'Nobody is on the register yet.');
  else table(doc, [{ label: 'ID', w: 6 }, { label: 'Name', w: 15, bold: true }, { label: 'Employer', w: 12 }, { label: 'Site', w: 12 }, { label: 'Status', w: 12, color: t => (t === 'Fit tested' || t === 'Powered air issued' ? OK : BAD) },
    { label: 'RPE type', w: 14 }, { label: 'Make, model and size', w: 16 }, { label: 'Date', w: 8 }, { label: 'Method', w: 8 }, { label: 'Fit tester', w: 11 }, { label: 'Cert. ref', w: 8 }],
    d.rows.map(r => { const f = r.fit || {}; return [r.person.ref, r.person.full_name, r.person.employer, r.person.site, fitStatus(r), f.rpe_type, [f.make_model, f.size].filter(Boolean).join(', '), day(f.tested_on), f.method, f.tester, f.certificate_ref]; }), { size: 7.5 });
  note(doc, 'A face-fit test covers only the make, model and size of respirator shown. A different respirator needs its own fit test. Loose-fitting powered-air respirators do not need a fit test. Entries are made from the fit test certificate, which is held by the company.');
  return finish(doc, `${client.company}. Face-fit test matrix.`, 'Prepared from the Bibby Brickwork training system, from entries made by the company and its supervisors.');
}

// ---------- HSE evidence pack ----------
const REPORT_TITLE = `${client.company}: Construction Dust and RPE Corrective Action Training Report`;

async function evidencePack() {
  const d = await allData(); const s = d.stats, st = d.state, bg = course.background;
  const doc = newDoc(REPORT_TITLE);
  // Cover
  doc.rect(0, 0, doc.page.width, 150).fill(BRAND);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text('CORRECTIVE ACTION TRAINING REPORT', M, 60, { characterSpacing: 1 });
  doc.font('Helvetica-Bold').fontSize(22).fillColor(INK).text(client.company, M, 190, { width: doc.W() });
  doc.font('Helvetica-Bold').fontSize(16).text('Construction Dust and RPE Corrective Action Training Report', M, doc.y + 6, { width: doc.W() });
  doc.moveDown(1.5);
  kv(doc, [
    ['HSE reference', `Notification of Contravention ${bg.notice_ref}, issued ${longDay(bg.notice_date)}`],
    ['Inspection', `${bg.inspection_site}, ${longDay(bg.inspection_date)}`],
    ['Course', `${course.title} (${course.code}), Revision ${course.revision}`],
    ['Records as at', dt(new Date())],
    ['Prepared by', 'Safety Simplified Ltd, from the Bibby Brickwork training system'],
  ]);
  note(doc, 'All participation, completion and assessment figures in this report are taken directly from the training system at the date and time shown above. The report records training delivered and understanding assessed. It does not record face-fit test results or site compliance, which are evidenced separately.');

  doc.addPage();
  h1(doc, '1. Background and reason for training');
  para(doc, `On ${longDay(bg.inspection_date)} the Health and Safety Executive inspected work being carried out by ${client.company} at ${bg.inspection_site}. Following the inspection the HSE issued a Notification of Contravention dated ${longDay(bg.notice_date)}, reference ${bg.notice_ref}, concerning the control of exposure to construction dust and the use of respiratory protective equipment.`);
  para(doc, `As part of its corrective action ${client.company} has introduced a structured training course on construction dust and respiratory protection for its bricklayers, labourers and supervisors on all projects. The course is delivered individually to each operative, tests their understanding, and records their acknowledgement of the company's requirements.`);
  para(doc, 'This report describes the course, how it is delivered and assessed, and the records held for each operative.');

  h1(doc, '2. Course objectives and syllabus');
  para(doc, 'On completing the course every operative is expected to understand:');
  bullets(doc, course.objectives);
  h2(doc, 'Syllabus');
  table(doc, [{ label: 'Module', w: 10 }, { label: 'Title', w: 90 }], course.modules.map(m => [m.n, m.title]));
  h2(doc, 'Guidance the course is based on');
  bullets(doc, course.references);

  h1(doc, '3. Course revision and approval');
  kv(doc, [
    ['Course title', course.title], ['Course code', course.code], ['Revision', `Revision ${course.revision}, dated ${day(course.revision_date)}`], ['Written by', course.author],
    ['Reviewed and approved by', `${st.approved_by}${st.approved_role ? ', ' + st.approved_role : ''}`], ['Approved', dt(st.approved_at)], ['Issued to the workforce', dt(st.issued_at)],
    ['Completion date set by the company', st.due_date ? day(st.due_date) : 'No completion date has been set in the system'],
  ]);
  para(doc, 'The course content, question bank and answer key are fixed for each revision. Any change is issued as a new revision, and each training record shows the revision completed.');

  h1(doc, '4. Training delivery methodology');
  bullets(doc, [
    'The course is issued as a link sent to operatives through the company\'s WhatsApp groups and completed on the operative\'s own mobile phone.',
    'Each operative enters their name, mobile number, employer, site and role before starting. The training register is built from these entries and each operative is given a unique identifier. Supervisors can confirm an operative\'s identity in the system, and the confirmation is recorded.',
    `The course is ${course.modules.length} sequential modules in plain English, with illustrations and site examples. Modules must be taken in order. The date and time each module is opened and completed is recorded.`,
    `Understanding is assessed by an examination of ${course.questions_per_attempt} questions drawn from a bank of ${course.bank.length}, mixing multiple-choice questions and site scenarios. ${course.bank.filter(b => b.critical).length} safety-critical questions are included in every paper.`,
    `The pass mark is ${course.pass_mark}%. In addition, every safety-critical question must be answered correctly. Answers are marked by the system, and the answer key is never sent to the operative's phone.`,
    'The questions presented, the order they were presented in and the answers given are recorded for every attempt.',
    'An operative who fails is shown why each incorrect answer was wrong, without being given the correct answer, and must go back over the relevant modules before a reassessment is released. The reassessment is a newly drawn paper with the questions and answers in a different order, so the assessment cannot be passed by repeated guessing.',
    `After ${course.attempts_before_lock} failed attempts the assessment is locked. It is only released again when a supervisor has given the operative additional instruction in person and recorded it in the system.`,
    'After passing, each operative signs an individual declaration. The declaration text, the name entered, the signature and the date and time are recorded.',
    'Training completion is recorded separately from practical competence. Passing the course is not treated as evidence of a face-fit test or of compliance on site.',
  ]);

  h1(doc, '5. Operative participation and completion figures');
  if (!s.register) para(doc, 'No operative had opened the course or been added to the training register at the date and time of this report.');
  else {
    kv(doc, figures(s), 330);
    if (st.due_date) para(doc, `${s.overdue} operative${s.overdue === 1 ? ' was' : 's were'} past the completion date of ${day(st.due_date)} without having completed the course.`);
  }

  h1(doc, '6. Examination results');
  if (!s.attempts) para(doc, 'No assessment had been submitted at the date and time of this report.');
  else {
    kv(doc, [
      ['Assessment attempts submitted', s.attempts], ['Operatives who have passed', s.passed], ['Passed at the first attempt', s.first_time], ['Passed after reassessment', s.after_reassessment],
      ['Failed attempts recorded', s.failed_attempts], ['Average score of passing papers', s.avg_pass_pct != null ? `${s.avg_pass_pct}%` : null],
    ], 230);
    if (s.missed.length) {
      h2(doc, 'Questions most often answered incorrectly');
      table(doc, [{ label: 'Question', w: 86 }, { label: 'Times incorrect', w: 14, align: 'center' }], s.missed.map(m => [m.q, m.count]));
    }
  }

  h1(doc, '7. Outstanding actions');
  const out = d.rows.filter(r => r.stage.key !== 'complete');
  if (!s.register) para(doc, 'The training register has no entries yet, so there are no individual actions to report.');
  else if (!out.length) para(doc, 'None. Every operative on the training register has completed the course, passed the assessment and signed the declaration.');
  else table(doc, [{ label: 'ID', w: 9 }, { label: 'Name', w: 24, bold: true }, { label: 'Site', w: 22 }, { label: 'Status', w: 45, color: t => (/Failed|overdue/i.test(t) ? BAD : INK) }],
    out.map(r => [r.person.ref, r.person.full_name, r.person.site, r.stage.label + (r.overdue ? ' (overdue)' : '')]));
  if (s.expected && s.register < s.expected) para(doc, `The company's workforce is approximately ${s.expected}. ${s.register} ${s.register === 1 ? 'is' : 'are'} on the training register. The remainder had not yet opened the course link at the date and time of this report.`);

  h1(doc, '8. Company monitoring and enforcement arrangements');
  para(doc, `${client.company} has set out the following arrangements. They are communicated to every operative in the final module of the course and acknowledged in the individual declaration.`);
  h2(doc, 'Mandatory site rules');
  const m12 = course.modules.find(m => m.blocks.some(b => b.t === 'rules'));
  bullets(doc, m12.blocks.find(b => b.t === 'rules').items);
  h2(doc, 'Increased monitoring and zero tolerance');
  const stmt = m12.blocks.find(b => b.t === 'statement');
  stmt.paras.forEach(p => para(doc, p)); bullets(doc, stmt.items); stmt.after.forEach(p => para(doc, p));
  h2(doc, 'Training and practical competence');
  para(doc, `Completion of this course is recorded separately from face-fit testing and from supervisor monitoring on site. At the date and time of this report a face-fit test record had been entered in the training system for ${s.fit_held} of the ${s.register} operatives on the register. Face-fit test certificates and supervisor monitoring records are held by the company and are available separately.`);

  h1(doc, '9. Individual training records');
  if (!d.rows.length) para(doc, 'There are no individual training records yet.');
  else {
    para(doc, 'The table below summarises every operative on the training register. Each operative\'s full training record follows in Appendix B.');
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: M, bottom: 54, left: M, right: M } });
    h2(doc, 'Summary of training records');
    summaryTable(doc, d.rows);
  }

  // Appendix A: question bank
  doc.addPage({ size: 'A4', layout: 'portrait', margins: { top: M, bottom: 54, left: M, right: M } });
  h1(doc, 'Appendix A. Question bank and answer key');
  para(doc, `${course.bank.length} questions. Questions marked (C) are safety-critical: they appear in every paper and must be answered correctly to pass.`);
  for (const b of course.bank) {
    doc.font('Helvetica-Bold').fontSize(9);
    room(doc, doc.heightOfString(b.q, { width: doc.W() }) + 70);
    doc.fillColor(INK).text(`${b.id}${b.critical ? ' (C)' : ''}. ${b.q}`, M, doc.y, { width: doc.W() });
    doc.moveDown(0.2);
    b.options.forEach((o, i) => doc.font(i === b.a ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.8).fillColor(i === b.a ? OK : INK).text(`${'ABCD'[i]}. ${o}${i === b.a ? '  (correct)' : ''}`, M + 12, doc.y, { width: doc.W() - 12 }));
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(FAINT).text(`Explanation: ${b.why} (Module ${b.module}.)`, M + 12, doc.y + 2, { width: doc.W() - 12 });
    doc.moveDown(0.7); doc.x = M;
  }

  // Appendix B: every individual record
  if (d.rows.length) {
    doc.addPage();
    h1(doc, 'Appendix B. Individual training records');
    para(doc, `${d.rows.length} record${d.rows.length === 1 ? '' : 's'}, in alphabetical order.`);
    for (const r of d.rows) { doc.addPage(); renderPerson(doc, { ...r, state: d.state }); }
  }
  return finish(doc, `${client.company}. Construction Dust and RPE Corrective Action Training Report.`);
}

module.exports = { allData, personData, personRecord, summary, evidencePack, fitMatrix, fitStatus, isLoose, courseState, dt, day, FOLLOW };
