import { executeNonQuery, executeQuery, executeQuerySingleReturn, pool, rollingDataPool } from "../utils/db";

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
    getDataSinceTime: (startTime: Date) => {
        return executeQuery(rollingDataPool, `
            SELECT
                *
            FROM
                ROLLING_DATA
            WHERE
                TIMESTAMP >= $1
            ORDER BY
                TIMESTAMP DESC
        `, [startTime]);
    },
    getHumidityDataInTimeRange: (startTime: Date, endTime: Date) => {
        return executeQuery(rollingDataPool, `
            SELECT
                TIMESTAMP,
                DEVICES_UNDER_TEST,
                ROTRONIC_DATA
            FROM
                ROLLING_DATA
            WHERE
                TIMESTAMP BETWEEN $1 AND $2
            ORDER BY
                TIMESTAMP DESC
        `, [startTime, endTime]);
    },
    getTemperatureDataInTimeRange: (startTime: Date, endTime: Date) => {
        return executeQuery(rollingDataPool, `
            SELECT
                TIMESTAMP,
                DEVICES_UNDER_TEST,
                SUPER_DAQ_DATA
            FROM
                ROLLING_DATA
            WHERE
                TIMESTAMP BETWEEN $1 AND $2
            ORDER BY
                TIMESTAMP DESC
        `, [startTime, endTime]);
    },
}

export default rollingData;