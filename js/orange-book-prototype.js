import * as THREE from './vendor/three.module.min.js';

// Reuse decoded source images when several 3D_COMP instances are on one page.
THREE.Cache.enabled = true;

const container = document.querySelector('.book-prototype');

if (container) {
  initBookModel(container).catch((error) => {
    console.error('Не удалось загрузить тестовую 3D-модель книги:', error);
  });
}

export async function initBookModel(viewer, options = {}) {
  const {
    toneMappingExposure = 1.08,
    initialRotation = [-0.18, 0.55, -0.045],
    desktopCameraZ = 40.2,
    mobileCameraZ = 43.5
  } = options;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setClearColor(0xffffff, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = toneMappingExposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  viewer.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
  camera.position.set(0, 0.2, 40.2);
  camera.lookAt(0, 0, 0);

  const book = new THREE.Group();
  // Start from the binding side so the continuous spine and hinge are visible.
  book.rotation.set(...initialRotation);
  scene.add(book);

  const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const textureLoader = new THREE.TextureLoader();
  const textureBase = new URL('../img/2_ver/ORANGE_2/book-textures/', import.meta.url);
  const [frontTexture, backTexture, spineTexture] = await Promise.all([
    loadArtwork(textureLoader, new URL('front.png', textureBase), maxAnisotropy),
    loadArtwork(textureLoader, new URL('back.png', textureBase), maxAnisotropy),
    loadArtwork(textureLoader, new URL('spine.png', textureBase), maxAnisotropy)
  ]);

  const clothBump = createClothBump(maxAnisotropy);
  const pageMap = createPageEdgeTexture(maxAnisotropy, true);
  const pageBump = createPageEdgeTexture(maxAnisotropy, false);

  const coverEdgeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf1eee7,
    roughness: 0.9,
    metalness: 0,
    sheen: 0.07,
    sheenRoughness: 0.95,
    clearcoat: 0.018,
    clearcoatRoughness: 0.96,
    bumpMap: clothBump,
    bumpScale: 0.0065,
    side: THREE.DoubleSide
  });
  const coverInnerMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xeeeae2,
    roughness: 0.94,
    metalness: 0,
    bumpMap: clothBump,
    bumpScale: 0.005,
    side: THREE.DoubleSide
  });
  const pageMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: pageMap,
    bumpMap: pageBump,
    bumpScale: 0.021,
    roughness: 0.955,
    metalness: 0,
    side: THREE.DoubleSide
  });

  const pageBlock = new THREE.Mesh(
    createFlatPageBlockGeometry({
      height: 20.28,
      foreEdgeX: 10.2,
      halfDepth: 0.55,
      spineX: -10.7,
      foreEdgeBow: 0.075,
      foreEdgeSegments: 24
    }),
    pageMaterial
  );
  pageBlock.castShadow = true;
  pageBlock.receiveShadow = true;
  book.add(pageBlock);

  addVisiblePageLayers(book);

  const spineBump = clothBump.clone();
  spineBump.needsUpdate = true;
  spineBump.repeat.set(26, 30);
  const spineMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: spineTexture,
    roughness: 0.855,
    metalness: 0,
    sheen: 0.065,
    sheenRoughness: 0.94,
    clearcoat: 0.012,
    clearcoatRoughness: 0.97,
    bumpMap: spineBump,
    bumpScale: 0.007
  });
  const frontMaterial = createArtworkMaterial(frontTexture, clothBump);
  const backMaterial = createArtworkMaterial(backTexture, clothBump);
  const unifiedCover = new THREE.Mesh(
    createUnifiedCoverGeometry({
      width: 21,
      height: 21,
      outerHalfDepth: 0.69,
      innerHalfDepth: 0.615,
      outerSpineRadius: 0.56,
      innerSpineRadius: 0.485,
      spineSegments: 40
    }),
    [frontMaterial, spineMaterial, backMaterial, coverEdgeMaterial, coverInnerMaterial]
  );
  unifiedCover.castShadow = true;
  unifiedCover.receiveShadow = true;
  book.add(unifiedCover);

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0xc8c1b6, 1.38);
  scene.add(hemisphere);

  const keyLight = new THREE.DirectionalLight(0xfffdf8, 2.75);
  keyLight.position.set(-8, 13, 17);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -24;
  keyLight.shadow.camera.right = 24;
  keyLight.shadow.camera.top = 24;
  keyLight.shadow.camera.bottom = -24;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 70;
  keyLight.shadow.bias = -0.00025;
  keyLight.shadow.normalBias = 0.018;
  keyLight.shadow.radius = 4;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xe6efff, 0.92);
  fillLight.position.set(14, -4, 9);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffeee2, 0.82);
  rimLight.position.set(-13, 4, -15);
  scene.add(rimLight);

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(35, 19),
    new THREE.ShadowMaterial({ color: 0x342b25, opacity: 0.14, transparent: true })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.set(0, -12.1, -1.8);
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  installInteraction(viewer, renderer, scene, camera, book, {
    desktopCameraZ,
    mobileCameraZ
  });
  return { renderer, scene, camera, book };
}

