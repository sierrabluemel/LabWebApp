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
                INNER JOIN API_BATCH ON API_ORDER.ORDER_ID = API_BATCH.ORDER_ID
                INNER JOIN API_SENSOR ON API_SENSOR.BATCH_ID = API_BATCH.BATCH_ID
        `, [])
    },
    temp: (searchString: string) => {
        const searchRegEx = `%${searchString}%`
        return executeQuery(pool, `
            SELECT
                API_BATCH.BATCH_ID,
                API_ORDER.ORDER_ID,
                API_ORDER.CUSTOMER_ORDER_NUMBER,
                API_SENSOR.SENSOR_ID
            FROM
                API_ORDER
                INNER JOIN API_BATCH ON API_ORDER.ORDER_ID = API_BATCH.ORDER_ID
                INNER JOIN API_SENSOR ON API_SENSOR.BATCH_ID = API_BATCH.BATCH_ID
            WHERE
                CAST(API_BATCH.BATCH_ID as TEXT) ILIKE $1 OR
                CAST(API_ORDER.ORDER_ID as TEXT) ILIKE $1 OR
                API_ORDER.CUSTOMER_ORDER_NUMBER ILIKE $1 OR
                CAST(API_SENSOR.SENSOR_ID as TEXT) ILIKE $1
        `, [searchRegEx])
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
    getVariancesByCalibrationProcedure: (calibrationProcedure: number) => {
        return executeQuery(pool, `
            SELECT
                API_VARIANCES.*
            FROM
                API_VARIANCES
            JOIN 
                API_CALIBRATION_PROCEDURE_VARIANCES
            ON
                API_VARIANCES.ID = API_CALIBRATION_PROCEDURE_VARIANCES.VARIANCE_ID
            WHERE
                API_CALIBRATION_PROCEDURE_VARIANCES.CALIBRATION_PROCEDURE_ID = $1
            AND
                API_VARIANCES.active = true;
        `, [calibrationProcedure]);
    },
    createSetPoint: (setPoint: number, readingType: string, reference: number, drift: number, bridge: number, uniformity: number, stability: number, dutResolution: number, referenceAssetTag: string, generatorAssetTag: string, referenceType: string, generatorType: string) => {
        return executeQuery(pool, `
            INSERT INTO
                API_VARIANCES (
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
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING
                *
        `, [setPoint, readingType, reference, drift, bridge, uniformity, stability, dutResolution, referenceAssetTag, generatorAssetTag, referenceType, generatorType]);
    },
    createSetPointLink: (setPointId: number, calibrationProcedureId: number) => {
        return executeQuery(pool, `
            INSERT INTO
                API_CALIBRATION_PROCEDURE_VARIANCES (
                    VARIANCE_ID,
                    CALIBRATION_PROCEDURE_ID
                )
            VALUES
                ($1, $2)
            RETURNING
                *
        `, [setPointId, calibrationProcedureId]);
    },
    changeSetPointActiveState: (setPointId: number, activeState: boolean) => {
        return executeQuery(pool, `
            UPDATE
                API_VARIANCES
            SET
                ACTIVE = $2
            WHERE
                ID = $1
            RETURNING
                *
        `, [setPointId, activeState]);
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