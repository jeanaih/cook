import * as THREE from 'three';

export class KitchenRenderer {
    constructor(scene, config, roomState) {
        console.warn('🔥 RENDERER V5.0: ULTRA-3D MODELS LOADED! 🔥');

        // --- CACHE BUSTER LABEL ---
        const label = document.createElement('div');
        label.style.position = 'fixed';
        label.style.top = '10px';
        label.style.left = '50%';
        label.style.transform = 'translateX(-50%)';
        label.style.background = 'rgba(255, 0, 0, 0.8)';
        label.style.color = 'white';
        label.style.padding = '5px 15px';
        label.style.borderRadius = '20px';
        label.style.fontWeight = 'bold';
        label.style.zIndex = '9999';
        label.innerHTML = '⚡️ 3D ENGINE V5.0: ULTRA DETAIL ACTIVE! ⚡️';
        document.body.appendChild(label);
        setTimeout(() => label.style.display = 'none', 5000);

        this.scene = scene;
        this.config = config;
        this.ts = config.TILE_SIZE;
        this.stationMeshes = {};
        this.stationEffects = {};
        this.currentHighlight = null;
        this.animTime = 0;
        this.layout = null; // Store layout for auto-rotation
        this.environmentGroup = new THREE.Group();
        this.scene.add(this.environmentGroup);

        // Light following properties
        this.playerGlowLight = null;
    }

    clear() {
        // Remove all kitchen meshes
        while (this.environmentGroup.children.length > 0) {
            this.environmentGroup.remove(this.environmentGroup.children[0]);
        }
        Object.values(this.stationMeshes).forEach(m => {
            this.scene.remove(m.group);
        });
        this.stationMeshes = {};
    }

