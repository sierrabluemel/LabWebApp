const express = require('express');
const request = require('request');
const { BlobServiceClient } = require("@azure/storage-blob");
const { Pool } = require('pg');
const cors = require('cors');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const QRCode = require('qrcode');
const fetch = require('node-fetch');
require('dotenv').config();
const PDFMerger = require('pdf-merger-js');
const handlebars = require('handlebars');
const sgMail = require('@sendgrid/mail');
const format = require('pg-format');
const { hashAndValidatePassword, verify } = require("./src/utils/hash-user");
const path = require("path");
const synchFetch = require('sync-fetch');
const {
    generateTokens,
    generateToken,
    decode,
    verify: verifyToken,
} = require("./src/utils/jwt");

const azureConnectionString = process.env.AZURE_CONNECTION_STRING;
const monnitSecretKey = process.env.IMONNIT_API_SECRET_KEY_ID;
const monnitKey = process.env.IMONNIT_API_KEY_ID;
const headers = {
    'APIKeyID': monnitKey,
    'APISecretKey': monnitSecretKey,
};

let ip;
let databaseConnection;
let port;
if (process.env.STATUS === 'production') {
    ip = process.env.PROD_IP;
    databaseConnection = process.env.PROD_DB_CONNECTION;
    port = process.env.PROD_PORT;
} else {
    ip = process.env.DEV_IP;
    databaseConnection = process.env.DEV_DB_CONNECTION;
    port = process.env.DEV_PORT;
};

const pool = new Pool(JSON.parse(databaseConnection));
const rollingDataPool = new Pool(JSON.parse(process.env.ROLLING_DATA_CONNECTION));

let currentSensorData = [];

// Check database connection
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error connecting to database', err.stack);
    }
    console.log('Connected to database!');
    release();
})
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();
app.locals.pool = pool;
app.use(cors({
    origin: ['https://technicianportal.sensorcalibrations.com', '*'],
    optionsSuccessStatus: 200,
    credentials: true,
    
}));
app.options('*', cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.listen(port, ip, () => {
    console.log(`Server running at https://${ip}:${port}/`);
});

app.use('*', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', true);
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.header('Access-Control-Expose-Headers', 'Access-Token');
    next();
});

app.post("/api/webhook", async (req, res) => {
    const sensorData = req.body.sensorMessages;
    res.status(200).send('Data receieved');
    currentSensorData = addSensorData(sensorData, currentSensorData);
})

app.post("/api/auth/sign-in", async (req, res) => {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM "user" WHERE email = $1', [
        email,
    ]);
    const user = result.rows[0];
    if (!user) {
        return res.status(404).json({ error: `User not found` });
    }

    if (!user.isVerified) {
        return res.status(403).json({ error: `User has not been verified` });
    }

    const isComparePassword = await verify(password, user.password);

    if (!isComparePassword) {
        return res
            .status(400)
            .json({ error: `Username and password are not correct` });
    }

    delete user.password;
    const { accessToken, refreshToken } = generateTokens(
        user,
        process.env.JWT_SECRET_KEY
    );
    res.setHeader("access-token", accessToken);
    res.setHeader("refresh-token", refreshToken);
    res.status(200).json(user);
});

app.post("/api/auth/sign-up", async (req, res) => {
    const { email, password, lastName, firstName } = req.body;
    const result = await pool.query('SELECT * FROM "user" WHERE email = $1', [
        email,
    ]);
    if (result.rows[0]) {
        return res.status(409).json({ error: `User with that email already exists` });
    }

    const hashPass = await hashAndValidatePassword(
        password,
        Number(process.env.SALT_ROUNDS || 10)
    );
    try {
        const result = await pool.query(
            'INSERT INTO "user" ("firstName", "lastName", "email", "password") VALUES ($1, $2, $3, $4) RETURNING *',
            [firstName, lastName, email, hashPass]
        );
        const user = result.rows[0];
        const userConfirmationToken = {
            id: user.id,
            email: user.email,
        };

        try {
            const token = generateToken(
                userConfirmationToken,
                process.env.JWT_SECRET_KEY,
                "30m"
            );
            console.log('token :>> ', token);
            await sendMailVerification("VERIFICATION_ACCOUNT", {
                email,
                token,
            });
        } catch (error) {
            return res.status(500).json(error);
        }

        delete user.password;
        return res.status(201).json(user);
    } catch (error) {
        return res.status(500).json(error);
    }
});

app.post("/api/auth/verify", async (req, res) => {
    const { token } = req.body;
    const tokenDecode = verifyToken(token, process.env.JWT_SECRET_KEY);
    await pool.query(
        'UPDATE "user" SET "isVerified" = $1 WHERE "id" = $2 RETURNING *',
        [true, tokenDecode.id]
    );
    return res.status(200).json({ message: 'Success' })
});

app.post("/api/auth/resend-verify-email", async (req, res) => {
    const { email } = req.body;
    const result = await pool.query('SELECT * FROM "user" WHERE email = $1', [
        email,
    ]);
    const user = result.rows[0];
    if (!user) {
        return res.status(404).json({ error: `User not found` });
    }

    const userConfirmationToken = {
        id: user.id,
        email: user.email,
    };

    const token = generateToken(
        userConfirmationToken,
        process.env.JWT_SECRET_KEY,
        "30m"
    );
    try {
        await sendMailVerification("VERIFICATION_ACCOUNT", {
            email,
            token,
        });
    } catch (error) {
        return res.status(500).json(error);
    }
    return res.status(200).json({
        message:
            "Email sent successfully. Please check your email for further instructions.",
    });
});

app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    const result = await pool.query('SELECT * FROM "user" WHERE email = $1', [
        email,
    ]);
    const user = result.rows[0];
    if (!user) {
        return res.status(404).json({ error: `User not found` });
    }

    const userConfirmationToken = {
        id: user.id,
        email: user.email,
    };

    const token = generateToken(
        userConfirmationToken,
        process.env.JWT_SECRET_KEY,
        "30m"
    );
    try {
        await sendMailVerification("FORGOT_PASSWORD", {
            email,
            token,
        });
    } catch (error) {
        return res.status(500).json(error);
    }
    return res.status(200).json({
        message:
            "Password reset request successfully processed. Please check your email for further instructions.",
    });
});

