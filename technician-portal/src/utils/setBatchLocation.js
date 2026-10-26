import callApi from "./api/callApi";

// What moving a batch to a location starting with each letter does. R = receiving (queued), T = testing, S = shipping
const LOCATION_ACTIONS = {
    R: { department: 'receiving', start: false, active: true, networkGroup: 'staging', heartbeat: 2 },
    T: { department: 'testing', start: true, active: true, networkGroup: 'testing', heartbeat: 0.05 },
    S: { department: 'testing', start: false, active: false, networkGroup: 'staging', heartbeat: 120 },
};

// Resolves to nothing on success, or an error to show on failure
export default async function setBatchLocation(location, technicianId, batchNumber) {
    const action = location ? LOCATION_ACTIONS[location[0]] : undefined;

    if (!action) {
        return `Location "${location}" is invalid`;
    }

    return callApi('create-location-log', {
        'location': location,
        'batch_id': batchNumber
    })
        .then(() => callApi('log-batch-interaction', {
            department: action.department,
            start: action.start,
            technician_id: technicianId,
            batch_id: batchNumber
        }))
        .then(() => callApi('set-batch-active-state', {
            batch_id: batchNumber,
            active_state: action.active
        }))
        .then(() => callApi('move-batch-to-network-group', {
            batch_id: batchNumber,
            network_group: action.networkGroup,
            heartbeat: action.heartbeat
        }))
        .then(() => callApi('change-batch-heartbeats', {
            batch_id: batchNumber,
            heartbeat: action.heartbeat
        }))
        .then(() => undefined)
        .catch(error => {
            return error ?? 'Unknown error';
        })
}
