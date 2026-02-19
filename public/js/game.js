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
// ============ LOBBY LOGIC ============
let currentMenu = 'main';
let selectedDiff = 'easy';
let selectedMode = 'multi_coop';
let createDiff = 'easy';
let serverListTimeout = null;

// Expose functions to window for HTML onclicks
window.showMenu = (menuId) => {
    // Hide ALL menus first
    document.querySelectorAll('.lobby-menu').forEach(el => el.classList.add('hidden'));

    // Show only the selected menu
    const targetMenu = document.getElementById(`menu-${menuId}`);
    if (targetMenu) {
        targetMenu.classList.remove('hidden');
        currentMenu = menuId;
    }

    if (menuId === 'join') {
        refreshServerList();
    }
};

window.selectDifficulty = (diff, elem) => {
    selectedDiff = diff;
    document.querySelectorAll('#menu-single .banner-option').forEach(el => el.classList.remove('selected'));
    elem.classList.add('selected');
};

window.selectMode = (mode, elem) => {
    selectedMode = mode;
    document.querySelectorAll('#menu-create .banner-option').forEach(el => el.classList.remove('selected'));
    elem.classList.add('selected');
};

window.setCreateDiff = (diff, elem) => {
    createDiff = diff;
    document.querySelectorAll('.diff-btn').forEach(el => el.classList.remove('active'));
    elem.classList.add('active');
};

window.refreshServerList = () => {
    socket.emit('getRooms');
    const tbody = document.getElementById('server-list-body');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading rooms...</td></tr>';
    }
    if (serverListTimeout) clearTimeout(serverListTimeout);
    serverListTimeout = setTimeout(() => {
        const body = document.getElementById('server-list-body');
        if (body && body.innerHTML.includes('Loading')) {
            body.innerHTML = '<tr><td colspan="5" style="text-align:center;">No rooms found.</td></tr>';
        }
    }, 3000);
};

window.joinRoom = (roomId) => {
    const name = document.getElementById('player-name').value.trim() || 'Chef';
    // Join existing room
    socket.emit('joinRoom', { name, roomId, password: window.pendingPassword || undefined }); // Mode/Diff taken from room
    window.pendingPassword = null; // Clear after use
};

window.leaveRoom = () => {
    socket.emit('leaveRoom');
    location.reload(); // Simple reload to leave for now
};

window.startSinglePlayer = (difficulty = 'easy') => {
    const name = document.getElementById('player-name').value.trim() || 'Chef';
    const roomId = `sp_${Date.now()}`;
    socket.emit('joinRoom', {
        name,
        roomId,
        mode: 'single',
        difficulty: difficulty
    });
    // For single player, we want to hide the lobby immediately to give instant feedback
    const lobbyScreen = document.getElementById('lobby-screen');
    if (lobbyScreen) lobbyScreen.classList.remove('active');
    // We'll show the game screen when gameStarted arrives, 
    // but in the meantime, we can show a minimalist loading if needed.
};

// ============ NEW FEATURE HANDLERS ============

// Room Code Functions
window.joinByCode = () => {
    const codeInput = document.getElementById('join-room-code');
    if (!codeInput) return;
    const code = codeInput.value.trim();
    if (code.length === 6 && /^\d+$/.test(code)) {
        socket.emit('joinByCode', { code });
        codeInput.value = ''; // Clear input
    } else {
        const notification = document.getElementById('notifications');
        if (notification) {
            const el = document.createElement('div');
            el.className = 'notification error';
            el.textContent = 'Invalid room code! Must be 6 digits.';
            notification.appendChild(el);
            setTimeout(() => el.remove(), 2500);
        }
    }
};

window.copyRoomCode = () => {
    const codeEl = document.getElementById('room-code-value');
    if (!codeEl) return;
    const code = codeEl.textContent;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
            const notification = document.getElementById('notifications');
            if (notification) {
                const el = document.createElement('div');
                el.className = 'notification success';
                el.textContent = 'Room code copied!';
                notification.appendChild(el);
                setTimeout(() => el.remove(), 2500);
            }
        });
    }
};

window.togglePasswordField = () => {
    const checkbox = document.getElementById('create-room-password-check');
    const passwordInput = document.getElementById('create-room-password');
    passwordInput.style.display = checkbox.checked ? 'block' : 'none';
    if (!checkbox.checked) passwordInput.value = '';
};

// Quick Chat
window.sendQuickChat = (message) => {
    socket.emit('chatMessage', message);
};

// Server Filters
window.applyFilters = () => {
    refreshServerList();
};

