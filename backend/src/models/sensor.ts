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
    createSensor: (sensorId: number, checkDigit: string, manufacturer: string, sku: string, batchId: number) => {
        return executeQuerySingleReturn(pool, `
            INSERT INTO
                api_sensor (
                    sensor_id,
                    check_digit,
                    manufacturer,
                    sku,
                    batch_id
                )
            VALUES
                ($1, $2, $3, $4, $5)
            RETURNING
                *
        `, [sensorId, checkDigit, manufacturer, sku, batchId])
    },
    setBatchId: (sensorId: number, batchId: number) => {
        return executeQuerySingleReturn(pool, `
            UPDATE api_sensor
            SET
                batch_id = $1,
                cable_id = NULL,
                cable_sku = NULL
            WHERE
                sensor_id = $2
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
    addCableToSensor: (sensorId: number, cableId: number, cableSku: string) => {
        return executeNonQuery(pool, `
            UPDATE api_sensor
            SET
                cable_id = $1,
                cable_sku = $2
            WHERE
                sensor_id = $3;
        `, [cableId, cableSku, sensorId])
    },
};

export default sensor;