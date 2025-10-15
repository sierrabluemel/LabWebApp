import { executeNonQuery, executeQuery, executeQuerySingleReturn, pool } from "../utils/db";

const certificate = {
    getCalibrationsByDateRange: (startDate: Date, endDate: Date) => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_ORDER
                INNER JOIN API_BATCH ON API_ORDER.ORDER_ID = API_BATCH.ORDER_ID
                INNER JOIN API_SENSOR ON API_BATCH.BATCH_ID = API_SENSOR.BATCH_ID
                INNER JOIN API_CERTIFICATE ON API_SENSOR.SENSOR_ID = API_CERTIFICATE.SENSOR_ID
            WHERE
                TIMESTAMP > $1
                AND TIMESTAMP < $2
                AND API_CERTIFICATE.CERTIFICATE_ID IS NOT NULL
        `, [startDate, endDate]);
    },
    getCertificatesByOrderId: (orderId: number) => {
        return executeQuery(pool, `
            SELECT 
                DISTINCT ON (API_SENSOR.SENSOR_ID) *
            FROM
                API_SENSOR
                INNER JOIN API_CERTIFICATE ON API_CERTIFICATE.SENSOR_ID = API_SENSOR.SENSOR_ID
                INNER JOIN API_BATCH ON API_SENSOR.BATCH_ID = API_BATCH.BATCH_ID
                INNER JOIN API_ORDER ON API_BATCH.ORDER_ID = API_ORDER.ORDER_ID
            WHERE
                API_ORDER.ORDER_ID = $1
            ORDER BY API_SENSOR.SENSOR_ID, API_CERTIFICATE.CERTIFICATE_ID DESC;
        `, [orderId]);
    },
    createCertificate: (certificateJson: any, template: string, sensorId: number, pass: boolean) => {
        return executeQuerySingleReturn(pool, `
            INSERT INTO
                API_CERTIFICATE (GENERATE_CERTIFICATE_JSON, TEMPLATE, SENSOR_ID, PASS)
            VALUES
                ($1, $2, $3, $4)
            RETURNING
                *
        `, [certificateJson, template, sensorId, pass]);
    },
    getCertficateById: (certificateId: number) => {
        return executeQuerySingleReturn(pool, `
            SELECT
                *
            FROM
                API_CERTIFICATE
            WHERE
                CERTIFICATE_ID = $1
        `, [certificateId]);
    },
    updateCertificateJson: (certificateId: number, certificateJson: any) => {
        return executeQuerySingleReturn(pool, `
            UPDATE API_CERTIFICATE
            SET
                GENERATE_CERTIFICATE_JSON = $1
            WHERE
                CERTIFICATE_ID = $2
            RETURNING
                *
        `, [certificateJson, certificateId]);
    },
    invoiceReport: (startDate: Date, endDate: Date) => {
        return executeQuery(pool, `
            SELECT
                API_CERTIFICATE.SENSOR_ID,
                API_CERTIFICATE.TIMESTAMP,
                GENERATE_CERTIFICATE_JSON,
                SKU,
                CALIBRATION_PROCEDURE_ID,
                EXPEDITED,
                CUSTOMER_ORDER_NUMBER
            FROM
                API_CERTIFICATE
                INNER JOIN API_SENSOR ON API_CERTIFICATE.SENSOR_ID = API_SENSOR.SENSOR_ID
                INNER JOIN API_BATCH ON API_SENSOR.BATCH_ID = API_BATCH.BATCH_ID
                INNER JOIN API_ORDER ON API_BATCH.ORDER_ID = API_ORDER.ORDER_ID
            WHERE
                TIMESTAMP > $1
                AND TIMESTAMP < $2;
        `, [startDate, endDate]);
    }
};

export default certificate;