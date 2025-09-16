import callApi from "./api/callApi";

export default async function setBatchLocation(location, technicianId, batchNumber) {

    if (!isValidLocation(location)) {
        return `Location "${location}" is invalid`;
    }

    return callApi('create-location-log', {
        'location': location,
        'batch_id': batchNumber
    })
        .then(() => {
            if (location.startsWith('R')) {
                callApi('log-batch-interaction', {
                    department: 'receiving',
                    start: false,
                    technician_id: technicianId,
                    batch_id: batchNumber
                })
                    .then(() => {
                        callApi('set-batch-active-state', {
                            batch_id: batchNumber,
                            active_state: true
                        })
                    })
                    .then(() => {
                        callApi('move-batch-to-network-group', {
                            batch_id: batchNumber,
                            network_group: 'staging'
                        })
                            .then(() => {
                                callApi('change-batch-heartbeats', {
                                    batch_id: batchNumber,
                                    heartbeat: 2
                                })
                            })
                    })

            } else if (location.startsWith('T')) {
                callApi('log-batch-interaction', {
                    department: 'testing',
                    start: true,
                    technician_id: technicianId,
                    batch_id: batchNumber
                })
                    .then(() => {
                        callApi('set-batch-active-state', {
                            batch_id: batchNumber,
                            active_state: true
                        })
                    })
                    .then(() => {
                        callApi('move-batch-to-network-group', {
                            batch_id: batchNumber,
                            network_group: 'testing'
                        })
                            .then(() => {
                                callApi('change-batch-heartbeats', {
                                    batch_id: batchNumber,
                                    heartbeat: 0.05
                                })
                            })
                    })

            } else if (location.startsWith('S')) {
                callApi('log-batch-interaction', {
                    department: 'testing',
                    start: false,
                    technician_id: technicianId,
                    batch_id: batchNumber
                })
                    .then(() => {
                        callApi('set-batch-active-state', {
                            batch_id: batchNumber,
                            active_state: false
                        })
                    })
                    .then(() => {
                        callApi('move-batch-to-network-group', {
                            batch_id: batchNumber,
                            network_group: 'staging'
                        })
                            .then(() => {
                                callApi('change-batch-heartbeats', {
                                    batch_id: batchNumber,
                                    heartbeat: 120
                                })
                            })
                    })
            }
        })
        .catch(error => {
            return error;
        })
}

function isValidLocation(location) {
    if (!location) return false;
    const validFirstLetters = ['R', 'T', 'S'];
    const firstLetter = location[0];

    return validFirstLetters.includes(firstLetter);
}