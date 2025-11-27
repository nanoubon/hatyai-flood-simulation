// General GeoJSON types based on usage
export interface GeoJsonProperties {
    [key: string]: any;
    tb_tn?: string; // Tambon name
    ap_tn?: string; // Amphoe name
    id?: string | number;
}

export interface GeoJsonFeature {
    type: "Feature";
    geometry: {
        type: string; // e.g., "Polygon"
        coordinates: any[];
    };
    properties: GeoJsonProperties;
}

export interface GistdaData {
    type: "FeatureCollection";
    features: GeoJsonFeature[];
}

// Response from GISTDA API call in gistda.ts
export interface GistdaResponse {
    success: boolean;
    data: GistdaData;
    error?: string;
}

// For weather data from weather.ts
export interface WeatherData {
    current: {
        temperature_2m: number;
        rain: number;
        showers: number;
    };
}

// For flood data from flood.ts
export interface FloodData {
    // Define based on what flood.ts returns, assuming a simple structure for now
    level: number;
    status: string;
}

// For the summarized impact data used in Dashboard.tsx
export interface ImpactSummary {
    areaName: string;
    count: number;
}
