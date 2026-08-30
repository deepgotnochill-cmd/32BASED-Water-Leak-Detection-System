import * as THREE from 'three';
import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';
import { createPredictionAdapter } from './integration.js';

const scenarioMap = {
  NORMAL: {
    label: 'NORMAL',
    leakStatus: 'NO LEAK',
    zone: 'NONE',
    confidence: 0,
    reason: 'No sustained anomaly detected.',
    alertTitle: '✓ SYSTEM NORMAL',
    explain: [
      '✓ Flow deviation within baseline.',
      '✓ Pressure deviation within baseline.',
      '✓ No persistent anomaly detected.',
      '✓ Neighboring nodes consistent.',
      '✓ Leak zone not required.'
    ],
    probableLeak: 'NONE',
    nodes: [
      { flow: 20.1, pressure: 3.4, status: 'NORMAL', health: 'HEALTHY' },
      { flow: 20.0, pressure: 3.3, status: 'NORMAL', health: 'HEALTHY' },
      { flow: 20.0, pressure: 3.3, status: 'NORMAL', health: 'HEALTHY' },
      { flow: 20.1, pressure: 3.4, status: 'NORMAL', health: 'HEALTHY' }
    ]
  },
  LEAK_BC: {
    label: 'LEAK B-C',
    leakStatus: 'LEAK DETECTED',
    zone: 'NODE B → NODE C',
    confidence: 87,
    reason: 'Sustained correlated flow and pressure anomaly detected.',
    alertTitle: '⚠ LEAK DETECTED',
    explain: [
      '✓ Flow deviation detected.',
      '✓ Pressure deviation detected.',
      '✓ Anomaly persisted across samples.',
      '✓ Neighboring node corroborated event.',
      '✓ Leak zone estimated at B-C.'
    ],
    probableLeak: 'NODE B → NODE C',
    nodes: [
      { flow: 20.1, pressure: 3.4, status: 'NORMAL', health: 'HEALTHY' },
      { flow: 17.2, pressure: 2.8, status: 'WARNING', health: 'WARNING' },
      { flow: 16.9, pressure: 2.7, status: 'CRITICAL', health: 'CRITICAL' },
      { flow: 20.0, pressure: 3.3, status: 'NORMAL', health: 'HEALTHY' }
    ]
  },
  LEAK_CD: {
    label: 'LEAK C-D',
    leakStatus: 'LEAK DETECTED',
    zone: 'NODE C → NODE D',
    confidence: 82,
    reason: 'Downstream pressure loss and flow reduction indicate a leak near C-D.',
    alertTitle: '⚠ LEAK DETECTED',
    explain: [
      '✓ Flow reduction observed downstream.',
      '✓ Pressure loss persisted.',
      '✓ Downstream node corroboration confirmed.',
      '✓ Identified leak zone between C and D.',
      '✓ Probability estimate based on sustained pattern.'
    ],
    probableLeak: 'NODE C → NODE D',
    nodes: [
      { flow: 20.2, pressure: 3.4, status: 'NORMAL', health: 'HEALTHY' },
      { flow: 19.7, pressure: 3.2, status: 'NORMAL', health: 'HEALTHY' },
      { flow: 17.1, pressure: 2.8, status: 'WARNING', health: 'WARNING' },
      { flow: 16.8, pressure: 2.6, status: 'CRITICAL', health: 'CRITICAL' }
    ]
  },
  TRANSIENT: {
    label: 'TRANSIENT',
    leakStatus: 'NO CONFIRMED LEAK',
    zone: 'NONE',
    confidence: 18,
    reason: 'Temporary fluctuation fell below sustained leak threshold.',
    alertTitle: '⚠ TEMPORARY DISTURBANCE',
    explain: [
      '✓ Brief fluctuation observed.',
      '✓ Deviation not sustained over time.',
      '✓ No confirmed leak pattern developed.',
      '✓ No neighboring corroboration sustained.',
      '✓ System filtered this as a transient event.'
    ],
    probableLeak: 'NONE',
    nodes: [
      { flow: 19.9, pressure: 3.2, status: 'NORMAL', health: 'HEALTHY' },
      { flow: 18.8, pressure: 3.1, status: 'WARNING', health: 'WARNING' },
      { flow: 19.8, pressure: 3.2, status: 'NORMAL', health: 'HEALTHY' },
      { flow: 20.1, pressure: 3.3, status: 'NORMAL', health: 'HEALTHY' }
    ]
  }
};

