import path from "path";
import dotenv from "dotenv";

// Parsing the env file.
dotenv.config({ path: path.resolve("./.env") });

// Interface to load env variables
// Note these variables can possibly be undefined
// as someone could skip these variables or not setup a .env file at all

interface ENV {
    STATUS: string,
    DEV_IP: string,
    DEV_PORT: number,
    PROD_IP: string,
    PROD_PORT: number,
    DEV_DB_CONNECTION: object,
    PROD_DB_CONNECTION: object,
    ROLLING_DATA_CONNECTION: object,
    IMONNIT_API_KEY_ID: string,
    IMONNIT_API_SECRET_KEY_ID: string,
    AZURE_CONNECTION_STRING: string,
    FRONT_END_DOMAIN: string,
    JWT_SECRET_KEY: string,
    SENDGRID_API_KEY: string,
    MAIL: string
}

// Loading process.env as ENV interface

const getConfig = (): ENV => {
    return {
        STATUS: process.env.STATUS,
        DEV_IP: process.env.DEV_IP,
        DEV_PORT: parseInt(process.env.DEV_PORT),
        PROD_IP: process.env.PROD_IP,
        PROD_PORT: parseInt(process.env.PROD_PORT),
        DEV_DB_CONNECTION: JSON.parse(process.env.DEV_DB_CONNECTION),
        PROD_DB_CONNECTION: JSON.parse(process.env.PROD_DB_CONNECTION),
        ROLLING_DATA_CONNECTION: JSON.parse(process.env.ROLLING_DATA_CONNECTION),
        IMONNIT_API_KEY_ID: process.env.IMONNIT_API_KEY_ID,
        IMONNIT_API_SECRET_KEY_ID: process.env.IMONNIT_API_SECRET_KEY_ID,
        AZURE_CONNECTION_STRING: process.env.AZURE_CONNECTION_STRING,
        FRONT_END_DOMAIN: process.env.FRONT_END_DOMAIN,
        JWT_SECRET_KEY: process.env.JWT_SECRET_KEY,
        SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
        MAIL: process.env.MAIL
    };
};

// Throwing an Error if any field was undefined we don't 
// want our app to run if it can't connect to DB and ensure 
// that these fields are accessible. If all is good return
// it as Config which just removes the undefined from our type 
// definition.

const getSanitizedConfig = (config: ENV): ENV => {
    for (const [key, value] of Object.entries(config)) {
        if (value === undefined) {
            throw new Error(`Missing key ${key} in config.env`);
        }
    }
    return config as ENV;
};

const config = getConfig();

const sanitizedConfig = getSanitizedConfig(config);

export default sanitizedConfig;