import { executeNonQuery, executeQuery, executeQuerySingleReturn, pool, rollingDataPool } from "../utils/db";

const equipment = {
    getEquipment: () => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_EQUIPMENT
            ORDER BY
                EQUIPMENT_ID
        `, []);
    },
    setReferenceTag: (assetTag: string, referenceTag: string) => {
        return executeNonQuery(pool, `
            UPDATE API_EQUIPMENT
            SET
                REFERENCE_TAG = $1
            WHERE
                ASSET_TAG = $2
        `, [referenceTag, assetTag]);
    },
    setPhysicallyVerified: (assetTag: string, verified: boolean) => {
        return executeQuerySingleReturn(pool, `
            UPDATE API_EQUIPMENT
            SET
                PHYSICALLY_VERIFIED = $2,
            WHERE
                ASSET_TAG = $1
            RETURNING *
        `, [assetTag, verified]);
    },
    setCertificateVerified: (assetTag: string, verified: boolean) => {
        return executeQuerySingleReturn(pool, `
            UPDATE API_EQUIPMENT
            SET
                CERTIFICATE_VERIFIED = $2,
            WHERE
                ASSET_TAG = $1
            RETURNING *
        `, [assetTag, verified]);
    },
    setCertAndPhysicallyVerified: (assetTag: string, verified: boolean) => {
        return executeNonQuery(pool, `
            UPDATE API_EQUIPMENT
            SET
                PHYSICALLY_VERIFIED = $2,
                CERTIFICATE_VERIFIED = $2
            WHERE
                ASSET_TAG = $1
        `, [assetTag, verified]);
    },
    setCalibrationInfo: (calibrationCertificateNumber: string, lastCalibration: Date, nextCalibration: Date, assetTag: string) => {
        return executeNonQuery(pool, `
            UPDATE API_EQUIPMENT
            SET
                CALIBRATION_CERTIFICATE_NUMBER = $1,
                LAST_CALIBRATION = $2,
                NEXT_CALIBRATION = $3
            WHERE
                ASSET_TAG = $4
        `, [calibrationCertificateNumber, lastCalibration, nextCalibration, assetTag]);
    },
}

export default equipment;