const nodeOrder = ['A', 'B', 'C', 'D'];
const defaultScenario = 'NORMAL';
let currentScenario = defaultScenario;
const predictionAdapter = createPredictionAdapter({ demoScenarios: scenarioMap });

const sceneState = {
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  root: null,
  pipeSections: [],
  nodeMeshes: [],
  leakGroup: null,
  flowBeads: [],
  tank: null,
  outlet: null,
  labelSprites: [],
  overview: {
    position: new THREE.Vector3(26, 12.5, 24),
    target: new THREE.Vector3(0, 2.1, 0)
  },
  sensorPositions: [
    new THREE.Vector3(-14.5, 1.9, 0),
    new THREE.Vector3(-8.1, 1.9, 0),
    new THREE.Vector3(-1.8, 1.9, 0),
    new THREE.Vector3(5.2, 1.9, 0)
  ],
  pipePathPoints: [
    new THREE.Vector3(-20.5, 1.8, 0),
    new THREE.Vector3(-14.5, 1.8, 0),
    new THREE.Vector3(-8.1, 1.8, 0),
    new THREE.Vector3(-1.8, 1.8, 0),
    new THREE.Vector3(5.2, 1.8, 0),
    new THREE.Vector3(12.8, 1.8, 0)
  ]
};

const sensorColors = {
  NORMAL: '#34d399',
  WARNING: '#fbbf24',
  CRITICAL: '#ef4444'
};

function setScenario(scenarioKey) {
  if (!scenarioMap[scenarioKey]) {
    return;
  }
  currentScenario = scenarioKey;
  renderScenario();
}

function resetDemo() {
  currentScenario = defaultScenario;
  renderScenario();
}

function updateSystemSummary(scenario) {
  const statusEl = document.getElementById('systemStatus');
  const scenarioEl = document.getElementById('currentScenario');
  const leakStatusEl = document.getElementById('leakStatus');
  const zoneEl = document.getElementById('suspectedZone');
  const confidenceEl = document.getElementById('confidence');
  const flowEl = document.getElementById('systemFlow');
  const pressureEl = document.getElementById('systemPressure');
  const alertTitleEl = document.getElementById('alertTitle');
  const alertZoneEl = document.getElementById('alertZone');
  const alertConfidenceEl = document.getElementById('alertConfidence');
  const alertReasonEl = document.getElementById('alertReason');
  const explainListEl = document.getElementById('explainList');
  const probableLeakEl = document.getElementById('probableLeak');

  const avgFlow = scenario.nodes.reduce((sum, node) => sum + node.flow, 0) / scenario.nodes.length;
  const avgPressure = scenario.nodes.reduce((sum, node) => sum + node.pressure, 0) / scenario.nodes.length;

  statusEl.textContent = scenario.label === 'NORMAL' ? 'NORMAL' : (scenario.leakStatus.includes('LEAK') ? 'ALERT' : 'DISTURBANCE');
  scenarioEl.textContent = scenario.label;
  leakStatusEl.textContent = scenario.leakStatus;
  zoneEl.textContent = scenario.zone;
  confidenceEl.textContent = `${scenario.confidence}%`;
  flowEl.textContent = `${avgFlow.toFixed(1)} L/min`;
  pressureEl.textContent = `${avgPressure.toFixed(1)} bar`;

  alertTitleEl.textContent = scenario.alertTitle;
  alertZoneEl.textContent = scenario.zone;
  alertConfidenceEl.textContent = `${scenario.confidence}%`;
  alertReasonEl.textContent = scenario.reason;
  explainListEl.innerHTML = scenario.explain.map((line) => `<li>${line}</li>`).join('');
  probableLeakEl.textContent = scenario.probableLeak;

  const sceneSystem = document.getElementById('sceneSystem');
  const sceneFlow = document.getElementById('sceneFlow');
  const scenePressure = document.getElementById('scenePressure');
  const sceneZone = document.getElementById('sceneZone');
  const sceneConfidence = document.getElementById('sceneConfidence');

  sceneSystem.textContent = scenario.label === 'NORMAL' ? 'NORMAL' : (scenario.leakStatus.includes('LEAK') ? 'LEAK DETECTED' : 'DISTURBANCE');
  sceneFlow.textContent = `${avgFlow.toFixed(1)} L/min`;
  scenePressure.textContent = `${avgPressure.toFixed(1)} bar`;
  sceneZone.textContent = scenario.zone;
  sceneConfidence.textContent = `${scenario.confidence}%`;
}