app.post("/api/auth/resend-forgot-password-email", async (req, res) => {
    const { email } = req.body;
    const result = await pool.query('SELECT * FROM "user" WHERE email = $1', [
        email,
    ]);
    const user = result.rows[0];
    if (!user) {
        return res.status(404).json({ error: `User not found` });
    }

    const userConfirmationToken = {
        id: user.id,
        email: user.email,
    };

    const token = generateToken(
        userConfirmationToken,
        process.env.JWT_SECRET_KEY,
        "30m"
    );
    try {
        await sendMailVerification("FORGOT_PASSWORD", {
            email,
            token,
        });
    } catch (error) {
        return res.status(500).json(error);
    }
    return res.status(200).json({
        message:
            "Password reset request successfully processed. Please check your email for further instructions.",
    });
});

app.post("/api/auth/verify-reset-password", async (req, res) => {
    const { email } = decode(
        req.headers.authorization?.replace("Bearer ", "") || ""
    );

    const result = await pool.query('SELECT * FROM "user" WHERE email = $1', [
        email,
    ]);
    const user = result.rows[0];
    if (!user) {
        return res.status(404).json({ error: `User not found` });
    }
    const hashPass = await hashAndValidatePassword(
        req.body.newPassword,
        Number(process.env.SALT_ROUNDS || 10)
    );
    try {
        const result = await pool.query(
            'UPDATE "user" SET "password" = $1 WHERE "id" = $2 RETURNING *',
            [hashPass, user.id]
        );
        const userUpdated = result.rows[0];
        delete userUpdated.password;
        return res.status(200).json(userUpdated);
    } catch (error) {
        return res.status(500).json(error);
    }
});

app.get("/api/users/me", auth, async (req, res) => {
    const { user } = req;
    const result = await pool.query(
        `
        SELECT "id", "firstName", "lastName", "email", "phone", "shippingAddress", "city", "state", "country", "zipCode", "type"
        FROM "user"  WHERE id = $1 LIMIT 1
    `,
        [user.id]
    );
    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(result.rows[0]);
});

app.get("/api/request-quotes", auth, async (req, res) => {
    const { user } = req;
    const result = await pool.query(
        `
        SELECT rq.*, json_agg(rqi) AS "requestQuoteItems"
        FROM "request-quote"  rq
        LEFT JOIN "request-quote-item"  rqi ON rq.id = rqi."requestQuoteId"
        WHERE rq."createdById" = $1
        GROUP BY rq.id, rq."createdAt"
        ORDER BY rq."createdAt" desc
    `,
        [user.id]
    );
    return res.status(200).json(result.rows);
});

app.post("/api/request-quotes", auth, async (req, res) => {
    const { user } = req;
    const { name, email, phone, company, address1, address2, items } = req.body;
    pool.connect(async (err, client, release) => {
        try {
            await client.query("BEGIN");
            const result = await pool.query(
                'INSERT INTO "request-quote" ("name", "email", "phone", "company", "address1", "address2", "createdById") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [name, email, phone, company, address1, address2, user.id]
            );

            const requestQuoteCreated = result.rows[0];
            const itemsInsertPayload = items.map((data) => [
                data.calibrationType,
                data.manufacturer,
                data.modelNo,
                data.serial,
                data.calibrationLevel,
                data.interval,
                data.qty,
                data.comment,
                requestQuoteCreated.id,
            ]);

            const itemsCreated = await client.query(
                format(
                    'INSERT INTO "request-quote-item" ("calibrationType", "manufacturer", "modelNo", "serial", "calibrationLevel", "interval", "qty", "comment", "requestQuoteId") VALUES %L RETURNING *',
                    itemsInsertPayload
                )
            );
            await client.query("COMMIT");
            return res
                .status(201)
                .json({ ...requestQuoteCreated, requestQuoteItems: itemsCreated.rows });
        } catch (error) {
            await client.query("ROLLBACK");
            return res.status(500).send(error);
        } finally {
            release();
        }
    });
});

app.get('/api/get-recent-data', (req, res) => {
    rollingDataPool.query('SELECT * FROM rolling_data ORDER BY timestamp DESC LIMIT 1', (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const data = result.rows;
        res.json(data);
    })
});

app.get('/api/get-sensor-data', (req, res) => {
    res.json(currentSensorData).status(200);
    currentSensorData = [];
});

app.get('/api/get-calibrations-by-month', (req, res) => {
    const startDate = new Date(req.query.start_date);

    let endDate = new Date(startDate.getTime());
    endDate = new Date(endDate.setMonth(endDate.getMonth() + 1));

    pool.query(`SELECT * FROM api_order
                INNER JOIN api_batch
                ON api_order.order_id = api_batch.order_id
                INNER JOIN api_sensor
                ON api_batch.batch_id = api_sensor.batch_id
                INNER JOIN api_interaction_log
                ON api_batch.batch_id = api_interaction_log.batch_id
                WHERE shipping_end > $1
                AND shipping_end < $2
                AND api_sensor.certificate_id IS NOT NULL`, [startDate, endDate], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const data = result.rows;
        res.json(data);
    })
});

app.get('/api/get-online-sensors', (req, res) => {
    const url = `https://www.imonnit.com/json/SensorList/`;
    const parseDate = (date) => {
        if (date == null) {
            return null;
        };
        const strippedDate = date.replace('/Date(', '').replace(')/', '');
        return new Date(parseInt(strippedDate));
    }
    const parseLastCheckIn = (lastCommunication, minutes = 5) => {
        if (lastCommunication == null) {
            return false;
        }
        if (Math.abs(new Date().getTime() - lastCommunication.getTime()) < minutes * 60000) {
            return true;
        }
        return false;
    }

    const data = monnitFetch(url);
    sensorList = [];
    for (const sensor of data.Result) {
        const lastCheckIn = parseDate(sensor.LastCommunicationDate)
        if (parseLastCheckIn(lastCheckIn)) {
            sensorList.push(sensor.SensorID)
        }
    }
    res.json(sensorList)
});

app.get('/api/get-bulk-data', (req, res) => {
    let minutes = req.query.minutes;
    if (!minutes) {
        minutes = '10';
    }
    const start = new Date(Date.now() - minutes * 60000);

    rollingDataPool.query('SELECT * FROM rolling_data WHERE timestamp >= $1 ORDER BY timestamp DESC', [start], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const data = result.rows;
        res.json(data);
    })
});


app.get('/api/get-last-humidity-stable-reading', (req, res) => {
    let type = req.query.type;
    let minutes = req.query.minutes;
    let reference = req.query.reference;
    let setPoint = req.query.set_point;
    if (!type) {
        type = 'humidity'
    }
    if (!minutes) {
        minutes = 180;
    }
    if (!reference) {
        reference = 'S000119';
    }
    if (setPoint) {
        setPoint = parseInt(setPoint);
    }
    const start = new Date(Date.now() - minutes * 60000);

    rollingDataPool.query(`SELECT rotronic_data, timestamp FROM rolling_data WHERE timestamp >= $1 ORDER BY timestamp DESC`, [start], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        let data = [];
        for (const row of result.rows) {
            if (row.rotronic_data[reference]) {
                data.push([row.rotronic_data[reference]['stability_data'][type], row['timestamp']])
            }
        }
        for (const row of data) {
            if (row[0].stable) {
                if (setPoint) {
                    if (row[0].assumed_set_point === setPoint) {
                        res.json(row);
                        return;
                    }
                } else {
                    res.json(row);
                    return;
                }
            }
        }
        res.json({ 'Result': `Unable to find stable data for set point ${setPoint}` });
    })
});


