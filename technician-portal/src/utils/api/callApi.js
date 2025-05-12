import callApiAdvanced from './callApiAdvanced';

export default function callApi(endPoint, parameters) {
	return callApiAdvanced(endPoint, {
		params: parameters,
	}).then((res) => {
		return res.data
	})
}