    buildKitchen(layout, stations) {
        this.clear(); // Ensure clean slate
        this.layout = layout; // Store for auto-rotation

        // Random theme selection
        const theme = Math.random() < 0.5 ? 'rustic' : 'midnight';

        // Floating Floor Base (Thick Box)
        const totalW = this.config.GRID_W * this.ts;
        const totalH = this.config.GRID_H * this.ts;
        const thickness = 2.0;

        // --- PURPLE FLOOR (TO PROVE UPDATE IS LIVE) ---
        const baseGeo = new THREE.BoxGeometry(totalW + 2.5, thickness, totalH + 2.5);
        const baseColor = theme === 'rustic' ? 0xa0522d : 0x2c3e50;
        const baseMat = new THREE.MeshStandardMaterial({
            color: baseColor, roughness: 0.1, metalness: 0.2
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(totalW / 2 - this.ts / 2, -thickness / 2 - 0.05, totalH / 2 - this.ts / 2);
        base.receiveShadow = true;
        this.environmentGroup.add(base);

        // Sub-tiles for gloss
        const shinyFloorGeo = new THREE.PlaneGeometry(totalW + 2, totalH + 3);
        const floorColor = theme === 'rustic' ? 0x8b4513 : 0x34495e;
        const shinyFloorMat = new THREE.MeshStandardMaterial({
            color: floorColor, roughness: 0.0, metalness: 1.0, transparent: true, opacity: 0.2
        });
        const shinyFloor = new THREE.Mesh(shinyFloorGeo, shinyFloorMat);
        shinyFloor.rotation.x = -Math.PI / 2;
        shinyFloor.position.set(totalW / 2 - this.ts / 2, 0.005, totalH / 2 - this.ts / 2);
        this.environmentGroup.add(shinyFloor);

        // Walls
        const wallHeight = 2.5;
        const wallColor = theme === 'rustic' ? 0xfafafa : 0x2980b9;
        const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.05, metalness: 0.1 }); // Off-white or midnight blue

        // Back Wall
        const backGeo = new THREE.BoxGeometry(totalW + 2, wallHeight, 0.5);
        const backWall = new THREE.Mesh(backGeo, wallMat);
        backWall.position.set(totalW / 2 - this.ts / 2, wallHeight / 2, -this.ts / 2 - 1);
        backWall.receiveShadow = true;
        backWall.castShadow = true;
        this.environmentGroup.add(backWall);

        // Left Wall
        const leftGeo = new THREE.BoxGeometry(0.4, wallHeight, totalH + 2.5);
        const leftWall = new THREE.Mesh(leftGeo, wallMat);
        leftWall.position.set(-this.ts / 2 - 1 - 0.2, wallHeight / 2, totalH / 2 - this.ts / 2);
        leftWall.receiveShadow = true;
        leftWall.castShadow = true;
        this.environmentGroup.add(leftWall);

        // Right Wall
        const rightGeo = new THREE.BoxGeometry(0.4, wallHeight, totalH + 2.5);
        const rightWall = new THREE.Mesh(rightGeo, wallMat);
        rightWall.position.set(totalW - this.ts / 2 + 1 + 0.2, wallHeight / 2, totalH / 2 - this.ts / 2);
        rightWall.receiveShadow = true;
        rightWall.castShadow = true;
        this.environmentGroup.add(rightWall);

        // Wall Top Accents (Line Design)
        const accentColor = theme === 'rustic' ? 0x8b4513 : 0x34495e;
        const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.05, metalness: 0.1 });
        const accentHeight = 0.1;
        const accentDepth = 0.6;

        // Back wall accent
        const backAccentGeo = new THREE.BoxGeometry(totalW + 2, accentHeight, accentDepth);
        const backAccent = new THREE.Mesh(backAccentGeo, accentMat);
        backAccent.position.set(totalW / 2 - this.ts / 2, wallHeight + accentHeight / 2, -this.ts / 2 - 1);
        backAccent.receiveShadow = true;
        backAccent.castShadow = true;
        this.environmentGroup.add(backAccent);

        // Left wall accent
        const leftAccentGeo = new THREE.BoxGeometry(accentDepth, accentHeight, totalH + 2.5);
        const leftAccent = new THREE.Mesh(leftAccentGeo, accentMat);
        leftAccent.position.set(-this.ts / 2 - 1 - 0.2, wallHeight + accentHeight / 2, totalH / 2 - this.ts / 2);
        leftAccent.receiveShadow = true;
        leftAccent.castShadow = true;
        this.environmentGroup.add(leftAccent);

        // Right wall accent
        const rightAccentGeo = new THREE.BoxGeometry(accentDepth, accentHeight, totalH + 2.5);
        const rightAccent = new THREE.Mesh(rightAccentGeo, accentMat);
        rightAccent.position.set(totalW - this.ts / 2 + 1 + 0.2, wallHeight + accentHeight / 2, totalH / 2 - this.ts / 2);
        rightAccent.receiveShadow = true;
        rightAccent.castShadow = true;
        this.environmentGroup.add(rightAccent);


        // Baseboard details for subtle polish
        const baseboardMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.1, metalness: 0.2 });
        const baseboardHeight = 0.05;

        // Back baseboard
        const backBaseGeo = new THREE.BoxGeometry(totalW + 2, baseboardHeight, 0.02);
        const backBase = new THREE.Mesh(backBaseGeo, baseboardMat);
        backBase.position.set(totalW / 2 - this.ts / 2, baseboardHeight / 2, -this.ts / 2 - 1 - 0.21);
        this.environmentGroup.add(backBase);

        // Left baseboard
        const leftBaseGeo = new THREE.BoxGeometry(0.02, baseboardHeight, totalH + 2);
        const leftBase = new THREE.Mesh(leftBaseGeo, baseboardMat);
        leftBase.position.set(-this.ts / 2 - 1 - 0.21, baseboardHeight / 2, totalH / 2 - this.ts / 2);
        this.environmentGroup.add(leftBase);

        // Right baseboard
        const rightBaseGeo = new THREE.BoxGeometry(0.02, baseboardHeight, totalH + 2);
        const rightBase = new THREE.Mesh(rightBaseGeo, baseboardMat);
        rightBase.position.set(totalW - this.ts / 2 + 1 + 0.21, baseboardHeight / 2, totalH / 2 - this.ts / 2);
        this.environmentGroup.add(rightBase);

        // Tiles
        for (let z = 0; z < this.config.GRID_H; z++) {
            for (let x = 0; x < this.config.GRID_W; x++) {
                if (layout[z] && layout[z][x] === 0) {
                    const tGeo = new THREE.PlaneGeometry(this.ts * 0.98, this.ts * 0.98);
                    // Premium wood-like or dark pattern
                    const isEven = (x + z) % 2 === 0;
                    const shade = theme === 'rustic'
                        ? (isEven ? 0xd2b48c : 0x8b4513)
                        : (isEven ? 0x34495e : 0x2c3e50);
                    const tMat = new THREE.MeshStandardMaterial({
                        color: shade,
                        roughness: 0.05,
                        metalness: 0.1
                    });
                    const tile = new THREE.Mesh(tGeo, tMat);
                    tile.rotation.x = -Math.PI / 2;
                    tile.position.set(x * this.ts, 0.01, z * this.ts);
                    tile.receiveShadow = true;
                    this.environmentGroup.add(tile);
                }
            }
        }

        // Build stations
        Object.values(stations).forEach(st => this.buildStation(st));

        // Add dim ambient light for subtle darkness
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
    }

    buildStation(st) {
        const group = new THREE.Group();
        const x = st.gridX * this.ts;
        const z = st.gridZ * this.ts;
        const colors = {
            crate: 0xcd853f,      // Peru/Wood
            counter: 0x4a5568,    // Gray-Blue
            chopping: 0xd4a373,   // Wood Light
            stove: 0x2d3436,      // Dark Charcoal
            serve: 0x4a5568,      // Gray-Blue (Matching counters)
            trash: 0x228B22,      // Green (Nature Theme)
            plates: 0xfbfbfb,     // White
            sink: 0x3498db,       // Blue
            oven: 0x7f8c8d,       // Stone Gray
            roller: 0xd4a373,     // Wood
            seasoning: 0x34495e   // Charcoal Blue
        };
        const c = colors[st.type] || 0x7f8c8d;

        // Base box
        const baseH = 0.9; // All stations same height to match counters
        const isTrash = st.type === 'trash';

        // Determine if this crate ingredient is a cold item (freezer) or shelf item
        const isFreezerItem = st.type === 'crate' && (st.ingredient === 'meat' || st.ingredient === 'fish');
        const isRiceCrate = st.type === 'crate' && st.ingredient === 'rice';
        const isDoughCrate = st.type === 'crate' && st.ingredient === 'dough';
        const isBreadCrate = st.type === 'crate' && st.ingredient === 'bread';
        const isEggCrate = st.type === 'crate' && st.ingredient === 'egg';
        const isCheeseCrate = st.type === 'crate' && st.ingredient === 'cheese';

        // Ingredient-based counter colors (matching the ingredient's identity)
        const crateTileColors = {
            tomato: 0x7a2020, // deep red
            lettuce: 0x1a5c2e, // deep green
            meat: 0x5c2b0a, // dark brown
            cheese: 0x7a6200, // dark gold
            bread: 0x6b4c1e, // warm tan-brown
            dough: 0x7a7a72, // off-white/grey
            fish: 0x0a3d6b, // deep blue
            rice: 0x6b6b5a, // light taupe
            onion: 0x4a1a6b, // purple
            mushroom: 0x4a3c28, // dark earth
            egg: 0x6b5c30, // cream-brown
        };
        const crateCounterColor = (st.type === 'crate' && crateTileColors[st.ingredient]) ? crateTileColors[st.ingredient] : 0x2d3748;

        let mesh, top;
        if (st.type === 'crate' && isFreezerItem) {
            // ======================================
            // NEW CHEST FREEZER - CLEAN IMPLEMENTATION
            // ======================================
            const freezer = new THREE.Group();
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0xB0B0B0, roughness: 0.15, metalness: 0.9 });
            const fridgeH = baseH * 0.95;
            const sz = this.ts * 0.46;
            const th = 0.04;

            // Main freezer body - hollow chassis
            const createWall = (width, height, depth, x, y, z) => {
                const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
                wall.position.set(x, y, z);
                return wall;
            };

            // Exterior walls (NO TOP - it's open from above)
            freezer.add(createWall(sz * 2, fridgeH, th, 0, fridgeH / 2, sz * 0.9 - th / 2)); // front
            freezer.add(createWall(sz * 2, fridgeH, th, 0, fridgeH / 2, -sz * 0.9 + th / 2)); // back
            freezer.add(createWall(th, fridgeH, sz * 1.8, -sz + th / 2, fridgeH / 2, 0)); // left
            freezer.add(createWall(th, fridgeH, sz * 1.8, sz - th / 2, fridgeH / 2, 0)); // right
            freezer.add(createWall(sz * 2, th, sz * 1.8, 0, th / 2, 0)); // bottom only



            // Bright interior lining
            const linerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
            const floorLiner = new THREE.Mesh(new THREE.BoxGeometry(sz * 1.8, 0.01, sz * 1.6), linerMat);
            floorLiner.position.y = 0.05;
            freezer.add(floorLiner);

            const wallH = fridgeH * 0.85;
            freezer.add(createWall(sz * 1.8, wallH, 0.02, 0, fridgeH * 0.57, -sz * 0.78, linerMat)); // back inner
            freezer.add(createWall(sz * 1.8, wallH, 0.02, 0, fridgeH * 0.57, sz * 0.78, linerMat)); // front inner
            freezer.add(createWall(0.02, wallH, sz * 1.6, -sz * 0.88, fridgeH * 0.57, 0, linerMat)); // left inner
            freezer.add(createWall(0.02, wallH, sz * 1.6, sz * 0.88, fridgeH * 0.57, 0, linerMat)); // right inner

            // ======================================
            // FROZEN CONTENTS - ORGANIZED STORAGE
            // ======================================

            // MEAT SECTION (Left side)
            const meatSection = new THREE.Group();
            const meatMat = new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.5 });
            const wrapMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });

            // T-Bone steaks (detailed with bone)
            for (let i = 0; i < 2; i++) {
                const steakGroup = new THREE.Group();

                // Main meat body
                const meat = new THREE.Mesh(
                    new THREE.BoxGeometry(sz * 0.35, 0.06, sz * 0.25),
                    meatMat
                );
                steakGroup.add(meat);

                // T-bone (white bone detail)
                const boneMat = new THREE.MeshStandardMaterial({ color: 0xFFFAF0, roughness: 0.6 });
                const boneH = new THREE.Mesh(
                    new THREE.BoxGeometry(sz * 0.08, 0.065, sz * 0.04),
                    boneMat
                );
                boneH.position.set(sz * 0.1, 0, 0);
                steakGroup.add(boneH);

                const boneV = new THREE.Mesh(
                    new THREE.BoxGeometry(sz * 0.04, 0.065, sz * 0.15),
                    boneMat
                );
                boneV.position.set(sz * 0.1, 0, sz * 0.05);
                steakGroup.add(boneV);

                // Fat marbling (white streaks)
                for (let f = 0; f < 3; f++) {
                    const fat = new THREE.Mesh(
                        new THREE.BoxGeometry(sz * 0.15, 0.062, sz * 0.02),
                        new THREE.MeshStandardMaterial({ color: 0xFFE4E1, roughness: 0.7 })
                    );
                    fat.position.set(
                        (Math.random() - 0.5) * sz * 0.2,
                        0.001,
                        (Math.random() - 0.5) * sz * 0.15
                    );
                    fat.rotation.y = Math.random() * Math.PI;
                    steakGroup.add(fat);
                }

                // Plastic wrap
                const wrap = new THREE.Mesh(
                    new THREE.BoxGeometry(sz * 0.38, 0.08, sz * 0.28),
                    wrapMat
                );
                steakGroup.add(wrap);

                steakGroup.position.set(-sz * 0.2, 0.1 + i * 0.08, (i - 0.5) * 0.15);
                steakGroup.rotation.y = (Math.random() - 0.5) * 0.3;
                meatSection.add(steakGroup);
            }

            // Ground meat packages (vacuum sealed)
            for (let i = 0; i < 2; i++) {
                const pkgGroup = new THREE.Group();

                const pkg = new THREE.Mesh(
                    new THREE.BoxGeometry(sz * 0.4, 0.06, sz * 0.3),
                    new THREE.MeshStandardMaterial({ color: 0xA52A2A, roughness: 0.6 })
                );
                pkgGroup.add(pkg);

                // Vacuum seal texture (tight wrap)
                const seal = new THREE.Mesh(
                    new THREE.BoxGeometry(sz * 0.42, 0.065, sz * 0.32),
                    new THREE.MeshStandardMaterial({
                        color: 0xFFFFFF,
                        transparent: true,
                        opacity: 0.3,
                        roughness: 0.1,
                        metalness: 0.2
                    })
                );
                pkgGroup.add(seal);

                // Label sticker
                const label = new THREE.Mesh(
                    new THREE.PlaneGeometry(sz * 0.25, sz * 0.08),
                    new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.3 })
                );
                label.rotation.x = -Math.PI / 2;
                label.position.y = 0.035;
                pkgGroup.add(label);

                pkgGroup.position.set(sz * 0.15, 0.25 + i * 0.08, (i - 0.5) * 0.12);
                pkgGroup.rotation.y = (Math.random() - 0.5) * 0.4;
                meatSection.add(pkgGroup);
            }

            meatSection.position.set(-sz * 0.15, fridgeH * 0.2, 0);
            freezer.add(meatSection);

            // FISH SECTION (Right side)
            const fishSection = new THREE.Group();
            const fishMat = new THREE.MeshStandardMaterial({
                color: 0xFA8072,
                metalness: 0.3,
                roughness: 0.4
            });
            const fishSilverMat = new THREE.MeshStandardMaterial({
                color: 0xC0C0C0,
                metalness: 0.7,
                roughness: 0.2
            });

            // Whole fish (detailed with fins and tail)
            for (let i = 0; i < 2; i++) {
                const fishGroup = new THREE.Group();

                // Fish body
                const body = new THREE.Mesh(
                    new THREE.SphereGeometry(0.08, 16, 12),
                    fishMat
                );
                body.scale.set(1.8, 0.6, 0.5);
                fishGroup.add(body);

                // Fish tail (V-shape)
                const tailUpper = new THREE.Mesh(
                    new THREE.ConeGeometry(0.06, 0.15, 3),
                    fishMat
                );
                tailUpper.rotation.z = -Math.PI / 1.5;
                tailUpper.position.set(0.18, 0.04, 0);
                fishGroup.add(tailUpper);

                const tailLower = new THREE.Mesh(
                    new THREE.ConeGeometry(0.06, 0.15, 3),
                    fishMat
                );
                tailLower.rotation.z = -Math.PI / 3;
                tailLower.position.set(0.18, -0.04, 0);
                fishGroup.add(tailLower);

                // Dorsal fin
                const dorsalFin = new THREE.Mesh(
                    new THREE.ConeGeometry(0.04, 0.08, 3),
                    fishMat
                );
                dorsalFin.rotation.z = Math.PI / 4;
                dorsalFin.position.set(0, 0.08, 0);
                fishGroup.add(dorsalFin);

                // Eye
                const eye = new THREE.Mesh(
                    new THREE.SphereGeometry(0.015, 8, 8),
                    new THREE.MeshBasicMaterial({ color: 0x000000 })
                );
                eye.position.set(-0.12, 0.03, 0.03);
                fishGroup.add(eye);

                // Silver scales effect
                for (let s = 0; s < 5; s++) {
                    const scale = new THREE.Mesh(
                        new THREE.CircleGeometry(0.02, 8),
                        fishSilverMat
                    );
                    scale.position.set(
                        -0.05 + s * 0.04,
                        (Math.random() - 0.5) * 0.06,
                        0.04
                    );
                    scale.rotation.y = Math.PI / 2;
                    fishGroup.add(scale);
                }

                // Ice crystals on fish
                const iceMat = new THREE.MeshStandardMaterial({
                    color: 0xD4F1F9,
                    transparent: true,
                    opacity: 0.6
                });
                for (let ic = 0; ic < 3; ic++) {
                    const ice = new THREE.Mesh(
                        new THREE.BoxGeometry(0.03, 0.02, 0.03),
                        iceMat
                    );
                    ice.position.set(
                        (Math.random() - 0.5) * 0.2,
                        (Math.random() - 0.5) * 0.08,
                        (Math.random() - 0.5) * 0.06
                    );
                    ice.rotation.set(
                        Math.random() * Math.PI,
                        Math.random() * Math.PI,
                        Math.random() * Math.PI
                    );
                    fishGroup.add(ice);
                }

                fishGroup.rotation.set(
                    (Math.random() - 0.5) * 0.3,
                    Math.random() * Math.PI * 2,
                    (Math.random() - 0.5) * 0.3
                );
                fishGroup.position.set(
                    sz * 0.25,
                    fridgeH * 0.35 + i * 0.12,
                    (i - 0.5) * 0.2
                );
                fishSection.add(fishGroup);
            }

            // Salmon fillets (pink with white fat lines)
            for (let i = 0; i < 3; i++) {
                const filletGroup = new THREE.Group();

                const fillet = new THREE.Mesh(
                    new THREE.BoxGeometry(0.25, 0.04, 0.15),
                    new THREE.MeshStandardMaterial({
                        color: 0xFA8072,
                        roughness: 0.4,
                        metalness: 0.1
                    })
                );
                filletGroup.add(fillet);

                // White fat lines (marbling)
                for (let fl = 0; fl < 2; fl++) {
                    const fatLine = new THREE.Mesh(
                        new THREE.BoxGeometry(0.2, 0.042, 0.01),
                        new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
                    );
                    fatLine.position.set(0, 0.001, (fl - 0.5) * 0.06);
                    fatLine.rotation.y = (Math.random() - 0.5) * 0.2;
                    filletGroup.add(fatLine);
                }

                // Plastic wrap
                const wrap = new THREE.Mesh(
                    new THREE.BoxGeometry(0.27, 0.045, 0.17),
                    new THREE.MeshStandardMaterial({
                        color: 0xFFFFFF,
                        transparent: true,
                        opacity: 0.3,
                        roughness: 0.1
                    })
                );
                filletGroup.add(wrap);

                filletGroup.position.set(
                    sz * 0.3,
                    fridgeH * 0.2 + i * 0.06,
                    (i - 1) * 0.15
                );
                filletGroup.rotation.y = (Math.random() - 0.5) * 0.4;
                fishSection.add(filletGroup);
            }

            freezer.add(fishSection);

            // VEGETABLE SECTION (Back area)
            const vegSection = new THREE.Group();
            const vegMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.6 });
            const vegWrapMat = new THREE.MeshStandardMaterial({ color: 0x90ee90, transparent: true, opacity: 0.7 });

            for (let i = 0; i < 3; i++) {
                const vegBag = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.4, 0.12, sz * 0.25), vegMat);
                vegBag.position.set(0, i * 0.13, -sz * 0.3);
                vegBag.rotation.y = 0.1;
                vegSection.add(vegBag);

                const bagWrap = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.42, 0.14, sz * 0.27), vegWrapMat);
                bagWrap.position.copy(vegBag.position);
                bagWrap.rotation.copy(vegBag.rotation);
                vegSection.add(bagWrap);
            }

            vegSection.position.set(0, fridgeH * 0.35, 0);
            freezer.add(vegSection);

            // TREATS SECTION (Top area)
            const treatSection = new THREE.Group();
            const iceCreamMat = new THREE.MeshStandardMaterial({ color: 0xffdab9, roughness: 0.3 });

            for (let i = 0; i < 2; i++) {
                const container = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 8), iceCreamMat);
                container.position.set((i - 0.5) * 0.25, fridgeH * 0.75 + i * 0.05, sz * 0.2);
                container.rotation.x = Math.PI / 6;
                treatSection.add(container);

                const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.20, 8), wrapMat);
                wrap.position.copy(container.position);
                wrap.rotation.copy(container.rotation);
                treatSection.add(wrap);
            }

            freezer.add(treatSection);

            // ICE FORMATIONS
            const iceMat = new THREE.MeshStandardMaterial({
                color: 0xdff9fb, transparent: true, opacity: 0.7,
                emissive: 0xb3f0ff, emissiveIntensity: 0.3, roughness: 0.1
            });
            const frostMat = new THREE.MeshStandardMaterial({
                color: 0xe6f7ff, transparent: true, opacity: 0.4,
                emissive: 0xdff9fb, emissiveIntensity: 0.2
            });

            // Ice chunks
            for (let i = 0; i < 3; i++) {
                const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08 + Math.random() * 0.06, 0), iceMat);
                chunk.position.set(
                    (Math.random() - 0.5) * sz * 1.3,
                    fridgeH * 0.15 + Math.random() * 0.1,
                    (Math.random() - 0.5) * sz * 1.0
                );
                chunk.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                chunk.scale.set(1, 0.7 + Math.random() * 0.6, 1);
                freezer.add(chunk);
            }

            // Ice cubes
            for (let i = 0; i < 6; i++) {
                const cube = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), iceMat);
                cube.position.set(
                    (Math.random() - 0.5) * sz * 1.4,
                    fridgeH * 0.12,
                    (Math.random() - 0.5) * sz * 1.1
                );
                cube.rotation.set(Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5);
                freezer.add(cube);
            }

            // Frost crystals on walls
            for (let i = 0; i < 8; i++) {
                const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.04, 6), frostMat);
                const side = Math.floor(Math.random() * 4);
                switch (side) {
                    case 0: crystal.position.set(-sz * 0.85, fridgeH * (0.3 + Math.random() * 0.5), (Math.random() - 0.5) * sz * 1.4); crystal.rotation.set(Math.PI / 2, 0, Math.PI / 2); break;
                    case 1: crystal.position.set(sz * 0.85, fridgeH * (0.3 + Math.random() * 0.5), (Math.random() - 0.5) * sz * 1.4); crystal.rotation.set(Math.PI / 2, 0, -Math.PI / 2); break;
                    case 2: crystal.position.set((Math.random() - 0.5) * sz * 1.6, fridgeH * (0.3 + Math.random() * 0.5), sz * 0.75); crystal.rotation.set(Math.PI / 2, 0, 0); break;
                    case 3: crystal.position.set((Math.random() - 0.5) * sz * 1.6, fridgeH * (0.3 + Math.random() * 0.5), -sz * 0.75); crystal.rotation.set(-Math.PI / 2, 0, 0); break;
                }
                freezer.add(crystal);
            }

            // Icicles
            for (let i = 0; i < 4; i++) {
                const icicle = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.08 + Math.random() * 0.06, 5), iceMat);
                icicle.position.set(
                    (Math.random() - 0.5) * sz * 1.2,
                    fridgeH - 0.04 - Math.random() * 0.05,
                    (Math.random() - 0.5) * sz * 0.8
                );
                icicle.rotation.x = Math.PI;
                freezer.add(icicle);
            }

            // Frost shimmer
            const shimmer = new THREE.Mesh(new THREE.BoxGeometry(sz * 1.85, 0.05, sz * 1.65),
                new THREE.MeshBasicMaterial({ color: 0xb3f0ff, transparent: true, opacity: 0.15 }));
            shimmer.position.y = fridgeH * 0.95;
            freezer.add(shimmer);

            // ======================================
            // LID WITH GLASS (Positioned on TOP, pivots at BACK edge)
            // ======================================
            const lid = new THREE.Group();
            lid.name = 'freezerDoor';
            lid.position.set(0, fridgeH, -sz * 0.8); // Pivot at back edge

            const frameW = 0.12;
            const frameMat = bodyMat;

            // Frame around the glass lid (adjusted for pivot at back)
            lid.add(createWall(sz * 2, 0.08, frameW, 0, 0.04, 0, frameMat)); // back frame (at pivot)
            lid.add(createWall(sz * 2, 0.08, frameW, 0, 0.04, sz * 1.6, frameMat)); // front frame
            lid.add(createWall(frameW, 0.08, sz * 1.6, -sz + frameW / 2, 0.04, sz * 0.8, frameMat)); // left frame
            lid.add(createWall(frameW, 0.08, sz * 1.6, sz - frameW / 2, 0.04, sz * 0.8, frameMat)); // right frame

            // Glass panel (clear view into freezer)
            const glassMat = new THREE.MeshStandardMaterial({
                color: 0xccf2ff,
                transparent: true,
                opacity: 0.25,
                roughness: 0.05,
                metalness: 0.5,
                side: THREE.DoubleSide
            });
            const glass = new THREE.Mesh(new THREE.PlaneGeometry(sz * 1.76, sz * 1.48), glassMat);
            glass.rotation.x = -Math.PI / 2;
            glass.position.set(0, 0.041, sz * 0.8); // Adjusted for pivot
            lid.add(glass);

            // Handle (chrome bar across the front)
            const handleMat = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.95, roughness: 0.05 });
            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, sz * 1.4, 16), handleMat);
            handle.rotation.z = Math.PI / 2;
            handle.position.set(0, 0.09, sz * 1.55); // At front edge
            lid.add(handle);

            // --- LARGE INGREDIENT ICON STICKER on freezer lid ---
            const ing = this.config.INGREDIENTS[st.ingredient];
            if (ing && ing.emoji) {
                // Create a canvas for the emoji icon
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 256;
                const ctx = canvas.getContext('2d');

                // White circular background
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(128, 128, 110, 0, Math.PI * 2);
                ctx.fill();

                // Border (metallic silver for freezer)
                ctx.strokeStyle = '#C0C0C0';
                ctx.lineWidth = 8;
                ctx.stroke();

                // Draw emoji
                ctx.font = 'bold 140px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(ing.emoji, 128, 140);

                // Create texture and material
                const texture = new THREE.CanvasTexture(canvas);
                texture.needsUpdate = true;
                const stickerMat = new THREE.MeshStandardMaterial({
                    map: texture,
                    transparent: true,
                    roughness: 0.3,
                    metalness: 0.2
                });

                // Create sticker mesh (circular)
                const stickerSize = sz * 0.5;
                const sticker = new THREE.Mesh(
                    new THREE.CircleGeometry(stickerSize, 32),
                    stickerMat
                );
                sticker.position.set(0, 0.085, sz * 0.8); // Center of lid
                sticker.rotation.x = -Math.PI / 2;
                lid.add(sticker);
            }

            freezer.add(lid);

            // Interior light
            const light = new THREE.PointLight(0xdff9fb, 0, 3);
            light.position.set(0, fridgeH * 0.85, 0);
            freezer.add(light);

            mesh = freezer;
            group.add(freezer);
            top = null;

            // Store for animation
            this.stationEffects[st.id] = {
                door: lid,
                light: light,
                doorOpen: false,
                doorAngle: 0
            };

        } else if (st.type === 'crate' && !isRiceCrate && !isDoughCrate && !isBreadCrate && !isEggCrate && !isCheeseCrate) {
            // ======================================
            // WOODEN CRATE WITH TOP DOOR (Overcooked style) - HOLLOW WITH ANIMATION
            // ======================================
            const crateGroup = new THREE.Group();

            // Ingredient-specific bright colors
            const crateColors = {
                tomato: { wood: 0xE74C3C, dark: 0xC0392B, plank: 0xD43D2F }, // Bright red
                lettuce: { wood: 0x27AE60, dark: 0x1E8449, plank: 0x229954 }, // Bright green
                onion: { wood: 0xF5DEB3, dark: 0xD2B48C, plank: 0xE3C9A0 }, // Wheat/beige
                mushroom: { wood: 0xE8B4B8, dark: 0xD89CA0, plank: 0xE0A8AC }  // Light pink
            };

            const colors = crateColors[st.ingredient] || { wood: 0xA0724A, dark: 0x7B5B3A, plank: 0x8B6F47 };

            // Wooden crate materials with ingredient-specific colors
            const woodMat = new THREE.MeshStandardMaterial({ color: colors.wood, roughness: 0.85 });
            const darkWoodMat = new THREE.MeshStandardMaterial({ color: colors.dark, roughness: 0.9 });
            const plankMat = new THREE.MeshStandardMaterial({ color: colors.plank, roughness: 0.9 });

            const crateW = this.ts * 0.85;
            const crateH = 0.9; // Match counter height
            const crateD = this.ts * 0.85;
            const plankThickness = 0.04;

            // Helper function to create walls
            const createWall = (width, height, depth, x, y, z, material = woodMat) => {
                const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
                wall.position.set(x, y, z);
                wall.castShadow = true;
                wall.receiveShadow = true;
                return wall;
            };

            // --- HOLLOW CRATE BODY (NO TOP - open from above) ---
            // Bottom
            crateGroup.add(createWall(crateW, plankThickness, crateD, 0, plankThickness / 2, 0, darkWoodMat));

            // Walls (hollow construction)
            const wallH = crateH - plankThickness;
            crateGroup.add(createWall(crateW, wallH, plankThickness, 0, crateH / 2, crateD / 2 - plankThickness / 2, woodMat)); // front
            crateGroup.add(createWall(crateW, wallH, plankThickness, 0, crateH / 2, -crateD / 2 + plankThickness / 2, woodMat)); // back
            crateGroup.add(createWall(plankThickness, wallH, crateD - plankThickness * 2, -crateW / 2 + plankThickness / 2, crateH / 2, 0, woodMat)); // left
            crateGroup.add(createWall(plankThickness, wallH, crateD - plankThickness * 2, crateW / 2 - plankThickness / 2, crateH / 2, 0, woodMat)); // right

            // Decorative slats on exterior (vertical planks with gaps)
            const slatsPerSide = 5;
            const slotWidth = crateW / slatsPerSide;

            // Front and back decorative slats
            for (let i = 0; i < slatsPerSide; i++) {
                // Front
                const frontSlat = new THREE.Mesh(
                    new THREE.BoxGeometry(slotWidth * 0.65, wallH * 0.9, plankThickness * 0.3),
                    i % 2 === 0 ? plankMat : darkWoodMat
                );
                frontSlat.position.set(
                    -crateW / 2 + slotWidth * (i + 0.5),
                    crateH / 2,
                    crateD / 2 + plankThickness * 0.15
                );
                frontSlat.castShadow = true;
                crateGroup.add(frontSlat);

                // Back
                const backSlat = frontSlat.clone();
                backSlat.position.z = -crateD / 2 - plankThickness * 0.15;
                crateGroup.add(backSlat);
            }

            // Left and right decorative slats
            for (let i = 0; i < slatsPerSide; i++) {
                // Left
                const leftSlat = new THREE.Mesh(
                    new THREE.BoxGeometry(plankThickness * 0.3, wallH * 0.9, slotWidth * 0.65),
                    i % 2 === 0 ? plankMat : darkWoodMat
                );
                leftSlat.position.set(
                    -crateW / 2 - plankThickness * 0.15,
                    crateH / 2,
                    -crateD / 2 + slotWidth * (i + 0.5)
                );
                leftSlat.castShadow = true;
                crateGroup.add(leftSlat);

                // Right
                const rightSlat = leftSlat.clone();
                rightSlat.position.x = crateW / 2 + plankThickness * 0.15;
                crateGroup.add(rightSlat);
            }

            // Corner posts for structure
            const postGeo = new THREE.BoxGeometry(plankThickness * 1.8, crateH, plankThickness * 1.8);
            [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([cx, cz]) => {
                const post = new THREE.Mesh(postGeo, darkWoodMat);
                post.position.set(
                    cx * (crateW / 2 - plankThickness * 0.9),
                    crateH / 2,
                    cz * (crateD / 2 - plankThickness * 0.9)
                );
                post.castShadow = true;
                crateGroup.add(post);
            });

            // --- INTERIOR LINING (lighter wood inside) ---
            const interiorMat = new THREE.MeshStandardMaterial({ color: 0xD4A574, roughness: 0.7 });
            const interiorH = wallH * 0.85;
            crateGroup.add(createWall(crateW * 0.92, 0.01, crateD * 0.92, 0, plankThickness + 0.005, 0, interiorMat)); // floor
            crateGroup.add(createWall(crateW * 0.88, interiorH, 0.02, 0, crateH * 0.55, -crateD * 0.44, interiorMat)); // back inner
            crateGroup.add(createWall(crateW * 0.88, interiorH, 0.02, 0, crateH * 0.55, crateD * 0.44, interiorMat)); // front inner
            crateGroup.add(createWall(0.02, interiorH, crateD * 0.88, -crateW * 0.44, crateH * 0.55, 0, interiorMat)); // left inner
            crateGroup.add(createWall(0.02, interiorH, crateD * 0.88, crateW * 0.44, crateH * 0.55, 0, interiorMat)); // right inner

            // --- TOP DOOR (hinged at BACK edge, pivots forward) ---
            const doorGroup = new THREE.Group();
            doorGroup.name = 'crateDoor';
            doorGroup.position.set(0, crateH, -crateD * 0.42); // Pivot at back edge

            // Door frame (thick border)
            const frameThickness = 0.08;
            doorGroup.add(createWall(crateW, frameThickness, plankThickness * 2, 0, frameThickness / 2, 0, darkWoodMat)); // back (at pivot)
            doorGroup.add(createWall(crateW, frameThickness, plankThickness * 2, 0, frameThickness / 2, crateD * 0.84, darkWoodMat)); // front
            doorGroup.add(createWall(plankThickness * 2, frameThickness, crateD * 0.84, -crateW / 2 + plankThickness, frameThickness / 2, crateD * 0.42, darkWoodMat)); // left
            doorGroup.add(createWall(plankThickness * 2, frameThickness, crateD * 0.84, crateW / 2 - plankThickness, frameThickness / 2, crateD * 0.42, darkWoodMat)); // right

            // Door planks (horizontal slats)
            const doorPlanks = 5;
            for (let i = 0; i < doorPlanks; i++) {
                const plank = new THREE.Mesh(
                    new THREE.BoxGeometry(crateW * 0.88, frameThickness * 0.7, crateD * 0.15),
                    i % 2 === 0 ? woodMat : plankMat
                );
                plank.position.set(0, frameThickness / 2, crateD * 0.1 + (crateD * 0.64 / (doorPlanks - 1)) * i);
                plank.castShadow = true;
                doorGroup.add(plank);
            }

            // Metal hinges (at back)
            const hingeMat = new THREE.MeshStandardMaterial({
                color: 0x444444,
                roughness: 0.4,
                metalness: 0.8
            });
            [-0.28, 0.28].forEach(xPos => {
                const hinge = new THREE.Mesh(
                    new THREE.BoxGeometry(0.1, frameThickness * 1.3, 0.08),
                    hingeMat
                );
                hinge.position.set(xPos * crateW, frameThickness / 2, -plankThickness);
                hinge.castShadow = true;
                doorGroup.add(hinge);
            });

            // Handle (metal bar at front)
            const handleMat = new THREE.MeshStandardMaterial({
                color: 0x666666,
                metalness: 0.85,
                roughness: 0.15
            });
            const handle = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.02, crateW * 0.6, 12),
                handleMat
            );
            handle.rotation.z = Math.PI / 2;
            handle.position.set(0, frameThickness + 0.03, crateD * 0.82);
            handle.castShadow = true;
            doorGroup.add(handle);

            // --- LARGE INGREDIENT ICON STICKER on door ---
            const ing = this.config.INGREDIENTS[st.ingredient];
            if (ing && ing.emoji) {
                // Create a canvas for the emoji icon
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 256;
                const ctx = canvas.getContext('2d');

                // White circular background
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(128, 128, 110, 0, Math.PI * 2);
                ctx.fill();

                // Border
                ctx.strokeStyle = '#8B6F47';
                ctx.lineWidth = 8;
                ctx.stroke();

                // Draw emoji
                ctx.font = 'bold 140px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(ing.emoji, 128, 140);

                // Create texture and material
                const texture = new THREE.CanvasTexture(canvas);
                texture.needsUpdate = true;
                const stickerMat = new THREE.MeshStandardMaterial({
                    map: texture,
                    transparent: true,
                    roughness: 0.6,
                    metalness: 0.1
                });

                // Create sticker mesh (circular)
                const stickerSize = crateW * 0.35;
                const sticker = new THREE.Mesh(
                    new THREE.CircleGeometry(stickerSize, 32),
                    stickerMat
                );
                sticker.position.set(0, frameThickness + 0.01, crateD * 0.45);
                sticker.rotation.x = -Math.PI / 2;
                doorGroup.add(sticker);
            }

            crateGroup.add(doorGroup);

            // Interior light (subtle glow when open)
            const ingredientColor = {
                tomato: 0xFF6347,
                lettuce: 0x90EE90,
                onion: 0xF5DEB3,
                mushroom: 0xD2B48C
            }[st.ingredient] || 0xFFFFFF;

            const light = new THREE.PointLight(ingredientColor, 0, 2);
            light.position.set(0, crateH * 0.8, 0);
            crateGroup.add(light);

            mesh = crateGroup;
            group.add(crateGroup);
            top = null;

            // Store for animation (same pattern as freezer)
            this.stationEffects[st.id] = {
                door: doorGroup,
                light: light,
                doorOpen: false,
                doorAngle: 0
            };

        } else if (isCheeseCrate || isRiceCrate || isDoughCrate || isBreadCrate || isEggCrate) {
            // ======================================
            // WOODEN CRATE WITH TOP DOOR (for all special ingredients)
            // ======================================
            const crateGroup = new THREE.Group();

            // Ingredient-specific wood colors (bright and distinct)
            const crateColors = {
                rice: { wood: 0xFFFAF0, dark: 0xF5F5DC, plank: 0xFFF8E7 }, // Bright white/cream
                dough: { wood: 0xF5DEB3, dark: 0xD2B48C, plank: 0xE3C9A0 }, // Wheat
                bread: { wood: 0xD2691E, dark: 0xA0522D, plank: 0xB8621F }, // Chocolate/brown
                egg: { wood: 0xFFFACD, dark: 0xFFEFD5, plank: 0xFFF5E1 }, // Lemon chiffon
                cheese: { wood: 0xFFD700, dark: 0xDAA520, plank: 0xF0C040 }  // Gold/yellow
            };

            const colors = crateColors[st.ingredient] || crateColors.tomato;

            // Wooden crate materials with ingredient-specific colors
            const woodMat = new THREE.MeshStandardMaterial({ color: colors.wood, roughness: 0.85 });
            const darkWoodMat = new THREE.MeshStandardMaterial({ color: colors.dark, roughness: 0.9 });
            const plankMat = new THREE.MeshStandardMaterial({ color: colors.plank, roughness: 0.9 });

            const crateW = this.ts * 0.85;
            const crateH = 0.9; // Match counter height
            const crateD = this.ts * 0.85;
            const plankThickness = 0.04;

            // Helper function to create walls
            const createWall = (width, height, depth, x, y, z, material = woodMat) => {
                const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
                wall.position.set(x, y, z);
                wall.castShadow = true;
                wall.receiveShadow = true;
                return wall;
            };

            // --- HOLLOW CRATE BODY (NO TOP - open from above) ---
            // Bottom
            crateGroup.add(createWall(crateW, plankThickness, crateD, 0, plankThickness / 2, 0, darkWoodMat));

            // Walls (hollow construction)
            const wallH = crateH - plankThickness;
            crateGroup.add(createWall(crateW, wallH, plankThickness, 0, crateH / 2, crateD / 2 - plankThickness / 2, woodMat)); // front
            crateGroup.add(createWall(crateW, wallH, plankThickness, 0, crateH / 2, -crateD / 2 + plankThickness / 2, woodMat)); // back
            crateGroup.add(createWall(plankThickness, wallH, crateD - plankThickness * 2, -crateW / 2 + plankThickness / 2, crateH / 2, 0, woodMat)); // left
            crateGroup.add(createWall(plankThickness, wallH, crateD - plankThickness * 2, crateW / 2 - plankThickness / 2, crateH / 2, 0, woodMat)); // right

            // Decorative slats on exterior (vertical planks with gaps)
            const slatsPerSide = 5;
            const slotWidth = crateW / slatsPerSide;

            // Front and back decorative slats
            for (let i = 0; i < slatsPerSide; i++) {
                // Front
                const frontSlat = new THREE.Mesh(
                    new THREE.BoxGeometry(slotWidth * 0.65, wallH * 0.9, plankThickness * 0.3),
                    i % 2 === 0 ? plankMat : darkWoodMat
                );
                frontSlat.position.set(
                    -crateW / 2 + slotWidth * (i + 0.5),
                    crateH / 2,
                    crateD / 2 + plankThickness * 0.15
                );
                frontSlat.castShadow = true;
                crateGroup.add(frontSlat);

                // Back
                const backSlat = frontSlat.clone();
                backSlat.position.z = -crateD / 2 - plankThickness * 0.15;
                crateGroup.add(backSlat);
            }

            // Left and right decorative slats
            for (let i = 0; i < slatsPerSide; i++) {
                // Left
                const leftSlat = new THREE.Mesh(
                    new THREE.BoxGeometry(plankThickness * 0.3, wallH * 0.9, slotWidth * 0.65),
                    i % 2 === 0 ? plankMat : darkWoodMat
                );
                leftSlat.position.set(
                    -crateW / 2 - plankThickness * 0.15,
                    crateH / 2,
                    -crateD / 2 + slotWidth * (i + 0.5)
                );
                leftSlat.castShadow = true;
                crateGroup.add(leftSlat);

                // Right
                const rightSlat = leftSlat.clone();
                rightSlat.position.x = crateW / 2 + plankThickness * 0.15;
                crateGroup.add(rightSlat);
            }

            // Corner posts for structure
            const postGeo = new THREE.BoxGeometry(plankThickness * 1.8, crateH, plankThickness * 1.8);
            [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([cx, cz]) => {
                const post = new THREE.Mesh(postGeo, darkWoodMat);
                post.position.set(
                    cx * (crateW / 2 - plankThickness * 0.9),
                    crateH / 2,
                    cz * (crateD / 2 - plankThickness * 0.9)
                );
                post.castShadow = true;
                crateGroup.add(post);
            });

            // --- INTERIOR LINING (lighter wood inside) ---
            const interiorMat = new THREE.MeshStandardMaterial({ color: 0xD4A574, roughness: 0.7 });
            const interiorH = wallH * 0.85;
            crateGroup.add(createWall(crateW * 0.92, 0.01, crateD * 0.92, 0, plankThickness + 0.005, 0, interiorMat)); // floor
            crateGroup.add(createWall(crateW * 0.88, interiorH, 0.02, 0, crateH * 0.55, -crateD * 0.44, interiorMat)); // back inner
            crateGroup.add(createWall(crateW * 0.88, interiorH, 0.02, 0, crateH * 0.55, crateD * 0.44, interiorMat)); // front inner
            crateGroup.add(createWall(0.02, interiorH, crateD * 0.88, -crateW * 0.44, crateH * 0.55, 0, interiorMat)); // left inner
            crateGroup.add(createWall(0.02, interiorH, crateD * 0.88, crateW * 0.44, crateH * 0.55, 0, interiorMat)); // right inner

            // --- TOP DOOR (hinged at BACK edge, pivots forward) ---
            const doorGroup = new THREE.Group();
            doorGroup.name = 'crateDoor';
            doorGroup.position.set(0, crateH, -crateD * 0.42); // Pivot at back edge

            // Door frame (thick border)
            const frameThickness = 0.08;
            doorGroup.add(createWall(crateW, frameThickness, plankThickness * 2, 0, frameThickness / 2, 0, darkWoodMat)); // back (at pivot)
            doorGroup.add(createWall(crateW, frameThickness, plankThickness * 2, 0, frameThickness / 2, crateD * 0.84, darkWoodMat)); // front
            doorGroup.add(createWall(plankThickness * 2, frameThickness, crateD * 0.84, -crateW / 2 + plankThickness, frameThickness / 2, crateD * 0.42, darkWoodMat)); // left
            doorGroup.add(createWall(plankThickness * 2, frameThickness, crateD * 0.84, crateW / 2 - plankThickness, frameThickness / 2, crateD * 0.42, darkWoodMat)); // right

            // Door planks (horizontal slats)
            const doorPlanks = 5;
            for (let i = 0; i < doorPlanks; i++) {
                const plank = new THREE.Mesh(
                    new THREE.BoxGeometry(crateW * 0.88, frameThickness * 0.7, crateD * 0.15),
                    i % 2 === 0 ? woodMat : plankMat
                );
                plank.position.set(0, frameThickness / 2, crateD * 0.1 + (crateD * 0.64 / (doorPlanks - 1)) * i);
                plank.castShadow = true;
                doorGroup.add(plank);
            }

            // Metal hinges (at back)
            const hingeMat = new THREE.MeshStandardMaterial({
                color: 0x444444,
                roughness: 0.4,
                metalness: 0.8
            });
            [-0.28, 0.28].forEach(xPos => {
                const hinge = new THREE.Mesh(
                    new THREE.BoxGeometry(0.1, frameThickness * 1.3, 0.08),
                    hingeMat
                );
                hinge.position.set(xPos * crateW, frameThickness / 2, -plankThickness);
                hinge.castShadow = true;
                doorGroup.add(hinge);
            });

            // Handle (metal bar at front)
            const handleMat = new THREE.MeshStandardMaterial({
                color: 0x666666,
                metalness: 0.85,
                roughness: 0.15
            });
            const handle = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.02, crateW * 0.6, 12),
                handleMat
            );
            handle.rotation.z = Math.PI / 2;
            handle.position.set(0, frameThickness + 0.03, crateD * 0.82);
            handle.castShadow = true;
            doorGroup.add(handle);

            // --- LARGE INGREDIENT ICON STICKER on door ---
            const ing = this.config.INGREDIENTS[st.ingredient];
            if (ing && ing.emoji) {
                // Create a canvas for the emoji icon
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 256;
                const ctx = canvas.getContext('2d');

                // White circular background
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(128, 128, 110, 0, Math.PI * 2);
                ctx.fill();

                // Border
                ctx.strokeStyle = '#8B6F47';
                ctx.lineWidth = 8;
                ctx.stroke();

                // Draw emoji
                ctx.font = 'bold 140px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(ing.emoji, 128, 140);

                // Create texture and material
                const texture = new THREE.CanvasTexture(canvas);
                texture.needsUpdate = true;
                const stickerMat = new THREE.MeshStandardMaterial({
                    map: texture,
                    transparent: true,
                    roughness: 0.6,
                    metalness: 0.1
                });

                // Create sticker mesh (circular)
                const stickerSize = crateW * 0.35;
                const sticker = new THREE.Mesh(
                    new THREE.CircleGeometry(stickerSize, 32),
                    stickerMat
                );
                sticker.position.set(0, frameThickness + 0.01, crateD * 0.45);
                sticker.rotation.x = -Math.PI / 2;
                doorGroup.add(sticker);
            }

            crateGroup.add(doorGroup);

            // Interior light (subtle glow when open)
            const ingredientColor = {
                tomato: 0xFF6347,
                lettuce: 0x90EE90,
                onion: 0xF5DEB3,
                mushroom: 0xD2B48C,
                rice: 0xFFF8E7,
                dough: 0xF5DEB3,
                bread: 0xC8860A,
                egg: 0xFFF8DC,
                cheese: 0xFFD700
            }[st.ingredient] || 0xFFFFFF;

            const light = new THREE.PointLight(ingredientColor, 0, 2);
            light.position.set(0, crateH * 0.8, 0);
            crateGroup.add(light);

            mesh = crateGroup;
            group.add(crateGroup);
            top = null;

            // Store for animation (same pattern as freezer)
            this.stationEffects[st.id] = {
                door: doorGroup,
                light: light,
                doorOpen: false,
                doorAngle: 0
            };

        } else if (false && isCheeseCrate) {
            // OLD CHEESE DESIGN - DISABLED
            const cheeseGroup = new THREE.Group();
            const counterMat = new THREE.MeshStandardMaterial({ color: crateCounterColor, roughness: 0.5, metalness: 0.15 });
            const counterBlock = new THREE.Mesh(new THREE.BoxGeometry(this.ts * 0.9, baseH, this.ts * 0.9), counterMat);
            counterBlock.position.y = baseH / 2;
            counterBlock.castShadow = true; counterBlock.receiveShadow = true;
            cheeseGroup.add(counterBlock);

            // Dark tile top
            const tileMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.35 });
            const tile = new THREE.Mesh(new THREE.BoxGeometry(this.ts * 0.92, 0.048, this.ts * 0.92), tileMat);
            tile.position.y = baseH + 0.024;
            cheeseGroup.add(tile);

            // Giant cheese wedge (triangle cross-section prism)
            const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.7, metalness: 0.0 });
            const crustMat = new THREE.MeshStandardMaterial({ color: 0xC8960A, roughness: 0.8 });

            // Main wedge body using custom geometry (triangular prism)
            const wShape = new THREE.Shape();
            wShape.moveTo(-0.4, 0);
            wShape.lineTo(0.4, 0);
            wShape.lineTo(0, 0.6);
            wShape.closePath();
            const extrudeSettings = { depth: 0.55, bevelEnabled: false };
            const wedgeGeo = new THREE.ExtrudeGeometry(wShape, extrudeSettings);
            const wedge = new THREE.Mesh(wedgeGeo, cheeseMat);
            wedge.rotation.x = -Math.PI / 2;
            wedge.position.set(-0.275, baseH + 0.048, 0.25);
            wedge.castShadow = true;
            cheeseGroup.add(wedge);

            // Crust strip along bottom edge
            const crustBar = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.06, 0.57), crustMat);
            crustBar.position.set(0, baseH + 0.055, 0);
            cheeseGroup.add(crustBar);

            // Holes in cheese (dark spots)
            const holeMat = new THREE.MeshStandardMaterial({ color: 0xBB9900, roughness: 0.6 });
            const holePositions = [[0.1, 0.18, 0.1], [-0.15, 0.28, 0.05], [0.05, 0.38, -0.1], [-0.08, 0.15, -0.05]];
            holePositions.forEach(([hx, hy, hz]) => {
                const hole = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 7), holeMat);
                hole.scale.set(1, 0.6, 1);
                hole.position.set(hx, baseH + 0.048 + hy, hz);
                cheeseGroup.add(hole);
            });

            // --- CHEESE ICON STICKER on front ---
            const ing = this.config.INGREDIENTS[st.ingredient];
            if (ing && ing.emoji) {
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(128, 128, 110, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#8B6F47';
                ctx.lineWidth = 8;
                ctx.stroke();
                ctx.font = 'bold 140px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(ing.emoji, 128, 140);
                const texture = new THREE.CanvasTexture(canvas);
                texture.needsUpdate = true;
                const stickerMat = new THREE.MeshStandardMaterial({
                    map: texture,
                    transparent: true,
                    roughness: 0.6,
                    metalness: 0.1
                });
                const stickerSize = this.ts * 0.25;
                const sticker = new THREE.Mesh(
                    new THREE.CircleGeometry(stickerSize, 32),
                    stickerMat
                );
                sticker.position.set(0, baseH * 0.5, this.ts * 0.46);
                cheeseGroup.add(sticker);
            }

            mesh = cheeseGroup;
            group.add(cheeseGroup);
            top = null;

        } else if (false && isRiceCrate) {
            // OLD RICE DESIGN - DISABLED
            const riceGroup = new THREE.Group();
            const sackMat = new THREE.MeshStandardMaterial({ color: 0xC2A878, roughness: 0.95 });
            const sackDarkMat = new THREE.MeshStandardMaterial({ color: 0x967B55, roughness: 0.95 });
            const ropeMat = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.9 });

            // Large sack body sitting directly on floor
            const sackBody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.75, 10), sackMat);
            sackBody.position.y = 0.38;
            sackBody.castShadow = true;
            riceGroup.add(sackBody);

            // Neck (pinched)
            const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.40, 0.18, 10), sackMat);
            neck.position.y = 0.84;
            riceGroup.add(neck);

            // Tied top
            const tipTop = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 0.10, 8), sackMat);
            tipTop.position.y = 0.98;
            riceGroup.add(tipTop);

            // Rope tie
            const rope = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 18), ropeMat);
            rope.rotation.x = Math.PI / 2;
            rope.position.y = 0.83;
            riceGroup.add(rope);

            // Burlap cross-hatch lines
            for (let li = 0; li < 5; li++) {
                const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.7, 0.85), sackDarkMat);
                const a = (li / 5) * Math.PI * 2;
                stripe.position.set(Math.cos(a) * 0.43, 0.38, Math.sin(a) * 0.43);
                stripe.rotation.y = a;
                riceGroup.add(stripe);
            }

            // Spilled rice grains around base
            const riceMat = new THREE.MeshStandardMaterial({ color: 0xFFF8E7, roughness: 0.8 });
            for (let g = 0; g < 14; g++) {
                const grain = new THREE.Mesh(new THREE.SphereGeometry(0.022, 5, 5), riceMat);
                grain.scale.set(0.8, 0.5, 1.2);
                const angle = Math.random() * Math.PI * 2;
                grain.position.set(Math.cos(angle) * (0.45 + Math.random() * 0.18), 0.02, Math.sin(angle) * (0.45 + Math.random() * 0.18));
                riceGroup.add(grain);
            }

            mesh = riceGroup;
            group.add(riceGroup);
            top = null;

        } else if (false && isDoughCrate) {
            // OLD DOUGH DESIGN - DISABLED
            const doughGroup = new THREE.Group();
            const doughCounterMat = new THREE.MeshStandardMaterial({ color: crateCounterColor, roughness: 0.5, metalness: 0.15 });

            // Table base (ingredient-colored)
            const tableBase = new THREE.Mesh(new THREE.BoxGeometry(this.ts * 0.9, baseH, this.ts * 0.9), doughCounterMat);
            tableBase.position.y = baseH / 2;
            tableBase.castShadow = true;
            doughGroup.add(tableBase);

            // Dark tile top
            const tableTop = new THREE.Mesh(new THREE.BoxGeometry(this.ts * 0.92, 0.048, this.ts * 0.92), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.35 }));
            tableTop.position.y = baseH + 0.024;
            doughGroup.add(tableTop);

            // Large dough mound (pale yellowish blob)
            const doughMat = new THREE.MeshStandardMaterial({ color: 0xF5DEB3, roughness: 0.95, metalness: 0.0 });
            const doughBlob = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), doughMat);
            doughBlob.scale.set(1.1, 0.55, 1.0);
            doughBlob.position.y = baseH + 0.22;
            doughBlob.castShadow = true;
            doughGroup.add(doughBlob);

            // Flour dusting (white patches)
            const flourMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 1.0, transparent: true, opacity: 0.6 });
            for (let f = 0; f < 5; f++) {
                const patch = new THREE.Mesh(new THREE.SphereGeometry(0.05 + Math.random() * 0.04, 5, 5), flourMat);
                patch.scale.set(1.5, 0.2, 1.5);
                patch.position.set((Math.random() - 0.5) * 0.4, baseH + 0.26, (Math.random() - 0.5) * 0.4);
                doughGroup.add(patch);
            }

            mesh = doughGroup;
            group.add(doughGroup);
            top = null;

        } else if (false && isBreadCrate) {
            // OLD BREAD DESIGN - DISABLED
            const breadGroup = new THREE.Group();
            const breadCounterMat = new THREE.MeshStandardMaterial({ color: crateCounterColor, roughness: 0.5, metalness: 0.15 });

            // Ingredient-colored base
            const tableBase = new THREE.Mesh(new THREE.BoxGeometry(this.ts * 0.9, baseH, this.ts * 0.9), breadCounterMat);
            tableBase.position.y = baseH / 2;
            tableBase.castShadow = true;
            breadGroup.add(tableBase);

            // Dark tile top
            const tableTop = new THREE.Mesh(new THREE.BoxGeometry(this.ts * 0.92, 0.048, this.ts * 0.92), new THREE.MeshStandardMaterial({ color: 0x666055, roughness: 0.4 }));
            tableTop.position.y = baseH + 0.024;
            breadGroup.add(tableTop);

            // LARGE bread loaf
            const breadMat = new THREE.MeshStandardMaterial({ color: 0xC8860A, roughness: 0.85 });
            const crustMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });

            const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 8), breadMat);
            loaf.scale.set(1.3, 0.65, 0.85);
            loaf.position.y = baseH + 0.26;
            loaf.castShadow = true;
            breadGroup.add(loaf);

            // Score lines on top of bread
            for (let s = 0; s < 3; s++) {
                const score = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.03), crustMat);
                score.position.set(0, baseH + 0.445, (s - 1) * 0.12);
                score.rotation.y = 0.15;
                breadGroup.add(score);
            }

            // Bread ends (rounded ends)
            const endL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), crustMat);
            endL.scale.set(0.4, 0.6, 0.8);
            endL.position.set(-0.38, baseH + 0.25, 0);
            breadGroup.add(endL);
            const endR = endL.clone();
            endR.position.set(0.38, baseH + 0.25, 0);
            breadGroup.add(endR);

            mesh = breadGroup;
            group.add(breadGroup);
            top = null;

        } else if (false && isEggCrate) {
            // OLD EGG DESIGN - DISABLED
            const eggGroup = new THREE.Group();
            const cardboardMat = new THREE.MeshStandardMaterial({ color: 0xC8A870, roughness: 0.95 });
            const cardDarkMat = new THREE.MeshStandardMaterial({ color: 0xA88850, roughness: 0.95 });

            // Ingredient-colored counter
            const eggCounterMat = new THREE.MeshStandardMaterial({ color: crateCounterColor, roughness: 0.5, metalness: 0.15 });
            const stand = new THREE.Mesh(new THREE.BoxGeometry(this.ts * 0.9, baseH, this.ts * 0.9), eggCounterMat);
            stand.position.y = baseH / 2;
            stand.castShadow = true;
            eggGroup.add(stand);

            // Dark tile top
            const counter = new THREE.Mesh(new THREE.BoxGeometry(this.ts * 0.92, 0.048, this.ts * 0.92), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.35 }));
            counter.position.y = baseH + 0.024;
            eggGroup.add(counter);

            // Large cardboard egg carton base (bigger and more realistic)
            const trayW = 0.75, trayD = 0.60, trayH = 0.05;
            const tray = new THREE.Mesh(new THREE.BoxGeometry(trayW, trayH, trayD), cardboardMat);
            tray.position.y = baseH + trayH / 2 + 0.05;
            tray.castShadow = true;
            eggGroup.add(tray);

            // Carton texture (molded pulp pattern)
            for (let tx = 0; tx < 8; tx++) {
                const textureLine = new THREE.Mesh(
                    new THREE.BoxGeometry(trayW * 0.95, 0.002, 0.01),
                    cardDarkMat
                );
                textureLine.position.set(
                    0,
                    baseH + trayH + 0.052,
                    -trayD * 0.4 + tx * (trayD * 0.8 / 7)
                );
                eggGroup.add(textureLine);
            }

            // Egg carton dividers (raised walls between eggs)
            const dividerMat = new THREE.MeshStandardMaterial({ color: 0xB89860, roughness: 0.95 });

            // Vertical dividers
            for (let col = 0; col < 5; col++) {
                const divider = new THREE.Mesh(
                    new THREE.BoxGeometry(0.015, 0.08, trayD * 0.9),
                    dividerMat
                );
                divider.position.set(
                    -trayW * 0.4 + col * (trayW * 0.8 / 4),
                    baseH + 0.09,
                    0
                );
                eggGroup.add(divider);
            }

            // Horizontal dividers
            for (let row = 0; row < 4; row++) {
                const divider = new THREE.Mesh(
                    new THREE.BoxGeometry(trayW * 0.9, 0.08, 0.015),
                    dividerMat
                );
                divider.position.set(
                    0,
                    baseH + 0.09,
                    -trayD * 0.4 + row * (trayD * 0.8 / 3)
                );
                eggGroup.add(divider);
            }

            // Egg holder bumps (molded cups) - 4x4 grid = 16 eggs
            const rows = 4, cols = 4;
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    // Molded cup (hemisphere depression)
                    const cup = new THREE.Mesh(
                        new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
                        cardDarkMat
                    );
                    const xPos = -trayW * 0.35 + col * (trayW * 0.7 / (cols - 1));
                    const zPos = -trayD * 0.35 + row * (trayD * 0.7 / (rows - 1));
                    cup.position.set(xPos, baseH + 0.08, zPos);
                    eggGroup.add(cup);

                    // Realistic egg sitting in cup
                    const eggGroup2 = new THREE.Group();
                    const eggMat = new THREE.MeshStandardMaterial({
                        color: 0xFFF8DC,
                        roughness: 0.4,
                        metalness: 0.05
                    });
                    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), eggMat);
                    egg.scale.set(0.85, 1.2, 0.85);
                    eggGroup2.add(egg);

                    // Brown speckles on eggs
                    for (let sp = 0; sp < 4; sp++) {
                        const speckle = new THREE.Mesh(
                            new THREE.SphereGeometry(0.004, 6, 6),
                            new THREE.MeshStandardMaterial({
                                color: 0xD4A574,
                                transparent: true,
                                opacity: 0.5
                            })
                        );
                        const angle = Math.random() * Math.PI * 2;
                        const height = (Math.random() - 0.5) * 0.1;
                        speckle.position.set(
                            Math.cos(angle) * 0.055,
                            height,
                            Math.sin(angle) * 0.055
                        );
                        eggGroup2.add(speckle);
                    }

                    eggGroup2.position.set(xPos, baseH + 0.15, zPos);
                    eggGroup2.rotation.set(
                        (Math.random() - 0.5) * 0.2,
                        Math.random() * Math.PI * 2,
                        (Math.random() - 0.5) * 0.2
                    );
                    eggGroup2.castShadow = true;
                    eggGroup.add(eggGroup2);
                }
            }

            // Carton label (brand sticker)
            const labelMat = new THREE.MeshStandardMaterial({
                color: 0xFFFFFF,
                roughness: 0.3
            });
            const label = new THREE.Mesh(
                new THREE.PlaneGeometry(0.25, 0.08),
                labelMat
            );
            label.rotation.x = -Math.PI / 2;
            label.position.set(0, baseH + trayH + 0.053, trayD * 0.35);
            eggGroup.add(label);

            // Label text (EGGS)
            const textMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
            const letterE1 = new THREE.Mesh(
                new THREE.BoxGeometry(0.015, 0.001, 0.04),
                textMat
            );
            letterE1.rotation.x = -Math.PI / 2;
            letterE1.position.set(-0.06, baseH + trayH + 0.054, trayD * 0.35);
            eggGroup.add(letterE1);

            mesh = eggGroup;
            group.add(eggGroup);
            top = null;

        } else if (isTrash) {
            // --- TRASH: No counter block, standalone bin ---
            mesh = new THREE.Group(); // Dummy, trash can built below
            group.add(mesh);
            top = null;

        } else {
            const geo = new THREE.BoxGeometry(this.ts * 0.9, baseH, this.ts * 0.9);
            const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.2 });
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.y = baseH / 2;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);

            // Top surface
            const topGeo = new THREE.BoxGeometry(this.ts * 0.92, 0.05, this.ts * 0.92);
            let topColor = 0x999999;
            if (st.type === 'chopping') topColor = 0x808590; // Steel counter top
            if (st.type === 'stove') topColor = 0x1a1a1a;
            if (st.type === 'serve') topColor = 0xbdc3c7; // Stainless Steel / Silver top
            const topMat = new THREE.MeshStandardMaterial({ color: topColor, roughness: 0.4 });
            top = new THREE.Mesh(topGeo, topMat);
            top.position.y = baseH + 0.025;
            group.add(top);
        }

        // Type-specific decorations
        if (st.type === 'stove') {
            // Burner rings (Electric coil style)
            const ringGeo = new THREE.TorusGeometry(0.28, 0.04, 12, 32);
            const ringMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(0, baseH + 0.04, 0);
            ring.name = 'burnerCoil';
            group.add(ring);

            // --- Vessels ---
            // 1. Frying Pan
            const panGroup = new THREE.Group();
            panGroup.name = 'vessel_pan';
            panGroup.visible = false;
            group.add(panGroup);

            const panBaseGeo = new THREE.CylinderGeometry(0.35, 0.3, 0.15, 24);
            const panMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.5, metalness: 0.5 });
            const panBase = new THREE.Mesh(panBaseGeo, panMat);
            panBase.position.y = baseH + 0.12;
            panGroup.add(panBase);

            const panHandleGeo = new THREE.BoxGeometry(0.5, 0.04, 0.1);
            const panHandle = new THREE.Mesh(panHandleGeo, panMat);
            panHandle.position.set(0.5, baseH + 0.16, 0);
            panGroup.add(panHandle);

            // 2. Kaldero (Deep Cooking Pot)
            const potGroup = new THREE.Group();
            potGroup.name = 'vessel_pot';
            potGroup.visible = false;
            group.add(potGroup);

            // Wider, deeper kaldero body (aluminum look)
            const potBaseGeo = new THREE.CylinderGeometry(0.38, 0.32, 0.45, 24);
            const potMat = new THREE.MeshStandardMaterial({ color: 0xA8B0B8, metalness: 0.7, roughness: 0.25 });
            const potBase = new THREE.Mesh(potBaseGeo, potMat);
            potBase.position.y = baseH + 0.28;
            potGroup.add(potBase);

            // Rim (slightly wider lip at top)
            const rimGeo = new THREE.TorusGeometry(0.39, 0.02, 8, 24);
            const rimMesh = new THREE.Mesh(rimGeo, potMat);
            rimMesh.rotation.x = Math.PI / 2;
            rimMesh.position.y = baseH + 0.5;
            potGroup.add(rimMesh);

            // Handles (curved, side-mounted)
            const pHandleGeo = new THREE.TorusGeometry(0.08, 0.02, 8, 16, Math.PI);
            const pHandleL = new THREE.Mesh(pHandleGeo, potMat);
            pHandleL.position.set(-0.38, baseH + 0.4, 0);
            pHandleL.rotation.z = -Math.PI / 2;
            potGroup.add(pHandleL);

            const pHandleR = pHandleL.clone();
            pHandleR.position.set(0.38, baseH + 0.4, 0);
            pHandleR.rotation.z = Math.PI / 2;
            potGroup.add(pHandleR);

            // Glow for active stove
            const glowGeo = new THREE.PlaneGeometry(this.ts * 0.7, this.ts * 0.7);
            const glowMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0 });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            glow.rotation.x = -Math.PI / 2;
            glow.position.y = baseH + 0.06;
            group.add(glow);

            this.stationEffects[st.id] = { glow, glowMat };
        }

        if (st.type === 'oven') {
            // --- MODERN KITCHEN OVEN (HOLLOW LIKE FREEZER) ---
            const steelMat = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, roughness: 0.3, metalness: 0.7 });
            const glassMat = new THREE.MeshStandardMaterial({
                color: 0x1a1a1a,
                transparent: true,
                opacity: 0.6,
                roughness: 0.1,
                metalness: 0.3
            });
            const chromeMat = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.95, roughness: 0.05 });
            const blackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 });

            // Hollow chassis like freezer
            const ovenGroup = new THREE.Group();
            const ovenH = 1.2;
            const sz = this.ts * 0.46;
            const th = 0.04;

            const createWall = (width, height, depth, x, y, z) => {
                const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), steelMat);
                wall.position.set(x, y, z);
                return wall;
            };

            // Exterior walls (NO FRONT - it's open for the door)
            ovenGroup.add(createWall(this.ts * 0.9, ovenH, th, 0, ovenH / 2, -this.ts * 0.425)); // back
            ovenGroup.add(createWall(th, ovenH, this.ts * 0.85, -this.ts * 0.45, ovenH / 2, 0)); // left
            ovenGroup.add(createWall(th, ovenH, this.ts * 0.85, this.ts * 0.45, ovenH / 2, 0)); // right
            ovenGroup.add(createWall(this.ts * 0.9, th, this.ts * 0.85, 0, th / 2, 0)); // bottom
            ovenGroup.add(createWall(this.ts * 0.9, th, this.ts * 0.85, 0, ovenH - th / 2, 0)); // top

            // Bright interior lining (like freezer)
            const linerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
            const innerH = ovenH * 0.8;
            ovenGroup.add(createWall(this.ts * 0.8, innerH, 0.02, 0, ovenH * 0.6, -this.ts * 0.405, linerMat)); // back inner
            ovenGroup.add(createWall(0.02, innerH, this.ts * 0.75, -this.ts * 0.4, ovenH * 0.6, 0, linerMat)); // left inner
            ovenGroup.add(createWall(0.02, innerH, this.ts * 0.75, this.ts * 0.4, ovenH * 0.6, 0, linerMat)); // right inner
            ovenGroup.add(createWall(this.ts * 0.8, 0.02, this.ts * 0.75, 0, ovenH * 0.2, 0, linerMat)); // bottom inner

            group.add(ovenGroup);
            ovenGroup.position.y = baseH + 0.0;

            // Control panel on top
            const controlPanel = new THREE.Mesh(
                new THREE.BoxGeometry(this.ts * 0.88, 0.15, 0.08),
                blackMat
            );
            controlPanel.position.set(0, baseH + 1.2, this.ts * 0.42);
            group.add(controlPanel);

            // Control knobs
            for (let k = 0; k < 4; k++) {
                const knob = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.04, 0.04, 0.03, 16),
                    chromeMat
                );
                knob.rotation.x = Math.PI / 2;
                knob.position.set(
                    -0.25 + k * 0.17,
                    baseH + 1.2,
                    this.ts * 0.47
                );
                group.add(knob);

                // Knob indicator line
                const indicator = new THREE.Mesh(
                    new THREE.BoxGeometry(0.02, 0.025, 0.002),
                    new THREE.MeshStandardMaterial({ color: 0xFF0000 })
                );
                indicator.position.copy(knob.position);
                indicator.position.y += 0.02;
                group.add(indicator);
            }

            // 2. Oven Door (Front with glass window) - Make it a separate group for animation
            const ovenDoor = new THREE.Group();
            ovenDoor.name = 'ovenDoor';

            const doorFrame = new THREE.Mesh(
                new THREE.BoxGeometry(this.ts * 0.85, 0.95, 0.08),
                steelMat
            );
            doorFrame.position.set(0, 0.475, 0);
            ovenDoor.add(doorFrame);

            // Glass window in door
            const windowGlass = new THREE.Mesh(
                new THREE.BoxGeometry(this.ts * 0.7, 0.7, 0.02),
                glassMat
            );
            windowGlass.position.set(0, 0.545, 0.05);
            ovenDoor.add(windowGlass);

            // Window frame grid (cross pattern)
            const gridMat = new THREE.MeshStandardMaterial({ color: 0x34495e, metalness: 0.5 });
            const gridH = new THREE.Mesh(
                new THREE.BoxGeometry(this.ts * 0.72, 0.015, 0.025),
                gridMat
            );
            gridH.position.set(0, 0.545, 0.06);
            ovenDoor.add(gridH);

            const gridV = new THREE.Mesh(
                new THREE.BoxGeometry(0.015, 0.72, 0.025),
                gridMat
            );
            gridV.position.set(0, 0.545, 0.06);
            ovenDoor.add(gridV);

            // Door handle (chrome bar)
            const handle = new THREE.Mesh(
                new THREE.BoxGeometry(this.ts * 0.6, 0.04, 0.04),
                chromeMat
            );
            handle.position.set(0, 0.975, 0.05);
            ovenDoor.add(handle);

            // Handle end caps
            for (let e = 0; e < 2; e++) {
                const cap = new THREE.Mesh(
                    new THREE.SphereGeometry(0.025, 12, 12),
                    chromeMat
                );
                cap.position.set(
                    (e - 0.5) * this.ts * 0.6,
                    0.975,
                    0.05
                );
                ovenDoor.add(cap);
            }

            // Set pivot point at bottom front edge for door swing down
            ovenDoor.position.set(0, baseH + 0.0, this.ts * 0.425);
            group.add(ovenDoor);

            // 3. Oven Interior (removed - now hollow)

            // Oven racks (2 levels)
            const rackMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6 });
            for (let r = 0; r < 2; r++) {
                const rack = new THREE.Group();

                // Rack frame
                const rackFrame = new THREE.Mesh(
                    new THREE.BoxGeometry(this.ts * 0.7, 0.015, this.ts * 0.65),
                    rackMat
                );
                rack.add(rackFrame);

                // Rack bars
                for (let bar = 0; bar < 8; bar++) {
                    const rackBar = new THREE.Mesh(
                        new THREE.BoxGeometry(0.01, 0.015, this.ts * 0.65),
                        rackMat
                    );
                    rackBar.position.x = -this.ts * 0.3 + bar * (this.ts * 0.6 / 7);
                    rack.add(rackBar);
                }

                rack.position.set(0, baseH + 0.4 + r * 0.35, 0.1);
                group.add(rack);
            }

            // 4. Interior light/glow (orange when heating)
            const ovenLight = new THREE.Mesh(
                new THREE.BoxGeometry(this.ts * 0.7, 0.8, this.ts * 0.65),
                new THREE.MeshBasicMaterial({
                    color: 0xff6600,
                    transparent: true,
                    opacity: 0.0
                })
            );
            ovenLight.position.set(0, baseH + 0.0, 0.1);
            group.add(ovenLight);

            // Heating element at bottom (visible coil)
            const heatingElement = new THREE.Group();
            for (let coil = 0; coil < 3; coil++) {
                const element = new THREE.Mesh(
                    new THREE.TorusGeometry(0.12 - coil * 0.04, 0.012, 8, 16),
                    new THREE.MeshStandardMaterial({
                        color: 0x333333,
                        emissive: 0xff0000,
                        emissiveIntensity: 0
                    })
                );
                element.rotation.x = Math.PI / 2;
                element.position.y = baseH + 0.05;
                heatingElement.add(element);
            }
            group.add(heatingElement);

            // Store for animation
            this.stationEffects[st.id] = {
                glow: ovenLight,
                glowMat: ovenLight.material,
                heatingElement: heatingElement,
                door: ovenDoor,
                doorAngle: 0
            };

            // Vent holes on top
            for (let v = 0; v < 6; v++) {
                const vent = new THREE.Mesh(
                    new THREE.BoxGeometry(0.08, 0.01, 0.02),
                    blackMat
                );
                vent.position.set(
                    -0.2 + v * 0.08,
                    baseH + 1.19,
                    this.ts * 0.35
                );
                group.add(vent);
            }
        }

        if (st.type === 'crate') {
            const ing = this.config.INGREDIENTS[st.ingredient];
            if (ing) {
                const ingMat = new THREE.MeshStandardMaterial({ color: ing.color, roughness: 0.5 });
                const ingGroup = new THREE.Group();

                if (isFreezerItem) {
                    // --- FREEZER CONTENTS: wrapped packages + ice ---
                    const itemCount = 3;
                    for (let item = 0; item < itemCount; item++) {
                        let ingMesh;
                        if (st.ingredient === 'meat') {
                            const wrapMat = new THREE.MeshStandardMaterial({ color: 0xE8D0D0, roughness: 0.3 });
                            const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.16), wrapMat);
                            const tray = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.18),
                                new THREE.MeshStandardMaterial({ color: 0xCC3333, roughness: 0.5 }));
                            tray.position.y = -0.04;
                            wrap.add(tray);
                            ingMesh = wrap;
                        } else {
                            const fishBody = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), ingMat);
                            fishBody.scale.set(1.5, 0.4, 0.5);
                            ingMesh = fishBody;
                        }
                        ingMesh.position.set(
                            (item - 1) * 0.25,
                            baseH * 0.7,
                            (Math.random() - 0.5) * 0.2
                        );
                        ingGroup.add(ingMesh);
                    }
                    // Ice cubes
                    const iceMat = new THREE.MeshStandardMaterial({ color: 0xD4F1F9, transparent: true, opacity: 0.6, roughness: 0.1 });
                    for (let ic = 0; ic < 6; ic++) {
                        const cube = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.06), iceMat);
                        cube.position.set(
                            (Math.random() - 0.5) * 0.5,
                            baseH * 0.55 + Math.random() * 0.1,
                            (Math.random() - 0.5) * 0.3
                        );
                        cube.rotation.y = Math.random() * Math.PI;
                        ingGroup.add(cube);
                    }

                } else if (isRiceCrate) {
                    // --- RICE CRATE CONTENTS: Sand-like white powder filling the box ---
                    const riceMat = new THREE.MeshStandardMaterial({
                        color: 0xFFF8E7,
                        roughness: 0.95,
                        metalness: 0.0
                    });

                    // Create a solid base layer (sand-like surface)
                    const boxSz = this.ts * 0.35;
                    const fillHeight = 0.42; // Fill most of the crate

                    // Main rice mass (solid block with rounded top)
                    const riceBase = new THREE.Mesh(
                        new THREE.BoxGeometry(boxSz * 1.6, fillHeight, boxSz * 1.6),
                        riceMat
                    );
                    riceBase.position.y = fillHeight / 2 + 0.05;
                    ingGroup.add(riceBase);

                    // Rounded top surface (mound effect)
                    const moundTop = new THREE.Mesh(
                        new THREE.SphereGeometry(boxSz * 0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
                        riceMat
                    );
                    moundTop.position.y = fillHeight + 0.05;
                    moundTop.scale.y = 0.3; // Flatten it
                    ingGroup.add(moundTop);

                    // Add texture with many tiny grains on surface
                    const grainCount = 300;
                    for (let g = 0; g < grainCount; g++) {
                        const grain = new THREE.Mesh(
                            new THREE.SphereGeometry(0.006, 3, 3),
                            riceMat
                        );
                        grain.scale.set(0.5, 1.2, 0.5);

                        // Scatter on top surface
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * boxSz * 0.8;
                        const x = Math.cos(angle) * radius;
                        const z = Math.sin(angle) * radius;

                        // Height follows the mound curve
                        const distFromCenter = Math.sqrt(x * x + z * z);
                        const moundHeight = Math.max(0, 1 - (distFromCenter / (boxSz * 0.8))) * 0.08;
                        const y = fillHeight + 0.05 + moundHeight + (Math.random() * 0.015);

                        grain.position.set(x, y, z);
                        grain.rotation.set(
                            Math.random() * Math.PI,
                            Math.random() * Math.PI,
                            Math.random() * Math.PI
                        );

                        ingGroup.add(grain);
                    }

                    // Add small clumps for texture variation
                    for (let c = 0; c < 15; c++) {
                        const clump = new THREE.Mesh(
                            new THREE.SphereGeometry(0.018, 5, 5),
                            riceMat
                        );
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * boxSz * 0.75;
                        const x = Math.cos(angle) * radius;
                        const z = Math.sin(angle) * radius;
                        const distFromCenter = Math.sqrt(x * x + z * z);
                        const moundHeight = Math.max(0, 1 - (distFromCenter / (boxSz * 0.75))) * 0.08;

                        clump.position.set(
                            x,
                            fillHeight + 0.05 + moundHeight + (Math.random() * 0.02),
                            z
                        );
                        clump.scale.set(1, 0.5, 1);
                        ingGroup.add(clump);
                    }

                } else if (isDoughCrate) {
                    // --- DOUGH CRATE CONTENTS: Stacked layers of dough balls ---
                    const doughMat = new THREE.MeshStandardMaterial({
                        color: 0xF5DEB3,
                        roughness: 0.95,
                        metalness: 0.0
                    });

                    const flourMat = new THREE.MeshStandardMaterial({
                        color: 0xFFFFF0,
                        roughness: 1.0,
                        transparent: true,
                        opacity: 0.6
                    });

                    const boxSz = this.ts * 0.35;

                    // Create stacked layers of dough balls
                    const layers = 3;
                    const ballsPerLayer = 4;

                    for (let layer = 0; layer < layers; layer++) {
                        const layerY = 0.12 + layer * 0.14;

                        for (let b = 0; b < ballsPerLayer; b++) {
                            // Dough ball
                            const doughBall = new THREE.Mesh(
                                new THREE.SphereGeometry(0.11 + Math.random() * 0.02, 12, 10),
                                doughMat
                            );
                            doughBall.scale.set(1, 0.7, 1); // Slightly flattened

                            // Arrange in a pattern
                            const angle = (b / ballsPerLayer) * Math.PI * 2 + (layer * 0.5);
                            const radius = layer === 0 ? 0.15 : (layer === 1 ? 0.1 : 0.05);

                            doughBall.position.set(
                                Math.cos(angle) * radius,
                                layerY,
                                Math.sin(angle) * radius
                            );

                            ingGroup.add(doughBall);

                            // Add flour dusting on each ball
                            for (let f = 0; f < 3; f++) {
                                const flour = new THREE.Mesh(
                                    new THREE.SphereGeometry(0.015, 5, 5),
                                    flourMat
                                );
                                flour.scale.set(1.5, 0.3, 1.5);
                                flour.position.set(
                                    doughBall.position.x + (Math.random() - 0.5) * 0.08,
                                    layerY + 0.08,
                                    doughBall.position.z + (Math.random() - 0.5) * 0.08
                                );
                                ingGroup.add(flour);
                            }
                        }
                    }

                    // Add one large dough ball on top
                    const topDough = new THREE.Mesh(
                        new THREE.SphereGeometry(0.13, 14, 12),
                        doughMat
                    );
                    topDough.scale.set(1, 0.65, 1);
                    topDough.position.y = 0.12 + layers * 0.14;
                    ingGroup.add(topDough);

                    // Extra flour on top
                    for (let f = 0; f < 5; f++) {
                        const flour = new THREE.Mesh(
                            new THREE.SphereGeometry(0.018, 5, 5),
                            flourMat
                        );
                        flour.scale.set(1.8, 0.25, 1.8);
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * 0.12;
                        flour.position.set(
                            Math.cos(angle) * radius,
                            0.12 + layers * 0.14 + 0.09,
                            Math.sin(angle) * radius
                        );
                        ingGroup.add(flour);
                    }

                } else if (isBreadCrate) {
                    // --- BREAD CRATE CONTENTS: Scattered burger buns ---
                    const breadMat = new THREE.MeshStandardMaterial({
                        color: 0xC8860A,
                        roughness: 0.85,
                        metalness: 0.0
                    });

                    const topMat = new THREE.MeshStandardMaterial({
                        color: 0xA0690A,
                        roughness: 0.9
                    });

                    const seedMat = new THREE.MeshStandardMaterial({
                        color: 0xFFFACD,
                        roughness: 0.8
                    });

                    const boxSz = this.ts * 0.35;

                    // Create scattered burger buns filling the crate
                    const bunCount = 12;

                    for (let b = 0; b < bunCount; b++) {
                        const bunGroup = new THREE.Group();

                        // Bun body (round, slightly flattened)
                        const bun = new THREE.Mesh(
                            new THREE.SphereGeometry(0.09, 16, 12),
                            breadMat
                        );
                        bun.scale.set(1, 0.6, 1);
                        bunGroup.add(bun);

                        // Darker top crust
                        const top = new THREE.Mesh(
                            new THREE.SphereGeometry(0.088, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
                            topMat
                        );
                        top.position.y = 0.02;
                        top.scale.y = 0.5;
                        bunGroup.add(top);

                        // Sesame seeds on top
                        const seedCount = 6 + Math.floor(Math.random() * 4);
                        for (let s = 0; s < seedCount; s++) {
                            const seed = new THREE.Mesh(
                                new THREE.SphereGeometry(0.004, 4, 4),
                                seedMat
                            );
                            const angle = Math.random() * Math.PI * 2;
                            const radius = Math.random() * 0.06;
                            seed.position.set(
                                Math.cos(angle) * radius,
                                0.055,
                                Math.sin(angle) * radius
                            );
                            bunGroup.add(seed);
                        }

                        // Random position in crate (scattered)
                        const layer = Math.floor(b / 4);
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * boxSz * 0.8;

                        bunGroup.position.set(
                            Math.cos(angle) * radius,
                            0.1 + layer * 0.12,
                            Math.sin(angle) * radius
                        );
                        bunGroup.rotation.y = Math.random() * Math.PI * 2;

                        ingGroup.add(bunGroup);
                    }

                } else if (isCheeseCrate) {
                    // --- CHEESE CRATE CONTENTS: Giant cheese wedge (3D model style) ---
                    const cheeseMat = new THREE.MeshStandardMaterial({
                        color: 0xFFD700,
                        roughness: 0.7,
                        metalness: 0.0
                    });

                    const crustMat = new THREE.MeshStandardMaterial({
                        color: 0xDAA520,
                        roughness: 0.8
                    });

                    const holeMat = new THREE.MeshStandardMaterial({
                        color: 0xB8860B,
                        roughness: 0.8
                    });

                    // Create giant cheese wedge using triangular prism
                    const cheeseGroup = new THREE.Group();

                    // Main wedge body (triangular prism)
                    const wedgeShape = new THREE.Shape();
                    wedgeShape.moveTo(-0.25, 0);
                    wedgeShape.lineTo(0.25, 0);
                    wedgeShape.lineTo(0, 0.35);
                    wedgeShape.closePath();

                    const extrudeSettings = {
                        depth: 0.3,
                        bevelEnabled: true,
                        bevelThickness: 0.01,
                        bevelSize: 0.01,
                        bevelSegments: 2
                    };

                    const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, extrudeSettings);
                    const wedge = new THREE.Mesh(wedgeGeo, cheeseMat);
                    wedge.rotation.x = -Math.PI / 2;
                    wedge.rotation.z = Math.PI / 2;
                    wedge.position.set(0, 0.18, 0);
                    wedge.castShadow = true;
                    cheeseGroup.add(wedge);

                    // Crust on the curved edge (rind)
                    const rindCurve = new THREE.Shape();
                    rindCurve.moveTo(-0.25, 0);
                    rindCurve.lineTo(0.25, 0);
                    rindCurve.lineTo(0, 0.35);
                    rindCurve.closePath();

                    const rindGeo = new THREE.ExtrudeGeometry(rindCurve, {
                        depth: 0.015,
                        bevelEnabled: false
                    });
                    const rind = new THREE.Mesh(rindGeo, crustMat);
                    rind.rotation.x = -Math.PI / 2;
                    rind.rotation.z = Math.PI / 2;
                    rind.position.set(0, 0.18, -0.16);
                    cheeseGroup.add(rind);

                    // Large cheese holes (scattered on visible faces)
                    const holePositions = [
                        { x: 0.08, y: 0.15, z: 0.05 },
                        { x: -0.1, y: 0.22, z: 0.02 },
                        { x: 0.05, y: 0.28, z: -0.03 },
                        { x: -0.05, y: 0.12, z: 0.08 },
                        { x: 0.12, y: 0.25, z: -0.05 },
                        { x: -0.08, y: 0.18, z: -0.08 },
                        { x: 0.02, y: 0.2, z: 0.1 }
                    ];

                    holePositions.forEach(pos => {
                        const hole = new THREE.Mesh(
                            new THREE.SphereGeometry(0.025 + Math.random() * 0.015, 8, 8),
                            holeMat
                        );
                        hole.scale.set(1, 0.8, 1);
                        hole.position.set(pos.x, pos.y, pos.z);
                        cheeseGroup.add(hole);
                    });

                    ingGroup.add(cheeseGroup);

                } else if (isEggCrate) {
                    // --- EGG CRATE CONTENTS: Giant egg tray with eggs ---
                    const cardboardMat = new THREE.MeshStandardMaterial({
                        color: 0xC8A870,
                        roughness: 0.95
                    });

                    const eggMat = new THREE.MeshStandardMaterial({
                        color: 0xFFF8DC,
                        roughness: 0.6
                    });

                    const speckleMat = new THREE.MeshStandardMaterial({
                        color: 0xD4A574,
                        transparent: true,
                        opacity: 0.4
                    });

                    const boxSz = this.ts * 0.35;

                    // Create 1 giant egg tray filling the crate
                    const trayGroup = new THREE.Group();

                    // Large tray base
                    const trayBase = new THREE.Mesh(
                        new THREE.BoxGeometry(0.65, 0.04, 0.55),
                        cardboardMat
                    );
                    trayBase.position.y = 0.02;
                    trayGroup.add(trayBase);

                    // Tray walls
                    const wallH = 0.08;
                    // Front
                    const frontWall = new THREE.Mesh(
                        new THREE.BoxGeometry(0.65, wallH, 0.02),
                        cardboardMat
                    );
                    frontWall.position.set(0, 0.04 + wallH / 2, 0.265);
                    trayGroup.add(frontWall);

                    // Back
                    const backWall = frontWall.clone();
                    backWall.position.z = -0.265;
                    trayGroup.add(backWall);

                    // Left
                    const leftWall = new THREE.Mesh(
                        new THREE.BoxGeometry(0.02, wallH, 0.55),
                        cardboardMat
                    );
                    leftWall.position.set(-0.315, 0.04 + wallH / 2, 0);
                    trayGroup.add(leftWall);

                    // Right
                    const rightWall = leftWall.clone();
                    rightWall.position.x = 0.315;
                    trayGroup.add(rightWall);

                    // Egg cups and eggs (5 rows x 6 columns = 30 eggs)
                    const rows = 5;
                    const cols = 6;
                    const eggSpacingX = 0.1;
                    const eggSpacingZ = 0.1;
                    const startX = -(cols - 1) * eggSpacingX / 2;
                    const startZ = -(rows - 1) * eggSpacingZ / 2;

                    for (let row = 0; row < rows; row++) {
                        for (let col = 0; col < cols; col++) {
                            const cupX = startX + col * eggSpacingX;
                            const cupZ = startZ + row * eggSpacingZ;

                            // Cup dimple
                            const cup = new THREE.Mesh(
                                new THREE.SphereGeometry(0.045, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
                                cardboardMat
                            );
                            cup.position.set(cupX, 0.04, cupZ);
                            cup.rotation.x = Math.PI;
                            trayGroup.add(cup);

                            // Egg in cup (most cups have eggs)
                            if (Math.random() > 0.15) {
                                const egg = new THREE.Mesh(
                                    new THREE.SphereGeometry(0.04, 14, 14),
                                    eggMat
                                );
                                egg.scale.set(0.85, 1.1, 0.85);
                                egg.position.set(cupX, 0.09, cupZ);
                                egg.castShadow = true;
                                trayGroup.add(egg);

                                // Speckles on egg
                                for (let s = 0; s < 3; s++) {
                                    const speckle = new THREE.Mesh(
                                        new THREE.SphereGeometry(0.004, 4, 4),
                                        speckleMat
                                    );
                                    const angle = Math.random() * Math.PI * 2;
                                    const radius = 0.03;
                                    speckle.position.set(
                                        cupX + Math.cos(angle) * radius,
                                        0.09 + (Math.random() - 0.5) * 0.04,
                                        cupZ + Math.sin(angle) * radius
                                    );
                                    trayGroup.add(speckle);
                                }
                            }
                        }
                    }

                    trayGroup.position.y = 0.08;
                    ingGroup.add(trayGroup);

                } else if (!isRiceCrate && !isDoughCrate && !isBreadCrate && !isEggCrate && !isCheeseCrate) {
                    // --- WOODEN BOX CONTENTS: BIG pile of produce INSIDE the box ---
                    const fillCount = 10;
                    const boxSz = this.ts * 0.32;
                    for (let item = 0; item < fillCount; item++) {
                        let ingMesh;
                        const sz = 0.12 + Math.random() * 0.04; // Big produce

                        if (st.ingredient === 'tomato') {
                            // Realistic tomato with segments and stem
                            const tomatoGroup = new THREE.Group();
                            const body = new THREE.Mesh(new THREE.SphereGeometry(sz, 16, 16), ingMat);
                            body.scale.y = 0.9;
                            tomatoGroup.add(body);

                            // Segments
                            for (let seg = 0; seg < 6; seg++) {
                                const segment = new THREE.Mesh(
                                    new THREE.BoxGeometry(0.008, sz * 2, 0.008),
                                    new THREE.MeshStandardMaterial({ color: 0xC0392B, roughness: 0.8 })
                                );
                                const angle = (seg / 6) * Math.PI * 2;
                                segment.position.set(Math.cos(angle) * sz * 0.95, 0, Math.sin(angle) * sz * 0.95);
                                segment.rotation.y = angle;
                                tomatoGroup.add(segment);
                            }

                            // Green stem
                            const stemMat = new THREE.MeshStandardMaterial({ color: 0x27ae60 });
                            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.03, 6), stemMat);
                            stem.position.y = sz * 0.9;
                            tomatoGroup.add(stem);

                            // Calyx leaves
                            for (let cl = 0; cl < 5; cl++) {
                                const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.04, 3), stemMat);
                                const angle = (cl / 5) * Math.PI * 2;
                                leaf.position.set(Math.cos(angle) * 0.03, sz * 0.92, Math.sin(angle) * 0.03);
                                leaf.rotation.set(Math.PI / 3, angle, 0);
                                tomatoGroup.add(leaf);
                            }
                            ingMesh = tomatoGroup;

                        } else if (st.ingredient === 'onion') {
                            // Realistic onion with layers and sprout
                            const onionGroup = new THREE.Group();
                            const body = new THREE.Mesh(new THREE.SphereGeometry(sz * 0.9, 16, 16), ingMat);
                            body.scale.set(1, 1.1, 1);
                            onionGroup.add(body);

                            // Onion layers
                            for (let layer = 0; layer < 3; layer++) {
                                const ring = new THREE.Mesh(
                                    new THREE.TorusGeometry(sz * 0.85 - layer * 0.015, 0.003, 8, 16),
                                    new THREE.MeshStandardMaterial({
                                        color: 0xE8D5B7,
                                        transparent: true,
                                        opacity: 0.6
                                    })
                                );
                                ring.rotation.x = Math.PI / 2;
                                ring.position.y = 0.02 + layer * 0.03;
                                onionGroup.add(ring);
                            }

                            // Green sprout
                            const sprout = new THREE.Mesh(
                                new THREE.CylinderGeometry(0.008, 0.01, 0.06, 6),
                                new THREE.MeshStandardMaterial({ color: 0x7CB342 })
                            );
                            sprout.position.y = sz * 1.1;
                            onionGroup.add(sprout);

                            // Root tip
                            const tip = new THREE.Mesh(
                                new THREE.ConeGeometry(0.02, 0.06, 6),
                                new THREE.MeshStandardMaterial({ color: 0x8B6914 })
                            );
                            tip.position.y = -sz * 0.95;
                            tip.rotation.x = Math.PI;
                            onionGroup.add(tip);
                            ingMesh = onionGroup;

                        } else if (st.ingredient === 'mushroom') {
                            // Realistic mushroom with cap and stem
                            const mG = new THREE.Group();
                            const stem = new THREE.Mesh(
                                new THREE.CylinderGeometry(0.025, 0.04, 0.08, 12),
                                new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
                            );
                            mG.add(stem);

                            const mCap = new THREE.Mesh(
                                new THREE.SphereGeometry(sz * 0.7, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
                                ingMat
                            );
                            mCap.position.y = 0.04;
                            mG.add(mCap);

                            // Gills under cap
                            const gills = new THREE.Mesh(
                                new THREE.CylinderGeometry(sz * 0.65, sz * 0.68, 0.01, 16),
                                new THREE.MeshStandardMaterial({ color: 0xD2B48C, roughness: 0.9 })
                            );
                            gills.position.y = 0.035;
                            mG.add(gills);
                            ingMesh = mG;

                        } else if (st.ingredient === 'lettuce') {
                            // Realistic lettuce head with leaves
                            const lettuceGroup = new THREE.Group();
                            const core = new THREE.Mesh(
                                new THREE.SphereGeometry(sz * 0.4, 12, 12),
                                new THREE.MeshStandardMaterial({ color: 0xC8E6C9, roughness: 0.8 })
                            );
                            core.scale.y = 0.6;
                            lettuceGroup.add(core);

                            // Multiple leaves
                            for (let lf = 0; lf < 6; lf++) {
                                const leaf = new THREE.Mesh(
                                    new THREE.PlaneGeometry(sz * 0.8, sz * 0.9),
                                    new THREE.MeshStandardMaterial({
                                        color: ingMat.color,
                                        side: THREE.DoubleSide,
                                        roughness: 0.9
                                    })
                                );
                                const angle = (lf / 6) * Math.PI * 2;
                                leaf.position.set(
                                    Math.cos(angle) * sz * 0.5,
                                    0.02,
                                    Math.sin(angle) * sz * 0.5
                                );
                                leaf.rotation.set(-Math.PI / 3, angle, (Math.random() - 0.5) * 0.3);
                                lettuceGroup.add(leaf);
                            }
                            ingMesh = lettuceGroup;

                        } else if (st.ingredient === 'cheese') {
                            ingMesh = new THREE.Mesh(new THREE.CylinderGeometry(sz * 0.8, sz * 0.8, 0.08, 3), ingMat);
                        } else if (st.ingredient === 'egg') {
                            const eggGroup = new THREE.Group();
                            const egg = new THREE.Mesh(new THREE.SphereGeometry(sz * 0.6, 12, 12), ingMat);
                            egg.scale.set(0.7, 1, 0.7);
                            eggGroup.add(egg);

                            // Speckles
                            for (let sp = 0; sp < 3; sp++) {
                                const speckle = new THREE.Mesh(
                                    new THREE.SphereGeometry(0.003, 4, 4),
                                    new THREE.MeshStandardMaterial({
                                        color: 0xD4A574,
                                        transparent: true,
                                        opacity: 0.4
                                    })
                                );
                                const angle = Math.random() * Math.PI * 2;
                                speckle.position.set(
                                    Math.cos(angle) * sz * 0.4,
                                    (Math.random() - 0.5) * sz * 0.8,
                                    Math.sin(angle) * sz * 0.4
                                );
                                eggGroup.add(speckle);
                            }
                            ingMesh = eggGroup;

                        } else if (st.ingredient === 'dough') {
                            const doughGroup = new THREE.Group();
                            const dough = new THREE.Mesh(new THREE.SphereGeometry(sz, 12, 12), ingMat);
                            dough.scale.y = 0.55;
                            doughGroup.add(dough);

                            // Flour dusting
                            for (let f = 0; f < 5; f++) {
                                const flour = new THREE.Mesh(
                                    new THREE.SphereGeometry(0.008, 6, 6),
                                    new THREE.MeshStandardMaterial({
                                        color: 0xFFFFF0,
                                        transparent: true,
                                        opacity: 0.5
                                    })
                                );
                                const angle = Math.random() * Math.PI * 2;
                                flour.position.set(
                                    Math.cos(angle) * sz * 0.8,
                                    (Math.random() - 0.5) * sz * 0.4,
                                    Math.sin(angle) * sz * 0.8
                                );
                                doughGroup.add(flour);
                            }
                            ingMesh = doughGroup;

                        } else if (st.ingredient === 'bread') {
                            const breadGroup = new THREE.Group();
                            const bun = new THREE.Mesh(
                                new THREE.SphereGeometry(sz * 0.9, 16, 12),
                                ingMat
                            );
                            bun.scale.y = 0.6;
                            breadGroup.add(bun);

                            // Sesame seeds
                            for (let s = 0; s < 4; s++) {
                                const seed = new THREE.Mesh(
                                    new THREE.SphereGeometry(0.006, 6, 4),
                                    new THREE.MeshStandardMaterial({ color: 0xFFFACD })
                                );
                                const angle = (s / 4) * Math.PI * 2;
                                seed.position.set(
                                    Math.cos(angle) * sz * 0.3,
                                    sz * 0.6,
                                    Math.sin(angle) * sz * 0.3
                                );
                                breadGroup.add(seed);
                            }
                            ingMesh = breadGroup;

                        } else {
                            ingMesh = new THREE.Mesh(new THREE.SphereGeometry(sz, 8, 8), ingMat);
                        }

                        if (ingMesh) {
                            // Stack in layers INSIDE the crate (lower Y position)
                            const layer = Math.floor(item / 4); // 4 per layer
                            const layerY = 0.12 + layer * 0.08; // Start lower, inside the crate
                            ingMesh.position.set(
                                (Math.random() - 0.5) * boxSz * 1.1, // Slightly tighter spread
                                layerY,
                                (Math.random() - 0.5) * boxSz * 1.1
                            );
                            ingMesh.rotation.set(
                                Math.random() * 0.3,
                                Math.random() * Math.PI,
                                Math.random() * 0.3
                            );
                            ingGroup.add(ingMesh);
                        }
                    }
                }
                // Rice sack contents are built into the sack shape above

                group.add(ingGroup);
            }
            // Labels removed - now using door stickers instead
        }

        if (st.type === 'chopping') {
            // --- CLEAN MODERN CHOPPING STATION ---

            // Wooden cutting board - simple and clean
            const boardGroup = new THREE.Group();
            boardGroup.name = 'choppingBoard';

            // Main cutting board - thick wooden block
            const boardMat = new THREE.MeshStandardMaterial({
                color: 0xB8956A,
                roughness: 0.75,
                metalness: 0.0
            });
            const board = new THREE.Mesh(
                new THREE.BoxGeometry(this.ts * 0.65, 0.06, this.ts * 0.5),
                boardMat
            );
            board.position.y = baseH + 0.06;
            board.castShadow = true;
            board.receiveShadow = true;
            boardGroup.add(board);

            // Simple border groove
            const grooveMat = new THREE.MeshStandardMaterial({
                color: 0x8B6F47,
                roughness: 0.85
            });
            const groove = new THREE.Mesh(
                new THREE.BoxGeometry(this.ts * 0.60, 0.004, this.ts * 0.45),
                grooveMat
            );
            groove.position.y = baseH + 0.091;
            boardGroup.add(groove);

            group.add(boardGroup);

            // Premium Japanese Nakiri Knife (Vegetable Cleaver)
            const knifeGroup = new THREE.Group();
            knifeGroup.name = 'knife';

            // High-carbon Damascus Steel Blade
            const bladeMat = new THREE.MeshStandardMaterial({
                color: 0xa0a0a0,
                metalness: 0.9,
                roughness: 0.2
            });
            const blade = new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 0.01, 0.22),
                bladeMat
            );
            blade.position.set(0.12, 0, 0);
            blade.castShadow = true;
            knifeGroup.add(blade);

            // Sharp Beveled Edge (Shiny Silver, facing +Z)
            const edgeMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                metalness: 1.0,
                roughness: 0.05,
                emissive: 0x222222
            });
            const edge = new THREE.Mesh(
                new THREE.BoxGeometry(0.405, 0.006, 0.06),
                edgeMat
            );
            edge.position.set(0.12, 0, 0.10);
            knifeGroup.add(edge);

            // Granton edge dimples (prevents food from sticking)
            const dimpleMat = new THREE.MeshStandardMaterial({
                color: 0x777777,
                metalness: 0.8,
                roughness: 0.5
            });
            for (let i = 0; i < 4; i++) {
                const dimple = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.015, 0.015, 0.012, 8),
                    dimpleMat
                );
                dimple.rotation.x = Math.PI / 2;
                dimple.position.set(0.0 + i * 0.07, 0, 0.04);
                knifeGroup.add(dimple);
            }

            // Octagonal Wooden Handle (Rosewood)
            const handleMat = new THREE.MeshStandardMaterial({
                color: 0x2e1105,
                roughness: 0.8
            });
            const handle = new THREE.Mesh(
                new THREE.CylinderGeometry(0.035, 0.045, 0.26, 8),
                handleMat
            );
            handle.rotation.z = Math.PI / 2;
            handle.rotation.x = Math.PI / 8; // show flat face on top
            handle.position.set(-0.21, 0, -0.02); // shifted toward spine
            handle.castShadow = true;
            knifeGroup.add(handle);

            // Polished Brass Bolster
            const bolsterMat = new THREE.MeshStandardMaterial({
                color: 0xd4af37,
                metalness: 0.9,
                roughness: 0.2
            });
            const bolster = new THREE.Mesh(
                new THREE.CylinderGeometry(0.04, 0.037, 0.06, 8),
                bolsterMat
            );
            bolster.rotation.z = Math.PI / 2;
            bolster.rotation.x = Math.PI / 8;
            bolster.position.set(-0.05, 0, -0.02);
            bolster.castShadow = true;
            knifeGroup.add(bolster);

            // Position knife - resting gently beside board
            knifeGroup.position.set(this.ts * 0.25, baseH + 0.1, -this.ts * 0.2);
            knifeGroup.rotation.x = 0;
            knifeGroup.rotation.y = 0.3; // Slight angle resting
            knifeGroup.rotation.z = 0;
            knifeGroup.castShadow = true;
            group.add(knifeGroup);
        }

        if (st.type === 'roller') {
            // Rolling Pin Model - LYING FLAT (pa-higa) on the counter surface
            const rollerGroup = new THREE.Group();
            rollerGroup.name = 'rollingPin';

            // Main pin body - cylinder along X axis (lying flat, facing front)
            const pinGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.65, 16);
            const pinMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.7 });
            const pin = new THREE.Mesh(pinGeo, pinMat);
            // Rotate to lie flat along X axis (horizontal, facing front)
            pin.rotation.z = Math.PI / 2;
            pin.castShadow = true;
            rollerGroup.add(pin);

            // Handles (dark wood, also lying flat along X)
            const hMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.6 });
            const handleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.18, 12);
            const hl = new THREE.Mesh(handleGeo, hMat);
            hl.rotation.z = Math.PI / 2;
            hl.position.x = -0.42;
            const hr = new THREE.Mesh(handleGeo, hMat);
            hr.rotation.z = Math.PI / 2;
            hr.position.x = 0.42;
            rollerGroup.add(hl, hr);

            // Position just above the counter surface (lying flat on top)
            rollerGroup.position.set(0, baseH + 0.12, 0);
            group.add(rollerGroup);
        }

        if (st.type === 'serve') {
            // --- ELEGANT RESTAURANT SERVING STATION ---
            const steelMat = new THREE.MeshStandardMaterial({ color: 0xE8E8E8, roughness: 0.15, metalness: 0.85 });
            const darkMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.5 });
            const goldMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.9, roughness: 0.1 });
            const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });

            // Premium counter base
            if (mesh) mesh.material = new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.3, metalness: 0.2 });
            if (top) top.material = steelMat;

            // Decorative trim around counter edge
            const trim = new THREE.Mesh(
                new THREE.TorusGeometry(this.ts * 0.46, 0.015, 8, 32),
                goldMat
            );
            trim.rotation.x = Math.PI / 2;
            trim.position.y = baseH + 0.05;
            group.add(trim);

            // 1. Service Bell (Corner)
            const bellGroup = new THREE.Group();
            const bellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.025, 16), darkMat);
            const bellBody = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), goldMat);
            bellBody.position.y = 0.02;
            const bellBtn = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), darkMat);
            bellBtn.position.y = 0.08;
            bellGroup.add(bellBase, bellBody, bellBtn);
            bellGroup.position.set(this.ts * 0.35, baseH + 0.05, this.ts * 0.35);
            group.add(bellGroup);

            // 2. Order Ticket Rail (Premium)
            const railBase = new THREE.Mesh(
                new THREE.BoxGeometry(this.ts * 0.85, 0.04, 0.05),
                new THREE.MeshStandardMaterial({ color: 0x95a5a6, metalness: 0.7, roughness: 0.2 })
            );
            railBase.position.set(0, baseH + 0.08, -this.ts * 0.38);
            group.add(railBase);

            // Hanging clips
            for (let i = 0; i < 4; i++) {
                const clip = new THREE.Mesh(
                    new THREE.BoxGeometry(0.03, 0.06, 0.02),
                    new THREE.MeshStandardMaterial({ color: 0x7f8c8d, metalness: 0.8 })
                );
                clip.position.set(-0.3 + i * 0.2, baseH + 0.06, -this.ts * 0.38);
                group.add(clip);
            }

            // Order tickets
            for (let i = 0; i < 3; i++) {
                const paper = new THREE.Mesh(
                    new THREE.BoxGeometry(0.16, 0.22, 0.005),
                    new THREE.MeshStandardMaterial({ color: 0xFFFFF0, roughness: 0.8 })
                );
                paper.position.set(-0.25 + i * 0.22, baseH + 0.061, -this.ts * 0.28);
                paper.rotation.x = -Math.PI / 2.2;
                paper.rotation.y = (i - 1) * 0.1;
                group.add(paper);

                // Printed text lines
                for (let line = 0; line < 3; line++) {
                    const text = new THREE.Mesh(
                        new THREE.PlaneGeometry(0.12, 0.015),
                        new THREE.MeshStandardMaterial({ color: 0x333333 })
                    );
                    text.position.copy(paper.position);
                    text.position.y += 0.001;
                    text.position.z += 0.05 - line * 0.03;
                    text.rotation.copy(paper.rotation);
                    group.add(text);
                }
            }

            // 3. Elegant Serving Display
            const displayGroup = new THREE.Group();

            // Large decorative plate (white porcelain)
            const plateMat = new THREE.MeshStandardMaterial({
                color: 0xFFFFF8,
                roughness: 0.1,
                metalness: 0.1
            });
            const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.42, 0.035, 48), plateMat);
            plate.position.y = baseH + 0.068;
            displayGroup.add(plate);

            // Gold rim on plate
            const plateRim = new THREE.Mesh(
                new THREE.TorusGeometry(0.44, 0.008, 8, 48),
                goldMat
            );
            plateRim.rotation.x = Math.PI / 2;
            plateRim.position.y = baseH + 0.088;
            displayGroup.add(plateRim);

            // Silver utensils (crossed elegantly)
            const silverMat = new THREE.MeshStandardMaterial({
                color: 0xC0C0C0,
                metalness: 0.95,
                roughness: 0.05
            });

            // Fork (left side)
            const fork = new THREE.Group();
            const fHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.6, 12), silverMat);
            fHandle.position.y = 0.3;
            fork.add(fHandle);

            const fHead = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.025), silverMat);
            fHead.position.y = 0.62;
            fork.add(fHead);

            for (let p = 0; p < 4; p++) {
                const prong = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.14, 0.025), silverMat);
                prong.position.set(-0.055 + p * 0.037, 0.72, 0);
                fork.add(prong);
            }
            fork.rotation.x = -Math.PI / 2;
            fork.rotation.z = 0.5;
            fork.position.set(-0.15, baseH + 0.11, -0.05);
            displayGroup.add(fork);

            // Knife (center)
            const knife = new THREE.Group();
            const kHandle = new THREE.Mesh(
                new THREE.CylinderGeometry(0.018, 0.022, 0.5, 12),
                woodMat
            );
            kHandle.position.y = 0.25;
            knife.add(kHandle);

            const blade = new THREE.Mesh(
                new THREE.BoxGeometry(0.04, 0.45, 0.008),
                silverMat
            );
            blade.position.y = 0.73;
            knife.add(blade);

            // Blade edge (sharp)
            const bladeEdge = new THREE.Mesh(
                new THREE.BoxGeometry(0.005, 0.45, 0.008),
                new THREE.MeshStandardMaterial({ color: 0xFFFFFF, metalness: 1.0, roughness: 0.0 })
            );
            bladeEdge.position.set(0.02, 0.73, 0);
            knife.add(bladeEdge);

            knife.rotation.x = -Math.PI / 2;
            knife.position.set(0, baseH + 0.11, 0);
            displayGroup.add(knife);

            // Spoon (right side)
            const spoon = new THREE.Group();
            const sHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.6, 12), silverMat);
            sHandle.position.y = 0.3;
            spoon.add(sHandle);

            const sHead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), silverMat);
            sHead.scale.set(1.3, 1.8, 0.4);
            sHead.position.y = 0.64;
            spoon.add(sHead);

            spoon.rotation.x = -Math.PI / 2;
            spoon.rotation.z = -0.5;
            spoon.position.set(0.15, baseH + 0.11, 0.05);
            displayGroup.add(spoon);

            group.add(displayGroup);
        }
        if (st.type === 'trash') {
            // --- LARGE COUNTER-SIZED TRASH BIN (no label, fills tile) ---
            const trashGroup = new THREE.Group();
            const sz = this.ts * 0.88; // Full counter footprint width

            // Body (big square metal box matching counter height)
            const canMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.25, metalness: 0.75 });
            const canBody = new THREE.Mesh(new THREE.BoxGeometry(sz, baseH * 0.95, sz), canMat);
            canBody.position.y = baseH * 0.95 / 2;
            canBody.castShadow = true;
            trashGroup.add(canBody);

            // Green accent band at mid-height
            const bandMat = new THREE.MeshStandardMaterial({ color: 0x32CD32, roughness: 0.4, metalness: 0.3 });
            const band = new THREE.Mesh(new THREE.BoxGeometry(sz + 0.01, 0.09, sz + 0.01), bandMat);
            band.position.y = baseH * 0.95 * 0.42;
            trashGroup.add(band);

            // Yellow warning label panel on front
            const panelMat = new THREE.MeshStandardMaterial({ color: 0xFFCC00, roughness: 0.5 });
            const panel = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.45, sz * 0.22, 0.012), panelMat);
            panel.position.set(0, baseH * 0.55, sz * 0.501);
            trashGroup.add(panel);

            // Little black X on the panel
            const xMat = new THREE.MeshStandardMaterial({ color: 0x006400, roughness: 0.8 });
            const xBar1 = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.2, 0.015, 0.013), xMat);
            xBar1.rotation.z = Math.PI / 4;
            xBar1.position.set(0, baseH * 0.55, sz * 0.508);
            trashGroup.add(xBar1);
            const xBar2 = xBar1.clone();
            xBar2.rotation.z = -Math.PI / 4;
            xBar2.position.set(0, baseH * 0.55, sz * 0.509);
            trashGroup.add(xBar2);

            // Interior (visible dark top) - REMOVED to make hollow
            // const interiorMat = new THREE.MeshStandardMaterial({ color: 0x006400, roughness: 1.0 });
            // const interior = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.93, baseH * 0.92, sz * 0.93), interiorMat);
            // interior.position.y = baseH * 0.90 / 2 + 0.02;
            // trashGroup.add(interior);

            // Green bag neck visible at top - REMOVED to make hollow
            // const bagMat = new THREE.MeshStandardMaterial({ color: 0x006400, roughness: 0.9 });
            // const bag = new THREE.Mesh(new THREE.CylinderGeometry(sz * 0.25, sz * 0.35, sz * 0.18, 8), bagMat);
            // bag.position.y = baseH * 0.945;
            // trashGroup.add(bag);

            // LID GROUP (hinged at back edge)
            const lidGroup = new THREE.Group();
            lidGroup.name = 'trashLid';
            lidGroup.position.set(0, baseH * 0.955, -sz * 0.41);
            trashGroup.add(lidGroup);

            const lidMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.2, metalness: 0.88 });
            const lid = new THREE.Mesh(new THREE.BoxGeometry(sz + 0.02, 0.055, sz + 0.02), lidMat);
            lid.position.set(0, 0.028, sz * 0.41);
            lidGroup.add(lid);

            // Lid handle (wide bar on top)
            const handleMat = new THREE.MeshStandardMaterial({ color: 0x006400, metalness: 0.95 });
            const lHandle = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.35, 0.045, 0.06), handleMat);
            lHandle.position.set(0, 0.065, sz * 0.41);
            lidGroup.add(lHandle);

            // --- RECYCLE SYMBOL STICKER on lid ---
            // Load the recycle image texture
            const textureLoader = new THREE.TextureLoader();
            const recycleTexture = textureLoader.load('/assets/triangular-arrows-sign-for-recycle.png');

            const recycleMat = new THREE.MeshStandardMaterial({
                map: recycleTexture,
                transparent: true,
                roughness: 0.3,
                metalness: 0.2
            });

            // Create sticker mesh (circular) on top of lid
            const stickerSize = sz * 0.35;
            const recycleSticker = new THREE.Mesh(
                new THREE.CircleGeometry(stickerSize, 32),
                recycleMat
            );
            recycleSticker.position.set(0, 0.058, sz * 0.41);
            recycleSticker.rotation.x = -Math.PI / 2;
            lidGroup.add(recycleSticker);

            // Foot pedal at base
            const pedalMat = new THREE.MeshStandardMaterial({ color: 0x006400, metalness: 0.75 });
            const pedal = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.4, 0.035, sz * 0.22), pedalMat);
            pedal.position.set(0, 0.018, sz * 0.48);
            trashGroup.add(pedal);

            group.add(trashGroup);
            // NO emoji label

            // Store lid for animation
            this.stationEffects[st.id] = { lidGroup, lidAngle: 0, lidOpen: false };
        }
        if (st.type === 'plates') {
            // ======================================
            // PROFESSIONAL PLATE DISPENSER
            // ======================================
            const plateGroup = new THREE.Group();
            const plateBodyMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.8, roughness: 0.1 });
            const chromeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.05 });
            const platformMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, metalness: 0.5, roughness: 0.5 });

            const pSz = this.ts * 0.42;
            const pBaseH = baseH * 0.7;

            // 1. Stainless Steel Cylinder Body
            const dispenserBody = new THREE.Mesh(new THREE.CylinderGeometry(pSz, pSz, pBaseH, 24), plateBodyMat);
            dispenserBody.position.y = pBaseH / 2;
            dispenserBody.castShadow = true;
            plateGroup.add(dispenserBody);

            // 2. Square Base Plate (Footing)
            const footing = new THREE.Mesh(new THREE.BoxGeometry(this.ts * 0.9, 0.08, this.ts * 0.9), plateBodyMat);
            footing.position.y = 0.04;
            plateGroup.add(footing);

            // 3. Chrome Side Rails (4 guarding posts)
            const railGeo = new THREE.CylinderGeometry(0.015, 0.015, baseH * 0.9, 8);
            const railDistance = pSz * 0.95;
            for (let r = 0; r < 4; r++) {
                const rail = new THREE.Mesh(railGeo, chromeMat);
                const a = (r / 4) * Math.PI * 2 + Math.PI / 4;
                rail.position.set(Math.cos(a) * railDistance, baseH * 0.45, Math.sin(a) * railDistance);
                rail.castShadow = true;
                plateGroup.add(rail);
            }

            // 4. Spring-loaded Platform
            const platform = new THREE.Mesh(new THREE.CylinderGeometry(pSz * 0.9, pSz * 0.9, 0.1, 24), platformMat);
            platform.position.y = pBaseH + 0.1;
            plateGroup.add(platform);

            // 5. Tall Stack of Premium Plates
            const platesInStack = 6;
            for (let i = 0; i < platesInStack; i++) {
                const plateH = 0.045;
                const pGroup = new THREE.Group();

                // Plate Base
                const pMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.1 });
                const pMesh = new THREE.Mesh(new THREE.CylinderGeometry(pSz * 0.85, pSz * 0.75, plateH, 24), pMat);
                pMesh.position.y = pBaseH + 0.15 + (i * 0.06);
                pMesh.castShadow = true;
                pGroup.add(pMesh);

                // Plate Rim (slightly larger top)
                const rim = new THREE.Mesh(new THREE.TorusGeometry(pSz * 0.82, 0.02, 8, 24), pMat);
                rim.rotation.x = Math.PI / 2;
                rim.position.y = pBaseH + 0.15 + (i * 0.06) + plateH / 2;
                pGroup.add(rim);

                plateGroup.add(pGroup);
            }

            // 6. Clean/Sparkle Indicator (Emoji)
            this.addLabel(plateGroup, '🧼', baseH + 0.6);

            mesh = plateGroup;
            group.add(plateGroup);
            top = null; // No default top
        }
        if (st.type === 'sink') {
            // --- REALISTIC SINK MODEL ---
            // Basin (recessed)
            const basinGeo = new THREE.BoxGeometry(this.ts * 0.7, 0.3, this.ts * 0.7);
            const basinMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.6, roughness: 0.2 });
            const basin = new THREE.Mesh(basinGeo, basinMat);
            basin.position.y = baseH - 0.05;
            group.add(basin);

            // Inner basin (dark)
            const innerGeo = new THREE.BoxGeometry(this.ts * 0.55, 0.25, this.ts * 0.55);
            const innerMat = new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.3 });
            const inner = new THREE.Mesh(innerGeo, innerMat);
            inner.position.y = baseH + 0.02;
            group.add(inner);

            // Water surface (inside basin)
            const waterGeo = new THREE.PlaneGeometry(this.ts * 0.5, this.ts * 0.5);
            const waterMat = new THREE.MeshStandardMaterial({
                color: 0x3498db, transparent: true, opacity: 0.4, roughness: 0.0, metalness: 0.3
            });
            const water = new THREE.Mesh(waterGeo, waterMat);
            water.rotation.x = -Math.PI / 2;
            water.position.y = baseH + 0.05;
            water.name = 'sinkWater';
            group.add(water);

            // Faucet pipe (vertical) at the back
            const pipeMat = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.8, roughness: 0.2 });
            const pipeGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 12);
            const pipe = new THREE.Mesh(pipeGeo, pipeMat);
            pipe.position.set(0, baseH + 0.4, -this.ts * 0.35); // Move to the BACK
            group.add(pipe);

            // Faucet spout (curved pipe)
            const spoutGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.3, 12);
            const spout = new THREE.Mesh(spoutGeo, pipeMat);
            spout.rotation.x = -Math.PI / 2.5; // Curving backward properly into sink
            spout.position.set(0, baseH + 0.65, -this.ts * 0.2);
            group.add(spout);

            // Faucet tip (nozzle)
            const nozzleGeo = new THREE.CylinderGeometry(0.02, 0.035, 0.08, 8);
            const nozzle = new THREE.Mesh(nozzleGeo, pipeMat);
            nozzle.position.set(0, baseH + 0.55, -0.05);
            group.add(nozzle);

            // Handles (left/right knobs)
            const knobGeo = new THREE.SphereGeometry(0.04, 8, 8);
            const knobMatR = new THREE.MeshStandardMaterial({ color: 0xe74c3c, metalness: 0.5 });
            const knobMatB = new THREE.MeshStandardMaterial({ color: 0x3498db, metalness: 0.5 });
            const knobL = new THREE.Mesh(knobGeo, knobMatR);
            knobL.position.set(-0.15, baseH + 0.45, -this.ts * 0.35); // Back left
            const knobR = new THREE.Mesh(knobGeo, knobMatB);
            knobR.position.set(0.15, baseH + 0.45, -this.ts * 0.35); // Back right
            group.add(knobL, knobR);

            this.stationEffects[st.id] = { water, waterMat };
        }

        group.position.set(x, 0, z);

        // --- AUTO-ROTATION: Face station toward nearest walkable path ---
        if (this.layout && st.type !== 'counter') {
            const gx = st.gridX;
            const gz = st.gridZ;
            const gw = this.config.GRID_W;
            const gh = this.config.GRID_H;

            // Check 4 cardinal neighbors for open floor tiles (0 = floor)
            // Priority: South > East > West > North
            const neighbors = [
                { dx: 0, dz: 1, angle: 0 },             // Path is South (+Z) -> face South (0)
                { dx: 1, dz: 0, angle: Math.PI / 2 },    // Path is East (+X)  -> face East (PI/2)
                { dx: -1, dz: 0, angle: -Math.PI / 2 },   // Path is West (-X) -> face West (-PI/2)
                { dx: 0, dz: -1, angle: Math.PI }        // Path is North (-Z) -> face North (PI)
            ];

            let bestAngle = 0; // Default: face south (toward camera)
            let found = false;

            for (const n of neighbors) {
                const nx = gx + n.dx;
                const nz = gz + n.dz;
                if (nx >= 0 && nx < gw && nz >= 0 && nz < gh) {
                    if (this.layout[nz] && this.layout[nz][nx] === 0) {
                        bestAngle = n.angle;
                        found = true;
                        break;
                    }
                }
            }

            group.rotation.y = bestAngle;
        }

        // Create UI container that counter-rotates for progress bars
        const uiContainer = new THREE.Group();
        uiContainer.name = 'uiContainer';
        uiContainer.rotation.y = -group.rotation.y;
        group.add(uiContainer);

        // --- SEASONING LABELS ---
        if (st.type === 'seasoning') {
            const labelText = st.ingredient === 'salt' ? 'SALT' : 'SAUCE';
            const labelColor = st.ingredient === 'salt' ? 0xFFFFFF : 0xFFD700;
            this.addLabel(uiContainer, labelText, 1.2, 'seasoningLabel');
        }

        this.scene.add(group);
        this.stationMeshes[st.id] = { group, baseMesh: mesh, topMesh: top, uiContainer };
    }

    addLabel(group, text, y, name = null) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 48px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;
        ctx.strokeText(text, 128, 64);
        ctx.fillText(text, 128, 64);
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.position.y = y;
        sprite.scale.set(2.0, 1.0, 1);
        if (name) {
            sprite.name = name;
            sprite.visible = false;
        }
        group.add(sprite);
    }

    updateStation(stationId, stationData) {
        const sm = this.stationMeshes[stationId];
        if (!sm) return;
        const eff = this.stationEffects[stationId];

        // --- STOVE GLOW & LOGIC ---
        if (eff && eff.glowMat && stationData.type === 'stove') {
            if (stationData.contents) {
                const prog = stationData.cookProgress || 0;
                if (stationData.isBurning) {
                    eff.glowMat.color.set(0xff0000);
                    eff.glowMat.opacity = 0.8 + Math.sin(Date.now() * 0.01) * 0.2;
                } else if (prog > 100) {
                    const overFactor = Math.min((prog - 100) / 35, 1.0);
                    eff.glowMat.color.set(0xff6600).lerp(new THREE.Color(0xff0000), overFactor);
                    eff.glowMat.opacity = 0.5 + overFactor * 0.3;
                } else if (prog > 0) {
                    eff.glowMat.color.set(0xff6600);
                    eff.glowMat.opacity = Math.min(prog / 100, 0.5);
                }
            } else {
                eff.glowMat.opacity = 0;
            }
        }

        if (eff && eff.glowMat && stationData.type === 'oven') {
            if (stationData.contents) {
                const prog = stationData.cookProgress || 0;
                eff.glowMat.opacity = 0.4 + (Math.sin(Date.now() * 0.005) * 0.2) + (prog / 100) * 0.4;
            } else {
                eff.glowMat.opacity = 0.2;
            }
        }

        // Show/hide contents indicator
        const existing = sm.group.getObjectByName('contents');
        if (existing) sm.group.remove(existing);

        // DON'T create contents for crate stations (ingredients are stored inside, not displayed)
        if (stationData.contents && stationData.type !== 'crate') {
            const cont = this.createContentMesh(stationData.contents);
            cont.name = 'contents';

            // Adjust height based on vessel/oven
            let offsetY = 1.05;
            if (stationData.type === 'stove') {
                const name = stationData.contents.name;
                const isPot = name === 'rice' || name === 'mushroom' || name === 'onion' ||
                    (name === 'tomato' && stationData.contents.chopped);
                offsetY = isPot ? 1.35 : 1.15;
            } else if (stationData.type === 'oven') {
                offsetY = 1.25; // Inside the tall brick oven dome
            }
            cont.position.y = offsetY;

            // --- DYNAMIC BURNT LOOK (5s Progress Window) ---
            const cookP = stationData.cookProgress || 0;
            if (cookP > 100 || stationData.isBurning) {
                // Starts turning black at 100%, FULL BLACK by 200% (5s after done)
                const charFactor = Math.min((cookP - 100) / 100, 1.0);

                cont.traverse(child => {
                    if (child.isMesh && child.name !== 'plate' && child.geometry.type !== 'CylinderGeometry') {
                        child.material = child.material.clone();
                        child.material.color.lerp(new THREE.Color(0x000000), charFactor);
                        child.material.roughness = 1.0;
                    }
                });
            }

            // Floating animation for finished cooking items (if not using vessel)
            if (stationData.type === 'stove' && stationData.contents.cooked && !stationData.isBurning) {
                // cont.position.y += 0.2;
            }

            // --- ROLLING FLATTEN EFFECT ---
            if (stationData.type === 'roller' && stationData.contents.name === 'dough') {
                const rp = stationData.rollProgress || 0;
                const flatten = 1.0 - (rp / 100) * 0.8;
                const spread = 1.0 + (rp / 100) * 0.8;
                cont.scale.set(spread, flatten, spread);
                cont.position.y = 0.9 + (flatten * 0.1);
            }

            cont.castShadow = true;
            sm.group.add(cont);
        }

        // --- Rolling Pin Animation Trigger ---
        if (stationData.type === 'roller') {
            const pin = sm.group.getObjectByName('rollingPin');
            if (pin) {
                const isRolling = stationData.contents && stationData.rollProgress < 100;
                if (isRolling) {
                    sm.lastRollUpdate = Date.now();
                    pin.rotation.y += 0.1; // Rotate along its length when rolling
                }
            }
        }

        // --- Stove Vessel Logic (Recipe-Aware) ---
        if (stationData.type === 'stove') {
            const pan = sm.group.getObjectByName('vessel_pan');
            const pot = sm.group.getObjectByName('vessel_pot');

            if (pan) pan.visible = false;
            if (pot) pot.visible = false;

            if (stationData.contents) {
                // RECIPE-AWARE VESSEL SELECTION:
                // Kaldero/Pot: rice, soup ingredients (tomato+onion+mushroom combo), fish soup
                // Frying Pan: meat, egg, individual fry items
                const name = stationData.contents.name;
                const isPot = name === 'rice' ||       // Kaldero for rice
                    name === 'mushroom' ||              // Soup/stew ingredients → pot
                    name === 'onion' ||                 // Soup/stew ingredients → pot
                    (name === 'tomato' && stationData.contents.chopped); // Chopped tomato for soup → pot

                if (isPot && pot) pot.visible = true;
                else if (pan) pan.visible = true;
            }
        }

        // Chop visuals
        if (stationData.type === 'chopping') {
            const knife = sm.group.getObjectByName('knife');
            if (knife) {
                const isActivelyChopping = stationData.contents &&
                    stationData.contents.type === 'ingredient' &&
                    !stationData.contents.chopped &&
                    stationData.chopProgress > 0 &&
                    stationData.chopProgress < 100;

                if (isActivelyChopping) {
                    sm.lastChopUpdate = Date.now();
                }
            }
        }

        // --- COOKING PROGRESS BAR LOGIC (STOVE & OVEN) ---
        const ui = sm.uiContainer || sm.group; // Use counter-rotated container
        const isCooking = (stationData.type === 'stove' || stationData.type === 'oven') && (stationData.cookProgress > 0 || stationData.isBurning);
        const isOven = stationData.type === 'oven';
        const cookBarY = isOven ? 3.8 : 1.8; // Oven bar raised higher
        const readyIconY = isOven ? 4.8 : 2.5;
        const warnIconY = isOven ? 5.3 : 3.0;

        if (isCooking) {
            const expBar = ui.getObjectByName('cookBar');
            if (expBar) ui.remove(expBar);
            const expBg = ui.getObjectByName('cookBarBg');
            if (expBg) ui.remove(expBg);
            const expWarn = ui.getObjectByName('burnWarn');
            if (expWarn) ui.remove(expWarn);
            const expReady = ui.getObjectByName('stoveReadyIcon');
            if (expReady) ui.remove(expReady);

            if (stationData.contents) {
                const bgGeo = new THREE.BoxGeometry(this.ts * 0.82, 0.12, 0.18);
                const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
                const bg = new THREE.Mesh(bgGeo, bgMat);
                bg.name = 'cookBarBg';
                const barZ = isOven ? 0.8 : -0.6;
                bg.position.set(0, cookBarY, barZ);
                ui.add(bg);

                const p = Math.min(stationData.cookProgress / 100, 1.0);
                const barGeo = new THREE.BoxGeometry(this.ts * 0.8 * p, 0.08, 0.15);
                let color = new THREE.Color(0xf39c12);
                if (stationData.cookProgress > 100) color.setHex(0xc0392b);
                if (stationData.cookProgress >= 200 || stationData.isBurning) color.setHex(0x2d3436);

                const barMat = new THREE.MeshBasicMaterial({ color });
                const bar = new THREE.Mesh(barGeo, barMat);
                bar.name = 'cookBar';
                bar.position.set(-this.ts * 0.4 * (1 - p), cookBarY, barZ);
                ui.add(bar);

                if (stationData.cookProgress >= 100 && stationData.cookProgress < 200) {
                    this.addLabel(ui, '‼️', readyIconY);
                    const ready = ui.children[ui.children.length - 1];
                    ready.name = 'stoveReadyIcon';
                    ready.scale.set(2, 2, 1);
                }

                if (stationData.cookProgress > 140 || stationData.isBurning) {
                    this.addLabel(ui, stationData.isBurning ? '🔥' : '⚠️', warnIconY);
                    const warn = ui.children[ui.children.length - 1];
                    warn.name = 'burnWarn';
                    warn.scale.set(1.8, 1.8, 1);
                }
            }
        } else {
            const expBar = ui.getObjectByName('cookBar');
            if (expBar) ui.remove(expBar);
            const expBg = ui.getObjectByName('cookBarBg');
            if (expBg) ui.remove(expBg);
            const expWarn = ui.getObjectByName('burnWarn');
            if (expWarn) ui.remove(expWarn);
            const expReady = ui.getObjectByName('stoveReadyIcon');
            if (expReady) ui.remove(expReady);
        }

        // --- CHOPPING PROGRESS BAR LOGIC ---
        const isDoneChop = stationData.chopProgress >= 100 ||
            (stationData.contents && stationData.contents.type === 'ingredient' && stationData.contents.chopped);

        // Manage progress bar items cleanly without duplication
        const barObjs = ['chopBarGroup', 'chopBar', 'chopBarBg', 'chopBarBorder'];

        if (stationData.chopProgress > 0 && !isDoneChop) {
            // Actively chopping - remove old items out of caution
            barObjs.forEach(n => {
                const exist = ui.getObjectByName(n);
                if (exist) ui.remove(exist);
            });
            // Hide ready icon if present
            const oldReady = ui.getObjectByName('readyIcon');
            if (oldReady) ui.remove(oldReady);

            const barGroup = new THREE.Group();
            barGroup.name = 'chopBarGroup';
            barGroup.position.set(0, 1.6, -0.6); // slightly higher to see under knife clearly
            ui.add(barGroup);

            // Modern Sleek Background
            const bgW = this.ts * 0.8;
            const bgGeo = new THREE.BoxGeometry(bgW, 0.14, 0.1);
            const bgMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8 });
            const bg = new THREE.Mesh(bgGeo, bgMat);
            barGroup.add(bg);

            // Subdued Outer Border/Glow for pop without clipping
            const borderGeo = new THREE.BoxGeometry(bgW + 0.04, 0.18, 0.12);
            const borderMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.6 });
            const border = new THREE.Mesh(borderGeo, borderMat);
            border.position.z = -0.01;
            barGroup.add(border);

            // Progress Bar Fill
            const p = Math.min(stationData.chopProgress / 100, 1.0);
            const fillW = Math.max(0.01, (bgW - 0.04) * p); // Ensure width is not literally 0

            // Neon Color Transition (Red -> Yellow -> Green)
            const barColor = new THREE.Color();
            if (p < 0.3) {
                barColor.setHex(0xff3333).lerp(new THREE.Color(0xffaa00), p / 0.3);
            } else if (p < 0.7) {
                barColor.setHex(0xffaa00).lerp(new THREE.Color(0xccff00), (p - 0.3) / 0.4);
            } else {
                barColor.setHex(0xccff00).lerp(new THREE.Color(0x00ff00), (p - 0.7) / 0.3);
            }

            const barGeo = new THREE.BoxGeometry(fillW, 0.1, 0.12);
            const barMat = new THREE.MeshBasicMaterial({ color: barColor });
            const bar = new THREE.Mesh(barGeo, barMat);

            // Align correctly from the left
            const startX = -(bgW - 0.04) / 2;
            bar.position.set(startX + (fillW / 2), 0, 0.01);

            // Smooth pulse effect applied to the bar alone for energy
            const pulse = 1.0 + Math.sin(Date.now() * 0.02) * 0.05;
            bar.scale.set(1, pulse, 1);
            barGroup.add(bar);

            // 3D Glassy Highlight Shine
            const shineGeo = new THREE.BoxGeometry(fillW, 0.03, 0.13);
            const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
            const shine = new THREE.Mesh(shineGeo, shineMat);
            shine.position.set(0, 0.035, 0);
            bar.add(shine);

            const contentMesh = sm.group.getObjectByName('contents');
            if (contentMesh) {
                const intenseShake = 1 + Math.sin(Date.now() * 0.08) * 0.15;
                contentMesh.scale.set(intenseShake, 1 + Math.cos(Date.now() * 0.08) * 0.1, intenseShake);
            }
        } else if (isDoneChop && stationData.contents && stationData.type === 'chopping') {
            // Reached 100%, clean up progress bar completely
            barObjs.forEach(n => {
                const exist = ui.getObjectByName(n);
                if (exist) ui.remove(exist);
            });

            const existReady = ui.getObjectByName('readyIcon');
            if (!existReady) {
                this.addLabel(ui, '✅', 1.8);
                const newReady = ui.children[ui.children.length - 1];
                newReady.name = 'readyIcon';
                newReady.scale.set(1.5, 1.5, 1);
            }
        } else {
            // Nothing going on, remove everything
            barObjs.forEach(n => {
                const exist = ui.getObjectByName(n);
                if (exist) ui.remove(exist);
            });
            const oldReady = ui.getObjectByName('readyIcon');
            if (oldReady) ui.remove(oldReady);
        }

        // --- ROLLING PROGRESS BAR LOGIC ---
        const isDoneRoll = stationData.rollProgress >= 100 || (stationData.contents && stationData.contents.rolled);
        if (stationData.rollProgress > 0 || isDoneRoll) {
            const eb = ui.getObjectByName('rollBar'); if (eb) ui.remove(eb);
            const eg = ui.getObjectByName('rollBarBg'); if (eg) ui.remove(eg);

            if (!isDoneRoll) {
                const bgGeo = new THREE.BoxGeometry(this.ts * 0.82, 0.12, 0.18);
                const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
                const bg = new THREE.Mesh(bgGeo, bgMat);
                bg.name = 'rollBarBg';
                bg.position.set(0, 1.5, -0.6);
                ui.add(bg);

                const p = Math.min(stationData.rollProgress / 100, 1.0);
                const barGeo = new THREE.BoxGeometry(this.ts * 0.8 * p, 0.08, 0.15);
                const barMat = new THREE.MeshBasicMaterial({ color: 0x3498db });
                const bar = new THREE.Mesh(barGeo, barMat);
                bar.name = 'rollBar';
                bar.position.set(-this.ts * 0.4 * (1 - p), 1.5, -0.6);
                ui.add(bar);
            }

            if (isDoneRoll && stationData.contents && stationData.type === 'roller') {
                const er = ui.getObjectByName('rollReadyIcon');
                if (!er) {
                    this.addLabel(ui, '✅', 1.8);
                    const nr = ui.children[ui.children.length - 1];
                    nr.name = 'rollReadyIcon';
                }
            }
        } else {
            const eb = ui.getObjectByName('rollBar'); if (eb) ui.remove(eb);
            const eg = ui.getObjectByName('rollBarBg'); if (eg) ui.remove(eg);
            const er = ui.getObjectByName('rollReadyIcon'); if (er) ui.remove(er);
        }

        // --- WASHING PROGRESS BAR LOGIC ---
        const isDoneWash = stationData.washProgress >= 100 || (stationData.contents && stationData.contents.washed);
        if (stationData.type === 'sink' && (stationData.washProgress > 0 || isDoneWash)) {
            const ewb = ui.getObjectByName('washBar'); if (ewb) ui.remove(ewb);
            const ewg = ui.getObjectByName('washBarBg'); if (ewg) ui.remove(ewg);

            if (!isDoneWash) {
                const bgGeo = new THREE.BoxGeometry(this.ts * 0.82, 0.12, 0.18);
                const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
                const bg = new THREE.Mesh(bgGeo, bgMat);
                bg.name = 'washBarBg';
                bg.position.set(0, 1.5, -0.6);
                ui.add(bg);

                const p = Math.min(stationData.washProgress / 100, 1.0);
                const barGeo = new THREE.BoxGeometry(this.ts * 0.8 * p, 0.08, 0.15);
                const barMat = new THREE.MeshBasicMaterial({ color: 0x3498db });
                const bar = new THREE.Mesh(barGeo, barMat);
                bar.name = 'washBar';
                bar.position.set(-this.ts * 0.4 * (1 - p), 1.5, -0.6);
                ui.add(bar);
            }

            if (isDoneWash && stationData.contents && stationData.type === 'sink') {
                const ewr = ui.getObjectByName('washReadyIcon');
                if (!ewr) {
                    this.addLabel(ui, '✅', 1.8);
                    const nr = ui.children[ui.children.length - 1];
                    nr.name = 'washReadyIcon';
                }
            }
        } else if (stationData.type === 'sink') {
            const ewb = ui.getObjectByName('washBar'); if (ewb) ui.remove(ewb);
            const ewg = ui.getObjectByName('washBarBg'); if (ewg) ui.remove(ewg);
            const ewr = ui.getObjectByName('washReadyIcon'); if (ewr) ui.remove(ewr);
        }

        // --- GARNISH PROGRESS BAR LOGIC ---
        if (stationData.garnishProgress > 0) {
            const egb = ui.getObjectByName('garnishBar'); if (egb) ui.remove(egb);
            const egg = ui.getObjectByName('garnishBarBg'); if (egg) ui.remove(egg);

            const bgGeo = new THREE.BoxGeometry(this.ts * 0.82, 0.12, 0.18);
            const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
            const bg = new THREE.Mesh(bgGeo, bgMat);
            bg.name = 'garnishBarBg';
            bg.position.set(0, 1.8, -0.6);
            ui.add(bg);

            const p = Math.min(stationData.garnishProgress / 100, 1.0);
            const barGeo = new THREE.BoxGeometry(this.ts * 0.8 * p, 0.08, 0.15);
            const barMat = new THREE.MeshBasicMaterial({ color: 0x27ae60 }); // Green for garnish
            const bar = new THREE.Mesh(barGeo, barMat);
            bar.name = 'garnishBar';
            bar.position.set(-this.ts * 0.4 * (1 - p), 1.8, -0.6);
            ui.add(bar);
        } else {
            const egb = ui.getObjectByName('garnishBar'); if (egb) ui.remove(egb);
            const egg = ui.getObjectByName('garnishBarBg'); if (egg) ui.remove(egg);
        }

        // --- SINK WATER EFFECT ---
        if (stationData.type === 'sink') {
            const eff = this.stationEffects[stationId];
            if (eff && eff.waterMat) {
                if (stationData.contents && !stationData.contents.washed) {
                    // Washing in progress - make water more opaque and animated
                    eff.waterMat.opacity = 0.6 + Math.sin(Date.now() * 0.005) * 0.1;
                    eff.waterMat.color.setHex(0x85c1e9); // Lighter blue when active
                } else {
                    eff.waterMat.opacity = 0.3;
                    eff.waterMat.color.setHex(0x3498db);
                }
            }
        }

        // --- RARE SEASONING VISUAL (Timed Effect) ---
        const existingRS = sm.group.getObjectByName('rareSeasoningModel');
        if (existingRS) sm.group.remove(existingRS);

        if (stationData.type === 'seasoning' && stationData.rareSeasoning) {
            const bottle = this.createContentMesh({ type: 'seasoning', name: stationData.rareSeasoning });
            bottle.name = 'rareSeasoningModel';
            bottle.scale.set(1.2, 1.2, 1.2);
            // Position on top-right corner of the counter so it doesn't block plate slot
            bottle.position.set(0.3, 1.0, -0.3);
            sm.group.add(bottle);
        }
    }

    createContentMesh(content) {
        const group = new THREE.Group();

        if (content.type === 'seasoning') {
            // --- SEASONING BOTTLES V1 ---
            const sGroup = new THREE.Group();
            if (content.name === 'salt') {
                // Salt Shaker (Glass/Steel)
                const bodyGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.35, 12);
                const bodyMat = new THREE.MeshStandardMaterial({
                    color: 0xEEEEEE,
                    transparent: true,
                    opacity: 0.6,
                    roughness: 0
                });
                const body = new THREE.Mesh(bodyGeo, bodyMat);
                sGroup.add(body);

                const capGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 12);
                const capMat = new THREE.MeshStandardMaterial({ color: 0xBDC3C7, metalness: 0.8, roughness: 0.2 });
                const cap = new THREE.Mesh(capGeo, capMat);
                cap.position.y = 0.2;
                sGroup.add(cap);

                // Salt crystals inside
                for (let i = 0; i < 5; i++) {
                    const cryat = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: 0xFFFFFF }));
                    cryat.position.set((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.15);
                    sGroup.add(cryat);
                }
            } else {
                // Sauce Bottle (Red Squeeze Bottle)
                const sauceBodyGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.45, 16);
                const sauceMat = new THREE.MeshStandardMaterial({ color: 0xD32F2F, roughness: 0.4 });
                const sBody = new THREE.Mesh(sauceBodyGeo, sauceMat);
                sGroup.add(sBody);

                const nozzleGeo = new THREE.ConeGeometry(0.08, 0.2, 8);
                const sNozzle = new THREE.Mesh(nozzleGeo, sauceMat);
                sNozzle.position.y = 0.3;
                sGroup.add(sNozzle);

                // Label
                const label = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.15, 16), new THREE.MeshStandardMaterial({ color: 0xFFEB3B }));
                sGroup.add(label);
            }
            sGroup.scale.set(1.5, 1.5, 1.5);
            sGroup.userData.isSeasoning = true;
            return sGroup;
        } else if (content.type === 'ingredient') {
            // Ingredient logic follows
            const ing = this.config.INGREDIENTS[content.name];
            let color = new THREE.Color(ing ? ing.color : 0xffffff);

            if (content.burnt) {
                color.setHex(0x000000); // Pitch black if burnt
            } else if (content.cooked) {
                color.multiplyScalar(0.6); // Darken cooked food
                if (content.name === 'meat') color.setHex(0x8B4513); // Cooked meat color
            } else if (content.chopped) {
                if (content.name === 'fish') color.setHex(0xFFB6C1);
            }

            const mat = new THREE.MeshStandardMaterial({
                color: color.clone(),
                roughness: content.burnt ? 1.0 : 0.7
            });

            let mesh = new THREE.Group();

            if (content.chopped) {
                // --- SPECIALIZED CHOPPED LOGIC ---
                if (content.name === 'meat') {
                    // MEAT -> BURGER PATTY SHAPE
                    const patty = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 32), mat);
                    patty.position.y = 0.05;
                    mesh.add(patty);
                } else if (content.name === 'fish') {
                    // FISH -> SASHIMI SLICES (PINK RECTANGLES)
                    const slices = 4;
                    for (let i = 0; i < slices; i++) {
                        const slice = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.15), mat);
                        slice.position.set(0, 0.05 + (i * 0.06), (i - 1.5) * 0.05);
                        slice.rotation.y = Math.PI / 6;
                        mesh.add(slice);
                    }
                } else {
                    // Others use generic shards or specific shapes
                    const segs = 8;
                    for (let i = 0; i < segs; i++) {
                        let geo;
                        if (content.name === 'onion') {
                            geo = new THREE.TorusGeometry(0.12, 0.02, 16, 32);
                        } else if (content.name === 'lettuce') {
                            geo = new THREE.PlaneGeometry(0.2, 0.15);
                        } else {
                            geo = new THREE.BoxGeometry(0.1, 0.08, 0.1);
                        }
                        const p = new THREE.Mesh(geo, mat);
                        p.position.set((Math.random() - 0.5) * 0.4, 0.05 + (i * 0.03), (Math.random() - 0.5) * 0.4);
                        p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                        p.castShadow = true;
                        mesh.add(p);
                    }
                }
            } else {
                // --- DESIGNER 3D MODELS ---
                if (content.name === 'meat') {
                    // ULTRA T-BONE STEAK
                    const meatGroup = new THREE.Group();

                    // Main meat chunk
                    const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 16), mat);
                    core.scale.set(1.2, 0.45, 1);
                    meatGroup.add(core);

                    // Bone detail (White)
                    const boneMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
                    const bone = new THREE.Group();
                    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.05), boneMat);
                    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.3), boneMat);
                    b2.position.x = 0.15;
                    bone.add(b1, b2);
                    meatGroup.add(bone);

                    // Fat cap (White rim)
                    const fat = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 12, 32, Math.PI * 1.5), boneMat);
                    fat.rotation.x = Math.PI / 2;
                    fat.rotation.z = Math.PI / 4;
                    fat.position.x = -0.05;
                    meatGroup.add(fat);

                    mesh.add(meatGroup);
                } else if (content.name === 'fish') {
                    // SCULPTED FISH V7 - FIXED VISIBILITY & CLONING
                    const fishDetail = new THREE.Group();

                    // Main body
                    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
                    body.scale.set(0.42, 0.2, 0.13); // Slightly larger
                    fishDetail.add(body);

                    // REALISTIC DOUBLE-LOBED TAIL (V-SHAPE)
                    const tailGroup = new THREE.Group();
                    const tailMat = mat.clone();
                    tailMat.transparent = true;
                    tailMat.opacity = 0.9; // Slightly translucent fins

                    const tUpper = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 3), tailMat);
                    tUpper.position.set(0.42, 0.08, 0);
                    tUpper.rotation.z = -Math.PI / 1.5;
                    tailGroup.add(tUpper);

                    const tLower = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 3), tailMat);
                    tLower.position.set(0.42, -0.08, 0);
                    tLower.rotation.z = -Math.PI / 3;
                    tailGroup.add(tLower);

                    fishDetail.add(tailGroup);

                    // Fins
                    const dFin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.02), mat);
                    dFin.position.set(0, 0.18, 0);
                    dFin.rotation.z = Math.PI / 4;
                    fishDetail.add(dFin);

                    const pFinL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.12), mat);
                    pFinL.position.set(-0.1, -0.05, 0.12);
                    fishDetail.add(pFinL);

                    const pFinR = pFinL.clone();
                    pFinR.position.z = -0.12;
                    fishDetail.add(pFinR);

                    // Eyes
                    const eyeGroup = new THREE.Group();
                    eyeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })));
                    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
                    pupil.position.set(-0.02, 0, 0.04);
                    eyeGroup.add(pupil);

                    const el = eyeGroup.clone();
                    el.position.set(-0.35, 0.06, 0.08);
                    const er = eyeGroup.clone();
                    er.position.set(-0.35, 0.06, -0.08);
                    fishDetail.add(el, er);

                    mesh.add(fishDetail);
                } else if (content.name === 'mushroom') {
                    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.35, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
                    stem.position.y = -0.05;
                    mesh.add(stem);
                    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
                    cap.position.y = 0.1;
                    mesh.add(cap);
                } else if (content.name === 'tomato') {
                    // Realistic tomato with segments
                    const tomatoGroup = new THREE.Group();

                    // Main tomato body
                    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 32), mat);
                    body.scale.y = 0.9;
                    tomatoGroup.add(body);

                    // Tomato segments (vertical indentations)
                    for (let seg = 0; seg < 6; seg++) {
                        const segment = new THREE.Mesh(
                            new THREE.BoxGeometry(0.02, 0.5, 0.02),
                            new THREE.MeshStandardMaterial({
                                color: content.burnt ? 0x000000 : 0xC0392B,
                                roughness: 0.8
                            })
                        );
                        const angle = (seg / 6) * Math.PI * 2;
                        segment.position.set(
                            Math.cos(angle) * 0.27,
                            0,
                            Math.sin(angle) * 0.27
                        );
                        segment.rotation.y = angle;
                        tomatoGroup.add(segment);
                    }

                    // Green stem/calyx (star shape on top)
                    const stemMat = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.9 });
                    const stemBase = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.04, 0.05, 0.08, 8),
                        stemMat
                    );
                    stemBase.position.y = 0.25;
                    tomatoGroup.add(stemBase);

                    // Calyx leaves (5 pointed star)
                    for (let cl = 0; cl < 5; cl++) {
                        const leaf = new THREE.Mesh(
                            new THREE.ConeGeometry(0.04, 0.12, 3),
                            stemMat
                        );
                        const angle = (cl / 5) * Math.PI * 2;
                        leaf.position.set(
                            Math.cos(angle) * 0.08,
                            0.28,
                            Math.sin(angle) * 0.08
                        );
                        leaf.rotation.set(
                            Math.PI / 3,
                            angle,
                            0
                        );
                        tomatoGroup.add(leaf);
                    }

                    // Highlight spot (shiny reflection)
                    const highlight = new THREE.Mesh(
                        new THREE.SphereGeometry(0.06, 12, 12),
                        new THREE.MeshStandardMaterial({
                            color: 0xFF6B6B,
                            roughness: 0.1,
                            metalness: 0.3
                        })
                    );
                    highlight.position.set(-0.15, 0.15, 0.15);
                    tomatoGroup.add(highlight);

                    mesh.add(tomatoGroup);
                } else if (content.name === 'onion') {
                    // Realistic onion with layers and roots
                    const onionGroup = new THREE.Group();

                    // Main onion body (slightly elongated)
                    const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 32, 32), mat);
                    body.scale.set(1, 1.1, 1);
                    onionGroup.add(body);

                    // Onion layers (rings showing through)
                    for (let layer = 0; layer < 4; layer++) {
                        const ring = new THREE.Mesh(
                            new THREE.TorusGeometry(0.24 - layer * 0.04, 0.008, 12, 32),
                            new THREE.MeshStandardMaterial({
                                color: content.burnt ? 0x000000 : 0xE8D5B7,
                                roughness: 0.8,
                                transparent: true,
                                opacity: 0.6
                            })
                        );
                        ring.rotation.x = Math.PI / 2;
                        ring.position.y = 0.05 + layer * 0.08;
                        onionGroup.add(ring);
                    }

                    // Papery skin texture (outer layer)
                    for (let skin = 0; skin < 3; skin++) {
                        const paper = new THREE.Mesh(
                            new THREE.PlaneGeometry(0.15, 0.2),
                            new THREE.MeshStandardMaterial({
                                color: 0xD4A574,
                                roughness: 0.95,
                                side: THREE.DoubleSide,
                                transparent: true,
                                opacity: 0.4
                            })
                        );
                        const angle = (skin / 3) * Math.PI * 2;
                        paper.position.set(
                            Math.cos(angle) * 0.28,
                            0.1,
                            Math.sin(angle) * 0.28
                        );
                        paper.rotation.set(
                            (Math.random() - 0.5) * 0.5,
                            angle,
                            (Math.random() - 0.5) * 0.5
                        );
                        onionGroup.add(paper);
                    }

                    // Green sprout on top
                    const sproutMat = new THREE.MeshStandardMaterial({ color: 0x7CB342, roughness: 0.8 });
                    for (let sp = 0; sp < 2; sp++) {
                        const sprout = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.015, 0.02, 0.18, 8),
                            sproutMat
                        );
                        sprout.position.set(
                            (sp - 0.5) * 0.03,
                            0.32,
                            0
                        );
                        sprout.rotation.set(
                            (Math.random() - 0.5) * 0.3,
                            0,
                            (sp - 0.5) * 0.2
                        );
                        onionGroup.add(sprout);
                    }

                    // Root base (bottom)
                    const rootMat = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.95 });
                    const rootBase = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.05, 0.03, 0.04, 12),
                        rootMat
                    );
                    rootBase.position.y = -0.29;
                    onionGroup.add(rootBase);

                    // Root hairs
                    for (let rh = 0; rh < 8; rh++) {
                        const hair = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.005, 0.003, 0.08, 4),
                            rootMat
                        );
                        const angle = (rh / 8) * Math.PI * 2;
                        hair.position.set(
                            Math.cos(angle) * 0.04,
                            -0.33,
                            Math.sin(angle) * 0.04
                        );
                        hair.rotation.set(
                            (Math.random() - 0.5) * 0.5,
                            angle,
                            (Math.random() - 0.5) * 0.5
                        );
                        onionGroup.add(hair);
                    }

                    mesh.add(onionGroup);
                } else if (content.name === 'lettuce') {
                    // Realistic lettuce head with multiple leaves
                    const lettuceGroup = new THREE.Group();
                    const lettuceMat = new THREE.MeshStandardMaterial({
                        color: mat.color,
                        roughness: 0.9,
                        side: THREE.DoubleSide
                    });

                    // Core/center
                    const core = new THREE.Mesh(
                        new THREE.SphereGeometry(0.12, 16, 16),
                        new THREE.MeshStandardMaterial({
                            color: content.burnt ? 0x000000 : 0xC8E6C9,
                            roughness: 0.8
                        })
                    );
                    core.scale.y = 0.6;
                    lettuceGroup.add(core);

                    // Multiple layers of leaves
                    for (let layer = 0; layer < 3; layer++) {
                        const numLeaves = 6 + layer * 2;
                        const leafSize = 0.2 + layer * 0.08;
                        const leafHeight = -0.05 + layer * 0.04;

                        for (let lf = 0; lf < numLeaves; lf++) {
                            const leaf = new THREE.Mesh(
                                new THREE.PlaneGeometry(leafSize, leafSize * 1.2),
                                lettuceMat
                            );
                            const angle = (lf / numLeaves) * Math.PI * 2 + layer * 0.3;
                            const radius = 0.08 + layer * 0.06;

                            leaf.position.set(
                                Math.cos(angle) * radius,
                                leafHeight,
                                Math.sin(angle) * radius
                            );
                            leaf.rotation.set(
                                -Math.PI / 2.5 + (Math.random() - 0.5) * 0.4,
                                angle + (Math.random() - 0.5) * 0.3,
                                (Math.random() - 0.5) * 0.5
                            );

                            // Add some curl/wave to leaves
                            leaf.scale.set(
                                1 + (Math.random() - 0.5) * 0.2,
                                1 + (Math.random() - 0.5) * 0.3,
                                1
                            );

                            lettuceGroup.add(leaf);

                            // Leaf veins (lighter green)
                            const vein = new THREE.Mesh(
                                new THREE.PlaneGeometry(0.015, leafSize * 0.9),
                                new THREE.MeshStandardMaterial({
                                    color: 0x81C784,
                                    side: THREE.DoubleSide
                                })
                            );
                            vein.position.copy(leaf.position);
                            vein.rotation.copy(leaf.rotation);
                            lettuceGroup.add(vein);
                        }
                    }

                    mesh.add(lettuceGroup);
                } else if (content.name === 'cheese') {
                    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 3), mat);
                    c.rotation.x = Math.PI / 2;
                    mesh.add(c);
                } else if (content.name === 'bread') {
                    // Realistic bread bun with texture
                    const breadGroup = new THREE.Group();

                    // Main bun body (rounded top)
                    const bunTop = new THREE.Mesh(
                        new THREE.SphereGeometry(0.26, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2),
                        mat
                    );
                    bunTop.position.y = 0.05;
                    breadGroup.add(bunTop);

                    // Bottom part
                    const bunBottom = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.26, 0.24, 0.1, 32),
                        mat
                    );
                    bunBottom.position.y = -0.05;
                    breadGroup.add(bunBottom);

                    // Texture lines (scoring marks)
                    for (let line = 0; line < 4; line++) {
                        const score = new THREE.Mesh(
                            new THREE.TorusGeometry(0.22 - line * 0.03, 0.005, 8, 32),
                            new THREE.MeshStandardMaterial({
                                color: content.burnt ? 0x000000 : 0xC49A6C,
                                roughness: 0.8
                            })
                        );
                        score.rotation.x = Math.PI / 2;
                        score.position.y = 0.08 + line * 0.04;
                        breadGroup.add(score);
                    }

                    // Sesame seeds on top
                    const seedMat = new THREE.MeshStandardMaterial({
                        color: 0xFFFACD,
                        roughness: 0.8
                    });
                    for (let seed = 0; seed < 15; seed++) {
                        const s = new THREE.Mesh(
                            new THREE.SphereGeometry(0.012, 8, 6),
                            seedMat
                        );
                        const angle = (seed / 15) * Math.PI * 2 + Math.random() * 0.4;
                        const radius = 0.08 + Math.random() * 0.12;
                        s.position.set(
                            Math.cos(angle) * radius,
                            0.2 + Math.random() * 0.05,
                            Math.sin(angle) * radius
                        );
                        s.scale.set(1, 0.6, 1.4);
                        s.rotation.y = Math.random() * Math.PI;
                        breadGroup.add(s);
                    }

                    // Flour dusting (white spots)
                    for (let flour = 0; flour < 8; flour++) {
                        const dust = new THREE.Mesh(
                            new THREE.CircleGeometry(0.02 + Math.random() * 0.02, 12),
                            new THREE.MeshStandardMaterial({
                                color: 0xFFFFF0,
                                transparent: true,
                                opacity: 0.5,
                                roughness: 1.0
                            })
                        );
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * 0.22;
                        dust.position.set(
                            Math.cos(angle) * radius,
                            0.15 + Math.random() * 0.1,
                            Math.sin(angle) * radius
                        );
                        dust.rotation.set(
                            -Math.PI / 2 + (Math.random() - 0.5) * 0.5,
                            Math.random() * Math.PI,
                            0
                        );
                        breadGroup.add(dust);
                    }

                    mesh.add(breadGroup);
                } else if (content.name === 'dough') {
                    // Soft pillowy dough ball with flour
                    const doughGroup = new THREE.Group();

                    // Main dough body (soft and puffy)
                    const doughBall = new THREE.Mesh(
                        new THREE.SphereGeometry(0.24, 24, 16),
                        mat
                    );
                    doughBall.scale.set(1, 0.7, 1);
                    doughGroup.add(doughBall);

                    // Dough folds/creases
                    for (let fold = 0; fold < 4; fold++) {
                        const crease = new THREE.Mesh(
                            new THREE.TorusGeometry(0.18 - fold * 0.03, 0.008, 8, 24),
                            new THREE.MeshStandardMaterial({
                                color: content.burnt ? 0x000000 : 0xE8D5B7,
                                roughness: 0.9
                            })
                        );
                        crease.rotation.x = Math.PI / 2;
                        crease.position.y = -0.05 + fold * 0.03;
                        doughGroup.add(crease);
                    }

                    // Flour coating (white dusting all over)
                    const flourMat = new THREE.MeshStandardMaterial({
                        color: 0xFFFFF0,
                        transparent: true,
                        opacity: 0.6,
                        roughness: 1.0
                    });

                    for (let flour = 0; flour < 20; flour++) {
                        const dust = new THREE.Mesh(
                            new THREE.SphereGeometry(0.015 + Math.random() * 0.01, 8, 6),
                            flourMat
                        );
                        const angle = Math.random() * Math.PI * 2;
                        const height = (Math.random() - 0.5) * 0.3;
                        const radius = 0.2 + Math.random() * 0.05;
                        dust.position.set(
                            Math.cos(angle) * radius,
                            height,
                            Math.sin(angle) * radius
                        );
                        doughGroup.add(dust);
                    }

                    // Dough texture bumps (air bubbles)
                    for (let bump = 0; bump < 6; bump++) {
                        const bubble = new THREE.Mesh(
                            new THREE.SphereGeometry(0.03 + Math.random() * 0.02, 12, 12),
                            new THREE.MeshStandardMaterial({
                                color: mat.color,
                                roughness: 0.85
                            })
                        );
                        const angle = (bump / 6) * Math.PI * 2;
                        const radius = 0.15 + Math.random() * 0.08;
                        bubble.position.set(
                            Math.cos(angle) * radius,
                            0.05 + Math.random() * 0.05,
                            Math.sin(angle) * radius
                        );
                        doughGroup.add(bubble);
                    }

                    mesh.add(doughGroup);
                } else if (content.name === 'rice') {
                    // Realistic rice pile with individual grains
                    const riceGroup = new THREE.Group();

                    // Base mound shape
                    const base = new THREE.Mesh(
                        new THREE.SphereGeometry(0.22, 24, 16),
                        mat
                    );
                    base.scale.set(1, 0.5, 1);
                    base.position.y = -0.05;
                    riceGroup.add(base);

                    // Individual rice grains on surface (lots of them)
                    const grainMat = new THREE.MeshStandardMaterial({
                        color: content.burnt ? 0x000000 : 0xFFFFF0,
                        roughness: 0.9
                    });

                    for (let grain = 0; grain < 40; grain++) {
                        const g = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.008, 0.008, 0.025, 6),
                            grainMat
                        );

                        // Random position on mound surface
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * 0.2;
                        const height = Math.sqrt(1 - (radius / 0.22) ** 2) * 0.11;

                        g.position.set(
                            Math.cos(angle) * radius,
                            height - 0.05,
                            Math.sin(angle) * radius
                        );

                        // Random rotation for natural look
                        g.rotation.set(
                            (Math.random() - 0.5) * Math.PI,
                            Math.random() * Math.PI * 2,
                            (Math.random() - 0.5) * Math.PI
                        );

                        riceGroup.add(g);
                    }

                    // Rice grain clusters (clumps)
                    for (let cluster = 0; cluster < 8; cluster++) {
                        const clump = new THREE.Mesh(
                            new THREE.BoxGeometry(0.04, 0.02, 0.03),
                            grainMat
                        );
                        const angle = (cluster / 8) * Math.PI * 2;
                        const radius = 0.12 + Math.random() * 0.08;
                        clump.position.set(
                            Math.cos(angle) * radius,
                            0.02 + Math.random() * 0.03,
                            Math.sin(angle) * radius
                        );
                        clump.rotation.set(
                            Math.random() * 0.5,
                            Math.random() * Math.PI,
                            Math.random() * 0.5
                        );
                        riceGroup.add(clump);
                    }

                    // Steam if cooked
                    if (content.cooked) {
                        // Add subtle shine to cooked rice
                        const shine = new THREE.Mesh(
                            new THREE.SphereGeometry(0.15, 16, 12),
                            new THREE.MeshStandardMaterial({
                                color: 0xFFFFFF,
                                transparent: true,
                                opacity: 0.2,
                                roughness: 0.3,
                                metalness: 0.1
                            })
                        );
                        shine.scale.set(1, 0.4, 1);
                        shine.position.y = 0.02;
                        riceGroup.add(shine);
                    }

                    mesh.add(riceGroup);
                } else {
                    mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 20), mat));
                }
            }

            // ADD STEAM TO INDIVIDUAL INGREDIENT IF COOKED
            if (content.cooked && !content.burnt) {
                this.addSteam(group, 0.2);
            }

            group.add(mesh);
        } else if (content.type === 'plate') {
            // Elegant Plate Base
            const plate = new THREE.Group();
            const plateBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.1, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05 }));
            plateBase.receiveShadow = true;
            plateBase.name = 'plate';
            plate.add(plateBase);

            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.02, 12, 48), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 0.08;
            plate.add(ring);
            group.add(plate);

            const ings = content.ingredients || [];
            const hasBread = ings.includes('bread');
            const hasMeat = ings.includes('meat');
            const hasLettuce = ings.includes('lettuce');
            const hasTomato = ings.includes('tomato');
            const hasDough = ings.includes('dough');
            const hasCheese = ings.includes('cheese');
            const hasRice = ings.includes('rice');
            const hasFish = ings.includes('fish');
            const hasOnion = ings.includes('onion');
            const hasMushroom = ings.includes('mushroom');
            const hasEgg = ings.includes('egg');

            let finalHeight = 0.1;

            // ==========================================
            // BURGER ASSEMBLY (progressive layer by layer)
            // ==========================================
            if (hasBread && !hasDough) {
                let layerY = 0.1;

                // Bottom Bun (realistic sesame seed bun)
                const bunColor = content.burnt ? 0x000000 : 0xD4A574;
                const bunMat = new THREE.MeshStandardMaterial({ color: bunColor, roughness: 0.7 });
                const bottomBun = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.12, 32), bunMat);
                bottomBun.position.y = layerY;
                group.add(bottomBun);

                // Bottom bun texture lines
                for (let bl = 0; bl < 4; bl++) {
                    const line = new THREE.Mesh(
                        new THREE.TorusGeometry(0.35 - bl * 0.05, 0.005, 8, 32),
                        new THREE.MeshStandardMaterial({ color: 0xC49A6C })
                    );
                    line.rotation.x = Math.PI / 2;
                    line.position.y = layerY + 0.02;
                    group.add(line);
                }
                layerY += 0.12;

                // Patty layer (if meat added) - Juicy realistic patty
                if (hasMeat) {
                    const pattyColor = content.burnt ? 0x000000 : 0x5D3A1A;
                    const pattyMat = new THREE.MeshStandardMaterial({ color: pattyColor, roughness: 0.8 });
                    const patty = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.37, 0.1, 32), pattyMat);
                    patty.position.y = layerY;
                    group.add(patty);

                    // Grill marks (more realistic)
                    for (let gm = 0; gm < 4; gm++) {
                        const mark = new THREE.Mesh(
                            new THREE.BoxGeometry(0.65, 0.008, 0.025),
                            new THREE.MeshStandardMaterial({ color: 0x2c1810 })
                        );
                        mark.position.set(0, layerY + 0.052, (gm - 1.5) * 0.1);
                        mark.rotation.y = Math.PI / 6;
                        group.add(mark);
                    }

                    // Juicy edges effect
                    const juiceRing = new THREE.Mesh(
                        new THREE.TorusGeometry(0.36, 0.008, 8, 32),
                        new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.3 })
                    );
                    juiceRing.rotation.x = Math.PI / 2;
                    juiceRing.position.y = layerY + 0.05;
                    group.add(juiceRing);
                    layerY += 0.1;
                }

                // Lettuce layer (more realistic wavy leaves)
                if (hasLettuce) {
                    const lettuceColor = content.burnt ? 0x000000 : 0x27ae60;
                    const lettuceMat = new THREE.MeshStandardMaterial({
                        color: lettuceColor,
                        roughness: 0.9,
                        side: THREE.DoubleSide
                    });
                    // Multiple wavy lettuce leaves
                    for (let lf = 0; lf < 5; lf++) {
                        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), lettuceMat);
                        const angle = (lf / 5) * Math.PI * 2;
                        leaf.position.set(
                            Math.cos(angle) * 0.14,
                            layerY + 0.02 + Math.random() * 0.02,
                            Math.sin(angle) * 0.14
                        );
                        leaf.rotation.set(-Math.PI / 2.5 + Math.random() * 0.3, angle, Math.random() * 0.4);
                        group.add(leaf);
                    }
                    layerY += 0.05;
                }

                // Tomato slices (more realistic)
                if (hasTomato) {
                    const tomatoColor = content.burnt ? 0x000000 : 0xe74c3c;
                    const tomatoMat = new THREE.MeshStandardMaterial({ color: tomatoColor, roughness: 0.4 });
                    const seedMat = new THREE.MeshStandardMaterial({ color: 0xFFE4B5, roughness: 0.6 });

                    // Two tomato slices
                    for (let ts = 0; ts < 2; ts++) {
                        const slice = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 24), tomatoMat);
                        slice.position.set((ts - 0.5) * 0.15, layerY, ts * 0.08);
                        group.add(slice);

                        // Seeds in center
                        for (let sd = 0; sd < 4; sd++) {
                            const seed = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), seedMat);
                            const sa = (sd / 4) * Math.PI * 2;
                            seed.position.set(
                                (ts - 0.5) * 0.15 + Math.cos(sa) * 0.08,
                                layerY + 0.022,
                                ts * 0.08 + Math.sin(sa) * 0.08
                            );
                            group.add(seed);
                        }
                    }
                    layerY += 0.05;
                }

                // Top Bun (rounded dome shape with sesame seeds)
                const topBunGeo = new THREE.SphereGeometry(0.4, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2);
                const topBun = new THREE.Mesh(topBunGeo, bunMat);
                topBun.position.y = layerY;
                group.add(topBun);

                // Sesame seeds on top bun (more realistic)
                const seedMat = new THREE.MeshStandardMaterial({ color: 0xFFFACD, roughness: 0.8 });
                for (let s = 0; s < 12; s++) {
                    const seed = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), seedMat);
                    const sa = (s / 12) * Math.PI * 2 + Math.random() * 0.3;
                    const sr = 0.12 + Math.random() * 0.12;
                    seed.position.set(
                        Math.cos(sa) * sr,
                        layerY + 0.34 + Math.random() * 0.04,
                        Math.sin(sa) * sr
                    );
                    seed.scale.set(1, 0.6, 1.4);
                    seed.rotation.y = Math.random() * Math.PI;
                    group.add(seed);
                }
                finalHeight = layerY + 0.38;
            }
            // ==========================================
            // PIZZA ASSEMBLY (progressive)
            // ==========================================
            else if (hasDough) {
                let layerY = 0.1;

                // Flat dough base (round pizza shape with texture)
                const doughColor = content.burnt ? 0x000000 : 0xF5DEB3;
                const doughMat = new THREE.MeshStandardMaterial({ color: doughColor, roughness: 0.8 });
                const pizzaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.06, 48), doughMat);
                pizzaBase.position.y = layerY;
                group.add(pizzaBase);

                // Raised crust edge (puffy and golden)
                const crustMat = new THREE.MeshStandardMaterial({
                    color: content.burnt ? 0x000000 : 0xD4A574,
                    roughness: 0.7
                });
                const crust = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 12, 48), crustMat);
                crust.rotation.x = Math.PI / 2;
                crust.position.y = layerY + 0.04;
                group.add(crust);

                // Crust bubbles for realism
                for (let cb = 0; cb < 6; cb++) {
                    const bubble = new THREE.Mesh(
                        new THREE.SphereGeometry(0.025, 8, 8),
                        crustMat
                    );
                    const angle = (cb / 6) * Math.PI * 2;
                    bubble.position.set(
                        Math.cos(angle) * 0.44,
                        layerY + 0.06,
                        Math.sin(angle) * 0.44
                    );
                    group.add(bubble);
                }
                layerY += 0.07;

                // Tomato sauce layer (rich red sauce)
                if (hasTomato) {
                    const sauceColor = content.burnt ? 0x000000 : 0xc0392b;
                    const sauce = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.40, 0.40, 0.02, 48),
                        new THREE.MeshStandardMaterial({ color: sauceColor, roughness: 0.8 })
                    );
                    sauce.position.y = layerY;
                    group.add(sauce);

                    // Sauce texture (herb specks)
                    for (let hs = 0; hs < 8; hs++) {
                        const herb = new THREE.Mesh(
                            new THREE.BoxGeometry(0.015, 0.002, 0.025),
                            new THREE.MeshStandardMaterial({ color: 0x2d5016 })
                        );
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * 0.35;
                        herb.position.set(
                            Math.cos(angle) * radius,
                            layerY + 0.012,
                            Math.sin(angle) * radius
                        );
                        herb.rotation.y = Math.random() * Math.PI;
                        group.add(herb);
                    }
                    layerY += 0.025;
                }

                // Cheese layer (shredded/sprinkled cheese)
                if (hasCheese) {
                    const cheeseColor = content.burnt ? 0x000000 : 0xf1c40f;
                    const cheeseMat = new THREE.MeshStandardMaterial({
                        color: cheeseColor,
                        roughness: 0.6,
                        metalness: 0.05
                    });

                    // Shredded cheese pieces scattered on pizza
                    for (let shred = 0; shred < 35; shred++) {
                        const shredPiece = new THREE.Mesh(
                            new THREE.BoxGeometry(
                                0.015 + Math.random() * 0.01, // width
                                0.008 + Math.random() * 0.004, // height
                                0.04 + Math.random() * 0.03   // length (shred)
                            ),
                            cheeseMat
                        );

                        // Random position across pizza surface
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * 0.35;
                        shredPiece.position.set(
                            Math.cos(angle) * radius,
                            layerY + 0.008 + Math.random() * 0.015,
                            Math.sin(angle) * radius
                        );

                        // Random rotation for natural scattered look
                        shredPiece.rotation.set(
                            (Math.random() - 0.5) * 0.5,
                            Math.random() * Math.PI * 2,
                            (Math.random() - 0.5) * 0.5
                        );

                        group.add(shredPiece);
                    }

                    // Some melted cheese spots (golden brown when cooked)
                    if (content.cooked && content.cooked.includes('dough')) {
                        for (let melt = 0; melt < 6; melt++) {
                            const meltSpot = new THREE.Mesh(
                                new THREE.CylinderGeometry(0.06, 0.07, 0.006, 16),
                                new THREE.MeshStandardMaterial({
                                    color: 0xFFD700,
                                    roughness: 0.3,
                                    metalness: 0.2
                                })
                            );
                            const angle = (melt / 6) * Math.PI * 2 + Math.random() * 0.5;
                            const radius = 0.12 + Math.random() * 0.18;
                            meltSpot.position.set(
                                Math.cos(angle) * radius,
                                layerY + 0.012,
                                Math.sin(angle) * radius
                            );
                            group.add(meltSpot);
                        }
                    }

                    layerY += 0.025;
                }
                finalHeight = layerY;
            }
            // ==========================================
            // SUSHI ASSEMBLY (progressive)
            // ==========================================
            else if (hasRice && hasFish) {
                let layerY = 0.1;

                // Sushi rice base (realistic nigiri shape)
                const riceColor = content.burnt ? 0x000000 : 0xFFFAFA;
                const riceMat = new THREE.MeshStandardMaterial({ color: riceColor, roughness: 0.9 });

                // Three nigiri pieces
                for (let s = 0; s < 3; s++) {
                    // Rice base (oval mound)
                    const riceBase = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), riceMat);
                    riceBase.position.set((s - 1) * 0.32, layerY + 0.06, 0);
                    // Round the edges
                    riceBase.scale.set(1, 1, 0.9);
                    group.add(riceBase);

                    // Rice grain texture
                    for (let rg = 0; rg < 8; rg++) {
                        const grain = new THREE.Mesh(
                            new THREE.SphereGeometry(0.008, 4, 4),
                            new THREE.MeshStandardMaterial({ color: 0xFFFFF0 })
                        );
                        grain.position.set(
                            (s - 1) * 0.32 + (Math.random() - 0.5) * 0.18,
                            layerY + 0.08 + Math.random() * 0.08,
                            (Math.random() - 0.5) * 0.14
                        );
                        group.add(grain);
                    }

                    // Fish slice on top (salmon pink)
                    const fishColor = content.burnt ? 0x000000 : 0xFA8072;
                    const fishMat = new THREE.MeshStandardMaterial({
                        color: fishColor,
                        roughness: 0.3,
                        metalness: 0.1
                    });
                    const fishSlice = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.18), fishMat);
                    fishSlice.position.set((s - 1) * 0.32, layerY + 0.14, 0);
                    fishSlice.rotation.y = Math.random() * 0.2 - 0.1;
                    group.add(fishSlice);

                    // Fish marbling (white fat lines)
                    for (let fm = 0; fm < 2; fm++) {
                        const marble = new THREE.Mesh(
                            new THREE.BoxGeometry(0.2, 0.002, 0.015),
                            new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
                        );
                        marble.position.set(
                            (s - 1) * 0.32,
                            layerY + 0.162,
                            (fm - 0.5) * 0.08
                        );
                        marble.rotation.y = Math.random() * 0.3;
                        group.add(marble);
                    }
                }

                // Nori wrap strip (dark green seaweed)
                const noriMat = new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.95 });
                const nori = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.24), noriMat);
                nori.position.set(-0.32, layerY + 0.09, 0);
                group.add(nori);

                // Wasabi dollop (green paste)
                const wasabi = new THREE.Mesh(
                    new THREE.SphereGeometry(0.04, 12, 8),
                    new THREE.MeshStandardMaterial({ color: 0x7FFF00, roughness: 0.6 })
                );
                wasabi.scale.set(1, 0.6, 1);
                wasabi.position.set(0.35, layerY + 0.02, 0.15);
                group.add(wasabi);

                // Pickled ginger slices (pink)
                for (let pg = 0; pg < 2; pg++) {
                    const ginger = new THREE.Mesh(
                        new THREE.PlaneGeometry(0.12, 0.08),
                        new THREE.MeshStandardMaterial({
                            color: 0xFFB6C1,
                            roughness: 0.5,
                            side: THREE.DoubleSide
                        })
                    );
                    ginger.rotation.x = -Math.PI / 2 + Math.random() * 0.3;
                    ginger.position.set(0.25 + pg * 0.08, layerY + 0.02, -0.18);
                    group.add(ginger);
                }

                finalHeight = layerY + 0.18;
            }
            // ==========================================
            // SOUP ASSEMBLY (progressive)
            // ==========================================
            else if (hasOnion && hasMushroom && hasTomato) {
                let layerY = 0.1;

                // Realistic soup bowl (wider at top, ceramic texture)
                const bowlMat = new THREE.MeshStandardMaterial({
                    color: 0xF5F5DC,
                    roughness: 0.4,
                    metalness: 0.1
                });
                const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.32, 0.28, 32), bowlMat);
                bowl.position.y = layerY + 0.14;
                group.add(bowl);

                // Bowl rim (thicker edge)
                const rim = new THREE.Mesh(
                    new THREE.TorusGeometry(0.45, 0.025, 12, 32),
                    new THREE.MeshStandardMaterial({ color: 0xE8E8D0, roughness: 0.3 })
                );
                rim.rotation.x = Math.PI / 2;
                rim.position.y = layerY + 0.28;
                group.add(rim);

                // Rich tomato soup broth (glossy surface)
                const soupColor = content.burnt ? 0x000000 : 0xD32F2F;
                const soupMat = new THREE.MeshStandardMaterial({
                    color: soupColor,
                    roughness: 0.15,
                    metalness: 0.2
                });
                const broth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.40, 0.03, 32), soupMat);
                broth.position.y = layerY + 0.26;
                group.add(broth);

                // Soup surface ripples
                for (let rp = 0; rp < 3; rp++) {
                    const ripple = new THREE.Mesh(
                        new THREE.TorusGeometry(0.15 + rp * 0.08, 0.008, 8, 24),
                        new THREE.MeshStandardMaterial({
                            color: 0xFF6B6B,
                            transparent: true,
                            opacity: 0.3 - rp * 0.1
                        })
                    );
                    ripple.rotation.x = Math.PI / 2;
                    ripple.position.y = layerY + 0.275;
                    group.add(ripple);
                }

                // Floating tomato chunks (diced)
                if (hasTomato) {
                    for (let tc = 0; tc < 5; tc++) {
                        const chunk = new THREE.Mesh(
                            new THREE.BoxGeometry(0.06, 0.04, 0.06),
                            new THREE.MeshStandardMaterial({
                                color: content.burnt ? 0x000000 : 0xFF5252,
                                roughness: 0.6
                            })
                        );
                        const angle = (tc / 5) * Math.PI * 2;
                        const radius = 0.15 + Math.random() * 0.15;
                        chunk.position.set(
                            Math.cos(angle) * radius,
                            layerY + 0.28,
                            Math.sin(angle) * radius
                        );
                        chunk.rotation.set(
                            Math.random() * 0.5,
                            Math.random() * Math.PI,
                            Math.random() * 0.5
                        );
                        group.add(chunk);
                    }
                }

                // Caramelized onion slices
                if (hasOnion) {
                    for (let os = 0; os < 4; os++) {
                        const onionSlice = new THREE.Mesh(
                            new THREE.TorusGeometry(0.05, 0.018, 8, 16),
                            new THREE.MeshStandardMaterial({
                                color: content.burnt ? 0x000000 : 0xD4A574,
                                roughness: 0.7
                            })
                        );
                        onionSlice.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
                        const angle = (os / 4) * Math.PI * 2 + 0.3;
                        const radius = 0.12 + Math.random() * 0.18;
                        onionSlice.position.set(
                            Math.cos(angle) * radius,
                            layerY + 0.28,
                            Math.sin(angle) * radius
                        );
                        group.add(onionSlice);
                    }
                }

                // Mushroom slices (realistic caps)
                if (hasMushroom) {
                    for (let ms = 0; ms < 4; ms++) {
                        // Mushroom cap
                        const cap = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.045, 0.055, 0.025, 12),
                            new THREE.MeshStandardMaterial({
                                color: content.burnt ? 0x000000 : 0x8B7355,
                                roughness: 0.8
                            })
                        );
                        const angle = (ms / 4) * Math.PI * 2 + 0.7;
                        const radius = 0.1 + Math.random() * 0.2;
                        cap.position.set(
                            Math.cos(angle) * radius,
                            layerY + 0.285,
                            Math.sin(angle) * radius
                        );
                        cap.rotation.set(
                            (Math.random() - 0.5) * 0.6,
                            Math.random() * Math.PI,
                            (Math.random() - 0.5) * 0.6
                        );
                        group.add(cap);

                        // Mushroom gills (underside detail)
                        const gills = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.04, 0.05, 0.015, 12),
                            new THREE.MeshStandardMaterial({ color: 0xD2B48C, roughness: 0.9 })
                        );
                        gills.position.copy(cap.position);
                        gills.position.y -= 0.015;
                        gills.rotation.copy(cap.rotation);
                        group.add(gills);
                    }
                }

                // Fresh herbs on top (parsley garnish)
                for (let hb = 0; hb < 3; hb++) {
                    const herb = new THREE.Mesh(
                        new THREE.PlaneGeometry(0.08, 0.05),
                        new THREE.MeshStandardMaterial({
                            color: 0x2E7D32,
                            side: THREE.DoubleSide,
                            roughness: 0.9
                        })
                    );
                    herb.rotation.x = -Math.PI / 2 + Math.random() * 0.3;
                    herb.rotation.z = Math.random() * Math.PI * 2;
                    const angle = (hb / 3) * Math.PI * 2;
                    herb.position.set(
                        Math.cos(angle) * 0.08,
                        layerY + 0.29,
                        Math.sin(angle) * 0.08
                    );
                    group.add(herb);
                }

                finalHeight = layerY + 0.32;
            }
            // ==========================================
            // UNCOOKED EGG - Sunny Side Up (raw appearance)
            // ==========================================
            else if (hasEgg && !content.cooked) {
                let layerY = 0.1;

                // --- 2. SUNNY SIDE UP EGG ---
                // Gumawa ako ng "Group" para pagsamahin ang puti at pula
                const eggGroup = new THREE.Group();

                // --- A. Itlog na Puti (The White) ---
                // Gumamit ako ng MeshPhysicalMaterial para sa "glassy" o hilaw na effect
                const whiteMat = new THREE.MeshPhysicalMaterial({
                    color: 0xffffff, // Puti
                    roughness: 0.05, // Makintab
                    transmission: 0.7, // Medyo transparent (parang salamin/tubig)
                    thickness: 0.5, // Kapal para sa transmission effect
                    transparent: true,
                    opacity: 0.8 // Dagdag transparency
                });

                const whiteBaseGeo = new THREE.SphereGeometry(1.8, 32, 16);

                // Gumawa ako ng dalawang flattened sphere na magkapatong para hindi perfect bilog ang puti
                const whitePart1 = new THREE.Mesh(whiteBaseGeo, whiteMat);
                whitePart1.scale.set(1.4, 0.04, 1.2); // Sobrang flat
                whitePart1.position.set(0.1, layerY + 0.05, 0);
                whitePart1.castShadow = true;
                whitePart1.receiveShadow = true;
                eggGroup.add(whitePart1);

                const whitePart2 = new THREE.Mesh(whiteBaseGeo, whiteMat);
                whitePart2.scale.set(1.1, 0.04, 1.5); // Ibang shape naman
                whitePart2.position.set(-0.2, layerY + 0.05, 0.1);
                whitePart2.castShadow = true;
                whitePart2.receiveShadow = true;
                eggGroup.add(whitePart2);

                // --- B. Itlog na Pula (The Yolk) ---
                const yolkGeo = new THREE.SphereGeometry(0.7, 32, 32);
                const yolkMat = new THREE.MeshStandardMaterial({
                    color: 0xff8c00, // Matingkad na orange
                    roughness: 0.02, // SOBRANG KINTAB (ito ang susi sa "not cooked" look)
                    metalness: 0.1,
                    emissive: 0x331100, // Konting glow sa ilalim
                });
                const yolk = new THREE.Mesh(yolkGeo, yolkMat);
                yolk.scale.set(1, 0.75, 1); // Medyo flat ng konti pero umbok pa rin
                yolk.position.set(0, layerY + 0.3, 0); // Nakapatong sa puti
                yolk.castShadow = true;
                eggGroup.add(yolk);

                // Scale down the entire egg to fit on plate
                eggGroup.scale.set(0.15, 0.15, 0.15);
                eggGroup.position.y = layerY;

                group.add(eggGroup);

                finalHeight = layerY + 0.15;
            }
            // ==========================================
            // COOKED EGG - Omelette (cooked appearance)
            // ==========================================
            else if (hasEgg && content.cooked) {
                let layerY = 0.1;

                // Main omelette body (more natural egg shape when lying down)
                const eggColor = content.burnt ? 0x000000 : 0xFFE66D;
                const eggMat = new THREE.MeshStandardMaterial({
                    color: eggColor,
                    roughness: 0.5,
                    metalness: 0.1
                });

                const omeletteGeo = new THREE.SphereGeometry(0.25, 32, 16);
                const omelette = new THREE.Mesh(omeletteGeo, eggMat);
                // More natural egg shape - slightly oval but not extremely flat
                omelette.scale.set(1.3, 0.6, 1.1);
                omelette.position.y = layerY + 0.15;
                // Rotate to lie on its side like a natural egg
                omelette.rotation.z = Math.PI / 2;
                omelette.rotation.y = Math.PI / 8; // Slight tilt for natural look
                group.add(omelette);

                // Omelette surface texture (slightly browned spots)
                if (!content.burnt) {
                    for (let bs = 0; bs < 6; bs++) {
                        const brownSpot = new THREE.Mesh(
                            new THREE.CircleGeometry(0.04 + Math.random() * 0.03, 16),
                            new THREE.MeshStandardMaterial({
                                color: 0xD4A574,
                                transparent: true,
                                opacity: 0.6
                            })
                        );
                        brownSpot.rotation.x = -Math.PI / 2;
                        brownSpot.position.set(
                            (Math.random() - 0.5) * 0.4,
                            layerY + 0.15 + (Math.random() - 0.5) * 0.15,
                            (Math.random() - 0.5) * 0.3
                        );
                        group.add(brownSpot);
                    }
                }

                // Add cheese if present (melted on omelette)
                if (hasCheese) {
                    const cheeseMat = new THREE.MeshStandardMaterial({
                        color: content.burnt ? 0x000000 : 0xFFD700,
                        roughness: 0.3,
                        metalness: 0.2
                    });

                    // Melted cheese oozing out
                    const cheeseOoze = new THREE.Mesh(
                        new THREE.SphereGeometry(0.12, 16, 12),
                        cheeseMat
                    );
                    cheeseOoze.scale.set(1.2, 0.4, 0.8);
                    cheeseOoze.position.set(0.2, layerY + 0.15, 0.1);
                    group.add(cheeseOoze);

                    // Cheese drip
                    const drip = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.02, 0.03, 0.06, 8),
                        cheeseMat
                    );
                    drip.position.set(0.25, layerY + 0.08, 0.15);
                    group.add(drip);
                }

                // Add mushroom if present (on omelette)
                if (hasMushroom) {
                    for (let mp = 0; mp < 3; mp++) {
                        // Mushroom cap
                        const cap = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.035, 0.045, 0.025, 12),
                            new THREE.MeshStandardMaterial({
                                color: content.burnt ? 0x000000 : 0x8B7355,
                                roughness: 0.8
                            })
                        );
                        cap.position.set(
                            0.1 + mp * 0.06,
                            layerY + 0.18,
                            (Math.random() - 0.5) * 0.12
                        );
                        cap.rotation.set(
                            (Math.random() - 0.5) * 0.5,
                            Math.random() * Math.PI,
                            (Math.random() - 0.5) * 0.5
                        );
                        group.add(cap);
                    }
                }

                // Fresh herbs on top (chives)
                for (let ch = 0; ch < 4; ch++) {
                    const chive = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.005, 0.005, 0.12, 6),
                        new THREE.MeshStandardMaterial({ color: 0x2E7D32 })
                    );
                    chive.rotation.set(
                        Math.PI / 2 + (Math.random() - 0.5) * 0.3,
                        Math.random() * Math.PI,
                        (Math.random() - 0.5) * 0.4
                    );
                    chive.position.set(
                        (Math.random() - 0.5) * 0.25,
                        layerY + 0.22,
                        (Math.random() - 0.5) * 0.18
                    );
                    group.add(chive);
                }

                finalHeight = layerY + 0.28;
            }
            // ==========================================
            // SALAD ASSEMBLY (progressive)
            // ==========================================
            else if (hasLettuce) {
                let layerY = 0.1;

                // Lettuce bed (realistic wavy leaves in bowl shape)
                const letColor = content.burnt ? 0x000000 : 0x27ae60;
                const letMat = new THREE.MeshStandardMaterial({
                    color: letColor,
                    roughness: 0.9,
                    side: THREE.DoubleSide
                });

                // Multiple lettuce leaves with curves
                for (let lf = 0; lf < 7; lf++) {
                    const leaf = new THREE.Mesh(
                        new THREE.PlaneGeometry(0.28, 0.22),
                        letMat
                    );
                    const angle = (lf / 7) * Math.PI * 2;
                    leaf.position.set(
                        Math.cos(angle) * 0.18,
                        layerY + 0.06 + Math.random() * 0.03,
                        Math.sin(angle) * 0.18
                    );
                    leaf.rotation.set(
                        -Math.PI / 3 + (Math.random() - 0.5) * 0.4,
                        angle + (Math.random() - 0.5) * 0.3,
                        (Math.random() - 0.5) * 0.5
                    );
                    group.add(leaf);

                    // Leaf veins (lighter green)
                    const vein = new THREE.Mesh(
                        new THREE.PlaneGeometry(0.02, 0.18),
                        new THREE.MeshStandardMaterial({
                            color: 0x4CAF50,
                            side: THREE.DoubleSide
                        })
                    );
                    vein.position.copy(leaf.position);
                    vein.rotation.copy(leaf.rotation);
                    group.add(vein);
                }

                // Cherry tomatoes (whole and halved)
                if (hasTomato) {
                    const tColor = content.burnt ? 0x000000 : 0xFF5252;
                    for (let ct = 0; ct < 4; ct++) {
                        const tomato = new THREE.Mesh(
                            new THREE.SphereGeometry(0.055, 12, 12),
                            new THREE.MeshStandardMaterial({
                                color: tColor,
                                roughness: 0.4,
                                metalness: 0.1
                            })
                        );
                        const angle = (ct / 4) * Math.PI * 2 + 0.4;
                        const radius = 0.15 + Math.random() * 0.1;
                        tomato.position.set(
                            Math.cos(angle) * radius,
                            layerY + 0.12,
                            Math.sin(angle) * radius
                        );
                        group.add(tomato);

                        // Tomato stem (green)
                        const stem = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.008, 0.012, 0.025, 6),
                            new THREE.MeshStandardMaterial({ color: 0x2E7D32 })
                        );
                        stem.position.copy(tomato.position);
                        stem.position.y += 0.06;
                        group.add(stem);
                    }
                }

                // Red onion slices (purple rings)
                if (hasOnion) {
                    const oColor = content.burnt ? 0x000000 : 0x9C27B0;
                    for (let or2 = 0; or2 < 3; or2++) {
                        // Outer ring
                        const outerRing = new THREE.Mesh(
                            new THREE.TorusGeometry(0.06, 0.015, 8, 16),
                            new THREE.MeshStandardMaterial({
                                color: oColor,
                                roughness: 0.7
                            })
                        );
                        outerRing.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.6;
                        outerRing.rotation.z = Math.random() * Math.PI;
                        const angle = (or2 / 3) * Math.PI * 2;
                        outerRing.position.set(
                            Math.cos(angle) * 0.2,
                            layerY + 0.13,
                            Math.sin(angle) * 0.2
                        );
                        group.add(outerRing);

                        // Inner ring
                        const innerRing = new THREE.Mesh(
                            new THREE.TorusGeometry(0.035, 0.012, 8, 16),
                            new THREE.MeshStandardMaterial({ color: 0xBA68C8 })
                        );
                        innerRing.position.copy(outerRing.position);
                        innerRing.rotation.copy(outerRing.rotation);
                        group.add(innerRing);
                    }
                }

                // Cucumber slices (if we had cucumber, but using as decoration)
                for (let cs = 0; cs < 3; cs++) {
                    const cucumber = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.05, 0.05, 0.015, 16),
                        new THREE.MeshStandardMaterial({
                            color: 0x8BC34A,
                            roughness: 0.6
                        })
                    );
                    const angle = (cs / 3) * Math.PI * 2 + 1.2;
                    cucumber.position.set(
                        Math.cos(angle) * 0.22,
                        layerY + 0.11,
                        Math.sin(angle) * 0.22
                    );
                    cucumber.rotation.x = Math.PI / 2;
                    group.add(cucumber);

                    // Cucumber seeds (center)
                    const seeds = new THREE.Mesh(
                        new THREE.CircleGeometry(0.025, 12),
                        new THREE.MeshStandardMaterial({ color: 0xDCE775 })
                    );
                    seeds.position.copy(cucumber.position);
                    seeds.position.y += 0.016;
                    seeds.rotation.x = -Math.PI / 2;
                    group.add(seeds);
                }

                finalHeight = layerY + 0.18;
            }
            // ==========================================
            // FISH TACOS ASSEMBLY (progressive)
            // ==========================================
            else if (hasFish && hasBread && hasLettuce && hasTomato) {
                let layerY = 0.1;

                // Three taco shells (folded tortillas)
                const breadColor = content.burnt ? 0x000000 : 0xF4A460;
                const breadMat = new THREE.MeshStandardMaterial({
                    color: breadColor,
                    roughness: 0.8
                });

                for (let t = 0; t < 3; t++) {
                    // Taco shell (half cylinder for folded tortilla)
                    const shell = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.18, 0.18, 0.08, 24, 1, false, 0, Math.PI),
                        breadMat
                    );
                    shell.rotation.z = Math.PI / 2;
                    shell.position.set((t - 1) * 0.35, layerY + 0.09, 0);
                    group.add(shell);

                    // Tortilla texture (grill marks)
                    for (let gm = 0; gm < 3; gm++) {
                        const grillMark = new THREE.Mesh(
                            new THREE.PlaneGeometry(0.25, 0.015),
                            new THREE.MeshStandardMaterial({
                                color: 0x8B4513,
                                transparent: true,
                                opacity: 0.5
                            })
                        );
                        grillMark.rotation.set(
                            -Math.PI / 2,
                            (Math.random() - 0.5) * 0.3,
                            0
                        );
                        grillMark.position.set(
                            (t - 1) * 0.35,
                            layerY + 0.135,
                            (gm - 1) * 0.08
                        );
                        group.add(grillMark);
                    }

                    // Cooked fish pieces (flaky white fish)
                    if (hasFish) {
                        const fishColor = content.burnt ? 0x000000 : 0xFFFAF0;
                        for (let fp = 0; fp < 2; fp++) {
                            const fishPiece = new THREE.Mesh(
                                new THREE.BoxGeometry(0.12, 0.04, 0.08),
                                new THREE.MeshStandardMaterial({
                                    color: fishColor,
                                    roughness: 0.7
                                })
                            );
                            fishPiece.position.set(
                                (t - 1) * 0.35,
                                layerY + 0.11,
                                (fp - 0.5) * 0.06
                            );
                            fishPiece.rotation.y = (Math.random() - 0.5) * 0.4;
                            group.add(fishPiece);

                            // Fish flakes texture
                            for (let ff = 0; ff < 3; ff++) {
                                const flake = new THREE.Mesh(
                                    new THREE.BoxGeometry(0.025, 0.002, 0.015),
                                    new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
                                );
                                flake.position.set(
                                    (t - 1) * 0.35 + (Math.random() - 0.5) * 0.08,
                                    layerY + 0.13,
                                    (fp - 0.5) * 0.06 + (Math.random() - 0.5) * 0.05
                                );
                                flake.rotation.y = Math.random() * Math.PI;
                                group.add(flake);
                            }
                        }
                    }

                    // Shredded lettuce (green)
                    if (hasLettuce) {
                        for (let sl = 0; sl < 4; sl++) {
                            const shred = new THREE.Mesh(
                                new THREE.PlaneGeometry(0.08, 0.04),
                                new THREE.MeshStandardMaterial({
                                    color: 0x7CB342,
                                    side: THREE.DoubleSide,
                                    roughness: 0.9
                                })
                            );
                            shred.position.set(
                                (t - 1) * 0.35 + (Math.random() - 0.5) * 0.1,
                                layerY + 0.14,
                                (Math.random() - 0.5) * 0.12
                            );
                            shred.rotation.set(
                                (Math.random() - 0.5) * Math.PI,
                                Math.random() * Math.PI,
                                (Math.random() - 0.5) * Math.PI
                            );
                            group.add(shred);
                        }
                    }

                    // Diced tomatoes (red chunks)
                    if (hasTomato) {
                        for (let dt = 0; dt < 3; dt++) {
                            const dice = new THREE.Mesh(
                                new THREE.BoxGeometry(0.03, 0.03, 0.03),
                                new THREE.MeshStandardMaterial({
                                    color: 0xFF5252,
                                    roughness: 0.6
                                })
                            );
                            dice.position.set(
                                (t - 1) * 0.35 + (Math.random() - 0.5) * 0.1,
                                layerY + 0.15,
                                (Math.random() - 0.5) * 0.1
                            );
                            group.add(dice);
                        }
                    }
                }

                // Lime wedge garnish
                const lime = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16, 1, false, 0, Math.PI),
                    new THREE.MeshStandardMaterial({
                        color: 0x9CCC65,
                        roughness: 0.5
                    })
                );
                lime.rotation.z = Math.PI / 2;
                lime.rotation.y = Math.PI / 4;
                lime.position.set(0.45, layerY + 0.02, 0.15);
                group.add(lime);

                finalHeight = layerY + 0.18;
            }
            // ==========================================
            // STEAK & MUSHROOM ASSEMBLY (progressive)
            // ==========================================
            else if (hasMeat && hasMushroom && hasOnion && !hasBread) {
                let layerY = 0.1;

                // Grilled steak (center piece)
                const steakColor = content.burnt ? 0x000000 : 0x8B4513;
                const steakMat = new THREE.MeshStandardMaterial({
                    color: steakColor,
                    roughness: 0.6,
                    metalness: 0.1
                });

                // Main steak body
                const steak = new THREE.Mesh(
                    new THREE.BoxGeometry(0.35, 0.08, 0.25),
                    steakMat
                );
                steak.position.set(0, layerY + 0.04, 0);
                group.add(steak);

                // Steak grill marks (charred lines)
                if (!content.burnt) {
                    for (let gm = 0; gm < 4; gm++) {
                        const grillMark = new THREE.Mesh(
                            new THREE.BoxGeometry(0.38, 0.005, 0.025),
                            new THREE.MeshStandardMaterial({ color: 0x3E2723 })
                        );
                        grillMark.position.set(
                            0,
                            layerY + 0.085,
                            (gm - 1.5) * 0.08
                        );
                        grillMark.rotation.y = Math.PI / 6;
                        group.add(grillMark);
                    }

                    // Cross-hatch grill marks
                    for (let gm2 = 0; gm2 < 4; gm2++) {
                        const grillMark2 = new THREE.Mesh(
                            new THREE.BoxGeometry(0.38, 0.005, 0.025),
                            new THREE.MeshStandardMaterial({ color: 0x3E2723 })
                        );
                        grillMark2.position.set(
                            0,
                            layerY + 0.085,
                            (gm2 - 1.5) * 0.08
                        );
                        grillMark2.rotation.y = -Math.PI / 6;
                        group.add(grillMark2);
                    }

                    // Juicy center (pink/red for medium rare)
                    const juice = new THREE.Mesh(
                        new THREE.BoxGeometry(0.3, 0.04, 0.2),
                        new THREE.MeshStandardMaterial({
                            color: 0xC62828,
                            roughness: 0.3,
                            metalness: 0.2
                        })
                    );
                    juice.position.set(0, layerY + 0.04, 0);
                    group.add(juice);
                }

                // Sautéed mushrooms (golden brown)
                if (hasMushroom) {
                    for (let sm = 0; sm < 5; sm++) {
                        // Mushroom cap
                        const cap = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.05, 0.06, 0.035, 12),
                            new THREE.MeshStandardMaterial({
                                color: content.burnt ? 0x000000 : 0xA0826D,
                                roughness: 0.5,
                                metalness: 0.1
                            })
                        );
                        const angle = (sm / 5) * Math.PI * 2;
                        const radius = 0.22 + Math.random() * 0.05;
                        cap.position.set(
                            Math.cos(angle) * radius,
                            layerY + 0.1,
                            Math.sin(angle) * radius
                        );
                        cap.rotation.set(
                            (Math.random() - 0.5) * 0.4,
                            Math.random() * Math.PI,
                            (Math.random() - 0.5) * 0.4
                        );
                        group.add(cap);

                        // Mushroom stem
                        const stem = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.02, 0.025, 0.04, 8),
                            new THREE.MeshStandardMaterial({ color: 0xD7CCC8 })
                        );
                        stem.position.copy(cap.position);
                        stem.position.y -= 0.03;
                        group.add(stem);
                    }
                }

                // Caramelized onions (golden brown strips)
                if (hasOnion) {
                    for (let co = 0; co < 6; co++) {
                        const onionStrip = new THREE.Mesh(
                            new THREE.BoxGeometry(0.08, 0.015, 0.04),
                            new THREE.MeshStandardMaterial({
                                color: content.burnt ? 0x000000 : 0xD4A574,
                                roughness: 0.6,
                                metalness: 0.1
                            })
                        );
                        const angle = (co / 6) * Math.PI * 2 + 0.5;
                        const radius = 0.15 + Math.random() * 0.08;
                        onionStrip.position.set(
                            Math.cos(angle) * radius,
                            layerY + 0.095,
                            Math.sin(angle) * radius
                        );
                        onionStrip.rotation.set(
                            (Math.random() - 0.5) * 0.5,
                            Math.random() * Math.PI,
                            (Math.random() - 0.5) * 0.5
                        );
                        group.add(onionStrip);
                    }
                }

                // Fresh herbs (rosemary sprig)
                for (let rs = 0; rs < 2; rs++) {
                    // Rosemary stem
                    const stem = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.008, 0.008, 0.15, 6),
                        new THREE.MeshStandardMaterial({ color: 0x556B2F })
                    );
                    stem.rotation.set(
                        Math.PI / 2 + (Math.random() - 0.5) * 0.3,
                        rs * Math.PI / 3,
                        0
                    );
                    stem.position.set(
                        (rs - 0.5) * 0.15,
                        layerY + 0.1,
                        0.15
                    );
                    group.add(stem);

                    // Rosemary needles
                    for (let rn = 0; rn < 8; rn++) {
                        const needle = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.003, 0.003, 0.025, 4),
                            new THREE.MeshStandardMaterial({ color: 0x6B8E23 })
                        );
                        needle.position.copy(stem.position);
                        needle.position.x += Math.cos(stem.rotation.y) * (rn - 4) * 0.015;
                        needle.position.z += Math.sin(stem.rotation.y) * (rn - 4) * 0.015;
                        needle.position.y += (Math.random() - 0.5) * 0.02;
                        needle.rotation.set(
                            stem.rotation.x + Math.PI / 2,
                            stem.rotation.y + (Math.random() - 0.5) * 0.5,
                            (Math.random() - 0.5) * 0.8
                        );
                        group.add(needle);
                    }
                }

                finalHeight = layerY + 0.15;
            }
            // ==========================================
            // GENERIC PLATE (fallback for other combos)
            // ==========================================
            else {
                ings.forEach((ingName, i) => {
                    const ingConfig = this.config.INGREDIENTS[ingName];
                    let iColor = new THREE.Color(ingConfig ? ingConfig.color : 0x777777);
                    if (content.burnt) iColor.setHex(0x000000);

                    const pile = new THREE.Group();
                    const count = 3;
                    for (let j = 0; j < count; j++) {
                        const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({ color: iColor }));
                        p.position.set((Math.random() - 0.5) * 0.15, 0.1 + (j * 0.04), (Math.random() - 0.5) * 0.15);
                        pile.add(p);
                    }
                    const angle = (i / Math.max(ings.length, 1)) * Math.PI * 2;
                    const radius = 0.22;
                    pile.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
                    group.add(pile);
                });
                finalHeight = 0.25;
            }

            // --- ADD SEASONING EFFECTS ---
            if (content.seasoning) {
                if (content.seasoning === 'salt') {
                    // White specs
                    for (let sp = 0; sp < 15; sp++) {
                        const spec = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.015), new THREE.MeshBasicMaterial({ color: 0xffffff }));
                        spec.position.set((Math.random() - 0.5) * 0.6, finalHeight + Math.random() * 0.05, (Math.random() - 0.5) * 0.6);
                        group.add(spec);
                    }
                } else if (content.seasoning === 'sauce') {
                    // Red drizzle
                    const sauceMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.1 }); // Dark red glossy
                    for (let dz = 0; dz < 5; dz++) {
                        const drizzle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.01, 0.04), sauceMat);
                        drizzle.position.set(0, finalHeight + 0.01, (dz - 2) * 0.1);
                        drizzle.rotation.y = Math.PI / 6;
                        group.add(drizzle);
                    }
                }
            }

            // --- ADD STEAM IF PLATE IS FRESHLY COOKED ---
            if (content.cooked && content.cooked.length > 0 && !content.burnt) {
                this.addSteam(group, finalHeight);
            }

            // --- ADD GARNISH IF DISH IS READY TO SERVE ---
            // If it's a known recipe, add some parsley
            const isRecipe = Object.values(this.config.RECIPES).some(r => {
                const rIngs = [...r.ingredients].sort();
                const pIngs = [...ings].sort();
                return rIngs.length === pIngs.length && rIngs.every((v, i) => v === pIngs[i]);
            });

            if (isRecipe && !content.burnt) {
                const garnishMat = new THREE.MeshStandardMaterial({ color: 0x228B22, side: THREE.DoubleSide });
                for (let g = 0; g < 3; g++) {
                    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), garnishMat);
                    leaf.position.set(Math.random() * 0.2 - 0.1, finalHeight + 0.05, Math.random() * 0.2 - 0.1);
                    leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                    group.add(leaf);
                }
            }

            // --- SUGGEST NEXT INGREDIENT (Floating Sprite) ---
            if (this.config && this.config.RECIPES) {
                // If it's NOT a full recipe, NOT burnt, and NOT empty
                if (!isRecipe && !content.burnt && ings.length > 0) {
                    let bestMissing = null;
                    // Find a recipe that CAN be made from current ingredients
                    for (const [, recipe] of Object.entries(this.config.RECIPES)) {
                        const required = recipe.ingredients;
                        // Check if current plate is a valid subset of this recipe
                        if (ings.every(ing => required.includes(ing)) && ings.length < required.length) {
                            // Find the first missing ingredient to suggest
                            bestMissing = required.find(ing => !ings.includes(ing));
                            break; // Suggest the first one we find
                        }
                    }

                    if (bestMissing && this.config && this.config.INGREDIENTS) {
                        const ingConfig = this.config.INGREDIENTS[bestMissing];
                        if (ingConfig) {
                            const iconStr = ingConfig.emoji || bestMissing;

                            const canvas = document.createElement('canvas');
                            canvas.width = 128; canvas.height = 128;
                            const ctx = canvas.getContext('2d');

                            // Bubble background
                            ctx.fillStyle = 'rgba(20, 20, 20, 0.65)';
                            ctx.beginPath();
                            ctx.arc(64, 64, 54, 0, Math.PI * 2);
                            ctx.fill();

                            // Border
                            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                            ctx.lineWidth = 4;
                            ctx.stroke();

                            // Emoji text
                            ctx.fillStyle = '#ffffff';
                            ctx.font = 'bold 44px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(`+ ${iconStr}`, 64, 70);

                            const tex = new THREE.CanvasTexture(canvas);
                            const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
                            const sprite = new THREE.Sprite(mat);

                            // Position above food
                            sprite.position.set(0, finalHeight + 0.45, 0);
                            sprite.scale.set(0.6, 0.6, 0.6);
                            sprite.name = 'suggestionSprite';

                            group.add(sprite);
                        }
                    }
                }
            }
        }
        return group;
    }

    updateAllStations(stations) {
        Object.entries(stations).forEach(([id, st]) => this.updateStation(id, st));
    }

    resetStations(stations) {
        // Clear all existing station meshes and rebuild
        Object.values(this.stationMeshes).forEach(m => {
            this.scene.remove(m.group);
        });
        this.stationMeshes = {};
        this.stationEffects = {};
        Object.values(stations).forEach(st => this.buildStation(st));
    }

    addSteam(group, y) {
        const steamGroup = new THREE.Group();
        steamGroup.name = 'steamGroup';
        steamGroup.position.y = y;
        group.add(steamGroup);
        // We'll let animate handle populating/updating this
    }

    animate(delta, players = null) {
        this.animTime += delta;

        // Player glow effect in dark areas
        if (players) {
            const playerKeys = Object.keys(players);
            if (playerKeys.length > 0) {
                const player = players[playerKeys[0]];
                const px = player.x !== undefined ? player.x : player.gridX * this.ts;
                const pz = player.z !== undefined ? player.z : player.gridZ * this.ts;

                // Check distance to nearest station
                let minDistance = Infinity;
                Object.values(this.stationMeshes).forEach(sm => {
                    const sx = sm.group.position.x;
                    const sz = sm.group.position.z;
                    const d = Math.sqrt((px - sx) ** 2 + (pz - sz) ** 2);
                    if (d < minDistance) minDistance = d;
                });

                // If far from stations (dark area), add glow light
                if (minDistance > this.ts * 2) {
                    if (!this.playerGlowLight) {
                        this.playerGlowLight = new THREE.PointLight(0xffffff, 1.5, 10);
                        this.scene.add(this.playerGlowLight);
                    }
                    this.playerGlowLight.position.set(px, 1.5, pz);
                } else {
                    if (this.playerGlowLight) {
                        this.scene.remove(this.playerGlowLight);
                        this.playerGlowLight = null;
                    }
                }
            }
        }

        // Animate station effects
        Object.entries(this.stationEffects).forEach(([id, eff]) => {
            const sm = this.stationMeshes[id];
            if (!sm) return;

            // --- TRASH LID ANIMATION ---
            if (eff.lidGroup) {
                const hasContents = sm.group.getObjectByName('contents');

                // Proximity check for lid (if players provided)
                let playerNear = false;
                if (players) {
                    const st = Object.values(this.stationMeshes).find(m => m.group === sm.group);
                    // Find distance to all players
                    const sx = sm.group.position.x;
                    const sz = sm.group.position.z;
                    Object.values(players).forEach(p => {
                        const px = p.x !== undefined ? p.x : p.gridX * this.ts;
                        const pz = p.z !== undefined ? p.z : p.gridZ * this.ts;
                        const d = Math.sqrt((px - sx) ** 2 + (pz - sz) ** 2);
                        if (d < this.ts * 1.5) playerNear = true;
                    });
                }

                const targetAngle = (hasContents || playerNear || eff.lidOpen) ? -Math.PI * 0.55 : 0;
                eff.lidAngle = eff.lidAngle + (targetAngle - eff.lidAngle) * (delta * 6);
                eff.lidGroup.rotation.x = eff.lidAngle;
            }

            // --- PREMIUM FRIDGE DOOR & LIGHT ANIMATION (PROXIMITY BASED) ---
            if (eff.door !== undefined) {
                // Check player proximity
                let playerNear = false;
                if (players) {
                    const sx = sm.group.position.x;
                    const sz = sm.group.position.z;
                    Object.values(players).forEach(p => {
                        const px = p.x !== undefined ? p.x : p.gridX * this.ts;
                        const pz = p.z !== undefined ? p.z : p.gridZ * this.ts;
                        const d = Math.sqrt((px - sx) ** 2 + (pz - sz) ** 2);
                        if (d < this.ts * 2.2) playerNear = true; // Open when player gets close
                    });
                }

                // Check door type: oven, freezer, or crate
                const isOven = eff.door.name === 'ovenDoor';
                const isCrate = eff.door.name === 'crateDoor';

                if (isOven) {
                    // OVEN: Door swings down (positive X rotation)
                    const targetDoorAngle = playerNear ? Math.PI * 0.5 : 0; // 90 degrees down

                    eff.doorAngle = eff.doorAngle !== undefined ? eff.doorAngle : 0;
                    const speed = playerNear ? 4.0 : 3.0;
                    eff.doorAngle += (targetDoorAngle - eff.doorAngle) * Math.min(1, delta * speed);
                    eff.door.rotation.x = eff.doorAngle;

                    // Sync oven light with door angle
                    if (eff.glow && eff.glowMat) {
                        const openFactor = Math.abs(eff.doorAngle / (Math.PI * 0.5));
                        eff.glowMat.opacity = Math.max(eff.glowMat.opacity, openFactor * 0.15);
                    }
                } else if (isCrate) {
                    // CRATE: Lid flips forward (negative X rotation from back hinge)
                    const targetDoorAngle = playerNear ? -Math.PI * 0.6 : 0; // 108 degrees forward

                    eff.doorAngle = eff.doorAngle !== undefined ? eff.doorAngle : 0;
                    const speed = playerNear ? 5.5 : 3.5;
                    eff.doorAngle += (targetDoorAngle - eff.doorAngle) * Math.min(1, delta * speed);
                    eff.door.rotation.x = eff.doorAngle;

                    // Sync Internal Light with door angle
                    if (eff.light) {
                        const openFactor = Math.abs(eff.doorAngle / (Math.PI * 0.6));
                        eff.light.intensity = openFactor * 1.8;
                    }
                } else {
                    // FREEZER: Lid flips up (negative X rotation from back hinge)
                    const targetDoorAngle = playerNear ? -Math.PI * 0.55 : 0; // 100 degrees up

                    eff.doorAngle = eff.doorAngle !== undefined ? eff.doorAngle : 0;
                    const speed = playerNear ? 5.0 : 3.0;
                    eff.doorAngle += (targetDoorAngle - eff.doorAngle) * Math.min(1, delta * speed);
                    eff.door.rotation.x = eff.doorAngle;

                    // Sync Internal Light with door angle
                    if (eff.light) {
                        const openFactor = Math.abs(eff.doorAngle / (Math.PI * 0.55));
                        eff.light.intensity = openFactor * 2.5;
                    }
                }
            }

            // --- ANIMATE ALERT ICONS (‼️, ⚠️, 🔥) ---
            const readyIcon = sm.group.getObjectByName('stoveReadyIcon');
            const warnIcon = sm.group.getObjectByName('burnWarn');
            const alertIcons = [readyIcon, warnIcon].filter(i => i);

            alertIcons.forEach(icon => {
                const pulse = 1 + Math.sin(this.animTime * 10) * 0.2;
                icon.scale.set(pulse * 2, pulse * 2, 1);
                const bounce = Math.abs(Math.sin(this.animTime * 5)) * 0.5;
                // Use the icon's original Y as base (already set correctly for oven vs stove)
                icon.position.y = icon.position.y * 0.95 + (icon.position.y + bounce * 0.3) * 0.05;
            });

            if (eff.glowMat && eff.glowMat.opacity > 0) {
                eff.glow.scale.setScalar(1 + Math.sin(this.animTime * 8) * 0.05);

                const pot = sm.group.getObjectByName('vessel_pot');
                const pan = sm.group.getObjectByName('vessel_pan');
                const activeVessel = (pot && pot.visible) ? pot : ((pan && pan.visible) ? pan : null);

                if (activeVessel) {
                    activeVessel.position.x = Math.sin(this.animTime * 20) * 0.02;
                    activeVessel.rotation.z = Math.sin(this.animTime * 15) * 0.02;
                }

                if (!eff.particles) {
                    eff.particles = [];
                    eff.particleGroup = new THREE.Group();
                    eff.particleGroup.position.set(0, 1.2, 0);
                    sm.group.add(eff.particleGroup);
                }

                const isBurning = eff.glowMat.color.getHex() === 0xff0000;
                const emissionChance = isBurning ? 0.35 : 0.15;

                if (Math.random() < emissionChance) {
                    const pGeo = new THREE.SphereGeometry(isBurning ? 0.18 : 0.08, 4, 4);
                    const pColor = isBurning ? 0x111111 : 0xffffff;
                    const pMat = new THREE.MeshBasicMaterial({ color: pColor, transparent: true, opacity: isBurning ? 0.9 : 0.4 });
                    const p = new THREE.Mesh(pGeo, pMat);
                    p.position.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
                    p.userData = { life: isBurning ? 1.5 : 1.0, speedY: (isBurning ? 2.2 : 0.8) };
                    eff.particleGroup.add(p);
                    eff.particles.push(p);
                }

                for (let i = eff.particles.length - 1; i >= 0; i--) {
                    const p = eff.particles[i];
                    p.position.y += p.userData.speedY * delta;
                    p.userData.life -= delta;
                    p.material.opacity = p.userData.life * 0.5;
                    p.scale.setScalar(1 + (1 - p.userData.life) * 2);
                    if (p.userData.life <= 0) {
                        eff.particleGroup.remove(p);
                        eff.particles.splice(i, 1);
                    }
                }
            } else if (eff.particles && eff.particles.length > 0) {
                eff.particles.forEach(p => eff.particleGroup.remove(p));
                eff.particles = [];
            }
        });

        // --- Chimney Smoke for Ovens ---
        Object.entries(this.stationEffects).forEach(([id, eff]) => {
            if (eff.chimneySmoke && eff.chimneyParticles) {
                // Only emit smoke when oven has contents (cooking)
                const sm = this.stationMeshes[id];
                const hasContents = sm && sm.group.getObjectByName('contents');

                if (hasContents && Math.random() < 0.12) {
                    const pGeo = new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 4, 4);
                    const pMat = new THREE.MeshBasicMaterial({
                        color: 0x555555, transparent: true, opacity: 0.4
                    });
                    const p = new THREE.Mesh(pGeo, pMat);
                    p.position.set(
                        (Math.random() - 0.5) * 0.1,
                        0,
                        (Math.random() - 0.5) * 0.1
                    );
                    p.userData = {
                        life: 1.5 + Math.random() * 0.5,
                        speedY: 0.6 + Math.random() * 0.4,
                        drift: (Math.random() - 0.5) * 0.5
                    };
                    eff.chimneySmoke.add(p);
                    eff.chimneyParticles.push(p);
                }

                // Update particles
                for (let i = eff.chimneyParticles.length - 1; i >= 0; i--) {
                    const p = eff.chimneyParticles[i];
                    p.position.y += p.userData.speedY * delta;
                    p.position.x += p.userData.drift * delta;
                    p.userData.life -= delta;
                    p.material.opacity = Math.max(0, p.userData.life * 0.3);
                    p.scale.setScalar(1 + (1.5 - p.userData.life) * 1.5);
                    if (p.userData.life <= 0) {
                        eff.chimneySmoke.remove(p);
                        eff.chimneyParticles.splice(i, 1);
                    }
                }
            }
        });

        // --- NEW: Animate Steam on Plates/Ingredients ---
        Object.values(this.stationMeshes).forEach(sm => {
            const contents = sm.group.getObjectByName('contents');
            if (contents) {
                const steamGroup = contents.getObjectByName('steamGroup');
                if (steamGroup) {
                    // Emit steam particles
                    if (Math.random() < 0.1) {
                        const p = new THREE.Mesh(
                            new THREE.SphereGeometry(0.05, 4, 4),
                            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
                        );
                        p.position.set((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3);
                        p.userData = { life: 1.0, speedY: 0.5 + Math.random() * 0.5 };
                        steamGroup.add(p);
                    }
                    // Update steam particles
                    for (let i = steamGroup.children.length - 1; i >= 0; i--) {
                        const p = steamGroup.children[i];
                        if (p.name === 'steamGroup') continue; // Should not happen
                        p.position.y += p.userData.speedY * delta;
                        p.userData.life -= delta;
                        p.material.opacity = p.userData.life * 0.3;
                        p.scale.setScalar(1 + (1 - p.userData.life) * 1.5);
                        if (p.userData.life <= 0) {
                            steamGroup.remove(p);
                        }
                    }
                }
            }

            // --- ANIMATE SUGGESTION SPRITE ---
            if (contents) {
                const suggestion = contents.getObjectByName('suggestionSprite');
                if (suggestion) {
                    suggestion.position.y += Math.sin(this.animTime * 4) * 0.002;
                }
            }
        });

        // Animate chopping knives
        Object.values(this.stationMeshes).forEach(sm => {
            const knife = sm.group.getObjectByName('knife');
            if (knife) {
                const now = Date.now();
                const isChopping = sm.lastChopUpdate && (now - sm.lastChopUpdate) < 300;
                if (isChopping) {
                    // Create a sharp swift chopping cycle (0 to 1 repeatedly)
                    const cycleSpeed = 300; // 300ms per chop
                    const t = (now % cycleSpeed) / cycleSpeed;

                    // Swift up, BAM down
                    let lift = 0;
                    let isImpact = false;
                    if (t < 0.6) {
                        // Lifting slowly
                        lift = Math.sin((t / 0.6) * (Math.PI / 2));
                    } else {
                        // Slamming down fast
                        lift = 1.0 - Math.pow((t - 0.6) / 0.4, 3);
                        if (t > 0.85) isImpact = true;
                    }

                    // Knife moves to center of board while chopping
                    const restX = this.ts * 0.25;
                    const restZ = -this.ts * 0.2;
                    const chopX = -0.1; // Shift left so blade tip hits center
                    const chopZ = 0;

                    knife.position.x = restX + (chopX - restX) * 0.8;
                    knife.position.z = restZ + (chopZ - restZ) * 0.8;

                    // Up-down high arching chop motion
                    const height = lift * 0.7;
                    knife.position.y = (sm.baseMesh.position.y * 2 + 0.25) + height;

                    // Make it face the board away from the character standing in front.
                    // X-axis: 0 means it lies flat, Math.PI / 2 means blade edge faces down
                    // Y-axis: Math.PI/2 faces it forward into the table (away from player)
                    // Z-axis: controls the chop tilt

                    const chopTilt = (lift - 0.5) * 1.8;
                    knife.rotation.set(
                        Math.PI / 2, // Edge faces table
                        -Math.PI / 2,  // Handle toward player (bottom right of screen), tip toward board
                        -chopTilt // Tilt the handle vs tip
                    );

                    // Hard hit on the board
                    if (isImpact) {
                        knife.position.y -= 0.1; // Thunk down into board
                        knife.rotation.z += 0.6; // Tip points forcefully down, snapping!
                    }

                    if (!sm.chopParticles) {
                        sm.chopParticles = [];
                        sm.particleGroup = new THREE.Group();
                        sm.group.add(sm.particleGroup);
                    }

                    const content = sm.group.getObjectByName('contents');

                    // Explosive particle burst on impact!
                    if (content && isImpact && Math.random() < 0.8) {
                        const ingMesh = content.children[0];
                        const color = (ingMesh && ingMesh.material) ? ingMesh.material.color : 0xffffff;

                        // Spawn more particles for visual satisfaction
                        for (let i = 0; i < 4; i++) {
                            const size = 0.03 + Math.random() * 0.05;
                            const pmat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
                            const p = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), pmat);
                            p.position.set(
                                (Math.random() - 0.5) * 0.2,
                                (sm.baseMesh.position.y * 2 + 0.35),
                                (Math.random() - 0.5) * 0.2
                            );

                            // Fly outwards aggressively
                            const angleSpread = Math.random() * Math.PI * 2;
                            const speed = 3 + Math.random() * 5;
                            p.userData = {
                                vx: Math.cos(angleSpread) * speed,
                                vy: 3 + Math.random() * 6, // High arc
                                vz: Math.sin(angleSpread) * speed,
                                life: 0.9,
                                spin: (Math.random() - 0.5) * 20
                            };
                            sm.particleGroup.add(p);
                            sm.chopParticles.push(p);
                        }
                    }

                    // Chaotic shaking of the ingredient on impact
                    if (content) {
                        if (isImpact) {
                            content.scale.setScalar(0.8 + Math.random() * 0.4);
                            content.position.x = (Math.random() - 0.5) * 0.2;
                            content.position.z = (Math.random() - 0.5) * 0.2;
                            content.rotation.y += (Math.random() - 0.5) * 0.5;
                        } else {
                            // Settle back down
                            content.scale.lerp(new THREE.Vector3(1, 1, 1), 0.2);
                            content.position.x *= 0.5;
                            content.position.z *= 0.5;
                        }
                    }
                } else {
                    // Smooth return to rest position beside board
                    const restX = this.ts * 0.25;
                    const restY = sm.baseMesh.position.y * 2 + 0.1;
                    const restZ = -this.ts * 0.2;

                    knife.position.x += (restX - knife.position.x) * 0.12;
                    knife.position.y += (restY - knife.position.y) * 0.12;
                    knife.position.z += (restZ - knife.position.z) * 0.12;
                    // Reset to gentle lying angle (lying flat on X/Z, slightly rotated on Y)
                    knife.rotation.x += (0 - knife.rotation.x) * 0.12;
                    knife.rotation.y += (0.3 - knife.rotation.y) * 0.12;
                    knife.rotation.z += (0 - knife.rotation.z) * 0.12;
                    // Reset content position
                    const content = sm.group.getObjectByName('contents');
                    if (content) {
                        content.scale.x += (1 - content.scale.x) * 0.15;
                        content.scale.y += (1 - content.scale.y) * 0.15;
                        content.scale.z += (1 - content.scale.z) * 0.15;
                        content.position.x *= 0.85;
                        content.position.z *= 0.85;
                        content.rotation.y *= 0.85;
                    }
                }
            }

            const pin = sm.group.getObjectByName('rollingPin');
            if (pin) {
                const now = Date.now();
                const isRolling = sm.lastRollUpdate && (now - sm.lastRollUpdate) < 300;
                if (isRolling) {
                    const angle = now * 0.02;
                    // Roll back and forth along X axis while lying flat
                    pin.position.x = Math.sin(angle) * 0.3;
                    // Slight up-down pumping motion
                    pin.position.y = (sm.baseMesh.position.y * 2 + 0.12) + Math.abs(Math.sin(angle * 2)) * 0.08;
                } else {
                    pin.position.x += (0 - pin.position.x) * 0.1;
                    pin.position.y += ((sm.baseMesh.position.y * 2 + 0.12) - pin.position.y) * 0.1;
                }
            }

            if (sm.chopParticles) {
                for (let i = sm.chopParticles.length - 1; i >= 0; i--) {
                    const p = sm.chopParticles[i];

                    // Physics with air resistance
                    p.position.x += p.userData.vx * delta;
                    p.position.y += p.userData.vy * delta;
                    p.position.z += p.userData.vz * delta;

                    // Gravity
                    p.userData.vy -= 18 * delta;

                    // Air resistance
                    p.userData.vx *= (1 - 2 * delta);
                    p.userData.vz *= (1 - 2 * delta);

                    // Rotation for tumbling effect
                    if (p.userData.spin) {
                        p.rotation.x += p.userData.spin * delta;
                        p.rotation.y += p.userData.spin * 0.7 * delta;
                        p.rotation.z += p.userData.spin * 0.5 * delta;
                    }

                    // Fade out
                    p.userData.life -= delta;
                    p.material.opacity = Math.max(0, p.userData.life / 0.7);

                    // Slight scale change
                    const scale = 1 - (1 - p.userData.life / 0.7) * 0.3;
                    p.scale.setScalar(scale);

                    // Remove when done
                    if (p.userData.life <= 0 || p.position.y < 0) {
                        sm.particleGroup.remove(p);
                        sm.chopParticles.splice(i, 1);
                    }
                }
            }
        });

        // --- SEASONING LABEL PROXIMITY ---
        Object.values(this.stationMeshes).forEach(sm => {
            const label = sm.group.getObjectByName('seasoningLabel');
            if (label) {
                // Check if the timed rare seasoning model is currently rendered
                const isSeasoningActive = !!sm.group.getObjectByName('rareSeasoningModel');

                let playerNear = false;
                if (isSeasoningActive && players) {
                    const sx = sm.group.position.x;
                    const sz = sm.group.position.z;
                    Object.values(players).forEach(p => {
                        const px = (p.x !== undefined) ? p.x : p.gridX * this.ts;
                        const pz = (p.z !== undefined) ? p.z : p.gridZ * this.ts;
                        const d = Math.sqrt((px - sx) ** 2 + (pz - sz) ** 2);
                        if (d < this.ts * 1.5) playerNear = true;
                    });
                }

                // Visible only if seasoning station effect is active AND player is near
                label.visible = isSeasoningActive && playerNear;

                if (label.visible) {
                    const pulse = 1 + Math.sin(this.animTime * 4) * 0.1;
                    label.scale.set(2.0 * pulse, 1.0 * pulse, 1);
                }
            }
        });
    }
}
