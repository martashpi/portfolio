const switcherFrames = [
  { x: 0, y: 0, angle: 0, corners: { tl: [0, 0], tr: [0, 0], br: [0, 0], bl: [0, 0] } },
  { x: 14, y: -5, angle: 2, corners: { tl: [0, 0], tr: [2, -2], br: [0, 0], bl: [0, 0] } },
  { x: -28, y: 10, angle: -4, corners: { tl: [0, 0], tr: [0, 0], br: [2, 2], bl: [-2, 2] } },
  { x: -14, y: 5, angle: -2, corners: { tl: [0, 0], tr: [0, 0], br: [0, 0], bl: [-2, 2] } },
  { x: 0, y: 0, angle: 0, corners: { tl: [0, 0], tr: [0, 0], br: [0, 0], bl: [0, 0] } }
];
const switcherTiming = { frame2: .20, frame2End: .36, frame3: .44, frame3End: .52, frame4: .60, frame4End: .76 };
const switcherDuration = 700;
const switcherInterval = 10000;
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const switcherMotionTransform = (frame) => `translate3d(${frame.x}px, ${frame.y}px, 0) rotate(${frame.angle}deg)`;

const switcherWarpTransform = (image, frame) => {
  const width = image.clientWidth || 1;
  const height = image.clientHeight || 1;
  const [tlx, tly] = frame.corners.tl;
  const [trx, try_] = frame.corners.tr;
  const [brx, bry] = frame.corners.br;
  const [blx, bly] = frame.corners.bl;
  const x0 = tlx, y0 = tly;
  const x1 = width + trx, y1 = try_;
  const x2 = width + brx, y2 = height + bry;
  const x3 = blx, y3 = height + bly;
  const dx1 = x1 - x2, dy1 = y1 - y2;
  const dx2 = x3 - x2, dy2 = y3 - y2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy3 = y0 - y1 + y2 - y3;
  const denominator = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(denominator) < .000001) return 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
  const g = (dx3 * dy2 - dx2 * dy3) / denominator;
  const h = (dx1 * dy3 - dx3 * dy1) / denominator;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const c = x0;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  const f = y0;
  return `matrix3d(${a / width},${d / width},0,${g / width},${b / height},${e / height},0,${h / height},0,0,1,0,${c},${f},0,1)`;
};

const cancelSwitcherAnimations = (switcher) => {
  switcher.querySelectorAll('.personal-exhibition-switcher__layer, img').forEach((element) => {
    element.getAnimations().forEach((animation) => animation.cancel());
    element.style.opacity = '';
  });
  switcher.dataset.animating = 'false';
};

const applySwitcherFrame = (layer, frame) => {
  const image = layer.querySelector('img');
  layer.style.transform = switcherMotionTransform(frame);
  image.style.transform = switcherWarpTransform(image, frame);
};

const settleSwitcher = (switcher, visibleIndex = Number(switcher.dataset.current || 0)) => {
  cancelSwitcherAnimations(switcher);
  switcher.querySelectorAll('.personal-exhibition-switcher__layer').forEach((layer, index) => {
    layer.hidden = index !== visibleIndex;
    if (index === visibleIndex) applySwitcherFrame(layer, switcherFrames[0]);
  });
  switcher.dataset.current = String(visibleIndex);
};

const switchSwitcherImmediately = (switcher) => {
  const currentIndex = Number(switcher.dataset.current || 0);
  settleSwitcher(switcher, currentIndex ? 0 : 1);
};

