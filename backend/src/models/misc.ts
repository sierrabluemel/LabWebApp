import { executeQuery, executeQuerySingleReturn, pool } from "../utils/db";

const misc = {
    sqlInjectMePls: (table: string, filterData: string) => {
        return executeQuery(pool, `
            SELECT
                *,
                API_SENSOR.SENSOR_ID
            FROM
                API_ORDER
                FULL JOIN API_BATCH ON API_ORDER.ORDER_ID = API_BATCH.ORDER_ID
                FULL JOIN API_SENSOR ON API_SENSOR.BATCH_ID = API_BATCH.BATCH_ID
                LEFT JOIN API_CERTIFICATE ON API_SENSOR.SENSOR_ID = API_CERTIFICATE.SENSOR_ID
                FULL JOIN API_CALIBRATION_PROCEDURE ON API_BATCH.CALIBRATION_PROCEDURE_ID = API_CALIBRATION_PROCEDURE.CALIBRATION_PROCEDURE_ID
                FULL JOIN API_INTERACTION_LOG ON API_BATCH.BATCH_ID = API_INTERACTION_LOG.BATCH_ID
            WHERE
                ${table} = $1
            ORDER BY
                API_BATCH.BATCH_ID DESC;
        `, [filterData])
    },
    searchData: () => {
        return executeQuery(pool, `
            SELECT
                API_BATCH.BATCH_ID,
                API_ORDER.ORDER_ID,
                API_ORDER.CUSTOMER_ORDER_NUMBER,
                API_SENSOR.SENSOR_ID
            FROM
                API_ORDER
                FULL JOIN API_BATCH ON API_ORDER.ORDER_ID = API_BATCH.ORDER_ID
                FULL JOIN API_SENSOR ON API_SENSOR.BATCH_ID = API_BATCH.BATCH_ID;
        `, [])
    },
    getCustomerById: (customerId: number) => {
        return executeQuerySingleReturn(pool, `
            SELECT
                *
            FROM
                API_CUSTOMER
            WHERE
                CUSTOMER_ID = $1
        `, [customerId]);
    },
    getCalibrationProcedures: () => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_CALIBRATION_PROCEDURE
            ORDER BY
                CALIBRATION_PROCEDURE_ID
        `, []);
    },
    getVariances: () => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_VARIANCES
        `, []);
    },
    getTechnicianById: (technicianId: number) => {
        return executeQuerySingleReturn(pool, `
            SELECT
                *
            FROM
                API_TECHNICIAN
            WHERE
                USER_ID = $1
        `, [technicianId]);
    },
}

export default misc;