import { executeNonQuery, executeQuery, executeQuerySingleReturn, pool, rollingDataPool } from "../utils/db";

let reading = {
    getRecentReadingsBySensorIds: (sensorIds: Array<number>, earliestReadingDate: string) => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                api_reading
            WHERE
                sensor_id = ANY ($1::INT[])
                AND timestamp > $2
            ORDER BY
                timestamp DESC;
        `, [sensorIds, earliestReadingDate]);
    },
    getReadingsBySensorId: (sensorId: number, batchId: number | null = null) => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_READING
            WHERE
                SENSOR_ID = $1
                AND ($2::INT IS NULL OR BATCH_ID = $2)
            ORDER BY
                READING_ID DESC
        `, [sensorId, batchId]);
    },
    createReading: (type: string, setPoint: number, referenceReading: number, sensorReading: number, labRh: number, labTemperature: number, sensorId: number, generatorId: number, referenceId: number, uncertainty: number, tolerance: number, pass: boolean, standardDeviation: number, readingRawData: any, asFound: boolean) => {
        return executeQuery(pool, `
            INSERT INTO
                API_READING (
                    TYPE,
                    SET_POINT,
                    REFERENCE_READING,
                    SENSOR_READING,
                    LAB_RH,
                    LAB_TEMPERATURE,
                    SENSOR_ID,
                    GENERATOR_ID,
                    REFERENCE_ID,
                    UNCERTAINTY,
                    TOLERANCE,
                    PASS,
                    STANDARD_DEVIATION,
                    READING_RAW_DATA,
                    AS_FOUND,
                    BATCH_ID
                )
            VALUES
                -- Readings belong to the sensor's newest batch, the one being tested
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                    (SELECT BATCH_ID FROM API_SENSOR WHERE SENSOR_ID = $7 ORDER BY ID DESC LIMIT 1))
            RETURNING
                *
        `, [type, setPoint, referenceReading, sensorReading, labRh, labTemperature, sensorId, generatorId, referenceId, uncertainty, tolerance, pass, standardDeviation, readingRawData, asFound]);
    },
};

export default reading;