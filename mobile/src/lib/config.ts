// Base de la API. Expo inserta las variables EXPO_PUBLIC_* al compilar (ver .env.example).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '')
