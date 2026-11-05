import { Request, Response, NextFunction } from "express";
import misc from "../models/misc";

const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    // The JWT payload is the "user" row, so its key is id
    misc.getTechnicianById(req.user.id)
        .then((result) => {
            if (result && result.admin)
                next();
            else
                res.status(403).json({ error: `Admin access required` });
        })
        .catch((err) => {
            console.error(err);
            res.status(500).json({ error: `Error getting technician info` });
        });
}

export default isAdmin;