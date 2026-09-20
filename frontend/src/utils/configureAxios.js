import axios from 'axios';

let configured = false;

export const configureAxios = () => {
    if (configured || typeof window === 'undefined') return;
    configured = true;

    axios.interceptors.request.use((config) => {
        try {
            const storedUser = JSON.parse(localStorage.getItem('currentUser') || localStorage.getItem('user') || 'null');
            const token = storedUser?.token;
            if (token && !config.headers?.Authorization) {
                config.headers = config.headers || {};
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            // Ignore malformed local storage and let the request fail normally.
        }
        return config;
    });
};