app.get('/api/get-last-temperature-stable-reading', (req, res) => {
    let minutes = req.query.minutes;
    let reference = req.query.reference;
    let setPoint = req.query.set_point;
    let stabilityCriteria = JSON.parse(req.query.stability_criteria)
    if (!minutes) {
        minutes = 180;
    }
    if (setPoint) {
        setPoint = parseInt(setPoint);
    }
    const start = new Date(Date.now() - minutes * 60000);
    rollingDataPool.query(`SELECT super_daq_data, timestamp FROM rolling_data WHERE timestamp >= $1 ORDER BY timestamp DESC`, [start], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        for (const row of result.rows) {
            const reference_data = row.super_daq_data[reference];
            if (reference_data && 'stability_data' in reference_data) {
                const stabilityData = reference_data.stability_data;
                if (stabilityData.slope < stabilityCriteria.slope && stabilityData.standard_deviation < stabilityCriteria.standardDeviation && Math.abs(stabilityData.assumed_set_point - stabilityData.average) < stabilityCriteria.difference && stabilityData.assumed_set_point === setPoint) {
                    res.json([stabilityData, row.timestamp]);
                    return;
                }
            }
        }
        res.json({ 'Result': `Unable to find stable data for set point ${setPoint}` });
    })
});


app.get('/api/get-humidity-reading-range', (req, res) => {
    let seconds = req.query.seconds;
    let timestamp = req.query.timestamp;

    if (!seconds) {
        seconds = 30;
    }
    if (timestamp) {
        timestamp = new Date(timestamp).getTime();
    }
    const start = new Date(timestamp - (seconds * 1000));
    const end = new Date(start.getTime() - (seconds * 1000));

    rollingDataPool.query(`SELECT timestamp, devices_under_test, rotronic_data FROM rolling_data WHERE timestamp BETWEEN $1 AND $2 ORDER BY timestamp DESC`, [end, start], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const data = result.rows;
        res.json(data);
    })
});


app.get('/api/get-temperature-reading-range', (req, res) => {
    let seconds = req.query.seconds;
    let timestamp = req.query.timestamp;

    if (!seconds) {
        seconds = 30;
    }
    if (timestamp) {
        timestamp = new Date(timestamp).getTime();
    }
    const start = new Date(timestamp - (seconds * 1000));
    const end = new Date(start.getTime() - (seconds * 1000));

    rollingDataPool.query(`SELECT timestamp, devices_under_test, super_daq_data FROM rolling_data WHERE timestamp BETWEEN $1 AND $2 ORDER BY timestamp DESC`, [end, start], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const data = result.rows;
        res.json(data);
    })
});


app.get('/api/get-order-by-id', (req, res) => {
    const orderId = req.query.order_id;

    pool.query('SELECT * FROM api_order WHERE order_id = $1', [orderId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const orders = result.rows;
        res.json(orders[0]);
    })
});


app.get('/api/get-orders-to-ship', (req, res) => {
    pool.query(`
        SELECT api_order.order_id, api_order.customer_order_number
        FROM api_order
        WHERE api_order.active = true
        AND NOT EXISTS (
            SELECT 1
            FROM api_batch
            WHERE api_batch.order_id = api_order.order_id
            AND api_batch.active = true
        )
    `, (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const orders = result.rows;
        res.json(orders);
    });
});


app.get('/api/get-orders-boxed', (req, res) => {
    pool.query(`SELECT api_order.*, sensor_id FROM api_order
                INNER JOIN api_batch
                ON api_order.order_id = api_batch.order_id
                INNER JOIN api_sensor
                ON api_sensor.batch_id = api_batch.batch_id
                WHERE api_order.shipped = false AND api_order.active = false`, (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const orders = result.rows;
        const orderNumbers = new Set(orders.map(order => order.order_id))
        const parsedOrders = []
        for (const orderNumber of orderNumbers) {
            const sensorList = orders.filter(order => order.order_id === orderNumber);
            sensorList[0].sensors = sensorList.length;
            delete sensorList[0].sensor_id;
            parsedOrders.push(sensorList[0]);
        }
        res.json(parsedOrders);
    });
});


app.get('/api/set-order-shipped', (req, res) => {
    const orderId = req.query.order_id;
    const name = req.query.name;
    const timestamp = new Date().toISOString()

    pool.query('UPDATE api_order SET shipped = true, shipped_timestamp = $1, courier = $2 WHERE order_id = $3 RETURNING *', [timestamp, name, orderId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const order = result.rows;
        res.json(order[0]);
    })
});


app.get('/api/get-batch-by-id', (req, res) => {
    const batchId = req.query.batch_id;

    pool.query('SELECT * FROM api_batch WHERE batch_id = $1', [batchId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const batches = result.rows;
        res.json(batches[0]);
    })
});

app.get('/api/get-batches-by-order-id', (req, res) => {
    const orderId = req.query.order_id;

    pool.query(`SELECT * FROM api_order INNER JOIN api_batch ON api_order.order_id = $1 WHERE api_batch.order_id = $1;`, [orderId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const batches = result.rows;
        res.json(batches);
    })
});

app.get('/api/get-batches', (req, res) => {
    pool.query('SELECT * FROM api_batch ORDER BY batch_id', (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const batches = result.rows;
        res.json(batches);
    })
});

app.get('/api/get-batches-by-active-state', (req, res) => {
    const active = req.query.active;


    pool.query('SELECT * FROM api_batch INNER JOIN api_order ON api_batch.order_id = api_order.order_id WHERE api_batch.active=$1 ORDER BY batch_id DESC', [active], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        let batches = result.rows;
        res.json(batches);
    });
});


app.get('/api/get-sensors', (req, res) => {
    const batchId = req.query.batch_id;
    let query;

    if (!batchId) {
        query = 'SELECT * FROM api_sensor'
    } else {
        query = `SELECT * FROM api_sensor WHERE batch_id = ${batchId}`
    }
    pool.query(query, (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const batches = result.rows;
        res.json(batches);
    })
});

