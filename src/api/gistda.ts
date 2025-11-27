// GISTDA Flood Data API (with CORS proxy)
export const fetchGistdaData = async () => {
    try {
        // Use CORS Proxy
        const targetUrl = "https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/1day?limit=1&offset=0";
        const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        console.log("Fetching GISTDA:", url);

        const res = await fetch(url);

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();
        return { success: true, data: data };
    } catch (e) {
        console.warn("GISTDA API Access Issue (likely CORS or Key required):", e);
        return { success: false, error: e.message };
    }
};
