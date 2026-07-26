// src/lib/userProfile.ts — Persistent user profile storage
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  lat?: number;
  lon?: number;
  city?: string;
  state?: string;
  district?: string;
  permissionsShown?: boolean;
  soilHealthCardId?: string;
  soilHealthData?: {
    nitrogen?: string;
    phosphorus?: string;
    potassium?: string;
    ph?: string;
    oc?: string;
    ec?: string;
    s?: string;
    zn?: string;
    b?: string;
    fe?: string;
    mn?: string;
    cu?: string;
  };
}

const KEY = 'aranya_user_profile';

export async function loadUserProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error('loadUserProfile error:', e); }
  return {};
}

export async function saveUserProfile(data: Partial<UserProfile>): Promise<void> {
  try {
    const existing = await loadUserProfile();
    const merged = { ...existing, ...data };
    await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  } catch (e) { console.error('saveUserProfile error:', e); }
}