app.get('/api/get-readings', (req, res) => {
    const sensors = req.query.sensors;
    const sensorIds = sensors.split(',').map(sensor => parseInt(sensor.trim()));

    pool.query('SELECT * FROM api_reading WHERE sensor_id = ANY($1::int[]) AND timestamp IS NOT NULL ORDER BY timestamp DESC', [sensorIds], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const readings = result.rows;
        res.json(readings);
    })
});

app.get('/api/search', (req, res) => {
    const filterData = req.query.filter_data;
    const table = req.query.table;

    const query =   `SELECT * FROM api_order
                    FULL JOIN api_batch ON api_order.order_id = api_batch.order_id
                    FULL JOIN api_sensor ON api_sensor.batch_id = api_batch.batch_id
                    FULL JOIN api_certificate ON api_certificate.sensor_id = api_sensor.sensor_id
                    FULL JOIN api_calibration_procedure ON api_batch.calibration_procedure_id = api_calibration_procedure.calibration_procedure_id
                    FULL JOIN api_interaction_log ON api_batch.batch_id = api_interaction_log.batch_id
                    WHERE ${table} = $1
                    ORDER BY api_batch.batch_id DESC;`
    
    pool.query(query, [filterData], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error getting data: ${err}` });
        }
        const data = result.rows;
        res.status(200).json(data);
    })
})

app.get('/api/get-readings-by-sensor-id', (req, res) => {
    const sensorId = req.query.sensor_id;

    pool.query('SELECT * FROM api_reading WHERE sensor_id = $1 ORDER BY reading_id DESC', [sensorId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const readings = result.rows;
        res.json(readings);
    })
});

app.get('/api/get-customer-by-id', (req, res) => {
    const customerId = req.query.customer_id;

    pool.query('SELECT * FROM api_customer WHERE customer_id = $1', [customerId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const customers = result.rows;
        res.json(customers[0]);
    })
});

app.get('/api/get-equipment', (req, res) => {
    pool.query('SELECT * FROM api_equipment', (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const equipment = result.rows;
        res.json(equipment);
    })
});

app.get('/api/get-calibration-procedures', (req, res) => {
    pool.query('SELECT * FROM api_calibration_procedure', (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const procedures = result.rows;
        res.json(procedures);
    })
});

app.get('/api/lookup-technician', (req, res) => {
    let technician = req.query.technician;

    pool.query('SELECT * FROM api_technician WHERE user_id = $1', [technician.id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const technician = result.rows;
        res.json(technician);
    })
});

app.get('/api/create-order', (req, res) => {
    let timestamp = req.query.received_timestamp;
    let customerOrderNumber = req.query.customer_order_number;
    let customerId = req.query.customer_id;

    if (!timestamp) {
        timestamp = new Date().toISOString();
    }
    if (!customerId) {
        customerId = 1;
    }

    pool.query("INSERT INTO api_order (received_timestamp, customer_order_number, customer_id) VALUES ($1, $2, $3) RETURNING *", [timestamp, customerOrderNumber, customerId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const order = result.rows;
        res.json(order);
    })
});

app.get('/api/create-batch', (req, res) => {
    let currentLocation = req.query.current_location;
    let orderId = req.query.order_id;
    let calibrationProcedureId = req.query.calibration_procedure_id;
    let receivingTechnicianId = req.query.receiving_technician_id;
    let testingTechnicianId = req.query.testing_technician_id;
    let shippingTechnicianId = req.query.shipping_technician_id;

    pool.query("INSERT INTO api_batch (current_location, order_id, calibration_procedure_id, receiving_technician_id, testing_technician_id, shipping_technician_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *", [currentLocation, orderId, calibrationProcedureId, receivingTechnicianId, testingTechnicianId, shippingTechnicianId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const batch = result.rows;
        res.json(batch);
    })
});

app.get('/api/create-reading', (req, res) => {
    let type = req.query.type;
    let setPoint = req.query.set_point;
    let referenceReading = req.query.reference_reading;
    let sensorReading = req.query.sensor_reading;
    let labRh = req.query.lab_rh;
    let labTemperature = req.query.lab_temperature;
    let sensorId = req.query.sensor_id;
    let generatorId = req.query.generator_id;
    let referenceId = req.query.reference_id;
    let uncertainty = req.query.uncertainty;
    let tolerance = req.query.tolerance;
    let pass = false;

    myList = [type, setPoint, referenceReading, sensorReading, labRh, labTemperature, sensorId, generatorId, referenceId, uncertainty, tolerance, pass]

    if (Math.abs(referenceReading - sensorReading) < tolerance) {
        pass = true;
    }
    if (!sensorReading) {
        sensorReading = null;
    }
    pool.query("INSERT INTO api_reading (type, set_point, reference_reading, sensor_reading, lab_rh, lab_temperature, sensor_id, generator_id, reference_id, uncertainty, tolerance, pass) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *", [type, setPoint, referenceReading, sensorReading, labRh, labTemperature, sensorId, generatorId, referenceId, uncertainty, tolerance, pass], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const reading = result.rows;
        res.json(reading);
    })
});


app.get('/api/set-batch-active-state', (req, res) => {
    const batchId = req.query.batch_id;
    const activeState = req.query.active_state;

    pool.query("UPDATE api_batch SET active = $1 WHERE batch_id = $2", [activeState, batchId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        return res.json({ 'Result': `Batch ${batchId} active state set to ${activeState}` })
    })
});


app.get('/api/remove-batch-location', (req, res) => {
    const batchId = req.query.batch_id;

    pool.query("UPDATE api_batch SET current_location = $1 WHERE batch_id = $2", [null, batchId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        return res.json({ 'Result': `Batch ${batchId} location removed` });
    })
});


app.get('/api/set-order-active-state', (req, res) => {
    const orderId = req.query.order_id;
    const activeState = req.query.active_state;

    pool.query("UPDATE api_order SET active = $1 WHERE order_id = $2", [activeState, orderId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        return res.json({ 'Result': `Order ${orderId} active state set to ${activeState}` })
    })
});

app.get('/api/create-location-log', (req, res) => {
    let location = req.query.location;
    let batchId = req.query.batch_id;
    let timestamp = req.query.timestamp;

    if (!timestamp) {
        timestamp = new Date().toISOString()
    }

    pool.query("UPDATE api_batch SET current_location = $1 WHERE batch_id = $2", [location, batchId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
    })

    pool.query("INSERT INTO api_location_log (location, timestamp, batch_id) VALUES ($1, $2, $3) RETURNING *", [location, timestamp, batchId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const locationLog = result.rows;
        res.json(locationLog);
    })
});

app.get('/api/calibrate-sensor', (req, res) => {
    let sensorId = req.query.sensor_id;
    let targetReading = req.query.target_reading;
    let url = `https://www.imonnit.com/json/SensorGetCalibration/`;
    let parameters = {
        'SensorID': sensorId,
    };

    let params = new URLSearchParams();
    for (const parameter in parameters) {
        params.append(parameter, parameters[parameter]);
    };

    const result = monnitFetch(`${url}?${params.toString()}`)
    url = `https://www.imonnit.com/json/SensorSetCalibration/`;
    parameters = result.Result;
    parameters.Calibration1 = parseInt(targetReading * 10);
    parameters.PushAutoCalibrateCommand = true;
    parameters.PushProfileConfig1 = false;
    parameters.PushProfileConfig2 = false;
    params = new URLSearchParams();
    for (const parameter in parameters) {
        params.append(parameter, parameters[parameter]);
    };

    const response = monnitFetch(`${url}?${params.toString()}`)
    return res.json(response);
});


app.get('/api/create-sensor', (req, res) => {
    let sensorId = req.query.sensor_id;
    let checkDigit = req.query.check_digit;
    let batchId = req.query.batch_id;
    let sku;
    const manufacturer = 'Monnit Corporation';
    let url = `https://www.imonnit.com/json/AssignSensor/`;
    const parameters = {
        'NetworkID': 94464,
        'SensorID': sensorId,
        'CheckDigit': checkDigit,
        'reportInterval': 1,
        'activeStateInterval': 1,
    };
    const params = new URLSearchParams();
    for (const parameter in parameters) {
        params.append(parameter, parameters[parameter]);
    };


    let response = monnitFetch(`${url}?${params.toString()}`)
    url = 'https://www.imonnit.com/json/SensorSetHeartbeat/'
    response = monnitFetch(`${url}?${params.toString()}`)
    url = 'https://www.imonnit.com/json/LookUpSensor/'
    response = monnitFetch(`${url}?${params.toString()}`)
    sku = response['Result']['SKU'];
    pool.query("INSERT INTO api_sensor (sensor_id, check_digit, manufacturer, sku, batch_id) VALUES ($1, $2, $3, $4, $5) RETURNING *", [sensorId, checkDigit, manufacturer, sku, batchId], (err, result) => {
        if (err) {
            if (err.message == `duplicate key value violates unique constraint "sensor_pkey"`) {
                pool.query("UPDATE api_sensor SET batch_id = $1 WHERE sensor_id = $2 RETURNING *", [batchId, sensorId], (err, result) => {
                    if (err) {
                        return res.status(500).json({ error: `Error executing query: ${err}` });
                    }
                    const sensor = result.rows;
                    res.json(sensor);
                });
            } else {
                console.error(err);
                res.json({ 'Error creating sensor on database': err });
            }
        } else {
            const sensor = result.rows;
            res.json(sensor);
        }
    });
});


app.get('/api/change-sensor-heartbeat', async (req, res) => {
    let sensorId = req.query.sensor_id;
    let reportInterval = req.query.heartbeat;
    if (Number.isNaN(parseInt(reportInterval))) {
        return res.json({ Result: 'Heartbeat must be a number' })
    }

    let url = `https://www.imonnit.com/json/SensorSetHeartbeat/`;
    const parameters = {
        'SensorID': sensorId,
        'reportInterval': reportInterval,
        'activeStateInterval': reportInterval,
    };
    const params = new URLSearchParams();
    for (const parameter in parameters) {
        params.append(parameter, parameters[parameter]);
    };
    try {
        const data = monnitFetch(`${url}?${params.toString()}`);
        res.json(data);
    } catch (error) {
        console.error(error);
        res.json({ 'Result': error });
    }
});

app.get('/api/get-certificates-by-order-id', (req, res) => {
    const orderId = req.query.order_id;
    pool.query(`SELECT * FROM api_order
                INNER JOIN api_batch
                ON api_batch.order_id = api_order.order_id
                INNER JOIN api_sensor
                ON api_sensor.batch_id = api_batch.batch_id
                INNER JOIN api_certificate
                ON api_certificate.certificate_id = api_sensor.certificate_id
                WHERE api_order.order_id = $1`, [orderId], (err, result) => {

        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const certificates = result.rows;
        res.json(certificates);
    })
})

app.get('/api/get-sensors-by-order-id', async (req, res) => {
    try {
        const orderId = req.query.order_id;
        let sensorSet = new Set();
        let seenSensorIds = new Set();
        const batchesResult = await pool.query(
            `SELECT * FROM api_order INNER JOIN api_batch ON api_order.order_id = $1 WHERE api_batch.order_id = $1;`,
            [orderId]
        );

        const batches = batchesResult.rows;

        for (const batch of batches) {
            const sensorsResult = await pool.query(
                `SELECT * FROM api_batch INNER JOIN api_sensor ON api_batch.batch_id = $1 WHERE api_sensor.batch_id = $1;`,
                [batch.batch_id]
            );

            const sensors = sensorsResult.rows;
            for (const sensor of sensors) {
                if (!seenSensorIds.has(sensor.sensor_id)) {
                    seenSensorIds.add(sensor.sensor_id);
                    sensorSet.add(sensor);
                }
            }
        }

        const sensorList = Array.from(sensorSet);
        res.json(sensorList);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: `Error executing query: ${err}` });
    }
});

