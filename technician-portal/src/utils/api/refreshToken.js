import axios from "axios";
import ip from "../ip/ip";

let refreshing = false
let promise;

export default function refreshToken() {
    const url = process.env.REACT_APP_STATUS === 'production' ? `https://${ip}/api/auth/refresh/` : `http://${ip}/api/auth/refresh/`;
    let token = localStorage.getItem("refresh");
    if (refreshing)
        return promise;
    refreshing = true;
    promise = axios.get(url, { headers: { Refresh: `Bearer ${token}` } })
        .then((response) => {
            localStorage.setItem("jwt", response.data);
            refreshing = false;
        })
}