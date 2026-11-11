// Office side: dashboard, register, individual records, the course itself, users.
(() => {
  const root = document.getElementById('root');
  const dlg = document.getElementById('dlg');
  const { esc, moduleHtml } = window.CourseKit;
  let me = null, brand = { name: '', portal: 'Training portal', short: '' }, data = null;

  const tz = { timeZone: 'Europe/London' };
  const fDate = d => { if (!d) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d.split('-').reverse().join('/'); return new Date(d).toLocaleDateString('en-GB', { ...tz, day: '2-digit', month: '2-digit', year: 'numeric' }); };
  const fDT = d => (d ? `${fDate(d)} ${new Date(d).toLocaleTimeString('en-GB', { ...tz, hour: '2-digit', minute: '2-digit' })}` : '');
  const canEdit = () => me && me.role !== 'viewer';
  const isAdmin = () => me && (me.role === 'admin' || me.role === 'owner');
  const isOwner = () => me && me.role === 'owner';
  const today = () => new Date().toISOString().slice(0, 10);

  async function api(path, opts = {}) {
    const init = { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: {} };
    if (opts.body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    const res = await fetch(path.startsWith('/api') ? path : '/api/admin' + path, init);
    let d = {};
    try { d = await res.json(); } catch { /* not json */ }
    if (res.status === 401 && !path.startsWith('/api/auth')) { me = null; showLogin(); throw new Error('Log in to continue.'); }
    if (!res.ok) throw new Error(d.error || 'Something went wrong. Try again.');
    return d;
  }
  const main = () => document.getElementById('main');
  const setMain = html => { main().innerHTML = html; };
  function flash(msg, kind = 'ok') { const n = document.createElement('div'); n.className = `note ${kind} no-print`; n.textContent = msg; main().prepend(n); setTimeout(() => n.remove(), kind === 'err' ? 7000 : 3500); }
  function dlgErr(msg) { let n = dlg.querySelector('.dlg-body .note.err'); if (!n) { n = document.createElement('div'); n.className = 'note err'; dlg.querySelector('.dlg-body').prepend(n); } n.textContent = msg; n.scrollIntoView({ block: 'nearest' }); }
  function openDlg(title, body, foot = '') {
    dlg.innerHTML = `<div class="dlg-head"><h2>${esc(title)}</h2><button class="btn quiet" data-close>Close</button></div><div class="dlg-body">${body}</div>${foot ? `<div class="dlg-foot">${foot}</div>` : ''}`;
    dlg.querySelectorAll('[data-close]').forEach(b => (b.onclick = () => dlg.close()));
    if (!dlg.open) dlg.showModal();
  }
  const dv = id => { const el = dlg.querySelector('#' + id); return el ? el.value : null; };
  const field = (label, html, hint) => `<div class="field"><label>${label}${hint ? ` <span class="hint">${hint}</span>` : ''}</label>${html}</div>`;
  const input = (id, value, type = 'text', extra = '') => `<input id="${id}" type="${type}" value="${esc(value ?? '')}" ${extra}>`;
  const pill = r => `<span class="pill ${r.stage.key}">${esc(r.stage.label)}</span>${r.overdue ? ' <span class="pill overdue">Overdue</span>' : ''}`;
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]');
    if (b) (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.copy) : Promise.reject()).then(() => { const t = b.textContent; b.textContent = 'Copied'; setTimeout(() => (b.textContent = t), 1500); }).catch(() => prompt('Copy this link', b.dataset.copy));
  });

  // ---------- login ----------
  async function boot() {
    try { brand = await (await fetch('/api/brand')).json(); } catch { /* defaults */ }
    document.title = brand.portal;
    const s = await api('/api/auth/state');
    if (s.user) { me = s.user; return shell(); }
    showLogin();
  }
  const mark = () => (brand.logo ? `<img src="/logo" alt="${esc(brand.name)}">` : `<div class="wordmark" style="margin-bottom:1.2rem">${esc(brand.short)}<small>Training</small></div>`);
  function showLogin() {
    root.innerHTML = `<div class="login-wrap"><div class="login-card">${mark()}<h1>Log in</h1><div class="sub">${esc(brand.portal)}</div><div id="msg"></div>
      ${field('Email', input('e', '', 'email', 'autocomplete="username"'))}${field('Password', input('p', '', 'password', 'autocomplete="current-password"'))}<button class="btn big" id="go">Log in</button></div></div>`;
    const go = async () => {
      try { const r = await api('/api/auth/login', { body: { email: document.getElementById('e').value, password: document.getElementById('p').value } }); me = r.user; shell(); }
      catch (e) { document.getElementById('msg').innerHTML = `<div class="note err">${esc(e.message)}</div>`; }
    };
    document.getElementById('go').onclick = go;
    document.getElementById('p').onkeydown = e => { if (e.key === 'Enter') go(); };
  }

  // ---------- shell ----------
  const ICONS = {
    '': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    register: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    course: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    evidence: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/>',
    users: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 16 0v1"/>',
  };
  const NAV = [['', 'Dashboard'], ['register', 'Training register'], ['course', 'Course and approval'], ['evidence', 'HSE evidence pack'], ['users', 'Users', 'admin']];
  function shell() {
    root.innerHTML = `<div class="ad-shell"><aside class="ad-nav" id="nav"><div class="rail-brand">${brand.logo ? '<div class="logo"><img src="/logo" alt=""></div>' : `<div class="wordmark">${esc(brand.short)}<small>Training</small></div>`}<div class="t">${esc(brand.portal)}</div><div class="s">Dust and RPE training</div></div>
      <nav><div class="nav-label">Training</div>${NAV.filter(n => !n[2] || isAdmin()).map(n => `<a href="#/${n[0]}" data-nav="${n[0]}"><svg class="ic" viewBox="0 0 24 24">${ICONS[n[0]]}</svg>${n[1]}</a>`).join('')}</nav>
      <div class="rail-foot"><span class="live"><span class="dot"></span>Supported by Safety Simplified</span></div></aside>
      <div class="scrim" id="scrim"></div><div class="ad-body"><div class="topbar"><div style="display:flex;align-items:center;gap:10px"><button class="burger" id="burger" aria-label="Menu"><svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button><div><h1 id="ttl"></h1></div></div>
      <div class="userchip"><span><b>${esc(me.name)}</b></span><button id="out">Log out</button></div></div><main class="ad-main" id="main"></main></div></div>`;
    const nav = document.getElementById('nav'), scrim = document.getElementById('scrim');
    const close = () => { nav.classList.remove('open'); scrim.classList.remove('show'); };
    document.getElementById('burger').onclick = () => { nav.classList.add('open'); scrim.classList.add('show'); };
    scrim.onclick = close; nav.addEventListener('click', e => { if (e.target.closest('a')) close(); });
    document.getElementById('out').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); me = null; showLogin(); };
    window.onhashchange = route; route();
  }
  async function route() {
    const [view, id] = location.hash.replace(/^#\/?/, '').split('/');
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === (view === 'person' ? 'register' : view || '')));
    document.getElementById('ttl').textContent = (NAV.find(n => n[0] === (view === 'person' ? 'register' : view || '')) || NAV[0])[1];
    setMain('<p class="muted">Loading</p>');
    try {
      if (view === 'register') await register(); else if (view === 'person') await person(id); else if (view === 'course') await coursePage();
      else if (view === 'evidence') await evidence(); else if (view === 'users' && isAdmin()) await users(); else await dashboard();
    } catch (e) { setMain(`<div class="note err">${esc(e.message)}</div>`); }
    window.scrollTo(0, 0);
  }
  const SPLIT = 'Training status shows course completion only. Passing the course is not a face-fit test and is not evidence of compliance on site. Face-fit records are shown separately.';
  const notIssued = s => (s.status === 'issued' ? '' : `<div class="note warn">${s.status === 'withdrawn' ? 'The course has been withdrawn. The link is not active.' : 'The course has not been approved and issued yet, so the link is not active.'} ${isOwner() ? '<a href="#/course">Review and approve it</a>.' : 'Safety Simplified reviews and approves it before it goes out.'}</div>`);

  // ---------- dashboard ----------
  async function dashboard() {
    data = await api('/overview');
    const s = data.stats, st = data.state, c = data.course;
    const attention = data.rows.filter(r => ['locked', 'review'].includes(r.stage.key) || r.overdue);
    const wa = `${brand.name}: ${c.title}. Every operative and supervisor must complete this course. It takes about 40 minutes on your phone.\n${data.link}`;
    setMain(`${notIssued(st)}<div class="ad-head"><div><h1>${esc(c.title)}</h1><p class="muted">${esc(c.code)} · Revision ${c.revision} · ${c.modules} modules · ${c.questions} questions, pass mark ${c.pass_mark}%${st.due_date ? ' · to be completed by ' + fDate(st.due_date) : ''}</p></div></div>
      <div class="stats five">
        <a class="stat" href="#/register"><div class="n">${s.register}</div><div class="l">On the register${s.expected ? ` (of about ${s.expected})` : ''}</div></a>
        <a class="stat accent" href="#/register"><div class="n">${s.complete}</div><div class="l">Training complete</div></a>
        <a class="stat" href="#/register"><div class="n">${s.in_progress + s.assessment + s.passed_not_signed}</div><div class="l">In progress</div></a>
        <a class="stat ${s.locked + s.review ? 'bad' : ''}" href="#/register"><div class="n">${s.locked + s.review}</div><div class="l">Failed, follow-up needed</div></a>
        <a class="stat" href="#/register"><div class="n">${s.not_started}</div><div class="l">Not started</div></a>
      </div>
      ${st.status === 'issued' ? `<div class="panel"><h2>Course link</h2><p class="muted small">One link for everyone. Send it to the WhatsApp groups. Each person enters their own details and the register builds itself.</p>
        <div class="linkbox"><input readonly value="${esc(data.link)}" onclick="this.select()"><button class="btn small" data-copy="${esc(data.link)}">Copy link</button>
        <a class="btn small ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(wa)}">Send on WhatsApp</a><a class="btn small quiet" href="/api/admin/qr.svg" download="course-qr.svg">Download QR</a></div></div>` : ''}
      <h2>Needs attention</h2>${attention.length ? `<div class="flags">${attention.map(r => `<a class="flag red" href="#/person/${r.id}" style="text-decoration:none;color:inherit"><span><b>${esc(r.name)}</b> · ${esc(r.stage.label)}${r.overdue ? ' · overdue' : ''}</span><span class="muted small">${esc(r.site || '')}</span></a>`).join('')}</div>` : '<div class="flags"><div class="flag green">Nobody is waiting on supervisor follow-up.</div></div>'}
      <h2>Assessment results</h2><div class="tablewrap"><table><tbody>
        <tr><td>Assessment attempts submitted</td><td><b>${s.attempts}</b></td></tr><tr><td>Passed at the first attempt</td><td><b>${s.first_time}</b></td></tr><tr><td>Passed after reassessment</td><td><b>${s.after_reassessment}</b></td></tr>
        <tr><td>Failed attempts recorded</td><td><b>${s.failed_attempts}</b></td></tr><tr><td>Average score of passing papers</td><td><b>${s.avg_pass_pct == null ? 'No passes yet' : s.avg_pass_pct + '%'}</b></td></tr></tbody></table></div>
      ${s.missed.length ? `<h2>Questions most often answered incorrectly</h2><div class="tablewrap"><table><tbody>${s.missed.map(m => `<tr><td>${esc(m.q)}</td><td style="white-space:nowrap"><b>${m.count}</b> time${m.count > 1 ? 's' : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <h2>Practical records (separate from training)</h2><div class="panel"><p><b>${s.fit_held} of ${s.register}</b> on the register have a face-fit test record entered here.</p><p class="split-note">${SPLIT}</p></div>`);
  }

  // ---------- register ----------
  async function register() {
    data = await api('/overview');
    const sites = [...new Set(data.rows.map(r => r.site).filter(Boolean))].sort();
    setMain(`${notIssued(data.state)}<div class="ad-head"><div><h1>Training register</h1><p class="muted">Everyone who has opened the course link, plus anyone added by the office.</p></div><div>
      ${canEdit() ? '<button class="btn ghost" id="add">Add names</button>' : ''}<a class="btn ghost" href="/api/admin/register.csv">Download CSV</a><a class="btn" href="/api/admin/summary.pdf" target="_blank" rel="noopener">Summary PDF</a></div></div>
      <div class="toolbar"><div class="field"><label>Search</label><input id="fq" type="search" placeholder="Name or ID"></div>
      <div class="field"><label>Status</label><select id="fs"><option value="">All</option><option value="complete">Complete</option><option value="open">Not yet complete</option><option value="failed">Failed, follow-up needed</option><option value="not_started">Not started</option><option value="nofit">No face-fit record entered</option></select></div>
      <div class="field"><label>Site</label><select id="fsite"><option value="">All sites</option>${sites.map(s => `<option>${esc(s)}</option>`).join('')}</select></div></div>
      <p class="split-note" style="margin-bottom:1rem">${SPLIT}</p><div id="tbl"></div>`);
    const draw = () => {
      const qv = document.getElementById('fq').value.toLowerCase(), fs = document.getElementById('fs').value, site = document.getElementById('fsite').value;
      const rows = data.rows.filter(r => (!qv || (r.name + ' ' + r.ref).toLowerCase().includes(qv)) && (!site || r.site === site) &&
        (!fs || (fs === 'complete' ? r.stage.key === 'complete' : fs === 'open' ? r.stage.key !== 'complete' : fs === 'failed' ? ['locked', 'review'].includes(r.stage.key) : fs === 'nofit' ? !r.fit : r.stage.key === fs)));
      document.getElementById('tbl').innerHTML = rows.length ? `<div class="tablewrap"><table><thead><tr><th>ID</th><th>Name</th><th>Employer and site</th><th>Commenced</th><th>Modules</th><th>Attempts</th><th>Score</th><th>Training status</th><th>Completed</th><th>Face-fit record</th></tr></thead><tbody>
        ${rows.map(r => `<tr class="click" data-id="${r.id}"><td class="muted small">${esc(r.ref)}</td><td><b>${esc(r.name)}</b><div class="muted small">${esc(r.role || '')}${r.identity_confirmed_by ? ' · identity confirmed' : ''}</div></td><td>${esc(r.employer || '')}<div class="muted small">${esc(r.site || '')}</div></td>
          <td class="small">${fDT(r.started_at)}</td><td>${r.modules_done}/${data.course.modules}</td><td>${r.attempts || ''}</td><td>${r.score == null ? '' : `${r.score}/${r.total}`}</td><td>${pill(r)}</td><td class="small">${fDT(r.completed_at)}</td>
          <td class="small">${r.fit ? `${esc(r.fit.make_model)}<div class="muted">${fDate(r.fit.tested_on)}</div>` : '<span class="muted">None entered</span>'}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="tablewrap"><div class="empty"><b>${data.rows.length ? 'Nobody matches that filter' : 'Nobody on the register yet'}</b>${data.rows.length ? '' : 'People appear here as soon as they open the course link.'}</div></div>`;
      document.querySelectorAll('#tbl tr.click').forEach(tr => (tr.onclick = () => { location.hash = '#/person/' + tr.dataset.id; }));
    };
    ['fq', 'fs', 'fsite'].forEach(id => (document.getElementById(id).oninput = draw)); draw();
    const add = document.getElementById('add');
    if (add) add.onclick = () => {
      openDlg('Add names to the register', `<p class="muted">Add the people you expect to do the course, so anyone who has not opened the link shows as not started. When they open the link and enter the same name, their record joins up.</p>
        ${field('Names', '<textarea id="names" rows="8" placeholder="One person per line: first name and surname"></textarea>')}<div class="row">${field('Employer', input('emp', brand.name))}${field('Site', input('site', ''))}</div>`, '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="save">Add</button>');
      dlg.querySelector('#save').onclick = async () => { try { const r = await api('/people', { body: { names: dv('names'), employer: dv('emp'), site: dv('site') } }); dlg.close(); await register(); flash(`${r.added} added${r.skipped ? `, ${r.skipped} already on the register` : ''}.`); } catch (e) { dlgErr(e.message); } };
    };
  }

  // ---------- one person ----------
  async function person(id) {
    const p = await api('/people/' + id);
    const st = (data && data.state) || (await api('/overview')).state;
    const row = (k, v) => `<div><dt>${k}</dt><dd>${v || '<span class="muted">Not recorded</span>'}</dd></div>`;
    setMain(`<p><a href="#/register">&larr; Training register</a></p><div class="ad-head"><div><h1>${esc(p.name)}</h1><p class="muted">${esc(p.ref)} · ${pill(p)}</p></div><div>
      ${canEdit() ? '<button class="btn ghost" id="edit">Edit details</button>' : ''}<a class="btn" href="/api/admin/people/${p.id}/record.pdf" target="_blank" rel="noopener">Training record PDF</a></div></div>
      <div class="row" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:0 1.25rem"><div><h2 class="sec">Operative</h2><dl class="info-list">${row('Mobile', esc(p.phone))}${row('Employer', esc(p.employer))}${row('Site', esc(p.site))}${row('Role', esc(p.role))}
        ${row('Identity', p.identity_confirmed_by ? `Confirmed by ${esc(p.identity_confirmed_by)}, ${fDT(p.identity_confirmed_at)}` : (p.source === 'office' ? 'Added by the office' : 'Name and mobile given by the operative') + (canEdit() ? ' <button class="btn small ghost" id="conf">Confirm identity</button>' : ''))}</dl></div>
      <div><h2 class="sec">Training record</h2><dl class="info-list">${row('Issued', fDT(p.issued_at))}${row('Commenced', fDT(p.started_at))}${row('Modules completed', `${p.modules_done} of ${p.modules.length}`)}
        ${row('Assessment', p.passed_on ? `Passed on attempt ${p.passed_on}, ${p.score}/${p.total}` : p.attempts ? `Not passed, ${p.attempts} attempt${p.attempts > 1 ? 's' : ''}` : 'Not taken')}
        ${row('Declaration', p.declaration ? `Signed ${fDT(p.declaration.at)} as ${esc(p.declaration.name)}<img src="/api/admin/people/${p.id}/signature" alt="Signature" style="height:44px;display:block;margin-top:6px">` : 'Not signed')}${row('Completed', fDT(p.completed_at))}</dl></div></div>
      ${p.locked ? `<div class="note err">Assessment locked after ${p.attempts} failed attempts. Go through the course with ${esc(p.name.split(' ')[0])} in person, then record the instruction below. That releases one further attempt.</div>` : ''}
      <h2>Supervisory follow-up</h2>${p.followup_list.length ? `<div class="tablewrap"><table><thead><tr><th>Date</th><th>Type</th><th>By</th><th>Notes</th><th>Recorded by</th></tr></thead><tbody>${p.followup_list.map(f => `<tr><td>${fDate(f.happened_on)}</td><td>${{ instruction: 'Additional instruction', chase: 'Reminder to complete', note: 'Note' }[f.kind]}${f.unlocked ? '<div class="muted small">Reassessment released</div>' : ''}</td><td>${esc(f.by_name)}<div class="muted small">${esc(f.by_role || '')}</div></td><td>${esc(f.notes || '')}</td><td class="small muted">${esc(f.recorded_by || '')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nothing recorded.</p>'}
      ${canEdit() ? '<p><button class="btn ghost" id="fu">Record follow-up</button></p>' : ''}
      <h2>Modules</h2><div class="tablewrap"><table><thead><tr><th>No.</th><th>Module</th><th>Opened</th><th>Completed</th></tr></thead><tbody>${p.modules.map(m => `<tr><td>${m.n}</td><td>${esc(m.title)}</td><td class="small">${fDT(m.o)}</td><td class="small">${m.c ? fDT(m.c) : '<span class="muted">Not completed</span>'}</td></tr>`).join('')}</tbody></table></div>
      <h2>Assessment and reassessment history</h2>${p.attempt_list.length ? p.attempt_list.map(a => `<div class="panel"><h2>Attempt ${a.number}: ${!a.submitted_at ? 'in progress' : `${a.score}/${a.total} (${Math.round(a.score / a.total * 100)}%) · ${a.passed ? '<span style="color:var(--leaf)">PASS</span>' : '<span style="color:var(--brick)">FAIL</span>'}`}</h2>
        <p class="muted small">Started ${fDT(a.started_at)}${a.submitted_at ? ` · submitted ${fDT(a.submitted_at)} · safety-critical questions: ${a.critical_wrong.length ? a.critical_wrong.length + ' incorrect' : 'all correct'}` : ''}</p>
        ${a.review_modules.length ? `<p class="small"><b>Additional instruction:</b> ${a.review_modules.map(m => `module ${m.n} ${a.review[m.n] ? 're-read ' + fDT(a.review[m.n]) : 'not yet re-read'}`).join('; ')}${a.review.supervisor ? `; supervisor instruction recorded ${fDT(a.review.supervisor)}` : ''}</p>` : ''}
        ${a.questions.length ? `<details><summary class="small"><b>Questions presented and answers given</b></summary>${a.questions.map(x => `<div class="qa ${x.correct ? 'good' : 'bad'}"><div class="q">${x.n}. ${x.critical ? '(Safety-critical) ' : ''}${esc(x.q)}</div><div class="a">Answered: ${esc(x.given || 'No answer')} · <b>${x.correct ? 'Correct' : 'Incorrect'}</b></div>${x.correct ? '' : `<div class="a">Correct answer: ${esc(x.right)}</div>`}</div>`).join('')}</details>` : ''}</div>`).join('') : '<p class="muted">No assessment started.</p>'}
      <h2>Face-fit test records (separate from training)</h2><p class="split-note" style="margin-bottom:1rem">Entered from the fit test certificate. A fit test covers only the make, model and size tested. Nothing here is created by passing the course.</p>
      ${p.fit_list.length ? `<div class="tablewrap"><table><thead><tr><th>Tested</th><th>RPE type</th><th>Make, model, size</th><th>Method</th><th>Fit tester</th><th>Certificate</th><th></th></tr></thead><tbody>${p.fit_list.map(f => `<tr><td>${fDate(f.tested_on)}</td><td>${esc(f.rpe_type || '')}</td><td>${esc([f.make_model, f.size].filter(Boolean).join(', '))}</td><td>${esc(f.method || '')}</td><td>${esc(f.tester || '')}</td><td>${esc(f.certificate_ref || '')}</td><td>${canEdit() ? `<button class="btn quiet small" data-delfit="${f.id}">Remove</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">None entered.</p>'}
      ${canEdit() ? '<p><button class="btn ghost" id="fit">Add face-fit record</button></p>' : ''}
      ${isOwner() ? '<p style="margin-top:2rem"><button class="btn quiet small" id="del">Delete this person and their record</button></p>' : ''}`);
    const on = (sel, fn) => { const el = document.getElementById(sel); if (el) el.onclick = fn; };
    on('conf', async () => { await api('/people/' + id, { method: 'PUT', body: { confirm_identity: true } }); person(id); });
    on('edit', () => {
      openDlg('Edit details', `${field('Name', input('n', p.name))}${field('Mobile', input('ph', p.phone, 'tel'))}${field('Employer', input('em', p.employer))}${field('Site', input('si', p.site))}${field('Role', input('ro', p.role))}`, '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="save">Save</button>');
      dlg.querySelector('#save').onclick = async () => { try { await api('/people/' + id, { method: 'PUT', body: { name: dv('n'), phone: dv('ph'), employer: dv('em'), site: dv('si'), role: dv('ro') } }); dlg.close(); person(id); } catch (e) { dlgErr(e.message); } };
    });
    on('fu', () => {
      openDlg('Record follow-up', `${field('Type', `<select id="k"><option value="instruction">Additional instruction given in person</option><option value="chase">Reminder to complete the course</option><option value="note">Note</option></select>`)}
        <div class="row">${field('Carried out by', input('by', me.name))}${field('Position', input('br', ''), 'optional')}</div>${field('Date', input('on', today(), 'date'))}${field('What was covered', '<textarea id="no" rows="4"></textarea>', p.locked ? 'recording additional instruction releases one further attempt' : '')}`, '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="save">Record</button>');
      dlg.querySelector('#save').onclick = async () => { try { const r = await api(`/people/${id}/followups`, { body: { kind: dv('k'), by_name: dv('by'), by_role: dv('br'), happened_on: dv('on'), notes: dv('no') } }); dlg.close(); await person(id); flash(r.unlocked ? 'Recorded. One further assessment attempt has been released.' : 'Recorded.'); } catch (e) { dlgErr(e.message); } };
    });
    on('fit', () => {
      openDlg('Add face-fit record', `<div class="row">${field('Date of fit test', input('on', '', 'date'))}${field('RPE type', '<select id="ty"><option>Half-mask with P3 filters</option><option>FFP3 disposable</option><option>Full-face mask</option></select>')}</div>
        <div class="row">${field('Make and model tested', input('mm', ''))}${field('Size', input('sz', ''))}</div><div class="row">${field('Method', '<select id="me"><option>Qualitative</option><option>Quantitative</option></select>')}${field('Fit tester or provider', input('te', ''))}</div>${field('Certificate reference', input('ce', ''), 'optional')}`, '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="save">Add record</button>');
      dlg.querySelector('#save').onclick = async () => { try { await api(`/people/${id}/fit`, { body: { tested_on: dv('on'), rpe_type: dv('ty'), make_model: dv('mm'), size: dv('sz'), method: dv('me'), tester: dv('te'), certificate_ref: dv('ce') } }); dlg.close(); person(id); } catch (e) { dlgErr(e.message); } };
    });
    document.querySelectorAll('[data-delfit]').forEach(b => (b.onclick = async () => { if (confirm('Remove this face-fit record?')) { await api('/fit/' + b.dataset.delfit, { method: 'DELETE' }); person(id); } }));
    on('del', async () => { if (confirm(`Delete ${p.name} and their whole training record? This cannot be undone.`)) { await api('/people/' + id, { method: 'DELETE' }); location.hash = '#/register'; } });
    void st;
  }

  // ---------- the course ----------
  async function coursePage() {
    const { course: c, state: s } = await api('/course');
    const ov = await api('/overview');
    const approved = s.status === 'issued';
    setMain(`<div class="ad-head"><div><h1>${esc(c.title)}</h1><p class="muted">${esc(c.code)} · Revision ${c.revision}, dated ${fDate(c.revision_date)} · written by ${esc(c.author)}</p></div></div>
      <div class="panel"><h2>Review and approval</h2>${approved ? `<p><span class="pill complete">Approved and issued</span></p><p>Approved by <b>${esc(s.approved_by)}</b>${s.approved_role ? ', ' + esc(s.approved_role) : ''} on ${fDT(s.approved_at)}. Issued ${fDT(s.issued_at)}.</p>${isOwner() ? '<button class="btn quiet small" id="wd">Withdraw the course</button>' : ''}`
        : `<p><span class="pill under_review">${s.status === 'withdrawn' ? 'Withdrawn' : 'Awaiting review'}</span></p><p class="muted">The course link stays inactive until Safety Simplified has read the modules and the question bank below and approved them. The approval is recorded and printed in the HSE evidence pack.</p>
          ${isOwner() ? `<div class="row">${field('Approved by', input('an', ''), 'name of the person who reviewed it')}${field('Position', input('ar', ''), 'for example CMIOSH, Safety Simplified Ltd')}</div><label class="check" style="margin-bottom:1rem"><input type="checkbox" id="ac"><span>I have reviewed all ${c.modules.length} modules, the question bank and the answer key, and approve Revision ${c.revision} for issue.</span></label><button class="btn" id="ap">Approve and issue</button>` : ''}`}</div>
      ${isAdmin() ? `<div class="panel"><h2>Settings</h2><div class="row">${field('Complete by', input('due', s.due_date, 'date'), 'anyone not complete after this shows as overdue')}${field('Expected number of people', input('exp', s.expected || '', 'number'))}</div>
        ${field('Sites people can choose', `<textarea id="sites" rows="3">${esc(ov.sites.join('\n'))}</textarea>`, 'one per line')}<button class="btn ghost" id="ss">Save settings</button></div>` : ''}
      <h2>Modules</h2>${c.modules.map(m => `<details class="panel"><summary><b>Module ${m.n}: ${esc(m.title)}</b> <span class="muted small">about ${m.mins} minutes</span></summary><div class="co-mod" style="box-shadow:none;border:0;padding:12px 0 0;max-width:760px">${moduleHtml(m)}</div></details>`).join('')}
      <h2>Declaration</h2><div class="decl" style="max-width:760px">${esc(c.declaration)}</div>
      <h2>Question bank and answer key</h2><p class="muted">${c.bank.length} questions. Each paper has ${c.questions_per_attempt}: all ${c.bank.filter(b => b.critical).length} safety-critical questions plus ${c.questions_per_attempt - c.bank.filter(b => b.critical).length} drawn from the rest. Pass mark ${c.pass_mark}% with every safety-critical question correct. After ${c.attempts_before_lock} failed attempts the assessment locks until a supervisor records additional instruction.</p>
      ${c.bank.map(b => `<div class="bankq"><b>${b.id}${b.critical ? ' <span class="pill no">Safety-critical</span>' : ''} <span class="muted small">Module ${b.module}${b.kind === 'scenario' ? ' · site scenario' : ''}</span></b><div style="margin-top:.3rem">${esc(b.q)}</div>
        <ol>${b.options.map((o, i) => `<li class="${i === b.a ? 'right' : ''}">${esc(o)}${i === b.a ? ' (correct)' : `<span>Why it is wrong: ${esc(b.wrong[i])}</span>`}</li>`).join('')}</ol><div class="muted small"><b>Explanation:</b> ${esc(b.why)}</div></div>`).join('')}`);
    const on = (sel, fn) => { const el = document.getElementById(sel); if (el) el.onclick = fn; };
    const v = id => document.getElementById(id).value;
    on('ap', async () => { try { await api('/course/approve', { body: { name: v('an'), role: v('ar'), confirmed: document.getElementById('ac').checked } }); await coursePage(); flash('Approved. The course link is now live.'); } catch (e) { flash(e.message, 'err'); } });
    on('wd', async () => { if (confirm('Withdraw the course? The link will stop working until it is approved again.')) { await api('/course/withdraw', { method: 'POST' }); coursePage(); } });
    on('ss', async () => { try { await api('/settings', { method: 'PUT', body: { due_date: v('due'), expected_headcount: v('exp'), sites: v('sites').split('\n') } }); flash('Settings saved.'); } catch (e) { flash(e.message, 'err'); } });
  }

  // ---------- evidence pack ----------
  async function evidence() {
    data = await api('/overview');
    const ok = data.state.status === 'issued', s = data.stats;
    setMain(`${notIssued(data.state)}<div class="ad-head"><div><h1>HSE evidence pack</h1><p class="muted">${esc(brand.name)}: Construction Dust and RPE Corrective Action Training Report</p></div></div>
      <div class="panel"><h2>What is in it</h2><ol style="margin:.4rem 0 1rem;padding-left:1.3rem;line-height:1.7"><li>Background and reason for training</li><li>Course objectives and syllabus</li><li>Course revision and approval details</li><li>Training delivery methodology</li><li>Operative participation and completion figures</li><li>Examination results</li><li>Outstanding actions</li><li>Company monitoring and enforcement arrangements</li><li>Individual training records, with the question bank and answer key as an appendix</li></ol>
        <p class="muted">The report is made fresh each time from the records as they stand: ${s.register} on the register, ${s.complete} complete, ${s.attempts} assessment attempt${s.attempts === 1 ? '' : 's'} submitted. Nothing is included that the records do not show.</p>
        ${ok ? '<a class="btn" href="/api/admin/evidence-pack.pdf" target="_blank" rel="noopener">Download the evidence pack (PDF)</a>' : '<button class="btn" disabled>Available once the course is approved and issued</button>'}</div>
      <div class="panel"><h2>Other exports</h2><p class="muted">The company-wide summary on its own, the register as a spreadsheet, and each person's record from their page on the register.</p><div class="linkbox"><a class="btn ghost" href="/api/admin/summary.pdf" target="_blank" rel="noopener">Company summary (PDF)</a><a class="btn ghost" href="/api/admin/register.csv">Register (CSV)</a><a class="btn ghost" href="#/register">Individual records</a></div></div>
      <p class="split-note">${SPLIT}</p>`);
  }

  // ---------- users ----------
  async function users() {
    const { rows } = await api('/users');
    const ROLE = { owner: 'Safety Simplified', admin: 'Admin', manager: 'Supervisor (can record)', viewer: 'View only' };
    setMain(`<div class="ad-head"><div><h1>Users</h1><p class="muted">Who can log in to this portal.</p></div><div><button class="btn" id="add">Add user</button></div></div>
      <div class="tablewrap"><table><thead><tr><th>Name</th><th>Email</th><th>Access</th><th></th></tr></thead><tbody>${rows.map(u => `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${ROLE[u.role]}${u.active ? '' : ' <span class="pill grey">Disabled</span>'}</td><td>${u.id === me.id ? '' : `<button class="btn quiet small" data-tog="${u.id}" data-on="${u.active}">${u.active ? 'Disable' : 'Enable'}</button>`}</td></tr>`).join('')}</tbody></table></div>`);
    document.getElementById('add').onclick = () => {
      openDlg('Add user', `${field('Name', input('n', ''))}${field('Email', input('e', '', 'email'))}${field('Password', input('p', '', 'text'), 'at least 8 characters')}${field('Access', '<select id="r"><option value="admin">Admin</option><option value="manager" selected>Supervisor (can record follow-up and fit tests)</option><option value="viewer">View only</option></select>')}`, '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="save">Add</button>');
      dlg.querySelector('#save').onclick = async () => { try { await api('/users', { body: { name: dv('n'), email: dv('e'), password: dv('p'), role: dv('r') } }); dlg.close(); users(); } catch (e) { dlgErr(e.message); } };
    };
    document.querySelectorAll('[data-tog]').forEach(b => (b.onclick = async () => { try { await api('/users/' + b.dataset.tog, { method: 'PUT', body: { active: b.dataset.on !== 'true' } }); users(); } catch (e) { flash(e.message, 'err'); } }));
  }

  boot();
})();
