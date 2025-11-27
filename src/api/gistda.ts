// GISTDA Flood Data API (STAC Endpoint with Token)
export const fetchGistdaData = async () => {
    try {
        const tokenPart1 = "T2aIDXls2vLngt7N2nJA8VVnKRgFZfuu4AzcByejo77sBAPF5Xq7a5KK2csqeOd";
        const token = tokenPart1;
        const baseUrl = "https://api-gateway.gistda.or.th/api/2.0/resources/stac/flood/collections/flood1day_r2/items/items_flood1day_r2";

        
        const targetUrl = `${baseUrl}?token=${token}&_t=${Date.now()}`;

       
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

        console.log("Fetching GISTDA (via corsproxy)...");

        const res = await fetch(proxyUrl);

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();

        
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