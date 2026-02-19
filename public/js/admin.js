document.addEventListener('DOMContentLoaded', () => {
    let width = 7;
    let height = 7;
    let gridData = [];
    let currentTool = 'floor';
    let currentIngredient = 'tomato';
    const gridContainer = document.getElementById('grid-container');

    // --- RECIPE THEMES (EASY MODE) ---
    // User requested random crates instead of specific ones
    const INGREDIENTS = {
        random: { name: 'Random Crate', emoji: '❓' }
    };

    const mapTypeSelect = document.getElementById('map-type');
    // const themeGroup = document.getElementById('recipe-theme-group'); // Hidden/Removed
    // const themeSelect = document.getElementById('recipe-theme');
    const ingredientSelect = document.getElementById('ingredient-select');

    mapTypeSelect.addEventListener('change', updateUIState); // Re-enabled

    function updateUIState() {
        const type = mapTypeSelect.value;
        const p1Btn = document.querySelector('button[data-type="spawn_1"]');
        const p2Btn = document.querySelector('button[data-type="spawn_2"]');
        const p3Btn = document.querySelector('button[data-type="spawn_3"]');

        // Reset
        if (p1Btn) { p1Btn.disabled = false; p1Btn.style.opacity = 1; }
        if (p2Btn) { p2Btn.disabled = false; p2Btn.style.opacity = 1; }
        if (p3Btn) { p3Btn.disabled = false; p3Btn.style.opacity = 1; }

        // Logic based on User Request:
        // "disabled p2 and p3 if single player (Easy)"
        // "p2 only if vs game (Hard/VS)"
        // "multi can p3 (Multi Coop)"

        if (type === 'easy') {
            // Single Player -> Only P1
            if (p2Btn) { p2Btn.disabled = true; p2Btn.style.opacity = 0.5; }
            if (p3Btn) { p3Btn.disabled = true; p3Btn.style.opacity = 0.5; }
        } else if (type === 'hard') {
            // VS capable -> P1 & P2
            if (p3Btn) { p3Btn.disabled = true; p3Btn.style.opacity = 0.5; }
        }
        // multi_coop -> All 3 enabled
    }

    function renderIngredientOptions() {
        ingredientSelect.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = 'random';
        opt.innerText = 'Random Crate ❓';
        ingredientSelect.appendChild(opt);

        ingredientSelect.selectedIndex = 0;
        currentIngredient = 'random';
    }

    // Initialize UI on load
    renderIngredientOptions();
    if (document.getElementById('recipe-theme-group')) {
        document.getElementById('recipe-theme-group').style.display = 'none';
    }
    updateUIState(); // Run check on load

    // Initialize tools
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.id === 'load-btn' || btn.id === 'save-btn' || btn.id === 'resize-btn') return;
            toolBtns.forEach(b => b.classList.remove('active'));
            // Remove active from crate button too if clicked directly
            btn.classList.add('active');

            if (btn.dataset.type === 'crate') {
                currentTool = 'crate';
                currentIngredient = document.getElementById('ingredient-select').value;
            } else {
                currentTool = btn.dataset.type;
            }
        });
    });

    document.getElementById('ingredient-select').addEventListener('change', (e) => {
        currentIngredient = e.target.value;
        if (currentTool === 'crate') {
            // update selection maybe?
        }
    });

    document.getElementById('save-btn').addEventListener('click', saveMap);
    // document.getElementById('load-btn').addEventListener('click', loadMap); // Removed
    document.getElementById('resize-btn').addEventListener('click', resizeGrid);

    // Map Management Modal
    const manageBtn = document.getElementById('manage-maps-btn');
    const modal = document.getElementById('maps-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const mapsList = document.getElementById('maps-list');

    manageBtn.addEventListener('click', openMapsModal);
    closeBtn.addEventListener('click', () => modal.style.display = 'none');

    function openMapsModal() {
        modal.style.display = 'block';
        fetchMaps();
    }

    async function fetchMaps() {
        mapsList.innerHTML = '<div style="padding:10px; color:white;">Loading...</div>';
        try {
            const res = await fetch('/api/list-maps');
            if (res.ok) {
                const maps = await res.json();
                renderMapsList(maps);
            } else {
                mapsList.innerHTML = '<div style="padding:10px; color:red;">Error fetching maps.</div>';
            }
        } catch (e) {
            console.error(e);
            mapsList.innerHTML = '<div style="padding:10px; color:red;">Network Error.</div>';
        }
    }

    function renderMapsList(maps) {
        mapsList.innerHTML = '';
        if (maps.length === 0) {
            mapsList.innerHTML = '<div style="padding:10px; color:#bdc3c7;">No saved maps found.</div>';
            return;
        }

        maps.forEach(mapName => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '8px';
            row.style.borderBottom = '1px solid #7f8c8d';
            row.style.background = '#2c3e50';

            const nameSpan = document.createElement('span');
            nameSpan.innerText = mapName;
            nameSpan.style.color = 'white';
            nameSpan.style.fontWeight = 'bold';

            const btnGroup = document.createElement('div');

            const loadBtn = document.createElement('button');
            loadBtn.innerText = '📂 Load';
            loadBtn.style.marginRight = '5px';
            loadBtn.style.background = '#27ae60';
            loadBtn.style.color = 'white';
            loadBtn.style.border = 'none';
            loadBtn.style.padding = '4px 8px';
            loadBtn.style.cursor = 'pointer';
            loadBtn.onclick = () => loadMap(mapName);

            const delBtn = document.createElement('button');
            delBtn.innerText = '🗑️';
            delBtn.style.background = '#c0392b';
            delBtn.style.color = 'white';
            delBtn.style.border = 'none';
            delBtn.style.padding = '4px 8px';
            delBtn.style.cursor = 'pointer';
            delBtn.onclick = () => deleteMap(mapName);

            btnGroup.appendChild(loadBtn);
            btnGroup.appendChild(delBtn);

            row.appendChild(nameSpan);
            row.appendChild(btnGroup);
            mapsList.appendChild(row);
        });
    }

    async function deleteMap(mapName) {
        if (!confirm(`Are you sure you want to delete "${mapName}"?`)) return;

        try {
            const res = await fetch(`/api/delete-map/${mapName}`, { method: 'DELETE' });
            if (res.ok) {
                fetchMaps(); // Refresh list
            } else {
                alert('Error deleting map');
            }
        } catch (e) {
            alert('Network Error');
        }
    }

    // Initial Render
    resizeGrid();

    function resizeGrid() {
        width = parseInt(document.getElementById('grid-w').value);
        height = parseInt(document.getElementById('grid-h').value);
        gridContainer.style.gridTemplateColumns = `repeat(${width}, 50px)`;
        gridContainer.style.gridTemplateRows = `repeat(${height}, 50px)`;

        // Reset grid data
        gridData = [];
        for (let z = 0; z < height; z++) {
            let row = [];
            for (let x = 0; x < width; x++) {
                row.push(0); // 0 = floor
            }
            gridData.push(row);
        }
        renderGrid();
    }

    function renderGrid() {
        gridContainer.innerHTML = '';
        for (let z = 0; z < height; z++) {
            for (let x = 0; x < width; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.z = z;

                const val = gridData[z][x];
                updateCellVisual(cell, val);

                cell.addEventListener('mousedown', () => paint(x, z));
                cell.addEventListener('mouseenter', (e) => {
                    if (e.buttons === 1) paint(x, z);
                });

                gridContainer.appendChild(cell);
            }
        }
    }

    function updateCellVisual(cell, val) {
        cell.innerText = '';
        cell.style.backgroundColor = '#ecf0f1'; // floor default

        if (val === 0) return;

        if (val.type === 'counter') {
            cell.style.backgroundColor = '#95a5a6';
        } else if (val.type === 'stove') {
            cell.style.backgroundColor = '#2c3e50';
            cell.innerText = '🔥';
        } else if (val.type === 'chopping') {
            cell.style.backgroundColor = '#d35400';
            cell.innerText = '🔪';
        } else if (val.type === 'sink') {
            cell.style.backgroundColor = '#3498db';
            cell.innerText = '🚰';
        } else if (val.type === 'plates') {
            cell.style.backgroundColor = '#bdc3c7';
            cell.innerText = '🍽️';
        } else if (val.type === 'serve') {
            cell.style.backgroundColor = '#f39c12';
            cell.innerText = '🛎️';
        } else if (val.type === 'trash') {
            cell.style.backgroundColor = '#c0392b';
            cell.innerText = '🗑️';
        } else if (val.type === 'crate') {
            cell.style.backgroundColor = '#8e44ad';
            cell.innerText = '📦❓';
        } else if (val.type.startsWith('spawn_')) {
            cell.style.backgroundColor = '#ecf0f1';
            cell.style.border = '2px dashed #2980b9';
            cell.style.color = '#2980b9';
            const num = val.type.split('_')[1];
            cell.innerText = `P${num}`;
        }
    }

    function paint(x, z) {
        if (currentTool === 'floor') {
            gridData[z][x] = 0;
        } else {
            const id = `item_${x}_${z}_${Date.now()}`;
            const obj = { type: currentTool, id: id };
            if (currentTool === 'crate') {
                obj.ingredient = currentIngredient;
            }
            gridData[z][x] = obj;
        }
        // Specific update without re-render all for performance
        // Actually, just re-render is fine for this scale
        // Or find the specific cell
        const children = gridContainer.children;
        const idx = z * width + x;
        if (children[idx]) {
            updateCellVisual(children[idx], gridData[z][x]);
        }
    }

    async function saveMap() {
        const status = document.getElementById('save-status');

        // Validation - Called BEFORE fetch
        const errorMsg = validateMap();
        if (errorMsg) {
            status.innerText = `⚠️ ${errorMsg}`;
            status.style.color = '#e74c3c';
            return;
        }

        const mapName = document.getElementById('map-type').value;
        status.innerText = 'Saving...';
        status.style.color = '#f1c40f';

        try {
            const res = await fetch('/api/save-map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: mapName,
                    layout: gridData,
                    width,
                    height
                })
            });

            if (res.ok) {
                status.innerText = 'Saved successfully! 💾';
                status.style.color = '#2ecc71';
                setTimeout(() => status.innerText = '', 3000);
            } else {
                if (res.status === 404) {
                    status.innerText = '⚠️ API Not Found! RESTART SERVER.';
                } else {
                    status.innerText = `Error: ${res.statusText}`;
                }
                status.style.color = '#e74c3c';
            }
        } catch (e) {
            console.error(e);
            status.innerText = 'Network Error / Server Offline';
            status.style.color = '#e74c3c';
        }
    }

    function validateMap() {
        let hasCrate = false;
        let hasStove = false;
        let hasChop = false;
        let hasSink = false;
        let hasPlate = false;
        let hasServe = false;
        let hasP1 = false;
        let isEmpty = true;

        for (let z = 0; z < height; z++) {
            for (let x = 0; x < width; x++) {
                const cell = gridData[z][x];
                if (cell !== 0) {
                    isEmpty = false;
                    if (cell.type === 'crate') hasCrate = true;
                    if (cell.type === 'stove') hasStove = true;
                    if (cell.type === 'chopping') hasChop = true;
                    if (cell.type === 'sink') hasSink = true;
                    if (cell.type === 'plates') hasPlate = true;
                    if (cell.type === 'serve') hasServe = true;
                    if (cell.type === 'spawn_1') hasP1 = true;
                }
            }
        }

        if (isEmpty) return "Map is empty!";
        if (!hasP1) return "Missing Spawn Point (P1)!";
        if (!hasCrate) return "Missing Ingredients (Crate)!";
        if (!hasStove) return "Missing Stove!";
        if (!hasChop) return "Missing Chopping Board!";
        if (!hasSink) return "Missing Sink!";
        if (!hasPlate) return "Missing Plates!";
        if (!hasServe) return "Missing Serve Window!";

        return null; // Valid
    }

    async function loadMap(mapName) {
        // If mapName is passed (from list), use it. Else fetch from dropdown (legacy/fallback)
        if (!mapName || typeof mapName !== 'string') {
            mapName = document.getElementById('map-type').value;
        }

        const status = document.getElementById('save-status');
        status.innerText = 'Loading...';

        try {
            const res = await fetch(`/api/load-map/${mapName}`);

            if (res.ok) {
                const data = await res.json();
                if (data.layout) {
                    // Update Map Name Input to match if in list
                    const select = document.getElementById('map-type');
                    for (let i = 0; i < select.options.length; i++) {
                        if (select.options[i].value === mapName) {
                            select.selectedIndex = i;
                            break;
                        }
                    }

                    if (document.getElementById('maps-modal').style.display === 'block') {
                        document.getElementById('maps-modal').style.display = 'none'; // Close modal
                    }

                    width = data.width;
                    height = data.height;
                    document.getElementById('grid-w').value = width;
                    document.getElementById('grid-h').value = height;

                    gridData = data.layout;
                    // Resize container
                    gridContainer.style.gridTemplateColumns = `repeat(${width}, 50px)`;
                    gridContainer.style.gridTemplateRows = `repeat(${height}, 50px)`;
                    renderGrid();

                    status.innerText = `Loaded: ${mapName}`;
                    status.style.color = '#2ecc71';
                    setTimeout(() => status.innerText = '', 3000);

                    updateUIState();
                }
            } else {
                status.innerText = 'Map not found.';
            }
        } catch (e) {
            console.error(e);
            status.innerText = 'Error loading.';
        }
    }
});
