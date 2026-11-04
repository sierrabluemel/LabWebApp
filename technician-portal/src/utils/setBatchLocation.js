import callApi from "./api/callApi";

// What moving a batch to a location starting with each letter does. R = receiving (queued), T = testing, P = packaging, S = shipping
const LOCATION_ACTIONS = {
    R: { department: 'receiving', start: false, active: true, networkGroup: 'staging', heartbeat: 2 },
    T: { department: 'testing', start: true, active: true, networkGroup: 'testing', heartbeat: 0.05 },
    P: { department: 'testing', start: false, active: false, networkGroup: 'staging', heartbeat: 120 },
    S: { department: 'testing', start: false, active: false, networkGroup: 'staging', heartbeat: 120 },
};

// What the server said, or the transport error
const reason = (error) => error?.response?.data?.error ?? error?.response?.data?.Result ?? error?.message ?? 'Unknown error';

// Resolves to { moved, error }. The steps run in order, so a failure after the first means the location was recorded
// (moved is true) but a later step was not done. onRecorded fires as soon as the first step succeeds, since the
// iMonnit steps after it can take a minute for a big batch.
export default async function setBatchLocation(location, technicianId, batchNumber, onRecorded) {
    const action = location ? LOCATION_ACTIONS[location[0]] : undefined;

    if (!action) {
        return { moved: false, error: `Location "${location}" is invalid: it must start with R, T, P or S` };
    }

    const steps = [
        ['record the location', () => callApi('create-location-log', { 'location': location, 'batch_id': batchNumber })],
        ['log the move', () => callApi('log-batch-interaction', { department: action.department, start: action.start, technician_id: technicianId, batch_id: batchNumber })],
        ['set the batch state', () => callApi('set-batch-active-state', { batch_id: batchNumber, active_state: action.active })],
        // The backend answers at once and does the iMonnit work (networks and heartbeats) in the background; a failure
        // reaches the technician as a notification
        ['move its sensors to the network', () => callApi('move-batch-to-network-group', { batch_id: batchNumber, network_group: action.networkGroup, heartbeat: action.heartbeat, technician_id: technicianId })],
    ];

    for (const [index, [step, call]] of steps.entries()) {
        try {
            await call();
        } catch (error) {
            return index === 0
                ? { moved: false, error: `Could not move batch ${batchNumber} to ${location}: ${reason(error)}` }
                : { moved: true, error: `Batch ${batchNumber} was moved to ${location} but could not ${step}: ${reason(error)}` };
        }
        if (index === 0)
            onRecorded?.();
    }
    return { moved: true };
}
