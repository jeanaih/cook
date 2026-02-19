import * as THREE from 'three';
import { KitchenRenderer } from './kitchen.js';
import { UIManager } from './ui.js';

// ============ CONNECT TO SERVER ============
const socket = io();
let playerId = null;
let gameConfig = null;
let roomState = null;

// ============ THREE.JS SETUP ============
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 60, 100);

// Isometric camera
// 1-Point Perspective Camera (High Front Angle)
const fov = 45;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);

// Initial position (will be updated in init to center on kitchen)
camera.position.set(0, 30, 30);
camera.lookAt(0, 0, 0);

// Lighting - Optimized for Front Perspective
const ambientLight = new THREE.AmbientLight(0xffeedd, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
// Light from Top-Left-Front
dirLight.position.set(-15, 40, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -40;
dirLight.shadow.camera.right = 40;
dirLight.shadow.camera.top = 40;
dirLight.shadow.camera.bottom = -40;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x88aaff, 0.5);
fillLight.position.set(15, 10, 15); // Fill from Right-Front
scene.add(fillLight);

// ============ GAME OBJECTS ============
let kitchen = null;
let ui = null;
const playerMeshes = {};
const keys = {};
let moveTimer = 0;
let lastChopEmit = 0;
let spacePressedTime = 0;
let didChop = false; // Restored for interaction logic

// ============ LOBBY LOGIC ============
const btnJoin = document.getElementById('btn-join');
const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');

btnJoin.addEventListener('click', () => {
    const name = document.getElementById('player-name').value.trim() || 'Chef';
    const roomId = document.getElementById('room-code').value.trim() || 'kitchen_1';
    const mode = document.getElementById('game-mode').value;
    const difficulty = document.getElementById('difficulty').value;

    socket.emit('joinRoom', { name, roomId, mode, difficulty });
});

btnStart.addEventListener('click', () => socket.emit('startGame'));
btnRestart.addEventListener('click', () => socket.emit('restartGame'));

// ============ SOCKET EVENTS ============
socket.on('init', (data) => {
    playerId = data.playerId;
    gameConfig = data.config;
    roomState = data.room;

    ui = new UIManager(gameConfig, socket);
    ui.updatePlayerList(roomState.players);
    ui.buildRecipeBook();

    // Build 3D kitchen
    if (kitchen) {
        kitchen.clear(); // Use the built-in clear method instead of clearing the whole scene
    }

    // --- RENDERER SETUP ---
    // Force new kitchen renderer with current config
    if (kitchen) kitchen.clear(); // Clear old if exists
    kitchen = new KitchenRenderer(scene, gameConfig, roomState);
    kitchen.buildKitchen(roomState.kitchen, roomState.stations);

    // --- CAMERA SETUP FOR 1-POINT PERSPECTIVE ---
    const ts = gameConfig.TILE_SIZE;
    const mapW = gameConfig.GRID_W * ts;
    const mapH = gameConfig.GRID_H * ts;
    const centerX = mapW / 2 - ts / 2;
    const centerZ = mapH / 2 - ts / 2;

    const maxDim = Math.max(mapW, mapH);

    // Position camera strictly on the Z-axis relative to center (Front View)
    // Height determines the angle "overhead"
    // Distance Z determines how "far back"

    const height = maxDim * 1.5; // High up
    const distBack = maxDim * 0.9; // Back a bit

    // Smooth transition if we wanted, but for init we snap
    camera.position.set(centerX, height, centerZ + distBack);
    // Look slightly ahead of center to balance the view
    camera.lookAt(centerX, 0, centerZ * 0.8);

    // Update Shadow Camera to fit
    dirLight.shadow.camera.left = -maxDim;
    dirLight.shadow.camera.right = maxDim;
    dirLight.shadow.camera.top = maxDim;
    dirLight.shadow.camera.bottom = -maxDim;
    dirLight.shadow.camera.updateProjectionMatrix();

    // Create player meshes
    Object.values(roomState.players).forEach(p => createPlayerMesh(p));

    btnStart.classList.remove('hidden');
    document.getElementById('players-waiting').style.display = 'block';
});

socket.on('playerJoined', (player) => {
    if (!roomState) return;
    roomState.players[player.id] = player;
    createPlayerMesh(player);
    ui.updatePlayerList(roomState.players);
});

socket.on('playerLeft', (id) => {
    if (!roomState) return;
    delete roomState.players[id];
    removePlayerMesh(id);
    ui.updatePlayerList(roomState.players);
});

socket.on('playerMoved', (data) => {
    if (!roomState) return;
    const p = roomState.players[data.id];
    if (p) {
        // Update target position for interpolation
        p.x = data.x;
        p.z = data.z;
        p.facing = data.facing;
        p.holding = data.holding;
        if (playerMeshes[data.id]) {
            updatePlayerHeldItem(data.id, data.holding);
        }
    }
});

socket.on('playerUpdate', (data) => {
    if (!roomState) return;
    const p = roomState.players[data.id];
    if (p) {
        // Only update position from server if it's NOT the local player
        // (Local player is authoritative for immediate feel, server syncs eventually)
        if (data.id !== playerId) {
            p.x = data.x !== undefined ? data.x : data.gridX * gameConfig.TILE_SIZE;
            p.z = data.z !== undefined ? data.z : data.gridZ * gameConfig.TILE_SIZE;
            p.facing = data.facing;
        }
        // Always sync these
        p.holding = data.holding;
        if (playerMeshes[data.id]) {
            updatePlayerHeldItem(data.id, data.holding);
        }
        p.score = data.score;
        p.gridX = data.gridX; // Keep for reference
        p.gridZ = data.gridZ;
    }
    if (data.id === playerId) {
        ui.updateHolding(data.holding, gameConfig);
        // Sync score but don't overwrite pos to avoid jitter
    }
});

socket.on('gameStarted', (data) => {
    roomState.state = 'playing';
    roomState.orders = data.orders;
    roomState.timeLeft = data.timeLeft;
    ui.showScreen('game');
    ui.updateOrders(data.orders, gameConfig);
});

socket.on('gameRestarted', (data) => {
    roomState = data.room;
    roomState.state = 'lobby';
    if (kitchen) kitchen.resetStations(roomState.stations);
    Object.values(roomState.players).forEach(p => createPlayerMesh(p));
    ui.showScreen('lobby');
    ui.updatePlayerList(roomState.players);
});

socket.on('newOrder', (order) => {
    if (!roomState) return;
    roomState.orders.push(order);
    ui.updateOrders(roomState.orders, gameConfig);
});

socket.on('orderCompleted', (data) => {
    if (!roomState) return;
    roomState.orders = roomState.orders.filter(o => o.id !== data.orderId);
    roomState.score = data.totalScore;
    ui.updateOrders(roomState.orders, gameConfig);
    ui.updateScore(data.totalScore, data.combo);
    ui.showScorePop(`+${data.points}`);
});

socket.on('orderExpired', (data) => {
    if (!roomState) return;
    roomState.orders = roomState.orders.filter(o => o.id !== data.orderId);
    roomState.score = data.score;
    ui.updateOrders(roomState.orders, gameConfig);
    ui.updateScore(data.score, 0);
});

socket.on('wrongDish', (data) => {
    roomState.score = data.score;
    ui.updateScore(data.score, 0);
});

socket.on('timeUpdate', (t) => {
    if (!roomState) return;
    roomState.timeLeft = t;
    ui.updateTimer(t);
});

socket.on('stationUpdate', (data) => {
    if (!roomState) return;
    roomState.stations[data.stationId] = data.station;
    if (kitchen) kitchen.updateStation(data.stationId, data.station);
});

socket.on('chopComplete', (data) => ui.showNotification(`✅ ${data.ingredient} chopped!`, 'success'));
// socket.on('cookComplete', (data) => ui.showNotification('🍳 Cooking done! Grab it!', 'info'));
socket.on('burning', () => ui.showNotification('⚠️ Food is burning!', 'error'));
socket.on('fire', () => { });
socket.on('notification', (data) => ui.showNotification(data.msg, data.type));

socket.on('gameOver', (data) => {
    roomState.state = 'gameover';
    ui.showGameOver(data);
});

socket.on('gameStateUpdate', (data) => {
    if (!roomState) return;
    roomState.stations = data.stations;
    roomState.orders = data.orders;
    roomState.score = data.score;
    if (kitchen) kitchen.updateAllStations(data.stations);
});

socket.on('chatMessage', (data) => ui.addChatMessage(data));
socket.on('playerRenamed', (data) => {
    if (roomState && roomState.players[data.id]) {
        roomState.players[data.id].name = data.name;
    }
});

// ============ PLAYER MESH ============
function createPlayerMesh(player) {
    if (playerMeshes[player.id]) removePlayerMesh(player.id);

    const group = new THREE.Group();
    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.4, 1.0, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: player.color, roughness: 0.5 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.25;
    head.castShadow = true;
    group.add(head);

    // Chef hat
    const hatGeo = new THREE.CylinderGeometry(0.15, 0.3, 0.4, 8);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 1.6;
    group.add(hat);

    // Name label sprite
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256; labelCanvas.height = 64;
    const lCtx = labelCanvas.getContext('2d');
    lCtx.fillStyle = 'rgba(0,0,0,0.6)';
    lCtx.roundRect(8, 8, 240, 48, 12);
    lCtx.fill();
    lCtx.font = 'bold 28px Nunito, sans-serif';
    lCtx.fillStyle = player.color;
    lCtx.textAlign = 'center';
    lCtx.fillText(player.name, 128, 42);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true });
    const label = new THREE.Sprite(labelMat);
    label.position.y = 2.2;
    label.scale.set(2.5, 0.6, 1);
    group.add(label);

    const ts = gameConfig.TILE_SIZE;
    group.position.set(player.gridX * ts, 0, player.gridZ * ts);
    scene.add(group);
    playerMeshes[player.id] = { group, body, head, hat, bobTime: Math.random() * 10 };

    // Initialize held item
    if (player.holding) {
        updatePlayerHeldItem(player.id, player.holding);
    }
}