function updatePredictionPanel(prediction) {
  document.getElementById('predictionStatus').textContent = prediction.predictionStatus;
  document.getElementById('predictionProbability').textContent = `${prediction.leakProbability}%`;
  document.getElementById('predictionConfidence').textContent = `${prediction.confidence}%`;
  document.getElementById('predictionZone').textContent = prediction.leakZone;
  document.getElementById('predictionReason').textContent = prediction.reason;
  document.getElementById('predictionMode').textContent = prediction.mode;
}

function buildChartPoints(values, width, height, min, max) {
  const spacing = width / (values.length - 1);
  const range = max - min || 1;
  return values.map((value, index) => {
    const x = index * spacing;
    const normalized = (value - min) / range;
    const y = height - normalized * height;
    return `${x},${y}`;
  }).join(' ');
}

function renderChart(svgId, values, strokeColor, min, max) {
  const svg = document.getElementById(svgId);
  svg.innerHTML = '';

  const width = 360;
  const height = 170;
  const margin = 15;
  const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  for (let i = 0; i < 4; i++) {
    const y = margin + (i * (height - margin * 2)) / 3;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', margin);
    line.setAttribute('y1', y);
    line.setAttribute('x2', width - margin);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', 'rgba(148,163,184,0.18)');
    gridGroup.appendChild(line);
  }
  svg.appendChild(gridGroup);

  const points = buildChartPoints(values, width - margin * 2, height - margin * 2, min, max);
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', strokeColor);
  polyline.setAttribute('stroke-width', '3');
  polyline.setAttribute('points', `${margin},${height - margin} ${points}`);
  svg.appendChild(polyline);

  const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  axis.setAttribute('x1', margin);
  axis.setAttribute('y1', height - margin);
  axis.setAttribute('x2', width - margin);
  axis.setAttribute('y2', height - margin);
  axis.setAttribute('stroke', 'rgba(148,163,184,0.25)');
  svg.appendChild(axis);
}

function updateNodeCards(scenario) {
  const cardEls = document.querySelectorAll('[data-node-card]');
  cardEls.forEach((cardEl, index) => {
    const node = scenario.nodes[index];
    const title = cardEl.querySelector('.node-card-header span');
    const tag = cardEl.querySelector('.tag');
    const metrics = cardEl.querySelectorAll('.metric-line strong');

    const stateClass = node.status === 'NORMAL' ? 'normal' : node.status === 'WARNING' ? 'warning' : 'critical';
    cardEl.className = `node-card ${stateClass}`;

    const label = nodeOrder[index];
    title.textContent = `NODE ${label}`;
    tag.textContent = node.status;
    metrics[0].textContent = `${node.flow.toFixed(1)} L/min`;
    metrics[1].textContent = `${node.pressure.toFixed(1)} bar`;
    metrics[2].textContent = node.status;
    metrics[3].textContent = node.health;
  });
}

function createLabelSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(6, 17, 27, 0.86)';
  ctx.fillRect(12, 24, 232, 80);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 24, 232, 80);
  ctx.fillStyle = '#e6f3ff';
  ctx.font = '700 26px Segoe UI';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5.6, 2.8, 1);
  return sprite;
}

function makeCylinderPipe(length, radius, color, emissive = 0x000000) {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 20, 1, false);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive,
    metalness: 0.18,
    roughness: 0.38,
    transparent: true,
    opacity: 1
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

function makeTank() {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(4.3, 4.7, 7.6, 32, 1, false),
    new THREE.MeshStandardMaterial({ color: 0x7db8d9, metalness: 0.22, roughness: 0.38, transparent: true, opacity: 0.9 })
  );
  base.position.set(-19.2, 3.9, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(4.8, 4.8, 0.9, 32),
    new THREE.MeshStandardMaterial({ color: 0xcfe8ff, metalness: 0.3, roughness: 0.24 })
  );
  cap.position.set(-19.2, 7.7, 0);
  cap.castShadow = true;
  group.add(cap);

  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 3.8, 5.9, 32),
    new THREE.MeshStandardMaterial({ color: 0x5eead4, emissive: 0x0b3d41, metalness: 0.1, roughness: 0.25, transparent: true, opacity: 0.85 })
  );
  liquid.position.set(-19.2, 3.9, 0);
  group.add(liquid);

  const inlet = makeCylinderPipe(1.6, 0.52, 0x9ad7ff, 0x10374a);
  inlet.position.set(-16.3, 1.8, 0);
  group.add(inlet);

  return group;
}

