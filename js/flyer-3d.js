import * as THREE from './vendor/three.module.min.js';

// Reusable 3D component for square printed flyers. It intentionally has no
// dependency on the book component, so both components can evolve separately.
THREE.Cache.enabled = true;

export const YOLKA_COMP = 'YOLKA_COMP';
export const LISTS_COMP = 'LISTS_COMP';
const COMPONENT_NAMES = [YOLKA_COMP, LISTS_COMP];
const initializedViewers = new WeakSet();
let initializationQueue = Promise.resolve();

const defaults = {
  mode: 'single',
  transparent: false,
  background: 0xdedede,
  initialRotation: [-0.22, 0.48, -0.08],
  desktopCameraZ: 8.6,
  mobileCameraZ: 9.5,
  flyers: [{ front: 'demo:white', back: 'demo:ivory' }]
};

/**
 * Creates one independent viewer.
 *
 * `flyers` supports one flyer or a composition. Every item accepts:
 * { front, back, position: [x, y, z], rotation: [x, y, z], scale }
 * `front` and `back` can be ordinary PNG/JPG URLs or a temporary `demo:*` key.
 */
export function mountFlyerModel(viewer, options = {}) {
  if (!viewer || initializedViewers.has(viewer)) return Promise.resolve(null);
  initializedViewers.add(viewer);
  viewer.dataset.componentState = 'loading';

  const settings = normaliseSettings(options);
  const initialisation = initializationQueue.then(() => createFlyerModel(viewer, settings));
  initializationQueue = initialisation.catch(() => undefined);

  return initialisation.then((model) => {
    viewer.dataset.componentState = 'ready';
    viewer.classList.add('is-ready');
    model.renderer.domElement.addEventListener('webglcontextlost', () => {
      viewer.dataset.componentState = 'error';
      viewer.classList.remove('is-ready');
      viewer.classList.add('has-error');
    });
    return model;
  }).catch((error) => {
    console.error('Не удалось загрузить 3D-компонент листовки:', error);
    viewer.dataset.componentState = 'error';
    viewer.classList.add('has-error');
    return null;
  });
}

/** Creates a one-flyer component. Pass `front` and `back` in `options.flyers`. */
export function mountYolkaComp(viewer, options = {}) {
  return mountFlyerModel(viewer, {
    ...options,
    mode: 'single',
    flyers: options.flyers || [{ front: 'demo:white', back: 'demo:ivory' }]
  });
}

/** Creates a two-flyer composition. Each flyer remains configurable in `options`. */
export function mountListsComp(viewer, options = {}) {
  return mountFlyerModel(viewer, {
    ...options,
    mode: 'composition',
    initialRotation: options.initialRotation || [-0.06, 0.08, 0],
    flyers: options.flyers || [
      { front: 'demo:white', back: 'solid:white', position: [-0.52, -0.35, -0.06], rotation: [0, 0, -0.25], scale: 0.82 },
      { front: 'demo:ivory', back: 'solid:white', position: [0.38, 0.35, 0.1], rotation: [0, 0, 0.38], scale: 0.82 }
    ]
  });
}

export function mountAllFlyerModels(root = document) {
  const selector = COMPONENT_NAMES.map((name) => `[data-component="${name}"]`).join(', ');
  const viewers = [...root.querySelectorAll(selector)];
  const mount = (viewer) => {
    let configuration = {};
    try {
      configuration = JSON.parse(viewer.dataset.flyerConfig || '{}');
    } catch (error) {
      console.warn('Не удалось прочитать конфигурацию листовки:', error);
    }
    if (viewer.dataset.component === YOLKA_COMP) return mountYolkaComp(viewer, configuration);
    return mountListsComp(viewer, configuration);
  };

  if (!('IntersectionObserver' in window)) {
    viewers.forEach(mount);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      mount(entry.target);
    });
  }, { rootMargin: '320px 0px', threshold: 0.01 });
  viewers.forEach((viewer) => observer.observe(viewer));
}