app.get('/api/get-sensors-by-batch-id', (req, res) => {
    const batchId = req.query.batch_id;

    pool.query(`SELECT * FROM api_batch
                INNER JOIN api_sensor
                ON api_batch.batch_id = api_sensor.batch_id
                WHERE api_batch.batch_id = $1`, [batchId], (err, result) => {

        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const sensors = result.rows;
        res.json(sensors);
    })
})

app.get('/api/remove-sensor-from-batch', (req, res) => {
    const sensorId = req.query.sensor_id;

    pool.query(`UPDATE api_sensor
                SET batch_id = NULL
                WHERE sensor_id = $1;`, [sensorId], (err, result) => {

        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        res.json({ Result: 'Sensor successfully removed from batch' });
    })
})

app.get('/api/remove-sensor', (req, res) => {
    const sensorId = req.query.sensor_id;
    const checkDigit = req.query.check_digit

    let url = 'https://www.imonnit.com/json/SensorSetHeartbeat/'
    const parameters = {
        'NetworkID': 94464,
        'SensorID': sensorId,
        'CheckDigit': checkDigit,
        'reportInterval': 120,
        'activeStateInterval': 120,
    };

    const params = new URLSearchParams();
    for (const parameter in parameters) {
        params.append(parameter, parameters[parameter]);
    };

    let response = monnitFetch(`${url}?${params.toString()}`)
    url = `https://www.imonnit.com/json/RemoveSensor/`;

    response = monnitFetch(`${url}?${params.toString()}`)
    res.json(response)
});


