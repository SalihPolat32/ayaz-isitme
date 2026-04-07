(function () {
  // Footer year
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Theme (Bootstrap 5.3 data-bs-theme)
  var root = document.documentElement;
  var toggleBtn = document.getElementById('themeToggle');

  function preferredTheme() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function applyTheme(theme) {
    root.setAttribute('data-bs-theme', theme);
    try { localStorage.setItem('theme', theme); } catch (e) {}
    var icon = toggleBtn ? toggleBtn.querySelector('i') : null;
    if (icon) icon.className = (theme === 'dark') ? 'bi bi-sun' : 'bi bi-moon-stars';
  }

  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  applyTheme(saved || preferredTheme());

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      var current = root.getAttribute('data-bs-theme') || 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Swiper init
    if (typeof Swiper !== 'undefined') {
      new Swiper('.ky-swiper', {
        loop: true,
        effect: 'fade',
        fadeEffect: { crossFade: true },
        speed: 700,
        autoplay: { delay: 3800, disableOnInteraction: false },
        slidesPerView: 1,
        spaceBetween: 0,
        pagination: { el: '.ky-swiper .swiper-pagination', clickable: true },
        navigation: { nextEl: '.ky-swiper .swiper-button-next', prevEl: '.ky-swiper .swiper-button-prev' }
      });

      new Swiper('.ofis-swiper', {
        loop: true,
        speed: 650,
        autoplay: { delay: 4200, disableOnInteraction: false },
        slidesPerView: 1,
        spaceBetween: 16,
        pagination: { el: '.ofis-swiper .swiper-pagination', clickable: true },
        navigation: { nextEl: '.ofis-swiper .swiper-button-next', prevEl: '.ofis-swiper .swiper-button-prev' }
      });
    }

    // Ofis Lightbox
    var lb = document.getElementById('ofisLightbox');
    var lbImg = lb ? lb.querySelector('.ofis-lightbox__img') : null;
    var lbClose = lb ? lb.querySelector('.ofis-lightbox__close') : null;

    function openLb(src) {
      if (!lb || !lbImg) return;
      lbImg.src = src;
      lb.classList.add('is-open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.classList.add('ofis-lightbox-open');
    }
    function closeLb() {
      if (!lb || !lbImg) return;
      lb.classList.remove('is-open');
      lb.setAttribute('aria-hidden', 'true');
      lbImg.src = '';
      document.body.classList.remove('ofis-lightbox-open');
    }

    document.addEventListener('click', function (e) {
      var img = e.target.closest && e.target.closest('.ofis-swiper img');
      if (img) {
        e.preventDefault();
        openLb(img.getAttribute('src'));
        return;
      }
      if (!lb) return;
      if (e.target === lb || (lbClose && e.target === lbClose) || (e.target && e.target.classList && e.target.classList.contains('ofis-lightbox__close'))) {
        closeLb();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLb();
    });

    // Özellikler içerikleri
    var OZ_CONTENT = {
      "alpha-xt": {
        1: `
          <ul class="oz-list">
            <li><strong>Gürültüde konuşma netliği:</strong> Kalabalık ve zor ortamlarda konuşmayı daha anlaşılır kılmayı hedefler.</li>
            <li><strong>Hybrid Technology:</strong> Konuşma anlaşılırlığı ve dinleme konforunu birlikte optimize eder.</li>
            <li><strong>Rüzgar/temas gürültüsüne koruma:</strong> Rahatsız edici gürültüyü azaltmaya odaklanır.</li>
            <li><strong>Daha temiz sinyal:</strong> Erken aşamada sinyali temizleyip daha stabil dinleme hedefler.</li>
            <li><strong>Müzikte daha zengin deneyim:</strong> Özel ayar/deneyim ile daha dolgun müzik hedefi.</li>
            <li><strong>Uygulama + uzaktan destek:</strong> Mobil uygulama ile kontrol; uzaktan ince ayar/destek.</li>
            <li><strong>Seviye seçenekleri:</strong> 9 / 7 / 5 performans seviyeleri.</li>
          </ul>
        `,
        2: `
          <ul class="oz-list">
            <li><strong>24 bant gürültü yönetimi:</strong> Yüksek çözünürlüklü analiz.</li>
            <li><strong>Gerçek zamanlı işleme:</strong> Anlık adaptasyon.</li>
            <li><strong>Feedback kontrolü:</strong> Hızlı bastırma.</li>
            <li><strong>Kablosuz bağlantı:</strong> Bluetooth ses akışı.</li>
            <li><strong>Dayanıklılık:</strong> Toz/nem/su koruması.</li>
            <li><strong>Tinnitus desteği:</strong> Uygun modellerde.</li>
          </ul>
        `
      },

      "alpha-platform": {
        1: `
          <ul class="oz-list">
            <li><strong>Gürültüde konuşma netliği:</strong> Kalabalık ortamlarda konuşmayı daha anlaşılır kılmayı hedefler.</li>
            <li><strong>Hybrid Technology:</strong> Konuşma anlaşılırlığı ve konfor dengesini optimize eder.</li>
            <li><strong>Daha az dinleme eforu:</strong> Gürültüyü erken aşamada kontrol ederek dengeli dinleme sunar.</li>
            <li><strong>Doğal ses:</strong> Gün boyu konforlu kullanım hedefi.</li>
            <li><strong>Müzik:</strong> Özel müzik ayarları.</li>
            <li><strong>Uygulama ile kontrol:</strong> Mobil uygulama üzerinden kişiselleştirme.</li>
            <li><strong>Kablosuz akış:</strong> Telefon ve medya sesi aktarımı.</li>
          </ul>
        `,
        2: `
          <ul class="oz-list">
            <li><strong>Çok bantlı analiz:</strong> Ortam koşullarına adaptasyon.</li>
            <li><strong>Gerçek zamanlı sinyal işleme:</strong> Anlık ayarlama.</li>
            <li><strong>Feedback kontrolü:</strong> Islık riskini azaltma.</li>
            <li><strong>Bluetooth ekosistem:</strong> Aksesuar desteği (modele göre).</li>
            <li><strong>Telecoil (T-coil):</strong> Loop sistem uyumu (modele göre).</li>
            <li><strong>Şarjlı / pilli seçenekler:</strong> Modele göre.</li>
            <li><strong>Dayanıklılık:</strong> Toz/nem/su koruması.</li>
            <li><strong>Tinnitus desteği:</strong> Uygun modellerde.</li>
          </ul>
        `
      },

      "encanta": {
        1: `
          <ul class="oz-list">
            <li><strong>Konuşmayı öne çıkaran netlik:</strong> Günlük sohbetlerde daha anlaşılır iletişim.</li>
            <li><strong>Gürültüde kontrollü dinleme:</strong> Kalabalık ortamlarda konuşmaya odaklanmayı destekler.</li>
            <li><strong>Doğal ve dengeli ses:</strong> Uzun kullanımda konfor hedefi.</li>
            <li><strong>4 performans seviyesi (100–400):</strong> İhtiyaca göre kademeli çözüm.</li>
            <li><strong>Telefon ve medya akışı:</strong> Uyumluluğa bağlı.</li>
            <li><strong>Hızlı şarj / gün boyu kullanım:</strong> Şarj edilebilir modellerde.</li>
            <li><strong>Uygulama ile kontrol:</strong> Ses/program yönetimi ve kişiselleştirme.</li>
          </ul>
        `,
        2: `
          <ul class="oz-list">
            <li><strong>Bluetooth bağlantı:</strong> Kablosuz ses aktarımı (uyumluluğa bağlı).</li>
            <li><strong>Bluetooth LE Audio / Auracast:</strong> Destekleyen modellerde.</li>
            <li><strong>Hands-free görüşme:</strong> Uyumlu cihazlarda (modele göre).</li>
            <li><strong>IP68:</strong> Destekleyen modellerde su/nem/toza dayanıklılık.</li>
            <li><strong>Telecoil (T-coil):</strong> Destekleyen modellerde.</li>
          </ul>
        `
      },

      "viron": {
        1: `
          <ul class="oz-list">
            <li><strong>Doğal ses hedefi:</strong> Ortamı algılayıp dengeli işleme.</li>
            <li><strong>Gürültüde konuşmaya odak:</strong> Dinamik ortamlarda anlaşılırlık desteği.</li>
            <li><strong>Güçlü BTE form:</strong> Orta–çok ileri kayıplar için.</li>
            <li><strong>Telefon/medya akışı:</strong> Uyumluluğa bağlı.</li>
            <li><strong>Kolay kontrol:</strong> Tuşlar veya uygulama ile.</li>
            <li><strong>Pil:</strong> Kullanıma göre değişen süre.</li>
            <li><strong>Tinnitus desteği:</strong> Uygun ayarlarda.</li>
          </ul>
        `,
        2: `
          <ul class="oz-list">
            <li><strong>DECS™ yaklaşımı:</strong> Gerçek zamanlı algılama + işleme.</li>
            <li><strong>2.4 GHz BLE + NFMI:</strong> Kablosuz altyapı.</li>
            <li><strong>Pil tipi:</strong> 13 numara tek kullanımlık pil.</li>
            <li><strong>Telecoil (T-coil):</strong> Modele göre.</li>
            <li><strong>IP68 + kaplama:</strong> Dayanıklılık.</li>
            <li><strong>Uygulama:</strong> Bernafon App ile kontrol.</li>
          </ul>
        `
      },

      "leox-platform": {
        1: `
          <ul class="oz-list">
            <li><strong>Süper güç:</strong> Şiddetli–çok ileri kayıplar için yüksek amplifikasyon.</li>
            <li><strong>Çevre algısı:</strong> True Environment Processing yaklaşımı.</li>
            <li><strong>Gürültüde konuşma:</strong> Zor ortamlarda performans hedefi.</li>
            <li><strong>Kablosuz akış:</strong> Uyumluluğa bağlı.</li>
            <li><strong>IP68:</strong> Koruma ve dayanıklılık.</li>
            <li><strong>Pratik kullanım:</strong> Butonlarla kontrol ve LED.</li>
          </ul>
        `,
        2: `
          <ul class="oz-list">
            <li><strong>Environment Detection:</strong> Ortamı yüksek hızda analiz.</li>
            <li><strong>Noise Management:</strong> Gürültüyü azaltırken konuşmayı koruma.</li>
            <li><strong>Feedback Canceller:</strong> Islık/ötmeyi bastırma.</li>
            <li><strong>2.4 GHz BLE + NFMI:</strong> Kablosuz altyapı.</li>
            <li><strong>Telecoil (T-coil):</strong> Modele göre.</li>
          </ul>
        `
      }
    };

    var PRODUCT_TITLES = {
      "alpha-xt": "Bernafon Alpha XT",
      "alpha-platform": "Bernafon Alpha Platform",
      "leox-platform": "Bernafon Leox Platform",
      "encanta": "Bernafon Encanta",
      "viron": "Bernafon Viron"
    };

    function loadOzellikler(productKey) {
      var p1 = document.getElementById('ozPage1');
      var p2 = document.getElementById('ozPage2');
      var data = OZ_CONTENT[productKey] || OZ_CONTENT["alpha-xt"];
      if (p1) p1.innerHTML = data[1] || '';
      if (p2) p2.innerHTML = data[2] || '';
    }

    // Özellikler Modal
    (function () {
      var modal = document.getElementById('ozelliklerModal');
      if (!modal) return;

      var pages = modal.querySelectorAll('.oz-page');
      var dots = modal.querySelectorAll('.oz-dot');

      function setPage(n, dir) {
        var curN = parseInt(modal.getAttribute('data-oz-current') || '1', 10);
        if (String(curN) === String(n)) return;

        var current = modal.querySelector('.oz-page.is-active');
        var target = modal.querySelector('.oz-page[data-oz-page="' + String(n) + '"]');
        if (!target) return;

        pages.forEach(function (p) {
          p.classList.remove('is-entering', 'is-leaving', 'is-forward', 'is-backward', 'is-anim');
        });

        var forward = (dir === 'forward');
        var backward = (dir === 'back');

        target.classList.add('is-entering');
        if (forward) target.classList.add('is-forward');
        if (backward) target.classList.add('is-backward');

        if (current) {
          current.classList.add('is-leaving');
          if (forward) current.classList.add('is-forward');
          if (backward) current.classList.add('is-backward');
        }

        target.classList.add('is-active');

        requestAnimationFrame(function () {
          target.classList.add('is-anim');
          if (current) current.classList.add('is-anim');
        });

        window.setTimeout(function () {
          if (current) current.classList.remove('is-active', 'is-leaving', 'is-anim', 'is-forward', 'is-backward');
          target.classList.remove('is-entering', 'is-anim', 'is-forward', 'is-backward');
        }, 420);

        dots.forEach(function (d) {
          d.classList.toggle('is-active', d.getAttribute('data-oz-dot') === String(n));
        });

        modal.setAttribute('data-oz-current', String(n));
      }

      function openModal() {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('oz-blur-active', 'oz-modal-open');
        modal.setAttribute('data-oz-current', '0');
        setPage(1, 'back');
      }

      function closeModal() {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('oz-blur-active', 'oz-modal-open');
      }

      document.addEventListener('click', function (e) {
        var badge = e.target.closest && e.target.closest('.feature-badge');
        if (badge) {
          e.preventDefault();
          var key = badge.getAttribute('data-product') || 'alpha-xt';
          var subEl = document.getElementById('ozModalSub');
          if (subEl) subEl.textContent = (PRODUCT_TITLES[key] || PRODUCT_TITLES['alpha-xt']);
          loadOzellikler(key);
          openModal();
          return;
        }

        if (e.target && e.target.getAttribute && e.target.getAttribute('data-oz-close') === 'true') {
          closeModal();
          return;
        }

        var prev = e.target.closest && e.target.closest('[data-oz-prev="true"]');
        if (prev) {
          var cur = parseInt(modal.getAttribute('data-oz-current') || '1', 10);
          setPage(Math.max(1, cur - 1), 'back');
          return;
        }

        var next = e.target.closest && e.target.closest('[data-oz-next="true"]');
        if (next) {
          var cur2 = parseInt(modal.getAttribute('data-oz-current') || '1', 10);
          setPage(Math.min(2, cur2 + 1), 'forward');
          return;
        }

        var dot = e.target.closest && e.target.closest('[data-oz-dot]');
        if (dot) {
          var targetN = parseInt(dot.getAttribute('data-oz-dot'), 10);
          var cur3 = parseInt(modal.getAttribute('data-oz-current') || '1', 10);
          setPage(targetN, targetN > cur3 ? 'forward' : 'back');
        }
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          closeModal();
          return;
        }
        if (!modal.classList.contains('is-open')) return;

        if (e.key === 'ArrowLeft') {
          var cur = parseInt(modal.getAttribute('data-oz-current') || '1', 10);
          setPage(Math.max(1, cur - 1), 'back');
        }
        if (e.key === 'ArrowRight') {
          var cur2 = parseInt(modal.getAttribute('data-oz-current') || '1', 10);
          setPage(Math.min(2, cur2 + 1), 'forward');
        }
      });
    })();

    // Blog: tekil "Devamını oku" + eşitleme
    (function(){
      var blog = document.getElementById('blog');
      if (!blog) return;

      var detailsList = Array.prototype.slice.call(blog.querySelectorAll('details.blog-details'));
      if (!detailsList.length) return;

      function equalizeBlogCards() {
        var cards = Array.prototype.slice.call(blog.querySelectorAll('.blog-card'));
        if (!cards.length) return;

        var openStates = detailsList.map(function(d){ return !!d.open; });
        detailsList.forEach(function(d){ d.removeAttribute('open'); });

        cards.forEach(function(c){ c.style.minHeight = ''; });

        requestAnimationFrame(function(){
          var maxH = 0;
          cards.forEach(function(c){
            var h = c.getBoundingClientRect().height;
            if (h > maxH) maxH = h;
          });
          maxH = Math.ceil(maxH);
          cards.forEach(function(c){ c.style.minHeight = maxH + 'px'; });

          detailsList.forEach(function(d, i){
            if (openStates[i]) d.setAttribute('open','');
          });
        });
      }

      var resizeTimer = null;
      function scheduleEqualize(){
        if (resizeTimer) window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(equalizeBlogCards, 60);
      }

      scheduleEqualize();
      window.addEventListener('load', scheduleEqualize);
      window.addEventListener('resize', scheduleEqualize);

      detailsList.forEach(function(d){
        d.addEventListener('toggle', function(){
          if (!d.open) { scheduleEqualize(); return; }
          detailsList.forEach(function(other){
            if (other !== d) other.removeAttribute('open');
          });
          scheduleEqualize();
        });
      });
    })();
  });
})();