function makeOutlet() {
  const group = new THREE.Group();

  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.45, 4.1, 24),
    new THREE.MeshStandardMaterial({ color: 0x9ad7ff, metalness: 0.28, roughness: 0.32 })
  );
  nozzle.rotation.z = Math.PI / 2;
  nozzle.position.set(16.4, 1.8, 0);
  nozzle.castShadow = true;
  group.add(nozzle);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.3, 0.2, 18, 32),
    new THREE.MeshStandardMaterial({ color: 0x8fd3ff, metalness: 0.6, roughness: 0.25 })
  );
  rim.rotation.y = Math.PI / 2;
  rim.position.set(18.6, 1.8, 0);
  group.add(rim);

  const outletBody = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 2.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x6ea9d8, metalness: 0.3, roughness: 0.42 })
  );
  outletBody.position.set(13.8, 1.3, 0);
  outletBody.rotation.z = Math.PI / 2;
  outletBody.castShadow = true;
  group.add(outletBody);

  return group;
}

function makeSensor(name, position, status) {
  const group = new THREE.Group();
  const color = sensorColors[status] || '#34d399';

  const pipeStub = makeCylinderPipe(1.2, 0.28, 0x94a3b8, 0x1e293b);
  pipeStub.position.set(0, 0, 0);
  group.add(pipeStub);

  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 1.8, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.5, roughness: 0.38 })
  );
  housing.position.set(0, 1.6, 0);
  housing.castShadow = true;
  group.add(housing);

  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 1.4, 24),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, metalness: 0.25, roughness: 0.28 })
  );
  core.rotation.z = Math.PI / 2;
  core.position.set(0, 1.6, 0);
  core.castShadow = true;
  group.add(core);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.28, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x0b1220, metalness: 0.7, roughness: 0.3 })
  );
  plate.position.set(0, 2.55, 0);
  group.add(plate);

  const label = createLabelSprite(`NODE ${name}`, '#67e8f9');
  label.position.set(0, 5.0, 0);
  group.add(label);

  group.position.copy(position);
  group.rotation.y = -0.14;
  return group;
}

