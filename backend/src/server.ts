import cors, { CorsOptions } from 'cors'
import express from 'express';

// Middleware
import auth from './middleware/auth'
import isAdmin from './middleware/isAdmin'

// Routes
import authRoutes from './routes/auth'
import orderRoutes from './routes/order';
import sensorRoutes from './routes/sensor';
import bufferRoutes from './routes/buffer';
import batchRoutes from './routes/batch';
import readingRoutes from './routes/reading';
import equipmentRoutes from './routes/equipment';
import certificateRoutes from './routes/certificate';

// Utils
import config from "./utils/config"
import miscRoutes from './routes/misc';
import client from './routes/client';
import rollingDataRoutes from './routes/rollingData';

const app = express();
const corsOptions = {
    origin: function (origin: string | undefined, callback: any) {
        // 172.16.2.70:3000 lets a tech on the lab network open the dev portal running on Austin's machine
        const whitelist = ['http://localhost:3000', 'http://172.16.2.70:3000', 'https://technicianportal.sensorcalibrations.com'];
        if (!origin || whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    optionsSuccessStatus: 200,
    credentials: true
} as CorsOptions;

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let port = config.STATUS == "production" ? config.PROD_PORT : config.DEV_PORT
let ip = config.STATUS == "production" ? config.PROD_IP : config.DEV_IP

app.listen(port, ip, () => {
    console.log(`Server running at https://${ip}:${port}/`);
});

// Sensor data buffer routes
app.post("/api/webhook", bufferRoutes.webhook);

// Authentication routes
app.post("/api/auth/sign-in", authRoutes.signIn);
app.post("/api/auth/sign-up", authRoutes.signUp);
app.post("/api/auth/verify", authRoutes.verify);
app.get("/api/auth/refresh", authRoutes.refresh);
app.post("/api/auth/resend-verify-email", authRoutes.resendVerifyEmail);
app.post("/api/auth/forgot-password", authRoutes.forgotPassword);
app.post("/api/auth/resend-forgot-password-email", authRoutes.resendForgotPasswordEmail);
app.post("/api/auth/verify-reset-password", authRoutes.verifyResetPassword);
app.get("/api/users/me", auth, authRoutes.me);

// Sencal clients
app.get("/api/request-quotes", auth, client.getQuotes);
app.post("/api/request-quotes", auth, client.insertQuote);

// Order routes
app.get('/api/get-order-by-id', auth, orderRoutes.getOrderById);
app.get('/api/get-orders-to-ship', auth, orderRoutes.getOrdersToShip);
app.get('/api/set-order-shipped', auth, orderRoutes.setOrderShipped);
app.get('/api/create-order', auth, orderRoutes.createOrder);
app.get('/api/set-order-active-state', auth, orderRoutes.setOrderActiveState);
app.get('/api/set-order-expedited', auth, orderRoutes.setOrderExpedited);
app.get('/api/delete-order', auth, orderRoutes.deleteOrder);
app.get('/api/generate-return-record', auth, orderRoutes.generateReturnRecord);
app.get('/api/remove-sensors-from-network', auth, orderRoutes.removeSensorsFromNetwork);

// Sensor routes
app.get('/api/get-sensors', auth, sensorRoutes.getSensors);
app.get('/api/get-active-sensors', auth, sensorRoutes.getActiveSensors);
app.get('/api/get-sensor-invoice-report', auth, sensorRoutes.getSensorInvoiceReport);
app.get('/api/calibrate-sensor', auth, sensorRoutes.calibrateSensor);
app.get('/api/create-sensor', auth, sensorRoutes.createSensor);
app.get('/api/change-sensor-heartbeat', auth, sensorRoutes.changeSensorHeartbeat);
app.get('/api/get-sensors-by-order-id', auth, sensorRoutes.getSensorsByOrderId);
app.get('/api/get-sensors-by-batch-id', auth, sensorRoutes.getSensorsByBatchId);
app.get('/api/remove-sensor-from-batch', auth, sensorRoutes.removeSensorFromBatch);
app.get('/api/set-sensor-spare', auth, sensorRoutes.setSensorSpare);
app.get('/api/remove-sensor', auth, sensorRoutes.removeSensor);
app.get('/api/get-sensor-list', auth, sensorRoutes.getSensorList);
app.get('/api/get-sensor-cable-id', auth, sensorRoutes.getSensorCableId);
app.get('/api/add-cable-to-sensor', auth, sensorRoutes.addCableToSensor);

// Batch routes
app.get('/api/get-batch-by-id', auth, batchRoutes.getBatchById);
app.get('/api/get-batches-by-order-id', auth, batchRoutes.getBatchesByOrderId);
app.get('/api/get-batches', auth, batchRoutes.getBatches);
app.get('/api/get-batches-by-active-state', auth, batchRoutes.getBatchesByActiveState);
app.get('/api/create-batch', auth, batchRoutes.createBatch);
app.get('/api/set-batch-active-state', auth, batchRoutes.setBatchActiveState);
app.get('/api/remove-batch-location', auth, batchRoutes.removeBatchLocation);
app.get('/api/set-batch-bin', auth, batchRoutes.setBatchBin);
app.get('/api/update-batch-calibration-procedure', auth, batchRoutes.updateBatchCalibrationProcedure);
app.get('/api/create-location-log', auth, batchRoutes.createLocationLog);
app.get('/api/get-locations', auth, batchRoutes.getLocations);
app.get('/api/log-batch-interaction', auth, batchRoutes.logBatchInteraction);
app.get('/api/update-batch-technician', auth, batchRoutes.updateBatchTechnician);
app.get('/api/generate-work-order', auth, batchRoutes.generateWorkOrder);
app.get('/api/delete-batch', auth, batchRoutes.deleteBatch);
app.get('/api/change-batch-heartbeats', auth, batchRoutes.changeBatchHeartBeats);
app.get('/api/move-batch-to-network-group', auth, batchRoutes.moveBatchToNetworkGroup);
app.get('/api/reform-gateways', auth, batchRoutes.reformGateways);

// Reading routes
app.get('/api/get-recent-readings', auth, readingRoutes.getRecentReadings);
app.get('/api/get-readings-by-sensor-id', auth, readingRoutes.getReadingsBySensorId);
app.get('/api/create-reading', auth, readingRoutes.createReading);

// Rolling data
app.get('/api/get-online-sensors', auth, rollingDataRoutes.getOnlineSensors);
app.get('/api/get-last-stable-readings', auth, rollingDataRoutes.getLastStableReadings);
app.get('/api/get-set-point-readiness', auth, rollingDataRoutes.getSetPointReadiness);
app.get('/api/get-reading-range', auth, rollingDataRoutes.getReadingRange);
app.get('/api/get-recent-data', auth, rollingDataRoutes.getRecentData);
app.get('/api/get-last-sensor-readings', auth, rollingDataRoutes.getLastSensorReadings);
app.get('/api/get-sensor-heartbeats', auth, rollingDataRoutes.getSensorHeartbeats);
app.get('/api/get-last-reference-readings', auth, rollingDataRoutes.getLastReferenceReadings);
app.get('/api/get-generator-statuses', auth, rollingDataRoutes.getGeneratorStatuses);
app.get('/api/create-generator-command', auth, rollingDataRoutes.createGeneratorCommand);

// Equipment routes
app.get('/api/get-equipment', auth, equipmentRoutes.getEquipment);
app.get('/api/set-generator', auth, isAdmin, equipmentRoutes.setGenerator);
app.get('/api/verify-equipment-in-testing', auth, equipmentRoutes.verifyEquipmentInTesting);
app.get('/api/verify-equipment-in-shipping', auth, equipmentRoutes.verifyEquipmentInShipping);

// Certificate routes
app.get('/api/get-calibrations-by-month', auth, certificateRoutes.getCalibrationsByMonth);
app.get('/api/get-certificates-by-order-id', auth, certificateRoutes.getCertificatesByOrderId);
app.get('/api/print-certificate-labels', auth, certificateRoutes.printCertificateLabels);
app.get('/api/create-certificates', auth, certificateRoutes.createCertificates);
app.get('/api/update-certificate-json', auth, isAdmin, certificateRoutes.updateCertificateJson);
app.get('/api/update-certificates-json', auth, isAdmin, certificateRoutes.updateCertificatesJson);
app.get('/api/generate-order-certificates', auth, certificateRoutes.generateOrderCertificates);

// Misc routes
app.get('/api/search-data', auth, miscRoutes.searchData);
app.get('/api/get-search-results', auth, miscRoutes.getSearchResults);
app.get('/api/get-customer-by-id', auth, miscRoutes.getCustomerById);
app.get('/api/get-calibration-procedures', auth, miscRoutes.getCalibrationProcedures);
app.get('/api/get-variances', auth, miscRoutes.getVariances);
app.get('/api/get-humidity-variances', auth, miscRoutes.getHumidityVariances);
app.get('/api/get-variances-by-calibration-procedure', auth, miscRoutes.getVariancesByCalibrationProcedure);
app.get('/api/create-set-point', auth, isAdmin, miscRoutes.createSetPoint);
app.get('/api/create-humidity-variance', auth, isAdmin, miscRoutes.createHumidityVariance);
app.get('/api/change-set-point-active-state', auth, isAdmin, miscRoutes.changeSetPointActiveState);
app.get('/api/change-humidity-variance-active-state', auth, isAdmin, miscRoutes.changeHumidityVarianceActiveState);
app.get('/api/create-set-point-link', auth, isAdmin, miscRoutes.createSetPointLink);
app.get('/api/update-set-point-minutes', auth, isAdmin, miscRoutes.updateSetPointMinutes);
app.get('/api/lookup-technician', auth, miscRoutes.lookupTechnician);
app.get('/api/get-notifications', auth, miscRoutes.getNotifications);
app.get('/api/create-notification', auth, isAdmin, miscRoutes.createNotification);
app.get('/api/dismiss-notification', auth, miscRoutes.dismissNotification);
app.get('/api/get-technicians', auth, miscRoutes.getTechnicians);
app.post('/api/create-technician', auth, isAdmin, authRoutes.createTechnician);
app.post('/api/set-password', auth, isAdmin, authRoutes.setPassword);
