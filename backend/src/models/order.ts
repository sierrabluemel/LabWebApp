import { executeNonQuery, executeQuery, executeQuerySingleReturn, pool } from "../utils/db";

const order = {
    createOrder: (receivedTimestamp: string, customerOrderNumber: string, customerId: number, expedited: boolean) => {
        return executeQuerySingleReturn(pool, `
            INSERT INTO
                API_ORDER (
                    RECEIVED_TIMESTAMP,
                    CUSTOMER_ORDER_NUMBER,
                    CUSTOMER_ID,
                    EXPEDITED
                )
            VALUES
                ($1, $2, $3, $4)
            RETURNING
                *
        `, [receivedTimestamp, customerOrderNumber, customerId, expedited]);
    },
    getOrderById: (orderId: number) => {
        return executeQuerySingleReturn(pool, `
            SELECT
                *
            FROM
                API_ORDER
            WHERE
                ORDER_ID = $1
        `, [orderId]);
    },
    getOrdersToShip: () => {
        return executeQuery(pool, `
            SELECT
                API_ORDER.ORDER_ID,
                API_ORDER.CUSTOMER_ORDER_NUMBER,
                API_ORDER.RECEIVED_TIMESTAMP,
                API_ORDER.EXPEDITED,
                (
                    SELECT
                        COUNT(*)
                    FROM
                        API_BATCH
                        JOIN API_SENSOR ON API_SENSOR.BATCH_ID = API_BATCH.BATCH_ID
                    WHERE
                        API_BATCH.ORDER_ID = API_ORDER.ORDER_ID
                ) AS SENSOR_COUNT
            FROM
                API_ORDER
            WHERE
                API_ORDER.ACTIVE = TRUE
                AND NOT EXISTS (
                    SELECT
                        1
                    FROM
                        API_BATCH
                    WHERE
                        API_BATCH.ORDER_ID = API_ORDER.ORDER_ID
                        AND API_BATCH.ACTIVE = TRUE
                )
        `, []);
    },
    setOrderShipped: (orderId: number, courier: string, timestamp: string) => {
        return executeQuery(pool, `
            UPDATE API_ORDER
            SET
                SHIPPED = TRUE,
                SHIPPED_TIMESTAMP = $1,
                COURIER = $2
            WHERE
                ORDER_ID = $3
            RETURNING
                *
        `, [timestamp, courier, orderId]);
    },
    setOrderActiveState: (orderId: number, status: boolean) => {
        return executeNonQuery(pool, `
            UPDATE API_ORDER
            SET
                ACTIVE = $1
            WHERE
                ORDER_ID = $2
        `, [status, orderId]);
    },
    deleteOrder: (orderId: number) => {
        return executeQuery(pool, `
            DELETE FROM API_ORDER
            WHERE
                ORDER_ID = $1
            RETURNING
                *
        `, [orderId]);
    },
    getOrderDetails: (orderId: number) => {
        return executeQuerySingleReturn(pool, `
            SELECT
                API_ORDER.*,
                API_BATCH.CALIBRATION_PROCEDURE_ID,
                API_TECHNICIAN.FIRST_NAME,
                API_TECHNICIAN.LAST_NAME,
                API_CUSTOMER.*
            FROM
                API_ORDER
                JOIN API_CUSTOMER ON API_ORDER.CUSTOMER_ID = API_CUSTOMER.CUSTOMER_ID
                JOIN API_BATCH ON API_ORDER.ORDER_ID = API_BATCH.ORDER_ID
                JOIN API_TECHNICIAN ON API_BATCH.SHIPPING_TECHNICIAN_ID = API_TECHNICIAN.TECHNICIAN_ID
            WHERE
                API_ORDER.ORDER_ID = $1;
        `, [orderId]);
    },
    getSensorsByOrderId: (orderId: number) => {
        return executeQuery(pool, `
            SELECT
                api_sensor.sensor_id
            FROM
                api_order
                INNER JOIN api_batch ON api_order.order_id = api_batch.order_id
                INNER JOIN api_sensor ON api_batch.batch_id = api_sensor.batch_id
            WHERE
                api_order.order_id = $1;
        `, [orderId]);
    }
};

export default order;