function removePlayerMesh(id) {
    if (playerMeshes[id]) {
        scene.remove(playerMeshes[id].group);
        delete playerMeshes[id];
    }
}

// ============ INPUT ============
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        // Start hold timer on first press
        if (!e.repeat) {
            spacePressedTime = Date.now();
            didChop = false;
        }
    }
});
document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.key === ' ' || e.code === 'Space') {
        // If we didn't chop during the hold, treat it as an interact tap
        if (!didChop) {
            handleInteract();
        }
    }
});

function handleInteract() {
    if (!roomState || roomState.state !== 'playing') return;
    const me = roomState.players[playerId];
    if (!me) return;

    // Find closest station within interaction range
    let bestStationId = null;
    let minDist = Infinity;
    // VERY FORGIVING REACH (Easy Interactive)
    const reach = (gameConfig ? gameConfig.TILE_SIZE : 2) * 2.2;

    // Player current pos
    const px = me.x !== undefined ? me.x : me.gridX * (gameConfig ? gameConfig.TILE_SIZE : 2);
    const pz = me.z !== undefined ? me.z : me.gridZ * (gameConfig ? gameConfig.TILE_SIZE : 2);

    for (const [id, st] of Object.entries(roomState.stations)) {
        const sx = st.gridX * (gameConfig ? gameConfig.TILE_SIZE : 2);
        const sz = st.gridZ * (gameConfig ? gameConfig.TILE_SIZE : 2);
        const dist = Math.sqrt(Math.pow(px - sx, 2) + Math.pow(pz - sz, 2));

        if (dist <= reach && dist < minDist) {
            minDist = dist;
            bestStationId = id;
        }
    }

    if (bestStationId) {
        socket.emit('interact', { stationId: bestStationId });
        return;
    }
}

