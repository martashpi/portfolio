(() => {
  const scrub = document.querySelector('.screens-scrub');
  const image = scrub?.querySelector('img[data-frames]');
  if (!scrub || !image) return;

  const frames = JSON.parse(image.dataset.frames || '[]');
  if (!frames.length) return;

  frames.forEach((src) => {
    const preload = new Image();
    preload.src = src;
  });

  let activeFrame = 1;

  const showFrame = (index) => {
    const nextFrame = Math.max(0, Math.min(frames.length - 1, index));
    if (nextFrame === activeFrame) return;
    activeFrame = nextFrame;
    image.src = frames[activeFrame];
    image.alt = `Вариант соединения орнамента ${activeFrame + 1} из ${frames.length}`;
  };

  const showFrameAt = (clientX) => {
    const bounds = scrub.getBoundingClientRect();
    const progress = Math.max(0, Math.min(0.999999, (clientX - bounds.left) / bounds.width));
    showFrame(Math.floor(progress * frames.length));
  };

  scrub.addEventListener('pointermove', (event) => showFrameAt(event.clientX));
  scrub.addEventListener('pointerdown', (event) => showFrameAt(event.clientX));
  scrub.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showFrame(activeFrame - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      showFrame(activeFrame + 1);
    }
  });
})();
