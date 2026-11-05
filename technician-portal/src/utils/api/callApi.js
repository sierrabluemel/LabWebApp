import callApiAdvanced from './callApiAdvanced';

export default async function callApi(endPoint, parameters, download=false) {
	return callApiAdvanced(endPoint, {
		params: parameters,
		responseType: download ? 'blob': 'json'
	}).then((res) => {
		if (download)
			return res
		return res.data
	})
}