app.get('/api/print-certificate-labels', async (req, res) => {
    const calibrationDate = req.query.calibration_date;
    const dueDate = req.query.due_date;
    const certificateNumber = req.query.certificate_number;
    if (process.env.STATUS === 'development') {
        res.json({ 'Result': `Failed: print disabled in test environment` });
        return;
    }
    let url = `http://localhost:4000/print-label/`;

    fetch(`${url}?calibration_date=${calibrationDate}&due_date=${dueDate}&certificate_number=${certificateNumber}`)
        .then(response => {
            res.json({ 'Result': JSON.stringify(response) })
        })
        .catch(error => {
            res.json({ 'Result': `Failed: ${error}` })
        })
});


app.get('/api/create-certificate', (req, res) => {
    const certificateJson = req.query.certificate_json
    const sensorId = req.query.sensor_id;
    const template = req.query.template;
    const dueDate = req.query.due_date;
    const calibrationDate = req.query.calibration_date;

    pool.query("INSERT INTO api_certificate (generate_certificate_json, template, sensor_id) values ($1, $2, $3) RETURNING *", [certificateJson, template, sensorId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const certificate = result.rows[0];
        pool.query("UPDATE api_sensor SET certificate_id = $1 WHERE sensor_id = $2 RETURNING *", [certificate.certificate_id, sensorId], (err, result) => {
            if (err) {
                return res.status(500).json({ error: `Error executing query: ${err}` });
            }
            let url = `https://www.imonnit.com/json/CalibrationCertificateCreate/`;
            const parameters = {
                'SensorID': sensorId,
                'DateCertified': calibrationDate,
                'CertificationExpirationDate': dueDate,
                'CalibrationFacilityID': 5,
                'CalibrationNumber': `MNT-${certificate.certificate_id}`,
            };
            const params = new URLSearchParams();
            for (const parameter in parameters) {
                params.append(parameter, parameters[parameter]);
            };


            const response = monnitFetch(`${url}?${params.toString()}`)
            res.json(certificate);

        })
    })
});


app.get('/api/log-batch-interaction', (req, res) => {
    const department = req.query.department;
    const start = req.query.start;
    const technicianId = req.query.technician_id;
    const batchId = req.query.batch_id;

    const timestamp = new Date().toISOString();
    const status = (start === 'true' || start === true) ? 'start' : 'end';
    const column1 = `${department}_${status}`;
    const column2 = `${department}_${status}_technician_id`;

    pool.query(`SELECT * FROM api_interaction_log WHERE batch_id = $1`, [batchId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        let query;

        if (result.rows[0]) {
            query = `UPDATE api_interaction_log SET ${column1} = $1, ${column2} = $2 WHERE batch_id = $3 RETURNING *`;
        } else {
            query = `INSERT INTO api_interaction_log (${column1}, ${column2}, batch_id) values ($1, $2, $3) RETURNING *`;
        }

        pool.query(query, [timestamp, technicianId, batchId], (err, result) => {
            if (err) {
                return res.status(500).json({ error: `Error executing query: ${err}` });
            }
            res.json(result.rows);
        })
    })
});


app.get('/api/update-batch-technician', (req, res) => {
    let department = req.query.department;
    let technicianId = req.query.technician_id;
    let batchId = req.query.batch_id;

    const query = `UPDATE api_batch SET ${department}_technician_id = $1 WHERE batch_id = $2 RETURNING *`

    pool.query(query, [technicianId, batchId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const updatedBatch = result.rows;
        res.json(updatedBatch);
    })
});


app.get('/api/update-certificate-json', (req, res) => {
    let certificateId = req.query.certificate_id;
    let certificateJson = req.query.certificate_json;

    pool.query("UPDATE api_certificate SET generate_certificate_json = $1 WHERE certificate_id = $2 RETURNING *", [certificateJson, certificateId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const certificate = result.rows;
        res.json(certificate);
    })
});

app.get('/api/generate-certificate', async (req, res) => {
    const certificateId = req.query.certificate_id;
    const upload = req.query.upload;
    const print = req.query.print;

    pool.query("SELECT * FROM api_certificate WHERE certificate_id = $1", [certificateId], async (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        if (!result.rows[0]) {
            return res.status(404).json({ error: `No certificates found with certificate id ${certificateId}` });
        }
        const certificate = result.rows[0];
        const certificateJson = { ...{ 'CertNumber': `MNT-${certificate.certificate_id}` }, ...certificate.generate_certificate_json };

        try {
            const bytes = await fillCertificate(certificate.template, certificateJson);
            if (upload && process.env.STATUS === 'production') {
                uploadPdfToAzure(bytes, `MNT-${certificate.certificate_id}.pdf`)
                    .catch((error) => {
                        console.error("Error uploading PDF:", error);
                        res.status(500).json({ error: "Error uploading PDF" })
                    });
            }
            if (print) {
                printPdf(bytes);
            }
            res.setHeader("Content-Disposition", `attachment; filename=MNT-${certificateId}.pdf`);
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(Buffer.from(bytes));
        } catch (error) {
            console.error("Error occurred:", error);
            res.status(500).json({ error: "An error occurred while processing the PDF." });
        }
    });
});

app.get('/api/generate-order-certificates', async (req, res) => {
    const orderId = req.query.order_id;
    const print = req.query.print;

    pool.query(`SELECT * FROM api_order
                INNER JOIN api_batch
                ON api_batch.order_id = api_order.order_id
                INNER JOIN api_sensor
                ON api_sensor.batch_id = api_batch.batch_id
                INNER JOIN api_certificate
                ON api_certificate.certificate_id = api_sensor.certificate_id
                WHERE api_order.order_id = $1
                ORDER BY api_certificate.certificate_id`, [orderId], async (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        if (!result.rows[0]) {
            return res.status(404).json({ error: `No certificates found under order id ${orderId}` });
        }
        const certificates = result.rows;
        let merger = new PDFMerger()
        for (const certificate of certificates) {
            const certificateJson = { ...{ 'CertNumber': `MNT-${certificate.certificate_id}` }, ...certificate.generate_certificate_json };
            const bytes = await fillCertificate(certificate.template, certificateJson);
            fs.writeFileSync('fileOutputs/certificate.pdf', bytes);
            await merger.add('fileOutputs/certificate.pdf');
        }
        const finalCertificates = await merger.saveAsBuffer();

        try {
            if (print) {
                printPdf(finalCertificates);
            }
            res.setHeader("Content-Disposition", `attachment; filename=${certificates[0].customer_order_number}Certificates.pdf`);
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(Buffer.from(finalCertificates));
        } catch (error) {
            console.error("Error occurred:", error);
            res.status(500).json({ error: "An error occurred while processing the PDF." });
        }
    });
});


