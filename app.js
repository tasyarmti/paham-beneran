/* Paham Beneran
 * Alur: buat topik + poin isi materi -> rekam penjelasan tanpa catatan -> putar ulang
 * dan centang checklist -> catatan -> jadwal tes ulang berjarak (1, 3, 7, 14, 30 hari).
 * Semua data (termasuk rekaman) disimpan di IndexedDB browser ini. Tidak ada server.
 */
'use strict';

const INTERVALS = [1, 3, 7, 14, 30];
const AUDIENCES = ['Orang awam', 'Atasan', 'Junior', 'Teman sekelas'];
// Format "Cara menjelaskan" dipilih per kelompok materi. Setiap poin punya petunjuk singkat.
const PLAIN = { text: 'Bahasa bisa dipahami pendengar', hint: 'Hindari istilah teknis, atau jelaskan istilahnya dalam satu kalimat sederhana.' };
const FORMATS = {
  umum: {
    name: 'Umum', desc: 'Konsep, definisi, teori',
    items: [
      { text: 'Mulai dari intinya', hint: 'Kalimat pertama langsung menjawab "apa itu?" dalam satu kalimat, sebelum masuk ke detail.' },
      { text: 'Contoh buatan sendiri', hint: 'Pakai contoh dari pengalaman atau pekerjaanmu, bukan menyalin contoh dari materi.' },
      { text: 'Kapan berlaku dan kapan tidak', hint: 'Sebut batas atau pengecualiannya: situasi yang sering dikira sama, padahal berbeda.' },
      { text: 'Jawab satu "kenapa?"', hint: 'Jelaskan alasan atau manfaatnya, bukan hanya apa. Contoh: kenapa konsep ini penting di pekerjaan.' },
      PLAIN,
    ],
  },
  kasus: {
    name: 'Studi kasus', desc: 'Ujian esai berbasis kasus',
    items: [
      { text: 'Kesimpulan di awal', hint: 'Jawab pertanyaan kasusnya di kalimat pertama, baru jelaskan alasannya.' },
      { text: 'Konsep diterapkan ke kasus', hint: 'Cocokkan kriteria dari materi dengan fakta di kasus, satu per satu.' },
      { text: 'Jawab keberatan pendengar', hint: 'Bayangkan satu bantahan, misalnya "biayanya mahal", lalu jawab.' },
      { text: 'Rekomendasi', hint: 'Beri langkah konkret: siapa melakukan apa, dan untuk siapa (termasuk pemulihan pihak yang dirugikan).' },
      PLAIN,
    ],
  },
  bahasa: {
    name: 'Grammar bahasa', desc: 'Pola kalimat, tata bahasa',
    items: [
      { text: 'Arti dan fungsi pola', hint: 'Kapan pola ini dipakai. Contoh: ~te iru untuk aksi yang sedang berlangsung atau keadaan.' },
      { text: 'Cara membentuk', hint: 'Rumus sambungnya. Contoh: kata kerja bentuk -te + iru.' },
      { text: 'Contoh kalimat sendiri', hint: 'Buat 1 sampai 2 kalimat baru tentang hidupmu, bukan dari buku.' },
      { text: 'Beda dengan pola yang mirip', hint: 'Sebut satu pola yang sering tertukar dan bedanya. Contoh: ~te iru dan ~te aru.' },
      PLAIN,
    ],
  },
  sendiri: {
    name: 'Atur sendiri', desc: 'Tulis poinmu sendiri',
    items: [PLAIN],
  },
};
const cloneItems = key => FORMATS[key].items.map(x => ({ ...x }));
// Topik lama (sebelum ada format) memakai format studi kasus.
const caraOf = topic => topic.cara?.length ? topic.cara : cloneItems('kasus');
const FLOWER = `<svg class="flower" viewBox="0 0 60 60" aria-hidden="true"><g fill="#fff" stroke="#E8C547" stroke-width="1.6">${
  [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<ellipse cx="30" cy="13" rx="6.5" ry="12" transform="rotate(${a} 30 30)"/>`).join('')
}</g><circle cx="30" cy="30" r="9" fill="#F6D365"/></svg>`;

/* ---------- Penyimpanan (IndexedDB) ---------- */
const DB_NAME = 'paham-beneran';
let dbPromise;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore('topics', { keyPath: 'id' });
        const a = d.createObjectStore('attempts', { keyPath: 'id' });
        a.createIndex('topicId', 'topicId');
        d.createObjectStore('audio');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}
// Cadangan di memori kalau IndexedDB tidak tersedia (mode privat, pratinjau).
const mem = { topics: new Map(), attempts: new Map(), audio: new Map() };
let memOnly = false;
async function tx(store, mode, fn) {
  let d = null;
  if (!memOnly) {
    try { d = await db(); } catch { memOnly = true; }
  }
  if (memOnly) return memTx(store, fn);
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    t.onerror = () => reject(t.error);
  });
}
function memTx(store, fn) {
  const m = mem[store];
  const fake = {
    getAll: () => ({ result: [...m.values()] }),
    get: k => ({ result: m.get(k) }),
    put: (v, k) => { const key = k === undefined ? v.id : k; m.set(key, v); return { result: key }; },
    delete: k => { m.delete(k); return { result: undefined }; },
    index: () => ({ getAll: id => ({ result: [...m.values()].filter(x => x.topicId === id) }) }),
  };
  const out = fn(fake);
  return Promise.resolve(out && 'result' in out ? out.result : undefined);
}
const getAll = store => tx(store, 'readonly', s => s.getAll());
const get = (store, key) => tx(store, 'readonly', s => s.get(key));
const put = (store, val, key) => tx(store, 'readwrite', s => (key === undefined ? s.put(val) : s.put(val, key)));
const del = (store, key) => tx(store, 'readwrite', s => s.delete(key));
async function attemptsOf(topicId) {
  const list = await tx('attempts', 'readonly', s => s.index('topicId').getAll(topicId));
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- Tanggal ---------- */
const pad = n => String(n).padStart(2, '0');
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function today() { return ymd(new Date()); }
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + n));
}
function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function fmtDate(dateStr, withDay = true) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${withDay ? HARI[dt.getDay()] + ', ' : ''}${d} ${BULAN[m - 1]}`;
}
function relDate(dateStr) {
  const n = daysBetween(today(), dateStr);
  if (n < 0) return `terlambat ${-n} hari`;
  if (n === 0) return 'hari ini';
  if (n === 1) return 'besok';
  return `${n} hari lagi`;
}
const fmtDur = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;

