import { executeNonQuery, executeQuery, executeQuerySingleReturn, pool, rollingDataPool } from "../utils/db";

const batch = {
    getBatchById: (batchId: number) => {
        return executeQuerySingleReturn(pool, `
            SELECT
                *, api_order.customer_order_number
            FROM
                api_batch
            INNER JOIN
                api_order
            ON
                api_order.order_id = api_batch.order_id
            WHERE
                batch_id = $1
        `, [batchId])
    },
    getBatchesByOrderId: (orderId: number) => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_BATCH
            WHERE
                ORDER_ID = $1;
        `, [orderId])
    },
    getBatches: () => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_BATCH
            ORDER BY
                BATCH_ID
        `, []);
    },
    getBatchesByActiveState: (state: boolean) => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_BATCH
                INNER JOIN API_ORDER ON API_BATCH.ORDER_ID = API_ORDER.ORDER_ID
            WHERE
                API_BATCH.ACTIVE = $1
            ORDER BY
                BATCH_ID DESC
        `, [state]);
    },
    createBatch: (currentLocation: string, orderId: number, calibrationProcedureId: number, receivingTechnicianId: number | null, testingTechnicianId: number | null, shippingTechnicianId: number | null) => {
        return executeQuerySingleReturn(pool, `
            INSERT INTO
                API_BATCH (
                    CURRENT_LOCATION,
                    ORDER_ID,
                    CALIBRATION_PROCEDURE_ID,
                    RECEIVING_TECHNICIAN_ID,
                    TESTING_TECHNICIAN_ID,
                    SHIPPING_TECHNICIAN_ID
                )
            VALUES
                ($1, $2, $3, $4, $5, $6)
            RETURNING
                *
        `, [currentLocation, orderId, calibrationProcedureId, receivingTechnicianId, testingTechnicianId, shippingTechnicianId]);
    },
    setActiveState: (batchId: number, state: boolean) => {
        return executeNonQuery(pool, `
            UPDATE API_BATCH
            SET
                ACTIVE = $1
            WHERE
                BATCH_ID = $2
        `, [state, batchId]);
    },
    setCalibrationProcedure: (batchId: number, calibrationProcedureId: number) => {
        return executeNonQuery(pool, `
            UPDATE API_BATCH
            SET
                CALIBRATION_PROCEDURE_ID = $1
            WHERE
                BATCH_ID = $2
        `, [calibrationProcedureId, batchId]);
    },
    setLocation: (batchId: number, location: string | null) => {
        return executeNonQuery(pool, `
            UPDATE API_BATCH
            SET
                CURRENT_LOCATION = $1
            WHERE
                BATCH_ID = $2
        `, [location, batchId]);
    },
    createLocationLog: (batchId: number, location: string, timestamp: string) => {
        return executeQuerySingleReturn(pool, `
            INSERT INTO
                API_LOCATION_LOG (LOCATION, TIMESTAMP, BATCH_ID)
            VALUES
                ($1, $2, $3)
            RETURNING
                *
        `, [location, timestamp, batchId]);
    },
    getLocations: () => {
        // Every location used before, minus typos and pre-dash formats from history, plus bins not used yet, minus retired bins
        return executeQuery(pool, `
            SELECT
                LOCATION
            FROM
                API_LOCATION_LOG
            WHERE
                LOCATION ~ '^[RTS]-[A-Z0-9]+$'
                AND LOCATION NOT IN ('T-AB', 'S-C12', 'S-BS', 'S-C', 'S-STD')
            UNION
            SELECT
                LOCATION
            FROM
                (VALUES ('R-A1'), ('R-A2'), ('R-A3'), ('R-E1'), ('S-A2')) AS ADDED (LOCATION)
            ORDER BY
                LOCATION
        `, []);
    },
    getCalibrationInfo: (batchId: number) => {
        return executeQuerySingleReturn(pool, `
            SELECT
                API_BATCH.CALIBRATION_PROCEDURE_ID,
                API_TECHNICIAN.FIRST_NAME
            FROM
                API_BATCH
                JOIN API_TECHNICIAN ON API_BATCH.RECEIVING_TECHNICIAN_ID = API_TECHNICIAN.TECHNICIAN_ID
            WHERE
                API_BATCH.BATCH_ID = $1;
        `, [batchId]);
    },
    deleteLogs: (batchId: number) => {
        return executeQuery(pool, `
            DELETE FROM API_INTERACTION_LOG
            WHERE
                BATCH_ID = $1
            RETURNING
                *
        `, [batchId])
    },
    deleteBatch: (batchId: number) => {
        return executeQuery(pool, `
            DELETE FROM API_BATCH
            WHERE
                BATCH_ID = $1
            RETURNING
                *
        `, [batchId])
    },
};

export default batch;