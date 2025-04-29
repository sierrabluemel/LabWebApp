import { Request, Response, NextFunction } from "express";
import misc from "../models/misc";

const isTechnician = (req: Request, res: Response, next: NextFunction) => {
    misc.getTechnicianById(req.user.user_id)
        .then((result) => {
            if (result && result.technician_id)
                next();
            else
                res.status(500).json({ error: `Not a technician` });
        })
        .catch((err) => {
            console.error(err);
            res.status(500).json({ error: `Error getting technician info` });
        });
}

export default isTechnician;