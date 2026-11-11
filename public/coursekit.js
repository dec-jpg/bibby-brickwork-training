// Shared by the operative course page and the office preview: the illustrations and the module renderer.
window.CourseKit = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const INK = '#17150f', GREY = '#6f685d', LINE = '#d9d4c9', RED = '#c0392b', GREEN = '#2f7d4f', DUST = '#b89b72', SKIN = '#e9c9a8', BLUE = '#3d8fc4', PAPER = '#f4f1ea';
  const rnd = i => { const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
  const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 15}" font-weight="${o.w || 600}" fill="${o.fill || INK}" text-anchor="${o.a || 'start'}" font-family="Inter,Arial,sans-serif">${esc(s)}</text>`;
  const tick = (x, y) => `<circle cx="${x}" cy="${y}" r="17" fill="${GREEN}"/><path d="M${x - 8} ${y}l6 6 10-12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  const cross = (x, y) => `<circle cx="${x}" cy="${y}" r="17" fill="${RED}"/><path d="M${x - 7} ${y - 7}l14 14M${x + 7} ${y - 7}l-14 14" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`;
  // A simple head and shoulders, facing forward.
  const head = (x, y, o = {}) => `<path d="M${x - 62} ${y + 120}c0-40 28-56 62-56s62 16 62 56z" fill="${o.top || '#f0b429'}"/><rect x="${x - 13}" y="${y + 38}" width="26" height="30" fill="${SKIN}"/>
    <ellipse cx="${x}" cy="${y}" rx="38" ry="46" fill="${SKIN}"/><path d="M${x - 44} ${y - 14}a44 40 0 0 1 88 0z" fill="#fff" stroke="${INK}" stroke-width="2"/><rect x="${x - 50}" y="${y - 17}" width="100" height="7" rx="3.5" fill="#fff" stroke="${INK}" stroke-width="2"/>
    <circle cx="${x - 14}" cy="${y + 2}" r="3.2" fill="${INK}"/><circle cx="${x + 14}" cy="${y + 2}" r="3.2" fill="${INK}"/>${o.stubble ? stubble(x, y) : ''}`;
  const stubble = (x, y) => { let s = ''; for (let i = 0; i < 60; i++) { const dx = (rnd(i) - 0.5) * 58, dy = 14 + rnd(i + 99) * 28; if (Math.abs(dx) > 30 - (dy - 14) * 0.45) continue; s += `<circle cx="${(x + dx).toFixed(1)}" cy="${(y + dy).toFixed(1)}" r="1.3" fill="#4a4036"/>`; } return s; };
  const ffp3 = (x, y) => `<path d="M${x - 38} ${y + 6}L${x - 20} ${y + 12}M${x + 38} ${y + 6}L${x + 20} ${y + 12}M${x - 37} ${y + 26}L${x - 20} ${y + 26}M${x + 37} ${y + 26}L${x + 20} ${y + 26}" stroke="#d4a017" stroke-width="3"/>
    <path d="M${x - 24} ${y + 10}q24-12 48 0v18q-24 22-48 0z" fill="#fff" stroke="${INK}" stroke-width="2"/><rect x="${x - 7}" y="${y + 18}" width="14" height="11" rx="3" fill="${LINE}" stroke="${INK}" stroke-width="1.5"/>`;
  const half = (x, y) => `<path d="M${x - 38} ${y + 4}L${x - 16} ${y + 14}M${x + 38} ${y + 4}L${x + 16} ${y + 14}M${x - 36} ${y + 28}L${x - 16} ${y + 26}M${x + 36} ${y + 28}L${x + 16} ${y + 26}" stroke="#333" stroke-width="3"/>
    <path d="M${x - 20} ${y + 10}q20-10 40 0l-4 26q-16 12-32 0z" fill="#5b6470" stroke="${INK}" stroke-width="2"/>
    <circle cx="${x - 30}" cy="${y + 30}" r="13" fill="#e7e2d9" stroke="${INK}" stroke-width="2"/><circle cx="${x + 30}" cy="${y + 30}" r="13" fill="#e7e2d9" stroke="${INK}" stroke-width="2"/>${T(x - 30, y + 34, 'P3', { size: 9, a: 'middle', w: 800 })}${T(x + 30, y + 34, 'P3', { size: 9, a: 'middle', w: 800 })}`;
  const dustCloud = (x, y, n, spread, col = DUST) => { let s = ''; for (let i = 0; i < n; i++) { const dx = (((i * 53) % 100) / 100 - 0.5) * spread, dy = (((i * 29) % 100) / 100 - 0.5) * spread * 0.6, r = 2 + ((i * 7) % 9); s += `<circle cx="${(x + dx).toFixed(1)}" cy="${(y + dy).toFixed(1)}" r="${r}" fill="${col}" opacity="${0.25 + ((i * 11) % 5) / 10}"/>`; } return s; };
  const svg = (h, inner, label) => `<svg viewBox="0 0 640 ${h}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  const panel = (x, w, h, col) => `<rect x="${x}" y="8" width="${w}" height="${h - 16}" rx="12" fill="#fff" stroke="${col}" stroke-width="3"/>`;

  const FIG = {
    silica: () => {
      const rows = [['Sandstone, gritstone', 70, 100, 'More than 70%'], ['Concrete, blocks, mortar', 25, 70, '25% to 70%'], ['Clay brick', 0, 30, 'Up to 30%'], ['Limestone, marble', 0, 2, 'About 2%']];
      return svg(250, rows.map((r, i) => { const y = 22 + i * 56, x0 = 20, w = 440; return `${T(x0, y + 12, r[0], { size: 15 })}<rect x="${x0}" y="${y + 20}" width="${w}" height="20" rx="5" fill="${PAPER}"/>
        <rect x="${x0 + w * r[1] / 100}" y="${y + 20}" width="${Math.max(w * (r[2] - r[1]) / 100, 8)}" height="20" rx="5" fill="${DUST}"/>${r[1] ? `<rect x="${x0}" y="${y + 20}" width="${w * r[1] / 100 + 6}" height="20" rx="5" fill="${DUST}" opacity=".45"/>` : ''}${T(x0 + w + 14, y + 36, r[3], { size: 15, w: 800 })}`; }).join(''), 'Bar chart of silica content in common masonry materials');
    },
    particles: () => svg(330, `
      <rect x="20" y="14" width="600" height="92" rx="12" fill="#fff" stroke="${LINE}" stroke-width="2"/><rect x="20" y="120" width="600" height="92" rx="12" fill="#fff" stroke="${LINE}" stroke-width="2"/><rect x="20" y="226" width="600" height="92" rx="12" fill="#fbeae7" stroke="${RED}" stroke-width="2"/>
      ${T(40, 46, 'Nose and throat', { size: 17, w: 800 })}${T(40, 70, 'Large dust you can see', { fill: GREY })}${T(40, 90, 'is mostly stopped here', { fill: GREY })}
      ${T(40, 152, 'Windpipe and airways', { size: 17, w: 800 })}${T(40, 176, 'Finer dust gets further', { fill: GREY })}${T(40, 196, 'and is coughed back up', { fill: GREY })}
      ${T(40, 258, 'Deep in the lungs', { size: 17, w: 800, fill: RED })}${T(40, 282, 'Respirable dust (RCS):', { fill: INK })}${T(40, 302, 'too fine to see, stays there', { fill: INK })}
      ${[0, 1, 2, 3, 4].map(i => `<circle cx="${370 + i * 50}" cy="60" r="${15 - i}" fill="${DUST}"/>`).join('')}
      ${[0, 1, 2, 3, 4, 5, 6].map(i => `<circle cx="${360 + i * 36}" cy="${160 + (i % 2) * 14}" r="6" fill="${DUST}"/>`).join('')}
      ${Array.from({ length: 60 }, (_, i) => `<circle cx="${(350 + rnd(i) * 250).toFixed(1)}" cy="${(244 + rnd(i + 200) * 58).toFixed(1)}" r="1.8" fill="${RED}"/>`).join('')}
      <path d="M320 100v22M320 206v22" stroke="${GREY}" stroke-width="3" stroke-dasharray="4 4"/>`, 'Diagram showing large dust stopped in the nose and throat and respirable dust reaching deep into the lungs'),
    lungs: () => {
      const lung = (x, scar) => `<path d="M${x} 60c-50 0-80 60-84 130-2 36 30 44 54 34 22-9 30-30 30-60z" fill="#f2b8b0" stroke="${INK}" stroke-width="2"/><path d="M${x + 16} 60c50 0 80 60 84 130 2 36-30 44-54 34-22-9-30-30-30-60z" fill="#f2b8b0" stroke="${INK}" stroke-width="2"/>
        <path d="M${x + 8} 20v50" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>${scar ? Array.from({ length: 18 }, (_, i) => { const side = i % 2 ? 1 : -1, cy = 96 + rnd(i) * 104, cx = x + 8 + side * (26 + rnd(i + 50) * (18 + (cy - 96) * 0.3)); return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(6 + rnd(i + 9) * 8).toFixed(1)}" ry="${(4 + rnd(i + 19) * 6).toFixed(1)}" fill="#5b5148" opacity=".72"/>`; }).join('') : ''}`;
      return svg(290, `${panel(10, 300, 290, GREEN)}${panel(330, 300, 290, RED)}${lung(152, false)}${lung(472, true)}${T(160, 268, 'Healthy lungs', { a: 'middle', size: 17, w: 800, fill: GREEN })}${T(480, 268, 'Scarred by silica dust', { a: 'middle', size: 17, w: 800, fill: RED })}`, 'Healthy lungs compared with lungs scarred by silica dust');
    },
    hierarchy: () => {
      const rows = [['1', 'Eliminate', 'Design out cuts, pre-cut materials', GREEN], ['2', 'Reduce', 'Block splitter, lower-energy tools', '#5a9a52'], ['3', 'Control at the tool', 'Water suppression, on-tool extraction', '#b6852a'], ['4', 'Housekeeping', 'Cutting areas, no dry sweeping', '#c4622a'], ['5', 'RPE', 'The last line of protection', RED]];
      return svg(336, `${T(20, 22, 'MOST EFFECTIVE', { size: 12, w: 800, fill: GREEN })}${rows.map((r, i) => { const inset = i * 26, y = 32 + i * 56; return `<path d="M${20 + inset} ${y}h${600 - 2 * inset}l-13 50h-${574 - 2 * inset}z" fill="${r[3]}"/>${T(320, y + 22, `${r[0]}. ${r[1]}`, { a: 'middle', fill: '#fff', size: 17, w: 800 })}${T(320, y + 41, r[2], { a: 'middle', fill: '#fff', size: i > 2 ? 11.5 : 13, w: 500 })}`; }).join('')}${T(320, 328, 'LAST RESORT', { size: 12, w: 800, fill: RED, a: 'middle' })}`, 'The hierarchy of control from eliminating dust at the top to RPE at the bottom');
    },
    saw: () => {
      const block = x => `<rect x="${x}" y="170" width="170" height="60" rx="3" fill="#b7b2a8" stroke="${INK}" stroke-width="2"/><rect x="${x - 20}" y="230" width="210" height="10" fill="${GREY}"/>`;
      const disc = x => `<circle cx="${x}" cy="150" r="46" fill="#dcdcdc" stroke="${INK}" stroke-width="2"/><circle cx="${x}" cy="150" r="8" fill="${INK}"/><path d="M${x - 50} 104a52 52 0 0 1 100 0z" fill="#e0622a" stroke="${INK}" stroke-width="2"/><rect x="${x + 30}" y="78" width="80" height="26" rx="8" fill="#e0622a" stroke="${INK}" stroke-width="2"/>`;
      return svg(300, `${panel(10, 300, 300, RED)}${panel(330, 300, 300, GREEN)}
        ${block(60)}${disc(140)}${dustCloud(150, 120, 60, 240)}${cross(40, 40)}${T(160, 274, 'Dry cutting: not permitted', { a: 'middle', size: 16, w: 800, fill: RED })}
        ${block(380)}${disc(460)}<path d="M560 60h36v70h-36z" fill="${BLUE}" stroke="${INK}" stroke-width="2"/><path d="M578 60v-14h-14" fill="none" stroke="${INK}" stroke-width="3"/><path d="M560 120q-50 30-84 20" fill="none" stroke="${BLUE}" stroke-width="4"/>
        ${[0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M${428 + i * 11} ${176 + (i % 3) * 9}q4 7 0 10q-4-3 0-10z" fill="${BLUE}"/>`).join('')}${T(578, 150, 'Water', { size: 12, a: 'middle', fill: BLUE, w: 800 })}
        ${tick(360, 40)}${T(480, 262, 'Water on the blade', { a: 'middle', size: 16, w: 800, fill: GREEN })}${T(480, 282, 'plus APF 20 RPE', { a: 'middle', size: 16, w: 800, fill: GREEN })}`, 'Dry cutting with a dust cloud, not permitted, compared with cutting using water suppression and RPE');
    },
    extraction: () => svg(260, `<rect x="20" y="40" width="26" height="190" fill="#b7b2a8" stroke="${INK}" stroke-width="2"/>
      <path d="M52 96a44 44 0 0 1 0 88z" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="52" cy="140" r="30" fill="#dcdcdc" stroke="${INK}" stroke-width="2"/>
      <rect x="84" y="122" width="150" height="36" rx="10" fill="#3a7ca5" stroke="${INK}" stroke-width="2"/>
      <path d="M96 120c0-60 120-70 190-40s110 90 150 96" fill="none" stroke="#444" stroke-width="12" stroke-linecap="round"/><path d="M96 120c0-60 120-70 190-40s110 90 150 96" fill="none" stroke="#888" stroke-width="3" stroke-dasharray="3 9"/>
      <rect x="430" y="110" width="150" height="110" rx="12" fill="#e0622a" stroke="${INK}" stroke-width="2"/><circle cx="460" cy="232" r="13" fill="${INK}"/><circle cx="550" cy="232" r="13" fill="${INK}"/>
      <rect x="452" y="128" width="106" height="40" rx="6" fill="#fff" stroke="${INK}" stroke-width="2"/>${T(505, 155, 'M CLASS', { a: 'middle', size: 17, w: 800 })}
      ${T(60, 28, 'Shroud on the tool', { size: 14, w: 700 })}${T(250, 40, 'Hose', { size: 14, w: 700 })}${T(505, 100, 'Extraction unit', { a: 'middle', size: 14, w: 700 })}
      <path d="M150 196h60m-12-7l12 7-12 7M300 150h60m-12-7l12 7-12 7" stroke="${GREEN}" stroke-width="3" fill="none"/>${T(180, 222, 'Dust captured', { a: 'middle', size: 13, fill: GREEN, w: 800 })}`, 'On-tool extraction: shroud on the tool, hose, and M class extraction unit'),
    rpe: () => svg(330, `${head(110, 110)}${ffp3(110, 110)}${head(320, 110)}${half(320, 110)}
      ${head(530, 110, {})}<path d="M478 176q-14-158 52-160q66 2 52 160z" fill="#cfe3ef" fill-opacity=".6" stroke="${INK}" stroke-width="2"/><rect x="496" y="76" width="68" height="60" rx="12" fill="#fff" fill-opacity=".35" stroke="${INK}" stroke-width="2"/>
      <path d="M580 150q38 36 8 84" fill="none" stroke="#444" stroke-width="9" stroke-linecap="round"/><rect x="560" y="226" width="52" height="24" rx="6" fill="#444"/>
      ${T(110, 268, 'FFP3 disposable', { a: 'middle', size: 15, w: 800 })}${T(110, 288, 'APF 20, tight-fitting', { a: 'middle', size: 13, fill: GREY })}${T(110, 306, 'Face-fit test needed', { a: 'middle', size: 13, fill: RED, w: 700 })}
      ${T(320, 268, 'Half-mask, P3 filters', { a: 'middle', size: 15, w: 800 })}${T(320, 288, 'APF 20, tight-fitting', { a: 'middle', size: 13, fill: GREY })}${T(320, 306, 'Face-fit test needed', { a: 'middle', size: 13, fill: RED, w: 700 })}
      ${T(530, 268, 'Powered air, hood', { a: 'middle', size: 15, w: 800 })}${T(530, 288, 'Loose-fitting, no seal', { a: 'middle', size: 13, fill: GREY })}${T(530, 306, 'Suitable with a beard', { a: 'middle', size: 13, fill: GREEN, w: 700 })}`, 'Three types of RPE: FFP3 disposable mask, half-mask with P3 filters, powered-air respirator with hood'),
    seal: () => {
      const skin = x => `<path d="M${x} 190q130-26 260 0v50h-260z" fill="${SKIN}" stroke="${INK}" stroke-width="2"/>`;
      return svg(310, `${panel(10, 300, 310, GREEN)}${panel(330, 300, 310, RED)}
        ${skin(30)}<path d="M60 176q100-20 200 0l-6-52q-94-18-188 0z" fill="#5b6470" stroke="${INK}" stroke-width="2"/>${T(160, 150, 'Mask seal', { a: 'middle', fill: '#fff', size: 14 })}
        ${T(160, 222, 'Skin', { a: 'middle', size: 13, fill: GREY })}${dustCloud(160, 70, 18, 200)}${tick(40, 40)}${T(160, 270, 'Clean-shaven: sealed', { a: 'middle', size: 16, w: 800, fill: GREEN })}${T(160, 290, 'Dust kept out', { a: 'middle', size: 13, fill: GREY })}
        ${skin(350)}${Array.from({ length: 30 }, (_, i) => `<path d="M${372 + i * 7.4} ${186 - Math.sin((i + 1) / 31 * Math.PI) * 11}l${(i % 3) - 1} -13" stroke="#3a322b" stroke-width="2"/>`).join('')}
        <path d="M380 160q100-20 200 0l-6-52q-94-18-188 0z" fill="#5b6470" stroke="${INK}" stroke-width="2"/>${T(480, 134, 'Mask seal', { a: 'middle', fill: '#fff', size: 14 })}
        ${dustCloud(480, 60, 18, 200)}<path d="M352 172h50m-10-6l10 6-10 6M608 172h-50m10-6l-10 6 10 6" stroke="${RED}" stroke-width="3.5" fill="none"/>
        ${T(480, 222, 'Skin', { a: 'middle', size: 13, fill: GREY })}${cross(360, 40)}${T(480, 270, 'Stubble: seal held open', { a: 'middle', size: 16, w: 800, fill: RED })}${T(480, 290, 'Dust leaks in at the edges', { a: 'middle', size: 13, fill: GREY })}`, 'Cross-section showing a mask sealing on clean-shaven skin and leaking over stubble');
    },
    wear: () => svg(300, `${panel(10, 300, 300, GREEN)}${panel(330, 300, 300, RED)}
      ${head(160, 90)}${half(160, 90)}${tick(40, 40)}${T(160, 244, 'Correct', { a: 'middle', size: 17, w: 800, fill: GREEN })}${T(160, 264, 'All straps on, sealed to', { a: 'middle', size: 13, fill: GREY })}${T(160, 281, 'clean-shaven skin', { a: 'middle', size: 13, fill: GREY })}
      ${head(480, 90, { stubble: true })}<g transform="translate(0 20)">${ffp3(480, 90)}</g>${cross(360, 40)}${T(480, 244, 'Incorrect', { a: 'middle', size: 17, w: 800, fill: RED })}${T(480, 264, 'Below the nose, over stubble,', { a: 'middle', size: 13, fill: GREY })}${T(480, 281, 'loose straps', { a: 'middle', size: 13, fill: GREY })}`, 'Correct and incorrect ways of wearing a mask'),
  };

  function block(b) {
    const list = items => `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
    switch (b.t) {
      case 'p': return `<p>${esc(b.x)}</p>`;
      case 'h': return `<h3>${esc(b.x)}</h3>`;
      case 'list': return list(b.items);
      case 'key': return `<div class="cb cb-key"><span class="cb-k">Key message</span>${esc(b.x)}</div>`;
      case 'warn': return `<div class="cb cb-warn"><span class="cb-k">Stop</span>${esc(b.x)}</div>`;
      case 'eg': return `<div class="cb cb-eg"><span class="cb-k">${esc(b.h)}</span>${esc(b.x)}</div>`;
      case 'fig': return `<figure class="cb-fig">${FIG[b.id] ? FIG[b.id]() : ''}<figcaption>${esc(b.cap)}</figcaption></figure>`;
      case 'table': return `<div class="cb-table"><table><thead><tr>${b.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<td><b>${esc(c)}</b></td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
      case 'banner': return `<div class="cb-banner">${esc(b.x)}</div>`;
      case 'rules': return `<ol class="cb-rules">${b.items.map(i => `<li>${esc(i)}</li>`).join('')}</ol>`;
      case 'statement': return `<div class="cb-statement"><h3>${esc(b.h)}</h3>${b.paras.map(p => `<p>${esc(p)}</p>`).join('')}${list(b.items)}${b.after.map(p => `<p>${esc(p)}</p>`).join('')}</div>`;
      default: return '';
    }
  }
  const moduleHtml = m => m.blocks.map(block).join('');
  return { esc, moduleHtml, FIG };
})();