const playSwitcherTransition = (switcher) => {
  if (reducedMotionQuery.matches) {
    switchSwitcherImmediately(switcher);
    return;
  }
  if (switcher.dataset.animating === 'true') return;
  cancelSwitcherAnimations(switcher);
  switcher.dataset.animating = 'true';
  const currentIndex = Number(switcher.dataset.current || 0);
  const nextIndex = currentIndex ? 0 : 1;
  const sequence = currentIndex === 0 ? switcherFrames : [...switcherFrames].reverse();
  const layers = switcher.querySelectorAll('.personal-exhibition-switcher__layer');
  const outgoing = layers[currentIndex];
  const incoming = layers[nextIndex];
  const outgoingImage = outgoing.querySelector('img');
  const incomingImage = incoming.querySelector('img');
  outgoing.hidden = false;
  incoming.hidden = false;
  const options = { duration: switcherDuration, easing: 'linear', fill: 'forwards' };

  const outgoingAnimation = outgoing.animate([
    { offset: 0, transform: switcherMotionTransform(sequence[0]), opacity: 1 },
    { offset: switcherTiming.frame2, transform: switcherMotionTransform(sequence[1]), opacity: 1 },
    { offset: switcherTiming.frame2End, transform: switcherMotionTransform(sequence[1]), opacity: 1 },
    { offset: switcherTiming.frame3 - .001, transform: switcherMotionTransform(sequence[2]), opacity: 1 },
    { offset: switcherTiming.frame3, transform: switcherMotionTransform(sequence[2]), opacity: 0 },
    { offset: 1, transform: switcherMotionTransform(sequence[2]), opacity: 0 }
  ], options);
  outgoingImage.animate([
    { offset: 0, transform: switcherWarpTransform(outgoingImage, sequence[0]) },
    { offset: switcherTiming.frame2, transform: switcherWarpTransform(outgoingImage, sequence[1]) },
    { offset: switcherTiming.frame2End, transform: switcherWarpTransform(outgoingImage, sequence[1]) },
    { offset: switcherTiming.frame3, transform: switcherWarpTransform(outgoingImage, sequence[2]) },
    { offset: 1, transform: switcherWarpTransform(outgoingImage, sequence[2]) }
  ], options);
  const incomingAnimation = incoming.animate([
    { offset: 0, transform: switcherMotionTransform(sequence[2]), opacity: 0 },
    { offset: switcherTiming.frame3 - .001, transform: switcherMotionTransform(sequence[2]), opacity: 0 },
    { offset: switcherTiming.frame3, transform: switcherMotionTransform(sequence[2]), opacity: 1 },
    { offset: switcherTiming.frame3End, transform: switcherMotionTransform(sequence[2]), opacity: 1 },
    { offset: switcherTiming.frame4, transform: switcherMotionTransform(sequence[3]), opacity: 1 },
    { offset: switcherTiming.frame4End, transform: switcherMotionTransform(sequence[3]), opacity: 1 },
    { offset: 1, transform: switcherMotionTransform(sequence[4]), opacity: 1 }
  ], options);
  incomingImage.animate([
    { offset: 0, transform: switcherWarpTransform(incomingImage, sequence[2]) },
    { offset: switcherTiming.frame3, transform: switcherWarpTransform(incomingImage, sequence[2]) },
    { offset: switcherTiming.frame3End, transform: switcherWarpTransform(incomingImage, sequence[2]) },
    { offset: switcherTiming.frame4, transform: switcherWarpTransform(incomingImage, sequence[3]) },
    { offset: switcherTiming.frame4End, transform: switcherWarpTransform(incomingImage, sequence[3]) },
    { offset: 1, transform: switcherWarpTransform(incomingImage, sequence[4]) }
  ], options);

  incomingAnimation.finished.then(() => {
    cancelSwitcherAnimations(switcher);
    outgoing.hidden = true;
    incoming.hidden = false;
    applySwitcherFrame(incoming, sequence[4]);
    switcher.dataset.current = String(nextIndex);
  }).catch(() => { switcher.dataset.animating = 'false'; });
  outgoingAnimation.finished.catch(() => {});
};

const switchers = [...document.querySelectorAll('[data-switcher]')];

switchers.forEach((switcher, index) => {
  const layers = switcher.querySelectorAll('.personal-exhibition-switcher__layer');
  let timer;
  const pauseReasons = new Set();
  switcher.dataset.current = '0';
  applySwitcherFrame(layers[0], switcherFrames[0]);

  const schedule = (delay = switcherInterval) => {
    window.clearTimeout(timer);
    timer = undefined;
    if (pauseReasons.size) return;
    timer = window.setTimeout(() => {
      playSwitcherTransition(switcher);
      schedule();
    }, delay);
  };
  const pause = (reason) => {
    pauseReasons.add(reason);
    window.clearTimeout(timer);
    timer = undefined;
  };
  const resume = (reason, delay = switcherInterval) => {
    pauseReasons.delete(reason);
    if (!pauseReasons.size) schedule(delay);
  };
  const activate = () => {
    playSwitcherTransition(switcher);
    schedule();
  };
  switcher.addEventListener('click', activate);
  switcher.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    activate();
  });
  switcher.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'touch') pause('hover');
  });
  switcher.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch') resume('hover');
  });
  switcher.addEventListener('focus', () => {
    if (switcher.matches(':focus-visible')) pause('focus');
  });
  switcher.addEventListener('blur', () => resume('focus'));
  const initialDelay = index === 0 ? switcherInterval : switcherInterval * 1.5;
  schedule(initialDelay);

  if ('IntersectionObserver' in window) {
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio < .25) {
        pause('viewport');
      } else if (pauseReasons.has('viewport')) {
        resume('viewport', initialDelay);
      }
    }, { threshold: [0, .25] });
    visibilityObserver.observe(switcher);
  }
});

reducedMotionQuery.addEventListener('change', () => {
  switchers.forEach((switcher) => settleSwitcher(switcher));
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
