// River Discharge API
const CENTER_LAT = 7.0075;
const CENTER_LON = 100.4705;

export const fetchRiverData = async () => {
    try {
        const res = await fetch(`https://flood-api.open-meteo.com/v1/flood?latitude=${CENTER_LAT}&longitude=${CENTER_LON}&daily=river_discharge&forecast_days=1`);
        const data = await res.json();
        const discharge = data.daily?.river_discharge?.[0] || 0;
        return { discharge };
    } catch (e) {
        return { discharge: 0 };
    }
};
