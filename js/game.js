import * as THREE from 'three';
import { KitchenRenderer } from './kitchen.js';
import { UIManager } from './ui.js';

// ============ CONNECT TO SERVER ============
// Automatically use GAME_CONFIG.BACKEND_URL if provided, else default to current host
const socket = io(window.GAME_CONFIG?.BACKEND_URL || undefined);
let playerId = null;
let gameConfig = null;
let roomState = null;
let currentUser = null;
let currentFriends = []; // Global list of friends for identifying friends in lobby
let connectionTimeout = null;

// Socket connection handling
socket.on('connect', () => {
    console.log('✅ Connected to server');
    updateConnectionStatus('connected');
    if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
    }
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    updateConnectionStatus('disconnected');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    updateConnectionStatus('disconnected');
    showNotif('Connection Error', 'Failed to connect to server. Retrying...', 'error');
});

socket.on('reconnect', () => {
    console.log('🔄 Reconnected to server');
    updateConnectionStatus('connected');
    // Retry login if we have saved user data
    const savedLocal = localStorage.getItem('chef_user');
    const savedGuest = localStorage.getItem('chef_user_guest');
    const savedUser = savedLocal || savedGuest;
    if (savedUser && !currentUser) {
        try {
            const user = JSON.parse(savedUser);
            if (user.type === 'account') {
                socket.emit('userLogin', {
                    autoLogin: true,
                    userId: user.id,
                    username: user.username
                });
            } else {
                socket.emit('guestLogin', { userId: user.id, name: user.name });
            }
        } catch (e) {
            console.error('Error parsing saved user on reconnect:', e);
        }
    }
});

const getStatusText = (status) => {
    switch (status) {
        case 'online': return 'Online';
        case 'lobby': return 'In Lobby';
        case 'ingame': return 'In Game';
        case 'offline': return 'Offline';
        default: return 'Offline';
    }
};

const getAvatarUrl = (key) => {
    const urls = {
        'chef_1': '/assets/avatars/chef1.jpg',
        'chef_2': '/assets/avatars/chef2.jpg',
        'chef_3': '/assets/avatars/chef3.jpg',
        'chef_4': '/assets/avatars/chef4.jpg',
        'chef_5': '/assets/avatars/chef5.jpg',
        'chef_6': '/assets/avatars/chef6.jpg'
    };
    return urls[key] || urls['chef_1'];
};

window.refreshUserAvatar = () => {
    if (!currentUser) return;
    const userAvatarContainer = document.querySelector('.user-avatar');
    if (userAvatarContainer) {
        const icon = userAvatarContainer.querySelector('i');
        const profileImageKey = currentUser.profileImage || 'chef_1';

        // Hide icon if we have a profile image
        if (icon) icon.classList.add('hidden');

        let img = userAvatarContainer.querySelector('img');
        if (!img) {
            img = document.createElement('img');
            userAvatarContainer.appendChild(img);
        }
        img.src = getAvatarUrl(profileImageKey);
        img.classList.remove('hidden');
    }
};

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
const droppedItemMeshes = {};
const keys = {};
window.keys = keys; // Expose for mobile controls
let moveTimer = 0;
let lastChopEmit = 0;
let spacePressedTime = 0;
let didChop = false; // Restored for interaction logic
let isPaused = false;

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

    // Hide logo, profile, and connection status on non-main menus (for mobile landscape)
    const logoContainer = document.querySelector('.logo-container');
    const userProfile = document.getElementById('user-profile');
    const connectionStatus = document.getElementById('connection-status');
    
    if (menuId === 'main') {
        // Show on main menu
        if (logoContainer) logoContainer.style.display = '';
        if (userProfile) userProfile.style.display = '';
        if (connectionStatus) connectionStatus.style.display = '';
    } else {
        // Hide on other menus (for mobile landscape optimization)
        if (window.innerWidth <= 926 && window.matchMedia('(orientation: landscape)').matches) {
            if (logoContainer) logoContainer.style.display = 'none';
            if (userProfile) userProfile.style.display = 'none';
            if (connectionStatus) connectionStatus.style.display = 'none';
        }
    }

    // Special handling for friends menu
    if (menuId === 'friends') {
        const guestWarning = document.getElementById('friends-guest-warning');
        const friendsContent = document.getElementById('friends-section-content');

        if (!currentUser || currentUser.type === 'guest') {
            if (guestWarning) guestWarning.classList.remove('hidden');
            if (friendsContent) friendsContent.style.display = 'none';
        } else {
            if (guestWarning) guestWarning.classList.add('hidden');
            if (friendsContent) friendsContent.style.display = 'block';
            // Request friends list
            socket.emit('getFriends');
        }
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
    const name = currentUser ? (currentUser.name || currentUser.username) : 'Chef';
    // Join existing room
    socket.emit('joinRoom', { name, roomId, password: window.pendingPassword || undefined }); // Mode/Diff taken from room
    window.pendingPassword = null; // Clear after use
};

window.reconnectToRoom = (roomId) => {
    const name = currentUser ? (currentUser.name || currentUser.username) : 'Chef';
    console.log('Attempting to reconnect to room:', roomId);
    showNotif('Reconnecting', 'Rejoining your game...', 'info');

    // Hide the lobby screen while reconnecting
    const lobbyScreen = document.getElementById('lobby-screen');
    if (lobbyScreen) lobbyScreen.classList.add('hidden');

    // Use the dedicated reconnect event (not joinRoom)
    socket.emit('reconnectRoom', { name, roomId });
};

window.leaveRoom = () => {
    socket.emit('leaveRoom');
    location.reload(); // Simple reload to leave for now
};

window.startSinglePlayer = (difficulty = 'easy') => {
    const name = currentUser ? (currentUser.name || currentUser.username) : 'Chef';
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
    // but in the meantime, we can show a minimalist loading if needed.
};

// ============ FRIEND SYSTEM LOBBY HELPER ============
window.addFriendFromLobby = (name) => {
    if (socket) {
        socket.emit('addFriend', { name });
    }
};

// ============ NOTIFICATION SYSTEM ============
window.showNotif = (title, msg, type = 'info') => {
    const container = document.getElementById('notifications');
    if (!container) return;

    const notif = document.createElement('div');
    notif.className = `notif ${type}`;

    let icon = 'bi-info-circle';
    if (type === 'success') icon = 'bi-check-circle-fill';
    if (type === 'error') icon = 'bi-exclamation-triangle-fill';

    notif.innerHTML = `
        <div class="notif-icon"><i class="bi ${icon}"></i></div>
        <div class="notif-content">
            <span class="notif-title">${title}</span>
            <span class="notif-msg">${msg}</span>
        </div>
    `;

    container.appendChild(notif);

    // Auto remove
    setTimeout(() => {
        notif.classList.add('fade-out');
        setTimeout(() => notif.remove(), 500);
    }, 4000);
};

// ============ USER SYSTEM ============
window.switchLoginTab = (tab) => {
    // Buttons
    document.querySelectorAll('.login-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === tab);
    });
    // Forms
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.toggle('active', form.id === `form-${tab}`);
    });

    // Update hint text
    const hint = document.getElementById('auth-hint');
    if (tab === 'guest') hint.textContent = "Guest progress is saved only on this browser.";
    else if (tab === 'register') hint.textContent = "Create an account to save progress permanently!";
    else hint.textContent = "Welcome back, Chef!";
};

window.handleRegister = () => {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const confirm = document.getElementById('register-confirm-password').value.trim();

    if (username.length < 3) return showNotif('Error', 'Username must be at least 3 characters!', 'error');
    if (password.length < 6) return showNotif('Error', 'Password must be at least 6 characters!', 'error');
    if (password !== confirm) return showNotif('Error', 'Passwords do not match!', 'error');

    socket.emit('register', { username, password });
};

window.handleLogin = () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) return showNotif('Error', 'Enter both username and password!', 'error');

    socket.emit('userLogin', { username, password });
};

window.loginGuest = () => {
    const nameInput = document.getElementById('guest-name');
    const name = nameInput.value.trim() || 'Chef';
    // Support session persistence even after tab is closed (local storage)
    const storedUserStr = localStorage.getItem('chef_user_guest');
    const storedUser = storedUserStr ? JSON.parse(storedUserStr) : {};

    socket.emit('guestLogin', {
        userId: (storedUser.type === 'guest') ? storedUser.id : null,
        name: name
    });
};

window.logout = () => {
    localStorage.removeItem('chef_user'); // Account
    localStorage.removeItem('chef_user_guest'); // Guest
    location.reload();
};

socket.on('loginSuccess', (user) => {
    // Only show notification if not an auto-login (detected if login overlay is visible)
    const loginOverlay = document.getElementById('login-overlay');
    if (loginOverlay && !loginOverlay.classList.contains('hidden')) {
        showNotif('Success', `Welcome Chef ${user.name || user.username}!`, 'success');
    }

    currentUser = user;

    // Account type users saved permanently, guests saved separately so they don't override each other
    if (user.type === 'account') {
        localStorage.setItem('chef_user', JSON.stringify(user));
    } else {
        localStorage.setItem('chef_user_guest', JSON.stringify(user));
    }

    // Update UI
    const userProfile = document.getElementById('user-profile');
    const displayUserName = document.getElementById('display-user-name');
    const userAvatarIcon = document.querySelector('.user-avatar i');
    const userAvatarContainer = document.querySelector('.user-avatar');
    const settingsFab = document.getElementById('settings-fab');

    if (loginOverlay) loginOverlay.classList.add('hidden');
    if (userProfile) userProfile.classList.remove('hidden');
    if (displayUserName) displayUserName.textContent = user.name || user.username;
    if (settingsFab) settingsFab.classList.add('hidden'); // Hide settings button when logged in

    // Show avatar in the circle
    refreshUserAvatar();

    // Refresh room list to show reconnect button if applicable
    socket.emit('getRooms');

    // Update friends panel based on account type
    const addFriendSection = document.getElementById('friends-panel-add-section');
    const panelList = document.getElementById('main-menu-friends-list');

    if (user.type === 'account') {
        // Show add friend section for registered users
        if (addFriendSection) addFriendSection.style.display = 'flex';
        socket.emit('getFriends');
    } else {
        // Hide add friend section for guests
        if (addFriendSection) addFriendSection.style.display = 'none';
        if (panelList) {
            panelList.innerHTML = '<p class="friends-empty-msg">Create an account to add friends</p>';
        }
    }

    // Load leaderboard
    setTimeout(() => {
        if (typeof fetchMainLeaderboard === 'function') {
            fetchMainLeaderboard();
        }
    }, 500);

    // Notify mobile orientation manager about login and force fullscreen
    if (window.mobileOrientationManager) {
        window.mobileOrientationManager.isLoggedIn = true;
        console.log('📱 User logged in - mobile manager notified');

        // Force fullscreen immediately after login (mobile optimization)
        if (window.mobileOrientationManager.isMobile) {
            // Check if this is auto-login (overlay already hidden) or manual login
            const isAutoLogin = loginOverlay && loginOverlay.classList.contains('hidden');

            if (isAutoLogin) {
                // For auto-login, we need user interaction first
                // Show the fullscreen button immediately
                console.log('📱 Auto-login detected - waiting for user interaction for fullscreen');
                window.mobileOrientationManager.showFullscreenButton();

                // Also try to request fullscreen on first click anywhere
                const autoFullscreenHandler = () => {
                    console.log('📱 First click detected - requesting fullscreen');
                    window.mobileOrientationManager.requestFullscreen().catch(err => {
                        console.log('⚠️ Fullscreen request failed:', err);
                    });
                    document.removeEventListener('click', autoFullscreenHandler);
                };
                document.addEventListener('click', autoFullscreenHandler, { once: true });
            } else {
                // For manual login, request fullscreen immediately (we have user gesture)
                setTimeout(() => {
                    window.mobileOrientationManager.requestFullscreen().catch(err => {
                        console.log('⚠️ Fullscreen request failed, button will be shown:', err);
                    });
                }, 100);
            }
        }
    }

    console.log(`✅ Logged in as ${user.name || user.username}`);
});

socket.on('loginError', (data) => {
    showNotif('Login/Auth Error', data.msg, 'error');
    
    // Clear invalid localStorage if server requests it
    if (data.clearStorage) {
        console.log('🗑️ Clearing invalid stored credentials');
        localStorage.removeItem('chef_user');
        localStorage.removeItem('chef_user_guest');
    }
});

socket.on('forceLogout', (data) => {
    showNotif('Session Ended', data.msg, 'error');

    // Clear stored credentials
    localStorage.removeItem('chef_user');
    localStorage.removeItem('chef_user_guest');

    // Reload page after a short delay to show the notification
    setTimeout(() => {
        location.reload();
    }, 2000);
});

socket.on('registerSuccess', (data) => {
    showNotif('Registered!', data.msg, 'success');
    switchLoginTab('login');
    // Clear registration fields
    document.getElementById('register-username').value = '';
    document.getElementById('register-password').value = '';
    document.getElementById('register-confirm-password').value = '';
});

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
    // Check if user is logged in and not a guest
    if (!currentUser) {
        showNotif('Error', 'You need to be logged in to add friends!', 'error');
        return;
    }

    if (currentUser.type === 'guest') {
        showNotif('Error', 'Guest accounts cannot add friends. Please create an account!', 'error');
        return;
    }

    const friendName = document.getElementById('add-friend-input').value.trim();
    if (!friendName) {
        showNotif('Error', 'Please enter a username!', 'error');
        return;
    }

    if (friendName === currentUser.username) {
        showNotif('Error', 'You cannot add yourself as a friend!', 'error');
        return;
    }

    socket.emit('addFriend', { name: friendName });
    document.getElementById('add-friend-input').value = '';
};

// Add friend from panel (main menu)
window.addFriendFromPanel = () => {
    // Check if user is logged in and not a guest
    if (!currentUser) {
        showNotif('Error', 'You need to be logged in to add friends!', 'error');
        return;
    }

    if (currentUser.type === 'guest') {
        showNotif('Error', 'Guest accounts cannot add friends. Please create an account!', 'error');
        return;
    }

    const friendName = document.getElementById('friends-panel-add-input').value.trim();
    if (!friendName) {
        showNotif('Error', 'Please enter a username!', 'error');
        return;
    }

    if (friendName === currentUser.username) {
        showNotif('Error', 'You cannot add yourself as a friend!', 'error');
        return;
    }

    socket.emit('addFriend', { name: friendName });
    document.getElementById('friends-panel-add-input').value = '';
};

// ============ LEADERBOARD FUNCTIONS ============
let currentLeaderboardCategory = 'score';

