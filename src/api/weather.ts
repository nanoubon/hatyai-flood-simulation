// Weather API functions
const CENTER_LAT = 7.0075;
const CENTER_LON = 100.4705;

export const fetchWeather = async () => {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${CENTER_LAT}&longitude=${CENTER_LON}&current=temperature_2m,rain,showers,weather_code&daily=precipitation_sum&timezone=Asia%2FBangkok`);
        const data = await res.json();
        return { current: data.current, daily: data.daily };
    } catch (e) {
        console.error("Weather fetch failed", e);
        return null;
    }
};
