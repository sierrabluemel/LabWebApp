import { Request, Response } from "express";
import misc from "../models/misc";

const miscRoutes = {
    search: (req: Request, res: Response) => {
        const filterData = req.query.filter_data as string;
        const table = req.query.table as string;

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