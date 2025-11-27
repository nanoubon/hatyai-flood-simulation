// GISTDA Flood Data API (STAC Endpoint with Token)
export const fetchGistdaData = async () => {
    try {
        // Token สำหรับเข้าถึง API
        // หมายเหตุ: แบ่ง Token เป็นส่วนๆ เพื่อให้อ่านง่ายและไม่หลุดขอบ (Browser จะนำมาต่อกันเอง)
        const tokenPart1 = "T2aIDXls2vLngt7N2nJA8VVnKRgFZfuu4AzcByejo77sBAPF5Xq7a5KK2csqeOd";

        const token = tokenPart1;

        // URL Endpoint ใหม่ (STAC Standard)
        const baseUrl = "https://api-gateway.gistda.or.th/api/2.0/resources/stac/flood/collections/flood1day_r2/items/items_flood1day_r2";

        // ประกอบ URL + Token + Timestamp (ป้องกัน Browser จำค่าเดิมที่อาจ Error)
        const targetUrl = `${baseUrl}?token=${token}&_t=${Date.now()}`;

        // ใช้ corsproxy.io เพื่อแก้ปัญหา CORS และรองรับ URL ที่ยาวมากๆ ได้ดีกว่า proxy ตัวอื่น
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

        console.log("Fetching GISTDA (via corsproxy)...");

        const res = await fetch(proxyUrl);

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();

        // ปรับโครงสร้างข้อมูล: ถ้า API ส่งมาเป็น Feature เดี่ยวๆ ให้ห่อด้วย FeatureCollection
        // เพื่อให้ App.tsx สามารถวนลูป features ได้ไม่พัง
        let finalData = data;
        if (data.type === 'Feature' && !data.features) {
            finalData = { type: 'FeatureCollection', features: [data] };
        }

        console.log("GISTDA Data Processed:", finalData);

        return { success: true, data: finalData };
    } catch (e: any) {
        console.warn("GISTDA API Error:", e);
        return { success: false, error: e.message || "Unknown Error" };
    }
};