import { executeQuery, executeQuerySingleReturn, executeNonQuery, pool } from "../utils/db";

const allowedSearchColumns = [
    "o.order_id",
    "b.batch_id",
    "s.sensor_id",
    "o.customer_order_number"
];

const misc = {
    getSearchResults: (column: string, value: string) => {
        // Validate column against whitelist
        if (!allowedSearchColumns.includes(column)) {
            throw new Error(`Invalid column name: ${column}`);
        }

        const sql = `
        WITH matching_orders AS (
            SELECT DISTINCT o.order_id
            FROM API_ORDER o
            INNER JOIN API_BATCH b ON b.order_id = o.order_id
            INNER JOIN API_SENSOR s ON s.batch_id = b.batch_id
            LEFT JOIN API_CERTIFICATE c ON c.sensor_id = s.sensor_id
            WHERE ${column} = $1
        )
        SELECT
            o.order_id,
            o.customer_order_number,
            o.received_timestamp,
            o.shipped_timestamp,
            o.expedited,
            b.batch_id,
            b.current_location,
            s.sensor_id,
            s.sku AS sensor_sku,
            c.certificate_id,
            c.timestamp as certificate_timestamp,
            c.pass as certificate_pass,
            b.calibration_procedure_id,
            il.log_id AS interaction_log_id
        FROM matching_orders mo
        INNER JOIN API_ORDER o ON o.order_id = mo.order_id
        INNER JOIN API_BATCH b ON b.order_id = o.order_id
        INNER JOIN API_SENSOR s ON s.batch_id = b.batch_id
        LEFT JOIN API_CERTIFICATE c ON c.sensor_id = s.sensor_id
        LEFT JOIN API_INTERACTION_LOG il ON il.batch_id = b.batch_id
        ORDER BY
            o.order_id,
            b.batch_id,
            s.sensor_id,
            c.certificate_id;
    `;

        return executeQuery(pool, sql, [value]);
    },

    searchData: () => {
        return executeQuery(pool, `
            SELECT
                API_BATCH.BATCH_ID,
                API_ORDER.ORDER_ID,
                API_ORDER.CUSTOMER_ORDER_NUMBER,
                API_SENSOR.SENSOR_ID
            FROM API_ORDER
            INNER JOIN API_BATCH ON API_ORDER.ORDER_ID = API_BATCH.ORDER_ID
            INNER JOIN API_SENSOR ON API_SENSOR.BATCH_ID = API_BATCH.BATCH_ID
        `, []);
    },

    getCustomerById: (customerId: number) => {
        return executeQuerySingleReturn(pool, `
            SELECT *
            FROM API_CUSTOMER
            WHERE CUSTOMER_ID = $1
        `, [customerId]);
    },

    getCalibrationProcedures: () => {
        return executeQuery(pool, `
            SELECT *
            FROM API_CALIBRATION_PROCEDURE
            ORDER BY CALIBRATION_PROCEDURE_ID
        `, []);
    },

    getVariances: () => {
        return executeQuery(pool, `
            SELECT *
            FROM API_VARIANCES
        `, []);
    },

    getVariancesByCalibrationProcedure: (calibrationProcedure: number) => {
        return executeQuery(pool, `
            SELECT API_VARIANCES.*
            FROM API_VARIANCES
            JOIN API_CALIBRATION_PROCEDURE_VARIANCES
                ON API_VARIANCES.ID = API_CALIBRATION_PROCEDURE_VARIANCES.VARIANCE_ID
            WHERE API_CALIBRATION_PROCEDURE_VARIANCES.CALIBRATION_PROCEDURE_ID = $1
              AND API_VARIANCES.active = true
        `, [calibrationProcedure]);
    },

    createSetPoint: (
        setPoint: number,
        readingType: string,
        reference: number,
        drift: number,
        bridge: number,
        uniformity: number,
        stability: number,
        dutResolution: number,
        referenceAssetTag: string,
        generatorAssetTag: string,
        referenceType: string,
        generatorType: string
    ) => {
        return executeQuery(pool, `
            INSERT INTO API_VARIANCES (
                SET_POINT,
                READING_TYPE,
                REFERENCE,
                DRIFT,
                BRIDGE,
                UNIFORMITY,
                STABILITY,
                DUT_RESOLUTION,
                REFERENCE_ASSET_TAG,
                GENERATOR_ASSET_TAG,
                REFERENCE_TYPE,
                GENERATOR_TYPE
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            RETURNING *
        `, [setPoint, readingType, reference, drift, bridge, uniformity, stability, dutResolution, referenceAssetTag, generatorAssetTag, referenceType, generatorType]);
    },

    createSetPointLink: (setPointId: number, calibrationProcedureId: number) => {
        return executeQuery(pool, `
            INSERT INTO API_CALIBRATION_PROCEDURE_VARIANCES (
                VARIANCE_ID,
                CALIBRATION_PROCEDURE_ID
            )
            VALUES ($1,$2)
            RETURNING *
        `, [setPointId, calibrationProcedureId]);
    },

    changeSetPointActiveState: (setPointId: number, activeState: boolean) => {
        return executeQuery(pool, `
            UPDATE API_VARIANCES
            SET ACTIVE = $2
            WHERE ID = $1
            RETURNING *
        `, [setPointId, activeState]);
    },

    getTechnicianById: (technicianId: number) => {
        return executeQuerySingleReturn(pool, `
            SELECT *
            FROM API_TECHNICIAN
            WHERE USER_ID = $1;
        `, [technicianId]);
    },

    getNotifications: (technicianId: number) => {
        return executeQuery(pool, `
            SELECT *
            FROM api_notifications
            WHERE technician_id = $1
            AND is_dismissed != true
            AND time_to_notify < CURRENT_TIMESTAMP
            OR time_to_notify IS NULL
            AND is_dismissed != true;
        `, [technicianId]);
    },

    createNotification: (title: string, description: string, notifyDate: Date, technicianId: number, repeatable: boolean, repeatInterval: number | null, repeatUnit: string | null) => {
        return executeNonQuery(pool, `
            INSERT INTO api_notifications
            (title, description, time_to_notify, technician_id, repeatable, repeat_interval, repeat_unit)
            VALUES ($1, $2, $3, $4, $5, $6, $7);
        `, [title, description, notifyDate, technicianId, repeatable, repeatInterval, repeatUnit]);
    },

    dismissNotification: (notificationId: number) => {
        return executeNonQuery(pool, `
            UPDATE api_notifications
            SET is_dismissed = true
            WHERE id = $1;
        `, [notificationId]);
    },

    getNotification: (notificationId: number) => {
        return executeQuerySingleReturn(pool, `
            SELECT *
            FROM api_notifications
            WHERE id = $1;
        `, [notificationId]);
    },

    updateNotificationDate: (notificationId: number, newDate: Date) => {
        return executeNonQuery(pool, `
            UPDATE api_notifications
            SET time_to_notify = $1
            WHERE id = $2;
        `, [newDate, notificationId]);
    },

    getTechnicians: () => {
        return executeQuery(pool, `
            SELECT *
            FROM api_technician
            ORDER BY list_priority;
        `, []);
    },
}

export default misc;