app.get('/api/generate-return-record', async (req, res) => {
    const orderId = req.query.order_id;
    const print = req.query.print;

    pool.query(`SELECT api_order.*, api_batch.calibration_procedure_id, api_technician.first_name, api_technician.last_name, api_sensor.*, api_certificate.generate_certificate_json, api_customer.*
                FROM api_order
                JOIN api_customer ON api_order.customer_id = api_customer.customer_id
                JOIN api_batch ON api_order.order_id = api_batch.order_id
                JOIN api_sensor ON api_sensor.batch_id = api_batch.batch_id
                JOIN api_certificate ON api_sensor.certificate_id = api_certificate.certificate_id
                JOIN api_technician ON api_batch.shipping_technician_id = api_technician.technician_id
                WHERE api_order.order_id = $1;`, [orderId], async (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }

        let data;

        if (!result.rows[0]) {
            console.error('Unable to find data');
            return res.status(500).json({ 'Result': 'Unable to find data' });
        } else {
            data = result.rows[0];
            let date;
            data.shipped_timestamp ? date = new Date(data.shipped_timestamp) : date = new Date();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');

            const fields = {
                'date': `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`,
                'time': `${hours}:${minutes}:${seconds}`,
                'technician': `${data.first_name} ${data.last_name}`,
                'clientName': `${data.name}`,
                'address1': `${data.address_line_1}, ${data.address_line_2}`,
                'address2': `${data.city}, ${data.state} ${data.zip_code}`,
                'contactName': `${data.contact_name}`,
                'email': `${data.contact_email}`,
                'orderNumber': `${orderId}`,
                'shipVia': 'N/A',
                'shipDate': 'N/A',
                'trackingNumber': 'N/A',
                'notes': '',
                'scAddress1': '450 North, Flint Street',
                'scAddress2': 'Kaysville, Utah 84037'
            }
            const bytes = await fillForm('returnRecordTemplate.pdf', fields);

            pool.query(`SELECT api_order.customer_order_number, api_batch.calibration_procedure_id, api_sensor.*, api_certificate.generate_certificate_json
                        FROM api_order
                        JOIN api_batch ON api_order.order_id = api_batch.order_id
                        JOIN api_sensor ON api_sensor.batch_id = api_batch.batch_id
                        JOIN api_certificate ON api_sensor.certificate_id = api_certificate.certificate_id
                        WHERE api_order.order_id = $1;`, [orderId], async (err, result) => {
                if (err) {
                    return res.status(500).json({ error: `Error executing query: ${err}` });
                }
                const data = result.rows;
                const finishedFormBytes = await addSensorsToReturnRecord(bytes, data)
                if (print) {
                    printPdf(finishedFormBytes);
                }
                res.setHeader("Content-Disposition", `attachment; filename=returnRecord${orderId}.pdf`);
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(Buffer.from(finishedFormBytes));
            })
        }
    })
});


app.get('/api/generate-work-order', async (req, res) => {
    const batchId = req.query.batch_id;
    const print = req.query.print;
    const today = new Date()
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    const seconds = String(today.getSeconds()).padStart(2, '0');
    const template = 'workOrderTemplate.pdf';


    pool.query(`SELECT api_batch.calibration_procedure_id, api_technician.first_name
                FROM api_batch
                JOIN api_technician ON api_batch.receiving_technician_id = api_technician.technician_id
                WHERE api_batch.batch_id = $1;`, [batchId], async (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }

        const data = result.rows[0];

        pool.query(`SELECT sensor_id FROM api_sensor WHERE batch_id = $1;`, [batchId], async (err, result) => {
            if (err) {
                return res.status(500).json({ error: `Error executing query: ${err}` });
            }
            const sensors = result.rows;
            let sensorsString;

            for (let i = 0; i < sensors.length; i++) {
                if (i === 0) {
                    sensorsString = `${sensors[i].sensor_id}`
                } else {
                    sensorsString = sensorsString + `, ${sensors[i].sensor_id}`
                }
            }
            const fields = {
                'calibrationProcedure': `${data.calibration_procedure_id}`,
                'workOrder': `${batchId}`,
                'date': `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`,
                'time': `${hours}:${minutes}:${seconds}`,
                'technician': `${data.first_name}`,
                'totalSensors': `${sensors.length}`,
                'sensorIdList': sensorsString,
            }
            const bytes = await fillForm(template, fields);

            const pdfDoc = await PDFDocument.load(bytes);
            const page = pdfDoc.getPage(0);

            let qrCode = await QRCode.toBuffer(`${batchId}`);
            qrCode = await pdfDoc.embedPng(qrCode);

            page.drawImage(qrCode, {
                x: 130,
                y: 590,
                width: 110,
                height: 110,
            })

            const finishedPdf = await pdfDoc.save();

            if (print) {
                printPdf(finishedPdf);
            }
            res.setHeader("Content-Disposition", `attachment; filename=workOrder${batchId}.pdf`);
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(Buffer.from(finishedPdf));
        })
    })
});

