import axios from 'axios';
import ip from '../ip/ip';
import refreshToken from './refreshToken';

export default function callApiAdvanced(endPoint, config) {
    const url = process.env.REACT_APP_STATUS === 'production' ? `https://${ip}/api/${endPoint}/` : `http://${ip}/api/${endPoint}/`;
    let token = localStorage.getItem("jwt");
    if (!config)
        config = {}
    if (!config.headers)
        config.headers = {}
    config.headers['Authorization'] = `Bearer ${token}`

    return axios.get(url, config)
        .catch((err) => {
            if (err.response.status !== 418) {
                throw err;
            }
            return refreshToken()
                .then(callApiAdvanced(endPoint, config));
        })
}