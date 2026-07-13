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
    getSensorById: (batchId: number) => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_SENSOR
            WHERE
                BATCH_ID = $1
        `, [batchId]);
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
    createSensor: (sensorId: number, checkDigit: string, manufacturer: string, sku: string, batchId: number, cableId: number | null, cableSku: string | null) => {
        return executeQuerySingleReturn(pool, `
            INSERT INTO
                api_sensor (
                    sensor_id,
                    check_digit,
                    manufacturer,
                    sku,
                    batch_id,
                    cable_id,
                    cable_sku
                )
            VALUES
                ($1, $2, $3, $4, $5, $6, $7)
            RETURNING
                *
        `, [sensorId, checkDigit, manufacturer, sku, batchId, cableId, cableSku])
    },
    setBatchId: (sensorId: number, batchId: number) => {
        return executeQuerySingleReturn(pool, `
            UPDATE API_SENSOR
            SET
                BATCH_ID = $1
            WHERE
                SENSOR_ID = $2
            RETURNING
                *
        `, [batchId, sensorId]);
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
    removeFromBatch: (sensorId: number) => {
        return executeNonQuery(pool, `
            UPDATE API_SENSOR
            SET
                BATCH_ID = NULL
            WHERE
                SENSOR_ID = $1;
        `, [sensorId])
    },
};

export default sensor;