function handleChop() {
    if (!roomState || roomState.state !== 'playing') return;
    const me = roomState.players[playerId];
    if (!me) return;

    // Find closest chopping station
    let bestStationId = null;
    let minDist = Infinity;
    const reach = (gameConfig ? gameConfig.TILE_SIZE : 2) * 2.5;

    const px = me.x !== undefined ? me.x : me.gridX * (gameConfig ? gameConfig.TILE_SIZE : 2);
    const pz = me.z !== undefined ? me.z : me.gridZ * (gameConfig ? gameConfig.TILE_SIZE : 2);

    for (const [id, st] of Object.entries(roomState.stations)) {
        if (st.type === 'chopping') {
            const sx = st.gridX * (gameConfig ? gameConfig.TILE_SIZE : 2);
            const sz = st.gridZ * (gameConfig ? gameConfig.TILE_SIZE : 2);
            const dist = Math.sqrt(Math.pow(px - sx, 2) + Math.pow(pz - sz, 2));

            if (dist <= reach && dist < minDist) {
                // Determine if we can chop here:
                // 1. Station has an ingredient that still needs chopping
                const canChopExisting = st.contents && st.contents.type === 'ingredient' && !st.contents.chopped;
                // 2. Station is empty AND player is holding an ingredient that needs chopping (Auto-place)
                const canAutoPlace = !st.contents && me.holding && me.holding.type === 'ingredient' && !me.holding.chopped;

                if (canChopExisting || canAutoPlace) {
                    minDist = dist;
                    bestStationId = id;
                }
            }
        }
    }

    if (bestStationId) {
        socket.emit('chopAction', { stationId: bestStationId });
        return true;
    }
    return false;
}

