import fs from 'fs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import qrcode from 'qrcode'
import { BlobServiceClient } from '@azure/storage-blob';

const pdf = {
    fillForm: async (template: string, fields: string[]) => {
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
    },
    fillCertificate: async (template: string, fields: any) => {
        const pdfBytes = fs.readFileSync(`templates/${template}`);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();

        const page = pdfDoc.getPage(0);
        let technicianSignature = fs.readFileSync(`templates/signatures/Colton Signature.png`) as any;
        technicianSignature = await pdfDoc.embedPng(technicianSignature);
        let authorizorSignature = fs.readFileSync(`templates/signatures/Kelly Signature.png`) as any;
        authorizorSignature = await pdfDoc.embedPng(authorizorSignature);
        let qrCode = await qrcode.toBuffer(`https://sensorcalibrations.blob.core.windows.net/public-certificates/${fields.CertNumber}.pdf`) as any;
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
        return new Blob([filledPdfBytes]);
    },
    uploadPdfToAzure: async (pdfBytes: Blob, fileName: string) => {

        const connectionString = process.env.AZURE_CONNECTION_STRING ?? "";
        const containerName = "public-certificates";
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);


        await blockBlobClient.uploadData(pdfBytes, {
            blobHTTPHeaders: { blobContentType: "application/pdf" },
        });
    },
    printPdf: (pdfBytes: Blob | Buffer) => {
        fetch('http://localhost:4000/print-pdf/', {
            method: 'POST',
            body: pdfBytes,
        })
            .then((response) => {
                return response.text()
            })
            .then((response) => {
                if (response !== 'Printed PDF successfully') {
                    console.error('Error printing pdf: No error code')
                }
            })
            .catch((err) => {
                console.error('Error printing pdf: ', err)
            })
    },
    addSensorsToReturnRecord: async (bytes: any, sensorList: any[]) => {

        sensorList.sort((certificateA: any, certificateB: any) => {
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
                    //textAlign: 'center',
                });
            }
        }

        const modifiedPdfBytes = await pdfDoc.save();
        return modifiedPdfBytes;
    }

}

export default pdf;