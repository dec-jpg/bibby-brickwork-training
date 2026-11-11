// Course logic: where someone is up to, drawing an assessment, marking it.
const crypto = require('crypto');
const course = require('../client/course');

const byId = Object.fromEntries(course.bank.map(b => [b.id, b]));
const critical = course.bank.filter(b => b.critical);
const others = course.bank.filter(b => !b.critical);
const moduleTitle = n => (course.modules.find(m => m.n === n) || {}).title || '';

function shuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

// A new paper: every critical question, plus others to make up the number. Questions not seen last time come first,
// question order and option order are shuffled, so a reassessment is not the same paper again.
function draw(previous) {
  const need = Math.max(0, course.questions_per_attempt - critical.length);
  const seen = new Set((previous || []).map(p => p.id));
  const fresh = shuffle(others.filter(o => !seen.has(o.id)));
  const rest = shuffle(others.filter(o => seen.has(o.id)));
  const picked = fresh.concat(rest).slice(0, need);
  return shuffle(critical.concat(picked)).map(b => ({ id: b.id, order: shuffle(b.options.map((_, i) => i)) }));
}

// What the operative sees: no answer key.
const paper = presented => presented.map((p, i) => ({ n: i + 1, q: byId[p.id].q, kind: byId[p.id].kind, options: p.order.map(o => byId[p.id].options[o]) }));

// answers[i] is the position chosen on screen for question i.
function mark(presented, answers) {
  const rows = presented.map((p, i) => {
    const b = byId[p.id];
    const pos = Number.isInteger(answers[i]) ? answers[i] : -1;
    const chosen = pos >= 0 && pos < p.order.length ? p.order[pos] : null;
    return { id: p.id, critical: !!b.critical, module: b.module, chosen, correct: chosen === b.a };
  });
  const score = rows.filter(r => r.correct).length;
  const total = rows.length;
  const pct = Math.round((score / total) * 100);
  const critical_wrong = rows.filter(r => r.critical && !r.correct).map(r => r.id);
  return { rows, score, total, pct, critical_wrong, passed: pct >= course.pass_mark && critical_wrong.length === 0 };
}

// Full detail of an attempt for the office and the PDFs.
function detail(att) {
  const answers = att.answers || [];
  return att.presented.map((p, i) => {
    const b = byId[p.id] || { q: '(question no longer in the bank)', options: [], a: -1 };
    const pos = Number.isInteger(answers[i]) ? answers[i] : -1;
    const chosen = pos >= 0 ? p.order[pos] : null;
    return { n: i + 1, id: p.id, critical: !!b.critical, module: b.module, q: b.q, options: p.order.map(o => b.options[o]),
      given: chosen == null ? null : b.options[chosen], right: b.options[b.a], correct: chosen === b.a, why: b.why };
  });
}

// Feedback after a failed attempt: why each wrong answer was wrong and which module to go back to. The correct option is not given.
function feedback(att) {
  const answers = att.answers || [];
  return att.presented.map((p, i) => {
    const b = byId[p.id]; const pos = Number.isInteger(answers[i]) ? answers[i] : -1; const chosen = pos >= 0 ? p.order[pos] : null;
    if (chosen === b.a) return null;
    return { n: i + 1, q: b.q, critical: !!b.critical, given: chosen == null ? 'No answer given' : b.options[chosen], why_wrong: chosen == null ? 'This question was not answered.' : (b.wrong[chosen] || ''), module: b.module, module_title: moduleTitle(b.module) };
  }).filter(Boolean);
}

const modulesDone = e => course.modules.filter(m => e && e.modules && e.modules[m.n] && e.modules[m.n].c).length;

// Where an enrolment is up to. attempts: this enrolment's attempts, oldest first.
function stage(e, attempts) {
  const total = course.modules.length;
  if (!e || !e.started_at) return { key: 'not_started', label: 'Not started' };
  if (e.completed_at) return { key: 'complete', label: 'Complete' };
  if (e.passed_at) return { key: 'passed', label: 'Passed, declaration not signed' };
  const done = modulesDone(e);
  if (done < total) return { key: 'in_progress', label: `In progress (module ${done + 1} of ${total})`, next_module: done + 1 };
  const submitted = attempts.filter(a => a.submitted_at);
  const open = attempts.find(a => !a.submitted_at);
  const failed = submitted.filter(a => !a.passed);
  if (e.locked) return { key: 'locked', label: `Failed ${failed.length} times, supervisor instruction required`, failed: failed.length };
  if (open) return { key: 'assessment', label: 'Assessment in progress', failed: failed.length };
  if (failed.length) {
    const last = failed[failed.length - 1];
    const need = reviewModules(last);
    const left = last.review && last.review.supervisor ? [] : need.filter(n => !(last.review || {})[n]);
    if (left.length) return { key: 'review', label: `Failed attempt ${failed.length}, additional instruction in progress`, failed: failed.length, review_modules: need, review_left: left };
    return { key: 'assessment', label: `Ready for reassessment (attempt ${failed.length + 1})`, failed: failed.length };
  }
  return { key: 'assessment', label: 'Modules complete, assessment not taken', failed: 0 };
}

function reviewModules(att) {
  const m = mark(att.presented, att.answers || []);
  return [...new Set(m.rows.filter(r => !r.correct).map(r => r.module))].sort((a, b) => a - b);
}

const allowedAttempts = e => course.attempts_before_lock + (e.extra_attempts || 0);

module.exports = { course, byId, draw, paper, mark, detail, feedback, stage, modulesDone, reviewModules, allowedAttempts, moduleTitle };