function handleRoll() {
    if (!roomState || roomState.state !== 'playing') return;
    const me = roomState.players[playerId];
    if (!me) return;

    let bestStationId = null;
    let minDist = Infinity;
    const reach = (gameConfig ? gameConfig.TILE_SIZE : 2) * 2.5;

    const px = me.x !== undefined ? me.x : me.gridX * (gameConfig ? gameConfig.TILE_SIZE : 2);
    const pz = me.z !== undefined ? me.z : me.gridZ * (gameConfig ? gameConfig.TILE_SIZE : 2);

    for (const [id, st] of Object.entries(roomState.stations)) {
        if (st.type === 'roller') {
            const sx = st.gridX * (gameConfig ? gameConfig.TILE_SIZE : 2);
            const sz = st.gridZ * (gameConfig ? gameConfig.TILE_SIZE : 2);
            const dist = Math.sqrt(Math.pow(px - sx, 2) + Math.pow(pz - sz, 2));

            if (dist <= reach && dist < minDist) {
                const canRollExisting = st.contents && st.contents.name === 'dough' && !st.contents.rolled;
                const canAutoPlace = !st.contents && me.holding && me.holding.name === 'dough' && !me.holding.rolled;

                if (canRollExisting || canAutoPlace) {
                    minDist = dist;
                    bestStationId = id;
                }
            }
        }
    }

    if (bestStationId) {
        socket.emit('rollAction', { stationId: bestStationId });
        return true;
    }
    return false;
}

function handleWash() {
    if (!roomState || roomState.state !== 'playing') return;
    const me = roomState.players[playerId];
    if (!me) return;

    let bestStationId = null;
    let minDist = Infinity;
    const reach = (gameConfig ? gameConfig.TILE_SIZE : 2) * 2.5;

    const px = me.x !== undefined ? me.x : me.gridX * (gameConfig ? gameConfig.TILE_SIZE : 2);
    const pz = me.z !== undefined ? me.z : me.gridZ * (gameConfig ? gameConfig.TILE_SIZE : 2);

    for (const [id, st] of Object.entries(roomState.stations)) {
        if (st.type === 'sink') {
            const sx = st.gridX * (gameConfig ? gameConfig.TILE_SIZE : 2);
            const sz = st.gridZ * (gameConfig ? gameConfig.TILE_SIZE : 2);
            const dist = Math.sqrt(Math.pow(px - sx, 2) + Math.pow(pz - sz, 2));

            if (dist <= reach && dist < minDist) {
                const canWashExisting = st.contents && st.contents.name === 'rice' && !st.contents.washed;
                const canAutoPlace = !st.contents && me.holding && me.holding.name === 'rice' && !me.holding.washed;

                if (canWashExisting || canAutoPlace) {
                    minDist = dist;
                    bestStationId = id;
                }
            }
        }
    }

    if (bestStationId) {
        socket.emit('washAction', { stationId: bestStationId });
        return true;
    }
    return false;
}

