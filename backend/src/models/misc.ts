import { executeQuery, executeQuerySingleReturn, executeNonQuery, pool } from "../utils/db";

// search_type -> SQL filter. A certificate keeps the lead it was issued for, so a lead search
// finds old certificates even after the base sensor was given a different lead.
const searchFilters: Record<string, string> = {
    order_id: "o.order_id = $1",
    customer_order_number: "o.customer_order_number = $1",
    batch_id: "b.batch_id = $1",
    sensor_id: "s.sensor_id = $1",
    cable_id: "COALESCE(c.cable_id, s.cable_id) = $1",
    certificate_id: "c.certificate_id = $1",
};

const misc = {
    searchTypes: Object.keys(searchFilters),

    // One row per certificate (or per sensor without one) that matches; nothing else from the order
    getSearchResults: (searchType: string, value: string) => {
        const filter = searchFilters[searchType];
        if (!filter) {
            throw new Error(`Invalid search type: ${searchType}`);
        }

        return executeQuery(pool, `
            SELECT
                o.order_id,
                o.customer_order_number,
                o.received_timestamp,
                o.shipped_timestamp,
                o.expedited,
                b.batch_id,
                b.calibration_procedure_id,
                b.current_location,
                s.sensor_id,
                s.sku AS sensor_sku,
                COALESCE(c.cable_id, s.cable_id) AS lead_id,
                COALESCE(c.cable_sku, s.cable_sku) AS lead_sku,
                c.certificate_id,
                c.timestamp AS certificate_timestamp,
                c.pass AS certificate_pass
            FROM API_SENSOR s
            INNER JOIN API_BATCH b ON b.batch_id = s.batch_id
            INNER JOIN API_ORDER o ON o.order_id = b.order_id
            LEFT JOIN API_CERTIFICATE c ON c.sensor_id = s.sensor_id AND c.batch_id = s.batch_id
            WHERE ${filter}
            ORDER BY
                b.batch_id DESC,
                s.sensor_id,
                c.certificate_id DESC;
        `, [value]);
    },

    // Order searches get one summary row per batch instead of every sensor in the order
    getSearchBatchSummaries: (searchType: string, value: string) => {
        const filter = searchFilters[searchType];
        if (!filter) {
            throw new Error(`Invalid search type: ${searchType}`);
        }

        return executeQuery(pool, `
            SELECT
                o.order_id,
                o.customer_order_number,
                o.received_timestamp,
                o.shipped_timestamp,
                o.expedited,
                b.batch_id,
                b.calibration_procedure_id,
                b.current_location,
                COUNT(DISTINCT s.sensor_id) AS sensor_count,
                COUNT(c.certificate_id) AS certificate_count
            FROM API_ORDER o
            LEFT JOIN API_BATCH b ON b.order_id = o.order_id
            LEFT JOIN API_SENSOR s ON s.batch_id = b.batch_id
            LEFT JOIN API_CERTIFICATE c ON c.sensor_id = s.sensor_id AND c.batch_id = s.batch_id
            WHERE ${filter}
            GROUP BY o.order_id, b.batch_id
            ORDER BY o.order_id, b.batch_id;
        `, [value]);
    },

    searchData: () => {
        return executeQuery(pool, `
            SELECT
                api_batch.batch_id,
                api_order.order_id,
                api_order.customer_order_number,
                api_sensor.sensor_id,
                COALESCE(api_certificate.cable_id, api_sensor.cable_id) AS cable_id,
                api_certificate.certificate_id
            FROM api_order
            LEFT JOIN api_batch ON api_order.order_id = api_batch.order_id
            LEFT JOIN api_sensor ON api_sensor.batch_id = api_batch.batch_id
            LEFT JOIN api_certificate ON api_certificate.sensor_id = api_sensor.sensor_id AND api_certificate.batch_id = api_sensor.batch_id
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
            FROM api_variances
        `, []);
    },

    getHumidityVariances: () => {
        return executeQuery(pool, `
            SELECT *
            FROM api_humidity_variances
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

    createHumidityVariance: (
        assetTag: string,
        temperature: number,
        humidity: number,
        calibrationUncertainty: number,
        readingResolutionUncertainty: number,
        interpolationUncertainty: number,
        driftUncertainty: number,
        hysteresisUncertainty: number,
        gasTemperatureDependanceUncertainty: number,
        heatDissipationUncertainty: number,
        selfHeatingUncertainty: number
    ) => {
        return executeQuery(pool, `
            INSERT INTO api_humidity_variances (
            asset_tag,
            temperature,
            humidity,
            calibration_uncertainty,
            reading_resolution_uncertainty,
            interpolation_uncertainty,
            drift_uncertainty,
            hysteresis_uncertainty,
            gas_temperature_dependance_uncertainty,
            heat_dissipation_uncertainty,
            self_heating_uncertainty
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING *;
        `, [assetTag, temperature, humidity, calibrationUncertainty, readingResolutionUncertainty, interpolationUncertainty, driftUncertainty, hysteresisUncertainty, gasTemperatureDependanceUncertainty, heatDissipationUncertainty, selfHeatingUncertainty]);
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

    // set_points is a JSON array; index is the set point's position in it
    updateSetPointMinutes: (calibrationProcedureId: number, index: number, minutes: number) => {
        return executeQuery(pool, `
            UPDATE API_CALIBRATION_PROCEDURE
            SET SET_POINTS = jsonb_set(SET_POINTS::jsonb, ARRAY[$2::text, 'stabilityCriteria', 'minutes'], to_jsonb($3::numeric))
            WHERE CALIBRATION_PROCEDURE_ID = $1
            RETURNING CALIBRATION_PROCEDURE_ID
        `, [calibrationProcedureId, index, minutes]);
    },

    changeSetPointActiveState: (setPointId: number, activeState: boolean) => {
        return executeQuery(pool, `
            UPDATE API_VARIANCES
            SET ACTIVE = $2
            WHERE ID = $1
            RETURNING *
        `, [setPointId, activeState]);
    },

    changeHumidityVarianceActiveState: (varianceId: number, activeState: boolean) => {
        return executeQuery(pool, `
            UPDATE api_humidity_variances
            SET active = $2
            WHERE variance_id = $1
            RETURNING *
        `, [varianceId, activeState]);
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