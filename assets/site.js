// Origin uses the same static content with or without JavaScript.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const easeOut = 'cubic-bezier(.16, 1, .3, 1)';
  const nav = document.querySelector('.nav');
  const menu = nav.querySelector('.nav__toggle');
  const links = nav.querySelector('.nav__links');

  function setMenu(open) {
    menu.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  }

  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    setMenu(open);
    if (open) links.querySelector('a').focus();
  });
  links.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || menu.getAttribute('aria-expanded') !== 'true') return;
    setMenu(false);
    const section = document.querySelector(link.hash);
    section.tabIndex = -1;
    section.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menu.focus();
    }
  });

  // The visitor chooses an install target. Their browsing device never sets it.
  const radios = [...document.querySelectorAll('[data-picker] input')];
  const devicePanels = [...document.querySelectorAll('.panel[data-device]')];
  const noDevice = document.querySelector('.panels__empty');
  const office = document.querySelector('.office');
  let pickerResize;
  let pickerAnimations = [];

  radios.forEach(radio => {
    radio.checked = false;
    radio.addEventListener('change', () => {
      const panel = devicePanels.find(item => item.dataset.device === radio.value);
      if (!radio.checked || !panel) return;
      const calm = reduced.matches;
      const from = office.getBoundingClientRect().height;
      if (pickerResize) pickerResize.cancel();
      office.classList.remove('is-resizing');
      pickerAnimations.forEach(animation => animation.cancel());
      noDevice.hidden = true;
      devicePanels.forEach(item => { item.hidden = item !== panel; });
      if (!panel.animate) return;

      const to = office.getBoundingClientRect().height;
      if (!calm && Math.abs(to - from) >= 1) {
        // Start from the painted height if another choice interrupts the reflow.
        office.classList.add('is-resizing');
        pickerResize = office.animate([{ height: from + 'px' }, { height: to + 'px' }],
          { duration: 240, easing: 'cubic-bezier(.22, .7, .25, 1)' });
        pickerResize.onfinish = () => {
          office.classList.remove('is-resizing');
          pickerResize = undefined;
        };
      }

      const items = [...panel.children].flatMap(item => item.tagName === 'DL' ? [...item.children] : [item]);
      const start = calm ? { opacity: .9 } : { opacity: .8, transform: 'translateY(4px)' };
      pickerAnimations = items.map((item, index) => item.animate(
        [start, { opacity: 1, transform: 'none' }],
        { duration: calm ? 120 : 180, delay: calm ? 0 : Math.min(index * 24, 96), easing: easeOut, fill: 'backwards' }
      ));
    });
  });
  devicePanels.forEach(panel => { panel.hidden = true; });
  noDevice.hidden = false;

  const tabList = document.querySelector('.tabs');
  const tabs = [...tabList.querySelectorAll('[role=tab]')];
  const tabPanels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  const tour = document.querySelector('.tabpanels');
  const pill = document.createElement('span');
  pill.className = 'tabs__pill';
  pill.setAttribute('aria-hidden', 'true');
  tabList.prepend(pill);

  let selected = 0;
  let displayed = 0;
  let request = 0;
  let tourTransition = Promise.resolve();

  function placePill(jump) {
    const list = tabList.getBoundingClientRect();
    const tab = tabs[selected].getBoundingClientRect();
    if (jump) pill.classList.add('is-jump');
    const insets = [tab.top - list.top, list.right - tab.right, list.bottom - tab.bottom, tab.left - list.left];
    pill.style.clipPath = 'inset(' + insets.map(value => value + 'px').join(' ') + ' round 999px)';
    if (jump) {
      pill.getBoundingClientRect();
      pill.classList.remove('is-jump');
    }
  }

  async function selectTab(index, focus) {
    if (focus) tabs[index].focus({ preventScroll: true });
    if (index === selected) return;

    selected = index;
    const currentRequest = ++request;
    tabs.forEach((tab, position) => {
      tab.setAttribute('aria-selected', String(position === index));
      tab.tabIndex = position === index ? 0 : -1;
    });
    placePill(false);
    if (index === displayed) {
      tour.removeAttribute('aria-busy');
      return;
    }

    const incoming = tabPanels[index];
    const image = incoming.querySelector('img');
    tour.setAttribute('aria-busy', 'true');
    // Load on demand while the old screenshot remains visible.
    image.loading = 'eager';
    if (image.decode) await image.decode().catch(() => {});
    // Keep the painted blend intact, then apply only the latest waiting selection.
    await tourTransition;
    if (request !== currentRequest) return;
    tour.removeAttribute('aria-busy');

    const outgoing = tabPanels[displayed];
    const direction = Math.sign(index - displayed);
    displayed = index;
    incoming.hidden = false;

    if (!incoming.animate) {
      outgoing.hidden = true;
      return;
    }

    outgoing.inert = true;
    outgoing.setAttribute('aria-hidden', 'true');
    incoming.classList.add('is-incoming');
    const calm = reduced.matches;
    const timing = { duration: calm ? 150 : 300, easing: calm ? 'linear' : easeOut, fill: 'backwards' };
    const fade = incoming.animate([{ opacity: 0 }, { opacity: 1 }], timing);
    if (!calm) incoming.querySelector('.shot').animate(
      [{ transform: 'translateX(' + direction * 12 + 'px)' }, { transform: 'none' }], timing
    );
    tourTransition = fade.finished.then(() => {
      outgoing.hidden = true;
      outgoing.inert = false;
      outgoing.removeAttribute('aria-hidden');
      incoming.classList.remove('is-incoming');
    });
  }

  tabs.forEach((tab, index) => {
    const panel = tabPanels[index];
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
    panel.hidden = index !== 0;
    tab.addEventListener('click', () => selectTab(index, false));
    tab.addEventListener('keydown', event => {
      const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      selectTab((next + tabs.length) % tabs.length, true);
    });
  });

  root.classList.add('js-ready');
  placePill(true);

  const menuLinks = [...links.querySelectorAll('a')];
  const mark = document.createElement('span');
  mark.className = 'nav__mark';
  mark.setAttribute('aria-hidden', 'true');
  links.append(mark);
  let activeLink;

  function placeMark(jump) {
    if (!activeLink) {
      mark.classList.remove('is-on');
      return;
    }
    const snap = jump || !mark.classList.contains('is-on');
    if (snap) mark.classList.add('is-jump');
    mark.style.transform = 'translateX(' + (activeLink.offsetLeft + 12) + 'px) scaleX(' + (activeLink.offsetWidth - 24) + ')';
    if (snap) {
      mark.getBoundingClientRect();
      mark.classList.remove('is-jump');
    }
    mark.classList.add('is-on');
  }

  const sections = menuLinks.map(link => ({ link, section: document.querySelector(link.hash) }));
  let positionFrame;
  function updatePosition() {
    positionFrame = undefined;
    const readingLine = innerHeight * .45;
    const active = sections.find(({ section }) => {
      const rect = section.getBoundingClientRect();
      return rect.top <= readingLine && rect.bottom > readingLine;
    });
    const next = active?.link;
    if (next === activeLink) return;
    if (activeLink) activeLink.removeAttribute('aria-current');
    activeLink = next;
    if (activeLink) activeLink.setAttribute('aria-current', 'location');
    placeMark(false);
  }
  window.addEventListener('scroll', () => {
    if (positionFrame === undefined) positionFrame = requestAnimationFrame(updatePosition);
  }, { passive: true });
  updatePosition();

  if ('IntersectionObserver' in window) {
    // Below-fold images get one light-up as their frames enter view. Content is visible by default.
    const frames = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.intersectionRatio < .25) return;
        const frame = entry.target;
        frames.unobserve(frame);
        if (reduced.matches) return;
        frame.classList.add('is-revealing');
        frame.addEventListener('animationend', () => frame.classList.remove('is-revealing'), { once: true });
      });
    }, { threshold: .25 });
    document.querySelectorAll('.stats, .pair .shot, .duo .shot, .shot--video').forEach(frame => {
      if (frame.getBoundingClientRect().top >= innerHeight) frames.observe(frame);
    });
  }

  const film = document.querySelector('.film__image');
  const photo = film.querySelector('img');
  const leader = film.querySelector('.film__leader');

  function openFilm() {
    const rect = film.getBoundingClientRect();
    if (reduced.matches || document.hidden || rect.bottom <= 0 || rect.top >= innerHeight) return;
    leader.classList.add('is-playing');
    leader.addEventListener('animationend', () => leader.classList.remove('is-playing'), { once: true });
  }

  if (!reduced.matches) {
    if (photo.decode) photo.decode().then(openFilm).catch(() => {});
    else if (photo.complete && photo.naturalWidth) openFilm();
    else photo.addEventListener('load', openFilm, { once: true });
  }

  let resizeFrame;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { updatePosition(); placePill(true); placeMark(true); });
  });
  if (document.fonts) document.fonts.ready.then(() => { updatePosition(); placePill(true); placeMark(true); });
})();