function createScene() {
  const container = document.getElementById('threeContainer');
  if (!container) return;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth || 760, container.clientHeight || 420, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071421);

  const camera = new THREE.PerspectiveCamera(36, (container.clientWidth || 760) / (container.clientHeight || 420), 0.1, 220);
  camera.position.copy(sceneState.overview.position);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.8;
  controls.zoomSpeed = 0.8;
  controls.minDistance = 16;
  controls.maxDistance = 52;
  controls.minPolarAngle = Math.PI * 0.2;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.target.copy(sceneState.overview.target);
  controls.update();

  const root = new THREE.Group();
  scene.add(root);

  const ambient = new THREE.AmbientLight(0xe0f2fe, 0.9);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(18, 26, 14);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -28;
  keyLight.shadow.camera.right = 28;
  keyLight.shadow.camera.top = 24;
  keyLight.shadow.camera.bottom = -24;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x67e8f9, 0.95);
  fillLight.position.set(-18, 12, -12);
  scene.add(fillLight);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(32, 80),
    new THREE.MeshStandardMaterial({ color: 0x0b1724, roughness: 1, metalness: 0.14 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.75;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(56, 48, 0x22d3ee, 0x1e3a4d);
  grid.position.y = -0.7;
  grid.material.opacity = 0.45;
  grid.material.transparent = true;
  scene.add(grid);

  sceneState.renderer = renderer;
  sceneState.scene = scene;
  sceneState.camera = camera;
  sceneState.controls = controls;
  sceneState.root = root;

  const tank = makeTank();
  const outlet = makeOutlet();
  scene.add(tank);
  scene.add(outlet);
  sceneState.tank = tank;
  sceneState.outlet = outlet;

  const pipeSegments = [
    { start: new THREE.Vector3(-18.8, 1.8, 0), end: new THREE.Vector3(-14.5, 1.8, 0), color: 0x67e8f9 },
    { start: new THREE.Vector3(-14.5, 1.8, 0), end: new THREE.Vector3(-8.1, 1.8, 0), color: 0x67e8f9 },
    { start: new THREE.Vector3(-8.1, 1.8, 0), end: new THREE.Vector3(-1.8, 1.8, 0), color: 0x67e8f9 },
    { start: new THREE.Vector3(-1.8, 1.8, 0), end: new THREE.Vector3(5.2, 1.8, 0), color: 0x67e8f9 },
    { start: new THREE.Vector3(5.2, 1.8, 0), end: new THREE.Vector3(12.8, 1.8, 0), color: 0x67e8f9 }
  ];

  sceneState.pipeSections = pipeSegments.map(({ start, end, color }) => {
    const delta = new THREE.Vector3().subVectors(end, start);
    const length = delta.length();
    const pipe = makeCylinderPipe(length, 0.62, color, 0x0d3d4d);
    pipe.position.copy(start).add(delta.clone().multiplyScalar(0.5));
    pipe.castShadow = true;
    pipe.receiveShadow = true;
    scene.add(pipe);
    return pipe;
  });

  const connectors = [
    new THREE.Vector3(-14.5, 1.8, 0),
    new THREE.Vector3(-8.1, 1.8, 0),
    new THREE.Vector3(-1.8, 1.8, 0),
    new THREE.Vector3(5.2, 1.8, 0)
  ];

  connectors.forEach((position) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.82, 0.12, 14, 34),
      new THREE.MeshStandardMaterial({ color: 0xdbeafe, metalness: 0.6, roughness: 0.3 })
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.copy(position);
    ring.castShadow = true;
    scene.add(ring);
  });

  const nodeMeshes = nodeOrder.map((name, index) => {
    const mesh = makeSensor(name, sceneState.sensorPositions[index], 'NORMAL');
    scene.add(mesh);
    return mesh;
  });
  sceneState.nodeMeshes = nodeMeshes;

  const leakGroup = new THREE.Group();
  const leakCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 28, 28),
    new THREE.MeshStandardMaterial({ color: 0xff4d4d, emissive: 0xff4d4d, emissiveIntensity: 0.75, transparent: true, opacity: 0.85 })
  );
  leakCore.position.set(0, 1.9, 0);
  leakGroup.add(leakCore);

  for (let i = 0; i < 12; i += 1) {
    const droplet = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 + (i % 4) * 0.08, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xff9aa2, emissive: 0xff4d4d, emissiveIntensity: 0.6, transparent: true, opacity: 0.7 })
    );
    const angle = (i / 12) * Math.PI * 2;
    droplet.position.set(Math.cos(angle) * (0.8 + (i % 4) * 0.35), 1.2 + (i % 3) * 0.25, Math.sin(angle) * 0.8);
    leakGroup.add(droplet);
  }
  leakGroup.visible = false;
  scene.add(leakGroup);
  sceneState.leakGroup = leakGroup;

  const flowBeads = Array.from({ length: 18 }, (_, i) => {
    const bead = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x4fd1ff, emissiveIntensity: 0.7 })
    );
    bead.visible = true;
    scene.add(bead);
    return bead;
  });
  sceneState.flowBeads = flowBeads;

  window.addEventListener('resize', () => {
    const rect = container.getBoundingClientRect();
    const width = Math.max(320, rect.width || 760);
    const height = Math.max(260, rect.height || 420);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  });
}

function resetCameraView() {
  if (!sceneState.camera || !sceneState.controls) return;
  sceneState.camera.position.copy(sceneState.overview.position);
  sceneState.controls.target.copy(sceneState.overview.target);
  sceneState.controls.update();
}

function colorPipeSegment(index, colorValue) {
  if (!sceneState.pipeSections[index]) return;
  const material = sceneState.pipeSections[index].material;
  material.color.set(colorValue);
  material.emissive.set(colorValue === '#ef4444' ? 0x3d0b0b : colorValue === '#fbbf24' ? 0x362702 : 0x0f3a4d);
  material.emissiveIntensity = colorValue === '#ef4444' ? 0.7 : colorValue === '#fbbf24' ? 0.4 : 0.2;
}

