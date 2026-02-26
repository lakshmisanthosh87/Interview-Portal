import axios from "axios";

const baseUrl = import.meta.env.VITE_API_URL || "/api";
const finalBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

const axiosInstance = axios.create({
    baseURL: finalBaseUrl,
    withCredentials: true
})

export default axiosInstance;