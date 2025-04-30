import { Request, Response } from "express";
import { createLogEntry } from "../methods/common";
import equipment from "../models/equipment";

const equipmentRoutes = {
    getEquipment: (req: Request, res: Response) => {
        equipment.getEquipment()
            .then((equipment) => {
                res.json(equipment);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error fetching equipment` });
            })
    },
    setGenerator: (req: Request, res: Response) => {
        const referenceTag = req.query.reference_tag as string;
        const generatorTag = req.query.generator_tag as string;
        const certificateNumber = req.query.certificate_number as string;
        const calibrationDate = new Date(req.query.calibration_date as string);
        const dueDate = new Date(req.query.due_date as string);
        const technicianId = parseInt(req.query.technician_id as string ?? "");

        equipment.setReferenceTag(generatorTag, referenceTag)
            .then(() => {
                return equipment.setCertAndPhysicallyVerified(referenceTag, false);
            })
            .then(() => {
                return equipment.setCalibrationInfo(certificateNumber, calibrationDate, dueDate, referenceTag)
            })
            .then(() => {
                res.json();
                createLogEntry(referenceTag, technicianId, 'Reference placed into service');
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error setting generator` });
            })
    },
    verifyEquipmentInTesting: (req: Request, res: Response) => {
        const assetTag = req.query.asset_tag as string;
        const technicianId = parseInt(req.query.technician_id as string ?? "");

        equipment.setPhysicallyVerified(assetTag, true)
            .then((equipment) => {
                res.json([equipment]);
                createLogEntry(assetTag, technicianId, 'Reference verified in testing')
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Unable to verify equipment` });
            })
    },
    verifyEquipmentInShipping: (req: Request, res: Response) => {
        const assetTag = req.query.asset_tag as string;
        const technicianId = parseInt(req.query.technician_id as string ?? "");

        equipment.setCertificateVerified(assetTag, true)
            .then((equipment) => {
                res.json([equipment]);
                createLogEntry(assetTag, technicianId, 'Reference verified in shipping')
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Unable to verify equipment` });
            })
    },
};

export default equipmentRoutes;