window.switchShopCategory = (category, btn) => {
    // Update button states
    document.querySelectorAll('.shop-category-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // TODO: Load shop items for this category
    const listEl = document.getElementById('shop-items-list');
    if (listEl) {
        listEl.innerHTML = '<p style="text-align:center; color:var(--text-dim); padding:40px;">Coming Soon! 🎮</p>';
    }
};

window.switchMainLeaderboardCategory = (category, btn) => {
    currentLeaderboardCategory = category;

    // Update button states
    document.querySelectorAll('.lb-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Fetch new leaderboard data
    fetchMainLeaderboard();
};

async function fetchMainLeaderboard() {
    const listEl = document.getElementById('main-menu-leaderboard-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="loading-spinner-small">Loading...</div>';

    try {
        const response = await fetch(`/api/leaderboard?category=${currentLeaderboardCategory}&limit=10`);
        const data = await response.json();

        if (data.length === 0) {
            listEl.innerHTML = '<div class="loading-spinner-small">No data yet</div>';
            return;
        }

        listEl.innerHTML = data.map(player => {
            const rankClass = player.rank <= 3 ? `rank-${player.rank}` : '';
            let statValue;

            switch (currentLeaderboardCategory) {
                case 'wins':
                    statValue = `${player.wins} wins`;
                    break;
                case 'dishes':
                    statValue = `${player.dishesServed} dishes`;
                    break;
                case 'score':
                default:
                    statValue = `${player.totalScore} pts`;
                    break;
            }

            return `
                <div class="leaderboard-item ${rankClass}">
                    <div class="leaderboard-rank">${player.rank}</div>
                    <img src="${getAvatarUrl(player.profileImage)}" class="leaderboard-avatar" alt="${player.username}">
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${player.username}</div>
                        <div class="leaderboard-stat">${statValue}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        listEl.innerHTML = '<div class="loading-spinner-small">Failed to load</div>';
    }
}

// Chat Toggle
window.toggleChat = () => {
    const chat = document.getElementById('chat-container');
    chat.classList.toggle('collapsed');
};

// Setup Enter key for add friend input
document.addEventListener('DOMContentLoaded', () => {
    const friendInput = document.getElementById('friends-panel-add-input');
    if (friendInput) {
        friendInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addFriendFromPanel();
            }
        });
    }
});

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
    const roomId = window.pendingRoomId;
    const name = document.getElementById('player-name').value.trim() || 'Chef';

    if (password && roomId) {
        // Retry joining with the password
        socket.emit('joinRoom', { name, roomId, password });
        closePasswordModal();
        window.pendingRoomId = null;
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

// ============ PROFILE AND STATS ============
let selectedAvatarKey = 'chef_1';

window.switchProfileTab = (tabId) => {
    // Update tab buttons
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `btn-tab-${tabId}`);
    });

    // Update tab content
    document.querySelectorAll('.profile-tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `profile-tab-${tabId}`);
    });
};

window.openProfileCustomization = (initialTab = 'stats') => {
    console.log('🎯 openProfileCustomization called with tab:', initialTab);
    console.log('👤 currentUser:', currentUser);

    if (!currentUser) {
        console.log('❌ No currentUser - showing error notification');
        showNotif('Notice', 'Please login to view your profile!', 'info');
        return;
    }

    const modal = document.getElementById('profile-modal');
    console.log('📱 Modal element:', modal);

    if (!modal) {
        console.log('❌ Modal element not found!');
        return;
    }

    // Default to stats or specified tab
    switchProfileTab(initialTab);

    // Populate profile data
    populateProfileData();

    console.log('✅ Opening profile modal');
    modal.classList.remove('hidden');
};

function populateProfileData() {
    // Sidebar Info
    const displayName = document.getElementById('profile-display-name');
    const displayImg = document.getElementById('profile-display-img');
    const levelBadge = document.getElementById('profile-level-badge');
    const xpText = document.getElementById('profile-xp-text');
    const xpBar = document.getElementById('profile-xp-bar');

    // Mobile Header Info
    const mobileDisplayName = document.getElementById('profile-mobile-name');
    const mobileDisplayImg = document.getElementById('profile-mobile-img');
    const mobileLevelBadge = document.getElementById('profile-mobile-level');
    const mobileXpText = document.getElementById('profile-mobile-xp-text');
    const mobileXpBar = document.getElementById('profile-mobile-xp-bar');

    const userName = currentUser.name || currentUser.username;
    if (displayName) displayName.textContent = userName;
    if (mobileDisplayName) mobileDisplayName.textContent = userName;

    selectedAvatarKey = currentUser.profileImage || 'chef_1';
    const avatarUrl = getAvatarUrl(selectedAvatarKey);
    if (displayImg) displayImg.src = avatarUrl;
    if (mobileDisplayImg) mobileDisplayImg.src = avatarUrl;

    // User ID
    const displayId = document.getElementById('profile-display-id');
    const actualId = currentUser.uid || currentUser.id || '000000';
    if (displayId) displayId.textContent = `#${actualId}`;

    // Progress/Level Stats
    const level = currentUser.level || 1;
    const currentXp = currentUser.xp || 0;
    const maxXp = level * 50; // Requirement increases by 50 per level
    const xpPercentage = (currentXp / maxXp) * 100;
    const xpTextContent = `${currentXp} / ${maxXp} XP`;

    if (levelBadge) levelBadge.textContent = `Lv. ${level}`;
    if (mobileLevelBadge) mobileLevelBadge.textContent = `Lv. ${level}`;
    if (xpText) xpText.textContent = xpTextContent;
    if (mobileXpText) mobileXpText.textContent = xpTextContent;
    if (xpBar) xpBar.style.width = `${xpPercentage}%`;
    if (mobileXpBar) mobileXpBar.style.width = `${xpPercentage}%`;

    // Game Statistics
    const stats = currentUser.stats || {};
    if (document.getElementById('stat-served')) document.getElementById('stat-served').textContent = stats.dishesServed || 0;
    if (document.getElementById('stat-played')) document.getElementById('stat-played').textContent = stats.gamesPlayed || 0;
    if (document.getElementById('stat-wins')) document.getElementById('stat-wins').textContent = stats.wins || 0;

    if (document.getElementById('stat-chopped')) document.getElementById('stat-chopped').textContent = stats.itemsChopped || 0;
    if (document.getElementById('stat-cooked')) document.getElementById('stat-cooked').textContent = stats.itemsCooked || 0;

    // Render Match History
    const historyList = document.getElementById('profile-history-list');
    if (historyList) {
        if (!stats.gameScores || stats.gameScores.length === 0) {
            historyList.innerHTML = '<p style="text-align:center; color:var(--text-dim); margin-top:20px;">No match history yet.</p>';
        } else {
            // Sort by most recent first, max 12
            const recentGames = [...stats.gameScores].sort((a, b) => b.date - a.date).slice(0, 12);

            historyList.innerHTML = recentGames.map(game => {
                const dateObj = new Date(game.date);
                const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                let statusClass = 'loss';
                let statusDisplay = '<i class="bi bi-person-fill"></i>';

                if (game.mode === 'multi_vs' || (game.opponent && game.mode !== 'multi_coop')) {
                    // VS Mode - show win/lose/tie text
                    if (game.won) {
                        statusClass = 'win';
                        statusDisplay = 'Win';
                    } else if (game.isTie) {
                        statusClass = 'tie';
                        statusDisplay = 'Tie';
                    } else {
                        statusClass = 'loss';
                        statusDisplay = 'Lose';
                    }
                } else if (game.mode === 'multi_coop') {
                    // Co-op Mode - show double friend icon
                    statusClass = 'coop';
                    statusDisplay = '<i class="bi bi-people-fill"></i>';
                } else {
                    // Single Player - show single profile icon
                    statusClass = 'single';
                    statusDisplay = '<i class="bi bi-person-fill"></i>';
                }

                let modeDisplay = 'Single Player'; // Default fallback
                if (game.mode === 'multi_coop') modeDisplay = 'Co-op';
                else if (game.mode === 'multi_vs' || game.opponent) modeDisplay = 'VS Battle';
                else if (game.mode === 'single') modeDisplay = 'Single Player';

                let details = `Dishes: ${game.dishesServed || 0} | XP: +${game.xpEarned || 0} | <img src="/assets/chef-hat-coin.png" style="width: 1em; height: 1em; vertical-align: -0.125em;"> +${game.chefHatEarned || 0}`;

                // VS Battle layout: Status - Name - VS - Opponent Name - Status
                if (game.mode === 'multi_vs' || (game.opponent && game.mode !== 'multi_coop')) {
                    const opponentStatusClass = game.won ? 'loss' : (game.isTie ? 'tie' : 'win');
                    const opponentStatusDisplay = game.won ? 'Lose' : (game.isTie ? 'Tie' : 'Win');

                    return `
                    <div class="history-item history-item-vs">
                        <div class="history-status ${statusClass}">${statusDisplay}</div>
                        <div class="history-player-name">${currentUser.name || currentUser.username}</div>
                        <div class="history-vs-divider">VS</div>
                        <div class="history-player-name">${game.opponent}</div>
                        <div class="history-status ${opponentStatusClass}">${opponentStatusDisplay}</div>
                        <div class="history-vs-info">${dateStr} &bull; ${details}</div>
                    </div>
                    `;
                }

                // Co-op or Single Player layout (original)
                if (game.mode === 'multi_coop') details += ` | with ${game.opponent}`;

                return `
                <div class="history-item">
                    <div class="history-status ${statusClass}">${statusDisplay}</div>
                    <div class="history-details">
                        <div class="history-mode">${modeDisplay}</div>
                        <div class="history-date">${dateStr} &bull; ${details}</div>
                    </div>
                    <div class="history-score">${game.score || 0} pts</div>
                </div>
                `;
            }).join('');
        }
    }

    // Settings (Minimized Customize)
    const nameInput = document.getElementById('profile-new-username');
    if (nameInput) nameInput.value = currentUser.name || currentUser.username;

    // Update avatar grid selection
    document.querySelectorAll('.avatar-option').forEach(opt => {
        const key = opt.getAttribute('data-key');
        if (key) {
            opt.classList.toggle('selected', key === selectedAvatarKey);
        }
    });

    // Render Achievements
    const achievementsGrid = document.getElementById('profile-achievements-grid');
    if (achievementsGrid) {
        const unlockedAchievements = stats.achievements || [];
        const unlockedIds = unlockedAchievements.map(a => a.id);

        // Define all achievements with icons
        const allAchievements = [
            { id: 'first_dish', name: 'First Dish!', description: 'Serve your first dish', icon: 'main-dish.png' },
            { id: 'kitchen_novice', name: 'Kitchen Novice', description: 'Win your first game', icon: 'bi-trophy' },

            // Multiplayer
            { id: 'coop_first', name: 'Teamwork!', description: 'Play your first co-op game', icon: 'bi-people' },
            { id: 'coop_5', name: 'Good Partner', description: 'Play 5 co-op games', icon: 'bi-people' },
            { id: 'coop_10', name: 'Team Player', description: 'Play 10 co-op games', icon: 'bi-people' },
            { id: 'coop_25', name: 'Best Friends', description: 'Play 25 co-op games', icon: 'bi-people' },
            { id: 'coop_50', name: 'Dynamic Duo', description: 'Play 50 co-op games', icon: 'bi-people' },

            // Score progression (5 levels)
            { id: 'score_100', name: 'Century Chef', description: 'Score 100 points in a game', icon: 'bi-star' },
            { id: 'score_200', name: 'Double Century', description: 'Score 200 points in a game', icon: 'bi-star' },
            { id: 'score_300', name: 'Triple Century', description: 'Score 300 points in a game', icon: 'bi-star' },
            { id: 'score_400', name: 'Quad Century', description: 'Score 400 points in a game', icon: 'bi-star' },
            { id: 'score_500', name: 'Legendary Chef', description: 'Score 500 points in a game', icon: 'bi-star' },

            // Dishes per game (5 levels)
            { id: 'dishes_5', name: 'Busy Chef', description: 'Serve 5 dishes in a game', icon: 'bi-basket' },
            { id: 'dishes_10', name: 'Master Chef', description: 'Serve 10 dishes in a game', icon: 'bi-basket' },
            { id: 'dishes_15', name: 'Expert Chef', description: 'Serve 15 dishes in a game', icon: 'bi-basket' },
            { id: 'dishes_20', name: 'Elite Chef', description: 'Serve 20 dishes in a game', icon: 'bi-basket' },
            { id: 'dishes_25', name: 'Godlike Chef', description: 'Serve 25 dishes in a game', icon: 'bi-basket' },

            // Perfect dishes (5 levels)
            { id: 'perfect_3', name: 'Perfectionist', description: 'Serve 3 perfect dishes in a game', icon: 'bi-gem' },
            { id: 'perfect_5', name: 'Flawless Cook', description: 'Serve 5 perfect dishes in a game', icon: 'bi-gem' },
            { id: 'perfect_8', name: 'Perfect Master', description: 'Serve 8 perfect dishes in a game', icon: 'bi-gem' },
            { id: 'perfect_12', name: 'Precision Expert', description: 'Serve 12 perfect dishes in a game', icon: 'bi-gem' },
            { id: 'perfect_15', name: 'Perfection Incarnate', description: 'Serve 15 perfect dishes in a game', icon: 'bi-gem' },

            // Games played (5 levels)
            { id: 'games_10', name: 'Veteran Chef', description: 'Play 10 games', icon: 'chef.png' },
            { id: 'games_25', name: 'Seasoned Pro', description: 'Play 25 games', icon: 'chef.png' },
            { id: 'games_50', name: 'Kitchen Legend', description: 'Play 50 games', icon: 'chef.png' },
            { id: 'games_100', name: 'Culinary Master', description: 'Play 100 games', icon: 'chef.png' },
            { id: 'games_200', name: 'Eternal Chef', description: 'Play 200 games', icon: 'chef.png' }
        ];

        achievementsGrid.innerHTML = allAchievements.map(achievement => {
            const isUnlocked = unlockedIds.includes(achievement.id);
            let progressText = '';
            let progressPercent = 0;
            const achievementId = achievement.id;

            // Determine current progress level for this achievement category
            let currentProgressLevel = 0;

            // Check which achievements in the same category are unlocked to determine progress
            if (achievementId.startsWith('coop_')) {
                if (unlockedIds.includes('coop_50')) currentProgressLevel = 5;
                else if (unlockedIds.includes('coop_25')) currentProgressLevel = 4;
                else if (unlockedIds.includes('coop_10')) currentProgressLevel = 3;
                else if (unlockedIds.includes('coop_5')) currentProgressLevel = 2;
                else if (unlockedIds.includes('coop_first')) currentProgressLevel = 1;
            } else if (achievementId.startsWith('score_')) {
                if (unlockedIds.includes('score_500')) currentProgressLevel = 5;
                else if (unlockedIds.includes('score_400')) currentProgressLevel = 4;
                else if (unlockedIds.includes('score_300')) currentProgressLevel = 3;
                else if (unlockedIds.includes('score_200')) currentProgressLevel = 2;
                else if (unlockedIds.includes('score_100')) currentProgressLevel = 1;
            } else if (achievementId.startsWith('dishes_')) {
                if (unlockedIds.includes('dishes_25')) currentProgressLevel = 5;
                else if (unlockedIds.includes('dishes_20')) currentProgressLevel = 4;
                else if (unlockedIds.includes('dishes_15')) currentProgressLevel = 3;
                else if (unlockedIds.includes('dishes_10')) currentProgressLevel = 2;
                else if (unlockedIds.includes('dishes_5')) currentProgressLevel = 1;
            } else if (achievementId.startsWith('perfect_')) {
                if (unlockedIds.includes('perfect_15')) currentProgressLevel = 5;
                else if (unlockedIds.includes('perfect_12')) currentProgressLevel = 4;
                else if (unlockedIds.includes('perfect_8')) currentProgressLevel = 3;
                else if (unlockedIds.includes('perfect_5')) currentProgressLevel = 2;
                else if (unlockedIds.includes('perfect_3')) currentProgressLevel = 1;
            } else if (achievementId.startsWith('games_')) {
                if (unlockedIds.includes('games_200')) currentProgressLevel = 5;
                else if (unlockedIds.includes('games_100')) currentProgressLevel = 4;
                else if (unlockedIds.includes('games_50')) currentProgressLevel = 3;
                else if (unlockedIds.includes('games_25')) currentProgressLevel = 2;
                else if (unlockedIds.includes('games_10')) currentProgressLevel = 1;
            }

            if (achievement.id === 'kitchen_novice') {
                const current = stats.wins || 0;
                const target = 1;
                progressText = `${current}/${target}`;
                progressPercent = Math.min((current / target) * 100, 100);
            } else if (achievement.id === 'first_dish') {
                const current = stats.dishesServed || 0;
                const target = 1;
                progressText = `${current}/${target}`;
                progressPercent = Math.min((current / target) * 100, 100);
            }
            // Co-op achievements
            else if (achievement.id === 'coop_first') {
                const current = stats.coopGames || 0;
                const target = 1;
                progressText = `${current}/${target}`;
                progressPercent = Math.min((current / target) * 100, 100);
            } else if (achievement.id === 'coop_5') {
                const current = stats.coopGames || 0;
                const target = 5;
                progressText = `${current}/${target}`;
                progressPercent = Math.min((current / target) * 100, 100);
            } else if (achievement.id === 'coop_10') {
                const current = stats.coopGames || 0;
                const target = 10;
                progressText = `${current}/${target}`;
                progressPercent = Math.min((current / target) * 100, 100);
            } else if (achievement.id === 'coop_25') {
                const current = stats.coopGames || 0;
                const target = 25;
                progressText = `${current}/${target}`;
                progressPercent = Math.min((current / target) * 100, 100);
            } else if (achievement.id === 'coop_50') {
                const current = stats.coopGames || 0;
                const target = 50;
                progressText = `${current}/${target}`;
                progressPercent = Math.min((current / target) * 100, 100);
            }
            // Score achievements
            else if (achievement.id === 'score_100') {
                if (!isUnlocked) progressText = 'Score 100 in a game';
            } else if (achievement.id === 'score_200') {
                if (!isUnlocked) progressText = 'Score 200 in a game';
            } else if (achievement.id === 'score_300') {
                if (!isUnlocked) progressText = 'Score 300 in a game';
            } else if (achievement.id === 'score_400') {
                if (!isUnlocked) progressText = 'Score 400 in a game';
            } else if (achievement.id === 'score_500') {
                if (!isUnlocked) progressText = 'Score 500 in a game';
            }
            // Dishes per game
            else if (achievement.id === 'dishes_5') {
                if (!isUnlocked) progressText = 'Serve 5 in a game';
            } else if (achievement.id === 'dishes_10') {
                if (!isUnlocked) progressText = 'Serve 10 in a game';
            } else if (achievement.id === 'dishes_15') {
                if (!isUnlocked) progressText = 'Serve 15 in a game';
            } else if (achievement.id === 'dishes_20') {
                if (!isUnlocked) progressText = 'Serve 20 in a game';
            } else if (achievement.id === 'dishes_25') {
                if (!isUnlocked) progressText = 'Serve 25 in a game';
            }
            // Perfect dishes
            else if (achievement.id === 'perfect_3') {
                if (!isUnlocked) progressText = 'Serve 3 perfect in a game';
            } else if (achievement.id === 'perfect_5') {
                if (!isUnlocked) progressText = 'Serve 5 perfect in a game';
            } else if (achievement.id === 'perfect_8') {
                if (!isUnlocked) progressText = 'Serve 8 perfect in a game';
            } else if (achievement.id === 'perfect_12') {
                if (!isUnlocked) progressText = 'Serve 12 perfect in a game';
            } else if (achievement.id === 'perfect_15') {
                if (!isUnlocked) progressText = 'Serve 15 perfect in a game';
            }
            // Games played
            else if (achievement.id === 'games_10') {
                const current = stats.gamesPlayed || 0;
                const target = 10;
                progressText = `${current}/${target}`;
                progressPercent = Math.min((current / target) * 100, 100);
            } else if (achievement.id === 'games_25') {
                const current = stats.gamesPlayed || 0;
                const target = 25;
                progressText = `${current}/${target}`;
                progressPercent = Math.min((current / target) * 100, 100);
            } else if (achievement.id === 'games_50') {
                const current = stats.gamesPlayed || 0;
                const target = 50;
                progressText = `${current}/${target}`;
                progressPercent = Math.min((current / target) * 100, 100);
            } else if (achievement.id === 'games_100') {
                const current = stats.gamesPlayed || 0;
                const target = 100;
                progressText = `${current}/${target}`;
                progressPercent = Math.min((current / target) * 100, 100);
            } else if (achievement.id === 'games_200') {
                const current = stats.gamesPlayed || 0;
                const target = 200;
                progressText = `${current}/${target}`;
                progressPercent = Math.min((current / target) * 100, 100);
            }

            // Determine achievement level (1-5 bars) - this is the target level for THIS achievement
            let level = 0;

            // Co-op levels
            if (achievementId === 'coop_first') level = 1;
            else if (achievementId === 'coop_5') level = 2;
            else if (achievementId === 'coop_10') level = 3;
            else if (achievementId === 'coop_25') level = 4;
            else if (achievementId === 'coop_50') level = 5;
            // Score levels
            else if (achievementId === 'score_100') level = 1;
            else if (achievementId === 'score_200') level = 2;
            else if (achievementId === 'score_300') level = 3;
            else if (achievementId === 'score_400') level = 4;
            else if (achievementId === 'score_500') level = 5;
            // Dishes levels
            else if (achievementId === 'dishes_5') level = 1;
            else if (achievementId === 'dishes_10') level = 2;
            else if (achievementId === 'dishes_15') level = 3;
            else if (achievementId === 'dishes_20') level = 4;
            else if (achievementId === 'dishes_25') level = 5;
            // Perfect levels
            else if (achievementId === 'perfect_3') level = 1;
            else if (achievementId === 'perfect_5') level = 2;
            else if (achievementId === 'perfect_8') level = 3;
            else if (achievementId === 'perfect_12') level = 4;
            else if (achievementId === 'perfect_15') level = 5;
            // Games played levels
            else if (achievementId === 'games_10') level = 1;
            else if (achievementId === 'games_25') level = 2;
            else if (achievementId === 'games_50') level = 3;
            else if (achievementId === 'games_100') level = 4;
            else if (achievementId === 'games_200') level = 5;

            // Generate level bars HTML - show progress based on currentProgressLevel
            let levelBars = '';
            if (level > 0) {
                levelBars = '<div class="achievement-level-bars">';
                for (let i = 1; i <= 5; i++) {
                    // Bar is active if current progress has reached this level
                    levelBars += `<div class="level-bar ${i <= currentProgressLevel ? 'active' : ''}"></div>`;
                }
                levelBars += '</div>';
            }

            // Determine if icon is an image or Bootstrap icon
            const isImageIcon = achievement.icon.includes('.png') || achievement.icon.includes('.jpg');
            let iconHtml = '';
            if (isImageIcon) {
                iconHtml = `<img src="/assets/${achievement.icon}" class="achievement-img-icon ${isUnlocked ? 'unlocked' : 'locked'}" alt="${achievement.name}">`;
            } else {
                iconHtml = `<i class="bi ${isUnlocked ? achievement.icon + '-fill' : achievement.icon}"></i>`;
            }

            return `
                <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
                    <div class="achievement-icon-wrapper">
                        ${iconHtml}
                        <i class="bi bi-info-circle achievement-info-icon" onclick="showAchievementInfo('${achievement.id}', '${achievement.name.replace(/'/g, "\\'")}', '${achievement.description.replace(/'/g, "\\'")}')"></i>
                    </div>
                    <span>${achievement.name}</span>
                    ${levelBars}
                    ${progressPercent > 0 && progressPercent < 100 ? `<div class="progress-bar"><div class="progress-fill" style="width: ${progressPercent}%"></div></div>` : ''}
                </div>
            `;
        }).join('');
    }
}

window.closeProfileModal = () => {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.add('hidden');
};

window.showAchievementInfo = (id, name, description) => {
    showNotif(name, description, 'info');
};

window.copyUserId = () => {
    const idToCopy = currentUser.uid || currentUser.id;
    if (!currentUser || !idToCopy) return;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(idToCopy).then(() => {
            showNotif('Copied', 'User ID copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Could not copy text: ', err);
        });
    } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = idToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showNotif('Copied', 'User ID copied to clipboard!', 'success');
        } catch (err) {
            console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textArea);
    }
};

window.selectAvatar = (key, elem) => {
    selectedAvatarKey = key;
    document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
    elem.classList.add('selected');

    const displayImg = document.getElementById('profile-display-img');
    const mobileDisplayImg = document.getElementById('profile-mobile-img');
    const avatarUrl = getAvatarUrl(key);
    if (displayImg) displayImg.src = avatarUrl;
    if (mobileDisplayImg) mobileDisplayImg.src = avatarUrl;
};

window.updateProfilePreview = () => {
    const nameInput = document.getElementById('profile-new-username');
    const displayName = document.getElementById('profile-display-name');
    const mobileDisplayName = document.getElementById('profile-mobile-name');
    const newName = nameInput.value || 'Chef';
    if (nameInput && displayName) {
        displayName.textContent = newName;
    }
    if (mobileDisplayName) {
        mobileDisplayName.textContent = newName;
    }
};

window.saveProfileChanges = () => {
    const nameInput = document.getElementById('profile-new-username');
    if (!nameInput) return;

    const newUsername = nameInput.value.trim();
    if (newUsername.length < 3) {
        showNotif('Error', 'Name must be at least 3 characters!', 'error');
        return;
    }

    console.log('📤 Sending profile update:', { newUsername, selectedAvatarKey });
    showNotif('System', 'Saving changes...', 'info');

    socket.emit('updateProfile', {
        newUsername: newUsername,
        newProfileImage: selectedAvatarKey
    });
};

socket.on('updateProfileSuccess', (data) => {
    showNotif('Success', data.msg, 'success');
    currentUser = data.user;
    localStorage.setItem('chef_user', JSON.stringify(currentUser));

    // Update Lobby UI
    const displayUserName = document.getElementById('display-user-name');
    if (displayUserName) displayUserName.textContent = currentUser.name || currentUser.username;

    refreshUserAvatar();

    closeProfileModal();
});

socket.on('updateProfileError', (data) => {
    showNotif('Error', data.msg, 'error');
});

socket.on('userProfile', (data) => {
    currentUser = data;
});

socket.on('playerProfileUpdated', (data) => {
    // If we are in a game, we might need to update the player mesh or tag
    // For now, it's mostly for the HUD and lobby
    if (roomState && roomState.players[data.id]) {
        roomState.players[data.id].name = data.name;
        roomState.players[data.id].profileImage = data.profileImage;
        if (ui) ui.updatePlayerList(roomState.players);
    }
});

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
    console.log('🏁 DOM Content Loaded - Starting game initialization');

    // Select defaults
    const singleOptions = document.querySelectorAll('#menu-single .banner-option');
    if (singleOptions.length > 0) singleOptions[0].classList.add('selected');

    const createOptions = document.querySelectorAll('#menu-create .banner-option');
    if (createOptions.length > 0) createOptions[0].classList.add('selected');

    // Auto-login timeout - if no login response after 10 seconds, show login screen
    let loginTimeout = setTimeout(() => {
        console.log('⏰ Auto-login timeout - showing login screen');
        updateConnectionStatus('disconnected');
        // Don't automatically show login - wait for connection first
    }, 10000);

    // Auto-login if previously saved
    const attemptAutoLogin = () => {
        console.log('🔐 Attempting auto-login...');
        const savedLocal = localStorage.getItem('chef_user');
        const savedGuest = localStorage.getItem('chef_user_guest');
        const savedUser = savedLocal || savedGuest;

        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                console.log('📦 Found saved user:', user.type, user.username || user.name);

                if (user.type === 'account') {
                    console.log('👤 Sending account auto-login...');
                    socket.emit('userLogin', {
                        autoLogin: true,
                        userId: user.id,
                        username: user.username
                    });
                } else {
                    console.log('🎭 Sending guest auto-login...');
                    socket.emit('guestLogin', { userId: user.id, name: user.name });
                }
            } catch (e) {
                console.error('❌ Error parsing saved user:', e);
                localStorage.removeItem('chef_user');
                localStorage.removeItem('chef_user_guest');
                clearTimeout(loginTimeout);
                updateConnectionStatus('connected'); // Show login screen
            }
        } else {
            console.log('📭 No saved user found - showing login screen');
            clearTimeout(loginTimeout);
            updateConnectionStatus('connected'); // Show login screen
        }
    };

    // Wait for socket connection before attempting auto-login
    if (socket.connected) {
        console.log('🔗 Socket already connected - attempting auto-login');
        attemptAutoLogin();
    } else {
        console.log('⏳ Waiting for socket connection...');
        socket.on('connect', () => {
            console.log('🔗 Socket connected - attempting auto-login');
            attemptAutoLogin();
        });
    }

    // Clear timeout when login succeeds
    socket.on('loginSuccess', () => {
        console.log('✅ Login successful');
        clearTimeout(loginTimeout);
    });

    // Clear timeout on login error and show login screen
    socket.on('loginError', (data) => {
        console.log('❌ Login error:', data);
        clearTimeout(loginTimeout);
        updateConnectionStatus('connected');
    });
});