window.clearFilters = () => {
    document.getElementById('filter-mode').value = '';
    document.getElementById('filter-difficulty').value = '';
    refreshServerList();
};

// Friends
window.addFriend = () => {
    const friendName = document.getElementById('add-friend-input').value.trim();
    if (friendName) {
        socket.emit('addFriend', { name: friendName });
        document.getElementById('add-friend-input').value = '';
    }
};

// Chat Toggle
window.toggleChat = () => {
    const chat = document.getElementById('chat-container');
    chat.classList.toggle('collapsed');
};

// Pause Menu
window.resumeGame = () => {
    document.getElementById('pause-menu').classList.add('hidden');
};

// Password Modal
window.closePasswordModal = () => {
    document.getElementById('password-modal').classList.add('hidden');
    document.getElementById('room-password-input').value = '';
};

window.submitPassword = () => {
    const password = document.getElementById('room-password-input').value.trim();
    if (password) {
        socket.emit('joinRoomWithPassword', { password });
        closePasswordModal();
    }
};

// Kick Modal
let kickTargetId = null;
window.closeKickModal = () => {
    document.getElementById('kick-modal').classList.add('hidden');
    kickTargetId = null;
};

window.confirmKick = () => {
    if (kickTargetId) {
        socket.emit('kickPlayer', { playerId: kickTargetId });
        closeKickModal();
    }
};

window.showKickModal = (playerId, playerName) => {
    kickTargetId = playerId;
    document.getElementById('kick-player-name').textContent = playerName;
    document.getElementById('kick-modal').classList.remove('hidden');
};

// Connection Quality Tracking
let pingInterval = null;
let lastPingTime = 0;

function updateConnectionStatus(status) {
    const statusEl = document.getElementById('connection-status');
    const textEl = document.getElementById('connection-text');
    if (statusEl && textEl) {
        statusEl.className = `connection-status ${status}`;
        textEl.textContent = status === 'connected' ? 'Connected' : status === 'disconnected' ? 'Disconnected' : 'Connecting...';
    }
}

function updatePing(ping) {
    const pingEl = document.getElementById('ping-value');
    const iconEl = document.getElementById('connection-icon');
    const qualityEl = document.getElementById('connection-quality');

    if (pingEl) pingEl.textContent = ping;
    if (qualityEl) {
        qualityEl.className = 'connection-quality';
        if (ping < 50) {
            qualityEl.classList.add('good');
            if (iconEl) iconEl.className = 'bi bi-wifi';
        } else if (ping < 150) {
            qualityEl.classList.add('medium');
            if (iconEl) iconEl.className = 'bi bi-wifi-2';
        } else {
            qualityEl.classList.add('bad');
            if (iconEl) iconEl.className = 'bi bi-wifi-1';
        }
    }
}

function startPingTracking() {
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
        lastPingTime = Date.now();
        socket.emit('ping');
    }, 2000);
}

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    // Select defaults
    const singleOptions = document.querySelectorAll('#menu-single .banner-option');
    if (singleOptions.length > 0) singleOptions[0].classList.add('selected');

    const createOptions = document.querySelectorAll('#menu-create .banner-option');
    if (createOptions.length > 0) createOptions[0].classList.add('selected');
});

// START SINGLE PLAYER
const btnStartSingle = document.getElementById('btn-start-single');
if (btnStartSingle) {
    btnStartSingle.addEventListener('click', () => {
        const name = document.getElementById('player-name').value.trim() || 'Chef';
        const roomId = `sp_${Date.now()}`;
        socket.emit('joinRoom', {
            name,
            roomId,
            mode: 'single',
            difficulty: selectedDiff
        });
        // Single player auto-starts immediately - skip waiting room
        // The server will detect single player mode and start game automatically
    });
}

// CREATE LOBBY
const btnCreateLobby = document.getElementById('btn-create-lobby');
if (btnCreateLobby) {
    btnCreateLobby.addEventListener('click', () => {
        const name = document.getElementById('player-name').value.trim() || 'Chef';
        let roomName = document.getElementById('create-room-name').value.trim();
        if (!roomName) roomName = `Kitchen_${Math.floor(Math.random() * 1000)}`;

        const description = document.getElementById('create-room-desc')?.value.trim() || '';
        const passwordCheck = document.getElementById('create-room-password-check')?.checked || false;
        const password = passwordCheck ? document.getElementById('create-room-password')?.value.trim() : '';

        socket.emit('createRoom', {
            name,
            roomName,
            mode: selectedMode,
            difficulty: createDiff,
            description,
            password: password || undefined
        });
    });
}

