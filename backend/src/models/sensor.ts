import { executeNonQuery, executeQuery, executeQuerySingleReturn, pool, rollingDataPool } from "../utils/db";

const sensor = {
    getSensors: () => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_SENSOR
        `, []);
    },
    getActiveSensors: () => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_SENSOR
                INNER JOIN API_BATCH ON API_BATCH.BATCH_ID = API_SENSOR.BATCH_ID
                INNER JOIN API_ORDER ON API_ORDER.ORDER_ID = API_BATCH.ORDER_ID
            WHERE
                API_ORDER.ACTIVE = TRUE;
        `, [])
    },
    createSensor: (sensorId: number, checkDigit: string, manufacturer: string, sku: string, batchId: number, spare: boolean) => {
        return executeQuerySingleReturn(pool, `
            INSERT INTO
                api_sensor (
                    sensor_id,
                    check_digit,
                    manufacturer,
                    sku,
                    batch_id,
                    spare
                )
            VALUES
                ($1, $2, $3, $4, $5, $6)
            -- A sensor gets one row per batch; re-adding it to the same batch returns the existing row
            ON CONFLICT (sensor_id, batch_id) DO UPDATE SET
                spare = EXCLUDED.spare
            RETURNING
                *
        `, [sensorId, checkDigit, manufacturer, sku, batchId, spare])
    },
    setSpare: (sensorId: number, batchId: number, spare: boolean) => {
        return executeNonQuery(pool, `
            UPDATE API_SENSOR
            SET
                SPARE = $3
            WHERE
                SENSOR_ID = $1
                AND BATCH_ID = $2;
        `, [sensorId, batchId, spare])
    },
    getSensorsByBatchId: (batchId: number) => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_SENSOR
            WHERE
                BATCH_ID = $1;
        `, [batchId]);
    },
    getSensorByOrderId: (orderId: number) => {
        return executeQuery(pool, `
            SELECT
                API_SENSOR.*
            FROM
                API_SENSOR
            JOIN API_BATCH ON API_BATCH.BATCH_ID = API_SENSOR.BATCH_ID
            WHERE
                API_BATCH.ORDER_ID = $1;
        `, [orderId]);
    },
    removeFromBatch: (sensorId: number, batchId: number) => {
        return executeNonQuery(pool, `
            UPDATE API_SENSOR
            SET
                BATCH_ID = NULL
            WHERE
                SENSOR_ID = $1
                AND BATCH_ID = $2;
        `, [sensorId, batchId])
    },
    addCableToSensor: (sensorId: number, cableId: number, cableSku: string) => {
        // shortcut: cables are scanned while the sensor is in its newest batch, so the latest row is updated; pass batch_id if cables get edited on older batches
        return executeNonQuery(pool, `
            UPDATE api_sensor
            SET
                cable_id = $1,
                cable_sku = $2
            WHERE
                id = (SELECT MAX(id) FROM api_sensor WHERE sensor_id = $3);
        `, [cableId, cableSku, sensorId])
    },
};

export default sensor;