// ============ GAME LOOP ============
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (roomState && roomState.state === 'playing') {
        const me = roomState.players[playerId];
        if (me) {
            // Initialize float position if missing
            if (typeof me.x === 'undefined') {
                me.x = me.gridX * gameConfig.TILE_SIZE;
                me.z = me.gridZ * gameConfig.TILE_SIZE;
            }

            const speed = 8.0; // Speed of movement
            let dx = 0, dz = 0;

            // Continuous Input
            if (keys['w'] || keys['arrowup']) dz = -1;
            if (keys['s'] || keys['arrowdown']) dz = 1;
            if (keys['a'] || keys['arrowleft']) dx = -1;
            if (keys['d'] || keys['arrowright']) dx = 1;

            // Normalize diagonal
            if (dx !== 0 && dz !== 0) {
                const len = Math.sqrt(dx * dx + dz * dz);
                dx /= len; dz /= len;
            }

            if (dx !== 0 || dz !== 0) {
                // Determine facing immediately
                let facing = me.facing;
                if (Math.abs(dx) > Math.abs(dz)) facing = dx < 0 ? 'left' : 'right';
                else facing = dz < 0 ? 'up' : 'down';
                me.facing = facing;

                // Proposed move
                const nextX = me.x + dx * speed * delta;
                const nextZ = me.z + dz * speed * delta;

                // Collision Detection (Slide along axes)
                // Try X movement
                if (!checkCollision(nextX, me.z, gameConfig.TILE_SIZE)) {
                    me.x = nextX;
                }
                // Try Z movement
                if (!checkCollision(me.x, nextZ, gameConfig.TILE_SIZE)) {
                    me.z = nextZ;
                }

                // Emit updates (throttling could be added here if needed)
                socket.emit('move', { x: me.x, z: me.z, facing: me.facing });
            }

            // Continuous chop/roll/wash while holding space
            const now = Date.now();
            if (keys[' ']) {
                const duration = now - spacePressedTime;
                // Threshold for "Hold" to start chopping (e.g., 180ms)
                if (duration > 180) {
                    if (now - lastChopEmit > 100) { // Limit action rate
                        let didChop = false;
                        if (handleChop()) {
                            didChop = true;
                        } else if (handleRoll()) {
                            didChop = true;
                        } else if (handleWash()) {
                            didChop = true;
                        }

                        if (didChop) {
                            const pm = playerMeshes[playerId];
                            if (pm) {
                                pm.group.rotation.z = Math.sin(now * 0.02) * 0.1;
                                pm.body.position.y = 0.5 + Math.abs(Math.sin(now * 0.025)) * 0.1;
                            }
                        }
                        lastChopEmit = now;
                    }
                }
            }
        }
    }

    // Animate players
    const ts = gameConfig ? gameConfig.TILE_SIZE : 2;
    Object.entries(playerMeshes).forEach(([id, pm]) => {
        const p = roomState?.players[id];
        if (!p) return;

        // Target position (use float x/z if available, else grid)
        const targetX = (p.x !== undefined) ? p.x : p.gridX * ts;
        const targetZ = (p.z !== undefined) ? p.z : p.gridZ * ts;

        // Smooth interpolation
        pm.group.position.x += (targetX - pm.group.position.x) * 0.3;
        pm.group.position.z += (targetZ - pm.group.position.z) * 0.3;

        // Bob animation
        pm.bobTime += delta * 5;
        pm.body.position.y = 0.5 + Math.sin(pm.bobTime) * 0.05;
        pm.hat.rotation.z = Math.sin(pm.bobTime * 0.5) * 0.05;

        // Face direction
        const angles = { up: Math.PI, down: 0, left: Math.PI / 2, right: -Math.PI / 2 };
        const targetAngle = angles[p.facing] || 0;
        pm.group.rotation.y += (targetAngle - pm.group.rotation.y) * 0.15;
    });

    // Animate kitchen
    if (kitchen) kitchen.animate(delta, roomState ? roomState.players : null);

    // Animate steam on held items
    Object.values(playerMeshes).forEach(pm => {
        const heldGroup = pm.group.getObjectByName('heldGroup');
        if (heldGroup) {
            heldGroup.traverse(child => {
                if (child.name === 'steamGroup') {
                    // Emit small steam particles
                    if (Math.random() < 0.08) {
                        const p = new THREE.Mesh(
                            new THREE.SphereGeometry(0.03, 4, 4),
                            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })
                        );
                        p.position.set((Math.random() - 0.5) * 0.15, 0, (Math.random() - 0.5) * 0.15);
                        p.userData = { life: 0.8, speedY: 0.4 + Math.random() * 0.3 };
                        child.add(p);
                    }
                    for (let i = child.children.length - 1; i >= 0; i--) {
                        const p = child.children[i];
                        if (!p.userData || !p.userData.life) continue;
                        p.position.y += p.userData.speedY * delta;
                        p.userData.life -= delta;
                        p.material.opacity = p.userData.life * 0.25;
                        p.scale.setScalar(1 + (0.8 - p.userData.life) * 1.2);
                        if (p.userData.life <= 0) child.remove(p);
                    }
                }
            });
        }
    });

    // Proximity-based crate name labels
    if (roomState && roomState.players && roomState.players[playerId] && roomState.stations) {
        const me = roomState.players[playerId];
        const px = me.x !== undefined ? me.x : me.gridX * gameConfig.TILE_SIZE;
        const pz = me.z !== undefined ? me.z : me.gridZ * gameConfig.TILE_SIZE;
        const proximityDistance = (gameConfig ? gameConfig.TILE_SIZE : 2) * 2.5; // Slightly larger than interact reach

        Object.values(roomState.stations).forEach(st => {
            if (st.type === 'crate') {
                const sx = st.gridX * (gameConfig ? gameConfig.TILE_SIZE : 2);
                const sz = st.gridZ * (gameConfig ? gameConfig.TILE_SIZE : 2);
                const dist = Math.sqrt(Math.pow(px - sx, 2) + Math.pow(pz - sz, 2));

                const label = kitchen.stationMeshes[st.id]?.group?.getObjectByName('nameLabel');
                if (label) {
                    label.visible = dist <= proximityDistance;
                }
            }
        });
    }

    // Update order timers
    if (roomState && ui) ui.updateOrderTimers(roomState.orders);

    renderer.render(scene, camera);
}

