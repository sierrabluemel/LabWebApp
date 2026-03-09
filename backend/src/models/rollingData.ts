import { executeNonQuery, executeQuery, executeQuerySingleReturn, rollingDataPool } from "../utils/db";
import format from 'pg-format';

const rollingData = {
    getOnlineSensors: (sensorIds: number[]) => {
        return executeQuery(rollingDataPool, `
            SELECT DISTINCT 
                sensor_id
            FROM
                sensor_readings
            WHERE
                timestamp >= NOW() - INTERVAL '2 hour'
            AND
                sensor_id = ANY($1::bigint[])
        `, [sensorIds]);
    },
    getRecentData: () => {
        return executeQuerySingleReturn(rollingDataPool, `
            SELECT *
            FROM (
                SELECT
                    *,
                    ROW_NUMBER() OVER (
                        PARTITION BY sensor_id, type
                        ORDER BY timestamp DESC
                    ) AS rn
                FROM sensor_readings
            ) t
            WHERE rn <= 2
            ORDER BY sensor_id, type, timestamp DESC;
        `, []);
    },
    getLastSensorReadings: (sensorIds: number[]) => {
        return executeQuery(rollingDataPool, `
            SELECT DISTINCT ON (sensor_id, type)
                timestamp,
                sensor_id::bigint AS sensor_id,
                type,
                value,
                battery_level::double precision as battery_level,
                pending_change
            FROM
                sensor_readings
            WHERE
                timestamp >= NOW() - INTERVAL '3 hours'
            AND
                sensor_id = ANY($1::bigint[])
            ORDER BY 
                sensor_id, type, timestamp DESC;
        `, [sensorIds]);
    },
    getLastTwoSensorReadings: (sensorIds: number[]) => {
        return executeQuery(rollingDataPool, `
            SELECT *
            FROM (
                SELECT *,
                    ROW_NUMBER() OVER (
                        PARTITION BY sensor_id, type
                        ORDER BY timestamp DESC
                    ) AS rn
                FROM sensor_readings
            ) sub
            WHERE 
                rn <= 2
            AND
                timestamp >= NOW() - INTERVAL '3 hours'
            AND
                sensor_id = ANY($1::bigint[])
            ORDER BY 
                sensor_id, type, timestamp DESC;`, [sensorIds]);
    },
    getLastReferenceReadings: () => {
        return executeQuery(rollingDataPool, `
            SELECT DISTINCT ON (asset_tag, type)
                *
            FROM
                reference_readings
            WHERE 
                timestamp >= NOW() - INTERVAL '3 hours'
            ORDER BY 
                asset_tag, type, timestamp DESC;
        `, []);
    },
    getStableTime: (startTime: Date, assetTag: string, setPoint: number, stabilityCriteria: any) => {
        return executeQuerySingleReturn(rollingDataPool, `
            SELECT
                timestamp
            FROM
                reference_readings
            WHERE
                assumed_set_point = $1
            AND
                slope <= $2
            AND
                standard_deviation <= $3
            AND
                assumed_set_point - average < $4
            AND
                asset_tag = $5
            AND
                timestamp > $6
            ORDER BY
                timestamp DESC
            LIMIT 1;
        `, [setPoint, stabilityCriteria.slope, stabilityCriteria.standardDeviation, stabilityCriteria.difference, assetTag, startTime]);
    },
    getDataInTimeRange: (startTime: Date, endTime: Date) => {
        return executeQuery(rollingDataPool, `
            SELECT
                *
            FROM
                sensor_readings
            WHERE
                timestamp BETWEEN $1 AND $2
            ORDER BY
                timestamp DESC
        `, [startTime, endTime])
            .then(sensor_readings => {
                return executeQuery(rollingDataPool, `
            SELECT
                *
            FROM
                reference_readings
            WHERE
                timestamp BETWEEN $1 AND $2
            ORDER BY
                timestamp DESC
        `, [startTime, endTime])
                    .then(reference_readings => {
                        return {
                            reference_readings,
                            sensor_readings
                        }
                    })
            })
    },
    addSensorReadings: (sensorReadings: any[]) => {
        if (!sensorReadings || sensorReadings.length === 0) return Promise.resolve();

        return executeNonQuery(rollingDataPool, format(`
            INSERT INTO
                SENSOR_READINGS (
                    TIMESTAMP,
                    SENSOR_ID,
                    TYPE,
                    VALUE,
                    BATTERY_LEVEL,
                    PENDING_CHANGE
                )
            VALUES
                %L
        `, sensorReadings), []);
    },
}

export default rollingData;
