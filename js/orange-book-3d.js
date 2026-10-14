import { initBookModel } from './orange-book-prototype.js?v=20261014-16';

const COMPONENT_NAME = '3D_COMP';
const COMPONENT_SELECTOR = `[data-component="${COMPONENT_NAME}"]`;
const initializedViewers = new WeakSet();

// Several 3D_COMP instances may exist on one page. Initializing them one by one
// avoids a CPU/GPU spike when multiple components enter the viewport together.
let initializationQueue = Promise.resolve();

export function mount3DComp(viewer) {
  if (!viewer || initializedViewers.has(viewer)) return Promise.resolve(null);

  initializedViewers.add(viewer);
  viewer.dataset.componentState = 'loading';

  const initialization = initializationQueue.then(() => initBookModel(viewer, {
    // Keep the approved project-page brightness for every 3D_COMP copy.
    toneMappingExposure: 1.06,
    initialRotation: [-0.18, 0.55, -0.045],
    desktopCameraZ: 40.2,
    mobileCameraZ: 43.5
  }));

  initializationQueue = initialization.catch(() => undefined);

  return initialization.then((model) => {
    if (!model) return null;

    const { renderer } = model;
    viewer.dataset.componentState = 'ready';
    viewer.classList.add('is-ready');
    renderer.domElement.addEventListener('webglcontextlost', () => {
      viewer.dataset.componentState = 'error';
      viewer.classList.remove('is-ready');
      viewer.classList.add('has-error');
    });
    return model;
  }).catch((error) => {
    console.error(`Не удалось загрузить компонент ${COMPONENT_NAME}:`, error);
    viewer.dataset.componentState = 'error';
    viewer.classList.add('has-error');
    return null;
  });
}

export function mountAll3DComps(root = document) {
  const viewers = [...root.querySelectorAll(COMPONENT_SELECTOR)];

  if (!('IntersectionObserver' in window)) {
    viewers.forEach(mount3DComp);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      mount3DComp(entry.target);
    });
  }, {
    // Start loading just before the component becomes visible.
    rootMargin: '320px 0px',
    threshold: 0.01
  });

  viewers.forEach((viewer) => observer.observe(viewer));
}

mountAll3DComps();