app.get('/api/delete-batch', (req, res) => {
    const batchId = req.query.batch_id;


    pool.query('DELETE FROM api_interaction_log WHERE batch_id = $1 RETURNING *', [batchId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
    })
    pool.query('DELETE FROM api_batch WHERE batch_id = $1 RETURNING *', [batchId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Error executing query: ${err}` });
        }
        const data = result.rows;
        res.json(data);
    })
});

async function fillForm(template, fields) {
    const pdfBytes = fs.readFileSync(`templates/${template}`);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    for (const field in fields) {
        const textField = form.getTextField(field);
        textField.setText(fields[field]);
    }
    form.flatten();
    const filledPdfBytes = await pdfDoc.save();
    return filledPdfBytes;
}

async function fillCertificate(template, fields) {
    const pdfBytes = fs.readFileSync(`templates/${template}`);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    const page = pdfDoc.getPage(0);
    let technicianSignature = fs.readFileSync(`templates/signatures/Colton Signature.png`);
    technicianSignature = await pdfDoc.embedPng(technicianSignature);
    let authorizorSignature = fs.readFileSync(`templates/signatures/Kelly Signature.png`);
    authorizorSignature = await pdfDoc.embedPng(authorizorSignature);
    let qrCode = await QRCode.toBuffer(`https://sensorcalibrations.blob.core.windows.net/public-certificates/${fields.CertNumber}.pdf`);
    qrCode = await pdfDoc.embedPng(qrCode);
    page.drawImage(technicianSignature, {
        x: 110,
        y: 70,
        width: 115,
        height: 23,
    })
    page.drawImage(authorizorSignature, {
        x: 380,
        y: 70,
        width: 115,
        height: 23,
    })
    page.drawImage(qrCode, {
        x: 430,
        y: 120,
        width: 70,
        height: 70,
    })

    for (const field in fields) {
        const textField = form.getTextField(field);
        textField.setText(fields[field]);
    }
    form.flatten();
    const filledPdfBytes = await pdfDoc.save();
    return filledPdfBytes;
}

async function uploadPdfToAzure(pdfBytes, fileName) {
    const connectionString = azureConnectionString;
    const containerName = "public-certificates";
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);


    await blockBlobClient.uploadData(pdfBytes, {
        blobHTTPHeaders: { blobContentType: "application/pdf" },
    });
}

async function printPdf(pdfBytes) {
    request.post('http://localhost:4000/print-pdf/', {
        body: pdfBytes,
    },
        function (error, response, body) {
            if (!response.body || response.body !== 'Printed PDF successfully' || error) {
                console.log('Error printing pdf: ', error ? error : 'No error code')
            }
        }
    )
}

async function addSensorsToReturnRecord(bytes, sensorList) {
    sensorList.sort((certificateA, certificateB) => {
        if (certificateA.calibration_procedure_id === certificateB.calibration_procedure_id) {
            return certificateA.sensor_id - certificateB.sensor_id;
        } else {
            return certificateA.calibration_procedure_id - certificateB.calibration_procedure_id;
        }
    });

    const pdfDoc = await PDFDocument.load(bytes);
    const [newPage] = pdfDoc.getPages();
    const lineStarts = [53, 139, 203, 246, 315, 441, 498, 559];
    const rowHeight = 11;
    const fontSize = 6;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let availableHeight = 378;
    let startY = 405;

    let currentPage = newPage;
    let sensorsOnPage = 0;
    for (let index = 0; index < sensorList.length; index++) {
        const sensor = sensorList[index];
        if (sensorsOnPage * rowHeight > availableHeight) {
            currentPage = pdfDoc.addPage([newPage.getWidth(), newPage.getHeight()]);
            availableHeight = 720;
            startY = 750;
            sensorsOnPage = 0;
        } else {
            sensorsOnPage++;
        }

        currentPage.drawRectangle({
            x: 53,
            y: startY - sensorsOnPage * rowHeight,
            width: 506,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
        });

        const textArray = [
            `MNT-${sensor.certificate_id}`,
            JSON.stringify(sensor.sensor_id),
            sensor.generate_certificate_json.CS5,
            sensor.manufacturer,
            sensor.sku,
            sensor.customer_order_number,
            JSON.stringify(sensor.calibration_procedure_id),
        ];

        for (let j = 0; j < textArray.length; j++) {
            let textColor = rgb(0, 0, 0);
            const startX = lineStarts[j];
            const centerX = (lineStarts[j] + lineStarts[j + 1]) / 2;

            const text = textArray[j];
            const textWidth = font.widthOfTextAtSize(text, fontSize);

            const textX = centerX - textWidth / 2;

            currentPage.drawLine({
                start: { x: startX, y: startY + 11 - sensorsOnPage * rowHeight },
                end: { x: startX, y: startY - sensorsOnPage * rowHeight },
                thickness: 1,
                color: rgb(0, 0, 0),
            });

            if (textArray[j] === 'PASS') {
                textColor = rgb(0, 0.5, 0);
            } else if (textArray[j] === 'FAIL') {
                textColor = rgb(1, 0, 0);
            }

            currentPage.drawText(textArray[j], {
                x: textX,
                y: startY + 3 - sensorsOnPage * rowHeight,
                size: fontSize,
                color: textColor,
                textAlign: 'center',
            });
        }
    }

    const modifiedPdfBytes = await pdfDoc.save();
    return modifiedPdfBytes;
}

function monnitFetch(url) {
    let status = 429;
    let attempts = 0;
    let response = null;
    while (status != 200 && attempts < 10) {
        attempts++;
        response = synchFetch(url, { headers: headers });
        status = response.status;
    }

    return response.json();
}

async function sendMailVerification(type, payload) {
    try {
        const { email, token } = payload;
        const frontEndDomain = process.env.FRONT_END_DOMAIN;
        let rootUrl = "";
        let pathFile = "";
        let subject = "";
        let messageLog = "";

        switch (type) {
            case "VERIFICATION_ACCOUNT": {
                rootUrl = `${frontEndDomain}/auth/verify-email`;
                pathFile = "./templates/mail/verification-link-template.hbs";
                subject = "Account verification email";
                messageLog = `Account verification email has been sent to email ${email} successfully`;
                break;
            }

            case "FORGOT_PASSWORD": {
                rootUrl = `${frontEndDomain}/forgot-password/reset`;
                pathFile = "./templates/mail/reset-password-template.hbs";
                subject = "Reset password";
                messageLog = `Reset password email has been sent to email ${email} successfully`;
                break;
            }

            default: {
                console.warn(`Type ${type} no supported`);
                return;
            }
        }

        const url = `${rootUrl}?token=${token}`;
        const filePath = path.join(__dirname, pathFile);
        const source = fs.readFileSync(filePath, "utf-8").toString();
        const template = handlebars.compile(source);
        const replacements = {
            email,
            url,
        };
        const htmlToSend = template(replacements);
        const message = {
            to: email,
            from: {
                name: "Sensorcalibrations",
                email: process.env.MAIL,
            },
            subject,
            html: htmlToSend,
        };
        const result = await sgMail.send(message);
        return result;
    } catch (e) {
        console.error(e);
        throw e;
    }
}

function addSensorData(newSensorData, currentSensorData) {
    for (const newData of newSensorData) {
        for (let i = 0; i < currentSensorData.length; i++) {
            if (newData.sensorID === currentSensorData[i].sensorID) {
                currentSensorData.splice(i, 1);
            }
        }
        const finalData = {
            sensorID: newData.sensorID,
            dataType: newData.dataType,
            dataValue: newData.dataValue,
        }
        currentSensorData.push(finalData);
    }
    return currentSensorData;
}

function auth(req, res, next) {
    const token = req.header("Authorization");
    if (!token || !token.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const authToken = token.split(" ")[1];
    try {
        const user = verifyToken(authToken, process.env.JWT_SECRET_KEY);
        if (!user) {
            return res.status(403).json({ message: "Forbidden" });
        }
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json(error);
    }
}