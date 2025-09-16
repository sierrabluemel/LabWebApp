import { executeNonQuery, executeQuery, executeQuerySingleReturn, pool, rollingDataPool } from "../utils/db";

async function filterEquipment(equipList: any[]) {
    const bath1 = equipList.filter(e => e.asset_tag === 'S000101')[0] as any;
    const bath2 = equipList.filter(e => e.asset_tag === 'S000102')[0] as any;
    const bath3 = equipList.filter(e => e.asset_tag === 'S000103')[0] as any;
    const chamber = equipList.filter(e => e.asset_tag === 'S000105')[0] as any;

    const reference1 = equipList.filter(e => e.asset_tag === bath1.reference_tag)[0]
    const reference2 = equipList.filter(e => e.asset_tag === bath2.reference_tag)[0]
    const reference3 = equipList.filter(e => e.asset_tag === bath3.reference_tag)[0]
    const rotronic = equipList.filter(e => e.asset_tag === chamber.reference_tag)[0]
    const superDaq = equipList.filter(e => e.reference_tag === e.asset_tag)[0]
    return {
        bath1,
        bath2,
        bath3,
        chamber,

        reference1,
        reference2,
        reference3,
        rotronic,
        superDaq
    }
}
const equipment = {
    getEquipment: (isFiltered: boolean = false) => {
        return executeQuery(pool, `
            SELECT
                *
            FROM
                API_EQUIPMENT
            ORDER BY
                EQUIPMENT_ID
        `, [])
        .then((equipmentList: any) => {
            if (isFiltered)
                return filterEquipment(equipmentList)
            return equipmentList
        })
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
                PHYSICALLY_VERIFIED = $2
            WHERE
                ASSET_TAG = $1
            RETURNING *
        `, [assetTag, verified]);
    },
    setCertificateVerified: (assetTag: string, verified: boolean) => {
        return executeQuerySingleReturn(pool, `
            UPDATE API_EQUIPMENT
            SET
                CERTIFICATE_VERIFIED = $2
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