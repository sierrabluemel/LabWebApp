import { Request, Response } from "express";
import misc from "../models/misc";

const miscRoutes = {
    search: (req: Request, res: Response) => {
        const dataLookupType = req.query.data_lookup_type;
        const filterData = req.query.filter_data as string;
        const table = req.query.table as string;
        console.log(filterData, table)

        misc.sqlInjectMePls(table, filterData)
            .then((data) => {
                res.status(200).json(data);
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error in search` });
            })
    },
    searchData: (req: Request, res: Response) => {
        misc.searchData()
            .then((data) => {
                res.status(200).json(data);
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error in search` });
            });
    },
    getCustomerById: (req: Request, res: Response) => {
        const customerId = parseInt(req.query.customer_id as string ?? "");

        misc.getCustomerById(customerId)
            .then((result) => {
                res.json(result)
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error getting customer` });
            });
    },
    getCalibrationProcedures: (req: Request, res: Response) => {
        misc.getCalibrationProcedures()
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error getting calibration procecures` });
            });
    },
    getVariances: (req: Request, res: Response) => {
        misc.getVariances()
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error getting calibration procecures` });
            });
    },
    getVariancesByCalibrationProcedure: (req: Request, res: Response) => {
        const calibrationProcedure = parseInt(req.query.calibration_procedure as string ?? "");

        misc.getVariancesByCalibrationProcedure(calibrationProcedure)
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error getting calibration procecures` });
            });
    },
    createSetPoint: (req: Request, res: Response) => {
        const setPoint = parseFloat(req.query.set_point as string ?? "");
        const readingType = req.query.reading_type as string ?? "";
        const referenceVariance = parseFloat(req.query.reference_variance as string ?? "");
        const driftVariance = parseFloat(req.query.drift_variance as string ?? "");
        const bridgeVariance = parseFloat(req.query.bridge_variance as string ?? "");
        const uniformityVariance = parseFloat(req.query.uniformity_variance as string ?? "");
        const stabilityVariance = parseFloat(req.query.stability_variance as string ?? "");
        const dutResolutionVariance = parseFloat(req.query.dut_resolution_variance as string ?? "");
        const referenceAssetTag = req.query.reference_asset_tag as string ?? "";
        const referenceType = req.query.reference_type as string ?? "";
        const generatorAssetTag = req.query.generator_asset_tag as string ?? "";
        const generatorType = req.query.generator_type as string ?? "";

        misc.createSetPoint(setPoint, readingType, referenceVariance, driftVariance, bridgeVariance, uniformityVariance, stabilityVariance, dutResolutionVariance, referenceAssetTag, generatorAssetTag, referenceType, generatorType)
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error creating set point` });
            });
    },
    createSetPointLink: (req: Request, res: Response) => {
        const setPointId = parseInt(req.query.set_point_id as string ?? "");
        const calibrationProcedureId = parseInt(req.query.calibration_procedure_id as string ?? "");

        misc.createSetPointLink(setPointId, calibrationProcedureId)
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error creating set point link` });
            });
    },
    changeSetPointActiveState: (req: Request, res: Response) => {
        const setPointId = parseInt(req.query.set_point_id as string ?? "");
        const activeState = req.query.active_state as unknown as boolean ?? false;

        misc.changeSetPointActiveState(setPointId, activeState)
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error setting set point active state` });
            });
    },
    lookupTechnician: (req: Request, res: Response) => {
        let user_id = parseInt(req.query.user_id as string ?? "");

        misc.getTechnicianById(user_id)
            .then((result) => {
                res.json(result)
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error getting technician` });
            });
    },
}
export default miscRoutes;