animate();

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Click to interact with stations
canvas.addEventListener('click', (e) => {
    if (!roomState || roomState.state !== 'playing' || !gameConfig) return;
    handleInteract();
});

function checkCollision(x, z, ts) {
    if (!roomState || !roomState.kitchen) return false;

    // Player collision radius
    const margin = 0.4;

    const corners = [
        { x: x - margin, z: z - margin },
        { x: x + margin, z: z - margin },
        { x: x - margin, z: z + margin },
        { x: x + margin, z: z + margin }
    ];

    for (const c of corners) {
        // Map world pos to grid index
        // Since tiles are centered at N*TS, the range [N*TS - TS/2, N*TS + TS/2] maps to N.
        // Formula: Math.round(pos / TS)
        const gx = Math.round(c.x / ts);
        const gz = Math.round(c.z / ts);

        // Check bounds
        if (gx < 0 || gx >= gameConfig.GRID_W || gz < 0 || gz >= gameConfig.GRID_H) {
            return true; // Wall/OOB
        }

        // Check tile type (0 is floor)
        if (roomState.kitchen[gz][gx] !== 0) {
            return true; // Hit object
        }
    }
    return false;
}

// ============ HELD ITEM VISUALS ============
function updatePlayerHeldItem(playerId, holding) {
    const pm = playerMeshes[playerId];
    if (!pm) return;

    // Check if we have a 'heldItem' group already
    let heldGroup = pm.group.getObjectByName('heldGroup');
    if (heldGroup) {
        pm.group.remove(heldGroup);
    }

    if (!holding) return;

    heldGroup = new THREE.Group();
    heldGroup.name = 'heldGroup';

    // Position comfortably in front of the player (Z+ direction based on movement logic)
    heldGroup.position.set(0, 0.8, 0.5);

    // --- USE KITCHEN RENDERER'S createContentMesh FOR CONSISTENT VISUALS ---
    if (kitchen) {
        const contentMesh = kitchen.createContentMesh(holding);
        // Scale down to hand-held size (station items are full-size)
        const heldScale = 0.6;
        contentMesh.scale.set(heldScale, heldScale, heldScale);
        heldGroup.add(contentMesh);
    } else {
        // Fallback: simple meshes if kitchen renderer isn't available
        if (holding.type === 'ingredient') {
            const ing = gameConfig.INGREDIENTS[holding.name];
            let color = new THREE.Color(ing ? ing.color : 0xffffff);
            if (holding.burnt) color.setHex(0x000000);
            else if (holding.cooked) { color.multiplyScalar(0.6); }
            const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
            heldGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), mat));
        } else if (holding.type === 'plate') {
            const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            heldGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.05, 16), plateMat));
        }
    }

    pm.group.add(heldGroup);
}
