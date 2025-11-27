import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// หมายเหตุ: ตรวจสอบ path ของ api ให้ถูกต้อง หรือสร้างไฟล์ mock type ไว้ถ้ายังไม่ได้แปลงไฟล์ api เป็น ts
import { fetchWeather } from './api/weather';
import { fetchGistdaData } from './api/gistda';
import { fetchRiverData } from './api/flood';
import { fetchBuildings } from './api/buildings';
import './styles.css';

// --- Interfaces Definitions ---
interface WeatherData {
    current: {
        rain: number;
        showers: number;
    };
    daily: {
        precipitation_sum: number[];
    };
}

interface FloodData {
    discharge: number;
}

interface GistdaData {
    features: any[]; // ระบุ type ที่ชัดเจนกว่านี้ได้ถ้าทราบโครงสร้างข้อมูล
}

interface GistdaResponse {
    success: boolean;
    data: GistdaData;
}

// Type สำหรับฟังก์ชัน Project ที่จะส่งให้ส่วนอื่นใช้
export type ProjectFunction = (lat: number, lon: number) => { x: number; z: number };

// --- Constants ---
const CENTER_LAT = 7.0075;
const CENTER_LON = 100.4705;
const METERS_PER_DEG_LAT = 111320;
const METERS_PER_DEG_LON = 111320 * Math.cos(CENTER_LAT * Math.PI / 180);

