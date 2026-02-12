import { executeQuery, executeQuerySingleReturn, rollingDataPool } from "../utils/db";
import format from 'pg-format';

const rollingData = {
    getOnlineSensors: () => {
        return executeQuerySingleReturn(rollingDataPool, `
            SELECT
                MONNIT_SENSOR_DATA
            FROM
                ROLLING_DATA
            ORDER BY
                TIMESTAMP DESC
            LIMIT
                1
        `, []);
    },
    getRecentData: () => {
        return executeQuerySingleReturn(rollingDataPool, `
            SELECT
                *
            FROM
                ROLLING_DATA
            ORDER BY
                TIMESTAMP DESC
            LIMIT
                1
        `, []);
    },
    getStableTime: (startTime: Date, reference: string, type: string, setPoint: number, stabilityCriteria: any) => {
        return executeQuerySingleReturn(rollingDataPool, `
            SELECT a.TIMESTAMP
			    FROM
                (SELECT
                    d.TIMESTAMP,
                    d.STABILITY_DATA
                    FROM
                    (SELECT TIMESTAMP, REFERENCE_DATA -> $1 -> 'stability_data' -> $2 AS STABILITY_DATA FROM ROLLING_DATA) d
                    WHERE
                        TIMESTAMP >= $3
                    AND
                        abs(CAST (d.STABILITY_DATA ->> 'slope' AS float8)) < $4
                    AND
                        CAST (d.STABILITY_DATA ->> 'standard_deviation' AS float8) < $5
                    AND
                        abs(CAST (d.STABILITY_DATA ->> 'assumed_set_point' AS float8) - CAST (d.STABILITY_DATA ->> 'average' AS float8)) < $6
                    AND
                        CAST (d.STABILITY_DATA ->> 'assumed_set_point' AS float8) = $7
                    ORDER BY
                        TIMESTAMP DESC
                LIMIT 1) a;
        `, [reference, type, startTime, stabilityCriteria.slope, stabilityCriteria.standardDeviation, stabilityCriteria.difference, setPoint]);
    },
    getDataInTimeRange: (startTime: Date, endTime: Date) => {
        return executeQuery(rollingDataPool, `
            SELECT
                TIMESTAMP,
                DEVICES_UNDER_TEST,
                SUPER_DAQ_DATA,
                ROTRONIC_DATA,
                LAB_HUMIDITY,
                LAB_TEMPERATURE,
                REFERENCE_DATA
            FROM
                ROLLING_DATA
            WHERE
                TIMESTAMP BETWEEN $1 AND $2
            ORDER BY
                TIMESTAMP DESC
        `, [startTime, endTime]);
    },
    addSensorReadings: (sensorReadings: any[]) => {
        return executeQuery(rollingDataPool, format(`
            INSERT INTO
                SENSOR_READINGS (
                    TIMESTAMP,
                    SENSOR_ID,
                    TYPE,
                    VALUE,
                    BATTERY_LEVEL
                )
            VALUES
                %L
        `), [sensorReadings]);
    },
}

export default rollingData;