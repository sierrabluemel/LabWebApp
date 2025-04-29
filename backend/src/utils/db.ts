import { Pool } from "pg";
import config from "./config"

// Configure db connections
let pool = new Pool(config.STATUS == "production" ? config.PROD_DB_CONNECTION : config.DEV_DB_CONNECTION);
let rollingDataPool = new Pool(config.ROLLING_DATA_CONNECTION);


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
    return pool.query(query, data)
        .then((res) => {
            return;
        })
}

function executeQuerySingleReturn(pool: Pool, query: string, data: any[]): Promise<any> {
    return pool.query(query, data)
        .then((res) => {
            return res.rows.length > 0 ? res.rows[0] : null;
        })
}

function executeQuery(pool: Pool, query: string, data: any[]): Promise<any[]> {
    return pool.query(query, data)
        .then((res) => {
            return res.rows;
        })
}

connectPool();
connectRollingPool();

export { pool, rollingDataPool, executeNonQuery, executeQuerySingleReturn, executeQuery }