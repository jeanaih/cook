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

        // Floating Floor Base (Thick Box)
        const totalW = this.config.GRID_W * this.ts;
        const totalH = this.config.GRID_H * this.ts;
        const thickness = 2.0;

        // --- PURPLE FLOOR (TO PROVE UPDATE IS LIVE) ---
        const baseGeo = new THREE.BoxGeometry(totalW + 2.5, thickness, totalH + 2.5);
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x8e44ad, roughness: 0.1, metalness: 0.2
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(totalW / 2 - this.ts / 2, -thickness / 2 - 0.05, totalH / 2 - this.ts / 2);
        base.receiveShadow = true;
        this.environmentGroup.add(base);

        // Sub-tiles for gloss
        const shinyFloorGeo = new THREE.PlaneGeometry(totalW + 2, totalH + 2);
        const shinyFloorMat = new THREE.MeshStandardMaterial({
            color: 0x2c3e50, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.3
        });
        const shinyFloor = new THREE.Mesh(shinyFloorGeo, shinyFloorMat);
        shinyFloor.rotation.x = -Math.PI / 2;
        shinyFloor.position.set(totalW / 2 - this.ts / 2, 0.005, totalH / 2 - this.ts / 2);
        this.environmentGroup.add(shinyFloor);

        // Walls
        const wallHeight = 2.5;
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x2980b9, roughness: 0.3 }); // Nicer blue

        // Back Wall
        const backGeo = new THREE.BoxGeometry(totalW + 2, wallHeight, 1);
        const backWall = new THREE.Mesh(backGeo, wallMat);
        backWall.position.set(totalW / 2 - this.ts / 2, wallHeight / 2, -this.ts / 2 - 1.5);
        backWall.receiveShadow = true;
        backWall.castShadow = true;
        this.environmentGroup.add(backWall);

        // Left Wall
        const leftGeo = new THREE.BoxGeometry(1, wallHeight, totalH + 3);
        const leftWall = new THREE.Mesh(leftGeo, wallMat);
        leftWall.position.set(-this.ts / 2 - 1.5, wallHeight / 2, totalH / 2 - this.ts / 2);
        leftWall.receiveShadow = true;
        leftWall.castShadow = true;
        this.environmentGroup.add(leftWall);

        // Right Wall
        const rightGeo = new THREE.BoxGeometry(1, wallHeight, totalH + 3);
        const rightWall = new THREE.Mesh(rightGeo, wallMat);
        rightWall.position.set(totalW - this.ts / 2 + 1.5, wallHeight / 2, totalH / 2 - this.ts / 2);
        rightWall.receiveShadow = true;
        rightWall.castShadow = true;
        this.environmentGroup.add(rightWall);

        // Tiles
        for (let z = 0; z < this.config.GRID_H; z++) {
            for (let x = 0; x < this.config.GRID_W; x++) {
                if (layout[z] && layout[z][x] === 0) {
                    const tGeo = new THREE.PlaneGeometry(this.ts * 0.98, this.ts * 0.98);
                    // Premium marble-ish pattern
                    const isEven = (x + z) % 2 === 0;
                    const shade = isEven ? 0xecf0f1 : 0xbdc3c7;
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
            serve: 0xff6b35,      // Primary Orange (Theme)
            trash: 0xe74c3c,      // Red (Theme Danger)
            plates: 0xfbfbfb,     // White
            sink: 0x3498db,       // Blue
            oven: 0x7f8c8d,       // Stone Gray
            roller: 0xd4a373      // Wood
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
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.2, metalness: 0.8 });
            const fridgeH = baseH * 0.95;
            const sz = this.ts * 0.46;
            const th = 0.04;

            // Main freezer body - hollow chassis
            const createWall = (width, height, depth, x, y, z) => {
                const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
                wall.position.set(x, y, z);
                return wall;
            };

            // Exterior walls
            freezer.add(createWall(sz * 2, fridgeH, th, 0, fridgeH / 2, sz * 0.9 - th / 2)); // front
            freezer.add(createWall(sz * 2, fridgeH, th, 0, fridgeH / 2, -sz * 0.9 + th / 2)); // back
            freezer.add(createWall(th, fridgeH, sz * 1.8, -sz + th / 2, fridgeH / 2, 0)); // left
            freezer.add(createWall(th, fridgeH, sz * 1.8, sz - th / 2, fridgeH / 2, 0)); // right
            freezer.add(createWall(sz * 2, th, sz * 1.8, 0, th / 2, 0)); // bottom

            // Dark gasket rim
            const gasketMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2 });
            const gasket = new THREE.Mesh(new THREE.BoxGeometry(sz * 2.02, 0.05, sz * 1.82), gasketMat);
            gasket.position.y = fridgeH;
            freezer.add(gasket);

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

            // Ground meat packages
            for (let i = 0; i < 2; i++) {
                const pkg = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.5, 0.08, sz * 0.35), meatMat);
                pkg.position.set(0, i * 0.09, 0);
                pkg.rotation.y = (i - 0.5) * 0.3;
                meatSection.add(pkg);

                const wrap = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.52, 0.10, sz * 0.37), wrapMat);
                wrap.position.copy(pkg.position);
                wrap.rotation.copy(pkg.rotation);
                meatSection.add(wrap);
            }

            // Steak packages
            for (let i = 0; i < 2; i++) {
                const steak = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.7, 0.05, sz * 0.25), meatMat);
                steak.position.set(sz * 0.2, 2 * 0.09 + i * 0.06, (i - 0.5) * 0.1);
                steak.rotation.y = 0.2;
                meatSection.add(steak);

                const wrap = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.72, 0.07, sz * 0.27), wrapMat);
                wrap.position.copy(steak.position);
                wrap.rotation.copy(steak.rotation);
                meatSection.add(wrap);
            }

            // Chicken pieces
            const chickenMat = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.4 });
            const chickenWrapMat = new THREE.MeshStandardMaterial({ color: 0xfff8dc, transparent: true, opacity: 0.5 });

            for (let i = 0; i < 3; i++) {
                const chicken = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.3, 0.06, sz * 0.3), chickenMat);
                chicken.position.set(-sz * 0.3, 2.5 * 0.09 + i * 0.07, (Math.random() - 0.5) * 0.15);
                chicken.rotation.set(Math.random() * 0.4 - 0.2, Math.random() * 0.6 - 0.3, Math.random() * 0.4 - 0.2);
                meatSection.add(chicken);

                const wrap = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.32, 0.08, sz * 0.32), chickenWrapMat);
                wrap.position.copy(chicken.position);
                wrap.rotation.copy(chicken.rotation);
                meatSection.add(wrap);
            }

            // FISH SECTION (Right side)
            const fishSection = new THREE.Group();
            const fishMat = new THREE.MeshStandardMaterial({ color: 0x3498db, metalness: 0.7, roughness: 0.1 });

            // Whole fish
            for (let i = 0; i < 2; i++) {
                const fish = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.35, 4, 8), fishMat);
                fish.rotation.z = Math.PI / 2;
                fish.rotation.y = Math.random() * Math.PI;
                fish.position.set(sz * 0.35, 3 * 0.13 + i * 0.2, (Math.random() - 0.5) * 0.2);
                fishSection.add(fish);
            }

            // Fish fillets
            for (let i = 0; i < 3; i++) {
                const fillet = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.15), fishMat);
                fillet.position.set(sz * 0.3, 2.5 * 0.13 + i * 0.08, (Math.random() - 0.5) * 0.25);
                fillet.rotation.y = Math.random() * 0.4 - 0.2;
                fishSection.add(fillet);

                const fWrap = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.035, 0.17), wrapMat);
                fWrap.position.copy(fillet.position);
                fWrap.rotation.copy(fillet.rotation);
                fishSection.add(fWrap);
            }

            fishSection.position.set(sz * 0.2, fridgeH * 0.25, 0);
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
            // LID WITH GLASS
            // ======================================
            const lid = new THREE.Group();
            lid.name = 'freezerDoor';
            lid.position.set(0, fridgeH + 0.02, -sz * 0.8);

            const frameW = 0.15;
            const frameMat = bodyMat;
            lid.add(createWall(sz * 2, 0.08, frameW, 0, 0.04, frameW / 2, frameMat)); // back frame
            lid.add(createWall(sz * 2, 0.08, frameW, 0, 0.04, sz * 1.6 - frameW / 2, frameMat)); // front frame
            lid.add(createWall(frameW, 0.08, sz * 1.6, -sz + frameW / 2, 0.04, sz * 0.8, frameMat)); // left frame
            lid.add(createWall(frameW, 0.08, sz * 1.6, sz - frameW / 2, 0.04, sz * 0.8, frameMat)); // right frame

            // Glass panel
            const glassMat = new THREE.MeshStandardMaterial({
                color: 0xccf2ff, transparent: true, opacity: 0.35,
                roughness: 0, metalness: 0.7, side: THREE.DoubleSide
            });
            const glass = new THREE.Mesh(new THREE.PlaneGeometry(sz * 1.8, sz * 1.45), glassMat);
            glass.rotation.x = -Math.PI / 2;
            glass.position.set(0, 0.041, sz * 0.8);
            lid.add(glass);

            // Handle
            const handleMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, metalness: 0.9, roughness: 0.1 });
            const handle = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.9, 0.05, 0.08), handleMat);
            handle.position.set(0, 0.09, sz * 1.5);
            lid.add(handle);

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
            // GENERIC CRATE (wooden box): tomato, onion, mushroom, meat(raw), etc.
            // ======================================
            const tableGroup = new THREE.Group();

            const counterMat = new THREE.MeshStandardMaterial({ color: crateCounterColor, roughness: 0.5, metalness: 0.15 });
            const counterBlock = new THREE.Mesh(new THREE.BoxGeometry(this.ts * 0.9, baseH, this.ts * 0.9), counterMat);
            counterBlock.position.y = baseH / 2;
            counterBlock.castShadow = true;
            counterBlock.receiveShadow = true;
            tableGroup.add(counterBlock);

            // Top surface — dark tile matching floor
            const topSurfMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.35, metalness: 0.1 });
            const topSurf = new THREE.Mesh(new THREE.BoxGeometry(this.ts * 0.92, 0.05, this.ts * 0.92), topSurfMat);
            topSurf.position.y = baseH + 0.025;
            tableGroup.add(topSurf);

            // --- WOODEN BOX / CRATE on counter ---
            const woodMat = new THREE.MeshStandardMaterial({ color: 0xA0724A, roughness: 0.85 });
            const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x7B5B3A, roughness: 0.9 });
            const boxSz = this.ts * 0.36;
            const boxH = 0.3;

            const plankMat = [woodMat, darkWoodMat];
            const sides = [
                { pos: [0, baseH + boxH / 2 + 0.05, boxSz], rot: 0 },
                { pos: [0, baseH + boxH / 2 + 0.05, -boxSz], rot: 0 },
                { pos: [boxSz, baseH + boxH / 2 + 0.05, 0], rot: Math.PI / 2 },
                { pos: [-boxSz, baseH + boxH / 2 + 0.05, 0], rot: Math.PI / 2 }
            ];
            sides.forEach((side, idx) => {
                for (let p = 0; p < 2; p++) {
                    const plank = new THREE.Mesh(
                        new THREE.BoxGeometry(boxSz * 2, boxH / 2 - 0.01, 0.03),
                        plankMat[(idx + p) % 2]
                    );
                    plank.position.set(side.pos[0], side.pos[1] + (p - 0.5) * (boxH / 2), side.pos[2]);
                    plank.rotation.y = side.rot;
                    plank.castShadow = true;
                    tableGroup.add(plank);
                }
            });

            const boxBottom = new THREE.Mesh(new THREE.BoxGeometry(boxSz * 2, 0.025, boxSz * 2), darkWoodMat);
            boxBottom.position.y = baseH + 0.06;
            tableGroup.add(boxBottom);

            const postGeo = new THREE.BoxGeometry(0.04, boxH + 0.02, 0.04);
            [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([cx, cz]) => {
                const post = new THREE.Mesh(postGeo, darkWoodMat);
                post.position.set(cx * boxSz, baseH + boxH / 2 + 0.05, cz * boxSz);
                post.castShadow = true;
                tableGroup.add(post);
            });

            mesh = tableGroup;
            group.add(tableGroup);
            top = null;

        } else if (isCheeseCrate) {
            // --- CHEESE: Giant wedge of cheese on dark tile counter ---
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

            mesh = cheeseGroup;
            group.add(cheeseGroup);
            top = null;

        } else if (isRiceCrate) {
            // --- RICE: Big standalone burlap sack, no table ---
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

        } else if (isDoughCrate) {
            // --- DOUGH: Table with ingredient-colored counter + dough blob ---
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

        } else if (isBreadCrate) {
            // --- BREAD: Wooden table + large loaf of bread ---
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

        } else if (isEggCrate) {
            // --- EGG: Counter with cardboard egg tray ---
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

            // Cardboard egg tray base
            const trayW = 0.65, trayD = 0.50;
            const tray = new THREE.Mesh(new THREE.BoxGeometry(trayW, 0.04, trayD), cardboardMat);
            tray.position.y = baseH + 0.06;
            tray.castShadow = true;
            eggGroup.add(tray);

            // Egg tray bumps (cardboard dividers)
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 4; col++) {
                    const bump = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), cardDarkMat);
                    bump.position.set(-0.23 + col * 0.155, baseH + 0.07, -0.15 + row * 0.15);
                    eggGroup.add(bump);

                    // Egg sitting in each bump
                    const eggMat = new THREE.MeshStandardMaterial({ color: 0xFFF8DC, roughness: 0.4 });
                    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eggMat);
                    egg.scale.set(0.85, 1.25, 0.85);
                    egg.position.set(-0.23 + col * 0.155, baseH + 0.13, -0.15 + row * 0.15);
                    egg.castShadow = true;
                    eggGroup.add(egg);
                }
            }

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
            if (st.type === 'serve') topColor = 0x6495ED;
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
            // --- ULTRA REALISTIC BRICK PIZZA OVEN (Tall & Professional) ---
            const brickMat = new THREE.MeshStandardMaterial({ color: 0xB5651D, roughness: 0.95, metalness: 0.0 });
            const darkBrickMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.95 });
            const stoneMat = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.9 });
            const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });

            // 1. Heavy Stone Pedestal Base (elevated platform)
            const pedestalGeo = new THREE.BoxGeometry(this.ts * 0.95, 0.5, this.ts * 0.95);
            const pedestal = new THREE.Mesh(pedestalGeo, stoneMat);
            pedestal.position.y = baseH + 0.25;
            pedestal.castShadow = true;
            group.add(pedestal);

            // Stone trim on pedestal
            const trimGeo = new THREE.BoxGeometry(this.ts * 1.0, 0.08, this.ts * 1.0);
            const trim = new THREE.Mesh(trimGeo, darkBrickMat);
            trim.position.y = baseH + 0.5;
            group.add(trim);

            // 2. Main Oven Body (Wider Cylinder for realistic kiln shape)
            const bodyGeo = new THREE.CylinderGeometry(this.ts * 0.48, this.ts * 0.5, 0.8, 24);
            const body = new THREE.Mesh(bodyGeo, brickMat);
            body.position.y = baseH + 0.95;
            body.castShadow = true;
            group.add(body);

            // Brick band around middle
            const bandGeo = new THREE.TorusGeometry(this.ts * 0.49, 0.04, 8, 24);
            const band = new THREE.Mesh(bandGeo, darkBrickMat);
            band.rotation.x = Math.PI / 2;
            band.position.y = baseH + 0.9;
            group.add(band);

            // 3. Large Dome on top (Tall & Rounded)
            const dome = new THREE.Mesh(
                new THREE.SphereGeometry(this.ts * 0.48, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2),
                brickMat
            );
            dome.position.y = baseH + 1.35;
            dome.castShadow = true;
            group.add(dome);

            // Dome tip cap
            const capGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.08, 12);
            const cap = new THREE.Mesh(capGeo, darkBrickMat);
            cap.position.y = baseH + 1.8;
            group.add(cap);

            // 4. Brick Chimney (Taller, with cap)
            const chimneyGeo = new THREE.BoxGeometry(0.22, 1.0, 0.22);
            const chimney = new THREE.Mesh(chimneyGeo, darkBrickMat);
            chimney.position.set(0.25, baseH + 1.85, -0.25);
            chimney.castShadow = true;
            group.add(chimney);

            // Chimney cap/hood
            const chimneyCapGeo = new THREE.BoxGeometry(0.32, 0.06, 0.32);
            const chimneyCap = new THREE.Mesh(chimneyCapGeo, stoneMat);
            chimneyCap.position.set(0.25, baseH + 2.38, -0.25);
            group.add(chimneyCap);

            // 5. Oven Opening (Arched Mouth - Larger)
            const mouthGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.18, 24, 1, false, 0, Math.PI);
            const mouth = new THREE.Mesh(mouthGeo, blackMat);
            mouth.rotation.x = Math.PI / 2;
            mouth.position.set(0, baseH + 0.85, this.ts * 0.48);
            group.add(mouth);

            // Arch frame around mouth (brick trim)
            const archGeo = new THREE.TorusGeometry(0.4, 0.06, 8, 16, Math.PI);
            const arch = new THREE.Mesh(archGeo, darkBrickMat);
            arch.rotation.y = Math.PI / 2;
            arch.rotation.x = Math.PI / 2;
            arch.position.set(0, baseH + 0.85, this.ts * 0.5);
            group.add(arch);

            // 6. Fire Glow Inside (visible through mouth)
            const fire = new THREE.Mesh(
                new THREE.SphereGeometry(0.32, 16, 8),
                new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.35 })
            );
            fire.position.set(0, baseH + 0.8, 0.15);
            group.add(fire);

            // Inner glow plane (hearth)
            const hearthGeo = new THREE.PlaneGeometry(0.5, 0.5);
            const hearthMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.2 });
            const hearth = new THREE.Mesh(hearthGeo, hearthMat);
            hearth.position.set(0, baseH + 0.55, this.ts * 0.45);
            group.add(hearth);

            this.stationEffects[st.id] = { glow: fire, glowMat: fire.material };

            // Chimney Smoke Particle System
            const chimneySmoke = new THREE.Group();
            chimneySmoke.name = 'chimneySmoke';
            chimneySmoke.position.set(0.25, baseH + 2.45, -0.25); // Top of chimney
            group.add(chimneySmoke);
            this.stationEffects[st.id].chimneySmoke = chimneySmoke;
            this.stationEffects[st.id].chimneyParticles = [];
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

                } else if (!isRiceCrate) {
                    // --- WOODEN BOX CONTENTS: BIG pile of produce filling the box ---
                    const fillCount = 10;
                    const boxSz = this.ts * 0.32;
                    for (let item = 0; item < fillCount; item++) {
                        let ingMesh;
                        const sz = 0.12 + Math.random() * 0.04; // Big produce
                        if (st.ingredient === 'tomato') {
                            ingMesh = new THREE.Mesh(new THREE.SphereGeometry(sz, 10, 10), ingMat);
                            ingMesh.scale.y = 0.82;
                        } else if (st.ingredient === 'onion') {
                            ingMesh = new THREE.Mesh(new THREE.SphereGeometry(sz * 0.9, 10, 10), ingMat);
                            ingMesh.scale.y = 0.75;
                            // Root tip
                            const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 6),
                                new THREE.MeshStandardMaterial({ color: 0x8B6914 }));
                            tip.position.y = -sz * 0.7;
                            tip.rotation.x = Math.PI;
                            ingMesh.add(tip);
                        } else if (st.ingredient === 'mushroom') {
                            const mG = new THREE.Group();
                            mG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.08, 6),
                                new THREE.MeshStandardMaterial({ color: 0xffffff })));
                            const mCap = new THREE.Mesh(
                                new THREE.SphereGeometry(sz * 0.7, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), ingMat
                            );
                            mCap.position.y = 0.04;
                            mG.add(mCap);
                            ingMesh = mG;
                        } else if (st.ingredient === 'lettuce') {
                            ingMesh = new THREE.Mesh(new THREE.SphereGeometry(sz, 8, 8), ingMat);
                            ingMesh.scale.set(1, 0.55, 1);
                        } else if (st.ingredient === 'cheese') {
                            ingMesh = new THREE.Mesh(new THREE.CylinderGeometry(sz * 0.8, sz * 0.8, 0.08, 3), ingMat);
                        } else if (st.ingredient === 'egg') {
                            ingMesh = new THREE.Mesh(new THREE.SphereGeometry(sz * 0.6, 8, 8), ingMat);
                            ingMesh.scale.set(0.7, 1, 0.7);
                        } else if (st.ingredient === 'dough') {
                            ingMesh = new THREE.Mesh(new THREE.SphereGeometry(sz, 8, 8), ingMat);
                            ingMesh.scale.y = 0.55;
                        } else if (st.ingredient === 'bread') {
                            ingMesh = new THREE.Mesh(new THREE.BoxGeometry(sz * 1.3, sz * 0.8, sz), ingMat);
                        } else {
                            ingMesh = new THREE.Mesh(new THREE.SphereGeometry(sz, 8, 8), ingMat);
                        }

                        if (ingMesh) {
                            // Stack in layers to fill the box
                            const layer = Math.floor(item / 4); // 4 per layer
                            const layerY = baseH + 0.14 + layer * 0.10;
                            ingMesh.position.set(
                                (Math.random() - 0.5) * boxSz * 1.3,
                                layerY,
                                (Math.random() - 0.5) * boxSz * 1.3
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
            // Labels
            const labelY = baseH + 0.7;
            this.addLabel(group, st.ingredient ? this.config.INGREDIENTS[st.ingredient]?.emoji || '📦' : '📦', labelY);
            if (st.ingredient && this.config.INGREDIENTS[st.ingredient]) {
                this.addLabel(group, this.config.INGREDIENTS[st.ingredient].name, labelY + 0.4, 'nameLabel');
            }
        }

        if (st.type === 'chopping') {
            // --- PREMIUM CHOPPING BOARD on steel counter ---
            const boardGroup = new THREE.Group();
            boardGroup.name = 'choppingBoard';

            // Wooden cutting board (thick, with wood grain)
            const boardWood = new THREE.MeshStandardMaterial({ color: 0xC8A26E, roughness: 0.8, metalness: 0.0 });
            const boardDark = new THREE.MeshStandardMaterial({ color: 0xA07850, roughness: 0.85 });
            const board = new THREE.Mesh(new THREE.BoxGeometry(this.ts * 0.7, 0.06, this.ts * 0.55), boardWood);
            board.position.y = baseH + 0.06;
            board.castShadow = true;
            boardGroup.add(board);

            // Wood grain stripes
            for (let stripe = 0; stripe < 5; stripe++) {
                const grain = new THREE.Mesh(
                    new THREE.BoxGeometry(this.ts * 0.68, 0.002, 0.03),
                    stripe % 2 === 0 ? boardDark : boardWood
                );
                grain.position.set(0, baseH + 0.092, (stripe - 2) * (this.ts * 0.1));
                boardGroup.add(grain);
            }

            // Juice groove (carved border)
            const grooveMat = new THREE.MeshStandardMaterial({ color: 0x997755, roughness: 0.9 });
            const groove = new THREE.Mesh(
                new THREE.BoxGeometry(this.ts * 0.62, 0.005, this.ts * 0.45),
                grooveMat
            );
            groove.position.y = baseH + 0.093;
            boardGroup.add(groove);

            group.add(boardGroup);

            // Knife model lying beside the board
            const knifeGroup = new THREE.Group();
            knifeGroup.name = 'knife';

            // Handle (dark ergonomic)
            const hGeo = new THREE.BoxGeometry(0.05, 0.04, 0.22);
            const hMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
            const handle = new THREE.Mesh(hGeo, hMat);
            handle.position.z = 0.15;
            knifeGroup.add(handle);

            // Rivets on handle
            const rivetMat = new THREE.MeshStandardMaterial({ color: 0xAAAAAA, metalness: 0.8 });
            for (let r = 0; r < 2; r++) {
                const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), rivetMat);
                rivet.rotation.x = Math.PI / 2;
                rivet.position.set(0, 0, 0.1 + r * 0.08);
                knifeGroup.add(rivet);
            }

            // Blade (wide chef's knife)
            const bGeo = new THREE.BoxGeometry(0.02, 0.1, 0.35);
            const bMat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC, metalness: 0.9, roughness: 0.1 });
            const blade = new THREE.Mesh(bGeo, bMat);
            blade.position.z = -0.12;
            knifeGroup.add(blade);

            knifeGroup.position.set(this.ts * 0.38, baseH + 0.1, 0);
            knifeGroup.rotation.y = -0.15;
            knifeGroup.rotation.z = Math.PI / 2; // Lay flat
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
            // --- PREMIUM SERVING PASS-THROUGH WINDOW ---
            const serveMat = new THREE.MeshStandardMaterial({ color: 0xE8E0D0, roughness: 0.3, metalness: 0.05 });
            const accentMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, roughness: 0.2, metalness: 0.9 }); // Gold
            const darkMat = new THREE.MeshStandardMaterial({ color: 0x2C2C2C, roughness: 0.5 });

            // Main marble-like counter slab on top
            const slab = new THREE.Mesh(new THREE.BoxGeometry(this.ts * 0.88, 0.08, this.ts * 0.72), serveMat);
            slab.position.y = baseH + 0.04;
            slab.receiveShadow = true;
            slab.castShadow = true;
            group.add(slab);

            // Gold trim border around slab
            const trim = new THREE.Mesh(new THREE.BoxGeometry(this.ts * 0.90, 0.025, this.ts * 0.74), accentMat);
            trim.position.y = baseH + 0.09;
            group.add(trim);

            // Order ticket clip (small vertical post with clip)
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6), darkMat);
            post.position.set(-this.ts * 0.28, baseH + 0.20, 0);
            group.add(post);
            const clip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), accentMat);
            clip.position.set(-this.ts * 0.28, baseH + 0.31, 0);
            group.add(clip);

            // Service bell (gold)
            const bellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.04, 16), accentMat);
            bellBase.position.set(this.ts * 0.22, baseH + 0.10, this.ts * 0.18);
            group.add(bellBase);
            const bellDome = new THREE.Mesh(
                new THREE.SphereGeometry(0.055, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), accentMat
            );
            bellDome.position.set(this.ts * 0.22, baseH + 0.12, this.ts * 0.18);
            group.add(bellDome);
            // Bell button on top
            const btn = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), darkMat);
            btn.position.set(this.ts * 0.22, baseH + 0.178, this.ts * 0.18);
            group.add(btn);

            // Heat lamp post (restaurant-style)
            const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.40, 8), darkMat);
            lampPost.position.set(this.ts * 0.1, baseH + 0.28, -this.ts * 0.25);
            group.add(lampPost);
            const lampHead = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.06, 12), darkMat);
            lampHead.position.set(this.ts * 0.1, baseH + 0.50, -this.ts * 0.25);
            group.add(lampHead);
            const lampGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.02, 12),
                new THREE.MeshBasicMaterial({ color: 0xFF6600, transparent: true, opacity: 0.7 }));
            lampGlow.position.set(this.ts * 0.1, baseH + 0.475, -this.ts * 0.25);
            group.add(lampGlow);
            this.addLabel(group, '🍽️', baseH + 0.9);
        }
        if (st.type === 'trash') {
            // --- LARGE COUNTER-SIZED TRASH BIN (no label, fills tile) ---
            const trashGroup = new THREE.Group();
            const sz = this.ts * 0.88; // Full counter footprint width

            // Body (big square metal box matching counter height)
            const canMat = new THREE.MeshStandardMaterial({ color: 0x6E7A7A, roughness: 0.25, metalness: 0.75 });
            const canBody = new THREE.Mesh(new THREE.BoxGeometry(sz, baseH * 0.95, sz), canMat);
            canBody.position.y = baseH * 0.95 / 2;
            canBody.castShadow = true;
            trashGroup.add(canBody);

            // Red accent band at mid-height
            const bandMat = new THREE.MeshStandardMaterial({ color: 0xBB1111, roughness: 0.4, metalness: 0.3 });
            const band = new THREE.Mesh(new THREE.BoxGeometry(sz + 0.01, 0.09, sz + 0.01), bandMat);
            band.position.y = baseH * 0.95 * 0.42;
            trashGroup.add(band);

            // Yellow warning label panel on front
            const panelMat = new THREE.MeshStandardMaterial({ color: 0xFFCC00, roughness: 0.5 });
            const panel = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.45, sz * 0.22, 0.012), panelMat);
            panel.position.set(0, baseH * 0.55, sz * 0.501);
            trashGroup.add(panel);

            // Little black X on the panel
            const xMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
            const xBar1 = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.2, 0.015, 0.013), xMat);
            xBar1.rotation.z = Math.PI / 4;
            xBar1.position.set(0, baseH * 0.55, sz * 0.508);
            trashGroup.add(xBar1);
            const xBar2 = xBar1.clone();
            xBar2.rotation.z = -Math.PI / 4;
            xBar2.position.set(0, baseH * 0.55, sz * 0.509);
            trashGroup.add(xBar2);

            // Interior (visible dark top)
            const interiorMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 1.0 });
            const interior = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.93, baseH * 0.92, sz * 0.93), interiorMat);
            interior.position.y = baseH * 0.90 / 2 + 0.02;
            trashGroup.add(interior);

            // Black bag neck visible at top
            const bagMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
            const bag = new THREE.Mesh(new THREE.CylinderGeometry(sz * 0.25, sz * 0.35, sz * 0.18, 8), bagMat);
            bag.position.y = baseH * 0.945;
            trashGroup.add(bag);

            // LID GROUP (hinged at back edge)
            const lidGroup = new THREE.Group();
            lidGroup.name = 'trashLid';
            lidGroup.position.set(0, baseH * 0.955, -sz * 0.41);
            trashGroup.add(lidGroup);

            const lidMat = new THREE.MeshStandardMaterial({ color: 0x576060, roughness: 0.2, metalness: 0.88 });
            const lid = new THREE.Mesh(new THREE.BoxGeometry(sz + 0.02, 0.055, sz + 0.02), lidMat);
            lid.position.set(0, 0.028, sz * 0.41);
            lidGroup.add(lid);

            // Lid handle (wide bar on top)
            const handleMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.95 });
            const lHandle = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.35, 0.045, 0.06), handleMat);
            lHandle.position.set(0, 0.065, sz * 0.41);
            lidGroup.add(lHandle);

            // Foot pedal at base
            const pedalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.75 });
            const pedal = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.4, 0.035, sz * 0.22), pedalMat);
            pedal.position.set(0, 0.018, sz * 0.48);
            trashGroup.add(pedal);

            group.add(trashGroup);
            // NO emoji label

            // Store lid for animation
            this.stationEffects[st.id] = { lidGroup, lidAngle: 0, lidOpen: false };
        }
        if (st.type === 'plates') {
            // Stack of plates
            for (let i = 0; i < 3; i++) {
                const pGeo = new THREE.CylinderGeometry(0.3, 0.32, 0.06, 12);
                const pMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
                const plate = new THREE.Mesh(pGeo, pMat);
                plate.position.y = baseH + 0.05 + i * 0.07;
                group.add(plate);
            }
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

            // Faucet pipe (vertical)
            const pipeMat = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.8, roughness: 0.2 });
            const pipeGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 12);
            const pipe = new THREE.Mesh(pipeGeo, pipeMat);
            pipe.position.set(0, baseH + 0.4, this.ts * 0.3);
            group.add(pipe);

            // Faucet spout (curved pipe)
            const spoutGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.3, 12);
            const spout = new THREE.Mesh(spoutGeo, pipeMat);
            spout.rotation.x = Math.PI / 2.5; // Curving forward again
            spout.position.set(0, baseH + 0.65, this.ts * 0.15); // At the FRONT
            group.add(spout);

            // Faucet tip (nozzle)
            const nozzleGeo = new THREE.CylinderGeometry(0.02, 0.035, 0.08, 8);
            const nozzle = new THREE.Mesh(nozzleGeo, pipeMat);
            nozzle.position.set(0, baseH + 0.55, 0);
            group.add(nozzle);

            // Handles (left/right knobs)
            const knobGeo = new THREE.SphereGeometry(0.04, 8, 8);
            const knobMatR = new THREE.MeshStandardMaterial({ color: 0xe74c3c, metalness: 0.5 });
            const knobMatB = new THREE.MeshStandardMaterial({ color: 0x3498db, metalness: 0.5 });
            const knobL = new THREE.Mesh(knobGeo, knobMatR);
            knobL.position.set(-0.15, baseH + 0.45, this.ts * 0.3);
            const knobR = new THREE.Mesh(knobGeo, knobMatB);
            knobR.position.set(0.15, baseH + 0.45, this.ts * 0.3);
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

        if (stationData.contents) {
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

        if (stationData.chopProgress > 0 || isDoneChop) {
            const existBar = ui.getObjectByName('chopBar');
            if (existBar) ui.remove(existBar);
            const existBg = ui.getObjectByName('chopBarBg');
            if (existBg) ui.remove(existBg);

            if (!isDoneChop) {
                const bgGeo = new THREE.BoxGeometry(this.ts * 0.82, 0.12, 0.18);
                const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
                const bg = new THREE.Mesh(bgGeo, bgMat);
                bg.name = 'chopBarBg';
                bg.position.set(0, 1.5, -0.6);
                ui.add(bg);

                const p = Math.min(stationData.chopProgress / 100, 1.0);
                const barGeo = new THREE.BoxGeometry(this.ts * 0.8 * p, 0.08, 0.15);
                const barColor = new THREE.Color().setHSL(0.3 + p * 0.2, 0.9, 0.5);
                const barMat = new THREE.MeshBasicMaterial({ color: barColor });
                const bar = new THREE.Mesh(barGeo, barMat);
                bar.name = 'chopBar';
                bar.position.set(-this.ts * 0.4 * (1 - p), 1.5, -0.6);
                ui.add(bar);
            }

            if (isDoneChop && stationData.contents && stationData.type === 'chopping') {
                const existReady = ui.getObjectByName('readyIcon');
                if (!existReady) {
                    this.addLabel(ui, '✅', 1.8);
                    const newReady = ui.children[ui.children.length - 1];
                    newReady.name = 'readyIcon';
                }
            } else {
                const existReady = ui.getObjectByName('readyIcon');
                if (existReady) ui.remove(existReady);
            }

            const contentMesh = sm.group.getObjectByName('contents');
            if (contentMesh && stationData.chopProgress < 100 && stationData.chopProgress > 0) {
                contentMesh.scale.x = 1 + Math.sin(Date.now() * 0.05) * 0.1;
            }
        } else {
            const existBar = ui.getObjectByName('chopBar'); if (existBar) ui.remove(existBar);
            const existBg = ui.getObjectByName('chopBarBg'); if (existBg) ui.remove(existBg);
            const existReady = ui.getObjectByName('readyIcon'); if (existReady) ui.remove(existReady);
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
    }

    createContentMesh(content) {
        const group = new THREE.Group();

        if (content.type === 'ingredient') {
            const ing = this.config.INGREDIENTS[content.name];
            let color = new THREE.Color(ing ? ing.color : 0xffffff);

            if (content.burnt) {
                color.setHex(0x000000); // Pitch black if burnt
            } else if (content.cooked) {
                color.multiplyScalar(0.6); // Darken cooked food
                if (content.name === 'meat') color.setHex(0x8B4513); // Cooked meat color
            } else if (content.chopped) {
                // SPECIAL LOGIC: PINK FISH FOR SUSHI
                if (content.name === 'fish') color.setHex(0xFFB6C1); // Light Pink (Salmon/Sashimi)
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
                } else if (content.name === 'tomato' || content.name === 'onion') {
                    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 32), mat);
                    bulb.scale.y = 0.9;
                    mesh.add(bulb);
                    const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.15), new THREE.MeshStandardMaterial({ color: 0x27ae60 }));
                    vine.position.y = 0.25;
                    mesh.add(vine);
                } else if (content.name === 'cheese') {
                    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 3), mat);
                    c.rotation.x = Math.PI / 2;
                    mesh.add(c);
                } else if (content.name === 'dough') {
                    // Soft pillowy dough ball
                    const dough = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), mat);
                    dough.scale.y = 0.7;
                    mesh.add(dough);
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

                // Bottom Bun (always first when bread is present)
                const bunColor = content.burnt ? 0x000000 : 0xD4A574;
                const bunMat = new THREE.MeshStandardMaterial({ color: bunColor, roughness: 0.7 });
                const bottomBun = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.1, 24), bunMat);
                bottomBun.position.y = layerY;
                group.add(bottomBun);
                layerY += 0.1;

                // Patty layer (if meat added)
                if (hasMeat) {
                    const pattyColor = content.burnt ? 0x000000 : 0x5D3A1A;
                    const pattyMat = new THREE.MeshStandardMaterial({ color: pattyColor, roughness: 0.8 });
                    const patty = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.36, 0.08, 24), pattyMat);
                    patty.position.y = layerY;
                    group.add(patty);
                    // Grill marks
                    for (let gm = 0; gm < 3; gm++) {
                        const mark = new THREE.Mesh(
                            new THREE.BoxGeometry(0.6, 0.005, 0.03),
                            new THREE.MeshStandardMaterial({ color: 0x2c1810 })
                        );
                        mark.position.set(0, layerY + 0.045, (gm - 1) * 0.12);
                        group.add(mark);
                    }
                    layerY += 0.08;
                }

                // Lettuce layer
                if (hasLettuce) {
                    const lettuceColor = content.burnt ? 0x000000 : 0x27ae60;
                    const lettuceMat = new THREE.MeshStandardMaterial({ color: lettuceColor, roughness: 0.9, side: THREE.DoubleSide });
                    // Wavy lettuce leaf
                    for (let lf = 0; lf < 3; lf++) {
                        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.15), lettuceMat);
                        const angle = (lf / 3) * Math.PI * 2;
                        leaf.position.set(Math.cos(angle) * 0.12, layerY + 0.02, Math.sin(angle) * 0.12);
                        leaf.rotation.set(-Math.PI / 2.5, angle, Math.random() * 0.3);
                        group.add(leaf);
                    }
                    layerY += 0.04;
                }

                // Tomato slices
                if (hasTomato) {
                    const tomatoColor = content.burnt ? 0x000000 : 0xe74c3c;
                    const tomatoMat = new THREE.MeshStandardMaterial({ color: tomatoColor, roughness: 0.5 });
                    const slice1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16), tomatoMat);
                    slice1.position.set(-0.05, layerY, 0.05);
                    group.add(slice1);
                    const slice2 = slice1.clone();
                    slice2.position.set(0.08, layerY, -0.03);
                    group.add(slice2);
                    layerY += 0.04;
                }

                // Top Bun (rounded dome shape)
                const topBunGeo = new THREE.SphereGeometry(0.38, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
                const topBun = new THREE.Mesh(topBunGeo, bunMat);
                topBun.position.y = layerY;
                group.add(topBun);

                // Sesame seeds on top bun
                const seedMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
                for (let s = 0; s < 5; s++) {
                    const seed = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), seedMat);
                    const sa = (s / 5) * Math.PI * 2;
                    seed.position.set(
                        Math.cos(sa) * 0.15,
                        layerY + 0.32 + Math.random() * 0.05,
                        Math.sin(sa) * 0.15
                    );
                    seed.scale.set(1, 0.5, 1.5);
                    group.add(seed);
                }
                finalHeight = layerY + 0.35;
            }
            // ==========================================
            // PIZZA ASSEMBLY (progressive)
            // ==========================================
            else if (hasDough) {
                let layerY = 0.1;

                // Flat dough base (round pizza shape)
                const doughColor = content.burnt ? 0x000000 : 0xF5DEB3;
                const doughMat = new THREE.MeshStandardMaterial({ color: doughColor, roughness: 0.8 });
                const pizzaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.05, 32), doughMat);
                pizzaBase.position.y = layerY;
                group.add(pizzaBase);

                // Raised crust edge
                const crustMat = new THREE.MeshStandardMaterial({ color: content.burnt ? 0x000000 : 0xD4A574, roughness: 0.7 });
                const crust = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 32), crustMat);
                crust.rotation.x = Math.PI / 2;
                crust.position.y = layerY + 0.03;
                group.add(crust);
                layerY += 0.06;

                // Tomato sauce layer
                if (hasTomato) {
                    const sauceColor = content.burnt ? 0x000000 : 0xc0392b;
                    const sauce = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.38, 0.38, 0.015, 32),
                        new THREE.MeshStandardMaterial({ color: sauceColor, roughness: 0.9 })
                    );
                    sauce.position.y = layerY;
                    group.add(sauce);
                    layerY += 0.02;
                }

                // Cheese layer (shredded look)
                if (hasCheese) {
                    const cheeseColor = content.burnt ? 0x000000 : 0xf1c40f;
                    const cheeseMat = new THREE.MeshStandardMaterial({ color: cheeseColor, roughness: 0.6 });
                    // Scattered cheese shreds
                    for (let cs = 0; cs < 12; cs++) {
                        const shred = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.03), cheeseMat);
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * 0.3;
                        shred.position.set(
                            Math.cos(angle) * radius,
                            layerY,
                            Math.sin(angle) * radius
                        );
                        shred.rotation.y = Math.random() * Math.PI;
                        group.add(shred);
                    }
                    layerY += 0.02;
                }
                finalHeight = layerY;
            }
            // ==========================================
            // SUSHI ASSEMBLY (progressive)
            // ==========================================
            else if (hasRice && hasFish) {
                let layerY = 0.1;

                // Sushi rice base (oval mound)
                const riceColor = content.burnt ? 0x000000 : 0xffffff;
                const riceMat = new THREE.MeshStandardMaterial({ color: riceColor, roughness: 0.8 });
                // Multiple rice nigiri pieces
                for (let s = 0; s < 2; s++) {
                    const riceBase = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), riceMat);
                    riceBase.scale.set(1.2, 0.5, 0.7);
                    riceBase.position.set((s - 0.5) * 0.35, layerY + 0.05, 0);
                    group.add(riceBase);

                    // Fish slice on top
                    const fishColor = content.burnt ? 0x000000 : 0xFFB6C1;
                    const fishMat = new THREE.MeshStandardMaterial({ color: fishColor, roughness: 0.4 });
                    const fishSlice = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.14), fishMat);
                    fishSlice.position.set((s - 0.5) * 0.35, layerY + 0.14, 0);
                    fishSlice.rotation.y = 0.1;
                    group.add(fishSlice);
                }

                // Nori wrap strip (dark green)
                const noriMat = new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.9 });
                const nori = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.22), noriMat);
                nori.position.set(-0.15, layerY + 0.08, 0);
                group.add(nori);
                finalHeight = layerY + 0.15;
            }
            // ==========================================
            // SOUP ASSEMBLY (progressive)
            // ==========================================
            else if (hasOnion && hasMushroom && hasTomato) {
                // Soup bowl effect
                const bowlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
                const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.35, 0.25, 24), bowlMat);
                bowl.position.y = 0.15;
                group.add(bowl);

                // Soup liquid
                const soupColor = content.burnt ? 0x000000 : 0xc0392b;
                const soupMat = new THREE.MeshStandardMaterial({ color: soupColor, roughness: 0.2, metalness: 0.1 });
                const soup = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.02, 24), soupMat);
                soup.position.y = 0.25;
                group.add(soup);

                // Floating ingredient pieces
                if (hasTomato) {
                    const tCube = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.08),
                        new THREE.MeshStandardMaterial({ color: content.burnt ? 0x000000 : 0xe74c3c }));
                    tCube.position.set(-0.1, 0.27, 0.05);
                    group.add(tCube);
                }
                if (hasOnion) {
                    const oRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 8, 16),
                        new THREE.MeshStandardMaterial({ color: content.burnt ? 0x000000 : 0xf5f5dc }));
                    oRing.rotation.x = Math.PI / 2;
                    oRing.position.set(0.1, 0.27, -0.05);
                    group.add(oRing);
                }
                if (hasMushroom) {
                    const mSlice = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.03, 8),
                        new THREE.MeshStandardMaterial({ color: content.burnt ? 0x000000 : 0x8B7355 }));
                    mSlice.position.set(0, 0.27, 0.1);
                    group.add(mSlice);
                }
                finalHeight = 0.3;
            }
            // ==========================================
            // OMELETTE ASSEMBLY (progressive)
            // ==========================================
            else if (hasEgg) {
                let layerY = 0.1;

                // Folded egg base
                const eggColor = content.burnt ? 0x000000 : 0xFFE66D;
                const eggMat = new THREE.MeshStandardMaterial({ color: eggColor, roughness: 0.6 });
                const eggBase = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 12), eggMat);
                eggBase.scale.set(1.2, 0.25, 0.8);
                eggBase.position.y = layerY + 0.05;
                group.add(eggBase);

                // Cheese filling visible
                if (hasCheese) {
                    const chFill = new THREE.Mesh(
                        new THREE.BoxGeometry(0.15, 0.02, 0.2),
                        new THREE.MeshStandardMaterial({ color: content.burnt ? 0x000000 : 0xf1c40f })
                    );
                    chFill.position.set(0.15, layerY + 0.06, 0);
                    group.add(chFill);
                }

                // Mushroom pieces inside
                if (hasMushroom) {
                    const mPiece = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.03, 0.04, 0.02, 8),
                        new THREE.MeshStandardMaterial({ color: content.burnt ? 0x000000 : 0x8B7355 })
                    );
                    mPiece.position.set(-0.1, layerY + 0.08, 0.05);
                    group.add(mPiece);
                    const mPiece2 = mPiece.clone();
                    mPiece2.position.set(0.05, layerY + 0.08, -0.08);
                    group.add(mPiece2);
                }
                finalHeight = layerY + 0.2;
            }
            // ==========================================
            // SALAD ASSEMBLY (progressive)
            // ==========================================
            else if (hasLettuce) {
                let layerY = 0.1;

                // Lettuce bed (bowl shape with leaves)
                const letColor = content.burnt ? 0x000000 : 0x27ae60;
                const letMat = new THREE.MeshStandardMaterial({ color: letColor, roughness: 0.9, side: THREE.DoubleSide });
                for (let lf = 0; lf < 5; lf++) {
                    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), letMat);
                    const angle = (lf / 5) * Math.PI * 2;
                    leaf.position.set(Math.cos(angle) * 0.15, layerY + 0.05, Math.sin(angle) * 0.15);
                    leaf.rotation.set(-Math.PI / 3, angle, 0);
                    group.add(leaf);
                }

                // Tomato wedges
                if (hasTomato) {
                    const tColor = content.burnt ? 0x000000 : 0xe74c3c;
                    for (let tw = 0; tw < 3; tw++) {
                        const wedge = new THREE.Mesh(
                            new THREE.BoxGeometry(0.08, 0.06, 0.06),
                            new THREE.MeshStandardMaterial({ color: tColor })
                        );
                        const a = (tw / 3) * Math.PI * 2 + 0.5;
                        wedge.position.set(Math.cos(a) * 0.2, layerY + 0.1, Math.sin(a) * 0.2);
                        group.add(wedge);
                    }
                }

                // Onion rings
                if (hasOnion) {
                    const oColor = content.burnt ? 0x000000 : 0xf5f5dc;
                    for (let or2 = 0; or2 < 2; or2++) {
                        const oRing = new THREE.Mesh(
                            new THREE.TorusGeometry(0.05, 0.012, 8, 16),
                            new THREE.MeshStandardMaterial({ color: oColor })
                        );
                        oRing.rotation.x = Math.PI / 2 + Math.random() * 0.5;
                        oRing.position.set((or2 - 0.5) * 0.2, layerY + 0.12, 0);
                        group.add(oRing);
                    }
                }
                finalHeight = layerY + 0.2;
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

                const targetAngle = (hasContents || playerNear) ? -Math.PI * 0.55 : 0;
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

                // Target angle: NEGATIVE X for flip-up lid (like trash)
                const targetDoorAngle = playerNear ? -Math.PI * 0.65 : 0;

                eff.doorAngle = eff.doorAngle !== undefined ? eff.doorAngle : 0;
                const speed = playerNear ? 6.0 : 2.5;
                eff.doorAngle += (targetDoorAngle - eff.doorAngle) * Math.min(1, delta * speed);
                eff.door.rotation.x = eff.doorAngle; // USE X FOR FLIP UP

                // Sync Internal Light with door angle
                if (eff.light) {
                    const openFactor = Math.abs(eff.doorAngle / (Math.PI * 0.65));
                    eff.light.intensity = openFactor * 2.5;
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
        });

        // Animate chopping knives
        Object.values(this.stationMeshes).forEach(sm => {
            const knife = sm.group.getObjectByName('knife');
            if (knife) {
                const now = Date.now();
                const isChopping = sm.lastChopUpdate && (now - sm.lastChopUpdate) < 300;
                if (isChopping) {
                    const angle = now * 0.035;
                    const height = Math.abs(Math.sin(angle)) * 0.35;
                    knife.rotation.x = Math.PI * 0.15 + Math.sin(angle) * 0.2;
                    knife.position.y = (sm.baseMesh.position.y * 2 + 0.2) + height;
                    knife.position.x = 0;
                    knife.rotation.z = 0;

                    if (!sm.chopParticles) {
                        sm.chopParticles = [];
                        sm.particleGroup = new THREE.Group();
                        sm.group.add(sm.particleGroup);
                    }
                    const content = sm.group.getObjectByName('contents');
                    if (content && Math.random() < 0.4) {
                        const ingMesh = content.children[0];
                        const color = (ingMesh && ingMesh.material) ? ingMesh.material.color : 0xffffff;
                        const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color, transparent: true }));
                        p.position.set(0, (sm.baseMesh.position.y * 2 + 0.3), 0);
                        p.userData = { vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 4, life: 0.6 };
                        sm.particleGroup.add(p);
                        sm.chopParticles.push(p);
                    }
                    if (content) {
                        content.scale.setScalar(1 + Math.sin(angle * 3) * 0.15);
                        content.position.x = Math.sin(angle * 10) * 0.03;
                    }
                } else {
                    knife.position.x += (0.3 - knife.position.x) * 0.1;
                    knife.position.y += (sm.baseMesh.position.y * 2 + 0.05 - knife.position.y) * 0.1;
                    knife.rotation.z += (Math.PI / 2 - knife.rotation.z) * 0.1;
                    knife.rotation.x *= 0.8;
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
                    p.position.x += p.userData.vx * delta;
                    p.position.y += p.userData.vy * delta;
                    p.position.z += p.userData.vz * delta;
                    p.userData.vy -= 15 * delta;
                    p.userData.life -= delta;
                    p.material.opacity = p.userData.life / 0.6;
                    if (p.userData.life <= 0 || p.position.y < 0) {
                        sm.particleGroup.remove(p);
                        sm.chopParticles.splice(i, 1);
                    }
                }
            }
        });
    }
}
