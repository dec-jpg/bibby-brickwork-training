// The risk alert, as operatives see it on their phone from the WhatsApp link (/c/TOKEN).
// One page: the alert, then the three key questions, then the sign-off at the bottom.
(() => {
  const app = document.getElementById('app');
  const LINK = location.pathname.split('/').filter(Boolean)[1];
  const KEY = 'bibby_alert_' + LINK;
  const { esc, moduleHtml } = window.CourseKit;
  let info = null, me = null, token = null, alertDoc = null;

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
    let n = $('.note.err.live');
    if (!n) { n = document.createElement('div'); n.className = 'note err live'; before.before(n); }
    n.textContent = msg; n.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function busy(btn, on) { if (!btn) return; if (on) { btn.dataset.l = btn.textContent; btn.textContent = 'Please wait'; btn.disabled = true; } else { btn.textContent = btn.dataset.l || btn.textContent; btn.disabled = false; } }
  const whoBar = () => `<div class="si-who"><div><b>${esc(me.person.name)}</b><span class="muted small">${esc(me.person.ref)} · ${esc(me.person.site || '')}</span></div><button class="btn quiet" id="notme">Not you?</button></div>`;
  app.addEventListener('click', e => { if (e.target.closest('#notme')) { store.clear(); token = null; me = null; identify(); } });
  const hero = sub => `<div class="co-hero"><p class="k">${esc(info.company)} · Risk alert · Revision ${info.course.revision}</p><h1>${esc(info.course.title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>`;

  async function boot() {
    try {
      const b = await (await fetch('/api/brand')).json();
      document.getElementById('brand').innerHTML = b.logo ? '<img src="/logo" alt="">' : `<div class="wordmark">${esc(b.short)}<small>Risk alert</small></div>`;
    } catch { /* no brand */ }
    try { info = await api(''); } catch (e) { return render(`<div class="note warn">${esc(e.message)}</div>`); }
    document.title = info.course.title;
    token = store.get();
    if (!token) return identify();
    try { me = await api('/me'); page(); } catch { /* identify() already shown */ }
  }

  function identify() {
    render(`${hero(`Read the alert, answer ${info.course.questions} questions and sign. About ${info.course.minutes} minutes.`)}
      <h1>Your details</h1><p class="muted">These go on your training record.</p>
      <div class="field"><label for="n">First name and surname</label><input id="n" autocomplete="name"></div>
      <div class="field"><label for="p">Mobile number</label><input id="p" type="tel" autocomplete="tel" inputmode="tel"></div>
      <div class="field"><label for="e">Who do you work for?</label><input id="e" value="${esc(info.company)}"><span class="hint">Change this if you work for an agency or another company.</span></div>
      <div class="field"><label for="s">Site you are working on</label><select id="s"><option value="">Choose</option>${info.sites.map(s => `<option>${esc(s)}</option>`).join('')}<option value="__other">Another site</option></select></div>
      <div class="field hidden" id="so"><label for="s2">Site name</label><input id="s2"></div>
      <div class="field"><label for="r">Your role</label><select id="r"><option value="">Choose</option>${info.roles.map(s => `<option>${esc(s)}</option>`).join('')}</select></div>
      <button class="btn big" id="go">Read the alert</button>`);
    $('#s').onchange = () => $('#so').classList.toggle('hidden', $('#s').value !== '__other');
    $('#go').onclick = async () => {
      const btn = $('#go'); busy(btn, true);
      try {
        const site = $('#s').value === '__other' ? $('#s2').value : $('#s').value;
        const r = await api('/enrol', { name: $('#n').value, phone: $('#p').value, employer: $('#e').value, site, role: $('#r').value });
        token = r.token; store.set(token); me = r; page();
      } catch (e) { busy(btn, false); showErr(e.message, btn); }
    };
  }

  // ---------- the one page ----------
  async function page(keepScroll) {
    const st = me.stage;
    if (st.key === 'complete') return complete();
    try { if (!alertDoc) alertDoc = (await api('/content')).modules[0]; } catch (e) { return render(`<div class="note err">${esc(e.message)}</div>`); }
    const failed = me.last && !me.last.passed;
    const fb = failed ? `<div class="note err"><b>Not all of your answers were right.</b> ${st.key === 'locked' ? 'Speak to your supervisor. They will go through the alert with you, and then you can answer the questions again.' : 'Read why below, read the alert again, then answer the questions again.'}</div>
      ${me.feedback.map(f => `<div class="co-fb"><div class="q">${esc(f.q)}</div><div class="g">You answered: ${esc(f.given)}</div><div>${esc(f.why_wrong)}</div></div>`).join('')}` : '';
    const y = window.scrollY;
    render(`${whoBar()}${hero()}${st.key === 'passed' ? '' : fb}<div class="co-mod">${moduleHtml(alertDoc)}</div><div id="end"></div><div id="next"></div>`);
    if (keepScroll) window.scrollTo(0, y);
    const next = $('#next');
    if (st.key === 'in_progress' || st.key === 'review') readGate(next, st.key === 'review');
    else if (st.key === 'assessment') questions(next);
    else if (st.key === 'locked') {
      next.innerHTML = '<button class="btn big ghost" id="refresh">My supervisor has been through it with me</button>';
      $('#refresh').onclick = async () => { me = await api('/me'); if (me.stage.key === 'locked') showErr('Your supervisor has not recorded it yet. Ask them to record it in the training portal.', $('#refresh')); else page(); };
    } else if (st.key === 'passed') signoff(next);
  }

  // "I have read this alert": opens when they have scrolled to the end and at least 10 seconds have passed.
  async function readGate(next, again) {
    try { await api('/module', { n: 1, action: 'open' }); } catch (e) { next.innerHTML = `<div class="note err">${esc(e.message)}</div>`; return; }
    next.innerHTML = '<button class="btn big" id="done" disabled>Read to the end to continue</button>';
    const btn = $('#done'), opened = Date.now(); let seen = false;
    const ready = () => { if (seen && Date.now() - opened >= 10000) { btn.disabled = false; btn.textContent = again ? 'I have read the alert again. Show the questions' : `I have read this alert. Show the ${info.course.questions} questions`; return true; } return false; };
    new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { seen = true; ready(); } }).observe($('#end'));
    const t = setInterval(() => { if (!document.body.contains(btn) || ready()) clearInterval(t); }, 500);
    btn.onclick = async () => {
      busy(btn, true);
      try { me = await api('/module', { n: 1, action: 'complete' }); questions(next); }
      catch (e) { busy(btn, false); showErr(e.message, btn); }
    };
  }

  // The key questions, all on the page, under the alert.
  async function questions(next) {
    let paper;
    try { paper = await api('/attempt', {}); } catch (e) { next.innerHTML = `<div class="note err">${esc(e.message)}</div>`; return; }
    const qs = paper.questions;
    next.innerHTML = `<h2 style="margin-top:1.4rem">${qs.length} key questions</h2><p class="muted">Pick one answer for each. All ${qs.length} must be right before you can sign.</p>
      ${qs.map((x, i) => `<div class="co-q"><span class="qk">Question ${x.n} of ${qs.length}</span><h2>${esc(x.q)}</h2><div class="opts">${x.options.map((o, k) => `<label><input type="radio" name="q${i}" value="${k}">${esc(o)}</label>`).join('')}</div></div>`).join('')}
      <button class="btn big" id="sub">Submit my answers</button>`;
    $('#sub').onclick = async () => {
      const b = $('#sub');
      const answers = qs.map((_, i) => { const c = app.querySelector(`input[name=q${i}]:checked`); return c ? Number(c.value) : null; });
      if (answers.some(a => a == null)) return showErr('Answer every question before you submit.', b);
      busy(b, true);
      try { me = await api('/attempt/submit', { answers }); if (me.last.passed) { signoff(next); next.scrollIntoView({ behavior: 'smooth' }); } else page(); }
      catch (e) { busy(b, false); showErr(e.message, b); }
    };
  }

  // Sign-off, at the bottom of the page.
  function signoff(next) {
    next.innerHTML = `<div class="note ok" style="margin-top:1.2rem"><b>All ${info.course.questions} questions answered correctly.</b> Sign below to finish.</div>
      <h2>Sign-off</h2><div class="decl">${esc(info.course.declaration)}</div>
      <label class="check" style="margin-bottom:1rem"><input type="checkbox" id="ok"><span>I have read the declaration above and I agree to it.</span></label>
      <div class="field"><label for="n">Type your full name</label><input id="n" autocomplete="name"></div>
      <label>Your signature</label><div class="sig-wrap"><canvas id="sig"></canvas></div>
      <p style="margin:0 0 1rem;text-align:right"><button class="btn quiet small" id="clr">Clear signature</button></p>
      <button class="btn big" id="go">Sign and finish</button>`;
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
    render(`${whoBar()}<div class="si-done"><div class="tick" aria-hidden="true">&#10003;</div><h1>Signed</h1><p class="muted">${esc(info.course.title)}, Revision ${info.course.revision}<br>Signed ${fDT(me.completed_at)}. Your reference is ${esc(me.person.ref)}.</p></div>
      <a class="btn big" href="/api/c/${LINK}/record.pdf?t=${encodeURIComponent(token)}" target="_blank" rel="noopener">Download my record</a>
      <p class="split-note" style="margin-top:1rem"><b>Remember:</b> signing this alert is not a face-fit test. You must not do work that needs a tight-fitting mask unless your face-fit test for that mask has been confirmed and you are clean-shaven where it seals.</p>
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