function createArtworkMaterial(map, bumpMap) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map,
    roughness: 0.835,
    metalness: 0,
    sheen: 0.075,
    sheenRoughness: 0.94,
    clearcoat: 0.018,
    clearcoatRoughness: 0.965,
    bumpMap,
    bumpScale: 0.0065,
    emissive: 0xffffff,
    emissiveMap: map,
    emissiveIntensity: 0.055
  });
}

function createUnifiedCoverGeometry({
  width,
  height,
  outerHalfDepth,
  innerHalfDepth,
  outerSpineRadius,
  innerSpineRadius,
  spineSegments
}) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const positions = [];
  const normals = [];
  const uv = [];
  const indices = [];
  const groups = [];

  function appendQuad(points, pointNormals, textureCoordinates, reverseWinding = false) {
    const base = positions.length / 3;
    for (let index = 0; index < 4; index += 1) {
      positions.push(...points[index]);
      normals.push(...pointNormals[index]);
      uv.push(...textureCoordinates[index]);
    }
    if (reverseWinding) {
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    } else {
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  function beginMaterial(materialIndex) {
    return { start: indices.length, materialIndex };
  }

  function endMaterial(group) {
    groups.push({ ...group, count: indices.length - group.start });
  }

  // The outside is one uninterrupted surface: full front, rounded spine, full back.
  let group = beginMaterial(0);
  appendQuad(
    [
      [-halfWidth, -halfHeight, outerHalfDepth],
      [halfWidth, -halfHeight, outerHalfDepth],
      [-halfWidth, halfHeight, outerHalfDepth],
      [halfWidth, halfHeight, outerHalfDepth]
    ],
    Array(4).fill([0, 0, 1]),
    [[0, 0], [1, 0], [0, 1], [1, 1]]
  );
  endMaterial(group);

  group = beginMaterial(1);
  for (let index = 0; index < spineSegments; index += 1) {
    const firstAngle = Math.PI / 2 + (index / spineSegments) * Math.PI;
    const secondAngle = Math.PI / 2 + ((index + 1) / spineSegments) * Math.PI;
    const first = [
      -halfWidth + Math.cos(firstAngle) * outerSpineRadius,
      Math.sin(firstAngle) * outerHalfDepth
    ];
    const second = [
      -halfWidth + Math.cos(secondAngle) * outerSpineRadius,
      Math.sin(secondAngle) * outerHalfDepth
    ];
    const firstNormal = new THREE.Vector3(
      Math.cos(firstAngle) / outerSpineRadius,
      0,
      Math.sin(firstAngle) / outerHalfDepth
    ).normalize().toArray();
    const secondNormal = new THREE.Vector3(
      Math.cos(secondAngle) / outerSpineRadius,
      0,
      Math.sin(secondAngle) / outerHalfDepth
    ).normalize().toArray();
    const firstU = (outerHalfDepth + first[1]) / (outerHalfDepth * 2);
    const secondU = (outerHalfDepth + second[1]) / (outerHalfDepth * 2);
    appendQuad(
      [
        [first[0], -halfHeight, first[1]],
        [second[0], -halfHeight, second[1]],
        [first[0], halfHeight, first[1]],
        [second[0], halfHeight, second[1]]
      ],
      [firstNormal, secondNormal, firstNormal, secondNormal],
      [
        [firstU, 0],
        [secondU, 0],
        [firstU, 1],
        [secondU, 1]
      ],
      true
    );
  }
  endMaterial(group);

  group = beginMaterial(2);
  appendQuad(
    [
      [-halfWidth, -halfHeight, -outerHalfDepth],
      [halfWidth, -halfHeight, -outerHalfDepth],
      [-halfWidth, halfHeight, -outerHalfDepth],
      [halfWidth, halfHeight, -outerHalfDepth]
    ],
    Array(4).fill([0, 0, -1]),
    [[1, 0], [0, 0], [1, 1], [0, 1]],
    true
  );
  endMaterial(group);

  // The inner lining follows the same continuous curve, slightly inset.
  group = beginMaterial(4);
  appendQuad(
    [
      [-halfWidth, -halfHeight, innerHalfDepth],
      [halfWidth, -halfHeight, innerHalfDepth],
      [-halfWidth, halfHeight, innerHalfDepth],
      [halfWidth, halfHeight, innerHalfDepth]
    ],
    Array(4).fill([0, 0, -1]),
    [[0, 0], [1, 0], [0, 1], [1, 1]]
  );
  for (let index = 0; index < spineSegments; index += 1) {
    const firstAngle = Math.PI / 2 + (index / spineSegments) * Math.PI;
    const secondAngle = Math.PI / 2 + ((index + 1) / spineSegments) * Math.PI;
    const first = [
      -halfWidth + Math.cos(firstAngle) * innerSpineRadius,
      Math.sin(firstAngle) * innerHalfDepth
    ];
    const second = [
      -halfWidth + Math.cos(secondAngle) * innerSpineRadius,
      Math.sin(secondAngle) * innerHalfDepth
    ];
    const firstNormal = new THREE.Vector3(
      -Math.cos(firstAngle) / innerSpineRadius,
      0,
      -Math.sin(firstAngle) / innerHalfDepth
    ).normalize().toArray();
    const secondNormal = new THREE.Vector3(
      -Math.cos(secondAngle) / innerSpineRadius,
      0,
      -Math.sin(secondAngle) / innerHalfDepth
    ).normalize().toArray();
    appendQuad(
      [
        [first[0], -halfHeight, first[1]],
        [second[0], -halfHeight, second[1]],
        [first[0], halfHeight, first[1]],
        [second[0], halfHeight, second[1]]
      ],
      [firstNormal, secondNormal, firstNormal, secondNormal],
      [[0, 0], [1, 0], [0, 1], [1, 1]]
    );
  }
  appendQuad(
    [
      [-halfWidth, -halfHeight, -innerHalfDepth],
      [halfWidth, -halfHeight, -innerHalfDepth],
      [-halfWidth, halfHeight, -innerHalfDepth],
      [halfWidth, halfHeight, -innerHalfDepth]
    ],
    Array(4).fill([0, 0, 1]),
    [[0, 0], [1, 0], [0, 1], [1, 1]]
  );
  endMaterial(group);

  const outerPath = [[halfWidth, outerHalfDepth], [-halfWidth, outerHalfDepth]];
  const innerPath = [[halfWidth, innerHalfDepth], [-halfWidth, innerHalfDepth]];
  for (let index = 1; index <= spineSegments; index += 1) {
    const angle = Math.PI / 2 + (index / spineSegments) * Math.PI;
    outerPath.push([
      -halfWidth + Math.cos(angle) * outerSpineRadius,
      Math.sin(angle) * outerHalfDepth
    ]);
    innerPath.push([
      -halfWidth + Math.cos(angle) * innerSpineRadius,
      Math.sin(angle) * innerHalfDepth
    ]);
  }
  outerPath.push([halfWidth, -outerHalfDepth]);
  innerPath.push([halfWidth, -innerHalfDepth]);

  // Flush top, bottom and fore-edge thicknesses close the single cover shell.
  group = beginMaterial(3);
  for (let index = 0; index < outerPath.length - 1; index += 1) {
    const outerA = outerPath[index];
    const outerB = outerPath[index + 1];
    const innerA = innerPath[index];
    const innerB = innerPath[index + 1];
    appendQuad(
      [
        [outerA[0], halfHeight, outerA[1]],
        [outerB[0], halfHeight, outerB[1]],
        [innerA[0], halfHeight, innerA[1]],
        [innerB[0], halfHeight, innerB[1]]
      ],
      Array(4).fill([0, 1, 0]),
      [[0, 0], [1, 0], [0, 1], [1, 1]]
    );
    appendQuad(
      [
        [outerA[0], -halfHeight, outerA[1]],
        [outerB[0], -halfHeight, outerB[1]],
        [innerA[0], -halfHeight, innerA[1]],
        [innerB[0], -halfHeight, innerB[1]]
      ],
      Array(4).fill([0, -1, 0]),
      [[0, 0], [1, 0], [0, 1], [1, 1]]
    );
  }
  appendQuad(
    [
      [halfWidth, -halfHeight, outerHalfDepth],
      [halfWidth, -halfHeight, innerHalfDepth],
      [halfWidth, halfHeight, outerHalfDepth],
      [halfWidth, halfHeight, innerHalfDepth]
    ],
    Array(4).fill([1, 0, 0]),
    [[0, 0], [1, 0], [0, 1], [1, 1]]
  );
  appendQuad(
    [
      [halfWidth, -halfHeight, -innerHalfDepth],
      [halfWidth, -halfHeight, -outerHalfDepth],
      [halfWidth, halfHeight, -innerHalfDepth],
      [halfWidth, halfHeight, -outerHalfDepth]
    ],
    Array(4).fill([1, 0, 0]),
    [[0, 0], [1, 0], [0, 1], [1, 1]]
  );
  endMaterial(group);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  for (const currentGroup of groups) {
    geometry.addGroup(currentGroup.start, currentGroup.count, currentGroup.materialIndex);
  }
  geometry.computeBoundingSphere();
  return weldMatchingVertices(geometry);
}

function weldMatchingVertices(geometry, tolerance = 0.00001) {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const textureCoordinates = geometry.getAttribute('uv');
  const sourceIndex = geometry.getIndex();
  const precision = 1 / tolerance;
  const vertexMap = new Map();
  const remap = new Uint32Array(position.count);
  const weldedPositions = [];
  const weldedNormals = [];
  const weldedUv = [];

  for (let index = 0; index < position.count; index += 1) {
    const values = [
      position.getX(index), position.getY(index), position.getZ(index),
      normal.getX(index), normal.getY(index), normal.getZ(index),
      textureCoordinates.getX(index), textureCoordinates.getY(index)
    ];
    const key = values.map((value) => Math.round(value * precision)).join(':');
    let weldedIndex = vertexMap.get(key);
    if (weldedIndex === undefined) {
      weldedIndex = weldedPositions.length / 3;
      vertexMap.set(key, weldedIndex);
      weldedPositions.push(values[0], values[1], values[2]);
      weldedNormals.push(values[3], values[4], values[5]);
      weldedUv.push(values[6], values[7]);
    }
    remap[index] = weldedIndex;
  }

  const weldedIndices = Array.from(sourceIndex.array, (index) => remap[index]);
  const welded = new THREE.BufferGeometry();
  welded.setAttribute('position', new THREE.Float32BufferAttribute(weldedPositions, 3));
  welded.setAttribute('normal', new THREE.Float32BufferAttribute(weldedNormals, 3));
  welded.setAttribute('uv', new THREE.Float32BufferAttribute(weldedUv, 2));
  welded.setIndex(weldedIndices);
  for (const group of geometry.groups) {
    welded.addGroup(group.start, group.count, group.materialIndex);
  }
  welded.computeBoundingSphere();
  return welded;
}

function createFlatPageBlockGeometry({
  height,
  foreEdgeX,
  halfDepth,
  spineX,
  foreEdgeBow,
  foreEdgeSegments
}) {
  const halfHeight = height / 2;
  const outline = [
    [foreEdgeX, halfDepth],
    [spineX, halfDepth],
    [spineX, -halfDepth]
  ];
  for (let index = 0; index < foreEdgeSegments; index += 1) {
    const depthRatio = index / foreEdgeSegments;
    const z = -halfDepth + depthRatio * halfDepth * 2;
    const bow = Math.cos((depthRatio - 0.5) * Math.PI) * foreEdgeBow;
    outline.push([foreEdgeX + bow, z]);
  }

  const positions = [];
  const uv = [];
  const indices = [];
  const cumulative = [0];
  for (let index = 1; index < outline.length; index += 1) {
    const dx = outline[index][0] - outline[index - 1][0];
    const dz = outline[index][1] - outline[index - 1][1];
    cumulative.push(cumulative[index - 1] + Math.hypot(dx, dz));
  }
  const closingLength = Math.hypot(
    outline[0][0] - outline[outline.length - 1][0],
    outline[0][1] - outline[outline.length - 1][1]
  );
  const perimeter = cumulative[cumulative.length - 1] + closingLength;

  for (let index = 0; index < outline.length; index += 1) {
    const [x, z] = outline[index];
    const u = cumulative[index] / perimeter;
    positions.push(x, -halfHeight, z, x, halfHeight, z);
    uv.push(u, 0, u, 1);
  }
  for (let index = 0; index < outline.length; index += 1) {
    const next = (index + 1) % outline.length;
    const a = index * 2;
    const b = a + 1;
    const c = next * 2;
    const d = c + 1;
    indices.push(a, c, b, c, d, b);
  }

  const capCenterX = (foreEdgeX + spineX) / 2;
  for (const capY of [-halfHeight, halfHeight]) {
    const centerIndex = positions.length / 3;
    positions.push(capCenterX, capY, 0);
    uv.push(0.5, 0.5);
    const ringStart = positions.length / 3;
    for (const [x, z] of outline) {
      positions.push(x, capY, z);
      uv.push(
        (x - spineX) / (foreEdgeX - spineX),
        (z + halfDepth) / (halfDepth * 2)
      );
    }
    for (let index = 0; index < outline.length; index += 1) {
      const next = (index + 1) % outline.length;
      if (capY > 0) indices.push(centerIndex, ringStart + index, ringStart + next);
      else indices.push(centerIndex, ringStart + next, ringStart + index);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function addVisiblePageLayers(book) {
  const positions = [];
  const layerCount = 36;
  const spineX = -10.7;
  const halfDepth = 0.55;
  for (let index = 1; index < layerCount; index += 1) {
    const z = -halfDepth + (index / layerCount) * halfDepth * 2;
    const depthRatio = (z + halfDepth) / (halfDepth * 2);
    const foreEdgeX = 10.2 + Math.cos((depthRatio - 0.5) * Math.PI) * 0.075;
    positions.push(foreEdgeX + 0.001, -10.08, z, foreEdgeX + 0.001, 10.08, z);
    positions.push(spineX, -10.08, z, spineX, 10.08, z);
    positions.push(spineX + 0.025, 10.16, z, foreEdgeX, 10.16, z);
    positions.push(spineX + 0.025, -10.16, z, foreEdgeX, -10.16, z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xaaa398,
    transparent: true,
    opacity: 0.46
  });
  const layers = new THREE.LineSegments(geometry, material);
  layers.renderOrder = 2;
  book.add(layers);
}

function loadArtwork(loader, url, anisotropy) {
  return new Promise((resolve, reject) => {
    loader.load(url.href, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = anisotropy;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      resolve(texture);
    }, undefined, reject);
  });
}

function createClothBump(anisotropy) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);

  let noiseState = 4173;
  const nextNoise = () => {
    noiseState = (noiseState * 1664525 + 1013904223) >>> 0;
    return noiseState / 4294967296;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const weave = Math.sin(x * 0.82) * 5.5 + Math.sin(y * 0.84) * 5.5;
      const diagonal = Math.sin((x + y) * 0.37) * 2.2;
      const noise = (nextNoise() - 0.5) * 4.5;
      const value = Math.max(0, Math.min(255, 128 + weave + diagonal + noise));
      const offset = (y * size + x) * 4;
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(24, 24);
  texture.anisotropy = anisotropy;
  return texture;
}

function createPageEdgeTexture(anisotropy, useColour) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  context.fillStyle = useColour ? '#eeeae1' : '#808080';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let x = 1; x < canvas.width; x += 3) {
    const strength = x % 12 === 1 ? 0.3 : 0.14;
    context.fillStyle = useColour ? `rgba(121, 113, 101, ${strength})` : `rgba(40, 40, 40, ${strength + 0.12})`;
    context.fillRect(x, 0, 1, canvas.height);
  }
  for (let y = 4; y < canvas.height; y += 13) {
    context.fillStyle = useColour ? 'rgba(255, 255, 255, 0.12)' : 'rgba(220, 220, 220, 0.08)';
    context.fillRect(0, y, canvas.width, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1.5);
  texture.anisotropy = anisotropy;
  if (useColour) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function installInteraction(viewer, renderer, scene, camera, book, cameraOptions) {
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

  function rotateBook(deltaX, deltaY) {
    yaw.setFromAxisAngle(worldY, deltaX);
    pitch.setFromAxisAngle(localX, deltaY);
    book.quaternion.premultiply(yaw).multiply(pitch).normalize();
  }

  function draw(now) {
    frameId = 0;
    const elapsed = Math.min((now - lastFrameTime) / 16.667, 3);
    lastFrameTime = now;

    if (!dragging && (Math.abs(velocityX) > 0.00002 || Math.abs(velocityY) > 0.00002)) {
      rotateBook(velocityX * elapsed, velocityY * elapsed);
      const damping = Math.pow(reducedMotion ? 0.7 : 0.928, elapsed);
      velocityX *= damping;
      velocityY *= damping;
      requestDraw();
    }

    renderer.render(scene, camera);
  }

  function requestDraw() {
    if (!frameId) {
      lastFrameTime = performance.now();
      frameId = requestAnimationFrame(draw);
    }
  }

  function resize() {
    const { width, height } = viewer.getBoundingClientRect();
    if (!width || !height) return;
    const mobile = width < 640;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = mobile ? cameraOptions.mobileCameraZ : cameraOptions.desktopCameraZ;
    camera.updateProjectionMatrix();
    requestDraw();
  }

  function beginDrag(event) {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    velocityX = 0;
    velocityY = 0;
    viewer.classList.add('has-interacted');
    viewer.setPointerCapture(event.pointerId);
    requestDraw();
  }

  function moveDrag(event) {
    if (!dragging) return;
    const bounds = viewer.getBoundingClientRect();
    const sensitivity = 3.7 / Math.max(Math.min(bounds.width, bounds.height), 180);
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    velocityX = dx * sensitivity;
    velocityY = dy * sensitivity;
    rotateBook(velocityX, velocityY);
    requestDraw();
  }

  function endDrag(event) {
    if (!dragging) return;
    dragging = false;
    if (viewer.hasPointerCapture(event.pointerId)) viewer.releasePointerCapture(event.pointerId);
    requestDraw();
  }

  function handleKeyboard(event) {
    const step = event.shiftKey ? 0.16 : 0.085;
    let horizontal = 0;
    let vertical = 0;
    if (event.key === 'ArrowLeft') horizontal = -step;
    if (event.key === 'ArrowRight') horizontal = step;
    if (event.key === 'ArrowUp') vertical = -step;
    if (event.key === 'ArrowDown') vertical = step;
    if (!horizontal && !vertical) return;
    event.preventDefault();
    viewer.classList.add('has-interacted');
    velocityX = horizontal;
    velocityY = vertical;
    rotateBook(horizontal, vertical);
    requestDraw();
  }

  viewer.addEventListener('pointerdown', beginDrag);
  viewer.addEventListener('pointermove', moveDrag);
  viewer.addEventListener('pointerup', endDrag);
  viewer.addEventListener('pointercancel', endDrag);
  viewer.addEventListener('keydown', handleKeyboard);
  new ResizeObserver(resize).observe(viewer);
  resize();
  renderer.render(scene, camera);
}
