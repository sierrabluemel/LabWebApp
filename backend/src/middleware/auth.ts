import { Request, Response, NextFunction } from "express";
import jwt from '../utils/jwt'

const auth = (req: Request, res: Response, next: NextFunction) => {
    const token = req.header("Authorization");
    if (!token || !token.startsWith("Bearer ")) {
        res.status(401).json({ message: "Unauthorized" });
        return
    }
    const authToken = token.split(" ")[1];
    try {
        const user = jwt.verify(authToken, process.env.JWT_SECRET_KEY);
        if (!user) {
            res.status(403).json({ message: "Forbidden" });
            return
        }
        req.user = user;
        next();
    } catch (error) {
        console.error(error);
        res.status(401).json("Failed to verify token");
    }
}

export default auth