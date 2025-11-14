// Street Racer: Urban Chaos - Main Game Logic (Realistic Handling Version)
// Driving tuned towards "sim-like" feel (option C)

class StreetRacerGame {
    constructor() {
        // Core 3D + physics
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;

        // Player car + physics
        this.car = null;
        this.carBody = null;
        this.wheels = [];
        this.exhaustParticles = [];

        // World objects
        this.buildings = [];
        this.roads = [];
        this.trafficCars = [];
        this.particleSystems = {
            exhaust: [],
            smoke: [],
            sparks: [],
            debris: []
        };

        // Game state
        this.gameState = {
            speed: 0,           // km/h
            score: 0,
            combo: 1,
            health: 100,
            wantedLevel: 0,
            isPaused: false,
            isGameOver: false,
            selectedCar: 'sports',   // 'sports' | 'muscle' | 'suv'
            gameMode: 'free-roam'
        };

        // Input
        this.input = {
            keys: {},
            mouse: { x: 0, y: 0, down: false },
            controller: { connected: false, axes: [], buttons: [] }
        };

        // Audio stub
        this.audio = {
            engine: null,
            collision: null,
            explosion: null,
            police: null
        };

        this.engineSound = {
            volume: 0,
            pitch: 0,
            update: (speed, rpm) => {
                this.engineSound.volume = Math.min(1, speed / 160);
                this.engineSound.pitch = 0.7 + (rpm / 8000) * 1.2;
            }
        };

        this.init();
    }

    // =========================
    // INIT & SETTINGS
    // =========================
    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.initAudio();
        this.showLoadingScreen();

