document.querySelectorAll('[data-switcher]').forEach((switcher) => {
  let current = 0;
  let startX = null;
  let timer;
  const setCurrent = (next) => {
    current = next ? 1 : 0;
    switcher.classList.toggle('is-second', current === 1);
  };
  const restart = () => {
    window.clearInterval(timer);
    timer = window.setInterval(() => setCurrent(current ? 0 : 1), 5000);
  };
  switcher.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    switcher.setPointerCapture(event.pointerId);
    restart();
  });
  switcher.addEventListener('pointermove', (event) => {
    if (startX === null || Math.abs(event.clientX - startX) < 18) return;
    setCurrent(event.clientX < startX ? 1 : 0);
    startX = event.clientX;
    restart();
  });
  switcher.addEventListener('pointerup', () => { startX = null; });
  switcher.addEventListener('pointercancel', () => { startX = null; });
  switcher.addEventListener('pointerenter', restart);
  restart();
});

document.querySelectorAll('[data-pan]').forEach((container) => {
  const image = container.querySelector('img');
  let offset = 0;
  let startX = 0;
  let origin = 0;
  const render = () => { image.style.transform = `translateX(${offset}px)`; };
  const limit = () => Math.max(0, image.getBoundingClientRect().width - container.getBoundingClientRect().width);
  const center = () => { offset = -limit() / 2; render(); };
  container.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    origin = offset;
    container.setPointerCapture(event.pointerId);
  });
  container.addEventListener('pointermove', (event) => {
    if (!container.hasPointerCapture(event.pointerId)) return;
    offset = Math.min(0, Math.max(-limit(), origin + event.clientX - startX));
    render();
  });
  window.addEventListener('resize', center);
  center();
});