// READY BUTTON (NON-HOST PLAYERS)
const btnReady = document.getElementById('btn-ready');
if (btnReady) {
    btnReady.addEventListener('click', () => {
        socket.emit('toggleReady');
    });
}

// START GAME (HOST)
const btnStartMulti = document.getElementById('btn-start-multi');
if (btnStartMulti) {
    btnStartMulti.addEventListener('click', () => {
        socket.emit('startGame');
    });
}

// RESTART GAME (GAME OVER SCREEN)
const btnRestart = document.getElementById('btn-restart');
if (btnRestart) {
    btnRestart.addEventListener('click', () => {
        socket.emit('restartGame');
    });
}

// ============ SOCKET EVENTS ============
socket.on('roomList', (rooms) => {
    const tbody = document.getElementById('server-list-body');
    if (!tbody) return;

    if (serverListTimeout) {
        clearTimeout(serverListTimeout);
        serverListTimeout = null;
    }

    const filterMode = document.getElementById('filter-mode')?.value || '';
    const filterDifficulty = document.getElementById('filter-difficulty')?.value || '';

    let filteredRooms = rooms;
    if (filterMode) filteredRooms = filteredRooms.filter(r => r.mode === filterMode);
    if (filterDifficulty) filteredRooms = filteredRooms.filter(r => r.difficulty === filterDifficulty);

    tbody.innerHTML = '';

    if (filteredRooms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No rooms found.</td></tr>';
        return;
    }

    filteredRooms.forEach(room => {
        const tr = document.createElement('tr');

        const modeIcons = {
            'single': '<i class="bi bi-person"></i> Single',
            'multi_coop': '<i class="bi bi-people-fill"></i> Co-op',
            'multi_vs': '<i class="bi bi-sword"></i> VS'
        };

        const statusBadge = room.state === 'playing'
            ? '<span class="status-badge ingame">In Game</span>'
            : room.players >= room.maxPlayers
                ? '<span class="status-badge full">Full</span>'
                : '<span class="status-badge waiting">Waiting</span>';

        const hasPassword = room.hasPassword ? '<i class="bi bi-lock-fill" title="Password Protected"></i> ' : '';
        const description = room.description ? `<br><small style="color:var(--text-dim);">${room.description}</small>` : '';

        tr.innerHTML = `
            <td><b>${hasPassword}${room.id}</b>${description}</td>
            <td>${modeIcons[room.mode] || room.mode} <small>(${room.difficulty})</small></td>
            <td>${room.players}/${room.maxPlayers}</td>
            <td>${statusBadge}</td>
            <td>
                ${room.players < room.maxPlayers && room.state !== 'playing'
                ? `<button class="btn-sm" onclick="joinRoom('${room.id}')"><i class="bi bi-box-arrow-in-right"></i> JOIN</button>`
                : '<span style="color:#ef4444; font-size:12px;">UNAVAILABLE</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
});


// ============ SOCKET EVENTS ============
// ============ SOCKET EVENTS ============
socket.on('init', (data) => {
    try {
        playerId = data.playerId;
        gameConfig = data.config;
        roomState = data.room;

        if (!gameConfig || !roomState) {
            console.error('Missing game config or room state');
            return;
        }

        ui = new UIManager(gameConfig, socket);
        ui.updatePlayerList(roomState.players); // Keep for game HUD
        ui.buildRecipeBook();

        // --- LOBBY UI UPDATE ---
        // Hide all menus, show waiting room only if NOT single player
        document.querySelectorAll('.lobby-menu').forEach(el => el.classList.add('hidden'));

        if (roomState.mode !== 'single') {
            const waitingMenu = document.getElementById('menu-waiting');
            if (waitingMenu) waitingMenu.classList.remove('hidden');
        } else {
            // For single player, ensure lobby screen is hidden (in case it wasn't already)
            const lobbyScreen = document.getElementById('lobby-screen');
            if (lobbyScreen) lobbyScreen.classList.remove('active');
            const gameScreen = document.getElementById('game-screen');
            if (gameScreen) gameScreen.classList.add('active');
        }

        const waitingRoomName = document.getElementById('waiting-room-name');
        if (waitingRoomName) waitingRoomName.innerText = `Room: ${roomState.id}`;

        // Show room code
        const roomCodeValue = document.getElementById('room-code-value');
        if (roomCodeValue && data.roomCode) {
            roomCodeValue.textContent = data.roomCode;
        }

        // Show room info
        const modeDisplay = roomState.mode === 'multi_coop' ? 'Co-op' : roomState.mode === 'multi_vs' ? 'VS' : 'Single';
        const roomModeDisplay = document.getElementById('room-mode-display');
        const roomDifficultyDisplay = document.getElementById('room-difficulty-display');
        const roomPlayersDisplay = document.getElementById('room-players-display');

        if (roomModeDisplay) roomModeDisplay.textContent = `Mode: ${modeDisplay}`;
        if (roomDifficultyDisplay) roomDifficultyDisplay.textContent = `Difficulty: ${roomState.difficulty}`;
        const playerCount = Object.keys(roomState.players).length;
        const maxPlayers = roomState.mode === 'single' ? 1 : roomState.mode === 'multi_vs' ? 2 : 3;
        if (roomPlayersDisplay) roomPlayersDisplay.textContent = `Players: ${playerCount}/${maxPlayers}`;

        updateWaitingList(roomState.players);

        // Start ping tracking
        if (typeof startPingTracking === 'function') {
            startPingTracking();
        }
    } catch (error) {
        console.error('Error in init handler:', error);
    }

    // --- KITCHEN SETUP ---
    if (kitchen && typeof kitchen.clear === 'function') kitchen.clear();
    try {
        kitchen = new KitchenRenderer(scene, gameConfig, roomState);
        if (roomState.kitchen && roomState.stations) {
            kitchen.buildKitchen(roomState.kitchen, roomState.stations);
        }
    } catch (error) {
        console.error('Error building kitchen:', error);
    }

    // Camera Setup (Front View)
    if (typeof setupCamera === 'function') {
        setupCamera(gameConfig);
    }

    // Create player meshes
    if (roomState.players) {
        Object.values(roomState.players).forEach(p => {
            try {
                createPlayerMesh(p);
            } catch (error) {
                console.error('Error creating player mesh:', error);
            }
        });
    }
});

socket.on('playerJoined', (player) => {
    if (!roomState) return;
    roomState.players[player.id] = player;

    try {
        createPlayerMesh(player);
    } catch (error) {
        console.error('Error creating player mesh:', error);
    }

    if (ui && typeof ui.updatePlayerList === 'function') {
        ui.updatePlayerList(roomState.players);
    }

    // Update Waiting Room User List
    updateWaitingList(roomState.players);
});

function updateWaitingList(players) {
    const list = document.getElementById('waiting-player-list');
    if (!list) return;
    list.innerHTML = '';

    const me = players[playerId];
    const isHost = me ? me.isHost : false;

    Object.values(players).forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-tag';
        if (p.isReady) div.classList.add('ready');

        const readyStatus = p.isHost ? '<span class="ready-badge host">HOST</span>' : (p.isReady ? '<span class="ready-badge success"><i class="bi bi-check-lg"></i> READY</span>' : '<span class="ready-badge pending">WAITING</span>');
        const hostIcon = p.isHost ? '<i class="bi bi-crown-fill" style="color:#FFD23F"></i> ' : '';
        const youSuffix = p.id === playerId ? ' (You)' : '';

        div.innerHTML = `
            <div class="player-info">
                ${hostIcon}<strong>${p.name}${youSuffix}</strong>
            </div>
            <div class="player-status">
                ${readyStatus}
            </div>
            ${isHost && p.id !== playerId ? `<button class="btn-kick" onclick="showKickModal('${p.id}', '${p.name}')" title="Kick player"><i class="bi bi-person-x"></i></button>` : ''}
        `;
        div.style.borderLeft = `4px solid ${p.color || '#ff6b35'}`;
        list.appendChild(div);
    });

    const btnStart = document.getElementById('btn-start-multi');
    const btnReady = document.getElementById('btn-ready');
    const waitingHint = document.getElementById('waiting-hint');

    if (isHost) {
        if (btnStart) {
            btnStart.classList.remove('hidden');
            const otherPlayers = Object.values(players).filter(p => !p.isHost);
            const allReady = otherPlayers.every(p => p.isReady);

            if (otherPlayers.length > 0 && !allReady) {
                btnStart.disabled = true;
                btnStart.classList.add('disabled');
                if (waitingHint) waitingHint.innerText = 'Waiting for all chefs to get ready...';
            } else {
                btnStart.disabled = false;
                btnStart.classList.remove('disabled');
                if (waitingHint) waitingHint.innerText = otherPlayers.length > 0 ? 'Everyone is ready! LET\'S COOK!' : 'Waiting for more chefs to join...';
            }
        }
        if (btnReady) btnReady.classList.add('hidden');
    } else {
        if (btnStart) btnStart.classList.add('hidden');
        if (btnReady) {
            btnReady.classList.remove('hidden');
            const me = players[playerId];
            if (me && me.isReady) {
                btnReady.innerHTML = '<i class="bi bi-check-all"></i> READY!';
                btnReady.classList.add('ready-active');
            } else {
                btnReady.innerHTML = '<i class="bi bi-check-circle"></i> I\'M READY';
                btnReady.classList.remove('ready-active');
            }
        }
        if (waitingHint) {
            const me = players[playerId];
            waitingHint.innerText = (me && me.isReady) ? 'You are ready! Waiting for the host...' : 'Click "I\'M READY" when you are set!';
        }
    }
}

function setupCamera(config) {
    const ts = config.TILE_SIZE;
    const mapW = config.GRID_W * ts;
    const mapH = config.GRID_H * ts;
    const centerX = mapW / 2 - ts / 2;
    const centerZ = mapH / 2 - ts / 2;
    const maxDim = Math.max(mapW, mapH);
    const height = maxDim * 1.5;
    const distBack = maxDim * 0.9;

    camera.position.set(centerX, height, centerZ + distBack);
    camera.lookAt(centerX, 0, centerZ * 0.8);

    dirLight.shadow.camera.left = -maxDim;
    dirLight.shadow.camera.right = maxDim;
    dirLight.shadow.camera.top = maxDim;
    dirLight.shadow.camera.bottom = -maxDim;
    dirLight.shadow.camera.updateProjectionMatrix();
}

socket.on('playerLeft', (id) => {
    if (!roomState) return;
    delete roomState.players[id];
    removePlayerMesh(id);
    ui.updatePlayerList(roomState.players);
    updateWaitingList(roomState.players);
});

socket.on('playerReadyUpdate', (data) => {
    if (!roomState || !roomState.players[data.id]) return;
    roomState.players[data.id].isReady = data.isReady;
    updateWaitingList(roomState.players);
});

socket.on('hostChanged', (data) => {
    if (!roomState) return;

    // Update host status for all players
    Object.values(roomState.players).forEach(p => {
        const wasHost = p.isHost;
        p.isHost = (p.id === data.newHostId);

        // If I am the new host, show a notification
        if (p.id === playerId && p.isHost && !wasHost) {
            if (ui && typeof ui.showNotification === 'function') {
                ui.showNotification('You are now the host!', 'success');
            }
        }
    });

    updateWaitingList(roomState.players);
});

socket.on('playerMoved', (data) => {
    if (!roomState) return;
    const p = roomState.players[data.id];
    if (p) {
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
    if (!roomState || !gameConfig) return;
    const p = roomState.players[data.id];
    if (p) {
        if (data.id !== playerId) {
            p.x = data.x !== undefined ? data.x : data.gridX * gameConfig.TILE_SIZE;
            p.z = data.z !== undefined ? data.z : data.gridZ * gameConfig.TILE_SIZE;
            p.facing = data.facing;
        }
        p.holding = data.holding;
        if (playerMeshes[data.id]) {
            try {
                updatePlayerHeldItem(data.id, data.holding);
            } catch (error) {
                console.error('Error updating player held item:', error);
            }
        }
        p.score = data.score;
        p.gridX = data.gridX;
        p.gridZ = data.gridZ;
    }
    if (data.id === playerId && ui && typeof ui.updateHolding === 'function') {
        ui.updateHolding(data.holding, gameConfig);
    }
});

socket.on('gameStarted', (data) => {
    if (!roomState) return;

    roomState.state = 'playing';
    roomState.orders = data.orders || [];
    roomState.timeLeft = data.timeLeft;

    // Hide Lobby, Show Game
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameScreen = document.getElementById('game-screen');
    if (lobbyScreen) lobbyScreen.classList.remove('active');
    if (gameScreen) gameScreen.classList.add('active');

    // Hide pause menu if it's showing
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) pauseMenu.classList.add('hidden');

    if (ui) {
        ui.showScreen('game');
        if (data.orders) ui.updateOrders(data.orders, gameConfig);
    }
});

socket.on('gameRestarted', (data) => {
    if (!data || !data.room) return;

    roomState = data.room;
    roomState.state = 'lobby';

    try {
        if (kitchen && typeof kitchen.resetStations === 'function') {
            kitchen.resetStations(roomState.stations);
        }
        if (roomState.players) {
            Object.values(roomState.players).forEach(p => {
                try {
                    createPlayerMesh(p);
                } catch (e) {
                    console.error('Error creating player mesh:', e);
                }
            });
        }
    } catch (error) {
        console.error('Error in gameRestarted:', error);
    }

    // Show Lobby (Waiting Room) if NOT single player
    if (roomState.mode !== 'single') {
        const gameScreen = document.getElementById('game-screen');
        const lobbyScreen = document.getElementById('lobby-screen');
        const gameoverScreen = document.getElementById('gameover-screen');
        const pauseMenu = document.getElementById('pause-menu');

        if (gameScreen) gameScreen.classList.remove('active');
        if (lobbyScreen) lobbyScreen.classList.add('active');
        if (gameoverScreen) gameoverScreen.classList.remove('active');
        if (pauseMenu) pauseMenu.classList.add('hidden');

        if (typeof showMenu === 'function') showMenu('waiting');
        if (ui) {
            ui.showScreen('lobby');
            ui.updatePlayerList(roomState.players);
        }
    } else {
        // For single player, just ensure gameover screen is hidden
        const gameoverScreen = document.getElementById('gameover-screen');
        if (gameoverScreen) gameoverScreen.classList.remove('active');
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen) gameScreen.classList.add('active');
    }
    updateWaitingList(roomState.players);
});

socket.on('newOrder', (order) => {
    if (!roomState || !gameConfig) return;
    roomState.orders.push(order);
    if (ui && typeof ui.updateOrders === 'function') {
        ui.updateOrders(roomState.orders, gameConfig);
    }
});

socket.on('orderCompleted', (data) => {
    if (!roomState || !gameConfig) return;
    roomState.orders = roomState.orders.filter(o => o.id !== data.orderId);
    roomState.score = data.totalScore;
    if (ui) {
        if (typeof ui.updateOrders === 'function') ui.updateOrders(roomState.orders, gameConfig);
        if (typeof ui.updateScore === 'function') ui.updateScore(data.totalScore, data.combo);
        if (typeof ui.showScorePop === 'function') ui.showScorePop(`+${data.points}`);
    }
});

socket.on('orderExpired', (data) => {
    if (!roomState || !gameConfig) return;
    roomState.orders = roomState.orders.filter(o => o.id !== data.orderId);
    roomState.score = data.score;
    if (ui) {
        if (typeof ui.updateOrders === 'function') ui.updateOrders(roomState.orders, gameConfig);
        if (typeof ui.updateScore === 'function') ui.updateScore(data.score, 0);
    }
});

socket.on('wrongDish', (data) => {
    if (!roomState) return;
    roomState.score = data.score;
    if (ui && typeof ui.updateScore === 'function') {
        ui.updateScore(data.score, 0);
    }
});

socket.on('timeUpdate', (t) => {
    if (!roomState) return;
    roomState.timeLeft = t;
    if (ui && typeof ui.updateTimer === 'function') {
        ui.updateTimer(t);
    }
});

socket.on('stationUpdate', (data) => {
    if (!roomState) return;
    roomState.stations[data.stationId] = data.station;
    if (kitchen && typeof kitchen.updateStation === 'function') {
        try {
            kitchen.updateStation(data.stationId, data.station);
        } catch (error) {
            console.error('Error updating station:', error);
        }
    }
});

socket.on('chopComplete', (data) => {
    if (ui && typeof ui.showNotification === 'function') {
        ui.showNotification(`${data.ingredient} chopped!`, 'success');
    }
});
socket.on('burning', () => {
    if (ui && typeof ui.showNotification === 'function') {
        ui.showNotification('Food is burning!', 'error');
    }
});
socket.on('fire', () => { });
socket.on('notification', (data) => {
    if (ui && typeof ui.showNotification === 'function') {
        ui.showNotification(data.msg, data.type);
    } else {
        // Fallback notification
        const notification = document.getElementById('notifications');
        if (notification && data) {
            const el = document.createElement('div');
            el.className = `notification ${data.type || 'info'}`;
            el.textContent = data.msg;
            notification.appendChild(el);
            setTimeout(() => el.remove(), 2500);
        }
    }
});

socket.on('gameOver', (data) => {
    if (!roomState) return;
    roomState.state = 'gameover';
    if (ui && typeof ui.showGameOver === 'function') {
        ui.showGameOver(data);
    }
});

socket.on('gameStateUpdate', (data) => {
    if (!roomState) return;
    roomState.stations = data.stations;
    roomState.orders = data.orders;
    roomState.score = data.score;
    if (kitchen && typeof kitchen.updateAllStations === 'function') {
        try {
            kitchen.updateAllStations(data.stations);
        } catch (error) {
            console.error('Error updating all stations:', error);
        }
    }
});

socket.on('chatMessage', (data) => {
    if (ui && typeof ui.addChatMessage === 'function') {
        ui.addChatMessage(data);
    }
});
socket.on('playerRenamed', (data) => {
    if (roomState && roomState.players[data.id]) {
        roomState.players[data.id].name = data.name;
    }
});

// ============ NEW FEATURE SOCKET HANDLERS ============

// Connection Status
socket.on('connect', () => {
    updateConnectionStatus('connected');
    startPingTracking();
});

socket.on('disconnect', () => {
    updateConnectionStatus('disconnected');
    if (pingInterval) clearInterval(pingInterval);
});

socket.on('connect_error', () => {
    updateConnectionStatus('disconnected');
});

// Ping/Pong for connection quality
socket.on('pong', () => {
    if (typeof lastPingTime !== 'undefined' && typeof updatePing === 'function') {
        const ping = Date.now() - lastPingTime;
        updatePing(ping);
    }
});

// Room Code
socket.on('roomCode', (data) => {
    if (data.code) {
        document.getElementById('room-code-value').textContent = data.code;
    }
});

// Join by Code Response
socket.on('joinByCodeResult', (data) => {
    if (data.success) {
        if (data.requiresPassword) {
            document.getElementById('password-modal').classList.remove('hidden');
            // Store room code and ID for password submission
            window.pendingRoomCode = data.code;
            window.pendingRoomId = data.roomId;
        } else {
            socket.emit('joinRoom', {
                name: document.getElementById('player-name').value.trim() || 'Chef',
                roomId: data.roomId
            });
        }
    } else {
        ui?.showNotification(data.message || 'Room not found!', 'error');
    }
});

// Password Required
socket.on('passwordRequired', (data) => {
    document.getElementById('password-modal').classList.remove('hidden');
    if (data && data.roomId) {
        window.pendingRoomId = data.roomId;
    }
});

// Friends
socket.on('friendList', (friends) => {
    const list = document.getElementById('friends-list');
    if (!list) return;

    if (friends.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-dim);">No friends yet</p>';
        return;
    }

    list.innerHTML = friends.map(f => `
        <div class="friend-item">
            <div class="friend-info">
                <span class="friend-status ${f.status || 'offline'}"></span>
                <span>${f.name}</span>
            </div>
            <button class="btn-sm" onclick="inviteFriend('${f.id}')" title="Invite to game"><i class="bi bi-envelope"></i></button>
        </div>
    `).join('');
});

socket.on('friendAdded', (data) => {
    if (ui && typeof ui.showNotification === 'function') {
        ui.showNotification(`Friend ${data.name} added!`, 'success');
    }
    socket.emit('getFriends');
});

socket.on('friendOnline', (data) => {
    ui?.showNotification(`${data.name} is now online!`, 'info');
});

// VS Scoreboard Update
socket.on('scoreUpdate', (data) => {
    if (roomState && roomState.mode === 'multi_vs') {
        updateVSScoreboard(data.scores);
    }
});

function updateVSScoreboard(scores) {
    const list = document.getElementById('vs-scores-list');
    const board = document.getElementById('vs-scoreboard');
    if (!list || !board) return;

    board.classList.remove('hidden');
    list.innerHTML = '';

    // Sort by score descending
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    sorted.forEach(([playerId, score]) => {
        const player = roomState?.players[playerId];
        if (!player) return;

        const item = document.createElement('div');
        item.className = 'vs-score-item';
        item.innerHTML = `
            <span class="player-name" style="color:${player.color}">${player.name}</span>
            <span class="player-score">${score}</span>
        `;
        list.appendChild(item);
    });
}

// Auto-refresh server list
let serverListInterval = null;
window.startAutoRefresh = () => {
    if (serverListInterval) clearInterval(serverListInterval);
    serverListInterval = setInterval(() => {
        if (currentMenu === 'join') {
            refreshServerList();
        }
    }, 5000);
};

window.stopAutoRefresh = () => {
    if (serverListInterval) {
        clearInterval(serverListInterval);
        serverListInterval = null;
    }
};

// Update showMenu to start/stop auto-refresh
const originalShowMenu = window.showMenu;
window.showMenu = (menuId) => {
    if (typeof originalShowMenu === 'function') {
        originalShowMenu(menuId);
    }
    if (menuId === 'join') {
        if (typeof startAutoRefresh === 'function') startAutoRefresh();
    } else {
        if (typeof stopAutoRefresh === 'function') stopAutoRefresh();
    }
};

// Invite Friend
window.inviteFriend = (friendId) => {
    if (roomState) {
        socket.emit('inviteFriend', { friendId, roomId: roomState.id });
        if (ui && typeof ui.showNotification === 'function') {
            ui.showNotification('Invitation sent!', 'success');
        }
    }
};

// Game Countdown
socket.on('gameCountdown', (data) => {
    const countdown = data.countdown;
    if (countdown > 0) {
        if (ui && typeof ui.showNotification === 'function') {
            ui.showNotification(`Game starting in ${countdown}...`, 'info');
        }
    } else {
        if (ui && typeof ui.showNotification === 'function') {
            ui.showNotification('Game starting!', 'success');
        }
        // Ensure pause menu is hidden
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) pauseMenu.classList.add('hidden');
    }
});

// Player Kicked
socket.on('playerKicked', (data) => {
    const notification = document.getElementById('notifications');
    if (notification) {
        const el = document.createElement('div');
        el.className = 'notification error';
        el.textContent = data.message || 'You were kicked from the room!';
        notification.appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }
    setTimeout(() => location.reload(), 2000);
});

socket.on('playerKickedNotification', (data) => {
    if (ui && typeof ui.showNotification === 'function') {
        ui.showNotification(`${data.playerName} was kicked from the room.`, 'info');
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

    if (!gameConfig) {
        console.error('gameConfig not available for player mesh');
        return;
    }

    const ts = gameConfig.TILE_SIZE;
    group.position.set(player.gridX * ts, 0, player.gridZ * ts);
    scene.add(group);
    playerMeshes[player.id] = { group, body, head, hat, bobTime: Math.random() * 10 };

    // Initialize held item
    if (player.holding) {
        try {
            updatePlayerHeldItem(player.id, player.holding);
        } catch (error) {
            console.error('Error updating player held item:', error);
        }
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

    if (roomState && roomState.state === 'playing' && gameConfig) {
        const me = roomState.players[playerId];
        if (me) {
            // Initialize float position if missing
            if (typeof me.x === 'undefined' && me.gridX !== undefined) {
                me.x = me.gridX * gameConfig.TILE_SIZE;
            }
            if (typeof me.z === 'undefined' && me.gridZ !== undefined) {
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
    if (kitchen && typeof kitchen.animate === 'function') {
        try {
            kitchen.animate(delta, roomState ? roomState.players : null);
        } catch (error) {
            console.error('Error animating kitchen:', error);
        }
    }

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
    if (roomState && roomState.players && roomState.players[playerId] && roomState.stations && kitchen) {
        const me = roomState.players[playerId];
        const px = me.x !== undefined ? me.x : me.gridX * (gameConfig ? gameConfig.TILE_SIZE : 2);
        const pz = me.z !== undefined ? me.z : me.gridZ * (gameConfig ? gameConfig.TILE_SIZE : 2);
        const proximityDistance = (gameConfig ? gameConfig.TILE_SIZE : 2) * 2.5;

        Object.values(roomState.stations).forEach(st => {
            if (st.type === 'crate') {
                const sx = st.gridX * (gameConfig ? gameConfig.TILE_SIZE : 2);
                const sz = st.gridZ * (gameConfig ? gameConfig.TILE_SIZE : 2);
                const dist = Math.sqrt(Math.pow(px - sx, 2) + Math.pow(pz - sz, 2));

                const stationMesh = kitchen.stationMeshes[st.id];
                if (stationMesh && stationMesh.group) {
                    const label = stationMesh.group.getObjectByName('nameLabel');
                    if (label) {
                        label.visible = dist <= proximityDistance;
                    }
                }
            }
        });
    }

    // Update order timers
    if (roomState && ui && typeof ui.updateOrderTimers === 'function') {
        ui.updateOrderTimers(roomState.orders);
    }

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
    if (!roomState || !roomState.kitchen || !gameConfig) return false;

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
        if (roomState.kitchen[gz] && roomState.kitchen[gz][gx] !== 0) {
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
    if (kitchen && typeof kitchen.createContentMesh === 'function') {
        try {
            const contentMesh = kitchen.createContentMesh(holding);
            // Scale down to hand-held size (station items are full-size)
            const heldScale = 0.6;
            contentMesh.scale.set(heldScale, heldScale, heldScale);
            heldGroup.add(contentMesh);
        } catch (error) {
            console.error('Error creating content mesh:', error);
        }
    } else {
        // Fallback: simple meshes if kitchen renderer isn't available
        if (holding.type === 'ingredient' && gameConfig && gameConfig.INGREDIENTS) {
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