const App: React.FC = () => {
    // State Typing
    const [floodLevel, setFloodLevel] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [loadingStep, setLoadingStep] = useState<number>(0);

    // Data State Typing
    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [floodData, setFloodData] = useState<FloodData | null>(null);
    const [gistdaData, setGistdaData] = useState<GistdaData | null>(null);
    const [gistdaError, setGistdaError] = useState<boolean>(false);

    // Ref Typing (สำคัญมากสำหรับ Three.js)
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const waterMeshRef = useRef<THREE.Mesh | null>(null);
    const rainSystemRef = useRef<THREE.Points | null>(null);
    // เพิ่ม renderer ref เพื่อช่วยในการ clean up
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const requestRef = useRef<number | null>(null);

    // Helper Function: Projection
    const project: ProjectFunction = (lat: number, lon: number) => {
        const x = (lon - CENTER_LON) * METERS_PER_DEG_LON;
        const z = (CENTER_LAT - lat) * METERS_PER_DEG_LAT;
        return { x, z };
    };

    // Helper Function: Create Label
    const createLabel = (text: string, x: number, y: number, z: number): THREE.Sprite => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.Sprite(); // Handle null context

        canvas.width = 512;
        canvas.height = 128;
        ctx.font = "bold 40px Sarabun, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.lineWidth = 8;
        ctx.strokeText(text, 256, 64);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(40, 10, 1);
        sprite.position.set(x, y + 15, z);
        sprite.renderOrder = 999;
        return sprite;
    };

    useEffect(() => {
        if (!containerRef.current || sceneRef.current) return;

        // 1. Setup Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111827);
        scene.fog = new THREE.FogExp2(0x111827, 0.002);

        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 5000);
        camera.position.set(0, 400, 500);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer; // เก็บไว้ล้างค่าทีหลัง

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.maxPolarAngle = Math.PI / 2 - 0.05;

        // 2. Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(200, 400, 100);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -500;
        dirLight.shadow.camera.right = 500;
        dirLight.shadow.camera.top = 500;
        dirLight.shadow.camera.bottom = -500;
        scene.add(dirLight);

        // 3. Ground (OpenStreetMap)
        const zoom = 16;
        const n = Math.pow(2, zoom);
        const tileX = Math.floor((CENTER_LON + 180) / 360 * n);
        const tileY = Math.floor((1 - Math.log(Math.tan(CENTER_LAT * Math.PI / 180) + 1 / Math.cos(CENTER_LAT * Math.PI / 180)) / Math.PI) / 2 * n);
        const loader = new THREE.TextureLoader();
        const mapUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;

        const groundGeo = new THREE.PlaneGeometry(2000, 2000);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.9 });

        loader.load(mapUrl, (tex) => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(4, 4);
            groundMat.map = tex;
            groundMat.needsUpdate = true;
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        scene.add(ground);

        // 4. Water
        const waterGeo = new THREE.PlaneGeometry(2000, 2000);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x3b82f6,
            transparent: true,
            opacity: 0.7,
            roughness: 0.0,
            metalness: 0.8
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.rotation.x = -Math.PI / 2;
        scene.add(water);
        waterMeshRef.current = water;

        sceneRef.current = scene;

        // 5. Rain System
        const createRain = (): THREE.Points => {
            const rainCount = 15000;
            const rainGeo = new THREE.BufferGeometry();
            const rainPos: number[] = [];
            for (let i = 0; i < rainCount; i++) {
                rainPos.push((Math.random() - 0.5) * 1000, Math.random() * 600, (Math.random() - 0.5) * 1000);
            }
            rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainPos, 3));
            const rainMat = new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.5, transparent: true, opacity: 0.6 });
            const rain = new THREE.Points(rainGeo, rainMat);
            scene.add(rain);
            return rain;
        };

        // 6. Data Initialization
        const initData = async () => {
            setLoadingStep(1);
            // Typescript จะเตือนถ้า fetchWeather ไม่ return ตาม Interface WeatherData
            const weatherRes = await fetchWeather() as WeatherData;
            setWeatherData(weatherRes);

            setLoadingStep(2);
            const gistdaRes = await fetchGistdaData() as GistdaResponse;
            if (gistdaRes.success) {
                setGistdaData(gistdaRes.data);
            } else {
                setGistdaError(true);
            }

            const floodRes = await fetchRiverData() as FloodData;
            setFloodData(floodRes);

            setLoadingStep(3);
            // ส่ง project function เข้าไปตามที่คุยกันไว้
            // @ts-ignore (ถ้าไฟล์ api ยังเป็น JS อยู่ ให้ใส่ ignore ไว้ก่อน หรือไปแก้ไฟล์ api ให้รับ parameter นี้)
            await fetchBuildings(scene, project);

            if (weatherRes && weatherRes.current && (weatherRes.current.rain > 0 || weatherRes.current.showers > 0)) {
                rainSystemRef.current = createRain();
            }

            setLoadingStep(4);
            setTimeout(() => setIsLoading(false), 500);
        };
        initData();

        // 7. Animation Loop
        const animate = () => {
            requestRef.current = requestAnimationFrame(animate);
            controls.update();

            if (rainSystemRef.current) {
                const positions = rainSystemRef.current.geometry.attributes.position.array as Float32Array;
                for (let i = 1; i < positions.length; i += 3) {
                    positions[i] -= 2;
                    if (positions[i] < 0) positions[i] = 600;
                }
                rainSystemRef.current.geometry.attributes.position.needsUpdate = true;
            }
            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        // Cleanup Function (ป้องกัน Memory Leak)
        return () => {
            window.removeEventListener('resize', handleResize);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);

            if (sceneRef.current) {
                sceneRef.current.traverse((object) => {
                    if (object instanceof THREE.Mesh) {
                        if (object.geometry) object.geometry.dispose();
                        if (object.material) {
                            if (Array.isArray(object.material)) {
                                object.material.forEach((mat: THREE.Material) => mat.dispose());
                            } else {
                                object.material.dispose();
                            }
                        }
                    }
                });
            }

            if (rendererRef.current) {
                rendererRef.current.dispose();
            }

            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }

            // Reset Refs
            sceneRef.current = null;
            rendererRef.current = null;
        };
    }, []);

    // Effect for Flood Level Update
    useEffect(() => {
        if (waterMeshRef.current) {
            waterMeshRef.current.position.y = floodLevel;
        }
    }, [floodLevel]);

    return (
        <div className="relative w-full h-screen font-sans text-white">
            <div ref={containerRef} id="canvas-container"></div>

            {isLoading && (
                <div className="loading-overlay">
                    {/* ... Loading UI Code ... */}
                    <div className="spinner"></div>
                    <h2 className="text-2xl font-bold">กำลังเชื่อมต่อข้อมูล GISTDA...</h2>
                    {/* ผมย่อส่วน UI loading เพื่อความกระชับ แต่ Logic ยังเหมือนเดิม */}
                </div>
            )}

            {!isLoading && (
                <div className="absolute top-4 left-4 z-50 w-80 bg-gray-900/90 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-gray-700 transition-all duration-500 max-h-[90vh] overflow-y-auto">
                    {/* ... Main UI Code ... */}
                    <div className="flex items-center gap-3 mb-6 border-b border-gray-700 pb-4">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <i className="fa-solid fa-water text-white"></i>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold">Hat Yai Flood Sim</h1>
                            <div className="text-xs text-gray-400 flex items-center gap-1">
                                <div className="pulse-dot"></div> Live Data Connected
                            </div>
                        </div>
                    </div>

                    {/* GISTDA Data Widget */}
                    <div className="mb-4 bg-indigo-900/30 p-3 rounded-lg border border-indigo-800/50">
                        {/* ... GISTDA UI ... */}
                        {gistdaData ? (
                            <div className="text-sm">
                                <div className="flex justify-between mb-1">
                                    <span className="text-gray-400">Features Found:</span>
                                    <span className="text-white font-mono">
                                        {gistdaData.features ? gistdaData.features.length : 0}
                                    </span>
                                </div>
                            </div>
                        ) : gistdaError ? (
                            <div className="text-xs text-yellow-500">Connection Restricted</div>
                        ) : (
                            <div className="text-xs text-gray-500">Checking data...</div>
                        )}
                    </div>

                    {/* Flood Controls */}
                    <div className="space-y-6 pt-4 border-t border-gray-700">
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-semibold text-gray-300">จำลองระดับน้ำ</label>
                                <span className="text-sm font-bold text-blue-400">{floodLevel} m.</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="30"
                                step="0.5"
                                value={floodLevel}
                                onChange={(e) => setFloodLevel(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;