/* ---------- Util ---------- */
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), 2200);
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Prompt tersalin. Tempel di ChatGPT atau Claude.');
}
const go = hash => { location.hash = hash; };
const caraLabels = (topic, audience) => caraOf(topic).map(c => ({
  ...c, text: c.text === PLAIN.text ? `Bahasa bisa dipahami ${audience.toLowerCase()}` : c.text,
}));

/* ---------- Jadwal tes ulang ---------- */
// stage = indeks INTERVALS yang sedang dipakai untuk jadwal berikutnya.
function schedule(topic, isFirst, pass) {
  const t = today();
  if (isFirst) return { stage: 0, next: addDays(t, INTERVALS[0]) };
  if (!pass) return { stage: topic.stage, next: addDays(t, 1) };
  const stage = Math.min(topic.stage + 1, INTERVALS.length - 1);
  return { stage, next: addDays(t, INTERVALS[stage]) };
}

function calendarLinks(topic, time) {
  const [hh, mm] = time.split(':').map(Number);
  const d = topic.next.replace(/-/g, '');
  const start = `${d}T${pad(hh)}${pad(mm)}00`;
  const endMin = hh * 60 + mm + 15;
  const end = `${d}T${pad(Math.floor(endMin / 60) % 24)}${pad(endMin % 60)}00`;
  const title = `Tes ulang ${topic.title} (Paham Beneran)`;
  const details = `Jelaskan "${topic.title}" tanpa melihat catatan, lalu cek checklist di ${location.origin}${location.pathname}`;
  const gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(details)}`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Paham Beneran//ID', 'BEGIN:VEVENT',
    `UID:${uid()}@paham-beneran`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${title}`, `DESCRIPTION:${details.replace(/,/g, '\\,')}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'TRIGGER:-PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return { gcal, ics };
}

function checkPrompt(topic, audience, note) {
  const pts = topic.points.map((p, i) => `${i + 1}. ${p.text}${p.source ? ` (sumber: ${p.source})` : ''}`).join('\n');
  return `Saya sedang belajar topik "${topic.title}"${topic.group ? ` dari materi "${topic.group}"` : ''}. Saya membuat checklist poin penting berikut dari materi kursus saya:

${pts || '(belum ada poin)'}

Tolong bantu saya:
1. Periksa apakah setiap poin di atas benar dan cukup tepat. Tandai yang keliru atau terlalu umum, dan jelaskan alasannya dengan bahasa sederhana.
2. Sebutkan poin penting yang mungkin terlewat untuk topik ini. Beri tanda bahwa saya perlu mengeceknya lagi ke materi kursus saya.
3. Jangan tuliskan penjelasan lengkap untuk saya. Saya ingin tetap berlatih menjelaskan sendiri tanpa catatan.

Kalau saya menempelkan transkrip penjelasan saya di bawah, beri feedback singkat berdasarkan kerangka ini: ${caraLabels(topic, audience).map(c => c.text.toLowerCase()).join('; ')}.${note ? `\n\nCatatan saya sendiri: ${note}` : ''}

