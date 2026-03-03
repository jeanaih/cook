export class UIManager {
    constructor(config, socket) {
        this.config = config;
        this.socket = socket;
        this.setupChat();
        this.setupRecipeToggle();
    }

    showScreen(name) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(`${name}-screen`).classList.add('active');
    }

    updatePlayerList(players) {
        let list = document.getElementById('hud-player-list');
        if (!list) return;

        list.innerHTML = '';
        Object.values(players).forEach(p => {
            const tag = document.createElement('div');
            tag.className = 'hud-player-tag';
            tag.style.borderLeftColor = p.color;
            tag.innerHTML = `
                <span class="player-name">${p.name}</span>
                <span class="player-score">${p.score || 0} pts</span>
            `;
            list.appendChild(tag);
        });
    }

    buildRecipeBook() {
        const list = document.getElementById('recipe-list');
        list.innerHTML = '';
        Object.entries(this.config.RECIPES).forEach(([key, r]) => {
            const item = document.createElement('div');
            item.className = 'recipe-item';
            const ings = r.ingredients.map(i => {
                const ing = this.config.INGREDIENTS[i];
                return ing?.emoji ? `<span title="${ing.name}">${ing.emoji}</span>` : i;
            }).join(' ');
            const chops = r.requiresChopping && r.requiresChopping.length > 0
                ? `<br><img src="/assets/cutting-board.png" style="width: 1em; height: 1em; vertical-align: -0.125em; filter: invert(1);"> Chop: ${r.requiresChopping.map(i => this.config.INGREDIENTS[i]?.emoji || i).join(' ')}`
                : '';
            const rolls = r.requiresRolling && r.requiresRolling.length > 0
                ? `<br><i class="bi bi-arrow-repeat"></i> Roll: ${r.requiresRolling.map(i => this.config.INGREDIENTS[i]?.emoji || i).join(' ')}`
                : '';
            const cooks = r.requiresCooking && r.requiresCooking.length > 0
                ? `<br><img src="/assets/hot-pot.png" style="width: 1em; height: 1em; vertical-align: -0.125em; filter: invert(1);"> Cook: ${r.requiresCooking.map(i => this.config.INGREDIENTS[i]?.emoji || i).join(' ')}`
                : '';

            // Build process steps for pizza-like recipes
            let process = '';
            if (r.requiresRolling && r.requiresRolling.length > 0) {
                process = `<div class="recipe-process"><i class="bi bi-list-check"></i> Process: Roll → Plate → Add toppings → Oven</div>`;
            }

            item.innerHTML = `
                <div class="recipe-item-emoji">${r.emoji || '<i class="bi bi-egg-fried"></i>'}</div>
                <div class="recipe-item-info">
                    <div class="recipe-item-name">${r.name}</div>
                    <div class="recipe-item-ings">${ings}${chops}${rolls}${cooks}</div>
                    ${process}
                </div>
                <div class="recipe-item-points">${r.points}pts</div>
            `;
            list.appendChild(item);
        });
    }

    updateOrders(orders, config) {
        const list = document.getElementById('orders-list');
        list.innerHTML = '';
        orders.forEach(order => {
            const recipe = config.RECIPES[order.recipe];
            if (!recipe) return;
            const card = document.createElement('div');
            card.className = 'order-card';
            card.id = `order-${order.id}`;

            const ings = recipe.ingredients.map(i => config.INGREDIENTS[i]?.emoji || '').join('');
            card.innerHTML = `
                <span class="order-emoji">${recipe.emoji || '<i class="bi bi-egg-fried"></i>'}</span>
                <div class="order-name">${recipe.name}</div>
                <div class="order-ingredients">${ings}</div>
                <div class="order-points"><i class="bi bi-star-fill"></i> +${order.points} pts</div>
            `;
            list.appendChild(card);
        });
    }

    updateOrderTimers(orders) {
        // No-op: orders no longer have timers
    }

    updateScore(score, combo) {
        document.getElementById('score-value').textContent = score;
        const comboEl = document.getElementById('combo-value');
        if (combo > 1) {
            comboEl.innerHTML = `<i class="bi bi-fire"></i> x${combo} COMBO!`;
        } else {
            comboEl.textContent = '';
        }
    }

    updateTimer(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        const el = document.getElementById('timer-value');
        el.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
        if (seconds <= 30) el.classList.add('danger');
        else el.classList.remove('danger');
    }

    updateHolding(holding, config) {
        const el = document.getElementById('holding-display');
        if (!holding) {
            el.textContent = 'Nothing';
            el.style.color = '#64748b';
            return;
        }
        if (holding.type === 'ingredient') {
            const ing = config.INGREDIENTS[holding.name];
            const status = [];
            if (holding.chopped) status.push('<img src="/assets/cutting-board.png" style="width: 1em; height: 1em; vertical-align: -0.125em; filter: brightness(0) invert(1);">');
            if (holding.cooked) status.push('<img src="/assets/hot-pot.png" style="width: 1em; height: 1em; vertical-align: -0.125em; filter: brightness(0) invert(1);">');
            if (holding.rolled) status.push('<i class="bi bi-arrow-repeat"></i>');
            if (holding.washed) status.push('<i class="bi bi-droplet-fill"></i>');
            el.innerHTML = `${ing?.emoji || '?'} ${ing?.name || holding.name} ${status.join(' ')}`;
            el.style.color = ing?.color || '#fff';
        } else if (holding.type === 'plate') {
            if (holding.ingredients.length === 0) {
                el.innerHTML = '<i class="bi bi-circle"></i> Empty Plate';
                el.style.color = '#f0f0f0';
            } else {
                // Show ingredients with their status
                const ingredientDetails = holding.ingredients.map(ingName => {
                    const ing = config.INGREDIENTS[ingName];
                    const emoji = ing?.emoji || '?';
                    const status = [];

                    // Check if this specific ingredient is chopped/cooked/rolled/washed
                    if (holding.chopped && holding.chopped.includes(ingName)) {
                        status.push('<img src="/assets/cutting-board.png" style="width: 10px; height: 10px; vertical-align: middle; filter: brightness(0) invert(1);">');
                    }
                    if (holding.cooked && holding.cooked.includes(ingName)) {
                        status.push('<img src="/assets/hot-pot.png" style="width: 10px; height: 10px; vertical-align: middle; filter: brightness(0) invert(1);">');
                    }
                    if (holding.rolled && holding.rolled.includes(ingName)) {
                        status.push('<i class="bi bi-arrow-repeat" style="font-size: 10px;"></i>');
                    }
                    if (holding.washed && holding.washed.includes(ingName)) {
                        status.push('<i class="bi bi-droplet-fill" style="font-size: 10px;"></i>');
                    }

                    return `<span style="display: inline-flex; align-items: center; gap: 2px;">${emoji}${status.join('')}</span>`;
                }).join(' ');

                el.innerHTML = `<i class="bi bi-circle-fill"></i> ${ingredientDetails}`;
                el.style.color = '#f0f0f0';
            }
        }
    }

    showNotification(msg, type) {
        const container = document.getElementById('notifications');
        const el = document.createElement('div');
        el.className = `notification ${type}`;
        el.textContent = msg;
        container.appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    showScorePop(text) {
        const el = document.createElement('div');
        el.className = 'score-pop';
        el.textContent = text;
        el.style.left = '50%';
        el.style.top = '40%';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1200);
    }

    showGameOver(data, playerId) {
        this.showScreen('gameover');

        const localPlayer = data.players.find(p => p.id === playerId) || data.players[0] || {};

        let displayScore = data.score;
        if (data.mode === 'multi_vs') {
            displayScore = localPlayer.score || 0;
        }
        document.getElementById('final-score').textContent = displayScore;

        const stats = document.getElementById('gameover-stats');
        stats.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${localPlayer.dishesServed || 0}</div>
                <div class="stat-label">Dishes Served</div>
            </div>
            <div class="stat-card">
                <div class="stat-value"><img src="/assets/chef-hat-coin.png" style="width: 1.2em; height: 1.2em; vertical-align: -0.2em; margin-right: 4px;"> ${localPlayer.chefPoints || 0}</div>
                <div class="stat-label">Chef Points</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color:var(--secondary)">+${localPlayer.xpGain || 0}</div>
                <div class="stat-label">XP Gained</div>
            </div>
        `;

        // Players
        const playersEl = document.getElementById('gameover-players');
        playersEl.innerHTML = data.players.map(p => `
            <div class="player-tag" style="border-color:${p.color};background:${p.color}22;margin:4px">
                <i class="bi bi-person-fill"></i> ${p.name}: ${p.score} pts (${p.dishesServed} dishes)
            </div>
        `).join('');

        const performanceEl = document.getElementById('star-rating');
        const titleEl = document.querySelector('.gameover-title');
        let perfText = "Practice More";
        let perfColor = "var(--text-muted)";
        let titleText = "<i class=\"bi bi-stopwatch\"></i> Time's Up!";
        let titleColor = "var(--text)";

        if (data.mode === 'multi_vs') {
            if (localPlayer.isTie) {
                perfText = "IT'S A TIE!";
                perfColor = "#F1C40F"; // Yellow
                titleText = "<i class=\"bi bi-dash-circle\"></i> IT'S A TIE!";
                titleColor = "#F1C40F";
            } else if (localPlayer.won) {
                perfText = "YOU WIN!";
                perfColor = "var(--secondary)";
                titleText = "<i class=\"bi bi-trophy-fill\"></i> YOU WIN!";
                titleColor = "var(--secondary)";
            } else {
                perfText = "YOU LOSE!";
                perfColor = "var(--danger)";
                titleText = "<i class=\"bi bi-emoji-dizzy-fill\"></i> YOU LOSE!";
                titleColor = "var(--danger)";
            }
        } else {
            if (data.score > 0) {
                perfText = "Good Job";
                perfColor = "var(--accent)";
            }
            if (data.score >= 100) {
                perfText = "Very Good";
                perfColor = "var(--secondary)";
            }
            if (data.score >= 200) {
                perfText = "Excellent!";
                perfColor = "#A8E6CF"; // Mint green
            }
        }

        if (titleEl) {
            titleEl.innerHTML = titleText;
            titleEl.style.color = titleColor;
        }

        performanceEl.innerHTML = `<span style="color: ${perfColor}; font-family: var(--font-display); font-size: 32px; letter-spacing: 2px;">${perfText}</span>`;
    }

    setupChat() {
        const container = document.getElementById('floating-chat-input');
        const input = document.getElementById('chat-input');
        const btn = document.getElementById('chat-send');

        const send = () => {
            const msg = input.value.trim();
            if (msg) {
                this.socket.emit('chatMessage', msg);
                input.value = '';
                if (container) container.classList.add('hidden');
            }
        };

        if (btn) btn.addEventListener('click', send);
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') send();
                if (e.key === 'Escape') {
                    if (container) container.classList.add('hidden');
                }
                e.stopPropagation(); // prevent game input
            });
        }
    }

    addChatMessage(data) {
        // Handled directly in game.js socket listener now for better performance/reliability
    }

    setupRecipeToggle() {
        const btn = document.getElementById('btn-recipe-toggle');
        const book = document.getElementById('recipe-book');
        btn.addEventListener('click', () => book.classList.toggle('hidden'));
    }
}
