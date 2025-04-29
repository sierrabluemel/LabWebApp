import "express";

export {}
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            STATUS: string,
            DEV_IP: string,
            DEV_PORT: string,
            PROD_IP: string,
            PROD_PORT: string,
            DEV_DB_CONNECTION: string,
            PROD_DB_CONNECTION: string,
            ROLLING_DATA_CONNECTION: string,
            IMONNIT_API_KEY_ID: string,
            IMONNIT_API_SECRET_KEY_ID: string,
            AZURE_CONNECTION_STRING: string,
            FRONT_END_DOMAIN: string,
            JWT_SECRET_KEY: string,
            SENDGRID_API_KEY: string,
            MAIL: string
        }
    }
    namespace Express {
        interface Request {
            user: any
        }
    }
}