        setTimeout(() => {
            this.initializeGame();
        }, 800);
    }

    loadSettings() {
        const savedCar = localStorage.getItem('selectedCar');
        const savedMode = localStorage.getItem('selectedGameMode');

        if (savedCar) this.gameState.selectedCar = savedCar;
        if (savedMode) this.gameState.gameMode = savedMode;
    }

    initializeGame() {
        this.initThreeJS();
        this.initPhysics();
        this.createEnvironment();
        this.createCar();
        this.createTraffic();
        this.startGameLoop();
        this.hideLoadingScreen();
    }

    // =========================
    // THREE.JS SETUP
    // =========================
    initThreeJS() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000000, 10, 1000);

        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 8, 15);

        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('gameCanvas'),
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.setupLighting();
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(100, 200, 100);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 1000;
        directionalLight.shadow.camera.left = -200;
        directionalLight.shadow.camera.right = 200;
        directionalLight.shadow.camera.top = 200;
        directionalLight.shadow.camera.bottom = -200;
        this.scene.add(directionalLight);

        // City point lights
        for (let i = 0; i < 20; i++) {
            const pointLight = new THREE.PointLight(0xff6b35, 0.6, 100);
            pointLight.position.set(
                (Math.random() - 0.5) * 400,
                Math.random() * 50 + 20,
                (Math.random() - 0.5) * 400
            );
            this.scene.add(pointLight);
        }
    }

    // =========================
    // PHYSICS
    // =========================
    initPhysics() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 20;
        this.world.solver.tolerance = 0.001;

        // Default material for better grip
        const groundMaterial = new CANNON.Material('groundMaterial');
        const carMaterial = new CANNON.Material('carMaterial');

        const contactMaterial = new CANNON.ContactMaterial(
            groundMaterial,
            carMaterial,
            {
                friction: 1.0,
                restitution: 0.1
            }
        );
        this.world.addContactMaterial(contactMaterial);

        // Ground body
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({
            mass: 0,
            material: groundMaterial
        });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(
            new CANNON.Vec3(1, 0, 0),
            -Math.PI / 2
        );
        this.world.add(groundBody);

        // Save for later
        this.physicsMaterials = { groundMaterial, carMaterial };
    }

    // =========================
    // WORLD / ENVIRONMENT
    // =========================
    createEnvironment() {
        this.createGround();
        this.createBuildings();
        this.createRoads();
        this.createStreetElements();
    }

    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
        const groundMaterial = new THREE.MeshLambertMaterial({
            color: 0x252525
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Road markings (simple cross grid)
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x555555 });
        for (let i = -400; i <= 400; i += 20) {
            const geoH = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-500, 0.01, i),
                new THREE.Vector3(500, 0.01, i)
            ]);
            const geoV = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(i, 0.01, -500),
                new THREE.Vector3(i, 0.01, 500)
            ]);
            const lineH = new THREE.Line(geoH, lineMaterial);
            const lineV = new THREE.Line(geoV, lineMaterial);
            this.scene.add(lineH);
            this.scene.add(lineV);
        }
    }

    createBuildings() {
        const buildingColors = [0x444444, 0x555555, 0x666666, 0x777777];

        for (let i = 0; i < 50; i++) {
            const width = Math.random() * 25 + 15;
            const height = Math.random() * 80 + 30;
            const depth = Math.random() * 25 + 15;

            const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
            const buildingMaterial = new THREE.MeshLambertMaterial({
                color: buildingColors[Math.floor(Math.random() * buildingColors.length)]
            });

            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);

            // Keep buildings off main central area so roads feel clearer
            const radius = 200 + Math.random() * 300;
            const angle = Math.random() * Math.PI * 2;
            building.position.x = Math.cos(angle) * radius;
            building.position.z = Math.sin(angle) * radius;
            building.position.y = height / 2;
            building.castShadow = true;
            building.receiveShadow = true;

            this.scene.add(building);
            this.buildings.push(building);

            const buildingShape = new CANNON.Box(
                new CANNON.Vec3(width / 2, height / 2, depth / 2)
            );
            const buildingBody = new CANNON.Body({ mass: 0 });
            buildingBody.addShape(buildingShape);
            buildingBody.position.copy(building.position);
            this.world.add(buildingBody);
        }
    }

    createRoads() {
        const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

        // Main long avenue
        const mainRoad = new THREE.Mesh(
            new THREE.PlaneGeometry(1000, 30),
            roadMaterial
        );
        mainRoad.rotation.x = -Math.PI / 2;
        mainRoad.position.z = 0;
        mainRoad.receiveShadow = true;
        this.scene.add(mainRoad);
        this.roads.push(mainRoad);

        // Cross avenue
        const crossRoad = new THREE.Mesh(
            new THREE.PlaneGeometry(30, 1000),
            roadMaterial
        );
        crossRoad.rotation.x = -Math.PI / 2;
        crossRoad.position.x = 0;
        crossRoad.receiveShadow = true;
        this.scene.add(crossRoad);
        this.roads.push(crossRoad);
    }

    createStreetElements() {
        for (let i = 0; i < 30; i++) {
            const poleGeometry = new THREE.CylinderGeometry(0.2, 0.2, 15);
            const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
            const pole = new THREE.Mesh(poleGeometry, poleMaterial);

            pole.position.x = (Math.random() - 0.5) * 600;
            pole.position.y = 7.5;
            pole.position.z = (Math.random() - 0.5) * 600;
            pole.castShadow = true;

            this.scene.add(pole);

            const lightGeometry = new THREE.SphereGeometry(0.8);
            const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.copy(pole.position);
            light.position.y += 8;
            this.scene.add(light);

            const pointLight = new THREE.PointLight(0xffffaa, 0.35, 40);
            pointLight.position.copy(light.position);
            this.scene.add(pointLight);
        }
    }

    // =========================
    // CAR CREATION
    // =========================
    getCarData(carType) {
        const cars = {
            sports: {
                name: 'Nitro GT-R',
                width: 2.0,
                height: 1.2,
                length: 4.4,
                mass: 1350,
                color: 0xff6b35,
                maxSpeed: 260,       // km/h
                accel: 0.18,         // m/s per frame
                handling: 1.0,
                durability: 0.4
            },
            muscle: {
                name: 'Street Demon',
                width: 2.2,
                height: 1.4,
                length: 5.0,
                mass: 1700,
                color: 0x8b0000,
                maxSpeed: 230,
                accel: 0.15,
                handling: 0.75,
                durability: 0.7
            },
            suv: {
                name: 'Urban Tank',
                width: 2.4,
                height: 1.8,
                length: 5.5,
                mass: 2200,
                color: 0x2f4f4f,
                maxSpeed: 190,
                accel: 0.13,
                handling: 0.55,
                durability: 0.9
            }
        };

        return cars[carType] || cars.sports;
    }

    createCar() {
        const carData = this.getCarData(this.gameState.selectedCar);

        // Visual mesh
        const bodyGeometry = new THREE.BoxGeometry(
            carData.width,
            carData.height,
            carData.length
        );
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: carData.color });
        this.car = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.car.position.set(0, carData.height / 2 + 0.5, 0);
        this.car.castShadow = true;
        this.car.receiveShadow = true;
        this.scene.add(this.car);

        // Physics body
        const carShape = new CANNON.Box(
            new CANNON.Vec3(carData.width / 2, carData.height / 2, carData.length / 2)
        );
        this.carBody = new CANNON.Body({
            mass: carData.mass,
            material: this.physicsMaterials.carMaterial
        });
        this.carBody.addShape(carShape);
        this.carBody.position.set(0, carData.height / 2 + 0.5, 0);
        this.carBody.linearDamping = 0.2;   // road friction feel
        this.carBody.angularDamping = 0.4;  // less spinning
        this.world.add(this.carBody);

        this.createWheels();
        this.createCarEffects();
    }

    createWheels() {
        const wheelGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.4, 18);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });

        this.wheels = [];
        const wheelPositions = [
            { x: -1.0, y: -0.6, z: 1.5 },  // FL
            { x: 1.0, y: -0.6, z: 1.5 },   // FR
            { x: -1.0, y: -0.6, z: -1.5 }, // RL
            { x: 1.0, y: -0.6, z: -1.5 }   // RR
        ];

        wheelPositions.forEach((pos, index) => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, pos.y, pos.z);
            wheel.castShadow = true;
            this.car.add(wheel);
            this.wheels.push(wheel);

            // Optional: front wheel yaw visual
            if (index < 2) {
                wheel.userData.isFront = true;
            }
        });
    }

    createCarEffects() {
        this.exhaustParticles = [];
    }

    // =========================
    // TRAFFIC
    // =========================
    createTraffic() {
        this.trafficCars = [];
        for (let i = 0; i < 15; i++) {
            const trafficCar = this.createTrafficCar();
            this.trafficCars.push(trafficCar);
        }
    }

    createTrafficCar() {
        const colors = [0x0066cc, 0xcc0000, 0x00cc00, 0xcccc00, 0xcc00cc];
        const color = colors[Math.floor(Math.random() * colors.length)];

        const geometry = new THREE.BoxGeometry(2, 1.1, 4);
        const material = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);

        const spawnRadius = 120 + Math.random() * 200;
        const angle = Math.random() * Math.PI * 2;

        mesh.position.set(
            Math.cos(angle) * spawnRadius,
            1,
            Math.sin(angle) * spawnRadius
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // Simple straight movement along z or x
        const dir = Math.random() < 0.5 ? 1 : -1;
        const axis = Math.random() < 0.5 ? 'x' : 'z';
        const velocity = new THREE.Vector3(
            axis === 'x' ? 6 * dir : 0,
            0,
            axis === 'z' ? 6 * dir : 0
        );

        return {
            mesh,
            velocity,
            type: 'traffic'
        };
    }

    updateTraffic() {
        this.trafficCars.forEach(trafficCar => {
            trafficCar.mesh.position.add(trafficCar.velocity);

            if (Math.abs(trafficCar.mesh.position.x) > 500) {
                trafficCar.mesh.position.x =
                    -Math.sign(trafficCar.mesh.position.x) * 500;
            }
            if (Math.abs(trafficCar.mesh.position.z) > 500) {
                trafficCar.mesh.position.z =
                    -Math.sign(trafficCar.mesh.position.z) * 500;
            }

            const distance = trafficCar.mesh.position.distanceTo(this.car.position);
            if (distance < 4) {
                this.handleCollision(trafficCar);
            }
        });
    }

    handleCollision(object) {
        if (object.type === 'traffic') {
            const damage = Math.min(30, this.gameState.speed / 8);
            this.takeDamage(damage);

            this.addScore(40, 'Traffic Hit');
            this.increaseCombo(0.15);

            this.createExplosion(object.mesh.position);

            this.scene.remove(object.mesh);
            const index = this.trafficCars.indexOf(object);
            if (index > -1) this.trafficCars.splice(index, 1);

            setTimeout(() => {
                const newCar = this.createTrafficCar();
                this.trafficCars.push(newCar);
            }, 3000);
        }
    }

    createExplosion(position) {
        for (let i = 0; i < 20; i++) {
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                Math.random() * 5,
                (Math.random() - 0.5) * 10
            );
            this.createParticle('debris', position, velocity);
        }
        this.shakeCamera(0.5, 300);
    }

    shakeCamera(intensity, duration) {
        const originalPosition = this.camera.position.clone();
        const startTime = Date.now();

        const shake = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed < duration) {
                const shakeX = (Math.random() - 0.5) * intensity;
                const shakeY = (Math.random() - 0.5) * intensity;
                const shakeZ = (Math.random() - 0.5) * intensity;

                this.camera.position.set(
                    originalPosition.x + shakeX,
                    originalPosition.y + shakeY,
                    originalPosition.z + shakeZ
                );

                requestAnimationFrame(shake);
            } else {
                this.camera.position.copy(originalPosition);
            }
        };

        shake();
    }

    // =========================
    // PARTICLES
    // =========================
    createParticle(type, position, velocity = null) {
        const particle = {
            position: position.clone(),
            velocity:
                velocity ||
                new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    Math.random() * 2,
                    (Math.random() - 0.5) * 2
                ),
            life: 1.0,
            decay: 0.02,
            type
        };

        this.particleSystems[type].push(particle);
        return particle;
    }

    updateParticles() {
        Object.keys(this.particleSystems).forEach(type => {
            const particles = this.particleSystems[type];

            for (let i = particles.length - 1; i >= 0; i--) {
                const particle = particles[i];
                particle.position.add(particle.velocity);
                particle.life -= particle.decay;
                particle.velocity.y -= 0.1;

                if (particle.life <= 0) {
                    particles.splice(i, 1);
                }
            }
        });
    }

    // =========================
    // INPUT & CONTROL (REALISTIC TUNING)
    // =========================
    setupEventListeners() {
        document.addEventListener('keydown', e => {
            this.input.keys[e.code] = true;
            if (e.code === 'Escape') {
                this.togglePause();
            }
        });

        document.addEventListener('keyup', e => {
            this.input.keys[e.code] = false;
        });

        document.addEventListener('mousemove', e => {
            this.input.mouse.x = e.clientX;
            this.input.mouse.y = e.clientY;
        });

        document.addEventListener('mousedown', () => {
            this.input.mouse.down = true;
        });

        document.addEventListener('mouseup', () => {
            this.input.mouse.down = false;
        });

        window.addEventListener('gamepadconnected', e => {
            this.input.controller.connected = true;
            console.log('Gamepad connected:', e.gamepad.id);
        });

        window.addEventListener('gamepaddisconnected', () => {
            this.input.controller.connected = false;
            console.log('Gamepad disconnected');
        });

        window.addEventListener('resize', () => {
            this.onWindowResize();
        });

        document.addEventListener('contextmenu', e => {
            e.preventDefault();
        });
    }

    handleInput() {
        if (this.gameState.isPaused || this.gameState.isGameOver) return;
        if (!this.car || !this.carBody) return;

        const carData = this.getCarData(this.gameState.selectedCar);

        // --- Compute forward/right vectors in world space (from visual car) ---
        const carQuat = this.car.quaternion;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(carQuat);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(carQuat);
        forward.y = 0;
        right.y = 0;
        forward.normalize();
        right.normalize();

        // --- Current velocity in horizontal plane ---
        const v = this.carBody.velocity;
        const v3 = new THREE.Vector3(v.x, 0, v.z);

        const forwardSpeed = v3.dot(forward); // m/s
        let sideSpeed = v3.dot(right);        // m/s

        // --- Grip / traction: reduce sideways slipping (more realistic) ---
        const gripFactor = 0.8;  // closer to 1 = more grip, <1 = more drift
        sideSpeed *= (1 - gripFactor);

        // --- Throttle / brake input ---
        let throttle = 0;
        if (this.input.keys['KeyW'] || this.input.keys['ArrowUp']) throttle += 1;
        if (this.input.keys['KeyS'] || this.input.keys['ArrowDown']) throttle -= 0.7;

        // --- Handbrake ---
        const handbraking = !!this.input.keys['Space'];
        if (handbraking) {
            sideSpeed *= 0.4;          // more sliding when handbrake
        }

        // --- Acceleration (sim-like, not arcade) ---
        let newForwardSpeed = forwardSpeed;
        const accel = carData.accel;   // tuned per car
        newForwardSpeed += throttle * accel;

        // Natural drag / rolling resistance
        newForwardSpeed *= 0.995;
        sideSpeed *= 0.97;

        // --- Speed limit (based on carData.maxSpeed in km/h) ---
        const maxSpeedMS = carData.maxSpeed / 3.6; // m/s
        const absSpeed = Math.abs(newForwardSpeed);
        if (absSpeed > maxSpeedMS) {
            newForwardSpeed = (newForwardSpeed / absSpeed) * maxSpeedMS;
        }

        // --- Rebuild velocity vector from forward/side components ---
        const newVel = new THREE.Vector3();
        newVel.addScaledVector(forward, newForwardSpeed);
        newVel.addScaledVector(right, sideSpeed);

        this.carBody.velocity.x = newVel.x;
        this.carBody.velocity.z = newVel.z;
        // Keep Y velocity from physics (jumps/interactions)
        // this.carBody.velocity.y stays as is

        // --- Steering (more turn at low-medium speeds, less at high speed) ---
        let steerInput = 0;
        if (this.input.keys['KeyA'] || this.input.keys['ArrowLeft']) steerInput += 1;
        if (this.input.keys['KeyD'] || this.input.keys['ArrowRight']) steerInput -= 1;

        const speedFactor = THREE.MathUtils.clamp(
            Math.abs(newForwardSpeed) / (maxSpeedMS || 1),
            0,
            1
        );
        const baseSteer = carData.handling * 0.9;
        const steerAmount = steerInput * baseSteer * (0.4 + 0.6 * (1 - speedFactor));

        // Set angular velocity for yaw (Y axis)
        const desiredYawRate = steerAmount; // rad/s approx
        this.carBody.angularVelocity.y = desiredYawRate;

        // --- Front wheel visual steering ---
        this.wheels.forEach(w => {
            if (w.userData.isFront) {
                w.rotation.y = steerInput * 0.4;
            }
        });

        // --- Boost (Shift) small extra accel ---
        if (this.input.keys['ShiftLeft'] || this.input.keys['ShiftRight']) {
            const boost = carData.accel * 0.6;
            const boostedSpeed = newForwardSpeed + boost;
            if (Math.abs(boostedSpeed) < maxSpeedMS * 1.05) {
                const boostVel = new THREE.Vector3().addScaledVector(forward, boost);
                this.carBody.velocity.x += boostVel.x;
                this.carBody.velocity.z += boostVel.z;
                this.createParticle('exhaust', this.car.position);
            }
        }

        // --- Update HUD speed (km/h) ---
        const horizSpeed = Math.sqrt(
            this.carBody.velocity.x ** 2 + this.carBody.velocity.z ** 2
        );
        this.gameState.speed = horizSpeed * 3.6;

        // Engine sound
        this.engineSound.update(this.gameState.speed, this.gameState.speed * 20);
    }

    // =========================
    // CAMERA (FOLLOW CAR REALISTICALLY)
    // =========================
    updateCamera() {
        if (!this.car) return;

        // Car forward in world
        const forward = this.car.getWorldDirection(new THREE.Vector3());
        forward.y = 0;
        forward.normalize();

        const distance = 10;  // behind car
        const height = 4.5;   // above ground

        const targetPos = new THREE.Vector3()
            .copy(this.car.position)
            .addScaledVector(forward, -distance);
        targetPos.y += height;

        // Smooth follow
        this.camera.position.lerp(targetPos, 0.1);

        // Look slightly ahead of car
        const lookAtPos = new THREE.Vector3()
            .copy(this.car.position)
            .add(new THREE.Vector3(0, 2, 0));
        this.camera.lookAt(lookAtPos);
    }

    // =========================
    // SCORE / HEALTH
    // =========================
    updateScore() {
        if (this.gameState.speed > 30) {
            this.gameState.score +=
                this.gameState.speed * 0.03 * this.gameState.combo;
        }

        if (Math.abs(this.carBody.angularVelocity.y) > 0.7 &&
            this.gameState.speed > 30
        ) {
            this.addScore(8, 'Controlled Drift');
            this.increaseCombo(0.05);
        }

        if (this.gameState.combo > 1) {
            this.gameState.combo = Math.max(
                1,
                this.gameState.combo - 0.0015
            );
        }
    }

    addScore(points, reason = '') {
        this.gameState.score += points * this.gameState.combo;
        if (reason) {
            this.showNotification(`+${Math.round(points)} ${reason}`);
        }
    }

    increaseCombo(amount = 0.1) {
        this.gameState.combo = Math.min(this.gameState.combo + amount, 12);
        this.showNotification(
            `COMBO x${Math.round(this.gameState.combo * 10) / 10}!`
        );
    }

    takeDamage(amount) {
        this.gameState.health = Math.max(0, this.gameState.health - amount);
        if (this.gameState.health <= 0) {
            this.gameOver();
        }
    }

    // =========================
    // UI / GAME STATE
    // =========================
    showNotification(message, duration = 3000) {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.style.opacity = '1';

            setTimeout(() => {
                notification.style.opacity = '0';
            }, duration);
        }
    }

    gameOver() {
        this.gameState.isGameOver = true;
        const gameOverScreen = document.getElementById('gameOverScreen');
        const finalScore = document.getElementById('finalScore');

        if (gameOverScreen && finalScore) {
            finalScore.textContent = Math.round(this.gameState.score);
            gameOverScreen.style.display = 'flex';
        }

        const highScore = localStorage.getItem('highScore') || 0;
        if (this.gameState.score > highScore) {
            localStorage.setItem('highScore', this.gameState.score);
        }
    }

    togglePause() {
        this.gameState.isPaused = !this.gameState.isPaused;
        const pauseMenu = document.getElementById('pauseMenu');
        if (pauseMenu) {
            pauseMenu.style.display = this.gameState.isPaused ? 'flex' : 'none';
        }
    }

    restartGame() {
        location.reload();
    }

    exitToMenu() {
        window.location.href = 'menu.html';
    }

    onWindowResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) loadingScreen.style.display = 'flex';
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) loadingScreen.style.display = 'none';
    }

    // =========================
    // GAME LOOP
    // =========================
    startGameLoop() {
        const loop = () => {
            if (!this.gameState.isPaused && !this.gameState.isGameOver) {
                this.update();
            }
            requestAnimationFrame(loop);
        };
        loop();
    }

    update() {
        this.world.step(1 / 60);

        if (this.car && this.carBody) {
            this.car.position.copy(this.carBody.position);
            this.car.quaternion.copy(this.carBody.quaternion);
        }

        this.wheels.forEach(wheel => {
            wheel.rotation.x += this.gameState.speed * 0.008;
        });

        this.handleInput();
        this.updateCamera();
        this.updateTraffic();
        this.updateParticles();
        this.updateScore();

        this.renderer.render(this.scene, this.camera);
    }

    // =========================
    // AUDIO STUB
    // =========================
    initAudio() {
        console.log('Audio system initialized (stub)');
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.streetRacerGame = new StreetRacerGame();
});

// Export for Node / bundlers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreetRacerGame;
}