// START SINGLE PLAYER
const btnStartSingle = document.getElementById('btn-start-single');
if (btnStartSingle) {
    btnStartSingle.addEventListener('click', () => {
        const name = currentUser ? (currentUser.name || currentUser.username) : 'Chef';
        const roomId = `sp_${Date.now()}`;
        socket.emit('joinRoom', {
            name,
            roomId,
            mode: 'single',
            difficulty: selectedDiff
        });
    });
}

// CREATE LOBBY
const btnCreateLobby = document.getElementById('btn-create-lobby');
if (btnCreateLobby) {
    btnCreateLobby.addEventListener('click', () => {
        const name = currentUser ? (currentUser.name || currentUser.username) : 'Chef';
        let roomName = document.getElementById('create-room-name').value.trim();
        if (!roomName) roomName = `Kitchen_${Math.floor(Math.random() * 1000)}`;

        const passwordCheck = document.getElementById('create-room-password-check')?.checked || false;
        const password = passwordCheck ? document.getElementById('create-room-password')?.value.trim() : '';

        socket.emit('createRoom', {
            name,
            roomName,
            mode: selectedMode,
            difficulty: createDiff,
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

const btnExitGame = document.getElementById('btn-exit-game');
if (btnExitGame) {
    btnExitGame.addEventListener('click', () => {
        socket.emit('leaveRoom');
        location.reload();
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

        // Determine action button
        let actionButton = '';
        if (room.canReconnect) {
            // Show reconnect button for any non-finished game state
            actionButton = `<button class="btn-sm btn-reconnect" onclick="reconnectToRoom('${room.id}')"><i class="bi bi-arrow-clockwise"></i> RECONNECT</button>`;
        } else if (room.players < room.maxPlayers && room.state !== 'playing') {
            actionButton = `<button class="btn-sm" onclick="joinRoom('${room.id}')"><i class="bi bi-box-arrow-in-right"></i> JOIN</button>`;
        } else {
            actionButton = '<span style="color:#ef4444; font-size:12px;">UNAVAILABLE</span>';
        }

        tr.innerHTML = `
            <td><b>${hasPassword}${room.id}</b></td>
            <td>${modeIcons[room.mode] || room.mode} <small>(${room.difficulty || 'easy'})</small></td>
            <td>${room.players}/${room.maxPlayers}</td>
            <td>${statusBadge}</td>
            <td>${actionButton}</td>
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

        // Store room code in roomState for easy access
        if (data.roomCode) {
            roomState.roomCode = data.roomCode;
        }

        ui = new UIManager(gameConfig, socket);
        ui.updatePlayerList(roomState.players);
        ui.buildRecipeBook();

        if (data.isReconnect) {
            // ── RECONNECT PATH ──
            // Don't re-show the lobby; go straight to the correct screen.
            document.querySelectorAll('.lobby-menu').forEach(el => el.classList.add('hidden'));

            const lobbyScreen = document.getElementById('lobby-screen');
            const gameScreen = document.getElementById('game-screen');

            if (roomState.state === 'playing') {
                if (lobbyScreen) lobbyScreen.classList.remove('active');
                if (gameScreen) gameScreen.classList.add('active');
                if (ui) {
                    ui.showScreen('game');
                    if (roomState.orders) ui.updateOrders(roomState.orders, gameConfig);
                    const displayScore = roomState.mode === 'multi_vs'
                        ? (roomState.players[playerId]?.score || 0)
                        : (roomState.score || 0);
                    ui.updateScore(displayScore, 0);
                    if (roomState.timeLeft !== undefined) ui.updateTimer(roomState.timeLeft);
                }
            } else {
                // Reconnected to lobby
                if (lobbyScreen) {
                    lobbyScreen.classList.remove('hidden');
                    lobbyScreen.classList.add('active');
                }
                if (gameScreen) gameScreen.classList.remove('active');
                if (typeof showMenu === 'function') showMenu('waiting');
            }

            updateWaitingList(roomState.players);
            if (typeof startPingTracking === 'function') startPingTracking();

        } else {
            // ── FRESH JOIN PATH ──
            document.querySelectorAll('.lobby-menu').forEach(el => el.classList.add('hidden'));

            if (roomState.mode !== 'single') {
                const waitingMenu = document.getElementById('menu-waiting');
                if (waitingMenu) waitingMenu.classList.remove('hidden');

                if (currentUser && currentUser.type === 'account') {
                    socket.emit('getFriends');
                }
            }

            if (roomState.mode === 'single' || roomState.state === 'playing') {
                const lobbyScreen = document.getElementById('lobby-screen');
                const gameScreen = document.getElementById('game-screen');
                if (lobbyScreen) lobbyScreen.classList.remove('active');
                if (gameScreen) gameScreen.classList.add('active');
            }

            const waitingRoomName = document.getElementById('waiting-room-name');
            if (waitingRoomName) waitingRoomName.innerText = `Room: ${roomState.id}`;

            const roomCodeValue = document.getElementById('room-code-value');
            if (roomCodeValue && data.roomCode) roomCodeValue.textContent = data.roomCode;

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
            if (typeof startPingTracking === 'function') startPingTracking();

            // Hide/Show Chat based on mode
            const chatSidebar = document.querySelector('.quick-chat-sidebar');
            const chatLog = document.getElementById('hud-chat-log');
            if (roomState.mode === 'single') {
                if (chatSidebar) chatSidebar.style.display = 'none';
                if (chatLog) chatLog.style.display = 'none';
            } else {
                if (chatSidebar) chatSidebar.style.display = 'flex';
                if (chatLog) chatLog.style.display = 'flex';
            }
        }

    } catch (error) {
        console.error('Error in init handler:', error);
    }

    // ── KITCHEN SETUP (both paths) ──
    if (kitchen && typeof kitchen.clear === 'function') kitchen.clear();
    try {
        kitchen = new KitchenRenderer(scene, gameConfig, roomState);
        if (roomState.kitchen && roomState.stations) {
            kitchen.buildKitchen(roomState.kitchen, roomState.stations);
        }
    } catch (error) {
        console.error('Error building kitchen:', error);
    }

    if (typeof setupCamera === 'function') setupCamera(gameConfig);

    // (Re)create player meshes
    if (roomState.players) {
        // Remove all existing meshes first to avoid duplicates on reconnect
        Object.keys(playerMeshes || {}).forEach(id => removePlayerMesh(id));
        Object.values(roomState.players).forEach(p => {
            try { createPlayerMesh(p); } catch (e) { console.error('Error creating player mesh:', e); }
        });
    }

    // (Re)create dropped item meshes
    if (roomState.droppedItems) {
        Object.keys(droppedItemMeshes || {}).forEach(id => removeDroppedItemMesh(id));
        Object.values(roomState.droppedItems).forEach(item => {
            try { createDroppedItemMesh(item); } catch (e) { console.error('Error creating dropped item mesh:', e); }
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

    addHudChatLine({
        sender: 'SYSTEM',
        message: `${player.name} joined the kitchen!`,
        color: '#3DDC84'
    });

    // Update Waiting Room User List
    updateWaitingList(roomState.players);
});

socket.on('playerReconnected', (player) => {
    if (!roomState) return;

    // Remove any existing mesh first to prevent duplicates
    removePlayerMesh(player.id);

    roomState.players[player.id] = player;

    try {
        createPlayerMesh(player);
    } catch (error) {
        console.error('Error creating player mesh:', error);
    }

    if (ui && typeof ui.updatePlayerList === 'function') {
        ui.updatePlayerList(roomState.players);
    }

    addHudChatLine({
        sender: 'SYSTEM',
        message: `${player.name} reconnected!`,
        color: '#FFD23F'
    });

    // Ensure waiting list updates if the room is still in lobby
    updateWaitingList(roomState.players);

    showNotif('Player Reconnected', `${player.name} is back!`, 'success');
});

// Handle reconnection success for the current player
socket.on('reconnectSuccess', (data) => {
    const msg = data.roomState === 'playing'
        ? 'Back in the game!'
        : 'Rejoined the lobby!';
    showNotif('Reconnected! ✅', msg, 'success');
    // The init event handles all screen transitions
});

// Server tells us to use the reconnectRoom event (redirect from joinRoom)
socket.on('useReconnect', (data) => {
    const name = currentUser ? (currentUser.name || currentUser.username) : 'Chef';
    socket.emit('reconnectRoom', { name, roomId: data.roomId });
});

// Handle reconnection failure
socket.on('reconnectFailed', (data) => {
    if (data.fallbackJoin && data.roomId) {
        // Silently fall through to a normal join (e.g. new game session started)
        console.log('Reconnect fell through to normal join for room:', data.roomId);
        const name = currentUser ? (currentUser.name || currentUser.username) : 'Chef';
        socket.emit('joinRoom', { name, roomId: data.roomId });
        return;
    }

    showNotif('Reconnection Failed', data.message || 'Could not reconnect.', 'error');

    // Reveal the lobby and go to the join/server-browser menu
    const lobbyScreen = document.getElementById('lobby-screen');
    if (lobbyScreen) {
        lobbyScreen.classList.remove('hidden');
        lobbyScreen.classList.add('active');
    }
    if (typeof showMenu === 'function') showMenu('join');
});

socket.on('playerDisconnected', (data) => {
    if (!roomState) return;

    addHudChatLine({
        sender: 'SYSTEM',
        message: data.canReconnect ? `${data.name} disconnected (can reconnect)` : `${data.name} left the game`,
        color: '#EF4444'
    });

    // Remove the player's mesh immediately when they disconnect
    removePlayerMesh(data.id);

    if (data.canReconnect) {
        showNotif('Player Disconnected', `${data.name} disconnected but can reconnect`, 'info');
    }
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
        const isFriend = currentFriends.some(f => f.id === p.userId);
        const canAddFriend = currentUser && currentUser.type === 'account' &&
            p.userType === 'account' &&
            p.id !== playerId &&
            !isFriend;

        const friendBtn = canAddFriend ?
            `<button class="btn-add-friend-lobby" onclick="addFriendFromLobby('${p.username || p.name}')" title="Add Friend">
                <i class="bi bi-person-plus-fill"></i>
            </button>` : '';

        const hostIcon = p.isHost ? '<i class="bi bi-crown-fill" style="color:#FFD23F"></i> ' : '';
        const youSuffix = p.id === playerId ? ' (You)' : '';

        div.innerHTML = `
            <div class="player-info">
                ${hostIcon}<strong>${p.name}${youSuffix}</strong>
                ${friendBtn}
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
    const player = roomState.players[id];
    if (player) {
        addHudChatLine({
            sender: 'SYSTEM',
            message: `${player.name} left the kitchen.`,
            color: '#EF4444'
        });
    }
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
        ui.updateScore(0, 0); // reset score display
    }

    const vsBoard = document.getElementById('vs-scoreboard');
    if (roomState.mode === 'multi_vs') {
        if (vsBoard) vsBoard.classList.remove('hidden');
        if (typeof updateVSScoreboard === 'function') {
            const initialScores = {};
            Object.values(roomState.players).forEach(p => initialScores[p.id] = 0);
            updateVSScoreboard(initialScores);
        }
    } else {
        if (vsBoard) vsBoard.classList.add('hidden');
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
    if (roomState && roomState.players[data.playerId]) {
        roomState.players[data.playerId].score = data.playerScore;
    }
    if (ui) {
        if (typeof ui.updateOrders === 'function') ui.updateOrders(roomState.orders, gameConfig);

        const displayScore = roomState.mode === 'multi_vs' ? (roomState.players[playerId]?.score || 0) : data.totalScore;
        if (typeof ui.updateScore === 'function') ui.updateScore(displayScore, data.combo);

        if (typeof ui.showScorePop === 'function') {
            if (roomState.mode !== 'multi_vs' || data.playerId === playerId) {
                ui.showScorePop(`+${data.points}`);
            }
        }
        if (typeof ui.updatePlayerList === 'function') ui.updatePlayerList(roomState.players);
    }
});

socket.on('orderExpired', (data) => {
    if (!roomState || !gameConfig) return;
    roomState.orders = roomState.orders.filter(o => o.id !== data.orderId);
    if (ui) {
        if (typeof ui.updateOrders === 'function') ui.updateOrders(roomState.orders, gameConfig);
    }
});

socket.on('wrongDish', (data) => {
    if (!roomState) return;
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
    let finalMsg = data.msg;
    // Format POV if in multi_vs
    if (roomState?.mode === 'multi_vs' && data.playerId && data.playerName) {
        if (data.playerId === playerId) {
            // Keep original msg, maybe prepend 'You: '
            finalMsg = finalMsg.includes('served') ? finalMsg : `You: ${finalMsg}`;
        } else {
            // It's the opponent
            if (data.type === 'error' && data.msg.includes('pts')) {
                // If it's a penalty, maybe we just want to say "Opponent burned food!"
                // without showing the "-X pts" as it didn't subtract from us.
                finalMsg = `${data.playerName}: ${data.msg.split('-')[0].trim()}`;
            } else {
                finalMsg = `${data.playerName}: ${finalMsg}`;
            }
        }
    }

    if (ui && typeof ui.showNotification === 'function') {
        ui.showNotification(finalMsg, data.type);
    } else {
        // Fallback notification
        const notification = document.getElementById('notifications');
        if (notification && data) {
            const el = document.createElement('div');
            el.className = `notification ${data.type || 'info'}`;
            el.textContent = finalMsg;
            notification.appendChild(el);
            setTimeout(() => el.remove(), 2500);
        }
    }
});

socket.on('gameOver', (data) => {
    if (!roomState) return;
    roomState.state = 'gameover';
    if (ui && typeof ui.showGameOver === 'function') {
        ui.showGameOver(data, playerId);
    }
});

socket.on('gamePaused', (data) => {
    console.log('✅ Received gamePaused from server', data);
    if (roomState) {
        roomState.isPaused = true;
    }
});

socket.on('gameResumed', (data) => {
    console.log('✅ Received gameResumed from server', data);
    if (roomState) {
        roomState.isPaused = false;
    }
});

socket.on('gameStateUpdate', (data) => {
    if (!roomState) return;
    roomState.stations = data.stations;
    roomState.orders = data.orders;
    roomState.score = data.score;
    // Sync players map too (important after a reconnect so all POVs agree)
    if (data.players) {
        roomState.players = data.players;
        if (ui && typeof ui.updatePlayerList === 'function') {
            ui.updatePlayerList(roomState.players);
        }
        updateWaitingList(roomState.players);
    }
    if (kitchen && typeof kitchen.updateAllStations === 'function') {
        try {
            kitchen.updateAllStations(data.stations);
        } catch (error) {
            console.error('Error updating all stations:', error);
        }
    }
});

socket.on('chatMessage', (data) => {
    // Render speech bubble directly in 3D world
    renderSpeechBubble(data);
    // Add to HUD chat log
    addHudChatLine(data);
});

function addHudChatLine(data) {
    const log = document.getElementById('hud-chat-log');
    if (!log) return;

    const line = document.createElement('div');
    line.className = 'hud-chat-line';

    if (data.sender === 'SYSTEM') {
        line.classList.add('system');
        line.style.color = data.color || '#94a3b8';
        line.innerHTML = `<i class="bi bi-info-circle-fill"></i> ${data.message}`;
    } else {
        line.innerHTML = `<span class="sender" style="color:${data.color}">${data.sender}:</span> ${data.message}`;
    }

    log.appendChild(line);

    // Fade out and remove after some time
    setTimeout(() => {
        line.style.opacity = '0';
        line.style.transform = 'translateX(-10px)';
        line.style.transition = 'all 0.5s ease';
        setTimeout(() => line.remove(), 500);
    }, 6000);

    // Keep log short
    while (log.children.length > 5) {
        log.removeChild(log.firstChild);
    }
}
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
            // Use stored player name or get from input field or current user
            let playerName = window.pendingPlayerName;
            if (!playerName) {
                const nameInput = document.getElementById('player-name');
                playerName = nameInput ? nameInput.value.trim() : '';
            }
            if (!playerName && currentUser) {
                playerName = currentUser.name || currentUser.username;
            }
            if (!playerName) {
                playerName = 'Chef';
            }

            socket.emit('joinRoom', {
                name: playerName,
                roomId: data.roomId
            });

            // Clear pending name
            window.pendingPlayerName = null;
        }
    } else {
        showNotif('Error', data.message || 'Room not found!', 'error');
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
    currentFriends = friends;
    // Update main friends list (in friends menu)
    const list = document.getElementById('friends-list');
    if (list) {
        if (friends.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:var(--text-dim);">No friends yet</p>';
        } else {
            list.innerHTML = friends.map(f => {
                const status = f.status || 'offline';
                const canInvite = status === 'online' || status === 'lobby';

                return `
                    <div class="friend-item">
                        <div class="friend-info">
                            <span class="friend-status ${status}"></span>
                            <div class="friend-details-small">
                                <span class="friend-name">${f.name}</span>
                                <span class="friend-status-label">${getStatusText(status)}</span>
                            </div>
                        </div>
                        ${canInvite ?
                        `<button class="btn-sm" onclick="inviteFriendToRoom('${f.id}', '${f.name}')" title="Invite to room"><i class="bi bi-envelope"></i></button>` :
                        `<button class="btn-sm unavailable" disabled title="Cannot invite (${getStatusText(status)})"><i class="bi bi-envelope"></i></button>`
                    }
                    </div>
                `;
            }).join('');
        }
    }

    // Update friends panel in main menu
    const panelList = document.getElementById('main-menu-friends-list');
    if (panelList) {
        if (!currentUser || currentUser.type === 'guest') {
            panelList.innerHTML = '<p class="friends-empty-msg">Login to see your friends</p>';
        } else if (friends.length === 0) {
            panelList.innerHTML = '<p class="friends-empty-msg">No friends yet. Add some!</p>';
        } else {
            panelList.innerHTML = friends.map(f => {
                const status = f.status || 'offline';
                return `
                    <div class="friend-panel-item ${status}">
                        <span class="friend-status-dot"></span>
                        <div class="friend-panel-info">
                            <span class="friend-name">${f.name}</span>
                            <span class="friend-panel-status">${getStatusText(status)}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Update waiting room friends list (friends that can be invited)
    const waitingList = document.getElementById('waiting-friends-list');
    if (waitingList) {
        // Can invite friends who are online OR in another lobby (not in-game)
        const invitableFriends = friends.filter(f => f.status === 'online' || f.status === 'lobby');

        if (!currentUser || currentUser.type === 'guest') {
            waitingList.innerHTML = '<p class="friends-empty-msg">Login to invite friends</p>';
        } else if (invitableFriends.length === 0) {
            waitingList.innerHTML = '<p class="friends-empty-msg">No friends available to invite</p>';
        } else {
            waitingList.innerHTML = invitableFriends.map(f => `
                <div class="waiting-friend-item">
                    <div class="waiting-friend-info">
                        <span class="waiting-friend-name">${f.name}</span>
                        <span class="waiting-friend-status">${getStatusText(f.status)}</span>
                    </div>
                    <button class="btn-invite-friend" onclick="inviteFriendToRoom('${f.id}', '${f.name}')" title="Invite to room">
                        <i class="bi bi-envelope-fill"></i> Invite
                    </button>
                </div>
            `).join('');
        }
    }
});

socket.on('friendStatusUpdate', (data) => {
    console.log('Friend status update:', data);
    // Refresh the list whenever a friend's status changes
    socket.emit('getFriends');
});

socket.on('friendRequests', (requests) => {
    const requestsSection = document.getElementById('friend-requests-section');
    const requestsList = document.getElementById('friend-requests-list');
    const requestCount = document.getElementById('request-count');

    if (!requestsSection || !requestsList || !requestCount) return;

    if (requests && requests.length > 0) {
        requestsSection.style.display = 'block';
        requestCount.textContent = requests.length;

        requestsList.innerHTML = requests.map(req => `
            <div class="friend-request-item" data-request-id="${req.from}">
                <span class="friend-request-name">
                    <i class="bi bi-person-fill"></i> ${req.fromName}
                </span>
                <div class="friend-request-actions">
                    <button class="friend-request-btn accept" onclick="acceptFriendRequestFromPanel('${req.from}')">
                        <i class="bi bi-check-lg"></i> Accept
                    </button>
                    <button class="friend-request-btn reject" onclick="rejectFriendRequestFromPanel('${req.from}')">
                        <i class="bi bi-x-lg"></i> Reject
                    </button>
                </div>
            </div>
        `).join('');
    } else {
        requestsSection.style.display = 'none';
    }
});

socket.on('friendAdded', (data) => {
    if (data.success) {
        showNotif('Friend Request Sent', data.message || `Request sent to ${data.name}!`, 'success');
    } else {
        showNotif('Error', data.message || 'Could not add friend', 'error');
    }
});

socket.on('friendError', (data) => {
    showNotif('Error', data.message || 'Friend operation failed', 'error');
});

socket.on('friendRequestReceived', (data) => {
    // Show live notification
    showNotif('Friend Request', data.message, 'info');

    // Play sound effect (optional)
    playNotificationSound();

    // Show popup notification with actions
    showFriendRequestNotification(data);

    // Refresh friend requests in panel
    socket.emit('getFriends');
});

socket.on('friendRequestAccepted', (data) => {
    showNotif('Friend Added', data.message, 'success');
    socket.emit('getFriends');
});

socket.on('friendRequestRejected', (data) => {
    showNotif('Request Rejected', data.message, 'info');
});

socket.on('friendOnline', (data) => {
    showNotif('Friend Online', `${data.name} is now online!`, 'info');
    socket.emit('getFriends'); // Refresh list
});

// Friend Request Notification System
function showFriendRequestNotification(request) {
    const container = document.getElementById('notifications');
    if (!container) return;

    const notif = document.createElement('div');
    notif.className = 'notif friend-request';
    notif.innerHTML = `
        <div class="notif-icon"><i class="bi bi-person-plus-fill"></i></div>
        <div class="notif-content">
            <span class="notif-title">Friend Request</span>
            <span class="notif-msg">${request.fromName} wants to be your friend</span>
            <div class="notif-actions">
                <button class="notif-btn accept" onclick="acceptFriendRequest('${request.from}', this)">
                    <i class="bi bi-check-lg"></i> Accept
                </button>
                <button class="notif-btn reject" onclick="rejectFriendRequest('${request.from}', this)">
                    <i class="bi bi-x-lg"></i> Reject
                </button>
            </div>
        </div>
    `;

    container.appendChild(notif);

    // Auto-remove after 30 seconds
    setTimeout(() => {
        if (notif.parentElement) {
            notif.classList.add('fade-out');
            setTimeout(() => notif.remove(), 500);
        }
    }, 30000);
}

// Accept from notification popup
window.acceptFriendRequest = (fromUserId, btnElement) => {
    socket.emit('acceptFriendRequest', { from: fromUserId });
    // Remove the notification
    const notif = btnElement.closest('.notif');
    if (notif) {
        notif.classList.add('fade-out');
        setTimeout(() => notif.remove(), 300);
    }
};

// Reject from notification popup
window.rejectFriendRequest = (fromUserId, btnElement) => {
    socket.emit('rejectFriendRequest', { from: fromUserId });
    // Remove the notification
    const notif = btnElement.closest('.notif');
    if (notif) {
        notif.classList.add('fade-out');
        setTimeout(() => notif.remove(), 300);
    }
};

// Accept from friend requests panel
window.acceptFriendRequestFromPanel = (fromUserId) => {
    socket.emit('acceptFriendRequest', { from: fromUserId });

    // Remove from panel with animation
    const requestItem = document.querySelector(`[data-request-id="${fromUserId}"]`);
    if (requestItem) {
        requestItem.style.animation = 'notifFadeOut 0.3s forwards';
        setTimeout(() => {
            requestItem.remove();
            // Update count
            const requestsList = document.getElementById('friend-requests-list');
            const requestsSection = document.getElementById('friend-requests-section');
            if (requestsList && requestsList.children.length === 0 && requestsSection) {
                requestsSection.style.display = 'none';
            }
        }, 300);
    }
};

// Reject from friend requests panel
window.rejectFriendRequestFromPanel = (fromUserId) => {
    socket.emit('rejectFriendRequest', { from: fromUserId });

    // Remove from panel with animation
    const requestItem = document.querySelector(`[data-request-id="${fromUserId}"]`);
    if (requestItem) {
        requestItem.style.animation = 'notifFadeOut 0.3s forwards';
        setTimeout(() => {
            requestItem.remove();
            // Update count
            const requestsList = document.getElementById('friend-requests-list');
            const requestsSection = document.getElementById('friend-requests-section');
            const requestCount = document.getElementById('request-count');
            if (requestsList && requestsSection && requestCount) {
                const remaining = requestsList.children.length;
                if (remaining === 0) {
                    requestsSection.style.display = 'none';
                } else {
                    requestCount.textContent = remaining;
                }
            }
        }, 300);
    }
};

// Optional: Play notification sound
function playNotificationSound() {
    // You can add a sound effect here
    // const audio = new Audio('/sounds/notification.mp3');
    // audio.play().catch(e => console.log('Audio play failed:', e));
}

// Invite friend to current room
window.inviteFriendToRoom = (friendId, friendName) => {
    if (!roomState || !roomState.roomCode) {
        showNotif('Error', 'You must be in a room to invite friends!', 'error');
        console.error('Cannot invite: roomState =', roomState);
        return;
    }

    console.log('Sending invite to:', friendId, 'Room code:', roomState.roomCode);

    socket.emit('inviteFriendToRoom', {
        friendId: friendId,
        roomCode: roomState.roomCode,
        roomName: roomState.id
    });

    showNotif('Invite Sent', `Invitation sent to ${friendName}!`, 'success');
};

// Receive room invitation
socket.on('roomInvitation', (data) => {
    console.log('Received room invitation:', data);

    showNotif('Room Invite', `${data.fromName} invited you to ${data.roomName}!`, 'info');

    const container = document.getElementById('notifications');
    if (!container) {
        console.error('Notifications container not found!');
        return;
    }

    const notif = document.createElement('div');
    notif.className = 'notif friend-request';
    notif.innerHTML = `
        <div class="notif-icon"><i class="bi bi-envelope-fill"></i></div>
        <div class="notif-content">
            <span class="notif-title">Room Invitation</span>
            <span class="notif-msg">${data.fromName} invited you to join ${data.roomName}</span>
            <div class="notif-actions">
                <button class="notif-btn accept" onclick="acceptRoomInvite('${data.roomCode}', this)">
                    <i class="bi bi-check-lg"></i> Join
                </button>
                <button class="notif-btn reject" onclick="rejectRoomInvite(this)">
                    <i class="bi bi-x-lg"></i> Decline
                </button>
            </div>
        </div>
    `;

    container.appendChild(notif);
    console.log('Room invitation notification added to DOM');

    // Auto-remove after 30 seconds
    setTimeout(() => {
        if (notif.parentElement) {
            notif.classList.add('fade-out');
            setTimeout(() => notif.remove(), 500);
        }
    }, 30000);
});

window.acceptRoomInvite = (roomCode, btnElement) => {
    console.log('Accepting room invite with code:', roomCode);

    // Get current user name
    const playerName = currentUser ? (currentUser.name || currentUser.username) : 'Chef';

    // Join by room code - emit joinByCode to get room info first
    socket.emit('joinByCode', { code: roomCode });

    // Store the player name for when joinByCodeResult is received
    window.pendingPlayerName = playerName;

    // Remove notification
    const notif = btnElement.closest('.notif');
    if (notif) {
        notif.classList.add('fade-out');
        setTimeout(() => notif.remove(), 300);
    }
};

window.rejectRoomInvite = (btnElement) => {
    console.log('Rejecting room invite');

    // Just remove notification
    const notif = btnElement.closest('.notif');
    if (notif) {
        notif.classList.add('fade-out');
        setTimeout(() => notif.remove(), 300);
    }
};

// VS Scoreboard Update
socket.on('scoreUpdate', (data) => {
    if (roomState && roomState.mode === 'multi_vs') {
        // Sync the roomState player scores to the server data
        if (data.scores) {
            Object.entries(data.scores).forEach(([pId, score]) => {
                if (roomState.players[pId]) roomState.players[pId].score = score;
            });
        }
        updateVSScoreboard(data.scores);
        if (ui && roomState.players[playerId]) {
            ui.updateScore(roomState.players[playerId].score, roomState.combo || 0);
        }
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


// ============ PAUSE & LEAVE ============
window.togglePauseMenu = () => {
    if (!roomState || roomState.state !== 'playing') return;

    const pauseMenu = document.getElementById('pause-menu');
    if (!pauseMenu) return;

    // Check if currently hidden
    const isHidden = pauseMenu.classList.contains('hidden');

    if (isHidden) {
        // OPEN MENU
        pauseMenu.classList.remove('hidden');

        const resumeBtn = document.getElementById('btn-resume');
        const title = pauseMenu.querySelector('h2');

        if (roomState.mode === 'single') {
            // SINGLE PLAYER: PAUSE GAME
            isPaused = true;
            console.log('⏸️ Emitting pauseGame to server');
            socket.emit('pauseGame'); // Tell server to pause timers
            if (resumeBtn) resumeBtn.style.display = 'inline-block';
            if (title) title.innerHTML = '<i class="bi bi-pause-circle"></i> Paused';
        } else {
            // MULTIPLAYER: NO PAUSE, JUST MENU
            isPaused = false;
            if (resumeBtn) resumeBtn.style.display = 'inline-block'; // Now enabled in multi!
            if (title) title.innerHTML = '<i class="bi bi-list"></i> Menu';
        }
    } else {
        // CLOSE MENU
        window.resumeGame();
    }
};

window.resumeGame = () => {
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) pauseMenu.classList.add('hidden');

    if (roomState && roomState.mode === 'single' && isPaused) {
        console.log('▶️ Emitting resumeGame to server');
        socket.emit('resumeGame'); // Tell server to resume timers
    }

    isPaused = false;
};

window.leaveRoom = () => {
    if (roomState) {
        // Notify server
        socket.emit('leaveRoom', { roomId: roomState.id });
        roomState = null;
    }

    window.resumeGame(); // Clear pause state

    // Reset UI
    const gameScreen = document.getElementById('game-screen');
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameoverScreen = document.getElementById('gameover-screen');
    const pauseMenu = document.getElementById('pause-menu'); // Ensure hidden

    if (gameScreen) gameScreen.classList.remove('active');
    if (gameoverScreen) gameoverScreen.classList.remove('active');
    if (pauseMenu) pauseMenu.classList.add('hidden');
    if (lobbyScreen) lobbyScreen.classList.add('active');

    // Reset Camera
    if (typeof camera !== 'undefined') {
        camera.position.set(0, 30, 30);
        camera.lookAt(0, 0, 0);
    }

    // Show Main Menu
    if (typeof showMenu === 'function') showMenu('main');
};

// Game Countdown
socket.on('gameCountdown', (data) => {
    const countdown = data.countdown;
    const overlay = document.getElementById('countdown-overlay');
    const numberEl = document.getElementById('countdown-number');
    const messageEl = document.getElementById('countdown-text');

    if (overlay) overlay.classList.remove('hidden');

    // MOVED: Switch to game screen IMMEDIATELY on countdown start
    // This makes the loading overlay appear over the kitchen
    if (countdown >= 4) {
        const lobbyScreen = document.getElementById('lobby-screen');
        const gameScreen = document.getElementById('game-screen');
        if (lobbyScreen) lobbyScreen.classList.remove('active');
        if (gameScreen) gameScreen.classList.add('active');
    }

    if (countdown >= 4) {
        if (numberEl) numberEl.textContent = "...";
        if (messageEl) messageEl.textContent = "INITIALIZING DATA...";
    } else if (countdown > 0) {
        if (numberEl) {
            numberEl.textContent = countdown;
            // Force re-trigger animation
            numberEl.classList.remove('number-pop');
            void numberEl.offsetWidth; // trigger reflow
            numberEl.classList.add('number-pop');
        }
        if (messageEl) messageEl.textContent = 'GET READY!';

        if (ui && typeof ui.showNotification === 'function') {
            ui.showNotification(`Game starting in ${countdown}...`, 'info');
        }
    } else {
        if (numberEl) {
            numberEl.textContent = "GO!";
            numberEl.classList.remove('number-pop');
            void numberEl.offsetWidth; // trigger reflow
            numberEl.classList.add('number-pop');
        }
        if (messageEl) messageEl.textContent = "START COOKING!";

        if (ui && typeof ui.showNotification === 'function') {
            ui.showNotification('Game starting!', 'success');
        }

        // Hide overlay after a short delay so "GO!" is visible
        setTimeout(() => {
            if (overlay) overlay.classList.add('hidden');
        }, 1000);

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

// ============ DROPPED ITEMS EVENTS ============
socket.on('itemThrown', (data) => {
    if (!roomState) return;
    if (!roomState.droppedItems) roomState.droppedItems = {};
    roomState.droppedItems[data.itemId] = data.item;
    createDroppedItemMesh(data.item);
});

socket.on('itemPickedUp', (data) => {
    if (!roomState || !roomState.droppedItems) return;
    delete roomState.droppedItems[data.itemId];
    removeDroppedItemMesh(data.itemId);

    if (data.trashed) {
        showNotif('🗑️ Trashed!', 'Ingredient discarded', 'info');
    }
});

socket.on('trashEffect', (data) => {
    if (kitchen && kitchen.stationEffects[data.stationId]) {
        const eff = kitchen.stationEffects[data.stationId];
        eff.lidOpen = true;
        // Keep it open for a bit
        setTimeout(() => {
            eff.lidOpen = false;
        }, 1200);
    }
});

socket.on('droppedItemUpdate', (data) => {
    if (!roomState || !roomState.droppedItems) return;
    const item = roomState.droppedItems[data.itemId];
    if (item) {
        item.x = data.x;
        item.y = data.y;
        item.z = data.z;
        updateDroppedItemMesh(data.itemId, data.x, data.y, data.z);
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

    // THROW INDICATOR (only for local player)
    let throwArrow = null;
    if (player.id === playerId) {
        const arrowGroup = new THREE.Group();

        // Make an arrowhead
        const arrowGeo = new THREE.ConeGeometry(0.5, 1, 8);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
        const cone = new THREE.Mesh(arrowGeo, arrowMat);
        cone.position.set(0, 0, 1.5); // stick out in front
        cone.rotation.x = -Math.PI / 2;

        // Stem
        const stemGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 8);
        const stem = new THREE.Mesh(stemGeo, arrowMat);
        stem.position.set(0, 0, 0.75);
        stem.rotation.x = Math.PI / 2;

        arrowGroup.add(cone);
        arrowGroup.add(stem);

        arrowGroup.position.set(0, 0.1, 0); // slightly above ground
        arrowGroup.visible = false;

        group.add(arrowGroup);
        throwArrow = { group: arrowGroup, mat: arrowMat, cone: cone, stem: stem };
    }

    scene.add(group);
    playerMeshes[player.id] = { group, body, head, hat, throwArrow, bobTime: Math.random() * 10 };

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

// ============ DROPPED ITEMS VISUALS ============
function createDroppedItemMesh(item) {
    if (droppedItemMeshes[item.id]) {
        scene.remove(droppedItemMeshes[item.id]);
    }
    const group = new THREE.Group();

    // Check type and create appropriate child mesh
    if (item.data) {
        if (item.data.type === 'ingredient') {
            createHeldIngredient(group, item.data);
        } else if (item.data.type === 'plate') {
            createHeldPlate(group, item.data);
        }
    }

    // Scale significantly larger so it's very visible as a "giant recipe" on floor
    group.scale.set(3.5, 3.5, 3.5);

    group.position.set(item.x, item.y || 0.1, item.z);

    // Slight random rotation for chaos physics visual
    group.rotation.set(0, Math.random() * Math.PI, 0);

    scene.add(group);
    droppedItemMeshes[item.id] = group;
}

function removeDroppedItemMesh(itemId) {
    if (droppedItemMeshes[itemId]) {
        scene.remove(droppedItemMeshes[itemId]);
        delete droppedItemMeshes[itemId];
    }
}

function updateDroppedItemMesh(itemId, x, y, z) {
    const mesh = droppedItemMeshes[itemId];
    if (mesh) {
        mesh.position.set(x, y, z);
        // Spin while moving/bouncing
        if (y > 0.1) {
            mesh.rotation.x += 0.1;
            mesh.rotation.z += 0.1;
        } else {
            // Settle out rotation flatly
            mesh.rotation.x *= 0.8;
            mesh.rotation.z *= 0.8;
        }
    }
}

// Update throw indicator in the render loop/game tick (game.js)
// We will hook this into the movement interpolation tick or similar
function updateThrowIndicator() {
    if (!roomState || roomState.state !== 'playing') return;
    const me = roomState.players[playerId];
    if (!me || !playerMeshes[playerId] || !playerMeshes[playerId].throwArrow) return;

    const arrow = playerMeshes[playerId].throwArrow;

    if (keys.e_pressed_time && me.holding) {
        const holdTime = Date.now() - keys.e_pressed_time;
        // Max power is 400ms (much faster charge)
        const powerRatio = Math.min(1.0, holdTime / 400);

        arrow.group.visible = true;

        // Scale the arrow length
        const stemLength = 1.5 + powerRatio * 2.0;
        arrow.stem.scale.set(1, 1, stemLength / 1.5);
        arrow.cone.position.z = stemLength;

        // Color transition: Green -> Yellow -> Red
        let r, g;
        if (powerRatio < 0.5) {
            // Green to Yellow
            r = Math.floor(255 * (powerRatio * 2));
            g = 255;
        } else {
            // Yellow to Red
            r = 255;
            g = Math.floor(255 * (1 - (powerRatio - 0.5) * 2));
        }
        const hex = (r << 16) | (g << 8) | 0;
        arrow.mat.color.setHex(hex);

        // Point in the facing direction
        if (me.facing === 'up') arrow.group.rotation.y = Math.PI;
        else if (me.facing === 'down') arrow.group.rotation.y = 0;
        else if (me.facing === 'left') arrow.group.rotation.y = -Math.PI / 2;
        else if (me.facing === 'right') arrow.group.rotation.y = Math.PI / 2;
    } else {
        arrow.group.visible = false;
    }
}

// ============ INPUT ============
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;

    if (e.key === 'Escape') {
        togglePauseMenu();
    }

    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        // Start hold timer on first press
        if (!e.repeat) {
            spacePressedTime = Date.now();
            didChop = false;
        }
    }

    if (e.key.toLowerCase() === 'e') {
        if (!e.repeat) {
            keys.e_pressed_time = Date.now();
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

    if (e.key.toLowerCase() === 'e') {
        let holdTime = Date.now() - (keys.e_pressed_time || Date.now());
        handleThrowOrPickup(holdTime);
    }
});

function handleThrowOrPickup(holdTime) {
    if (!roomState || roomState.state !== 'playing') return;
    const me = roomState.players[playerId];
    if (!me) return;

    // Reset hold time for safety
    keys.e_pressed_time = null;

    // Hide arrow
    if (playerMeshes[playerId] && playerMeshes[playerId].throwArrow) {
        playerMeshes[playerId].throwArrow.group.visible = false;
    }

    if (me.holding) {
        // We are holding something -> Throw
        // Max charge reached at 400ms instead of 800ms for fast throws
        const power = Math.min(1.0, holdTime / 400);
        // Mult from 0.8x up to 1.6x (slightly faster baseline, slightly more cap but shorter hold time)
        const powerMult = power * 0.8 + 0.8;

        socket.emit('throwItem', { power: powerMult });
        if (ui && typeof ui.showNotification === 'function') {
            ui.showNotification('Threw item!', 'info');
        }
    } else {
        // Not holding -> Try to pick up from floor
        // Find closest dropped item
        let bestItemId = null;
        let minDist = Infinity;
        const reach = (gameConfig ? gameConfig.TILE_SIZE : 2) * 1.5;

        // Player current pos
        const px = me.x !== undefined ? me.x : me.gridX * (gameConfig ? gameConfig.TILE_SIZE : 2);
        const pz = me.z !== undefined ? me.z : me.gridZ * (gameConfig ? gameConfig.TILE_SIZE : 2);

        if (roomState.droppedItems) {
            for (const [id, item] of Object.entries(roomState.droppedItems)) {
                const dist = Math.sqrt(Math.pow(px - item.x, 2) + Math.pow(pz - item.z, 2));
                if (dist <= reach && dist < minDist) {
                    minDist = dist;
                    bestItemId = id;
                }
            }
        }

        if (bestItemId) {
            socket.emit('pickupItem', { itemId: bestItemId });
        } else {
            // Also call standard interact just in case they meant to grab from table
            handleInteract();
        }
    }
}

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

function handleGarnish() {
    if (!roomState || roomState.state !== 'playing') return;
    const me = roomState.players[playerId];
    if (!me) return;

    let bestStationId = null;
    let minDist = Infinity;
    const reach = (gameConfig ? gameConfig.TILE_SIZE : 2) * 2.5;

    const px = me.x !== undefined ? me.x : me.gridX * (gameConfig ? gameConfig.TILE_SIZE : 2);
    const pz = me.z !== undefined ? me.z : me.gridZ * (gameConfig ? gameConfig.TILE_SIZE : 2);

    for (const [id, st] of Object.entries(roomState.stations)) {
        // Garnish works only at seasoning stations with ACTIVE rare spawn
        if (st.type === 'seasoning' && st.rareSeasoning && st.contents && st.contents.type === 'plate' && !st.contents.seasoning) {
            const sx = st.gridX * (gameConfig ? gameConfig.TILE_SIZE : 2);
            const sz = st.gridZ * (gameConfig ? gameConfig.TILE_SIZE : 2);
            const dist = Math.sqrt(Math.pow(px - sx, 2) + Math.pow(pz - sz, 2));

            if (dist <= reach && dist < minDist) {
                minDist = dist;
                bestStationId = id;
            }
        }
    }

    if (bestStationId) {
        socket.emit('garnishAction', { stationId: bestStationId });
        return true;
    }
    return false;
}

// ============ GAME LOOP ============
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (isPaused) return;

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

            const speed = 16.0; // Speed of movement (Speedrun)
            let dx = 0, dz = 0;

            // Continuous Input - Keyboard
            if (keys['w'] || keys['arrowup']) dz = -1;
            if (keys['s'] || keys['arrowdown']) dz = 1;
            if (keys['a'] || keys['arrowleft']) dx = -1;
            if (keys['d'] || keys['arrowright']) dx = 1;

            // Virtual Joystick Input (Mobile)
            if (window.virtualJoystick) {
                const joystickDelta = window.virtualJoystick.getDelta();
                if (joystickDelta.active) {
                    // Joystick overrides keyboard on mobile
                    dx = joystickDelta.x;
                    dz = joystickDelta.y;
                }
            }

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
                if (!checkCollision(nextX, me.z, gameConfig.TILE_SIZE) && !checkPlayerCollision(nextX, me.z, playerId)) {
                    me.x = nextX;
                }
                // Try Z movement
                if (!checkCollision(me.x, nextZ, gameConfig.TILE_SIZE) && !checkPlayerCollision(me.x, nextZ, playerId)) {
                    me.z = nextZ;
                }

                // Speedrun Smoke Effect (Spawn at the back of the player)
                if (Math.random() < 0.3) {
                    const pm = playerMeshes[playerId];
                    if (pm && pm.group) {
                        const smoke = new THREE.Mesh(
                            new THREE.SphereGeometry(0.15 + Math.random() * 0.1, 4, 4),
                            new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6 })
                        );

                        // Calculate position behind the player based on movement direction
                        const backOffsetX = -dx * 0.6;
                        const backOffsetZ = -dz * 0.6;

                        smoke.position.set(
                            me.x + backOffsetX + (Math.random() - 0.5) * 0.2,
                            0.2,
                            me.z + backOffsetZ + (Math.random() - 0.5) * 0.2
                        );
                        scene.add(smoke);

                        const animateSmoke = () => {
                            if (!smoke.material) return;
                            smoke.position.y += 0.05;
                            smoke.scale.setScalar(smoke.scale.x * 0.92);
                            smoke.material.opacity -= 0.03;
                            if (smoke.material.opacity > 0) {
                                requestAnimationFrame(animateSmoke);
                            } else {
                                scene.remove(smoke);
                                smoke.geometry.dispose();
                                smoke.material.dispose();
                            }
                        };
                        animateSmoke();
                    }
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
                        } else if (handleGarnish()) {
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

    // --- CAMERA FOLLOW LOCAL PLAYER ---
    if (playerId && playerMeshes[playerId]) {
        const pm = playerMeshes[playerId];

        // Define desired camera offset relative to player
        // High angle, centered
        const targetHeight = 22;
        const targetDist = 20;

        const targetX = pm.group.position.x;
        const targetZ = pm.group.position.z + targetDist;

        // Smoothly interpolate camera position
        camera.position.x += (targetX - camera.position.x) * 0.08;
        camera.position.z += (targetZ - camera.position.z) * 0.08;
        camera.position.y += (targetHeight - camera.position.y) * 0.08;

        // Ensure camera looks at the player's position (ground level)
        camera.lookAt(camera.position.x, 0, camera.position.z - targetDist);
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

// Check collision with other players
function checkPlayerCollision(x, z, currentPlayerId) {
    if (!roomState || !roomState.players) return false;

    const collisionRadius = 0.6; // Distance threshold for player collision

    for (const [id, player] of Object.entries(roomState.players)) {
        // Skip checking collision with self
        if (id === currentPlayerId) continue;

        // Get other player's position
        const otherX = player.x !== undefined ? player.x : player.gridX * gameConfig.TILE_SIZE;
        const otherZ = player.z !== undefined ? player.z : player.gridZ * gameConfig.TILE_SIZE;

        // Calculate distance between players
        const dx = x - otherX;
        const dz = z - otherZ;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // If too close, collision detected
        if (distance < collisionRadius) {
            return true;
        }
    }

    return false;
}

// ============ QUICK CHAT & SHORTCUTS ============
window.sendQuickChat = (msg) => {
    if (socket) socket.emit('chatMessage', msg);
};

window.toggleChatInput = () => {
    const container = document.getElementById('floating-chat-input');
    const input = document.getElementById('chat-input');
    if (container && input) {
        const isHidden = container.classList.contains('hidden');
        if (isHidden) {
            container.classList.remove('hidden');
            input.focus();
        } else {
            container.classList.add('hidden');
        }
    }
};

document.addEventListener('keydown', (e) => {
    // Escape or Enter handling when NOT focused on input
    if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        // Multi-player only shortcuts
        if (roomState && roomState.mode !== 'single') {
            if (e.key === 'Enter') {
                toggleChatInput();
                e.preventDefault();
            }

            if (e.key === '1') sendQuickChat('Need help!');
            if (e.key === '2') sendQuickChat('Coming!');
            if (e.key === '3') sendQuickChat('Thanks!');
            if (e.key === '4') sendQuickChat('Oops!');
        }
    }
});

// ============ SPEECH BUBBLES ============
function renderSpeechBubble(data) {
    if (!data || !data.message) return;

    // Find player mesh
    let pm = playerMeshes[data.id];

    // Fallback: search by name
    if (!pm) {
        const pId = Object.keys(roomState.players).find(id => roomState.players[id].name === data.sender);
        if (pId) pm = playerMeshes[pId];
    }

    if (!pm || !pm.group) return;

    // Remove existing bubble if any
    const oldBubble = pm.group.getObjectByName('speechBubble');
    if (oldBubble) {
        pm.group.remove(oldBubble);
        if (oldBubble.material.map) oldBubble.material.map.dispose();
        oldBubble.material.dispose();
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Limit to 15 characters as requested
    let msg = data.message || "";
    if (msg.length > 15) msg = msg.substring(0, 15);

    // Set font first to measure correctly
    ctx.font = '900 60px "Fredoka One", sans-serif';
    const textMetrics = ctx.measureText(msg);
    const textWidth = textMetrics.width;

    // Dynamic bubble width based on text
    const padding = 80;
    const bubbleWidth = Math.max(120, textWidth + padding);
    const canvasWidth = bubbleWidth + 40; // Extra room for shadow
    const canvasHeight = 180;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear and draw bubble
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Shadow 
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 12;

    // Center the bubble in the canvas
    const bx = (canvasWidth - bubbleWidth) / 2;
    const by = 10;
    const bh = 120;
    const br = 30;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(bx, by, bubbleWidth, bh, br);
    } else {
        ctx.rect(bx, by, bubbleWidth, bh);
    }
    ctx.fill();

    // Draw bubble tip (centered under bubble)
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(canvasWidth / 2 - 20, by + bh);
    ctx.lineTo(canvasWidth / 2 + 20, by + bh);
    ctx.lineTo(canvasWidth / 2, by + bh + 25);
    ctx.fill();

    // Text (Centered)
    ctx.fillStyle = '#1e293b';
    ctx.font = '900 60px "Fredoka One", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, canvasWidth / 2, by + bh / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
    });

    const sprite = new THREE.Sprite(material);
    sprite.name = 'speechBubble';
    sprite.renderOrder = 9999;

    // Sprite scale matches the canvas aspect ratio
    const worldScaleH = 1.35;
    const worldScaleW = (canvasWidth / canvasHeight) * worldScaleH;
    sprite.scale.set(worldScaleW, worldScaleH, 1);
    sprite.position.y = 3.6;

    pm.group.add(sprite);

    // Fade and remove animation
    setTimeout(() => {
        let opacity = 1.0;
        const fade = setInterval(() => {
            opacity -= 0.08;
            if (material) material.opacity = opacity;
            if (opacity <= 0) {
                clearInterval(fade);
                if (pm && pm.group) pm.group.remove(sprite);
                texture.dispose();
                material.dispose();
            }
        }, 30);
    }, 4500);
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

    // Position comfortably in front/above the player (adjusted for giant size)
    heldGroup.position.set(0, 1.2, 0.6);

    // Scale up to EXACTLY MATCH the station's giant model sizes
    heldGroup.scale.set(2.5, 2.5, 2.5);

    // Create hand-appropriate held item visuals
    if (holding.type === 'ingredient') {
        createHeldIngredient(heldGroup, holding);
    } else if (holding.type === 'plate') {
        createHeldPlate(heldGroup, holding);
    }

    pm.group.add(heldGroup);
}

// Create realistic held ingredient visuals
function createHeldIngredient(group, content) {
    const ing = gameConfig.INGREDIENTS[content.name];
    let color = new THREE.Color(ing ? ing.color : 0xffffff);

    if (content.burnt) {
        color.setHex(0x000000);
    } else if (content.cooked) {
        color.multiplyScalar(0.6);
        if (content.name === 'meat') color.setHex(0x8B4513);
    } else if (content.chopped && content.name === 'fish') {
        color.setHex(0xFFB6C1); // Pink salmon
    }

    const mat = new THREE.MeshStandardMaterial({
        color: color.clone(),
        roughness: content.burnt ? 1.0 : 0.7
    });

    // CHOPPED INGREDIENTS (simplified for hand-held)
    if (content.chopped) {
        if (content.name === 'meat') {
            // Burger patty
            const patty = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15, 0.15, 0.04, 16),
                mat
            );
            group.add(patty);
        } else if (content.name === 'fish') {
            // Sashimi slices
            for (let i = 0; i < 3; i++) {
                const slice = new THREE.Mesh(
                    new THREE.BoxGeometry(0.12, 0.02, 0.06),
                    mat
                );
                slice.position.set(0, i * 0.025, (i - 1) * 0.02);
                slice.rotation.y = Math.PI / 8;
                group.add(slice);
            }
        } else if (content.name === 'lettuce') {
            // Shredded lettuce
            for (let i = 0; i < 4; i++) {
                const shred = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.08, 0.06),
                    new THREE.MeshStandardMaterial({
                        color: color,
                        side: THREE.DoubleSide,
                        roughness: 0.9
                    })
                );
                shred.position.set(
                    (Math.random() - 0.5) * 0.08,
                    i * 0.02,
                    (Math.random() - 0.5) * 0.08
                );
                shred.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
                group.add(shred);
            }
        } else {
            // Generic chopped pieces
            for (let i = 0; i < 4; i++) {
                const piece = new THREE.Mesh(
                    new THREE.BoxGeometry(0.04, 0.04, 0.04),
                    mat
                );
                piece.position.set(
                    (Math.random() - 0.5) * 0.1,
                    i * 0.02,
                    (Math.random() - 0.5) * 0.1
                );
                piece.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
                group.add(piece);
            }
        }
    }
    // WHOLE INGREDIENTS (hand-sized versions)
    else {
        if (content.name === 'meat') {
            // T-bone steak (compact)
            const core = new THREE.Mesh(
                new THREE.SphereGeometry(0.12, 16, 12),
                mat
            );
            core.scale.set(1.2, 0.5, 1);
            group.add(core);

            // Bone
            const boneMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            const bone = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 0.03, 0.02),
                boneMat
            );
            group.add(bone);

            // Fat rim
            const fat = new THREE.Mesh(
                new THREE.TorusGeometry(0.11, 0.02, 8, 16, Math.PI * 1.5),
                boneMat
            );
            fat.rotation.x = Math.PI / 2;
            fat.rotation.z = Math.PI / 4;
            group.add(fat);
        } else if (content.name === 'fish') {
            // Whole fish (compact)
            const body = new THREE.Mesh(
                new THREE.SphereGeometry(0.15, 16, 12),
                mat
            );
            body.scale.set(1.5, 0.6, 0.5);
            group.add(body);

            // Tail
            const tail = new THREE.Mesh(
                new THREE.ConeGeometry(0.06, 0.12, 3),
                mat
            );
            tail.position.set(0.18, 0, 0);
            tail.rotation.z = -Math.PI / 2;
            group.add(tail);

            // Eye
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.02, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0x000000 })
            );
            eye.position.set(-0.15, 0.03, 0.04);
            group.add(eye);
        } else if (content.name === 'mushroom') {
            // Mushroom
            const stem = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03, 0.04, 0.12, 12),
                new THREE.MeshStandardMaterial({ color: 0xffffff })
            );
            stem.position.y = -0.02;
            group.add(stem);

            const cap = new THREE.Mesh(
                new THREE.SphereGeometry(0.12, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
                mat
            );
            cap.position.y = 0.04;
            group.add(cap);
        } else if (content.name === 'tomato' || content.name === 'onion') {
            // Round vegetable
            const bulb = new THREE.Mesh(
                new THREE.SphereGeometry(0.11, 16, 16),
                mat
            );
            bulb.scale.y = 0.9;
            group.add(bulb);

            if (content.name === 'tomato') {
                // Tomato segments
                for (let seg = 0; seg < 6; seg++) {
                    const segment = new THREE.Mesh(
                        new THREE.BoxGeometry(0.008, 0.2, 0.008),
                        new THREE.MeshStandardMaterial({
                            color: content.burnt ? 0x000000 : 0xC0392B,
                            roughness: 0.8
                        })
                    );
                    const angle = (seg / 6) * Math.PI * 2;
                    segment.position.set(
                        Math.cos(angle) * 0.105,
                        0,
                        Math.sin(angle) * 0.105
                    );
                    segment.rotation.y = angle;
                    group.add(segment);
                }

                // Green stem/calyx
                const stemMat = new THREE.MeshStandardMaterial({ color: 0x27ae60 });
                const stem = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.015, 0.02, 0.03, 6),
                    stemMat
                );
                stem.position.y = 0.1;
                group.add(stem);

                // Calyx leaves
                for (let cl = 0; cl < 5; cl++) {
                    const leaf = new THREE.Mesh(
                        new THREE.ConeGeometry(0.015, 0.04, 3),
                        stemMat
                    );
                    const angle = (cl / 5) * Math.PI * 2;
                    leaf.position.set(
                        Math.cos(angle) * 0.03,
                        0.11,
                        Math.sin(angle) * 0.03
                    );
                    leaf.rotation.set(Math.PI / 3, angle, 0);
                    group.add(leaf);
                }
            } else {
                // Onion layers
                for (let layer = 0; layer < 3; layer++) {
                    const ring = new THREE.Mesh(
                        new THREE.TorusGeometry(0.09 - layer * 0.015, 0.003, 8, 16),
                        new THREE.MeshStandardMaterial({
                            color: content.burnt ? 0x000000 : 0xE8D5B7,
                            transparent: true,
                            opacity: 0.6
                        })
                    );
                    ring.rotation.x = Math.PI / 2;
                    ring.position.y = 0.02 + layer * 0.03;
                    group.add(ring);
                }

                // Green sprout
                const sprout = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.006, 0.008, 0.07, 6),
                    new THREE.MeshStandardMaterial({ color: 0x7CB342 })
                );
                sprout.position.y = 0.13;
                group.add(sprout);
            }
        } else if (content.name === 'lettuce') {
            // Lettuce head with leaves
            const lettuceCore = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 12, 12),
                new THREE.MeshStandardMaterial({
                    color: content.burnt ? 0x000000 : 0xC8E6C9
                })
            );
            lettuceCore.scale.y = 0.6;
            group.add(lettuceCore);

            // Lettuce leaves
            for (let i = 0; i < 5; i++) {
                const leaf = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.12, 0.1),
                    new THREE.MeshStandardMaterial({
                        color: color,
                        side: THREE.DoubleSide,
                        roughness: 0.9
                    })
                );
                const angle = (i / 5) * Math.PI * 2;
                leaf.position.set(
                    Math.cos(angle) * 0.06,
                    0.02,
                    Math.sin(angle) * 0.06
                );
                leaf.rotation.set(
                    -Math.PI / 3,
                    angle,
                    0
                );
                group.add(leaf);
            }
        } else if (content.name === 'bread') {
            // Bread bun
            const bunTop = new THREE.Mesh(
                new THREE.SphereGeometry(0.12, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
                mat
            );
            bunTop.position.y = 0.02;
            group.add(bunTop);

            const bunBottom = new THREE.Mesh(
                new THREE.CylinderGeometry(0.12, 0.11, 0.04, 16),
                mat
            );
            bunBottom.position.y = -0.02;
            group.add(bunBottom);

            // Sesame seeds
            const seedMat = new THREE.MeshStandardMaterial({ color: 0xFFFACD });
            for (let s = 0; s < 6; s++) {
                const seed = new THREE.Mesh(
                    new THREE.SphereGeometry(0.008, 6, 4),
                    seedMat
                );
                const angle = (s / 6) * Math.PI * 2;
                seed.position.set(
                    Math.cos(angle) * 0.05,
                    0.08,
                    Math.sin(angle) * 0.05
                );
                group.add(seed);
            }
        } else if (content.name === 'dough') {
            // Dough ball with flour
            const doughBall = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 16, 12),
                mat
            );
            doughBall.scale.set(1, 0.7, 1);
            group.add(doughBall);

            // Flour dusting
            const flourMat = new THREE.MeshStandardMaterial({
                color: 0xFFFFF0,
                transparent: true,
                opacity: 0.5
            });
            for (let f = 0; f < 8; f++) {
                const dust = new THREE.Mesh(
                    new THREE.SphereGeometry(0.008, 6, 4),
                    flourMat
                );
                const angle = Math.random() * Math.PI * 2;
                const radius = 0.08 + Math.random() * 0.02;
                dust.position.set(
                    Math.cos(angle) * radius,
                    (Math.random() - 0.5) * 0.12,
                    Math.sin(angle) * radius
                );
                group.add(dust);
            }
        } else if (content.name === 'cheese') {
            // Cheese wedge
            const cheese = new THREE.Mesh(
                new THREE.CylinderGeometry(0.14, 0.14, 0.1, 3),
                mat
            );
            cheese.rotation.x = Math.PI / 2;
            group.add(cheese);

            // Cheese holes
            for (let h = 0; h < 3; h++) {
                const hole = new THREE.Mesh(
                    new THREE.SphereGeometry(0.015 + Math.random() * 0.01, 8, 8),
                    new THREE.MeshStandardMaterial({
                        color: 0xFFE082,
                        roughness: 0.6
                    })
                );
                hole.position.set(
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.08,
                    (Math.random() - 0.5) * 0.1
                );
                group.add(hole);
            }
        } else if (content.name === 'rice') {
            // Rice bowl
            const rice = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 16, 12),
                mat
            );
            rice.scale.set(1, 0.6, 1);
            group.add(rice);

            // Rice grains on top
            for (let i = 0; i < 12; i++) {
                const grain = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.003, 0.003, 0.01, 4),
                    new THREE.MeshStandardMaterial({ color: 0xFFFFF0 })
                );
                grain.position.set(
                    (Math.random() - 0.5) * 0.12,
                    0.06 + Math.random() * 0.02,
                    (Math.random() - 0.5) * 0.12
                );
                grain.rotation.set(
                    (Math.random() - 0.5) * Math.PI,
                    Math.random() * Math.PI,
                    (Math.random() - 0.5) * Math.PI
                );
                group.add(grain);
            }
        } else if (content.name === 'egg') {
            // Egg
            const egg = new THREE.Mesh(
                new THREE.SphereGeometry(0.08, 16, 12),
                mat
            );
            egg.scale.set(0.8, 1, 0.8);
            group.add(egg);

            // Egg texture (subtle speckles)
            for (let sp = 0; sp < 5; sp++) {
                const speckle = new THREE.Mesh(
                    new THREE.SphereGeometry(0.005, 6, 6),
                    new THREE.MeshStandardMaterial({
                        color: 0xD4A574,
                        transparent: true,
                        opacity: 0.4
                    })
                );
                const angle = Math.random() * Math.PI * 2;
                const height = (Math.random() - 0.5) * 0.12;
                speckle.position.set(
                    Math.cos(angle) * 0.07,
                    height,
                    Math.sin(angle) * 0.07
                );
                group.add(speckle);
            }
        } else {
            // Generic sphere
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 12, 12),
                mat
            );
            group.add(sphere);
        }
    }

    // Add steam if cooked
    if (content.cooked && !content.burnt) {
        addHeldSteam(group);
    }
}

// Create held plate visual
function createHeldPlate(group, content) {
    // Simple elegant plate
    const plateMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.1,
        metalness: 0.1
    });
    const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.15, 0.03, 24),
        plateMat
    );
    group.add(plate);

    // Plate rim
    const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.008, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0xdddddd })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.025;
    group.add(rim);

    // If plate has ingredients, show simplified but recognizable version
    const ings = content.ingredients || [];
    if (ings.length > 0) {
        // Check if it's a pizza (has dough)
        const isPizza = ings.includes('dough');
        const isBurger = ings.includes('bread') && ings.includes('meat');

        if (isPizza) {
            // Pizza: show dough base with toppings
            const doughColor = content.burnt ? 0x000000 : 0xF5DEB3;
            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15, 0.15, 0.02, 24),
                new THREE.MeshStandardMaterial({ color: doughColor })
            );
            base.position.y = 0.04;
            group.add(base);

            // Tomato sauce
            if (ings.includes('tomato')) {
                const sauce = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.13, 0.13, 0.01, 24),
                    new THREE.MeshStandardMaterial({ color: 0xc0392b })
                );
                sauce.position.y = 0.055;
                group.add(sauce);
            }

            // Shredded cheese
            if (ings.includes('cheese')) {
                for (let s = 0; s < 12; s++) {
                    const shred = new THREE.Mesh(
                        new THREE.BoxGeometry(0.008, 0.004, 0.02),
                        new THREE.MeshStandardMaterial({ color: 0xf1c40f })
                    );
                    const angle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * 0.11;
                    shred.position.set(
                        Math.cos(angle) * radius,
                        0.065,
                        Math.sin(angle) * radius
                    );
                    shred.rotation.y = Math.random() * Math.PI;
                    group.add(shred);
                }
            }
        } else if (isBurger) {
            // Burger: show stacked layers
            let layerY = 0.04;
            ings.forEach((ingName) => {
                const ingConfig = gameConfig.INGREDIENTS[ingName];
                let color = new THREE.Color(ingConfig ? ingConfig.color : 0x777777);
                if (content.burnt) color.setHex(0x000000);

                const layer = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.12, 0.12, 0.02, 16),
                    new THREE.MeshStandardMaterial({ color })
                );
                layer.position.y = layerY;
                group.add(layer);
                layerY += 0.025;
            });
        } else {
            // Other dishes: show ingredients in a circle
            ings.forEach((ingName, i) => {
                const ingConfig = gameConfig.INGREDIENTS[ingName];
                let color = new THREE.Color(ingConfig ? ingConfig.color : 0x777777);
                if (content.burnt) color.setHex(0x000000);

                const piece = new THREE.Mesh(
                    new THREE.SphereGeometry(0.03, 8, 8),
                    new THREE.MeshStandardMaterial({ color })
                );
                const angle = (i / Math.max(ings.length, 1)) * Math.PI * 2;
                const radius = 0.08;
                piece.position.set(
                    Math.cos(angle) * radius,
                    0.04,
                    Math.sin(angle) * radius
                );
                group.add(piece);
            });
        }

        // Add steam if cooked
        if (content.cooked && content.cooked.length > 0 && !content.burnt) {
            addHeldSteam(group);
        }
    }
}

// Add simple steam effect for held items
function addHeldSteam(group) {
    // Create a few steam particles
    const steamMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3
    });

    for (let i = 0; i < 3; i++) {
        const steam = new THREE.Mesh(
            new THREE.SphereGeometry(0.02, 6, 6),
            steamMat
        );
        steam.position.set(
            (Math.random() - 0.5) * 0.08,
            0.12 + i * 0.04,
            (Math.random() - 0.5) * 0.08
        );
        steam.scale.set(1, 1.5, 1);
        group.add(steam);
    }
}


// ============ GUIDE BOOK ============
window.showGuideBook = () => {
    showMenu('guide');
    populateGuideContent();
};

function populateGuideContent() {
    const container = document.getElementById('lobby-guide-content');
    if (!container) return;

    container.innerHTML = `
        <div class="guide-section">
            <h4><span class="emoji-icon">🎮</span> Game Controls</h4>
            <ul>
                <li><strong>WASD / Arrow Keys</strong> - Move your chef</li>
                <li><strong>SPACE</strong> - Interact with stations / Hold to chop/cook/wash/roll</li>
                <li><strong>E</strong> - Pick up / Place items</li>
                <li><strong>Q</strong> - Drop item in trash</li>
                <li><strong>ENTER</strong> - Open chat</li>
                <li><strong>1-4</strong> - Quick chat messages</li>
                <li><strong>TAB</strong> - Toggle recipe book</li>
            </ul>
        </div>

        <div class="guide-section">
            <h4><span class="emoji-icon">🍳</span> How to Cook</h4>
            <p>Follow these steps to prepare dishes:</p>
            <ol style="list-style: decimal; padding-left: 24px;">
                <li><strong>Get a Plate</strong> - Pick up from Plates Station</li>
                <li><strong>Gather Ingredients</strong> - Get from ingredient crates</li>
                <li><strong>Process Ingredients</strong> - Chop, cook, wash, or roll as needed</li>
                <li><strong>Assemble Dish</strong> - Add all ingredients to plate</li>
                <li><strong>Serve</strong> - Deliver at Serving Station</li>
            </ol>
            <div class="guide-tip">
                <strong>💡 Tip:</strong> Check the Recipe Book (bottom right) to see what each dish needs!
            </div>
        </div>

        <div class="guide-section">
            <h4><span class="emoji-icon">🔪</span> Processing Stations</h4>
            <ul>
                <li><strong>Chopping Board</strong> - Chop vegetables, meat, fish (hold SPACE)</li>
                <li><strong>Stove</strong> - Cook meat, fish, rice, or complete dishes</li>
                <li><strong>Oven</strong> - Cook pizza (dough must be rolled first!)</li>
                <li><strong>Roller</strong> - Roll dough for pizza (hold SPACE)</li>
                <li><strong>Sink</strong> - Wash rice before cooking (hold SPACE)</li>
                <li><strong>Counter</strong> - Temporary storage for ingredients</li>
                <li><strong>Trash</strong> - Dispose of burnt or wrong items</li>
            </ul>
        </div>

        <div class="guide-section">
            <h4><span class="emoji-icon">📋</span> Recipe Types</h4>
            <p><strong>Type A: Cook First, Then Assemble</strong></p>
            <ul>
                <li>🍔 <strong>Burger</strong> - Cook meat separately, then add to plate with veggies</li>
                <li>🌮 <strong>Fish Tacos</strong> - Cook fish separately, then assemble</li>
            </ul>
            <p style="margin-top: 12px;"><strong>Type B: Assemble First, Then Cook Together</strong></p>
            <ul>
                <li>🍲 <strong>Soup</strong> - Chop all veggies, add to plate, cook together</li>
                <li>🍳 <strong>Omelette</strong> - Add all ingredients to plate, cook together</li>
                <li>🥩 <strong>Steak & Mushroom</strong> - Chop all, add to plate, cook together</li>
            </ul>
            <p style="margin-top: 12px;"><strong>Type C: No Cooking</strong></p>
            <ul>
                <li>🥗 <strong>Salad</strong> - Just chop vegetables and assemble</li>
            </ul>
            <p style="margin-top: 12px;"><strong>Type D: Special Processing</strong></p>
            <ul>
                <li>🍣 <strong>Sushi</strong> - Wash rice → Cook rice → Chop fish (don't cook fish!)</li>
                <li>🍕 <strong>Pizza</strong> - Roll dough → Chop toppings → Assemble → Cook in OVEN</li>
            </ul>
        </div>

        <div class="guide-section">
            <h4><span class="emoji-icon">⚠️</span> Important Rules</h4>
            <div class="guide-warning">
                <strong>❌ Common Mistakes:</strong>
                <ul style="margin-top: 8px;">
                    <li>Cannot cook meat/fish without chopping first</li>
                    <li>Cannot add unchopped vegetables to plate</li>
                    <li>Cannot cook rice without washing first</li>
                    <li>Cannot cook dough on stove (use oven!)</li>
                    <li>Cannot cook pizza without rolling dough first</li>
                    <li>Bread and lettuce don't need cooking</li>
                </ul>
            </div>
            <div class="guide-tip" style="margin-top: 12px;">
                <strong>✅ Pro Tips:</strong>
                <ul style="margin-top: 8px;">
                    <li>Work together in Co-op mode - divide tasks!</li>
                    <li>Watch order timers - urgent orders glow red</li>
                    <li>Combo multiplier increases with consecutive orders</li>
                    <li>Don't let food burn - pick it up when cooked!</li>
                    <li>Use counters to organize ingredients</li>
                </ul>
            </div>
        </div>

        <div class="guide-section">
            <h4><span class="emoji-icon">🏆</span> Scoring</h4>
            <ul>
                <li><strong>Base Points</strong> - Each dish has a base point value</li>
                <li><strong>Combo Multiplier</strong> - Serve orders consecutively for bonus points</li>
                <li><strong>Time Bonus</strong> - Serve quickly for extra tip</li>
                <li><strong>Freshness Bonus</strong> - Serve within 15 seconds of plating</li>
                <li><strong>Seasoning Bonus</strong> - Add salt/sauce for +8 points</li>
            </ul>
            <div class="guide-warning" style="margin-top: 12px;">
                <strong>⚠️ Penalties:</strong>
                <ul style="margin-top: 8px;">
                    <li>Wrong dish: -3 points</li>
                    <li>Expired order: -5 points</li>
                    <li>Combo resets to 0</li>
                </ul>
            </div>
        </div>

        <div class="guide-section">
            <h4><span class="emoji-icon">🎯</span> Game Modes</h4>
            <ul>
                <li><strong>Single Player</strong> - Practice alone, learn recipes</li>
                <li><strong>Co-op (Max 3)</strong> - Work together, shared score</li>
                <li><strong>VS (Max 2)</strong> - Compete for highest individual score</li>
            </ul>
        </div>

        <div class="guide-section">
            <h4><span class="emoji-icon">💬</span> Communication</h4>
            <ul>
                <li><strong>Text Chat</strong> - Press ENTER to type messages</li>
                <li><strong>Quick Chat</strong> - Press 1-4 for preset messages</li>
                <li><strong>Room Code</strong> - Share 6-digit code to invite friends</li>
            </ul>
        </div>
    `;
}

// In-game guide book toggle
const btnGuideToggle = document.getElementById('btn-guide-toggle');
if (btnGuideToggle) {
    btnGuideToggle.addEventListener('click', () => {
        const guideBook = document.getElementById('guide-book');
        if (guideBook) {
            guideBook.classList.toggle('hidden');
            if (!guideBook.classList.contains('hidden')) {
                populateInGameGuide();
            }
        }
    });
}

function populateInGameGuide() {
    const container = document.getElementById('guide-content');
    if (!container) return;

    const chatControls = roomState && roomState.mode !== 'single' ? `
                <li><strong>ENTER</strong> - Chat</li>
                <li><strong>1-4</strong> - Quick chat</li>
                ` : '';

    container.innerHTML = `
        <div class="guide-section">
            <h4><span class="emoji-icon">🎮</span> Controls</h4>
            <ul>
                <li><strong>WASD / Arrows</strong> - Move</li>
                <li><strong>SPACE</strong> - Interact / Hold to process</li>
                ${chatControls}
            </ul>
        </div>

        <div class="guide-section">
            <h4><span class="emoji-icon">⚠️</span> Quick Rules</h4>
            <ul>
                <li>Chop before cooking</li>
                <li>Wash rice before cooking</li>
                <li>Roll dough before plating</li>
                <li>Cook meat/fish before plating (burger/tacos)</li>
                <li>Assemble then cook (soup/omelette/steak)</li>
                <li>Pizza goes in OVEN, not stove</li>
            </ul>
        </div>

        <div class="guide-section">
            <h4><span class="emoji-icon">💡</span> Tips</h4>
            <ul>
                <li>Watch order timers</li>
                <li>Build combos for bonus points</li>
                <li>Don't let food burn</li>
                <li>Use counters to organize</li>
                <li>Communicate with team</li>
            </ul>
        </div>
    `;
}
