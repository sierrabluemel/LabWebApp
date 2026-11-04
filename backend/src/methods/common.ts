import { pool } from "../utils/db";

export function getCertificateInvoiceData(certificates: any[], calibrationProcedures: any[]) {
    const prodecureData = {
        passed: 0,
        failed: 0,
        expedited: 0
    }
    let invoiceData = {
        tos: new Set(),
        calibration_procedure_3_no_lead: JSON.parse(JSON.stringify(prodecureData)) // Create deep copy of procedureData
    } as any

    calibrationProcedures.map((calibrationProcedure, index) => {
        invoiceData[`calibration_procedure_${index+1}`] = JSON.parse(JSON.stringify(prodecureData)) // Create deep copy of procedureData
    })

    for (const certificate of certificates) {
        invoiceData.tos.add(certificate.customer_order_number)
        const passed = certificate.generate_certificate_json.CS5 === 'PASS'
        let targetCalibrationProcedure = invoiceData[`calibration_procedure_${certificate.calibration_procedure_id}`]

        if (certificate.calibration_procedure_id === 3) {
            targetCalibrationProcedure = invoiceData.calibration_procedure_3
            const splitSku = certificate.sku.split('-');
            const lastSkuCode = splitSku[splitSku.length - 1];
            const noLead = lastSkuCode === 'RH';
            if (noLead) {
                targetCalibrationProcedure = invoiceData.calibration_procedure_3_no_lead
            }
        }

        passed ? targetCalibrationProcedure.passed++ : targetCalibrationProcedure.failed++
        if (certificate.expedited) {
            targetCalibrationProcedure.expedited++
        }
    }

    return invoiceData
}

export function getDateString(date: Date) {
    let datestring = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
    return datestring;
}

export function removeDuplicateCertificates(certificateArray: any[]) {
    const seenCertificates = new Set()
    // One billable certificate per base per batch per day: a base reused the same day on another order is a new batch,
    // while regenerating within a batch (including after a lead was scanned late) is not
    return certificateArray.filter(({ sensor_id, batch_id, timestamp }) => {
        const dateKey = `${sensor_id}-${batch_id}-${getDateString(timestamp)}`
        if (seenCertificates.has(dateKey)) {
            return false;
        } else {
            seenCertificates.add(dateKey);
            return true;
        }
    })
};

export function createLogEntry(assetTag: string, technicianId: number, actionPerformedString: string) {
    const now = new Date()
    pool.query("INSERT INTO api_log (timestamp, asset_tag, action_performed, technician_id) VALUES ($1, $2, $3, $4) RETURNING *", [now, assetTag, actionPerformedString, technicianId])
        .then(() => { })
        .catch((error) => {
            console.error(error);
        });
};