Transkrip penjelasan saya (opsional):
`;
}

// Penjelasan tombol salin prompt, plus isi prompt untuk disalin manual kalau clipboard diblokir.
function promptHelp(text) {
  return `<details class="auto help"><summary>Apa gunanya tombol ini?</summary>
    <ol>
      <li>Tombol menyalin pesan berisi daftar poin isi materimu.</li>
      <li>Buka ChatGPT atau Claude, lalu tempel (paste) pesannya.</li>
      <li>AI akan memeriksa apakah poin-poinmu sudah benar dan apa yang mungkin terlewat. AI diminta tidak menuliskan jawaban lengkap, supaya kamu tetap berlatih sendiri.</li>
      <li>Opsional: tulis atau tempel transkrip penjelasanmu di akhir pesan untuk dapat feedback.</li>
      <li>Kalau ada poin yang keliru, perbaiki lewat tombol Ubah di halaman topik. Feedback-nya bisa disimpan di kolom Catatan.</li>
    </ol>
    <label class="lbl" for="pt">Isi pesan (bisa disalin manual)</label>
    <textarea id="pt" class="in sm" rows="5" readonly>${esc(text)}</textarea>
  </details>`;
}

/* ---------- State sementara ---------- */
let pending = null;   // hasil rekaman yang belum disimpan
let recorder = null;  // { mr, stream, ctx, raf, timer }
let lastSaved = null; // attempt id terakhir untuk layar jadwal

function stopRecorder() {
  if (!recorder) return;
  cancelAnimationFrame(recorder.raf);
  clearInterval(recorder.timer);
  try { if (recorder.mr.state !== 'inactive') recorder.mr.stop(); } catch {}
  recorder.stream.getTracks().forEach(t => t.stop());
  try { recorder.ctx && recorder.ctx.close(); } catch {}
  recorder = null;
}

/* ---------- Layar ---------- */
const app = $('#app');

async function viewHome() {
  const topics = await getAll('topics');
  const t = today();
  const due = topics.filter(x => x.next && x.next <= t).sort((a, b) => a.next.localeCompare(b.next));
  const groups = {};
  topics.slice().sort((a, b) => (a.next || '9').localeCompare(b.next || '9'))
    .forEach(x => (groups[x.group || 'Tanpa kelompok'] ||= []).push(x));
  const jam = new Date().getHours();
  const salam = jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 19 ? 'Selamat sore' : 'Selamat malam';

  let hero;
  if (due.length) {
    const first = due[0];
    hero = `<div class="hero">
      <div class="tag">${due.length > 1 ? `${due.length} topik waktunya tes ulang` : 'Tes ulang hari ini'}</div>
      <div class="ht">${esc(first.title)}</div>
      <div class="hs">${first.next < t ? relDate(first.next) : 'Jadwal hari ini'} · jelaskan tanpa melihat catatan</div>
      <button class="btn" data-go="#/rekam/${first.id}">Mulai tanpa catatan</button>
    </div>`;
  } else if (topics.length) {
    const nextOne = topics.filter(x => x.next).sort((a, b) => a.next.localeCompare(b.next))[0];
    hero = `<div class="hero"><div class="tag">Belum ada tes ulang hari ini</div>
      <div class="ht">Santai dulu</div>
      <div class="hs">${nextOne ? `Berikutnya: ${esc(nextOne.title)}, ${fmtDate(nextOne.next)} (${relDate(nextOne.next)})` : 'Rekam penjelasan pertama untuk memulai jadwal.'}</div></div>`;
  } else {
    hero = `<div class="hero"><div class="tag">Mulai dari sini</div>
      <div class="ht">Paham, atau cuma merasa paham?</div>
      <div class="hs">Buat topik, tulis poin penting dari materimu, lalu jelaskan ulang tanpa catatan. App ini mengingatkan kapan harus tes ulang.</div>
      <button class="btn" data-go="#/baru">Buat topik pertama</button></div>`;
  }

  const list = Object.entries(groups).map(([g, items]) => `
    <div class="sech"><span class="sec">${esc(g)}</span>${g !== 'Tanpa kelompok' ? `<button class="iconbtn" data-go="#/baru/${encodeURIComponent(g)}">+ Topik</button>` : ''}</div>
    ${items.map(x => {
      const isDue = x.next && x.next <= t;
      const soon = x.next && daysBetween(t, x.next) === 1;
      const pill = !x.next ? '<span class="pill">baru</span>'
        : isDue ? '<span class="pill due">hari ini</span>'
        : `<span class="pill${daysBetween(t, x.next) > 3 ? ' ok' : ''}">${relDate(x.next)}</span>`;
      return `<button class="item" data-go="#/topik/${x.id}">
        <div class="dot${isDue ? ' due' : soon ? ' soon' : ''}"></div>
        <div class="it"><b>${esc(x.title)}</b><span>${x.points.length} poin · ${x.next ? `tes berikut ${fmtDate(x.next, false)}` : 'belum direkam'}</span></div>
        ${pill}</button>`;
    }).join('')}`).join('');

  app.innerHTML = `
    <div class="top"><div><div class="hello">${salam}</div><div class="sub">${fmtDate(t)}</div></div>${FLOWER}</div>
    ${hero}
    ${topics.length ? `<div class="sec">Topik saya</div>${list}` : ''}
    <p class="foot">Data dan rekaman tersimpan di browser perangkat ini saja.</p>
    <button class="fab" data-go="#/baru">+ Topik baru</button>`;
}

async function viewEdit(id, presetGroup) {
  const topic = id ? await get('topics', id) : null;
  if (id && !topic) return go('#/');
  const all = await getAll('topics');
  const byDate = all.slice().sort((x, y) => (x.created || '').localeCompare(y.created || ''));
  const points = topic ? topic.points.map(p => ({ ...p })) : [{ text: '', source: '' }];
  const names = [...new Set(byDate.map(x => x.group).filter(Boolean))];
  // Format "Atur sendiri" yang pernah dibuat bisa dipakai lagi di topik lain.
  const saved = {};
  byDate.forEach(x => { if (x.format === 'custom' && x.formatName) saved[x.formatName] = x.cara; });

  let group = topic?.group || (presetGroup && names.includes(presetGroup) ? presetGroup : names.length === 1 ? names[0] : '');
  let isNew = !names.length || (!!topic && !topic.group);
  let title = topic?.title || '';
  // Format per topik. Topik baru mengikuti format topik terakhir di kelompok yang sama.
  const lastInGroup = g => byDate.filter(x => x.group === g).pop();
  let format, customName, custom;
  function loadFormat(src) {
    format = src?.format || (src ? 'kasus' : 'umum');
    customName = format === 'custom' ? src.formatName || '' : '';
    custom = format === 'custom' ? src.cara.map(c => ({ ...c })) : [{ text: '', hint: '' }];
  }
  loadFormat(topic || lastInGroup(group));

  function pointRows() {
    return points.map((p, i) => `<div class="pt2">
      <div class="num">${i + 1}</div>
      <div class="pf">
        <textarea class="in sm" rows="2" data-i="${i}" data-k="text" placeholder="${i === 0 ? 'Contoh: Definisi kunci: 2 unsur ILO, tidak sukarela + ancaman hukuman' : 'Poin penting berikutnya'}">${esc(p.text)}</textarea>
        <input class="in sm" data-i="${i}" data-k="source" placeholder="Sumber: modul, halaman, slide, atau link" value="${esc(p.source)}">
      </div>
      ${points.length > 1 ? `<button class="del" data-del="${i}" aria-label="Hapus poin ${i + 1}">×</button>` : ''}
    </div>`).join('');
  }
  function groupBlock() {
    return `${names.length ? `<div class="chips">${names.map(n => `<button class="chip${!isNew && n === group ? ' on' : ''}" data-g="${esc(n)}">${esc(n)}</button>`).join('')}
        <button class="chip${isNew ? ' on' : ''}" data-g="">+ Kelompok baru</button></div>` : ''}
      ${isNew ? `<input id="g" class="in" placeholder="Nama kelompok, contoh: Good Labor Practice, Bunpou N4" value="${esc(group)}">` : ''}`;
  }
  function formatBody() {
    if (format !== 'custom') {
      const f = FORMATS[format];
      return `<div class="hs">${f.desc}. Poin di format ini tetap. Kalau ingin poin sendiri, pilih "Atur sendiri".</div>
        <ol class="fl">${f.items.map(c => `<li><b>${esc(c.text)}</b><span>${esc(c.hint)}</span></li>`).join('')}</ol>`;
    }
    return `<div class="guide"><b>Contoh poin buatan sendiri</b>
        <span>Tulis kebiasaan yang ingin kamu cek di setiap penjelasan, yang bisa dijawab "ya" atau "tidak" saat mendengar ulang rekamanmu.</span>
        <span class="ok">• Mulai dari intinya</span><span class="ok">• Pakai contoh dari pekerjaan sendiri</span><span class="ok">• Selesai dalam 2 menit</span></div>
      <div class="fld"><label for="fn">Nama format</label>
        <input id="fn" class="in" placeholder="Contoh: Rumus Excel, Presentasi ke klien" value="${esc(customName)}"></div>
      ${custom.map((c, i) => `<div class="pt2">
        <div class="num">${i + 1}</div>
        <div class="pf"><input class="in sm" data-c="${i}" data-k="text" value="${esc(c.text)}" placeholder="Poin cara menjelaskan">
          <input class="in sm" data-c="${i}" data-k="hint" value="${esc(c.hint)}" placeholder="Keterangan (opsional)"></div>
        ${custom.length > 1 ? `<button class="del" data-cdel="${i}" aria-label="Hapus poin ${i + 1}">×</button>` : ''}
      </div>`).join('')}
      <button class="add" id="addc">+ Tambah poin</button>`;
  }
  function formatChips() {
    const savedChips = Object.keys(saved).filter(n => !(format === 'custom' && n === customName));
    return `<div class="chips">${Object.entries(FORMATS).filter(([k]) => k !== 'sendiri')
      .map(([k, f]) => `<button class="chip${k === format ? ' on' : ''}" data-f="${k}">${f.name}</button>`).join('')}
      ${savedChips.map(n => `<button class="chip" data-saved="${esc(n)}">${esc(n)}</button>`).join('')}
      <button class="chip${format === 'custom' ? ' on' : ''}" data-f="custom">${format === 'custom' && customName ? esc(customName) : '+ Atur sendiri'}</button></div>`;
  }

  const head = n => `<div class="bar"><button class="back" ${n === 1 ? 'data-back' : 'id="prev"'} aria-label="Kembali">‹</button>
    <span class="grow">${topic ? 'Ubah topik' : 'Topik baru'}</span><span class="stepn">Langkah ${n} dari 2</span></div>
    <div class="steps"><i class="on"></i><i${n === 2 ? ' class="on"' : ''}></i></div>`;

  const sync = () => app.querySelectorAll('[data-i]').forEach(el => { points[el.dataset.i][el.dataset.k] = el.value; });
  const syncCustom = () => {
    app.querySelectorAll('[data-c]').forEach(el => { custom[el.dataset.c][el.dataset.k] = el.value; });
    if ($('#fn')) customName = $('#fn').value;
  };

  function renderStep1() {
    app.innerHTML = `${head(1)}
      <div class="fld"><span class="lbl">Kelompok materi</span><div id="gb" style="display:flex;flex-direction:column;gap:8px">${groupBlock()}</div></div>
      <div class="fld"><label for="t">Judul topik</label>
        <input id="t" class="in" placeholder="Contoh: Forced labour" value="${esc(title)}"></div>
      <div class="grp">Isi materi <em>poin yang wajib kamu sebut</em></div>
      <div id="pts" style="display:flex;flex-direction:column;gap:10px">${pointRows()}</div>
      <button class="add" id="addpt">+ Tambah poin</button>
      <div class="tip">Ambil poin dari tujuan pembelajaran, rubrik, atau feedback ujian, jangan dari ingatan. Satu topik sebaiknya bisa dijelaskan dalam 1 sampai 3 menit. Kalau lebih, pecah jadi beberapa topik.</div>
      <button class="btn" id="next">Lanjut: cara menjelaskan</button>
      ${topic ? '<button class="btn danger sm" id="hapus">Hapus topik ini</button>' : ''}`;
    const pts = $('#pts');
    pts.onclick = e => {
      const b = e.target.closest('[data-del]');
      if (!b) return;
      sync();
      points.splice(Number(b.dataset.del), 1);
      pts.innerHTML = pointRows();
    };
    $('#addpt').onclick = () => {
      sync();
      points.push({ text: '', source: '' });
      pts.innerHTML = pointRows();
      pts.querySelector(`[data-i="${points.length - 1}"]`).focus();
    };
    $('#gb').onclick = e => {
      const b = e.target.closest('[data-g]');
      if (!b) return;
      isNew = !b.dataset.g;
      group = b.dataset.g;
      if (!topic) loadFormat(lastInGroup(group));
      $('#gb').innerHTML = groupBlock();
      if (isNew) $('#g').focus();
    };
    $('#gb').oninput = e => { if (e.target.id === 'g') group = e.target.value.trim(); };
    $('#next').onclick = () => {
      sync();
      title = $('#t').value.trim();
      if (isNew) group = ($('#g')?.value || '').trim();
      if (!title) { toast('Isi judul topik dulu.'); $('#t').focus(); return; }
      if (!points.some(p => p.text.trim())) { toast('Tambahkan minimal satu poin isi materi.'); return; }
      renderStep2();
    };
    if (topic) bindDelete();
  }

  function renderStep2() {
    app.innerHTML = `${head(2)}
      <div class="hero"><div class="tag">Cara menjelaskan</div>
        <div class="hs">Kerangka yang kamu cek setelah merekam, selain isi materi. Pilih format yang paling cocok untuk topik "${esc(title)}".</div></div>
      <div id="fc">${formatChips()}</div>
      <div id="fb" style="display:flex;flex-direction:column;gap:10px">${formatBody()}</div>
      <div class="row2"><button class="btn line" id="prev2">Kembali</button><button class="btn" id="save">Simpan topik</button></div>`;
    const redraw = () => { $('#fc').innerHTML = formatChips(); $('#fb').innerHTML = formatBody(); };
    $('#fc').onclick = e => {
      const f = e.target.closest('[data-f]'), sv = e.target.closest('[data-saved]');
      if (format === 'custom') syncCustom();
      if (sv) {
        format = 'custom';
        customName = sv.dataset.saved;
        custom = saved[customName].map(c => ({ ...c }));
      } else if (f) {
        // "+ Atur sendiri" selalu mulai dari format kosong.
        if (f.dataset.f === 'custom' && format !== 'custom') {
          customName = '';
          custom = [{ text: '', hint: '' }];
        }
        format = f.dataset.f;
      } else return;
      redraw();
    };
    $('#fb').onclick = e => {
      const d = e.target.closest('[data-cdel]');
      if (d) { syncCustom(); custom.splice(Number(d.dataset.cdel), 1); redraw(); }
      else if (e.target.id === 'addc') {
        syncCustom();
        custom.push({ text: '', hint: '' });
        redraw();
        app.querySelector(`[data-c="${custom.length - 1}"][data-k="text"]`).focus();
      }
    };
    const back = () => { if (format === 'custom') syncCustom(); renderStep1(); };
    $('#prev').onclick = back;
    $('#prev2').onclick = back;
    $('#save').onclick = save;
  }

  async function save() {
    if (format === 'custom') syncCustom();
    const clean = points.map(p => ({ text: p.text.trim(), source: p.source.trim() })).filter(p => p.text);
    let cara, formatName = '';
    if (format === 'custom') {
      cara = custom.map(c => ({ text: c.text.trim(), hint: c.hint.trim() })).filter(c => c.text);
      formatName = customName.trim();
      if (!formatName) { toast('Beri nama format dulu.'); $('#fn').focus(); return; }
      if (!cara.length) { toast('Tambahkan minimal satu poin cara menjelaskan.'); return; }
    } else {
      cara = cloneItems(format);
    }
    const base = { title, group, points: clean, format, formatName, cara };
    const data = topic ? { ...topic, ...base }
      : { id: uid(), ...base, stage: 0, next: null, created: new Date().toISOString() };
    await put('topics', data);
    toast('Topik tersimpan.');
    go(`#/topik/${data.id}`);
  }

  function bindDelete() {
    $('#hapus').onclick = async e => {
      const b = e.currentTarget;
      if (!b.dataset.sure) {
        b.dataset.sure = '1';
        b.textContent = 'Ketuk lagi untuk menghapus topik dan semua rekamannya';
        return;
      }
      for (const a of await attemptsOf(topic.id)) {
        await del('attempts', a.id);
        if (a.hasAudio) await del('audio', a.id);
      }
      await del('topics', topic.id);
      toast('Topik dihapus.');
      go('#/');
    };
  }

  renderStep1();
}

