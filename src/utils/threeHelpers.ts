import * as THREE from 'three';
import { GistdaData, ProjectFunction } from '../types';

// Constants
export const CENTER_LAT = 7.0075;
export const CENTER_LON = 100.4705;
const METERS_PER_DEG_LAT = 111320;
const METERS_PER_DEG_LON = 111320 * Math.cos(CENTER_LAT * Math.PI / 180);

// Helper: แปลงพิกัด Lat/Lon เป็น World Coordinates
export const project: ProjectFunction = (lat: number, lon: number) => {
    const x = (lon - CENTER_LON) * METERS_PER_DEG_LON;
    const z = (CENTER_LAT - lat) * METERS_PER_DEG_LAT;
    return { x, z };
};

// Helper: สร้างป้ายชื่อ (Sprite Text)
export const createLabel = (text: string, x: number, y: number, z: number): THREE.Sprite => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();

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

// Helper: วาดพื้นที่น้ำท่วมจาก GISTDA
export const drawGistdaPolygons = (data: GistdaData, scene: THREE.Scene) => {
    if (!data.features) return;

    const floodMat = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    data.features.forEach((feature) => {
        if (!feature.geometry || !feature.geometry.coordinates) return;

        const type = feature.geometry.type;
        const coords = feature.geometry.coordinates;

        const createShape = (ring: any[]) => {
            const shape = new THREE.Shape();
            if (ring.length === 0) return shape;

            const p0 = project(ring[0][1], ring[0][0]);
            shape.moveTo(p0.x, p0.z);

            for (let i = 1; i < ring.length; i++) {
                const p = project(ring[i][1], ring[i][0]);
                shape.lineTo(p.x, p.z);
            }
            return shape;
        };

        const drawMesh = (rings: any[]) => {
            const shape = createShape(rings[0]);
            const geometry = new THREE.ShapeGeometry(shape);
            geometry.rotateX(Math.PI / 2);
            geometry.translate(0, 2, 0);

            const mesh = new THREE.Mesh(geometry, floodMat);
            scene.add(mesh);
        };

        if (type === 'Polygon') {
            drawMesh(coords);
        } else if (type === 'MultiPolygon') {
            coords.forEach((polygon: any) => drawMesh(polygon));
        }
    });
};