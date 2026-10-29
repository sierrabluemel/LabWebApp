import pg, { Pool } from "pg";
import config from "./config"

// Configure db connections
pg.types.setTypeParser(20, (val) => parseInt(val, 10))
// timestamp-without-tz columns (api_reading, api_order) hold UTC from now(); read them as UTC instead of the host's local time
pg.types.setTypeParser(1114, (val) => new Date(val + 'Z'))
let pool = new Pool(config.STATUS == "production" ? config.PROD_DB_CONNECTION : config.DEV_DB_CONNECTION);
let rollingDataPool = new Pool(config.ROLLING_DATA_CONNECTION);

const QUERY_SECOND_THRESHOLD = 1


// Check database connection
function connectPool() {
    pool.connect()
        .then(() => {
            console.log(`Connected to ${config.STATUS} database!`);
        })
        .catch((err) => {
            console.error(err);
            pool.end();
            pool = new Pool(config.STATUS == "production" ? config.PROD_DB_CONNECTION : config.DEV_DB_CONNECTION);
            console.log(`Attempting to reconnect to ${config.STATUS} database!`);
            setTimeout(connectPool, 1000);
        })
}

function connectRollingPool() {
    rollingDataPool.connect()
        .then(() => {
            console.log('Connected to rolling data db!');
        })
        .catch((err) => {
            console.error(err);
            rollingDataPool.end();
            rollingDataPool = new Pool(config.ROLLING_DATA_CONNECTION);
            console.log(`Attempting to reconnect to rolling data db...`);
            setTimeout(connectRollingPool, 1000);
        })
}

function executeNonQuery(pool: Pool, query: string, data: any[]): Promise<void> {
    const start = new Date()
    return pool.query(query, data)
        .then((res) => {
            const executeTime = (new Date().getTime() - start.getTime()) / 1000
            if (executeTime > QUERY_SECOND_THRESHOLD)
                console.log(`query: ${query}\nexecuteNonQuery took: ${executeTime} seconds`)
            return;
        })
}

function executeQuerySingleReturn(pool: Pool, query: string, data: any[]): Promise<any> {
    const start = new Date()
    return pool.query(query, data)
        .then((res) => {
            const executeTime = (new Date().getTime() - start.getTime()) / 1000
            if (executeTime > QUERY_SECOND_THRESHOLD)
                console.log(`query: ${query}\nexecuteQuerySingle took: ${executeTime} seconds`)
            return res.rows.length > 0 ? res.rows[0] : null;
        })
}

function executeQuery(pool: Pool, query: string, data: any[]): Promise<any[]> {
    const start = new Date()
    return pool.query(query, data)
        .then((res) => {
            const executeTime = (new Date().getTime() - start.getTime()) / 1000
            if (executeTime > QUERY_SECOND_THRESHOLD)
                console.log(`query: ${query}\nexecuteQuery took: ${executeTime} seconds and returned ${res.rows.length} rows`)
            return res.rows;
        })
}

function parseDataBaseDate(date: string | Date) {
    if (typeof date === "string")
        date = new Date(date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

connectPool();
connectRollingPool();

export { pool, rollingDataPool, executeNonQuery, executeQuerySingleReturn, executeQuery, parseDataBaseDate }