function updateThreeSceneForScenario(scenario) {
  if (!sceneState.nodeMeshes.length) return;

  const statusMap = scenario.nodes.map((node) => node.status);
  nodeOrder.forEach((label, index) => {
    const mesh = sceneState.nodeMeshes[index];
    if (!mesh) return;
    const status = statusMap[index];
    const color = sensorColors[status] || '#34d399';
    const core = mesh.children[2];
    if (core && core.material) {
      core.material.color.set(color);
      core.material.emissive.set(color);
      core.material.emissiveIntensity = status === 'CRITICAL' ? 0.9 : 0.4;
    }
    const labelSprite = mesh.children[3];
    if (labelSprite) {
      labelSprite.material.opacity = 0.96;
    }
  });

  const pipeColors = [
    '#67e8f9',
    '#67e8f9',
    '#67e8f9',
    '#67e8f9',
    '#67e8f9'
  ];

  if (scenario.label === 'LEAK B-C') {
    pipeColors[2] = '#ef4444';
  }
  if (scenario.label === 'LEAK C-D') {
    pipeColors[3] = '#ef4444';
  }
  if (scenario.label === 'TRANSIENT') {
    pipeColors.fill('#fbbf24');
  }

  pipeColors.forEach((color, index) => {
    colorPipeSegment(index, color);
  });

  if (scenario.label === 'LEAK B-C') {
    sceneState.leakGroup.visible = true;
    sceneState.leakGroup.position.set(-2.8, 0, 0.1);
  } else if (scenario.label === 'LEAK C-D') {
    sceneState.leakGroup.visible = true;
    sceneState.leakGroup.position.set(2.8, 0, 0.1);
  } else {
    sceneState.leakGroup.visible = false;
  }
}

function animateFlow(scenario) {
  if (!sceneState.flowBeads.length) return;

  const points = sceneState.pipePathPoints;
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.15);
  const now = performance.now() * 0.001;
  const cycle = 10.5;
  const accent = scenario.label === 'TRANSIENT' ? '#fbbf24' : scenario.label.includes('LEAK') ? '#ef4444' : '#7dd3fc';

  sceneState.flowBeads.forEach((bead, index) => {
    const t = ((now * 0.42 + index / sceneState.flowBeads.length) % 1 + 1) % 1;
    const pos = curve.getPointAt(t);
    bead.visible = true;
    bead.position.copy(pos);
    bead.scale.setScalar(0.6 + Math.sin(now * 4 + index) * 0.18);
    const material = bead.material;
    material.color.set(accent);
    material.emissive.set(accent);
    material.emissiveIntensity = scenario.label.includes('LEAK') ? 1.2 : 0.7;
  });
}

function render3DScene() {
  if (!sceneState.renderer || !sceneState.scene || !sceneState.camera) return;
  const scenario = scenarioMap[currentScenario];
  updateThreeSceneForScenario(scenario);
  animateFlow(scenario);

  const leakGroup = sceneState.leakGroup;
  if (leakGroup && leakGroup.visible) {
    leakGroup.rotation.y = performance.now() * 0.005;
    leakGroup.children.forEach((child, idx) => {
      if (child.isMesh && idx > 0) {
        child.position.y = 1.2 + (idx % 3) * 0.28 + Math.sin(performance.now() * 0.008 + idx) * 0.3;
      }
    });
  }

  sceneState.controls.update();
  sceneState.renderer.render(sceneState.scene, sceneState.camera);
}

function renderScenario() {
  const scenario = scenarioMap[currentScenario];
  const predictionResult = predictionAdapter.getPrediction(currentScenario);
  if (predictionResult.ok) {
    updatePredictionPanel(predictionResult.data);
  }
  updateSystemSummary(scenario);
  updateNodeCards(scenario);

  const flowValues = scenario.nodes.map((node) => node.flow);
  const pressureValues = scenario.nodes.map((node) => node.pressure);

  renderChart('flowChart', flowValues, '#67e8f9', 15, 24);
  renderChart('pressureChart', pressureValues, '#22c55e', 2.4, 3.8);

  if (sceneState.nodeMeshes.length) {
    updateThreeSceneForScenario(scenario);
  }
}

function attachEvents() {
  document.querySelectorAll('.scenario-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const scenarioKey = button.dataset.scenario;
      if (scenarioKey === 'NORMAL') setScenario('NORMAL');
      if (scenarioKey === 'LEAK_BC') setScenario('LEAK_BC');
      if (scenarioKey === 'LEAK_CD') setScenario('LEAK_CD');
      if (scenarioKey === 'TRANSIENT') setScenario('TRANSIENT');
    });
  });

  document.getElementById('resetBtn').addEventListener('click', resetDemo);
  document.getElementById('presentationBtn').addEventListener('click', () => {
    document.body.classList.toggle('presentation-mode');
  });

  document.getElementById('cameraResetBtn').addEventListener('click', () => {
    resetCameraView();
  });
}

createScene();
attachEvents();
renderScenario();
window.pipelineDebug = sceneState;
window.pipelineActions = { resetCameraView, setScenario, resetDemo };

function tick() {
  render3DScene();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
