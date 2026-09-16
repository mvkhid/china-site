
  // ── Privacy modal ──
  function openPrivacy(){
    document.getElementById('privacy-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closePrivacy(){
    document.getElementById('privacy-modal').classList.remove('show');
    document.body.style.overflow = '';
  }
  // ── Lightbox ──
  function openLightbox(card){
    const shot = card.querySelector('.proof-shot');
    const cap = card.querySelector('.proof-cap');
    const body = document.getElementById('lightbox-body');
    const capEl = document.getElementById('lightbox-caption');

    // Если внутри shot есть img — берём его, иначе placeholder
    const img = shot.querySelector('img');
    if(img){
      body.innerHTML = '<img src="'+img.src+'" alt="">';
    } else {
      body.innerHTML = '<div class="lightbox-placeholder">'+ (shot.textContent.trim() || 'скрин') +'</div>';
    }
    capEl.innerHTML = cap.innerHTML;
    document.getElementById('lightbox').classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox(){
    document.getElementById('lightbox').classList.remove('show');
    document.body.style.overflow = '';
  }

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape'){
      closePrivacy();
      closeLightbox();
    }
  });

  // ── Калькулятор ──
  const TG = "https://t.me/mvkhid";
  const RATE_API = "https://reseller-rate-worker.mgmdgdjiev1.workers.dev/rate";
  // Фолбэк на случай сбоя запроса к RATE_API — реальный курс приходит из воркера (см. loadLiveRate)
  let tiers = [
    {threshold:1, rate:11.75},
    {threshold:1000, rate:11.60},
    {threshold:30000, rate:11.55}
  ];
  let dir = "rub-to-cny"; // по умолчанию рубли → юани (упор на рубль)
  const amountEl = () => document.getElementById('amount');
  const resultEl = () => document.getElementById('result');

  const fmt = (n,d=2)=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
  const fmtInt = n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n);

  function pickTier(cny){let c=tiers[0];for(const t of tiers)if(cny>=t.threshold)c=t;return c;}

  function calc(){
    const a = amountEl(); const r = resultEl();
    if(!a||!r) return;
    const v = parseFloat((a.value||'0').replace(',','.'))||0;
    // сумма в юанях для выбора ступени
    const cny = dir==='cny-to-rub' ? v : v/tiers[0].rate;
    const active = pickTier(cny);
    const rate = active.rate;
    const out = dir==='cny-to-rub' ? v*rate : v/rate;
    r.textContent = fmt(out);

    document.querySelectorAll('.tier').forEach(el=>{
      const th = el.querySelector('.tier-from').textContent.replace(/[^0-9]/g,'');
      el.classList.toggle('tier-active', parseInt(th||'1')===active.threshold);
    });

    let info = `Применён курс <span class="mono">${fmt(rate)} ₽</span> за 1¥`;
    if(active.threshold>1) info += ` · ступень от ${fmtInt(active.threshold)}¥`;
    const ai=document.getElementById('active-info'); if(ai) ai.innerHTML=info;

    const next = tiers.find(t=>t.threshold>cny);
    const up=document.getElementById('upsell');
    if(up){ if(next && cny>0){up.style.display='';up.innerHTML=`от ${fmtInt(next.threshold)}¥ выгоднее — <span class="mono">${fmt(next.rate)} ₽</span>`;} else up.style.display='none'; }

    // ссылка в телеграм с реальной суммой
    const btn=document.getElementById('order-btn');
    if(btn){
      const give = dir==='cny-to-rub' ? `${fmtInt(v)}¥` : `${fmtInt(v)}₽`;
      const get  = dir==='cny-to-rub' ? `${fmt(out)}₽` : `${fmt(out)}¥`;
      const msg = `Здравствуйте! Нужна оплата ${give} → ${get} по курсу ${fmt(rate)}`;
      btn.href = `${TG}?text=${encodeURIComponent(msg)}`;
    }
  }

  function swapDir(){
    dir = dir==='cny-to-rub' ? 'rub-to-cny' : 'cny-to-rub';
    const fl=document.querySelector('.calc .field:first-child .field-label');
    const tl=document.querySelector('.calc .field:last-child .field-label');
    const fc=document.getElementById('from-cur');
    const tc=document.getElementById('to-cur');
    if(dir==='cny-to-rub'){
      fl.textContent='Отдаёте · Юани'; tl.textContent='Получаете · Рубли';
      fc.textContent='¥'; tc.textContent='₽';
    } else {
      fl.textContent='Отдаёте · Рубли'; tl.textContent='Получаете · Юани';
      fc.textContent='₽'; tc.textContent='¥';
    }
    calc();
  }

  // В Next.js этот скрипт грузится через <Script strategy="afterInteractive">,
  // то есть ПОСЛЕ того как DOMContentLoaded уже сработал — обычный addEventListener
  // на это событие тут никогда не выстрелит. Поэтому проверяем readyState и, если
  // документ уже готов, запускаем инициализацию сразу.
  function onDomReady(fn){
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onDomReady(()=>{
    const a=amountEl();
    if(a){ a.addEventListener('input', e=>{ e.target.value=e.target.value.replace(/[^0-9.,]/g,''); calc(); flashResult(); }); }
    calc();
    setupReveal();
    setupCounters();
    setupButtonBlob();
    setupFaq();
    loadLiveRate();
    setInterval(loadLiveRate, 5*60*1000);
  });

  // ── Живой курс из Cloudflare Worker (RATE_KV, обновляется cron'ом каждые 15 мин) ──
  const MONTHS_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

  function formatDateShort(iso){
    const d = new Date(iso);
    const day = new Intl.DateTimeFormat('ru-RU', {day:'2-digit', timeZone:'Europe/Moscow'}).format(d);
    const month = new Intl.DateTimeFormat('ru-RU', {month:'2-digit', timeZone:'Europe/Moscow'}).format(d);
    return `${day}.${month}`;
  }
  function formatDateLong(iso){
    const d = new Date(iso);
    const day = parseInt(new Intl.DateTimeFormat('ru-RU', {day:'numeric', timeZone:'Europe/Moscow'}).format(d), 10);
    const monthIdx = parseInt(new Intl.DateTimeFormat('ru-RU', {month:'numeric', timeZone:'Europe/Moscow'}).format(d), 10) - 1;
    const time = new Intl.DateTimeFormat('ru-RU', {hour:'2-digit', minute:'2-digit', timeZone:'Europe/Moscow', hour12:false}).format(d);
    return `${day} ${MONTHS_GEN[monthIdx]} в ${time}`;
  }

  async function loadLiveRate(){
    try{
      const res = await fetch(RATE_API, {cache:'no-store'});
      if(!res.ok) throw new Error('bad status '+res.status);
      const data = await res.json();
      if(!Array.isArray(data.tiers) || data.tiers.length!==3) throw new Error('bad shape');

      tiers = data.tiers.slice().sort((x,y)=>x.threshold-y.threshold);

      const tierEls = document.querySelectorAll('.tiers .tier');
      tiers.forEach((t,i)=>{
        const el = tierEls[i];
        if(!el) return;
        const from = el.querySelector('.tier-from');
        const rateEl = el.querySelector('.tier-rate');
        if(from) from.textContent = t.threshold===1 ? 'от 1¥' : `от ${fmtInt(t.threshold)}¥`;
        if(rateEl) rateEl.textContent = `${fmt(t.rate)} ₽`;
      });

      const label = document.querySelector('.tiers-label');
      if(label) label.textContent = `Курс безналичного обмена · ${formatDateShort(data.publishedAt)}`;

      const updated = document.querySelector('.updated');
      if(updated) updated.innerHTML = `<span class="updated-dot"></span> обновлено · ${formatDateLong(data.updatedAt)}`;

      calc();
    } catch(e){
      console.warn('[rate] не удалось получить живой курс, использую фолбэк:', e.message);
    }
  }

  // ── FAQ accordion: плавное открытие, при открытии нового остальные закрываются ──
  function setupFaq(){
    const items = document.querySelectorAll('.faq-item');
    items.forEach(item => {
      const q = item.querySelector('.faq-q');
      if(!q) return;
      q.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        items.forEach(i => i.classList.remove('open'));
        if(!isOpen) item.classList.add('open');
      });
    });
  }

  // ── Появление при скролле (reveal) с разными типами ──
  function setupReveal(){
    // Назначаем разные типы анимаций разным группам элементов
    const animMap = [
      // селектор, тип анимации
      ['.hero-eyebrow-row',                'reveal reveal-left'],
      ['.hero-title .title-line',          'reveal reveal-up'],
      ['.hero-title .title-accent',        'reveal reveal-scale'],
      ['.title-sub',                       'reveal reveal-up'],
      ['.hero-lead',                       'reveal reveal-up'],
      ['.hero-actions',                    'reveal reveal-up'],
      ['.badge',                           'reveal reveal-right'],
      ['.hsvc',                            'reveal reveal-right'],
      ['.sec-head',                        'reveal reveal-left'],
      ['.calc-wrap',                       'reveal reveal-scale'],
      ['.ms-cell',                         'reveal reveal-up'],
      ['.about-photo',                     'reveal reveal-scale'],
      ['.about-text',                      'reveal reveal-left'],
      ['.principle',                       'reveal reveal-right'],
      ['.uc-item',                         'reveal reveal-scale'],
      ['.si-step',                         'reveal reveal-up'],
      ['.shot-card, .review-card',         'reveal reveal-scale'],
      ['.check-card',                      'reveal reveal-up'],
      ['.step',                            'reveal reveal-up'],
      ['.info-card',                       'reveal reveal-blur'],
      ['.schedule-card',                   'reveal reveal-scale'],
      ['.contact-card',                    'reveal reveal-up'],
      ['.quote-card',                      'reveal reveal-blur'],
      ['.about-lead',                      'reveal reveal-up'],
      ['.hero-hint',                       'reveal reveal-up'],
      ['.si-link',                         'reveal reveal-up'],
      ['.how-note',                        'reveal reveal-up'],
    ];

    const all = new Set();
    animMap.forEach(([sel, classes]) => {
      document.querySelectorAll(sel).forEach((el, i) => {
        // Не перетираем если уже назначен другой тип
        if (el.classList.contains('reveal')) return;
        classes.split(' ').forEach(c => el.classList.add(c));
        // Каскад внутри одинаковых групп (если >1 элементов)
        const siblings = el.parentElement?.querySelectorAll(sel);
        if (siblings && siblings.length > 1) {
          const idx = Array.from(siblings).indexOf(el);
          el.style.transitionDelay = (idx * 0.08) + 's';
        }
        all.add(el);
      });
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, {threshold: 0.12, rootMargin: '0px 0px -40px 0px'});
    all.forEach(el => io.observe(el));
  }

  // ── Blob-эффект (свечение под курсором) на primary-кнопках и тарифах ──
  function setupButtonBlob(){
    document.querySelectorAll('.btn-primary, .tier').forEach(el => {
      let rafId = null;
      el.addEventListener('mousemove', (e) => {
        // Throttle через requestAnimationFrame — макс 60 раз/сек, не чаще
        if(rafId) return;
        rafId = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
          el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
          rafId = null;
        });
      }, { passive: true });
    });
  }

  // ── Pause marquee когда вне экрана (экономим GPU) ──
  function setupMarqueePause(){
    const marquee = document.getElementById('proof-marquee');
    if(!marquee) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if(e.isIntersecting) marquee.classList.add('visible');
        else marquee.classList.remove('visible');
      });
    }, { threshold: 0.05 });
    io.observe(marquee);
    marquee.classList.add('visible'); // если уже виден сразу
  }
  setupMarqueePause();

  // ── Счётчик цифр (накручивание) ──
  function animateCounter(el, target, suffix, isFloat){
    window.animateCounter = animateCounter;
    const duration = 1400;
    const start = performance.now();
    function tick(now){
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const v = target * eased;
      el.textContent = (isFloat ? v.toFixed(2).replace('.', ',') : Math.round(v)) + suffix;
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = (isFloat ? target.toFixed(2).replace('.', ',') : target) + suffix;
    }
    requestAnimationFrame(tick);
  }
  function setupCounters(){
    // мини-статы: "4 года" — анимируем число, текст оставляем
    document.querySelectorAll('.ms-num').forEach(el => {
      const txt = el.textContent.trim();
      const m = txt.match(/^([\d.,]+)\s*(.*)$/);
      if (m) {
        const num = parseFloat(m[1].replace(',', '.'));
        if (!isNaN(num) && num > 0) {
          el.dataset.target = num;
          el.dataset.suffix = m[2] ? ' ' + m[2] : '';
          el.dataset.float = '0';
          el.textContent = '0' + (m[2] ? ' ' + m[2] : '');
        }
      }
    });
    // курс в hero-badge
    const badgeRate = document.querySelector('.badge-amount.mono');
    if (badgeRate) {
      const num = parseFloat(badgeRate.textContent.replace(',', '.'));
      if (!isNaN(num)) {
        badgeRate.dataset.target = num;
        badgeRate.dataset.suffix = '';
        badgeRate.dataset.float = '1';
        badgeRate.textContent = '0,00';
      }
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting && en.target.dataset.target && !en.target.dataset.animated) {
          en.target.dataset.animated = '1';
          animateCounter(
            en.target,
            parseFloat(en.target.dataset.target),
            en.target.dataset.suffix || '',
            en.target.dataset.float === '1'
          );
          io.unobserve(en.target);
        }
      });
    }, {threshold: 0.5});
    document.querySelectorAll('[data-target]').forEach(el => io.observe(el));
  }

  // ── Вспышка цифры результата при пересчёте ──
  let flashT;
  function flashResult(){
    const r=resultEl(); if(!r) return;
    r.style.transition = 'none';
    r.style.color = '#7fe3ee';
    void r.offsetWidth;
    r.style.transition = 'color 0.4s ease-out';
    r.style.color = '';
  }


  function showPage(name, btn){
    const page = document.getElementById('page-'+name);
    if(!page){ console.warn('No page:', name); return; }
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('show'));
    page.classList.add('show');
    document.querySelectorAll('.demo-switch button').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    else {
      const map={home:0,how:1,contacts:2};
      const idx = map[name];
      const btns = document.querySelectorAll('.demo-switch button');
      if(idx!==undefined && btns[idx]) btns[idx].classList.add('active');
    }
    document.querySelectorAll('nav a').forEach(a=>a.classList.remove('active'));
    const navMap={home:'.nav-home',how:'.nav-how',contacts:'.nav-contacts'};
    if(navMap[name]){
      const nl=document.querySelector(navMap[name]);
      if(nl) nl.classList.add('active');
    }
    // Ссылка "Публичная оферта" в футере — обычная навигация на отдельную
    // страницу нужного документа, адрес подстраивается под активную страницу.
    const ofertaLink = document.getElementById('oferta-link');
    if(ofertaLink) ofertaLink.href = name === 'how' ? '/oferta-raschety' : '/oferta';
    window.scrollTo({top:0});
    // показать reveal-блоки активной страницы
    setTimeout(()=>{
      document.querySelectorAll('#page-'+name+' .reveal').forEach(el=>el.classList.add('in'));
      document.querySelectorAll('#page-'+name+' [data-target]:not([data-animated])').forEach(el=>{
        el.dataset.animated = '1';
        if(window.animateCounter){
          window.animateCounter(el, parseFloat(el.dataset.target), el.dataset.suffix||'', el.dataset.float==='1');
        }
      });
    }, 50);
  }

