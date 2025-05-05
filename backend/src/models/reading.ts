import { executeNonQuery, executeQuery, executeQuerySingleReturn, pool, rollingDataPool } from "../utils/db";

let reading = {
    getRecentReadingsBySensorIds: (sensorIds: Array<number>, earliestReadingDate: string) => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_READING
            WHERE
                SENSOR_ID = ANY ($1::INT[])
                AND TIMESTAMP IS NOT NULL
                AND TIMESTAMP > $2
            ORDER BY
                TIMESTAMP DESC
        `, [sensorIds, earliestReadingDate]);
    },
    getReadingsBySensorId: (sensorId: number) => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_READING
            WHERE
                SENSOR_ID = $1
            ORDER BY
                READING_ID DESC
        `, [sensorId]);
    },
    createReading: (type: string, setPoint: number, referenceReading: number, sensorReading: number, labRh: number, labTemperature: number, sensorId: number, generatorId: number, referenceId: number, uncertainty: number, tolerance: number, pass: boolean, standard_deviation: number) => {
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
                    STANDARD_DEVIATION
                )
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING
                *
        `, [type, setPoint, referenceReading, sensorReading, labRh, labTemperature, sensorId, generatorId, referenceId, uncertainty, tolerance, pass, standard_deviation]);
    },
};

export default reading;