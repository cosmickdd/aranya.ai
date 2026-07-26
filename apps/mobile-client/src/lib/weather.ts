// src/lib/weather.ts — Weather & Soil Labs API client
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://aranya-ai-6r0j.onrender.com';

export interface WeatherData {
  location: string; lat: number; lon: number;
  temp: number; feels_like: number; humidity: number;
  condition: string; icon: string; wind_speed: number; rain_1h: number;
  forecast: ForecastItem[]; summary: string; farming_advice: string; live: boolean;
}
export interface ForecastItem { time: string; temp: number; condition: string; rain_prob: number; rain_mm: number; }
export interface SoilLab { name: string; state: string; district: string; address: string; phone: string; lat: number; lon: number; distance_km: number; }

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const resp = await fetch(`${API_URL}/api/weather?lat=${lat}&lon=${lon}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) { console.error('fetchWeather error:', e); return null; }
}

export async function fetchSoilLabs(lat: number, lon: number, limit = 5): Promise<{ labs: SoilLab[], portal_url: string } | null> {
  try {
    const resp = await fetch(`${API_URL}/api/soil-labs?lat=${lat}&lon=${lon}&limit=${limit}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) { console.error('fetchSoilLabs error:', e); return null; }
}

export function weatherEmoji(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('thunder')) return 'u26C8uFE0F';
  if (c.includes('rain') || c.includes('drizzle')) return 'u1F327uFE0F';
  if (c.includes('snow')) return 'u2744uFE0F';
  if (c.includes('mist') || c.includes('fog') || c.includes('haze')) return 'u1F32BuFE0F';
  if (c.includes('cloud')) return c.includes('few') || c.includes('scatter') ? 'u26C5' : 'u2601uFE0F';
  if (c.includes('clear') || c.includes('sunny')) return 'u2600uFE0F';
  return 'u1F324uFE0F';
}
