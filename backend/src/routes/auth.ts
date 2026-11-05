import { Request, Response } from "express";
import jwt from '../utils/jwt'
import crypt from "../utils/crypt";
import config from "../utils/config";
import sendMailVerification from "../utils/mail";
import user from "../models/user";
import misc from "../models/misc";
import { JWT_ACCESS_TIMESPAN, JWT_REFRESH_TIMESPAN } from "../constants";

const authRoutes = {
    refresh: async (req: Request, res: Response) => {
        const token = req.header("Refresh");
        if (!token || !token.startsWith("Bearer ")) {
            res.status(401).json({ message: "Unauthorized" });
            return
        }
        const authToken = token.split(" ")[1];
        try {
            const { email, tokenType } = jwt.verify(authToken, config.JWT_SECRET_KEY) as any;
            if (tokenType !== "refresh") {
                res.status(403).json({ message: "Forbidden" });
                return
            }

            user.getByEmail(email)
                .then((u) => {
                    delete u.password;
                    u.tokenType = "auth"
                    const accessToken = jwt.generateToken(u, JWT_ACCESS_TIMESPAN)
                    res.status(200).json(accessToken);
                })
        } catch (error: any) {
            if (error.name === "TokenExpiredError") {
                res.status(418).json({ message: "Token has expired" });
            } else {
                console.error(error);
                res.status(401).json({ message: `Failed to verify token (error name: ${error.name}`});
            }
        }
    },
    signIn: async (req: Request, res: Response) => {
        const { email, password } = req.body;

        user.getByEmail(email)
            .then(async (u) => {
                if (!u) {
                    res.status(404).json({ error: `User not found` });
                    return
                }
                if (!u.isVerified) {
                    res.status(403).json({ error: `User has not been verified` });
                    return
                }
                const isComparePassword = await crypt.verify(password, u.password);

                if (!isComparePassword) {
                    res.status(400).json({ error: `Username and password are not correct` });
                    return;
                }
                delete u.password;

                u.tokenType = "auth"

                const refreshToken = jwt.generateToken({ email, tokenType: "refresh" }, JWT_REFRESH_TIMESPAN)
                const accessToken = jwt.generateToken(u, JWT_ACCESS_TIMESPAN)

                delete u.tokenType;

                u = {
                    ...u,
                    accessToken,
                    refreshToken,
                }
                res.status(200).json(u);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json("Error logging in user");
            });
    },
    signUp: async (req: Request, res: Response) => {
        const { email, password, lastName, firstName } = req.body;

        user.getByEmail(email)
            .then(async (u) => {
                if (u) {
                    res.status(409).json({ error: `User with that email already exists` });
                    return;
                }
                const hashPass = await crypt.hashAndValidatePassword(
                    password,
                    Number(process.env.SALT_ROUNDS || 10)
                );
                return user.createUser(firstName, lastName, email, hashPass)
            })
            .then(async (u) => {
                const userConfirmationToken = {
                    id: u.id,
                    email: u.email,
                };
                const token = jwt.generateToken(
                    userConfirmationToken,
                    "30m"
                );
                console.log('token :>> ', token);
                await sendMailVerification("VERIFICATION_ACCOUNT", {
                    email,
                    token,
                });
                res.status(201).json(u);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json("Error creating user");
            });

    },
    verify: (req: Request, res: Response) => {
        const { token } = req.body;
        const tokenDecode = jwt.verify(token, config.JWT_SECRET_KEY) as any;
        user.setVerified(tokenDecode.id, true)
            .then(() => {
                return res.status(200).json({ message: 'Success' });
            });
    },
    resendVerifyEmail: async (req: Request, res: Response) => {
        const { email } = req.body;

        user.getByEmail(email)
            .then(async (u) => {
                if (!u) {
                    res.status(404).json({ error: `User not found` });
                    return;
                }
                const userConfirmationToken = {
                    id: u.id,
                    email: u.email,
                };
                const token = jwt.generateToken(
                    userConfirmationToken,
                    "30m"
                );
                return sendMailVerification("VERIFICATION_ACCOUNT", {
                    email,
                    token,
                });
            })
            .then(() => {
                res.status(200).json({
                    message:
                        "Email sent successfully. Please check your email for further instructions.",
                });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json("Unable to resend email");
            })
    },
    forgotPassword: async (req: Request, res: Response) => {
        const { email } = req.body;

        user.getByEmail(email)
            .then((u) => {
                if (!u) {
                    res.status(404).json({ error: `User not found` });
                    return;
                }
                const userConfirmationToken = {
                    id: u.id,
                    email: u.email,
                };
                const token = jwt.generateToken(
                    userConfirmationToken,
                    "30m"
                );
                return sendMailVerification("FORGOT_PASSWORD", {
                    email,
                    token,
                });
            })
            .then(() => {
                res.status(200).json({
                    message:
                        "Password reset request successfully processed. Please check your email for further instructions.",
                });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "Unable to send password reset" });
            })
    },
    resendForgotPasswordEmail: async (req: Request, res: Response) => {
        // Don't even know why this is a separate route
        // Dude, I don't either...
        return authRoutes.forgotPassword(req, res);
    },
    verifyResetPassword: async (req: Request, res: Response) => {
        let email: string;
        try {
            ({ email } = jwt.verify(
                req.headers.authorization?.replace("Bearer ", "") || "",
                config.JWT_SECRET_KEY
            ) as any);
        } catch {
            res.status(401).json({ error: "Invalid or expired token" });
            return;
        }

        user.getByEmail(email)
            .then(async (u) => {
                if (!u) {
                    res.status(404).json({ error: `User not found` });
                    return;
                }
                const hashPass = await crypt.hashAndValidatePassword(
                    req.body.newPassword,
                    Number(process.env.SALT_ROUNDS || 10)
                );
                return user.changePassword(u.id, hashPass);
            })
            .then((u) => {
                delete u.password;
                res.status(200).json(u);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json("Error resetting password");
            });
    },
    createTechnician: (req: Request, res: Response) => {
        const { email, password, lastName, firstName, admin } = req.body;
        if (!email || !password || !firstName || !lastName) {
            res.status(400).json({ error: "First name, last name, email and password are required" });
            return;
        }

        user.getByEmail(email)
            .then(async (u) => {
                if (u) {
                    res.status(409).json({ error: `User with that email already exists` });
                    return;
                }
                const hashPass = await crypt.hashAndValidatePassword(password, Number(process.env.SALT_ROUNDS || 10));
                const created = await user.createUser(firstName, lastName, email, hashPass);
                await user.setVerified(created.id, true); // no verification email for lab accounts
                const technician = await misc.createTechnician(created.id, firstName, lastName, !!admin);
                res.status(201).json(technician);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "Error creating technician" });
            });
    },
    setPassword: (req: Request, res: Response) => {
        const userId = parseInt(req.body.user_id);
        const { password } = req.body;
        if (isNaN(userId) || !password) {
            res.status(400).json({ error: "Technician and new password are required" });
            return;
        }

        crypt.hashAndValidatePassword(password, Number(process.env.SALT_ROUNDS || 10))
            .then((hashPass) => user.changePassword(userId, hashPass))
            .then((u) => {
                if (!u) {
                    res.status(404).json({ error: "User not found" });
                    return;
                }
                res.status(200).json({ message: "Password updated" });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "Error setting password" });
            });
    },
    me: (req: Request, res: Response) => {
        const reqUser = req.user;

        user.getById(reqUser.id)
            .then((u) => {
                if (!u) {
                    return res.status(404).json({ error: 'User not found' });
                }
                res.status(200).json(u);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: 'Error' });
            });
    }
}

export default authRoutes