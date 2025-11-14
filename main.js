// Street Racer: Urban Chaos - Main Game Logic
// Core game engine and physics simulation

class StreetRacerGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;
        this.car = null;
        this.carBody = null;
        this.buildings = [];
        this.roads = [];
        this.obstacles = [];
        this.particles = [];
        
        this.gameState = {
            speed: 0,
            score: 0,
            combo: 1,
            health: 100,
            wantedLevel: 0,
            isPaused: false,
            isGameOver: false,
            selectedCar: 'sports',
            gameMode: 'free-roam'
        };
        
        this.input = {
            keys: {},
            mouse: { x: 0, y: 0, down: false },
            controller: { connected: false, axes: [], buttons: [] }
        };
        
        this.audio = {
            engine: null,
            collision: null,
            explosion: null,
            police: null
        };
        
        this.init();
    }
    
    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.initAudio();
        this.showLoadingScreen();
        
        // Initialize after a short delay to show loading screen
        setTimeout(() => {
            this.initializeGame();
        }, 1000);
    }
    
    loadSettings() {
        // Load saved game settings
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
        this.initParticles();
        this.startGameLoop();
        this.hideLoadingScreen();
    }
    
    initThreeJS() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000000, 10, 1000);
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        this.camera.position.set(0, 15, 25);
        
        // Renderer setup
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
        
        // Lighting setup
        this.setupLighting();
    }
    
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        // Main directional light (sun/moon)
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
        
        // City lights
        for (let i = 0; i < 20; i++) {
            const pointLight = new THREE.PointLight(0xff6b35, 0.5, 100);
            pointLight.position.set(
                (Math.random() - 0.5) * 400,
                Math.random() * 50 + 20,
                (Math.random() - 0.5) * 400
            );
            this.scene.add(pointLight);
        }
    }
    
    initPhysics() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 15;
        this.world.solver.tolerance = 0.1;
        
        // Create ground
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.add(groundBody);
    }
    
    createEnvironment() {
        this.createGround();
        this.createBuildings();
        this.createRoads();
        this.createStreetElements();
    }
    
    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x2a2a2a,
            roughness: 0.8
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }
    
    createBuildings() {
        const buildingColors = [0x444444, 0x555555, 0x666666, 0x777777];
        
        for (let i = 0; i < 60; i++) {
            const width = Math.random() * 25 + 15;
            const height = Math.random() * 80 + 30;
            const depth = Math.random() * 25 + 15;
            
            const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
            const buildingMaterial = new THREE.MeshLambertMaterial({
                color: buildingColors[Math.floor(Math.random() * buildingColors.length)]
            });
            
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            building.position.x = (Math.random() - 0.5) * 800;
            building.position.y = height / 2;
            building.position.z = (Math.random() - 0.5) * 800;
            building.castShadow = true;
            building.receiveShadow = true;
            
            this.scene.add(building);
            this.buildings.push(building);
            
            // Add building physics
            const buildingShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
            const buildingBody = new CANNON.Body({ mass: 0 });
            buildingBody.addShape(buildingShape);
            buildingBody.position.copy(building.position);
            this.world.add(buildingBody);
        }
    }
    
    createRoads() {
        const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        
        // Main roads
        for (let i = 0; i < 8; i++) {
            const roadGeometry = new THREE.PlaneGeometry(1000, 20);
            const road = new THREE.Mesh(roadGeometry, roadMaterial);
            road.rotation.x = -Math.PI / 2;
            road.position.z = (i - 4) * 100;
            road.receiveShadow = true;
            this.scene.add(road);
            this.roads.push(road);
        }
        
        // Cross roads
        for (let i = 0; i < 8; i++) {
            const roadGeometry = new THREE.PlaneGeometry(20, 1000);
            const road = new THREE.Mesh(roadGeometry, roadMaterial);
            road.rotation.x = -Math.PI / 2;
            road.position.x = (i - 4) * 100;
            road.receiveShadow = true;
            this.scene.add(road);
            this.roads.push(road);
        }
    }
    
    createStreetElements() {
        // Street lights
        for (let i = 0; i < 30; i++) {
            const poleGeometry = new THREE.CylinderGeometry(0.2, 0.2, 15);
            const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
            const pole = new THREE.Mesh(poleGeometry, poleMaterial);
            
            pole.position.x = (Math.random() - 0.5) * 600;
            pole.position.y = 7.5;
            pole.position.z = (Math.random() - 0.5) * 600;
            pole.castShadow = true;
            
            this.scene.add(pole);
            
            // Light
            const lightGeometry = new THREE.SphereGeometry(1);
            const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.copy(pole.position);
            light.position.y += 8;
            
            this.scene.add(light);
            
            // Point light
            const pointLight = new THREE.PointLight(0xffffaa, 0.3, 50);
            pointLight.position.copy(light.position);
            this.scene.add(pointLight);
        }
    }
    
    createCar() {
        const carData = this.getCarData(this.gameState.selectedCar);
        
        // Car body
        const bodyGeometry = new THREE.BoxGeometry(carData.width, carData.height, carData.length);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: carData.color });
        this.car = new THREE.Mesh(bodyGeometry, bodyMaterial);
        
        this.car.position.set(0, carData.height / 2 + 0.5, 0);
        this.car.castShadow = true;
        this.car.receiveShadow = true;
        
        this.scene.add(this.car);
        
        // Car physics
        const carShape = new CANNON.Box(new CANNON.Vec3(carData.width/2, carData.height/2, carData.length/2));
        this.carBody = new CANNON.Body({ mass: carData.mass });
        this.carBody.addShape(carShape);
        this.carBody.position.copy(this.car.position);
        this.carBody.material = new CANNON.Material({ friction: 0.4, restitution: 0.3 });
        
        this.world.add(this.carBody);
        
        // Add wheels
        this.createWheels();
        
        // Add car effects
        this.createCarEffects();
    }
    
    getCarData(carType) {
        const cars = {
            sports: {
                name: 'Nitro GT-R',
                width: 2.2,
                height: 1.2,
                length: 4.5,
                mass: 1200,
                color: 0xff6b35,
                maxSpeed: 300,
                acceleration: 800,
                handling: 0.9,
                durability: 0.4
            },
            muscle: {
                name: 'Street Demon',
                width: 2.4,
                height: 1.4,
                length: 5.2,
                mass: 1800,
                color: 0x8b0000,
                maxSpeed: 220,
                acceleration: 600,
                handling: 0.7,
                durability: 0.8
            },
            suv: {
                name: 'Urban Tank',
                width: 2.8,
                height: 1.8,
                length: 5.8,
                mass: 2500,
                color: 0x2f4f4f,
                maxSpeed: 180,
                acceleration: 400,
                handling: 0.5,
                durability: 0.95
            }
        };
        
        return cars[carType] || cars.sports;
    }
    
    createWheels() {
        const wheelGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.5, 16);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
        
        this.wheels = [];
        const wheelPositions = [
            { x: -1.2, y: -0.5, z: 1.5 },  // Front left
            { x: 1.2, y: -0.5, z: 1.5 },   // Front right
            { x: -1.2, y: -0.5, z: -1.5 }, // Rear left
            { x: 1.2, y: -0.5, z: -1.5 }   // Rear right
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, pos.y, pos.z);
            wheel.castShadow = true;
            
            this.car.add(wheel);
            this.wheels.push(wheel);
        });
    }
    
    createCarEffects() {
        // Exhaust particles
        this.exhaustParticles = [];
        
        // Engine sound simulation
        this.engineSound = {
            volume: 0,
            pitch: 0,
            update: (speed, rpm) => {
                this.engineSound.volume = Math.min(1, speed / 100);
                this.engineSound.pitch = 0.5 + (rpm / 8000) * 1.5;
            }
        };
    }
    
    createTraffic() {
        // Create AI traffic cars
        this.trafficCars = [];
        
        for (let i = 0; i < 20; i++) {
            const trafficCar = this.createTrafficCar();
            this.trafficCars.push(trafficCar);
        }
    }
    
    createTrafficCar() {
        const colors = [0x0066cc, 0xcc0000, 0x00cc00, 0xcccc00, 0xcc00cc];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        const geometry = new THREE.BoxGeometry(2, 1, 4);
        const material = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.position.set(
            (Math.random() - 0.5) * 400,
            1,
            (Math.random() - 0.5) * 400
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        this.scene.add(mesh);
        
        return {
            mesh,
            velocity: new THREE.Vector3(0, 0, Math.random() * 10 - 5),
            type: 'traffic'
        };
    }
    
    initParticles() {
        this.particleSystems = {
            exhaust: [],
            smoke: [],
            sparks: [],
            debris: []
        };
    }
    
    createParticle(type, position, velocity = null) {
        const particle = {
            position: position.clone(),
            velocity: velocity || new THREE.Vector3(
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
                
                // Update position
                particle.position.add(particle.velocity);
                
                // Update life
                particle.life -= particle.decay;
                
                // Apply gravity
                particle.velocity.y -= 0.1;
                
                // Remove dead particles
                if (particle.life <= 0) {
                    particles.splice(i, 1);
                }
            }
        });
    }
    
    setupEventListeners() {
        // Keyboard input
        document.addEventListener('keydown', (e) => {
            this.input.keys[e.code] = true;
            
            if (e.code === 'Escape') {
                this.togglePause();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.input.keys[e.code] = false;
        });
        
        // Mouse input
        document.addEventListener('mousemove', (e) => {
            this.input.mouse.x = e.clientX;
            this.input.mouse.y = e.clientY;
        });
        
        document.addEventListener('mousedown', (e) => {
            this.input.mouse.down = true;
        });
        
        document.addEventListener('mouseup', (e) => {
            this.input.mouse.down = false;
        });
        
        // Gamepad support
        window.addEventListener('gamepadconnected', (e) => {
            this.input.controller.connected = true;
            console.log('Gamepad connected:', e.gamepad.id);
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            this.input.controller.connected = false;
            console.log('Gamepad disconnected');
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
        
        // Prevent context menu
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    
    handleInput() {
        if (this.gameState.isPaused || this.gameState.isGameOver) return;
        
        const carData = this.getCarData(this.gameState.selectedCar);
        const force = carData.acceleration;
        const torque = carData.handling * 300;
        
        // Keyboard input
        if (this.input.keys['KeyW'] || this.input.keys['ArrowUp']) {
            this.carBody.applyForce(new CANNON.Vec3(0, 0, -force), this.carBody.position);
        }
        if (this.input.keys['KeyS'] || this.input.keys['ArrowDown']) {
            this.carBody.applyForce(new CANNON.Vec3(0, 0, force), this.carBody.position);
        }
        if (this.input.keys['KeyA'] || this.input.keys['ArrowLeft']) {
            this.carBody.applyTorque(new CANNON.Vec3(0, torque, 0));
        }
        if (this.input.keys['KeyD'] || this.input.keys['ArrowRight']) {
            this.carBody.applyTorque(new CANNON.Vec3(0, -torque, 0));
        }
        
        // Handbrake
        if (this.input.keys['Space']) {
            this.carBody.velocity.x *= 0.9;
            this.carBody.velocity.z *= 0.9;
            this.carBody.angularVelocity.y *= 0.5;
        }
        
        // Boost
        if (this.input.keys['ShiftLeft'] || this.input.keys['ShiftRight']) {
            const forward = new CANNON.Vec3(0, 0, -carData.acceleration * 2);
            this.carBody.applyForce(forward, this.carBody.position);
            this.createParticle('exhaust', this.car.position);
        }
        
        // Update speed
        const velocity = this.carBody.velocity;
        this.gameState.speed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2) * 3.6;
        
        // Update engine sound
        this.engineSound.update(this.gameState.speed, this.gameState.speed * 20);
    }
    
    updateCamera() {
        if (!this.car) return;
        
        const cameraDistance = 25;
        const cameraHeight = 12;
        const lookAhead = 15;
        
        // Calculate camera position behind car
        const carPosition = this.car.position;
        const carRotation = this.car.rotation.y;
        
        const cameraX = carPosition.x - Math.sin(carRotation) * cameraDistance;
        const cameraY = carPosition.y + cameraHeight;
        const cameraZ = carPosition.z - Math.cos(carRotation) * cameraDistance;
        
        // Smooth camera movement
        this.camera.position.lerp(
            new THREE.Vector3(cameraX, cameraY, cameraZ),
            0.1
        );
        
        // Look at point ahead of car
        const lookAtX = carPosition.x + Math.sin(carRotation) * lookAhead;
        const lookAtY = carPosition.y + 2;
        const lookAtZ = carPosition.z + Math.cos(carRotation) * lookAhead;
        
        this.camera.lookAt(lookAtX, lookAtY, lookAtZ);
    }
    
    updateTraffic() {
        this.trafficCars.forEach(trafficCar => {
            // Simple AI movement
            trafficCar.mesh.position.add(trafficCar.velocity);
            
            // Wrap around world
            if (Math.abs(trafficCar.mesh.position.x) > 500) {
                trafficCar.mesh.position.x = -Math.sign(trafficCar.mesh.position.x) * 500;
            }
            if (Math.abs(trafficCar.mesh.position.z) > 500) {
                trafficCar.mesh.position.z = -Math.sign(trafficCar.mesh.position.z) * 500;
            }
            
            // Collision detection with player
            const distance = trafficCar.mesh.position.distanceTo(this.car.position);
            if (distance < 5) {
                this.handleCollision(trafficCar);
            }
        });
    }
    
    handleCollision(object) {
        if (object.type === 'traffic') {
            // Calculate collision damage
            const damage = Math.min(20, this.gameState.speed / 10);
            this.takeDamage(damage);
            
            // Add score for destruction
            this.addScore(50, 'Traffic Hit');
            this.increaseCombo(0.2);
            
            // Create explosion effect
            this.createExplosion(object.mesh.position);
            
            // Remove traffic car
            this.scene.remove(object.mesh);
            const index = this.trafficCars.indexOf(object);
            if (index > -1) {
                this.trafficCars.splice(index, 1);
            }
            
            // Spawn new traffic car
            setTimeout(() => {
                const newCar = this.createTrafficCar();
                this.trafficCars.push(newCar);
            }, 3000);
        }
    }
    
    createExplosion(position) {
        // Create multiple particles for explosion effect
        for (let i = 0; i < 20; i++) {
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                Math.random() * 5,
                (Math.random() - 0.5) * 10
            );
            this.createParticle('debris', position, velocity);
        }
        
        // Screen shake effect
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
    
    updateScore() {
        // Base score from speed
        if (this.gameState.speed > 30) {
            this.gameState.score += this.gameState.speed * 0.05 * this.gameState.combo;
        }
        
        // Score from destruction
        // Score from stunts (drifting, jumping)
        if (Math.abs(this.carBody.angularVelocity.y) > 1) {
            this.addScore(10, 'Drifting');
            this.increaseCombo(0.05);
        }
        
        // Combo decay
        if (this.gameState.combo > 1) {
            this.gameState.combo = Math.max(1, this.gameState.combo - 0.002);
        }
    }
    
    addScore(points, reason = '') {
        this.gameState.score += points * this.gameState.combo;
        if (reason) {
            this.showNotification(`+${Math.round(points)} ${reason}`);
        }
    }
    
    increaseCombo(amount = 0.1) {
        this.gameState.combo = Math.min(this.gameState.combo + amount, 15);
        this.showNotification(`COMBO x${Math.round(this.gameState.combo * 10) / 10}!`);
    }
    
    takeDamage(amount) {
        this.gameState.health = Math.max(0, this.gameState.health - amount);
        
        if (this.gameState.health <= 0) {
            this.gameOver();
        }
    }
    
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
        
        // Save high score
        const highScore = localStorage.getItem('highScore') || 0;
        if (this.gameState.score > highScore) {
            localStorage.setItem('highScore', this.gameState.score);
        }
    }
    
    togglePause() {
        this.gameState.isPaused = !this.gameState.isPaused;
        const pauseMenu = document.getElementById('pauseMenu');
        
        if (pauseMenu) {
            if (this.gameState.isPaused) {
                pauseMenu.style.display = 'flex';
            } else {
                pauseMenu.style.display = 'none';
            }
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
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }
    
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
        // Update physics
        this.world.step(1/60);
        
        // Update car mesh position
        this.car.position.copy(this.carBody.position);
        this.car.quaternion.copy(this.carBody.quaternion);
        
        // Update wheels
        this.wheels.forEach(wheel => {
            wheel.rotation.x += this.gameState.speed * 0.01;
        });
        
        // Handle input
        this.handleInput();
        
        // Update camera
        this.updateCamera();
        
        // Update traffic
        this.updateTraffic();
        
        // Update particles
        this.updateParticles();
        
        // Update score
        this.updateScore();
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }
    
    initAudio() {
        // Initialize audio context and load sounds
        // This would typically load audio files and set up the audio system
        console.log('Audio system initialized');
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.streetRacerGame = new StreetRacerGame();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreetRacerGame;
}