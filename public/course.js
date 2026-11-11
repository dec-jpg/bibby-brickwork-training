// The course, as operatives see it on their phone from the WhatsApp link (/c/TOKEN).
(() => {
  const app = document.getElementById('app');
  const LINK = location.pathname.split('/').filter(Boolean)[1];
  const KEY = 'bibby_course_' + LINK;
  const { esc, moduleHtml } = window.CourseKit;
  let info = null, me = null, token = null, modules = null;

  const store = { get() { try { return localStorage.getItem(KEY); } catch { return null; } }, set(v) { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } }, clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } } };
  const $ = s => app.querySelector(s);
  const fDT = d => new Date(d).toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  async function api(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['x-enrol-token'] = token;
    const res = await fetch(`/api/c/${LINK}${path}`, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
    let data = {};
    try { data = await res.json(); } catch { /* empty */ }
    if (res.status === 401 && data.identify) { store.clear(); token = null; identify(); throw new Error('Enter your details to carry on.'); }
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Check your signal and try again.');
    return data;
  }
  function render(html) { app.innerHTML = html; window.scrollTo(0, 0); }
  function showErr(msg, before) {
    let n = $('.note.err');
    if (!n) { n = document.createElement('div'); n.className = 'note err'; (before || app.lastElementChild).before(n); }
    n.textContent = msg; n.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function busy(btn, on) { if (!btn) return; if (on) { btn.dataset.l = btn.textContent; btn.textContent = 'Please wait'; btn.disabled = true; } else { btn.textContent = btn.dataset.l || btn.textContent; btn.disabled = false; } }
  const whoBar = () => `<div class="si-who"><div><b>${esc(me.person.name)}</b><span class="muted small">${esc(me.person.ref)} · ${esc(me.person.site || '')}</span></div><button class="btn quiet" id="notme">Not you?</button></div>`;
  app.addEventListener('click', e => { if (e.target.closest('#notme')) { store.clear(); token = null; me = null; identify(); } });

  // ---------- start ----------
  async function boot() {
    try {
      const b = await (await fetch('/api/brand')).json();
      document.getElementById('brand').innerHTML = b.logo ? '<img src="/logo" alt="">' : `<div class="wordmark">${esc(b.short)}<small>Training</small></div>`;
    } catch { /* no brand */ }
    try { info = await api(''); } catch (e) { return render(`<div class="note warn">${esc(e.message)}</div>`); }
    document.title = info.course.title;
    token = store.get();
    if (!token) return identify();
    try { me = await api('/me'); home(); } catch { /* identify() already shown */ }
  }

  function identify() {
    const c = info.course;
    render(`<div class="co-hero"><p class="k">${esc(info.company)} · Revision ${c.revision}</p><h1>${esc(c.title)}</h1><p>${c.modules.length} short modules, then an assessment. About 40 minutes. You can stop and come back.</p></div>
      <h1>Your details</h1><p class="muted">These go on your training record. If you have already started, enter the same name and mobile to carry on.</p>
      <div class="field"><label for="n">First name and surname</label><input id="n" autocomplete="name"></div>
      <div class="field"><label for="p">Mobile number</label><input id="p" type="tel" autocomplete="tel" inputmode="tel"></div>
      <div class="field"><label for="e">Who do you work for?</label><input id="e" value="${esc(info.company)}"><span class="hint">Change this if you work for an agency or another company.</span></div>
      <div class="field"><label for="s">Site you are working on</label><select id="s"><option value="">Choose</option>${info.sites.map(s => `<option>${esc(s)}</option>`).join('')}<option value="__other">Another site</option></select></div>
      <div class="field hidden" id="so"><label for="s2">Site name</label><input id="s2"></div>
      <div class="field"><label for="r">Your role</label><select id="r"><option value="">Choose</option>${info.roles.map(s => `<option>${esc(s)}</option>`).join('')}</select></div>
      <button class="btn big" id="go">Start the course</button>`);
    $('#s').onchange = () => $('#so').classList.toggle('hidden', $('#s').value !== '__other');
    $('#go').onclick = async () => {
      const btn = $('#go'); busy(btn, true);
      try {
        const site = $('#s').value === '__other' ? $('#s2').value : $('#s').value;
        const r = await api('/enrol', { name: $('#n').value, phone: $('#p').value, employer: $('#e').value, site, role: $('#r').value });
        token = r.token; store.set(token); me = r; home();
      } catch (e) { busy(btn, false); showErr(e.message, btn); }
    };
  }

  // ---------- course map ----------
  function home() {
    const c = info.course, st = me.stage, done = me.modules_done, total = c.modules.length;
    if (st.key === 'complete') return complete();
    const pct = Math.round((done / total) * 100);
    const reviewing = st.key === 'review' ? st.review_left : [];
    const mods = c.modules.map(m => {
      const isDone = m.n <= done, isNext = m.n === done + 1, todo = reviewing.includes(m.n);
      const cls = todo ? 'todo' : isDone ? 'done' : isNext ? 'next' : 'locked';
      const sub = todo ? 'Go back over this module' : isDone ? 'Completed' : isNext ? `About ${m.mins} minutes` : 'Locked until the module before is done';
      return `<button class="co-item ${cls}" data-m="${m.n}" ${isDone || isNext ? '' : 'disabled'}><span class="n">${isDone && !todo ? '&#10003;' : m.n}</span><span><b>${esc(m.title)}</b><span class="s">${sub}</span></span></button>`;
    }).join('');
    let action = '';
    if (st.key === 'in_progress') action = `<button class="btn big" data-m="${st.next_module}">${done ? 'Carry on: module ' + st.next_module : 'Start module 1'}</button>`;
    else if (st.key === 'assessment') action = `<div class="note ok">${me.attempts ? 'You can now take the assessment again.' : 'All modules complete. Next is the assessment.'}</div><button class="btn big" id="exam">${me.attempts ? 'Take the reassessment' : 'Start the assessment'}</button>`;
    else if (st.key === 'review') action = `<div class="note err">You did not pass attempt ${me.last.number}. Go back over the ${reviewing.length} module${reviewing.length > 1 ? 's' : ''} marked in red, then the assessment will open again.</div><button class="btn big ghost" id="fb">See what you got wrong</button>`;
    else if (st.key === 'locked') action = `<div class="note err">You have not passed after ${me.attempts} attempts. Speak to your supervisor. They will go through the course with you, and then you can take the assessment again.</div><button class="btn big ghost" id="fb">See what you got wrong</button><p class="link-row"><button class="btn quiet" id="refresh">My supervisor has been through it with me</button></p>`;
    else if (st.key === 'passed') action = `<div class="note ok">Assessment passed. One step left: sign the declaration.</div><button class="btn big" id="decl">Sign the declaration</button>`;
    render(`${whoBar()}<div class="co-hero"><p class="k">${esc(info.company)} · Revision ${c.revision}</p><h1>${esc(c.title)}</h1><p>${done} of ${total} modules complete</p></div>
      <div class="co-bar"><i style="width:${pct}%"></i></div>${action}<h2 style="margin-top:1.4rem">Modules</h2><div class="co-list">${mods}</div>
      <div class="co-list"><div class="co-item ${me.passed_at ? 'done' : 'locked'}"><span class="n">${me.passed_at ? '&#10003;' : 'A'}</span><span><b>Assessment</b><span class="s">${c.questions} questions. Pass mark ${c.pass_mark}%, and the safety-critical questions must be right.</span></span></div>
      <div class="co-item locked"><span class="n">D</span><span><b>Declaration</b><span class="s">Signed after you pass.</span></span></div></div>`);
    app.querySelectorAll('[data-m]').forEach(b => (b.onclick = () => openModule(Number(b.dataset.m))));
    if ($('#exam')) $('#exam').onclick = examIntro;
    if ($('#fb')) $('#fb').onclick = feedback;
    if ($('#decl')) $('#decl').onclick = declaration;
    if ($('#refresh')) $('#refresh').onclick = async () => { me = await api('/me'); if (me.stage.key === 'locked') showErr('Your supervisor has not recorded it yet. Ask them to record the instruction in the training portal.', $('#fb')); else home(); };
  }

  // ---------- a module ----------
  async function openModule(n) {
    try {
      if (!modules) modules = (await api('/content')).modules;
      const m = modules.find(x => x.n === n), total = modules.length;
      const reread = n <= me.modules_done;
      if (!reread || (me.stage.review_left || []).includes(n)) await api('/module', { n, action: 'open' });
      const needsRecord = !reread || (me.stage.review_left || []).includes(n);
      render(`<p class="link-row" style="text-align:left;margin:0 0 .6rem"><button class="btn quiet" id="back">&larr; All modules</button></p>
        <div class="co-hero"><p class="k">Module ${n} of ${total} · about ${m.mins} minutes</p><h1>${esc(m.title)}</h1></div>
        <div class="co-mod">${moduleHtml(m)}</div><div id="end"></div>
        ${needsRecord ? `<button class="btn big" id="done" disabled>Read to the end to continue</button>` : `<button class="btn big ghost" id="back2">Back to all modules</button>`}`);
      $('#back').onclick = home; if ($('#back2')) $('#back2').onclick = home;
      const btn = $('#done');
      if (!btn) return;
      const opened = Date.now(); let seen = false;
      const ready = () => { if (seen && Date.now() - opened >= 10000) { btn.disabled = false; btn.textContent = reread ? 'I have read this module again' : (n < total ? 'I have read this module. Next' : 'I have read this module. Go to the assessment'); return true; } return false; };
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { seen = true; ready(); } });
      io.observe($('#end'));
      const t = setInterval(() => { if (!document.body.contains(btn) || ready()) clearInterval(t); }, 500);
      btn.onclick = async () => {
        busy(btn, true);
        try { me = await api('/module', { n, action: 'complete' }); if (!reread && n < total) openModule(n + 1); else home(); }
        catch (e) { busy(btn, false); showErr(e.message, btn); }
      };
    } catch (e) { showErr(e.message); }
  }

  // ---------- assessment ----------
  function examIntro() {
    const c = info.course;
    render(`${whoBar()}<div class="co-hero"><p class="k">Assessment${me.attempts ? ' · attempt ' + (me.attempts + 1) : ''}</p><h1>Before you start</h1></div>
      <div class="co-mod"><ul><li>${c.questions} questions, one at a time. Take your time. There is no time limit.</li><li>Pick the one best answer for each question.</li>
      <li>You need ${c.pass_mark}% to pass, which is ${Math.ceil(c.questions * c.pass_mark / 100)} out of ${c.questions}.</li><li>Some questions are safety-critical. All of those must be answered correctly, whatever your total score.</li>
      <li>You will not be told which answers are right as you go. If you do not pass, you go back over the modules before trying again, and the questions will be different.</li>
      <li>Do it yourself. This is a record of what you understand.</li></ul></div>
      <button class="btn big" id="go">Start</button><p class="link-row"><button class="btn quiet" id="back">Back to the modules</button></p>`);
    $('#back').onclick = home;
    $('#go').onclick = async () => { const b = $('#go'); busy(b, true); try { exam(await api('/attempt', {})); } catch (e) { busy(b, false); showErr(e.message, b); } };
  }

  function exam(paper) {
    const qs = paper.questions, AK = KEY + '_a' + paper.number;
    let answers; try { answers = JSON.parse(sessionStorage.getItem(AK)) || []; } catch { answers = []; }
    let i = Math.min(answers.findIndex(a => a == null) === -1 ? answers.length : answers.findIndex(a => a == null), qs.length - 1);
    const save = () => { try { sessionStorage.setItem(AK, JSON.stringify(answers)); } catch { /* ignore */ } };
    function show() {
      const x = qs[i], last = i === qs.length - 1;
      render(`<div class="co-dots">${qs.map((_, k) => `<i class="${answers[k] != null ? 'a' : ''} ${k === i ? 'c' : ''}"></i>`).join('')}</div>
        <div class="co-q"><span class="qk">Question ${x.n} of ${qs.length}${x.kind === 'scenario' ? ' · site scenario' : ''}</span><h2>${esc(x.q)}</h2>
        <div class="opts">${x.options.map((o, k) => `<label><input type="radio" name="o" value="${k}" ${answers[i] === k ? 'checked' : ''}>${esc(o)}</label>`).join('')}</div></div>
        <div class="co-nav">${i ? '<button class="btn ghost" id="prev">Back</button>' : ''}<button class="btn" id="next">${last ? 'Check and submit' : 'Next'}</button></div>`);
      app.querySelectorAll('input[name=o]').forEach(r => (r.onchange = () => { answers[i] = Number(r.value); save(); }));
      if ($('#prev')) $('#prev').onclick = () => { i--; show(); };
      $('#next').onclick = () => { if (answers[i] == null) return showErr('Choose an answer to carry on.', $('.co-nav')); if (last) review(); else { i++; show(); } };
    }
    function review() {
      render(`<div class="co-hero"><p class="k">Assessment</p><h1>Ready to submit?</h1><p>You have answered all ${qs.length} questions. You can go back and change an answer, or submit.</p></div>
        <div class="co-list">${qs.map((x, k) => `<button class="co-item" data-q="${k}"><span class="n">${x.n}</span><span><b>${esc(x.q)}</b><span class="s">Your answer: ${esc(x.options[answers[k]])}</span></span></button>`).join('')}</div>
        <button class="btn big" id="sub">Submit my answers</button>`);
      app.querySelectorAll('[data-q]').forEach(b => (b.onclick = () => { i = Number(b.dataset.q); show(); }));
      $('#sub').onclick = async () => {
        const b = $('#sub'); busy(b, true);
        try { me = await api('/attempt/submit', { answers }); try { sessionStorage.removeItem(AK); } catch { /* ignore */ } result(); }
        catch (e) { busy(b, false); showErr(e.message, b); }
      };
    }
    show();
  }

  function result() {
    const l = me.last;
    if (l.passed) {
      render(`${whoBar()}<div class="co-result pass"><div class="big">${l.score}/${l.total}</div><h1>Passed</h1><p class="muted">${l.pct}%, with every safety-critical question correct.</p></div>
        <div class="note ok">One step left: sign the declaration.</div><button class="btn big" id="decl">Sign the declaration</button>`);
      $('#decl').onclick = declaration;
    } else feedback();
  }

  function feedback() {
    const l = me.last, st = me.stage, c = info.course;
    const why = l.pct < c.pass_mark ? `The pass mark is ${c.pass_mark}%.` : 'Your score was high enough, but a safety-critical question was answered incorrectly. Those must all be right.';
    render(`${whoBar()}<div class="co-result fail"><div class="big">${l.score}/${l.total}</div><h1>Not passed this time</h1><p class="muted">${l.pct}%. ${why}</p></div>
      <div class="note ${st.key === 'locked' ? 'err' : 'warn'}">${st.key === 'locked' ? 'Speak to your supervisor. They will go through the course with you before you take the assessment again.' : 'Read why each answer was wrong, then go back over the modules shown. The assessment will open again after that, with different questions.'}</div>
      <h2>What you got wrong</h2>${me.feedback.map(f => `<div class="co-fb"><div class="q">${f.critical ? '(Safety-critical) ' : ''}${esc(f.q)}</div><div class="g">You answered: ${esc(f.given)}</div><div>${esc(f.why_wrong)}</div><div class="m">Go back to module ${f.module}: ${esc(f.module_title)}</div></div>`).join('')}
      <button class="btn big" id="back">${st.key === 'locked' ? 'Back' : 'Go back over the modules'}</button>`);
    $('#back').onclick = home;
  }

  // ---------- declaration ----------
  function declaration() {
    render(`${whoBar()}<div class="co-hero"><p class="k">Last step</p><h1>Your declaration</h1></div>
      <div class="decl">${esc(info.course.declaration)}</div>
      <label class="check" style="margin-bottom:1rem"><input type="checkbox" id="ok"><span>I have read the declaration above and I agree to it.</span></label>
      <div class="field"><label for="n">Type your full name</label><input id="n" autocomplete="name"></div>
      <label>Your signature</label><div class="sig-wrap"><canvas id="sig"></canvas></div>
      <p style="margin:0 0 1rem;text-align:right"><button class="btn quiet small" id="clr">Clear signature</button></p>
      <button class="btn big" id="go">Sign and finish</button>`);
    const pad = sigPad($('#sig')); $('#clr').onclick = () => pad.clear();
    $('#go').onclick = async () => {
      const b = $('#go');
      if (!$('#ok').checked) return showErr('Tick the box to confirm the declaration.', b);
      if (pad.empty()) return showErr('Sign in the box to confirm.', b);
      busy(b, true);
      try { me = await api('/declare', { agreed: true, name: $('#n').value, signature: pad.data() }); complete(); }
      catch (e) { busy(b, false); showErr(e.message, b); }
    };
  }

  function complete() {
    render(`${whoBar()}<div class="si-done"><div class="tick" aria-hidden="true">&#10003;</div><h1>Course complete</h1><p class="muted">${esc(info.course.title)}, Revision ${info.course.revision}<br>Completed ${fDT(me.completed_at)}. Your reference is ${esc(me.person.ref)}.</p></div>
      <a class="btn big" href="/api/c/${LINK}/record.pdf?t=${encodeURIComponent(token)}" target="_blank" rel="noopener">Download my training record</a>
      <p class="split-note" style="margin-top:1rem"><b>Remember:</b> this is a training record. It is not a face-fit test. You must not do work that needs a tight-fitting mask unless your face-fit test for that mask has been confirmed and you are clean-shaven where it seals.</p>
      <div class="cb-banner" style="margin-top:1rem">NO DUST WITHOUT CONTROLS. NO EXCEPTIONS.</div>`);
  }

  function sigPad(canvas) {
    const ctx = canvas.getContext('2d'); let drawing = false, dirty = false;
    const r0 = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    canvas.width = r0.width * dpr; canvas.height = r0.height * dpr;
    ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#18201b';
    const pt = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', e => { drawing = true; canvas.setPointerCapture(e.pointerId); const p = pt(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
    canvas.addEventListener('pointermove', e => { if (!drawing) return; const p = pt(e); ctx.lineTo(p.x, p.y); ctx.stroke(); dirty = true; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => canvas.addEventListener(t, () => { drawing = false; }));
    return { clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; }, empty: () => !dirty, data: () => canvas.toDataURL('image/png') };
  }

  boot();
})();
