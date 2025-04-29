import axios from 'axios';
import ip from '../ip/ip';

function callApi(endPoint, parameters) {
  const url = process.env.REACT_APP_STATUS === 'production' ? `https://${ip}/api/${endPoint}/` : `http://${ip}/api/${endPoint}/`;
  let token = localStorage.getItem("jwt");

  return axios.get(url, {
    params: parameters,
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
    .then((response) => {
      return response.data
    })
}

export default callApi;