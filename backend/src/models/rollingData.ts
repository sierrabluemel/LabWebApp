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
                pending_change,
                EXTRACT(EPOCH FROM timestamp - lag(timestamp) OVER (PARTITION BY sensor_id, type ORDER BY timestamp))::int AS heartbeat
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
    getGeneratorStatuses: () => {
        return executeQuery(rollingDataPool, `
            SELECT
                *
            FROM
                generator_status;
        `, []);
    },
    createGeneratorCommand: (commandType: string, assetTag: string, value: string) => {
        return executeQuery(rollingDataPool, `
            INSERT INTO
                generator_commands
            (command_type, asset_tag, value)
            VALUES
            ($1, $2, $3);
        `, [commandType, assetTag, value]);
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
            AND
                timestamp < now() - interval '90 second'
            ORDER BY
                timestamp DESC
            LIMIT 1;
        `, [setPoint, stabilityCriteria.slope, stabilityCriteria.standardDeviation, stabilityCriteria.difference, assetTag, startTime]);
    },
    // Same four conditions as getStableTime so the indicator and the reading button agree.
    // last_unstable is the newest row that failed them; the current stable run starts right after it.
    getStableSince: (startTime: Date, assetTag: string, type: string, setPoint: number, stabilityCriteria: any) => {
        return executeQuerySingleReturn(rollingDataPool, `
            SELECT
                MAX(timestamp) FILTER (WHERE NOT (
                    assumed_set_point = $1
                    AND slope <= $2
                    AND standard_deviation <= $3
                    AND assumed_set_point - average < $4
                )) AS last_unstable,
                MAX(timestamp) AS last_reading,
                (array_agg(average ORDER BY timestamp DESC))[1] AS reference_average
            FROM
                reference_readings
            WHERE
                asset_tag = $5
            AND
                type = $6
            AND
                timestamp > $7;
        `, [setPoint, stabilityCriteria.slope, stabilityCriteria.standardDeviation, stabilityCriteria.difference, assetTag, type, startTime]);
    },
    getSensorsInRange: (startTime: Date, sensorIds: any[], type: string, referenceValue: number, tolerance: number) => {
        return executeQuery(rollingDataPool, `
            SELECT
                sensor_id::bigint AS sensor_id,
                bool_and(abs(value - $1) <= $2) AS in_range,
                max(value) - min(value) <= $2 AS settled,
                avg(value)::double precision AS average,
                min(timestamp) - $5 <= interval '30 seconds' AS covered,
                count(*)::int AS readings
            FROM
                sensor_readings
            WHERE
                sensor_id = ANY($3::bigint[])
            AND
                type = $4
            AND
                timestamp > $5
            GROUP BY
                sensor_id;
        `, [referenceValue, tolerance, sensorIds, type, startTime]);
    },
    getDataInTimeRange: (startTime: Date, endTime: Date, sensorIds: any[]) => {
        return executeQuery(rollingDataPool, `
            SELECT
                *
            FROM
                sensor_readings
            WHERE
                timestamp BETWEEN $1 AND $2
            AND
                sensor_id = ANY($3::bigint[])
            ORDER BY
                timestamp DESC
        `, [startTime, endTime, sensorIds])
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