async function createFlyerModel(viewer, settings) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: settings.transparent,
    powerPreference: 'high-performance'
  });
  renderer.setClearColor(settings.background, settings.transparent ? 0 : 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  // A small painted soft-shadow texture is more stable than real-time shadows
  // for thin cards, especially on mobile GPUs.
  renderer.shadowMap.enabled = false;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  viewer.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  camera.position.set(0, 0.04, settings.desktopCameraZ);
  camera.lookAt(0, 0, 0);

  const composition = new THREE.Group();
  composition.rotation.set(...settings.initialRotation);
  scene.add(composition);

  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const cardboardBump = createPaperBump(anisotropy);
  const flyers = await Promise.all(settings.flyers.map((flyer) => createFlyer(flyer, cardboardBump, anisotropy)));
  flyers.forEach((flyer) => composition.add(flyer));

  addLights(scene);
  if (!settings.transparent) addShadow(scene);

  installInteraction(viewer, renderer, scene, camera, composition, settings);
  return {
    renderer,
    scene,
    camera,
    composition,
    flyers,
    render: () => renderer.render(scene, camera)
  };
}

function normaliseSettings(options) {
  const settings = { ...defaults, ...options };
  const flyers = Array.isArray(options.flyers) && options.flyers.length ? options.flyers : defaults.flyers;
  settings.flyers = flyers.slice(0, 8).map((flyer, index) => ({
    front: flyer.front || `demo:${index % 2 ? 'ivory' : 'white'}`,
    back: flyer.back || `demo:${index % 2 ? 'white' : 'ivory'}`,
    position: flyer.position || [0, 0, 0],
    rotation: flyer.rotation || [0, 0, 0],
    scale: flyer.scale || 1
  }));
  return settings;
}

async function createFlyer(specification, bumpMap, anisotropy) {
  const [frontMap, backMap] = await Promise.all([
    createFaceTexture(specification.front, anisotropy),
    createFaceTexture(specification.back, anisotropy)
  ]);
  const edgeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd9d2c6,
    roughness: 0.86,
    metalness: 0,
    bumpMap,
    bumpScale: 0.024
  });
  const frontMaterial = createPrintMaterial(frontMap, bumpMap);
  const backMaterial = createPrintMaterial(backMap, bumpMap);
  // BoxGeometry material groups: right, left, top, bottom, front, back.
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(2.85, 2.85, 0.025, 1, 1, 1),
    [edgeMaterial, edgeMaterial, edgeMaterial, edgeMaterial, frontMaterial, backMaterial]
  );
  object.position.set(...specification.position);
  object.rotation.set(...specification.rotation);
  object.scale.setScalar(specification.scale);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function createPrintMaterial(map, bumpMap) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map,
    roughness: 0.76,
    metalness: 0,
    sheen: 0.025,
    sheenRoughness: 0.94,
    clearcoat: 0.006,
    bumpMap,
    bumpScale: 0.009
  });
}

async function createFaceTexture(source, anisotropy) {
  if (source === 'solid:white') return createSolidTexture('#ffffff', anisotropy);
  if (typeof source === 'string' && source.startsWith('demo:')) {
    return createDemoTexture(source.slice(5), anisotropy);
  }
  const image = await loadImage(source);
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fafafa';
  context.fillRect(0, 0, size, size);
  // Contain preserves source proportions; no illustration is ever stretched.
  const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  return canvasTexture(canvas, anisotropy);
}