function resultList(title, labels, ticks) {
  if (!labels?.length) return '';
  return `<div class="res"><span class="lbl">${title}</span>${labels.map((l, i) => `<div class="${ticks[i] ? 'hit' : 'miss'}">
    <i>${ticks[i] ? '✓' : '✗'}</i><span>${esc(typeof l === 'string' ? l : l.text)}</span></div>`).join('')}</div>`;
}

async function viewTopic(id) {
  const topic = await get('topics', id);
  if (!topic) return go('#/');
  const atts = (await attemptsOf(id)).reverse();
  const n = atts.length;
  const label = i => (i === n - 1 ? 'Belajar awal' : `Tes ke-${n - 1 - i}`);
  const nextLabel = n === 0 ? 'Mulai belajar' : `Mulai tes ke-${n}`;

  app.innerHTML = `
    <div class="bar"><button class="back" data-go="#/" aria-label="Kembali">‹</button><span class="grow">${esc(topic.title)}</span>
      <button class="iconbtn" data-go="#/edit/${id}">Ubah</button></div>
    ${topic.next ? `<div class="nxt2"><div><span>Tes ulang berikut · ${relDate(topic.next)}</span><b>${fmtDate(topic.next)}</b></div>
      <button class="iconbtn" id="ndb">Ubah tanggal</button></div>
      <div class="att" id="ndp" hidden>
        <span class="lbl">Pindahkan tes ulang ke</span>
        <div class="chips">${[1, 3, 7].map(d => `<button class="chip" data-d="${addDays(today(), d)}">${d === 1 ? 'Besok' : `${d} hari lagi`}</button>`).join('')}</div>
        <div class="row2"><input type="date" id="nd" class="in" value="${topic.next}" min="${today()}" aria-label="Tanggal tes ulang">
          <button class="btn sm" id="nds">Simpan</button></div>
        <span class="hint">Jadwal otomatis tetap berjalan lagi setelah tes berikutnya.</span>
      </div>` : ''}
    <div class="sec">Isi materi (${topic.points.length} poin)</div>
    <details class="auto"><summary>Lihat poin <span>sebaiknya setelah tes, bukan sebelum</span></summary>
      <ol>${topic.points.map(p => `<li>${esc(p.text)}${p.source ? ` <small style="color:var(--muted)">· ${esc(p.source)}</small>` : ''}</li>`).join('')}</ol></details>
    <div class="sec">Riwayat rekaman</div>
    ${n ? atts.map((a, i) => `<details class="att"${i === 0 ? ' open' : ''}>
      <summary class="ah"><div class="at"><b>${label(i)} · ${fmtDate(a.date.slice(0, 10), false)}</b>
        <span>${a.duration ? fmtDur(a.duration) + ' · ' : ''}untuk ${esc(a.audience.toLowerCase())}</span></div>
        <div class="sp"><em>Isi ${a.isi.filter(Boolean).length}/${a.isi.length}</em><em>Cara ${a.cara.filter(Boolean).length}/${a.cara.length}</em></div>
        <span class="chev" aria-hidden="true">›</span></summary>
      ${a.hasAudio ? `<audio controls preload="none" data-audio="${a.id}"></audio>` : ''}
      ${resultList('Isi materi', a.isiLabels, a.isi)}
      ${resultList('Cara menjelaskan', a.caraLabels, a.cara)}
      ${a.note ? `<div class="note"><b>Catatan</b>${esc(a.note)}</div>` : ''}
    </details>`).join('') : '<div class="empty">Belum ada rekaman. Jelaskan topik ini tanpa catatan untuk memulai jadwal tes ulang.</div>'}
    <button class="btn ghost sm" id="cp">Salin prompt cek checklist</button>
    ${promptHelp(checkPrompt(topic, atts[0]?.audience || AUDIENCES[0], atts[0]?.note))}
    <p class="store">Rekaman tersimpan di browser perangkat ini saja</p>
    <button class="btn" data-go="#/rekam/${id}">${nextLabel}</button>`;

  // Muat audio hanya saat diputar.
  app.querySelectorAll('audio[data-audio]').forEach(el => {
    el.addEventListener('play', async function load() {
      if (el.src) return;
      const blob = await get('audio', el.dataset.audio);
      if (!blob) { toast('Rekaman tidak ditemukan di perangkat ini.'); return; }
      el.src = URL.createObjectURL(blob);
      el.play();
    }, { once: true });
  });
  $('#cp').onclick = () => copyText(checkPrompt(topic, atts[0]?.audience || AUDIENCES[0], atts[0]?.note));
  if (topic.next) {
    const move = async date => {
      if (!date) { toast('Pilih tanggal dulu.'); return; }
      topic.next = date;
      await put('topics', topic);
      toast(`Tes ulang dipindah ke ${fmtDate(date)}.`);
      viewTopic(id);
    };
    $('#ndb').onclick = () => { $('#ndp').hidden = !$('#ndp').hidden; };
    $('#ndp').onclick = e => { const c = e.target.closest('[data-d]'); if (c) move(c.dataset.d); };
    $('#nds').onclick = () => move($('#nd').value);
  }
}

