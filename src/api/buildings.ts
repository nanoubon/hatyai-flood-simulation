import * as THREE from 'three';

// ค่าคงที่สำหรับใช้ Query ข้อมูลจาก Overpass API เท่านั้น
// (ส่วนการคำนวณพิกัดจะใช้ function project ที่ส่งมาจาก App.tsx เพื่อความแม่นยำ)
const CENTER_LAT = 7.0075;
const CENTER_LON = 100.4705;

// Type Definition สำหรับฟังก์ชัน Project
type ProjectFunction = (lat: number, lon: number) => { x: number; z: number };

// Helper: สร้างป้ายชื่อตึก
const createLabel = (text: string, x: number, y: number, z: number): THREE.Sprite => {
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

export const fetchBuildings = async (scene: THREE.Scene, project: ProjectFunction) => {
    try {
        console.log("Fetching 3D Buildings...");

        // Query หาตึกในรัศมี 450 เมตร จากใจกลาง
        const query = `
            [out:json];
            (
              way["building"](around:450,${CENTER_LAT},${CENTER_LON});
              relation["building"](around:450,${CENTER_LAT},${CENTER_LON});
            );
            out body;
            >;
            out skel qt;
        `;

        const response = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: query
        });

        if (!response.ok) throw new Error("Overpass API Error");

        const data = await response.json();
        const nodes: { [key: number]: { lat: number, lon: number } } = {};

        // Map Node ID -> Coordinates
        data.elements.forEach((el: any) => {
            if (el.type === 'node') nodes[el.id] = { lat: el.lat, lon: el.lon };
        });

        const buildingMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.5 });

        data.elements.forEach((el: any) => {
            if (el.type === 'way' && el.tags && el.tags.building) {
                const points = el.nodes.map((id: number) => nodes[id]).filter((n: any) => n);
                if (points.length < 3) return;

                const shape = new THREE.Shape();

                // *** ใช้ฟังก์ชัน project ที่ส่งมาจาก App.tsx ***
                const first = project(points[0].lat, points[0].lon);
                shape.moveTo(first.x, first.z);

                points.slice(1).forEach((p: any) => {
                    const proj = project(p.lat, p.lon);
                    shape.lineTo(proj.x, proj.z);
                });

                // คำนวณความสูงตึก
                let levels = el.tags['building:levels'] ? parseInt(el.tags['building:levels']) : 0;
                let height = levels > 0 ? levels * 4 : (Math.random() * 12 + 6);
                if (el.tags.name) height = Math.max(height, 25);

                // สร้าง 3D Mesh
                const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
                geometry.rotateX(Math.PI / 2);
                geometry.translate(0, height, 0); // ยกตึกขึ้นมาให้อยู่บนพื้น (Overpass coordinate คือพื้นดิน)

                const mesh = new THREE.Mesh(geometry, buildingMat);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                scene.add(mesh);

                // สร้างป้ายชื่อ
                const name = el.tags['name:th'] || el.tags.name || el.tags['name:en'];
                if (name) {
                    const box = new THREE.Box3().setFromObject(mesh);
                    const center = box.getCenter(new THREE.Vector3());
                    // ปรับตำแหน่งป้ายให้ลอยเหนือตึกเล็กน้อย
                    const label = createLabel(name, center.x, height + 5, center.z);
                    scene.add(label);
                }
            }
        });

        console.log("Buildings loaded successfully");
        return true;
    } catch (e) {
        console.error("Failed to fetch buildings:", e);
        return false;
    }
};