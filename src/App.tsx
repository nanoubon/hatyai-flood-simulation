import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// APIs
import { fetchWeather } from './api/weather';
import { fetchGistdaData } from './api/gistda';
import { fetchRiverData } from './api/flood';
import { fetchBuildings } from './api/buildings';

// Types & Utils
import { WeatherData, FloodData, GistdaData, GistdaResponse, ImpactSummary } from './types';
import { project, drawGistdaPolygons, CENTER_LAT, CENTER_LON } from './utils/threeHelpers';

// Components
import { LoadingOverlay } from './components/LoadingOverlay';
import { Dashboard } from './components/Dashboard';
import './styles.css';

const App: React.FC = () => {
    // --- State Management ---
    const [floodLevel, setFloodLevel] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [loadingStep, setLoadingStep] = useState<number>(0);

    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [floodData, setFloodData] = useState<FloodData | null>(null);
    const [gistdaData, setGistdaData] = useState<GistdaData | null>(null);
    const [gistdaError, setGistdaError] = useState<boolean>(false);
    const [impactSummaries, setImpactSummaries] = useState<ImpactSummary[]>([]);

    // --- Refs ---
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const waterMeshRef = useRef<THREE.Mesh | null>(null);
    const rainSystemRef = useRef<THREE.Points | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const requestRef = useRef<number | null>(null);

    // --- Logic: Summarize Impact ---
    const summarizeImpact = (data: GistdaData) => {
        const summaryMap: { [key: string]: number } = {};

        data.features.forEach(feature => {
            const tambon = feature.properties?.tb_tn;
            const amphoe = feature.properties?.ap_tn;

            let areaName = "พื้นที่ไม่ระบุชื่อ";
            if (tambon && amphoe) {
                areaName = `ต.${tambon} อ.${amphoe}`;
            } else if (amphoe) {
                areaName = `อ.${amphoe}`;
            } else if (tambon) {
                areaName = `ต.${tambon}`;
            } else if (feature.properties?.id) {
                areaName = `Area ID: ${feature.properties.id}`;
            }

            if (!summaryMap[areaName]) summaryMap[areaName] = 0;
            summaryMap[areaName]++;
        });

        const summaries: ImpactSummary[] = Object.keys(summaryMap).map(key => ({
            areaName: key,
            count: summaryMap[key]
        })).sort((a, b) => b.count - a.count);

        setImpactSummaries(summaries);
    };

    // --- Main 3D Effect ---
    useEffect(() => {
        if (!containerRef.current || sceneRef.current) return;

        // 1. Setup Scene
        const scene = new THREE.Scene();
        // ปรับเป็นสีท้องฟ้ากลางวัน (Sky Blue) เพื่อแก้ปัญหาหน้าจอมืด
        const skyColor = 0x87CEEB;
        scene.background = new THREE.Color(skyColor);
        // ปรับหมอกให้เข้ากับสีท้องฟ้า ลดความหนาลงเล็กน้อยเพื่อให้เห็นไกลขึ้น
        scene.fog = new THREE.FogExp2(skyColor, 0.0015);

        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 5000);
        camera.position.set(0, 400, 500);
        camera.lookAt(0, 0, 0);

        // เพิ่ม logarithmicDepthBuffer: true เพื่อแก้ปัญหาสีแดงกระพริบ (Z-fighting)
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            logarithmicDepthBuffer: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.maxPolarAngle = Math.PI / 2 - 0.05;

        // 2. Lights
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemiLight.position.set(0, 200, 0);
        scene.add(hemiLight);

        // DirectionalLight: แสงอาทิตย์หลัก
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0); // เพิ่มความเข้มแสง
        dirLight.position.set(100, 500, 100); // ยกสูงขึ้นเหมือนดวงอาทิตย์เที่ยงวัน
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -500;
        dirLight.shadow.camera.right = 500;
        dirLight.shadow.camera.top = 500;
        dirLight.shadow.camera.bottom = -500;
        scene.add(dirLight);

        // AmbientLight: แสงนวลๆ เสริม
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        scene.add(ambientLight);

        // 3. Ground (OpenStreetMap)
        const zoom = 16;
        const n = Math.pow(2, zoom);
        const tileX = Math.floor((CENTER_LON + 180) / 360 * n);
        const tileY = Math.floor((1 - Math.log(Math.tan(CENTER_LAT * Math.PI / 180) + 1 / Math.cos(CENTER_LAT * Math.PI / 180)) / Math.PI) / 2 * n);
        const loader = new THREE.TextureLoader();
        const mapUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;

        const groundGeo = new THREE.PlaneGeometry(2000, 2000);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.9
        });

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

        // 4. Water (Simulated)
        const waterGeo = new THREE.PlaneGeometry(2000, 2000);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x3b82f6,
            transparent: true,
            opacity: 0.6,
            roughness: 0.1,
            metalness: 0.1
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.rotation.x = -Math.PI / 2;
        scene.add(water);
        waterMeshRef.current = water;

        sceneRef.current = scene;

        // 5. Rain System Helper
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
            const weatherRes = await fetchWeather() as WeatherData;
            setWeatherData(weatherRes);

            setLoadingStep(2);
            const gistdaRes = await fetchGistdaData() as GistdaResponse;
            if (gistdaRes.success) {
                setGistdaData(gistdaRes.data);
                drawGistdaPolygons(gistdaRes.data, scene); // Use Helper from utils
                summarizeImpact(gistdaRes.data);
            } else {
                setGistdaError(true);
            }

            const floodRes = await fetchRiverData() as FloodData;
            setFloodData(floodRes);

            setLoadingStep(3);
            // โหลดตึก 3D และส่ง project function ไปให้
            // @ts-ignore
            await fetchBuildings(scene, project);

            // ตรวจสอบสภาพอากาศเพื่อสร้างฝน
            if (weatherRes && weatherRes.current) {
                const isRaining = weatherRes.current.rain > 0 || weatherRes.current.showers > 0;
                if (isRaining) {
                    rainSystemRef.current = createRain();
                }
            }

            setLoadingStep(4);
            setTimeout(() => setIsLoading(false), 500);
        };
        initData();

        // 7. Animation Loop
        const animate = () => {
            requestRef.current = requestAnimationFrame(animate);
            controls.update();

            // Rain Animation
            if (rainSystemRef.current) {
                const positions = rainSystemRef.current.geometry.attributes.position.array as Float32Array;
                for (let i = 1; i < positions.length; i += 3) {
                    positions[i] -= 4;
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

        // Cleanup
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
            if (rendererRef.current) rendererRef.current.dispose();
            if (containerRef.current) containerRef.current.innerHTML = '';
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
        <div className="relative w-full h-screen font-sans text-white overflow-hidden">
            <div ref={containerRef} id="canvas-container"></div>

            {isLoading ? (
                <LoadingOverlay loadingStep={loadingStep} />
            ) : (
                <Dashboard
                    weatherData={weatherData}
                    gistdaData={gistdaData}
                    gistdaError={gistdaError}
                    impactSummaries={impactSummaries}
                    floodLevel={floodLevel}
                    setFloodLevel={setFloodLevel}
                />
            )}
        </div>
    );
};

export default App;