function createSolidTexture(colour, anisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  context.fillStyle = colour;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvasTexture(canvas, anisotropy);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Не удалось загрузить изображение: ${source}`));
    image.src = source;
  });
}

function createDemoTexture(name, anisotropy) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const background = name === 'ivory' ? '#f5f3ee' : '#fbfbfb';
  context.fillStyle = background;
  context.fillRect(0, 0, size, size);
  // A nearly blank temporary face keeps the preview focused on form and light,
  // while `front` / `back` can later point to real PNG or JPG artwork.
  context.strokeStyle = name === 'ivory' ? 'rgba(130, 123, 112, .09)' : 'rgba(80, 80, 80, .055)';
  context.lineWidth = 2;
  context.strokeRect(48, 48, size - 96, size - 96);
  return canvasTexture(canvas, anisotropy);
}

function canvasTexture(canvas, anisotropy) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createPaperBump(anisotropy) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  let seed = 918273;
  const noise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296 - 0.5;
  };
  for (let index = 0; index < image.data.length; index += 4) {
    const value = 130 + noise() * 26;
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 18);
  texture.anisotropy = anisotropy;
  return texture;
}

function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb2aba0, 1.28));
  const key = new THREE.DirectionalLight(0xfffdf8, 1.95);
  key.position.set(-3, 10, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd7e4ff, 0.42);
  fill.position.set(5, -1, 5);
  scene.add(fill);
}

function addShadow(scene) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(54, 50, 45, .34)');
  gradient.addColorStop(0.38, 'rgba(54, 50, 45, .20)');
  gradient.addColorStop(1, 'rgba(54, 50, 45, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 1.15),
    new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity: 0.85 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -2.13, 0);
  scene.add(shadow);
}

function installInteraction(viewer, renderer, scene, camera, object, settings) {
  let frameId = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let velocityX = 0;
  let velocityY = 0;
  let lastFrameTime = performance.now();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const worldY = new THREE.Vector3(0, 1, 0);
  const localX = new THREE.Vector3(1, 0, 0);
  const yaw = new THREE.Quaternion();
  const pitch = new THREE.Quaternion();

  const rotate = (deltaX, deltaY) => {
    yaw.setFromAxisAngle(worldY, deltaX);
    pitch.setFromAxisAngle(localX, deltaY);
    object.quaternion.premultiply(yaw).multiply(pitch).normalize();
  };
  const requestDraw = () => {
    if (!frameId) {
      lastFrameTime = performance.now();
      frameId = requestAnimationFrame(draw);
    }
  };
  const draw = (now) => {
    frameId = 0;
    const elapsed = Math.min((now - lastFrameTime) / 16.667, 3);
    lastFrameTime = now;
    if (!dragging && (Math.abs(velocityX) > 0.00002 || Math.abs(velocityY) > 0.00002)) {
      rotate(velocityX * elapsed, velocityY * elapsed);
      const damping = Math.pow(reducedMotion ? 0.65 : 0.89, elapsed);
      velocityX *= damping;
      velocityY *= damping;
      requestDraw();
    }
    renderer.render(scene, camera);
  };
  const resize = () => {
    const { width, height } = viewer.getBoundingClientRect();
    if (!width || !height) return;
    const mobile = width < 640;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = mobile ? settings.mobileCameraZ : settings.desktopCameraZ;
    camera.updateProjectionMatrix();
    requestDraw();
  };
  const beginDrag = (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    velocityX = 0;
    velocityY = 0;
    viewer.classList.add('has-interacted');
    viewer.setPointerCapture(event.pointerId);
    requestDraw();
  };
  const moveDrag = (event) => {
    if (!dragging) return;
    const bounds = viewer.getBoundingClientRect();
    const sensitivity = 2.6 / Math.max(Math.min(bounds.width, bounds.height), 180);
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    velocityX = dx * sensitivity;
    velocityY = dy * sensitivity;
    rotate(velocityX, velocityY);
    requestDraw();
  };
  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    if (viewer.hasPointerCapture(event.pointerId)) viewer.releasePointerCapture(event.pointerId);
    requestDraw();
  };
  const handleKeyboard = (event) => {
    const step = event.shiftKey ? 0.16 : 0.085;
    const horizontal = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const vertical = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    if (!horizontal && !vertical) return;
    event.preventDefault();
    velocityX = horizontal;
    velocityY = vertical;
    rotate(horizontal, vertical);
    requestDraw();
  };
  viewer.addEventListener('pointerdown', beginDrag);
  viewer.addEventListener('pointermove', moveDrag);
  viewer.addEventListener('pointerup', endDrag);
  viewer.addEventListener('pointercancel', endDrag);
  viewer.addEventListener('keydown', handleKeyboard);
  new ResizeObserver(resize).observe(viewer);
  resize();
  renderer.render(scene, camera);
}

mountAllFlyerModels();
