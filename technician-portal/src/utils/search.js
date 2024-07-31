import callApi from "./api/callApi";

async function search(params, type) { // Should have a type of search attached, or else it will return null
    let response;
    switch (type) {
        case 'sensor':
            const sensorId = params.split(':')[0];
            if (isNaN(sensorId)) {
                return null;
            }
            response = await callApi('search', { table: `api_sensor.sensor_id`, filter_data: sensorId })
            break;
        case 'batch':
            if (isNaN(params)) {
                return null;
            }
            response = await callApi('search', { table: `api_batch.batch_id`, filter_data: params })
            break;
        case 'order':
            if (isNaN(params)) {
                return null;
            }
            response = await callApi('search', { table: `api_order.order_id`, filter_data: params })
            break;
        case 'customerOrder':
            if (params.toUpperCase().indexOf('TO') === -1) {
                params = `TO${params}`
            }
            response = await callApi('search', { table: `api_order.customer_order_number`, filter_data: params })
            break;
        default:
            console.error(`${type} is not a valid search parameter`);
            return null;
    }
    return response;
}

export default search;