import callApi from "./api/callApi";

async function search(params, type) { // Should have a type of search attached, or else it will return null
    switch (type) {
        case 'sensor':
            const sensorId = params.split(':')[0];
            if (isNaN(sensorId)) {
                return null;
            }
            return callApi('search', { table: `api_sensor.sensor_id`, filter_data: sensorId })
        case 'batch':
            if (isNaN(params)) {
                return null;
            }
            return callApi('search', { table: `api_batch.batch_id`, filter_data: params })
        case 'order':
            if (isNaN(params)) {
                return null;
            }
            return callApi('search', { table: `api_order.order_id`, filter_data: params })
        case 'customerOrder':
            params = params.toUpperCase()
            if (params.indexOf('TO') === -1) {
                params = `TO${params}`
            }
            return callApi('search', { table: `api_order.customer_order_number`, filter_data: params })
        default:
            console.error(`${type} is not a valid search parameter`);
            return null;
    }
}

export default search;