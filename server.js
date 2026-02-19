/**
 * ============================================
 *  🍳 COOKING BATTLE - MULTIPLAYER SERVER 🍳
 *  Overcooked-style Isometric Cooking Game
 * ============================================
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json()); // Enable JSON body parsing for API
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/three', express.static(path.join(__dirname, 'node_modules/three')));

// ============ MAP EDITOR API ============
app.post('/api/save-map', (req, res) => {
    const { name, layout, width, height } = req.body;
    if (!name || !layout) return res.status(400).send('Missing data');

    const filePath = path.join(__dirname, 'maps', `${name}.json`);

    // Ensure maps directory exists (I already created it manually but safer here too)
    if (!fs.existsSync(path.join(__dirname, 'maps'))) {
        fs.mkdirSync(path.join(__dirname, 'maps'));
    }

    fs.writeFile(filePath, JSON.stringify({ layout, width, height }, null, 2), (err) => {
        if (err) {
            console.error('Error saving map:', err);
            return res.status(500).send('Error saving map');
        }
        console.log(`🗺️  Map saved: ${name}`);
        res.send({ success: true });
    });
});

app.get('/api/load-map/:name', (req, res) => {
    const name = req.params.name;
    const filePath = path.join(__dirname, 'maps', `${name}.json`);

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            // It's okay if map doesn't exist, just 404
            return res.status(404).send('Map not found');
        }
        res.send(JSON.parse(data));
    });
});

app.get('/api/list-maps', (req, res) => {
    const mapsDir = path.join(__dirname, 'maps');
    if (!fs.existsSync(mapsDir)) return res.json([]);

    fs.readdir(mapsDir, (err, files) => {
        if (err) return res.status(500).send('Error listing maps');
        const jsonFiles = files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
        res.json(jsonFiles);
    });
});

app.delete('/api/delete-map/:name', (req, res) => {
    const name = req.params.name;
    const filePath = path.join(__dirname, 'maps', `${name}.json`);

    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) return res.status(500).send('Error deleting map');
            res.json({ success: true });
        });
    } else {
        res.status(404).send('Map not found');
    }
});

// ============ GAME CONFIGURATION ============
const TILE_SIZE = 2;
const GRID_W = 14;
const GRID_H = 10;
const GAME_DURATION = 300; // 5 minutes per round (Easier)
const ORDER_INTERVAL = 15000; // Slower orders (Easier)
const ORDER_TIMEOUT = 60000; // Longer expiration (Easier)
const MAX_ORDERS = 6;
const TICK_RATE = 100; // 10 ticks/sec

// ============ RECIPE DEFINITIONS ============
const INGREDIENTS = {
    tomato: { name: 'Tomato', color: '#e74c3c', emoji: '🍅', chopTime: 2500 },
    lettuce: { name: 'Lettuce', color: '#2ecc71', emoji: '🥬', chopTime: 2500 },
    meat: { name: 'Meat', color: '#a0522d', emoji: '🥩', chopTime: 4500 },
    cheese: { name: 'Cheese', color: '#f1c40f', emoji: '🧀', chopTime: 1500 },
    bread: { name: 'Bread', color: '#d4a574', emoji: '🍞', chopTime: 0 },
    dough: { name: 'Dough', color: '#f5f6fa', emoji: '⚪', chopTime: 0, rollTime: 3000 },
    fish: { name: 'Fish', color: '#3498db', emoji: '🐟', chopTime: 2500 },
    rice: { name: 'Rice', color: '#ecf0f1', emoji: '🍚', chopTime: 0, requiresWashing: true, washTime: 2000 },
    onion: { name: 'Onion', color: '#9b59b6', emoji: '🧅', chopTime: 2500 },
    mushroom: { name: 'Mushroom', color: '#8B7355', emoji: '🍄', chopTime: 2500 },
    egg: { name: 'Egg', color: '#FFEFD5', emoji: '🥚', chopTime: 0 },
};

const RECIPES = {
    burger: {
        name: 'Burger',
        emoji: '🍔',
        ingredients: ['bread', 'meat', 'lettuce', 'tomato'],
        requiresChopping: ['meat', 'lettuce', 'tomato'],
        requiresCooking: ['meat'],
        cookTime: 5000,
        points: 30,
        tip: 10,
        color: '#D4A574'
    },
    salad: {
        name: 'Salad',
        emoji: '🥗',
        ingredients: ['lettuce', 'tomato', 'onion'],
        requiresChopping: ['lettuce', 'tomato', 'onion'],
        requiresCooking: [],
        cookTime: 0,
        points: 20,
        tip: 5,
        color: '#27ae60'
    },
    sushi: {
        name: 'Sushi',
        emoji: '🍣',
        ingredients: ['rice', 'fish'],
        requiresChopping: ['fish'],
        requiresWashing: ['rice'],
        requiresCooking: ['rice'],
        cookTime: 4000,
        points: 35,
        tip: 15,
        color: '#e74c3c'
    },
    pizza: {
        name: 'Pizza',
        emoji: '🍕',
        ingredients: ['dough', 'tomato', 'cheese'],
        requiresChopping: ['tomato'],
        requiresRolling: ['dough'], // Use ROLLER first
        requiresCooking: ['dough'], // Then OVEN
        cookTime: 8000,
        points: 50,
        tip: 20,
        color: '#e67e22'
    },
    soup: {
        name: 'Soup',
        emoji: '🍲',
        ingredients: ['tomato', 'onion', 'mushroom'],
        requiresChopping: ['tomato', 'onion', 'mushroom'],
        requiresCooking: ['tomato', 'onion', 'mushroom'],
        cookTime: 7000,
        points: 35,
        tip: 10,
        color: '#c0392b'
    },
    omelette: {
        name: 'Omelette',
        emoji: '🍳',
        ingredients: ['egg', 'cheese', 'mushroom'],
        requiresChopping: ['mushroom'],
        requiresCooking: ['egg'],
        cookTime: 4000,
        points: 25,
        tip: 8,
        color: '#f39c12'
    },
    steak_mushroom: {
        name: 'Steak & Mushroom',
        emoji: '🥩🍄',
        ingredients: ['meat', 'mushroom', 'onion'],
        requiresChopping: ['meat', 'mushroom', 'onion'],
        requiresCooking: ['meat', 'mushroom', 'onion'],
        cookTime: 6000,
        points: 45,
        tip: 15,
        color: '#8B4513'
    },
    fish_tacos: {
        name: 'Fish Tacos',
        emoji: '🌮',
        ingredients: ['fish', 'lettuce', 'tomato', 'bread'],
        requiresChopping: ['fish', 'lettuce', 'tomato'],
        requiresCooking: ['fish'],
        cookTime: 5000,
        points: 40,
        tip: 12,
        color: '#FFD700'
    }
};

// ============ KITCHEN LAYOUT GENERATOR ============

function getRequiredStations(ingredients, recipes, difficulty) {
    const stations = [];
    const ingList = Object.keys(ingredients);

    // 1. Ingredient Crates
    ingList.forEach(ing => stations.push({ type: 'crate', ingredient: ing }));

    // 2. Processing Stations - Optimized for difficulty
    const count = (difficulty === 'easy') ? 1 : 2;

    for (let i = 0; i < count; i++) stations.push({ type: 'chopping', id: `chop${i}` });
    for (let i = 0; i < count; i++) stations.push({ type: 'stove', id: `stove${i}` });
    stations.push({ type: 'oven', id: 'oven1' });
    stations.push({ type: 'roller', id: 'roller1' }); // Add Roller station // Always have one oven for pizza!

    stations.push({ type: 'sink', id: 'sink1' });
    stations.push({ type: 'plates', id: 'plates1' });
    if (difficulty !== 'easy') {
        stations.push({ type: 'sink', id: 'sink2' });
        stations.push({ type: 'plates', id: 'plates2' });
    }

    stations.push({ type: 'serve', id: 'serve1' });
    stations.push({ type: 'trash', id: 'trash1' });

    // 3. Special Stations
    stations.push({ type: 'seasoning', id: 'seasoning_salt', ingredient: 'salt' });
    stations.push({ type: 'seasoning', id: 'seasoning_sauce', ingredient: 'sauce' });

    return stations;
}

function generateLayout(width, height, ingredientSet, activeRecipes, difficulty) {
    const layout = Array.from({ length: height }, () => new Array(width).fill(0));
    const stations = getRequiredStations(ingredientSet, activeRecipes, difficulty);

    // Filter stations into groups
    const crates = stations.filter(s => s.type === 'crate');
    const cooking = stations.filter(s => s.type === 'stove' || s.type === 'chopping');
    const utility = stations.filter(s => !['crate', 'stove', 'chopping', 'counter'].includes(s.type));

    // Define perimeter but skip corners
    let slots = [];
    for (let x = 1; x < width - 1; x++) { slots.push({ x, z: 0 }); slots.push({ x, z: height - 1 }); }
    for (let z = 1; z < height - 1; z++) { slots.push({ x: 0, z }); slots.push({ x: width - 1, z }); }

    // Shuffle slots
    slots = slots.sort(() => Math.random() - 0.5);

    // 1. Place Utility (Trash, Serve, Sink, Plate) in a "service zone"
    const bottomWallSlots = slots.filter(p => p.z === height - 1).sort((a, b) => a.x - b.x);
    utility.forEach((u, i) => {
        if (i < bottomWallSlots.length) {
            const pos = bottomWallSlots[i];
            layout[pos.z][pos.x] = u;
            slots = slots.filter(s => !(s.x === pos.x && s.z === pos.z));
        } else if (slots.length > 0) {
            // Overflow: place on any remaining perimeter slot
            const pos = slots.pop();
            layout[pos.z][pos.x] = u;
        }
    });

    // 2. Place Crates randomly on the remaining perimeter
    crates.forEach((crate) => {
        if (slots.length > 0) {
            const pos = slots.pop();
            layout[pos.z][pos.x] = crate;
        }
    });

    // 3. Place Cooking/Chop stations randomly in the remaining slots to break symmetry
    cooking.forEach(st => {
        if (slots.length > 0) {
            const pos = slots.pop();
            layout[pos.z][pos.x] = st;
        }
    });

    // 4. Fill 50% of remaining perimeter with counters, leave rest open for "Walls"
    slots.forEach(pos => {
        if (Math.random() > 0.3) {
            layout[pos.z][pos.x] = { type: 'counter', id: `c_${pos.x}_${pos.z}` };
        }
    });

    // 5. Add Corners always (structure)
    layout[0][0] = { type: 'counter', id: 'corner1' };
    layout[0][width - 1] = { type: 'counter', id: 'corner2' };
    layout[height - 1][0] = { type: 'counter', id: 'corner3' };
    layout[height - 1][width - 1] = { type: 'counter', id: 'corner4' };

    // 6. Island Logic - make it more than just a block
    const midX = Math.floor(width / 2);
    const midZ = Math.floor(height / 2);
    if (width > 6 && height > 6) {
        layout[midZ][midX] = { type: 'counter', id: 'island1' };
        if (width > 8) {
            layout[midZ][midX - 1] = { type: 'counter', id: 'island2' };
            layout[midZ - 1][midX] = { type: 'counter', id: 'island3' }; // L-shaped
        }
    }

    return layout;
}

// ============ GAME STATE ============
const rooms = {};

function selectContent(difficulty) {
    const allRecipes = Object.keys(RECIPES);
    let selectedRecipes = [];
    let requiredIngredients = new Set();

    if (difficulty === 'easy') {
        // Pick 2 random recipes
        while (selectedRecipes.length < 2) {
            const r = allRecipes[Math.floor(Math.random() * allRecipes.length)];
            if (!selectedRecipes.includes(r)) selectedRecipes.push(r);
        }
    } else {
        // Hard: 5 recipes (or all if less)
        selectedRecipes = allRecipes.slice(0, 5);
        // Shuffle if you want randomness:
        // selectedRecipes = allRecipes.sort(() => 0.5 - Math.random()).slice(0, 5);
    }

    // Gather ingredients
    selectedRecipes.forEach(rName => {
        RECIPES[rName].ingredients.forEach(i => requiredIngredients.add(i));
    });

    // If Easy mode needs exactly 6 ingredients and we have less, add random ones?
    if (difficulty === 'easy') {
        const allIngKeys = Object.keys(INGREDIENTS);
        const currentCount = requiredIngredients.size;
        if (currentCount < 6) {
            const missing = 6 - currentCount;
            const available = allIngKeys.filter(ing => !requiredIngredients.has(ing));
            for (let i = 0; i < missing && available.length > 0; i++) {
                const randomIng = available.splice(Math.floor(Math.random() * available.length), 1)[0];
                requiredIngredients.add(randomIng);
            }
        }
    }

    // Map back to objects (after adding fillers)
    const finalRecipes = {};
    selectedRecipes.forEach(r => finalRecipes[r] = RECIPES[r]);

    const finalIngredients = {};
    requiredIngredients.forEach(i => {
        if (INGREDIENTS[i]) finalIngredients[i] = INGREDIENTS[i];
    });

    return { recipes: finalRecipes, ingredients: finalIngredients };
}

function createRoom(roomId, settings) {
    const diff = settings.difficulty || 'easy';
    const mode = settings.mode || 'single';

    let layout = null;
    let w, h;
    let content = { recipes: {}, ingredients: {} };

    // 1. Try to load custom map
    let mapLoaded = false;
    const mapPriorities = [];
    if (mode === 'multi_coop') mapPriorities.push('multi_coop');
    mapPriorities.push(diff);

    for (const mapName of mapPriorities) {
        const p = path.join(__dirname, 'maps', `${mapName}.json`);
        try {
            if (fs.existsSync(p)) {
                const raw = fs.readFileSync(p, 'utf8');
                const data = JSON.parse(raw);
                if (data.layout) {
                    layout = data.layout;
                    w = data.width || layout[0].length;
                    h = data.height || layout.length;
                    console.log(`🗺️  Loaded custom map: ${mapName} for room ${roomId}`);
                    mapLoaded = true;
                    break;
                }
            }
        } catch (e) {
            console.error(`Failed to load map ${mapName}:`, e);
        }
    }

    // 2. Setup content (Recipes/Ingredients)
    // First, determine recipes based on difficulty
    content = selectContent(diff);

    if (mapLoaded) {
        // If map is custom, we need to populate the 'crate' stations with actual ingredients
        // based on the selected content.
        const requiredIngs = Object.keys(content.ingredients);
        let crateSlots = [];

        // Find all crate slots in the layout
        for (let z = 0; z < h; z++) {
            for (let x = 0; x < w; x++) {
                const cell = layout[z][x];
                if (cell && cell.type === 'crate') {
                    crateSlots.push({ x, z, id: cell.id });
                }
            }
        }

        // Shuffle crate slots to randomize placement
        crateSlots = crateSlots.sort(() => Math.random() - 0.5);

        // Assign ingredients to crates
        crateSlots.forEach((slot, i) => {
            // Loop through required ingredients based on slot index
            // If we have more crates than ingredients, repeat them
            if (requiredIngs.length > 0) {
                const ingName = requiredIngs[i % requiredIngs.length];
                // Update the layout cell directly with the specific ingredient
                layout[slot.z][slot.x].ingredient = ingName;
            } else {
                // Fallback if no ingredients (shouldn't happen)
                layout[slot.z][slot.x].ingredient = 'tomato';
            }
        });

    } else {
        // Standard procedural generation
        w = (diff === 'easy') ? 7 : 14;
        h = (diff === 'easy') ? 7 : 10;
        layout = generateLayout(w, h, content.ingredients, content.recipes, diff);
    }

    // Build stations map & Extract Spawn Points
    const stations = {};
    const spawns = {}; // Store { 1: {x,z}, 2: {x,z}, ... }

    for (let z = 0; z < h; z++) {
        for (let x = 0; x < w; x++) {
            const cell = layout[z][x];
            if (cell && typeof cell === 'object') {

                // Identify Spawn Points
                if (cell.type && cell.type.startsWith('spawn_')) {
                    const num = parseInt(cell.type.split('_')[1]);
                    spawns[num] = { x, z };
                    // Replace spawn marker with floor so it's walkable
                    layout[z][x] = 0;
                    continue; // Skip adding to stations
                }

                // Ensure ID is unique per cell if not already
                // If map loaded from JSON, ID might be reused from edit session.
                // We should append coordinates to be safe if it's generic?
                // But admin tool generates unique IDs.
                // Just use cell.id if present.
                const id = cell.id || `${cell.type}_${x}_${z}`;
                stations[id] = {
                    ...cell,
                    id: id,
                    gridX: x,
                    gridZ: z,
                    contents: null,
                    cookProgress: 0,
                    chopProgress: 0,
                    washProgress: 0,
                    isBurning: false,
                    isDirty: false,
                    plateReady: cell.type === 'plates',
                };
                // Update layout ref
                cell.id = id;
            }
        }
    }

    return {
        id: roomId,
        players: {},
        kitchen: layout,
        stations: stations,
        spawns: spawns, // Add spawns to room object
        orders: [],
        score: 0,
        combo: 0,
        maxCombo: 0,
        timeLeft: GAME_DURATION,
        state: 'lobby',
        mode: mode,
        difficulty: diff,
        activeRecipes: content.recipes,
        activeIngredients: content.ingredients,
        config: {
            TILE_SIZE,
            GRID_W: w,
            GRID_H: h
        },
        orderTimer: null,
        gameTimer: null,
        tickTimer: null,
        ordersCompleted: 0,
        ordersFailed: 0,
        highScore: 0,
    };
}

function getOrCreateRoom(roomId, settings = {}) {
    let room = rooms[roomId];

    // Force regeneration if mode/diff changes, or room is empty, or room doesn't exist
    // This allows immediate switching of modes for testing/user intent
    let shouldRegenerate = false;

    if (room) {
        if (Object.keys(room.players).length === 0) shouldRegenerate = true;
        // Check if user is requesting a different mode than what the room has
        if (settings.mode && room.mode !== settings.mode) shouldRegenerate = true;
        if (settings.difficulty && room.difficulty !== settings.difficulty) shouldRegenerate = true;
    } else {
        shouldRegenerate = true;
    }

    if (shouldRegenerate) {
        console.log(`♻️  Regenerating room ${roomId} (Mode: ${settings.mode || 'default'}, Diff: ${settings.difficulty || 'default'})`);
        rooms[roomId] = createRoom(roomId, settings);
        room = rooms[roomId];
    }

    return room;
}

// ============ ORDER MANAGEMENT ============
function generateOrder(room) {
    if (room.orders.length >= MAX_ORDERS) return;

    // Use only active recipes for this room
    const recipeKeys = Object.keys(room.activeRecipes);
    if (recipeKeys.length === 0) return;

    const recipeKey = recipeKeys[Math.floor(Math.random() * recipeKeys.length)];
    const recipe = room.activeRecipes[recipeKey];

    const order = {
        id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        recipe: recipeKey,
        createdAt: Date.now(),
        expiresAt: Date.now() + ORDER_TIMEOUT,
        points: recipe.points,
        tip: recipe.tip,
    };

    room.orders.push(order);
    return order;
}

function checkOrderExpiry(room) {
    const now = Date.now();
    const expired = room.orders.filter(o => now >= o.expiresAt);
    expired.forEach(o => {
        room.orders = room.orders.filter(ord => ord.id !== o.id);
        room.combo = 0;
        room.ordersFailed++;
        room.score = Math.max(0, room.score - 5); // penalty
        io.to(room.id).emit('orderExpired', { orderId: o.id, score: room.score });
    });
}

// ============ RECIPE MATCHING ============
function checkPlateMatchesOrder(plateContents, room) {
    if (!plateContents || !plateContents.ingredients || plateContents.burnt) return null;

    const plateIngs = [...plateContents.ingredients].sort();

    for (const order of room.orders) {
        const recipe = room.activeRecipes[order.recipe];
        const recipeIngs = [...recipe.ingredients].sort();

        if (plateIngs.length === recipeIngs.length &&
            plateIngs.every((ing, i) => ing === recipeIngs[i])) {
            // Check all required chopping done
            const allChopped = recipe.requiresChopping.every(ing =>
                plateContents.chopped && plateContents.chopped.includes(ing)
            );
            // Check all required cooking done
            const allCooked = recipe.requiresCooking.every(ing =>
                plateContents.cooked && plateContents.cooked.includes(ing)
            );
            // Check all required rolling done
            const allRolled = (recipe.requiresRolling || []).every(ing =>
                plateContents.rolled && plateContents.rolled.includes(ing)
            );
            // Check all required washing done
            const allWashed = (recipe.requiresWashing || []).every(ing =>
                plateContents.washed && plateContents.washed.includes(ing)
            );
            if (allChopped && allCooked && allRolled && allWashed) {
                return order;
            }
        }
    }
    return null;
}

// ============ SOCKET HANDLING ============
io.on('connection', (socket) => {
    console.log(`🍳 Chef connected: ${socket.id}`);

    socket.on('joinRoom', (data) => {
        const roomId = data.roomId || 'kitchen_1';
        // Pass mode/diff settings if this is a new room or re-configuring
        const settings = {
            mode: data.mode || 'single',
            difficulty: data.difficulty || 'easy'
        };

        const room = getOrCreateRoom(roomId, settings);

        // If joining an existing room, room mode is already set. 
        // We might want to enforce max players for single player or coop
        if (room.mode === 'single' && Object.keys(room.players).length >= 1) {
            socket.emit('notification', { msg: 'Single player room full!', type: 'error' });
            return;
        }
        if (room.mode === 'multi_coop' && Object.keys(room.players).length >= 3) {
            socket.emit('notification', { msg: 'Room full (Max 3)!', type: 'error' });
            return; // Or allow spectator? For now reject.
        }

        socket.join(roomId);

        // Calculate player index (0, 1, 2)
        const playerColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF'];
        const playerEmojis = ['👨‍🍳', '👩‍🍳', '🧑‍🍳', '👨‍🍳'];
        // Use next available index or simple count
        const existingIds = Object.keys(room.players);
        const colorIdx = existingIds.length % playerColors.length;

        // Spawns - dynamic based on map layout or custom spawns
        const gw = room.config.GRID_W;
        const gh = room.config.GRID_H;
        let spawn = { x: 1, z: 1 }; // fallback

        // 1. Check for custom spawns (P1, P2, P3)
        // colorIdx is 0 for P1, 1 for P2, etc.
        const spawnKey = colorIdx + 1;
        if (room.spawns && room.spawns[spawnKey]) {
            spawn = room.spawns[spawnKey];
            console.log(`📍 Using custom spawn P${spawnKey} for ${socket.id}`);
        } else {
            // 2. Fallback to spiral search if no custom spawn
            // Start searching from center
            const center = { x: Math.floor(gw / 2), z: Math.floor(gh / 2) };
            const maxDist = Math.max(gw, gh);
            let found = false;

            // Check center first
            if (room.kitchen[center.z] && room.kitchen[center.z][center.x] === 0) {
                spawn = center;
                found = true;
            }

            if (!found) {
                for (let d = 1; d < maxDist && !found; d++) {
                    // Check perimeter of square size d
                    for (let x = center.x - d; x <= center.x + d; x++) {
                        for (let z = center.z - d; z <= center.z + d; z++) {
                            // Scan only the perimeter
                            if (x >= 0 && x < gw && z >= 0 && z < gh) {
                                // Check if floor (0) and not occupied by another player
                                if (room.kitchen[z][x] === 0) {
                                    // Check if any player is already here (approx)
                                    const occupied = Object.values(room.players).some(p => Math.abs(p.gridX - x) < 0.5 && Math.abs(p.gridZ - z) < 0.5);
                                    if (!occupied) {
                                        spawn = { x, z };
                                        found = true;
                                        break;
                                    }
                                }
                            }
                        }
                        if (found) break;
                    }
                }
            }
        }

        // const playerColors = ... (already defined)
        // const playerEmojis = ... (already defined)
        // const colorIdx = ... (already calculated above)

        const player = {
            id: socket.id,
            name: data.name || `Chef_${socket.id.slice(0, 4)}`,
            roomId: roomId,
            gridX: spawn.x,
            gridZ: spawn.z,
            posX: spawn.x * TILE_SIZE,
            posZ: spawn.z * TILE_SIZE,
            targetX: spawn.x * TILE_SIZE,
            targetZ: spawn.z * TILE_SIZE,
            facing: 'down', // up, down, left, right
            holding: null,  // { type: 'ingredient'|'plate', data: {...} }
            color: playerColors[colorIdx],
            emoji: playerEmojis[colorIdx],
            isChopping: false,
            chopStationId: null,
            score: 0,
            dishesServed: 0,
        };

        room.players[socket.id] = player;

        // Tell the joining player about the full state
        socket.emit('init', {
            playerId: socket.id,
            room: {
                id: room.id,
                players: room.players,
                kitchen: room.kitchen,
                stations: room.stations,
                orders: room.orders,
                score: room.score,
                timeLeft: room.timeLeft,
                state: room.state,
                mode: room.mode,
            },
            config: {
                TILE_SIZE: room.config.TILE_SIZE,
                GRID_W: room.config.GRID_W,
                GRID_H: room.config.GRID_H,
                // Send only active sets to avoid client confusion
                INGREDIENTS: room.activeIngredients,
                RECIPES: room.activeRecipes,
            }
        });

        // Tell others about new player
        socket.to(roomId).emit('playerJoined', player);

        console.log(`👨‍🍳 ${player.name} joined room ${roomId} (${Object.keys(room.players).length} players)`);
    });

    // Player movement
    // Player movement
    socket.on('move', (data) => {
        const player = findPlayer(socket.id);
        if (!player) return;
        const room = rooms[player.roomId];
        if (!room || room.state !== 'playing') return;

        // Float coordinates
        const x = data.x;
        const z = data.z;

        // Basic map bounds check
        const limitX = room.config.GRID_W * TILE_SIZE;
        const limitZ = room.config.GRID_H * TILE_SIZE;
        if (x < 0 || x > limitX || z < 0 || z > limitZ) return;

        // Update player info
        player.posX = x;
        player.posZ = z;
        // Keep grid coordinates updated for interaction logic (finding nearest station)
        player.gridX = Math.round(x / TILE_SIZE);
        player.gridZ = Math.round(z / TILE_SIZE);
        player.facing = data.facing || player.facing;

        socket.to(player.roomId).emit('playerMoved', {
            id: socket.id,
            x: x,
            z: z,
            facing: player.facing,
            holding: player.holding,
        });
    });

    // Interact with station (pickup/place/use)
    socket.on('interact', (data) => {
        const player = findPlayer(socket.id);
        if (!player) return;
        const room = rooms[player.roomId];
        if (!room || room.state !== 'playing') return;

        const stationId = data.stationId;
        const station = room.stations[stationId];
        if (!station) return;

        // Distance-based interaction check (more forgiving)
        // Station center in world coords
        const sx = station.gridX * TILE_SIZE;
        const sz = station.gridZ * TILE_SIZE;

        // Player center (approx)
        const px = player.posX !== undefined ? player.posX : player.gridX * TILE_SIZE;
        const pz = player.posZ !== undefined ? player.posZ : player.gridZ * TILE_SIZE;

        const dist = Math.sqrt(Math.pow(sx - px, 2) + Math.pow(sz - pz, 2));

        // Allow if within ~1.5 tiles distance (diagonal adjacency is ~1.41)
        if (dist > TILE_SIZE * 1.8) return;

        handleInteraction(player, station, room);
    });

    // Chop action (hold spacebar)
    socket.on('chopAction', (data) => {
        const player = findPlayer(socket.id);
        if (!player) return;
        const room = rooms[player.roomId];
        if (!room || room.state !== 'playing') return;

        const station = room.stations[data.stationId];
        if (!station || station.type !== 'chopping') return;

        // --- AUTO-PLACE LOGIC ---
        // If station is empty and player is holding a choppable ingredient, place it first
        if (!station.contents && player.holding && player.holding.type === 'ingredient') {
            const ingConfig = room.activeIngredients[player.holding.name];
            if (ingConfig && ingConfig.chopTime > 0 && !player.holding.chopped) {
                station.contents = player.holding;
                station.chopProgress = 0;
                player.holding = null;
                emitPlayerUpdate(player, room);
                console.log(`🧼 Auto-placed ${station.contents.name} for chopping`);
            }
        }

        if (!station.contents || station.contents.type !== 'ingredient') return;

        // Skip if already chopped or doesn't need chopping
        const ingredient = room.activeIngredients[station.contents.name];
        if (!ingredient || ingredient.chopTime === 0 || station.contents.chopped) return;

        // Throttling: Check last chop time
        const now = Date.now();
        if (player.lastChopTime && now - player.lastChopTime < 50) return;
        player.lastChopTime = now;

        // Increment chop progress
        const baseSpeed = ingredient.chopTime || 1000;
        const increment = 10000 / baseSpeed; // 10000 ensures chopTime is literal ms (3s = 3000ms)
        station.chopProgress += increment;

        // Check completion (inclusive of slight rounding)
        if (station.chopProgress >= 98.0) {
            station.contents.chopped = true;
            station.chopProgress = 100;
            io.to(room.id).emit('chopComplete', {
                stationId: station.id,
                ingredient: station.contents.name,
                playerId: socket.id,
            });
        }

        io.to(room.id).emit('stationUpdate', {
            stationId: station.id,
            station: sanitizeStation(station),
        });
    });

    // Roll action (hold spacebar at roller)
    socket.on('rollAction', (data) => {
        const player = findPlayer(socket.id);
        if (!player) return;
        const room = rooms[player.roomId];
        if (!room || room.state !== 'playing') return;

        const station = room.stations[data.stationId];
        if (!station || station.type !== 'roller') return;

        // Auto-place logic for Dough
        if (!station.contents && player.holding && player.holding.name === 'dough' && !player.holding.rolled) {
            station.contents = player.holding;
            station.rollProgress = 0;
            player.holding = null;
            emitPlayerUpdate(player, room);
        }

        if (!station.contents || station.contents.name !== 'dough' || station.contents.rolled) return;

        const ingConfig = room.activeIngredients['dough'];
        const rollTime = ingConfig.rollTime || 3000;

        station.rollProgress += (10000 / rollTime);

        if (station.rollProgress >= 98) {
            station.contents.rolled = true;
            station.rollProgress = 100;
            io.to(room.id).emit('notification', { msg: 'Dough Rolled!', type: 'success' });
        }

        io.to(room.id).emit('stationUpdate', {
            stationId: station.id,
            station: sanitizeStation(station),
        });
    });

    // Wash action (hold spacebar at sink)
    socket.on('washAction', (data) => {
        const player = findPlayer(socket.id);
        if (!player) return;
        const room = rooms[player.roomId];
        if (!room || room.state !== 'playing') return;

        const station = room.stations[data.stationId];
        if (!station || station.type !== 'sink') return;

        // Auto-place rice if holding it
        if (!station.contents && player.holding && player.holding.name === 'rice' && !player.holding.washed) {
            station.contents = player.holding;
            station.washProgress = 0;
            player.holding = null;
            emitPlayerUpdate(player, room);
        }

        if (!station.contents || station.contents.name !== 'rice' || station.contents.washed) return;

        const ingConfig = room.activeIngredients['rice'];
        const washTime = ingConfig.washTime || 2000;

        station.washProgress = (station.washProgress || 0) + (10000 / washTime);

        if (station.washProgress >= 98) {
            station.contents.washed = true;
            station.washProgress = 100;
            io.to(room.id).emit('notification', { msg: '✅ Rice washed! Now cook it!', type: 'success' });
        }

        io.to(room.id).emit('stationUpdate', {
            stationId: station.id,
            station: sanitizeStation(station),
        });
    });

    // Start game
    socket.on('startGame', () => {
        const player = findPlayer(socket.id);
        if (!player) return;
        const room = rooms[player.roomId];
        if (!room || room.state !== 'lobby') return;

        startGame(room);
    });

    // Restart game
    socket.on('restartGame', () => {
        const player = findPlayer(socket.id);
        if (!player) return;
        const room = rooms[player.roomId];
        if (!room) return;

        restartGame(room);
    });

    // Chat
    socket.on('chatMessage', (msg) => {
        const player = findPlayer(socket.id);
        if (!player) return;
        io.to(player.roomId).emit('chatMessage', {
            sender: player.name,
            message: msg,
            color: player.color,
            timestamp: Date.now(),
        });
    });

    // Set name
    socket.on('setName', (name) => {
        const player = findPlayer(socket.id);
        if (player) {
            player.name = name.slice(0, 15);
            io.to(player.roomId).emit('playerRenamed', {
                id: socket.id,
                name: player.name,
            });
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        const player = findPlayer(socket.id);
        if (player) {
            const room = rooms[player.roomId];
            if (room) {
                delete room.players[socket.id];
                io.to(room.id).emit('playerLeft', socket.id);

                // Clean up empty rooms
                if (Object.keys(room.players).length === 0) {
                    clearTimers(room);
                    delete rooms[room.id];
                    console.log(`🗑️ Room ${room.id} deleted (empty)`);
                }
            }
        }
        console.log(`❌ Chef disconnected: ${socket.id}`);
    });
});

// ============ INTERACTION LOGIC ============
function handleInteraction(player, station, room) {
    switch (station.type) {
        case 'crate':
            handleCrate(player, station, room);
            break;
        case 'counter':
            handleCounter(player, station, room);
            break;
        case 'chopping':
            handleChopping(player, station, room);
            break;
        case 'stove':
            handleStove(player, station, room);
            break;
        case 'oven':
            handleOven(player, station, room);
            break;
        case 'roller':
            handleRoller(player, station, room);
            break;
        case 'serve':
            handleServe(player, station, room);
            break;
        case 'trash':
            handleTrash(player, station, room);
            break;
        case 'plates':
            handlePlates(player, station, room);
            break;
        case 'sink':
            handleSink(player, station, room);
            break;
    }

    emitGameState(room);
}

function handleCrate(player, station, room) {
    // Pick up ingredient from crate
    if (!player.holding) {
        player.holding = {
            type: 'ingredient',
            name: station.ingredient,
            chopped: false,
            cooked: false,
            rolled: false,
            washed: false,
        };
        emitPlayerUpdate(player, room);
    }
}

function handleCounter(player, station, room) {
    if (player.holding && !station.contents) {
        // Place item on counter
        station.contents = player.holding;
        player.holding = null;
    } else if (!player.holding && station.contents) {
        // Pick up from counter
        player.holding = station.contents;
        station.contents = null;
    } else if (player.holding && station.contents) {
        // Try to combine on counter
        const combined = tryCombine(player.holding, station.contents);
        if (combined) {
            station.contents = combined;
            player.holding = null;
        }
    }
    emitPlayerUpdate(player, room);
}

function handleChopping(player, station, room) {
    if (player.holding && !station.contents) {
        // Place ingredient for chopping
        if (player.holding.type === 'ingredient') {
            const ing = room.activeIngredients[player.holding.name];
            if (ing && ing.chopTime > 0 && !player.holding.chopped) {
                station.contents = player.holding;
                station.chopProgress = 0;
                player.holding = null;
            }
        }
    } else if (station.contents) {
        // Handling interaction with contents on the board

        if (player.holding && player.holding.type === 'plate') {
            // Try to combine whatever is on the board onto the plate
            const combined = tryCombine(station.contents, player.holding);
            if (combined) {
                player.holding = combined;
                station.contents = null;
                station.chopProgress = 0;
                io.to(room.id).emit('notification', { msg: 'Plated!', type: 'success' });
            }
        } else if (!player.holding) {
            // Picking up with empty hands (Now Allowed for chopped items too!)
            player.holding = station.contents;
            station.contents = null;
            station.chopProgress = 0;
        }
    }
    emitPlayerUpdate(player, room);
}

function handleStove(player, station, room) {
    if (player.holding && !station.contents) {
        // Validate: Only cookable items go on stove
        // Bread and dough should NOT go on stove (bread doesn't cook, dough goes to oven)
        if (player.holding.type === 'ingredient') {
            const name = player.holding.name;
            if (name === 'bread') {
                io.to(room.id).emit('notification', { msg: '🍞 Bread doesn\'t need cooking!', type: 'error' });
                emitPlayerUpdate(player, room);
                return;
            }
            if (name === 'dough') {
                io.to(room.id).emit('notification', { msg: '⚪ Use the Oven for dough!', type: 'error' });
                emitPlayerUpdate(player, room);
                return;
            }
            if (name === 'lettuce') {
                io.to(room.id).emit('notification', { msg: '🥬 Lettuce doesn\'t need cooking!', type: 'error' });
                emitPlayerUpdate(player, room);
                return;
            }
            // Rice must be washed first
            if (name === 'rice' && !player.holding.washed) {
                io.to(room.id).emit('notification', { msg: '🍚 Wash the rice at the Sink first!', type: 'error' });
                emitPlayerUpdate(player, room);
                return;
            }
            station.contents = player.holding;
            station.cookProgress = 0;
            station.isBurning = false;
            station.cookedNotified = false;
            player.holding = null;
        } else if (player.holding.type === 'plate') {
            station.contents = player.holding;
            station.cookProgress = 0;
            station.isBurning = false;
            station.cookedNotified = false;
            player.holding = null;
        }
    } else if (!player.holding && station.contents) {
        // Pick up from stove
        player.holding = station.contents;
        if (station.isBurning || (station.type === 'stove' && station.cookProgress >= 200)) {
            player.holding.burnt = true;
        }
        station.contents = null;
        station.cookProgress = 0;
        station.isBurning = false;
        station.cookedNotified = false;
    } else if (player.holding && station.contents) {
        // Try to add ingredient to pot/pan on stove
        const combined = tryCombine(player.holding, station.contents);
        if (combined) {
            station.contents = combined;
            player.holding = null;
        }
    }
    emitPlayerUpdate(player, room);
}

function handleOven(player, station, room) {
    if (player.holding && !station.contents) {
        // Only allow dough or pizza combos in oven
        if (player.holding.name === 'dough' || (player.holding.type === 'plate' && player.holding.ingredients.includes('dough'))) {
            station.contents = player.holding;
            station.cookProgress = 0;
            station.isBurning = false;
            station.cookedNotified = false;
            player.holding = null;
        } else {
            io.to(room.id).emit('notification', { msg: 'Only Pizza/Dough in the Oven!', type: 'error' });
        }
    } else if (!player.holding && station.contents) {
        player.holding = station.contents;
        if (station.isBurning || (station.type === 'oven' && station.cookProgress >= 200)) {
            player.holding.burnt = true;
        }
        station.contents = null;
        station.cookProgress = 0;
        station.isBurning = false;
        station.cookedNotified = false;
    }
    emitPlayerUpdate(player, room);
}

function handleRoller(player, station, room) {
    if (player.holding && !station.contents) {
        if (player.holding.name === 'dough' && !player.holding.rolled) {
            station.contents = player.holding;
            station.rollProgress = 0;
            player.holding = null;
        }
    } else if (!player.holding && station.contents) {
        player.holding = station.contents;
        station.contents = null;
        station.rollProgress = 0;
    }
    emitPlayerUpdate(player, room);
}

function handleServe(player, station, room) {
    if (player.holding && player.holding.type === 'plate') {
        const plate = player.holding;
        const matchedOrder = checkPlateMatchesOrder(plate, room);

        if (matchedOrder) {
            room.combo++;
            if (room.combo > room.maxCombo) room.maxCombo = room.combo;

            const comboMultiplier = Math.min(room.combo, 5);
            const timeBonus = matchedOrder.expiresAt - Date.now() > ORDER_TIMEOUT * 0.5
                ? matchedOrder.tip : 0;

            // --- NEW: FRESHNESS BONUS ---
            let freshnessBonus = 0;
            if (plate.platedAt) {
                const age = (Date.now() - plate.platedAt) / 1000; // seconds
                if (age < 15) freshnessBonus = 10;
                else if (age < 30) freshnessBonus = 5;
            }

            // --- NEW: SEASONING BONUS ---
            const seasoningBonus = plate.seasoning ? 8 : 0;

            const basePoints = matchedOrder.points;
            const totalPoints = basePoints + (comboMultiplier - 1) * 5 + timeBonus + freshnessBonus + seasoningBonus;

            room.score += totalPoints;
            room.ordersCompleted++;
            player.score += totalPoints;
            player.dishesServed++;

            room.orders = room.orders.filter(o => o.id !== matchedOrder.id);
            player.holding = null;

            io.to(room.id).emit('orderCompleted', {
                orderId: matchedOrder.id,
                recipe: matchedOrder.recipe,
                points: totalPoints,
                combo: room.combo,
                totalScore: room.score,
                playerId: player.id,
                playerScore: player.score,
            });

            let msg = `${room.activeRecipes[matchedOrder.recipe].emoji} ${room.activeRecipes[matchedOrder.recipe].name} served! +${totalPoints} pts`;
            if (freshnessBonus > 0) msg += ` (✨ Freshness +${freshnessBonus})`;
            if (seasoningBonus > 0) msg += ` (🧂 Seasoned +${seasoningBonus})`;

            io.to(room.id).emit('notification', {
                msg: msg,
                type: 'success',
            });
        } else {
            room.combo = 0;
            room.score = Math.max(0, room.score - 3);
            player.holding = null;
            io.to(room.id).emit('notification', { msg: '❌ Wrong dish!', type: 'error' });
        }
    }
    emitPlayerUpdate(player, room);
}

function handleSeasoning(player, station, room) {
    if (player.holding && player.holding.type === 'plate') {
        if (!player.holding.seasoning) {
            player.holding.seasoning = station.ingredient; // 'salt' or 'sauce'
            io.to(room.id).emit('notification', { msg: `✨ Added ${station.ingredient}!`, type: 'success' });
        } else {
            io.to(room.id).emit('notification', { msg: 'Already seasoned!', type: 'info' });
        }
    } else {
        io.to(room.id).emit('notification', { msg: 'Hold a plate to season!', type: 'info' });
    }
    emitPlayerUpdate(player, room);
}

function handleTrash(player, station, room) {
    if (player.holding) {
        player.holding = null;
        io.to(room.id).emit('notification', {
            msg: '🗑️ Item trashed',
            type: 'info',
        });
    }
    emitPlayerUpdate(player, room);
}

function handlePlates(player, station, room) {
    if (!player.holding) {
        // Pick up a clean plate
        player.holding = {
            type: 'plate',
            ingredients: [],
            chopped: [],
            cooked: [],
            rolled: [],
        };
    }
    emitPlayerUpdate(player, room);
}

function handleSink(player, station, room) {
    // Sink washes rice (required before cooking)
    if (player.holding && player.holding.type === 'ingredient' && player.holding.name === 'rice' && !player.holding.washed) {
        // Place rice in sink for washing
        if (!station.contents) {
            station.contents = player.holding;
            station.washProgress = 0;
            player.holding = null;
            io.to(room.id).emit('notification', {
                msg: '🚰 Washing rice... Hold Space!',
                type: 'info',
            });
        }
    } else if (!player.holding && station.contents) {
        // Pick up washed rice
        player.holding = station.contents;
        station.contents = null;
        station.washProgress = 0;
    } else if (player.holding && player.holding.dirty) {
        // Also handle dirty plates
        player.holding.dirty = false;
        io.to(room.id).emit('notification', {
            msg: '🧼 Plate cleaned!',
            type: 'info',
        });
    } else if (player.holding && player.holding.type === 'ingredient' && player.holding.name !== 'rice') {
        io.to(room.id).emit('notification', {
            msg: '🚰 Only rice needs washing!',
            type: 'error',
        });
    }
    emitPlayerUpdate(player, room);
}

// ============ ITEM COMBINING ============
function tryCombine(itemA, itemB) {
    // Combine ingredient onto plate
    if (itemA.type === 'ingredient' && itemB.type === 'plate') {
        // PIZZA LOGIC: Dough MUST be rolled before plating
        if (itemA.name === 'dough' && !itemA.rolled) {
            return null;
        }
        // RICE LOGIC: Rice MUST be washed before plating
        if (itemA.name === 'rice' && !itemA.washed) {
            return null;
        }

        if (!itemB.ingredients.includes(itemA.name)) {
            const plate = { ...itemB };
            plate.ingredients = [...itemB.ingredients, itemA.name];
            if (itemA.chopped) plate.chopped = [...(itemB.chopped || []), itemA.name];
            if (itemA.cooked) plate.cooked = [...(itemB.cooked || []), itemA.name];
            if (itemA.rolled) plate.rolled = [...(itemB.rolled || []), itemA.name];
            if (itemA.washed) plate.washed = [...(itemB.washed || []), itemA.name];
            if (itemA.burnt) plate.burnt = true;

            // --- TRACK FRESHNESS ---
            if (!plate.platedAt) plate.platedAt = Date.now();

            return plate;
        }
    }
    // Combine plate + ingredient (reversed)
    if (itemB.type === 'ingredient' && itemA.type === 'plate') {
        return tryCombine(itemB, itemA);
    }
    return null;
}

// ============ GAME LOOP ============
function startGame(room) {
    room.state = 'playing';
    room.timeLeft = GAME_DURATION;
    room.score = 0;
    room.combo = 0;
    room.maxCombo = 0;
    room.orders = [];
    room.ordersCompleted = 0;
    room.ordersFailed = 0;

    // Reset all stations
    Object.values(room.stations).forEach(s => {
        s.contents = null;
        s.cookProgress = 0;
        s.chopProgress = 0;
        s.isBurning = false;
        s.isDirty = false;
    });

    // Reset players
    Object.values(room.players).forEach((p, i) => {
        p.holding = null;
        p.score = 0;
        p.dishesServed = 0;
        p.isChopping = false;
    });

    // Generate first orders
    generateOrder(room);
    generateOrder(room);

    io.to(room.id).emit('gameStarted', {
        timeLeft: room.timeLeft,
        orders: room.orders,
    });

    // Order generation timer
    room.orderTimer = setInterval(() => {
        const order = generateOrder(room);
        if (order) {
            io.to(room.id).emit('newOrder', order);
        }
    }, ORDER_INTERVAL);

    // Game countdown timer
    room.gameTimer = setInterval(() => {
        room.timeLeft--;
        io.to(room.id).emit('timeUpdate', room.timeLeft);

        if (room.timeLeft <= 0) {
            endGame(room);
        }
    }, 1000);

    // Game tick (stove cooking, order expiry)
    room.tickTimer = setInterval(() => {
        tickGame(room);
    }, TICK_RATE);
}

function tickGame(room) {
    checkOrderExpiry(room);

    // Update stoves & ovens (cooking progress)
    Object.values(room.stations).forEach(station => {
        if ((station.type === 'stove' || station.type === 'oven') && station.contents) {
            const contents = station.contents;

            // Find which recipe could be cooking
            let cookTime = 5000; // default
            if (contents.type === 'plate' && contents.ingredients.length > 0) {
                // Check recipes for cook time
                for (const [key, recipe] of Object.entries(room.activeRecipes)) {
                    if (recipe.requiresCooking.length > 0) {
                        const hasAll = recipe.requiresCooking.some(ing =>
                            contents.ingredients.includes(ing)
                        );
                        if (hasAll) {
                            cookTime = recipe.cookTime;
                            break;
                        }
                    }
                }
            } else if (contents.type === 'ingredient') {
                const ing = room.activeIngredients[contents.name];
                if (ing) {
                    // Meat cooks in 5s, Veggies in 4s, Fish/Soup in 6s
                    if (contents.name === 'meat') cookTime = 5000;
                    else if (['fish', 'mushroom', 'onion'].includes(contents.name)) cookTime = 6000;
                    else cookTime = 4000;
                }
            }

            station.cookProgress += (TICK_RATE / cookTime) * 100;

            if (station.cookProgress >= 100 && !station.cookedNotified) {
                // Mark as cooked
                if (contents.type === 'ingredient') {
                    contents.cooked = true;
                } else if (contents.type === 'plate') {
                    contents.ingredients.forEach(ing => {
                        if (!contents.cooked) contents.cooked = [];
                        if (!contents.cooked.includes(ing)) contents.cooked.push(ing);
                    });
                }
                station.cookedNotified = true;
                io.to(room.id).emit('cookComplete', { stationId: station.id });
                console.log(`🍳 Station ${station.id} finished cooking.`);
            }

            if (station.cookProgress >= 200 && !station.isBurning) {
                // BURNING! (5 seconds after being done)
                station.isBurning = true;
                io.to(room.id).emit('burning', {
                    stationId: station.id,
                });
                console.log(`🔥 Station ${station.id} is now BURNING!`);
            }

            if (station.cookProgress >= 300) {
                // Fire! Destroy contents
                station.contents = null;
                station.cookProgress = 0;
                station.isBurning = false;
                station.cookedNotified = false;
                room.score = Math.max(0, room.score - 10);
                io.to(room.id).emit('fire', {
                    stationId: station.id,
                    score: room.score,
                });
                io.to(room.id).emit('notification', {
                    msg: '🔥 FIRE! Food destroyed! -10 pts',
                    type: 'error',
                });
            }

            io.to(room.id).emit('stationUpdate', {
                stationId: station.id,
                station: sanitizeStation(station),
            });
        }
    });
}

function endGame(room) {
    room.state = 'gameover';
    clearTimers(room);

    if (room.score > room.highScore) {
        room.highScore = room.score;
    }

    io.to(room.id).emit('gameOver', {
        score: room.score,
        highScore: room.highScore,
        ordersCompleted: room.ordersCompleted,
        ordersFailed: room.ordersFailed,
        maxCombo: room.maxCombo,
        players: Object.values(room.players).map(p => ({
            name: p.name,
            score: p.score,
            dishesServed: p.dishesServed,
            color: p.color,
        })),
    });
}

function restartGame(room) {
    clearTimers(room);
    room.state = 'lobby';
    room.orders = [];
    room.score = 0;
    room.timeLeft = GAME_DURATION;

    // Reset stations
    Object.values(room.stations).forEach(s => {
        s.contents = null;
        s.cookProgress = 0;
        s.chopProgress = 0;
        s.isBurning = false;
    });

    // Reset players
    Object.values(room.players).forEach(p => {
        p.holding = null;
        p.score = 0;
        p.dishesServed = 0;
    });

    io.to(room.id).emit('gameRestarted', {
        room: {
            id: room.id,
            players: room.players,
            stations: room.stations,
            orders: [],
            score: 0,
            timeLeft: GAME_DURATION,
            state: 'lobby',
        }
    });
}

function clearTimers(room) {
    if (room.orderTimer) clearInterval(room.orderTimer);
    if (room.gameTimer) clearInterval(room.gameTimer);
    if (room.tickTimer) clearInterval(room.tickTimer);
    room.orderTimer = null;
    room.gameTimer = null;
    room.tickTimer = null;
}

// ============ HELPERS ============
function findPlayer(socketId) {
    for (const room of Object.values(rooms)) {
        if (room.players[socketId]) {
            return room.players[socketId];
        }
    }
    return null;
}

function sanitizeStation(station) {
    return {
        id: station.id,
        type: station.type,
        gridX: station.gridX,
        gridZ: station.gridZ,
        contents: station.contents,
        cookProgress: station.cookProgress,
        chopProgress: station.chopProgress,
        rollProgress: station.rollProgress,
        washProgress: station.washProgress,
        isBurning: station.isBurning,
        isDirty: station.isDirty,
        ingredient: station.ingredient,
    };
}

function emitPlayerUpdate(player, room) {
    io.to(room.id).emit('playerUpdate', {
        id: player.id,
        gridX: player.gridX, // Keep sending grid for compatibility or interactions
        gridZ: player.gridZ,
        x: player.posX,      // Send actual float pos
        z: player.posZ,
        facing: player.facing,
        holding: player.holding,
        score: player.score,
    });
}

function emitGameState(room) {
    const stationsData = {};
    Object.entries(room.stations).forEach(([id, s]) => {
        stationsData[id] = sanitizeStation(s);
    });

    io.to(room.id).emit('gameStateUpdate', {
        stations: stationsData,
        orders: room.orders,
        score: room.score,
        timeLeft: room.timeLeft,
    });
}

// ============ START SERVER ============
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║  🍳  COOKING BATTLE - GAME SERVER  🍳     ║
    ║  Server running on port ${PORT}             ║
    ║  http://localhost:${PORT}                   ║
    ║  Chopping Speed: 2.5s (Veggies) / 4.5s (Meat) ║
    ╚═══════════════════════════════════════════╝
    `);
});