async function viewRecord(id) {
  const topic = await get('topics', id);
  if (!topic) return go('#/');
  let audience = pending?.topicId === id ? pending.audience : AUDIENCES[0];
  pending = null;
  const canRecord = !window.PB_NO_LIVE_REC && !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

  app.innerHTML = `
    <div class="bar"><button class="back" data-go="#/topik/${id}" aria-label="Kembali">‹</button><span class="grow">${esc(topic.title)}</span></div>
    <div class="sec">Jelaskan untuk siapa?</div>
    <div class="chips" id="aud">${AUDIENCES.map(a => `<button class="chip${a === audience ? ' on' : ''}" data-a="${a}">${a}</button>`).join('')}</div>
    <details class="auto"><summary>Panduan cara menjelaskan <span>boleh dilihat, ini bukan isi materi</span></summary>
      <ol>${caraOf(topic).map(c => `<li><b>${esc(c.text)}</b>${c.hint ? `<br><small style="color:var(--muted)">${esc(c.hint)}</small>` : ''}</li>`).join('')}</ol></details>
    <div class="hide"><b>Catatan disembunyikan</b><span>Jelaskan dari ingatan dulu, seolah sedang bicara ke ${audience.toLowerCase()}. Checklist muncul setelah selesai.</span></div>
    <div class="recwrap">
      <div class="timer" id="tm">0:00</div>
      <div class="wave" id="wv">${'<i></i>'.repeat(20)}</div>
      ${canRecord ? '<button class="recbtn" id="rb" aria-label="Mulai rekam"><div class="ic"></div></button>' : ''}
      <div class="hint" id="hn">${canRecord ? 'Ketuk untuk mulai merekam' : 'Rekam penjelasanmu dengan aplikasi perekam, lalu pilih file rekamannya di sini.'}</div>
      <div id="er"></div>
    </div>
    <label class="btn line sm" for="up">${canRecord ? 'Atau pakai rekaman dari HP' : 'Rekam dengan aplikasi perekam HP'}</label>
    <input type="file" id="up" accept="audio/*" capture hidden>
    <button class="btn ghost" id="fin" ${canRecord ? 'disabled' : ''}>Selesai, putar ulang</button>
    <button class="btn line sm" id="skip">Jelaskan tanpa rekaman</button>`;

  $('#aud').onclick = e => {
    const b = e.target.closest('[data-a]');
    if (!b || recorder) return;
    audience = b.dataset.a;
    app.querySelectorAll('#aud .chip').forEach(c => c.classList.toggle('on', c === b));
    app.querySelector('.hide span').textContent = `Jelaskan dari ingatan dulu, seolah sedang bicara ke ${audience.toLowerCase()}. Checklist muncul setelah selesai.`;
  };
  $('#skip').onclick = () => {
    stopRecorder();
    pending = { topicId: id, audience, blob: null, duration: 0 };
    go('#/cek');
  };
  const fin = $('#fin'), tm = $('#tm'), hn = $('#hn');
  let chunks = [], started = 0, result = null;
  $('#up').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    stopRecorder();
    const probe = new Audio(URL.createObjectURL(file));
    probe.onloadedmetadata = () => {
      const d = isFinite(probe.duration) ? probe.duration : 0;
      result = { blob: file, duration: d };
      tm.textContent = fmtDur(d);
      URL.revokeObjectURL(probe.src);
    };
    result = { blob: file, duration: 0 };
    fin.disabled = false;
    hn.textContent = `Rekaman "${file.name}" siap.`;
  };
  fin.onclick = () => {
    if (!result) return;
    pending = { topicId: id, audience, ...result };
    go('#/cek');
  };
  if (!canRecord) return;

  const rb = $('#rb');
  const bars = [...app.querySelectorAll('#wv i')];

  rb.onclick = async () => {
    if (recorder) { // berhenti
      const mr = recorder.mr;
      const dur = (Date.now() - started) / 1000;
      mr.onstop = () => {
        result = { blob: new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), duration: dur };
        fin.disabled = false;
        hn.textContent = 'Rekaman siap. Ketuk lagi untuk mengulang dari awal.';
      };
      stopRecorder();
      rb.classList.remove('on');
      bars.forEach(b => (b.style.height = '6px'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported?.(t));
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks = []; result = null; fin.disabled = true;
      mr.ondataavailable = e => e.data.size && chunks.push(e.data);
      mr.start(1000);
      started = Date.now();
      recorder = { mr, stream };
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const an = ctx.createAnalyser();
        an.fftSize = 64;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        const draw = () => {
          an.getByteFrequencyData(buf);
          bars.forEach((b, i) => (b.style.height = `${6 + (buf[i + 1] / 255) * 44}px`));
          if (recorder) recorder.raf = requestAnimationFrame(draw);
        };
        recorder.ctx = ctx;
        draw();
      } catch { /* visual saja, abaikan */ }
      recorder.timer = setInterval(() => { tm.textContent = fmtDur((Date.now() - started) / 1000); }, 250);
      rb.classList.add('on');
      rb.setAttribute('aria-label', 'Berhenti merekam');
      hn.textContent = 'Merekam... ketuk untuk berhenti';
      $('#er').innerHTML = '';
    } catch (err) {
      $('#er').innerHTML = `<div class="err">Mikrofon tidak bisa dipakai (${esc(err.name || 'error')}). Izinkan akses mikrofon di pengaturan browser, atau pilih "Jelaskan tanpa rekaman".</div>`;
    }
  };
}

