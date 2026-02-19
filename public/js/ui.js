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
                ? `<br><i class="bi bi-scissors"></i> Chop: ${r.requiresChopping.map(i => this.config.INGREDIENTS[i]?.emoji || i).join(' ')}`
                : '';
            const rolls = r.requiresRolling && r.requiresRolling.length > 0
                ? `<br><i class="bi bi-arrow-repeat"></i> Roll: ${r.requiresRolling.map(i => this.config.INGREDIENTS[i]?.emoji || i).join(' ')}`
                : '';
            const cooks = r.requiresCooking && r.requiresCooking.length > 0
                ? `<br><i class="bi bi-fire"></i> Cook: ${r.requiresCooking.map(i => this.config.INGREDIENTS[i]?.emoji || i).join(' ')}`
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

            const now = Date.now();
            const total = order.expiresAt - order.createdAt;
            const remaining = Math.max(0, order.expiresAt - now);
            const pct = (remaining / total) * 100;
            if (pct < 30) card.classList.add('urgent');

            const ings = recipe.ingredients.map(i => config.INGREDIENTS[i]?.emoji || '').join('');
            card.innerHTML = `
                <span class="order-emoji">${recipe.emoji || '<i class="bi bi-egg-fried"></i>'}</span>
                <div class="order-name">${recipe.name}</div>
                <div class="order-ingredients">${ings}</div>
                <div class="order-timer-bar">
                    <div class="order-timer-fill ${pct < 30 ? 'low' : ''}" style="width:${pct}%"></div>
                </div>
                <div class="order-points"><i class="bi bi-star-fill"></i> +${order.points} pts</div>
            `;
            list.appendChild(card);
        });
    }

    updateOrderTimers(orders) {
        const now = Date.now();
        orders.forEach(order => {
            const card = document.getElementById(`order-${order.id}`);
            if (!card) return;
            const total = order.expiresAt - order.createdAt;
            const remaining = Math.max(0, order.expiresAt - now);
            const pct = (remaining / total) * 100;
            const fill = card.querySelector('.order-timer-fill');
            if (fill) {
                fill.style.width = `${pct}%`;
                if (pct < 30) {
                    fill.classList.add('low');
                    card.classList.add('urgent');
                }
            }
        });
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
            if (holding.chopped) status.push('<i class="bi bi-scissors"></i>');
            if (holding.cooked) status.push('<i class="bi bi-fire"></i>');
            el.innerHTML = `${ing?.emoji || '?'} ${ing?.name || holding.name} ${status.join('')}`;
            el.style.color = ing?.color || '#fff';
        } else if (holding.type === 'plate') {
            if (holding.ingredients.length === 0) {
                el.innerHTML = '<i class="bi bi-circle"></i> Empty Plate';
                el.style.color = '#f0f0f0';
            } else {
                const ings = holding.ingredients.map(i => config.INGREDIENTS[i]?.emoji || i).join('');
                el.innerHTML = `<i class="bi bi-circle-fill"></i> ${ings}`;
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

    showGameOver(data) {
        this.showScreen('gameover');
        document.getElementById('final-score').textContent = data.score;

        const stats = document.getElementById('gameover-stats');
        stats.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${data.ordersCompleted}</div>
                <div class="stat-label">Dishes Served</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.ordersFailed}</div>
                <div class="stat-label">Orders Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">x${data.maxCombo}</div>
                <div class="stat-label">Max Combo</div>
            </div>
        `;

        // Players
        const playersEl = document.getElementById('gameover-players');
        playersEl.innerHTML = data.players.map(p => `
            <div class="player-tag" style="border-color:${p.color};background:${p.color}22;margin:4px">
                <i class="bi bi-person-fill"></i> ${p.name}: ${p.score} pts (${p.dishesServed} dishes)
            </div>
        `).join('');

        // Star rating
        const stars = document.getElementById('star-rating');
        const numStars = data.score >= 200 ? 3 : data.score >= 100 ? 2 : data.score >= 40 ? 1 : 0;
        stars.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const span = document.createElement('span');
            span.className = `star ${i < numStars ? '' : 'star-empty'}`;
            span.innerHTML = '<i class="bi bi-star-fill"></i>';
            stars.appendChild(span);
        }
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
