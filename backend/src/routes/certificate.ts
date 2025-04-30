import { Request, Response } from "express";
import { removeDuplicateCertificates } from "../methods/common";
import monnitFetch from "../utils/monnit";
import pdf from "../utils/pdf";
import PDFMerger from "pdf-merger-js";
import fs from 'fs';
import certificate from "../models/certificate";

const certificateRoutes = {
    getCalibrationsByMonth: (req: Request, res: Response) => {
        const startDate = new Date(req.query.start_date as string ?? "");

        let endDate = new Date(startDate.getTime());
        endDate = new Date(endDate.setMonth(endDate.getMonth() + 1));

        certificate.getCalibrationsByDateRange(startDate, endDate)
            .then((result) => {
                const data = removeDuplicateCertificates(result);
                res.json(data);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error getting calibrations` });
            })
    },
    getCertificatesByOrderId: (req: Request, res: Response) => {
        const orderId = parseInt(req.query.order_id as string ?? "");

        certificate.getCertificatesByOrderId(orderId)
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error getting calibrations` });
            })
    },
    printCertificateLabels: (req: Request, res: Response) => {
        const calibrationDate = req.query.calibration_date;
        const dueDate = req.query.due_date;
        const certificateNumber = req.query.certificate_number;
        const sensorId = req.query.sensor_id;
        if (process.env.STATUS === 'development') {
            res.json({ 'Result': `Failed: print disabled in test environment` });
            return;
        }
        let url = `http://localhost:4000/print-label/`;

        fetch(`${url}?calibration_date=${calibrationDate}&due_date=${dueDate}&certificate_number=${certificateNumber}&sensor_id=${sensorId}`)
            .then((response: any) => {
                res.json({ 'Result': JSON.stringify(response) })
            })
            .catch((error: any) => {
                console.error(error);
                res.json({ 'Result': `Failed: ${error}` })
            })
    },
    createCertificate: (req: Request, res: Response) => {
        const certificateJson = req.query.certificate_json
        const sensorId = parseInt(req.query.sensor_id as string ?? "");
        const template = req.query.template as string;
        const dueDate = req.query.due_date;
        const calibrationDate = req.query.calibration_date;

        certificate.createCertificate(certificateJson, template, sensorId)
            .then((certificate) => {
                let url = `https://www.imonnit.com/json/CalibrationCertificateCreate/`;
                const parameters = {
                    'SensorID': sensorId,
                    'DateCertified': calibrationDate,
                    'CertificationExpirationDate': dueDate,
                    'CalibrationFacilityID': 5,
                    'CalibrationNumber': `MNT-${certificate.certificate_id}`,
                } as any;
                const params = new URLSearchParams();
                for (const parameter in parameters) {
                    params.append(parameter, parameters[parameter]);
                };
                const response = monnitFetch(`${url}?${params.toString()}`)
                res.json(certificate);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error creating certificate` });
            })
    },
    updateCertificateJson: (req: Request, res: Response) => {
        let certificateId = parseInt(req.query.certificate_id as string ?? "");
        let certificateJson = req.query.certificate_json;

        certificate.updateCertificateJson(certificateId, certificateJson)
            .then((certificate) => {
                res.json(certificate);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error updating certficate` });
            });
    },
    generateCertificate: (req: Request, res: Response) => {
        let certificateId = parseInt(req.query.certificate_id as string ?? "");
        const upload = req.query.upload;
        const print = req.query.print;

        certificate.getCertficateById(certificateId)
            .then(async (certificate) => {
                const certificateJson = { ...{ 'CertNumber': `MNT-${certificate.certificate_id}` }, ...certificate.generate_certificate_json };

                const bytes = await pdf.fillCertificate(certificate.template, certificateJson);
                if (upload && process.env.STATUS === 'production') {
                    pdf.uploadPdfToAzure(bytes, `MNT-${certificate.certificate_id}.pdf`)
                        .catch((err: any) => {
                            console.error("Error uploading PDF:", err);
                            res.status(500).json({ error: "Error uploading PDF" })
                        });
                }
                if (print) {
                    pdf.printPdf(bytes);
                }
                res.setHeader("Content-Disposition", `attachment; filename=MNT-${certificateId}.pdf`);
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(Buffer.from(await bytes.bytes()));
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "An error occurred while processing the PDF." });
            })

    },
    generateOrderCertificates: (req: Request, res: Response) => {
        const orderId = parseInt(req.query.order_id as string ?? "");
        const print = req.query.print;

        certificate.getCertificatesByOrderId(orderId)
            .then(async (certificates) => {
                if (certificates.length == 0) {
                    return res.status(404).json({ error: `No certificates found under order id ${orderId}` });
                }

                let merger = new PDFMerger()
                for (const certificate of certificates) {
                    const certificateJson = { ...{ 'CertNumber': `MNT-${certificate.certificate_id}` }, ...certificate.generate_certificate_json };
                    const bytes = await pdf.fillCertificate(certificate.template, certificateJson);
                    fs.writeFileSync('fileOutputs/certificate.pdf', await bytes.bytes());
                    await merger.add('fileOutputs/certificate.pdf');
                }
                const finalCertificates = await merger.saveAsBuffer();

                try {
                    if (print) {
                        pdf.printPdf(finalCertificates);
                    }
                    res.setHeader("Content-Disposition", `attachment; filename=${certificates[0].customer_order_number}Certificates.pdf`);
                    res.setHeader("Content-Type", "application/json; charset=utf-8");
                    res.end(Buffer.from(finalCertificates));
                } catch (error) {
                    console.error("Error occurred:", error);
                    res.status(500).json({ error: "An error occurred while processing the PDF." });
                }
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "An error occurred while processing the PDF." });
            })
    },
};

export default certificateRoutes;