async function viewCheck() {
  if (!pending) return go('#/');
  const topic = await get('topics', pending.topicId);
  if (!topic) return go('#/');
  const prev = await attemptsOf(topic.id);
  const cara = caraLabels(topic, pending.audience);
  const isi = topic.points.map(() => false);
  const caraOn = cara.map(() => false);
  const url = pending.blob ? URL.createObjectURL(pending.blob) : null;

  const rows = (arr, on, key) => arr.map((p, i) => `<button class="ck${on[i] ? ' on' : ''}" data-k="${key}" data-i="${i}" aria-pressed="${on[i]}">
    <span class="box">${on[i] ? '✓' : ''}</span>
    <div><b>${esc(p.text)}</b>${p.source ? `<small>${esc(p.source)}</small>` : ''}${p.hint ? `<small>${esc(p.hint)}</small>` : ''}</div></button>`).join('');
  const draw = () => {
    $('#isi').innerHTML = rows(topic.points, isi, 'isi');
    $('#cara').innerHTML = rows(cara, caraOn, 'cara');
    $('#si').innerHTML = `${isi.filter(Boolean).length}<small>/${isi.length}</small>`;
    $('#sc').innerHTML = `${caraOn.filter(Boolean).length}<small>/${caraOn.length}</small>`;
  };

  app.innerHTML = `
    <div class="bar"><button class="back" data-go="#/rekam/${topic.id}" aria-label="Rekam ulang">‹</button><span class="grow">Cek penjelasanmu</span></div>
    ${url ? `<audio controls src="${url}"></audio><div class="tip">Putar ulang rekamanmu, lalu centang poin yang benar-benar kamu sebut. Jujur saja, ini untuk kamu sendiri.</div>` : '<div class="tip">Tanpa rekaman: centang poin yang tadi benar-benar kamu sebut dari ingatan.</div>'}
    <div class="scores"><div class="sc"><div class="big" id="si"></div><span>Isi materi</span></div>
      <div class="sc"><div class="big" id="sc"></div><span>Cara menjelaskan</span></div></div>
    <div class="grp">Isi materi <em>poin dari topik ini</em></div>
    <div id="isi" style="display:flex;flex-direction:column;gap:8px"></div>
    <div class="grp">Cara menjelaskan <em>format ${topic.format === 'custom' ? esc(topic.formatName) : FORMATS[topic.format]?.name || 'Studi kasus'}</em></div>
    <div id="cara" style="display:flex;flex-direction:column;gap:8px"></div>
    <div class="fld"><label for="nt">Catatan (opsional)</label>
      <textarea id="nt" class="in" rows="3" placeholder="Apa yang terlewat atau keliru? Bisa juga tempel feedback dari ChatGPT/Claude."></textarea></div>
    <button class="btn ghost sm" id="cp">Salin prompt cek checklist</button>
    ${promptHelp(checkPrompt(topic, pending.audience, ''))}
    <button class="btn" id="sv">Simpan & lihat jadwal</button>`;
  draw();

  const onTick = e => {
    const b = e.target.closest('.ck');
    if (!b) return;
    const arr = b.dataset.k === 'isi' ? isi : caraOn;
    arr[b.dataset.i] = !arr[b.dataset.i];
    draw();
  };
  $('#isi').onclick = onTick;
  $('#cara').onclick = onTick;
  $('#cp').onclick = () => copyText(checkPrompt(topic, pending.audience, $('#nt').value.trim()));
  $('#sv').onclick = async () => {
    const isFirst = prev.length === 0;
    const pass = isi.every(Boolean);
    const att = {
      id: uid(), topicId: topic.id, date: new Date().toISOString(), audience: pending.audience,
      duration: Math.round(pending.duration || 0), isi: [...isi], cara: [...caraOn],
      isiLabels: topic.points.map(p => p.text), caraLabels: cara.map(c => c.text),
      missed: topic.points.filter((_, i) => !isi[i]).map(p => p.text),
      note: $('#nt').value.trim(), hasAudio: !!pending.blob, first: isFirst, pass,
    };
    if (pending.blob) await put('audio', pending.blob, att.id);
    await put('attempts', att);
    Object.assign(topic, schedule(topic, isFirst, pass));
    await put('topics', topic);
    if (url) URL.revokeObjectURL(url);
    pending = null;
    lastSaved = att.id;
    go(`#/jadwal/${topic.id}`);
  };
}

async function viewSchedule(id) {
  const topic = await get('topics', id);
  if (!topic) return go('#/');
  const atts = await attemptsOf(id);
  const last = atts.find(a => a.id === lastSaved) || atts[atts.length - 1];
  if (!last) return go(`#/topik/${id}`);
  const t = today();
  let time = '19:00';

  // Garis waktu: jeda yang sudah lewat, jadwal berikut, lalu perkiraan sisanya.
  let cursor = topic.next;
  const tl = INTERVALS.map((d, i) => {
    if (i < topic.stage) return `<div class="tli ok"><i></i><b>Jeda ${d} hari</b><span>selesai</span></div>`;
    if (i === topic.stage) return `<div class="tli now"><i></i><b>Jeda ${d} hari</b><span>${fmtDate(topic.next)}${daysBetween(t, topic.next) === 1 && !last.pass && !last.first ? ' · diulang besok' : ''}</span></div>`;
    cursor = addDays(cursor, d);
    return `<div class="tli"><i></i><b>Jeda ${d} hari</b><span>perkiraan ${fmtDate(cursor, false)}</span></div>`;
  }).join('');

  const msg = last.first ? 'Langkah pertama selesai. Besok coba jelaskan lagi tanpa catatan.'
    : last.pass ? 'Semua poin isi materi kamu sebut. Jeda berikutnya lebih panjang.'
    : 'Masih ada poin isi materi yang terlewat, jadi tes diulang besok dengan jeda yang sama.';

  app.innerHTML = `
    <div class="bar"><button class="back" data-go="#/topik/${id}" aria-label="Kembali">‹</button><span class="grow">Selesai</span></div>
    <div class="done">${FLOWER}<b>${last.hasAudio ? 'Rekaman tersimpan' : 'Hasil tersimpan'}</b>
      <span>Isi ${last.isi.filter(Boolean).length}/${last.isi.length} · Cara ${last.cara.filter(Boolean).length}/${last.cara.length}</span></div>
    <div class="tip">${msg}</div>
    ${last.missed.length ? `<div class="note"><b>Terlewat</b>${esc(last.missed.join('; '))}</div>` : ''}
    <div class="grp">Jadwal tes ulang <em>tanpa lihat catatan</em></div>
    <div class="tl">${tl}</div>
    <div class="fld"><label for="jm">Jam pengingat</label><select id="jm" class="in">${
      Array.from({ length: 35 }, (_, k) => `${pad(5 + Math.floor(k / 2))}:${k % 2 ? '30' : '00'}`)
        .map(v => `<option${v === time ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
    <a class="btn" id="gc" target="_blank" rel="noopener">Tambah ke Google Calendar</a>
    <button class="btn ghost sm" id="ics">Unduh pengingat (.ics)</button>
    <button class="btn line sm" data-go="#/">Kembali ke beranda</button>`;

  const refresh = () => { $('#gc').href = calendarLinks(topic, time).gcal; };
  refresh();
  $('#jm').onchange = e => { time = e.target.value || '19:00'; refresh(); };
  $('#ics').onclick = async () => {
    const ics = calendarLinks(topic, time).ics;
    const filename = `tes-ulang-${topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
    const downloads = window.claude?.use ? await window.claude.use('downloads').catch(() => null) : null;
    if (downloads) {
      try { await downloads.save({ filename, data: ics }); } catch { toast('Unduhan dibatalkan.'); }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
}

/* ---------- Router ---------- */
async function route() {
  const [, page, id] = (location.hash || '#/').split('/');
  if (page !== 'rekam') stopRecorder();
  window.scrollTo(0, 0);
  try {
    if (page === 'baru') await viewEdit(null, id ? decodeURIComponent(id) : null);
    else if (page === 'edit') await viewEdit(id);
    else if (page === 'topik') await viewTopic(id);
    else if (page === 'rekam') await viewRecord(id);
    else if (page === 'cek') await viewCheck();
    else if (page === 'jadwal') await viewSchedule(id);
    else await viewHome();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="err">Terjadi kesalahan: ${esc(err.message)}. Coba muat ulang halaman.</div>
      <button class="btn" data-go="#/">Ke beranda</button>`;
  }
}

document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); return; }
  if (e.target.closest('[data-back]')) history.back();
});
window.addEventListener('hashchange', route);
navigator.storage?.persist?.().catch(() => {});
route();
