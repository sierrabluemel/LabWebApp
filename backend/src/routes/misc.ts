import { Request, Response } from "express";
import misc from "../models/misc";

const miscRoutes = {
    getSearchResults: (req: Request, res: Response) => {
        const searchType = req.query.search_type as string;
        const searchValue = req.query.search_value as string;

        if (!misc.searchTypes.includes(searchType) || !searchValue) {
            res.status(400).json({ error: 'Invalid search type' });
            return;
        }

        // Whole orders are too big to list sensor by sensor; the portal expands a batch on demand
        const isOrderSearch = ['order_id', 'customer_order_number'].includes(searchType);
        const search = isOrderSearch ? misc.getSearchBatchSummaries : misc.getSearchResults;

        search(searchType, searchValue)
            .then((data) => {
                return res.status(200).json(data);
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: 'Error in search' });
            });
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
                return res.status(500).json({ error: `Error getting variances` });
            });
    },
    getHumidityVariances: (req: Request, res: Response) => {
        misc.getHumidityVariances()
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error getting humidity variances` });
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
    createHumidityVariance: (req: Request, res: Response) => {
        const assetTag = req.query.asset_tag as string ?? "";
        const temperature = parseFloat(req.query.temperature as string ?? "");
        const humidity = parseFloat(req.query.humidity as string ?? "");
        const calibrationUncertainty = parseFloat(req.query.calibration_uncertainty as string ?? "");
        const readingResolutionUncertainty = parseFloat(req.query.reading_resolution_uncertainty as string ?? "");
        const interpolationUncertainty = parseFloat(req.query.interpolation_uncertainty as string ?? "");
        const driftUncertainty = parseFloat(req.query.drift_uncertainty as string ?? "");
        const hysteresisUncertainty = parseFloat(req.query.hysteresis_uncertainty as string ?? "");
        const gasTemperatureDependanceUncertainty = parseFloat(req.query.gas_temperature_dependance_uncertainty as string ?? "");
        const heatDissipationUncertainty = parseFloat(req.query.heat_dissipation_uncertainty as string ?? "");
        const selfHeatingUncertainty = parseFloat(req.query.self_heating_uncertainty as string ?? "");

        misc.createHumidityVariance(assetTag, temperature, humidity, calibrationUncertainty, readingResolutionUncertainty, interpolationUncertainty, driftUncertainty, hysteresisUncertainty, gasTemperatureDependanceUncertainty, heatDissipationUncertainty, selfHeatingUncertainty)
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
    updateSetPointMinutes: (req: Request, res: Response) => {
        const calibrationProcedureId = parseInt(req.query.calibration_procedure_id as string ?? "");
        const index = parseInt(req.query.set_point_index as string ?? "");
        const minutes = parseFloat(req.query.minutes as string ?? "");

        if (isNaN(calibrationProcedureId) || isNaN(index) || index < 0 || !(minutes > 0))
            return res.status(400).json({ error: `calibration_procedure_id, set_point_index and a positive minutes are required` });

        misc.updateSetPointMinutes(calibrationProcedureId, index, minutes)
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error updating set point minutes` });
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
    changeHumidityVarianceActiveState: (req: Request, res: Response) => {
        const varianceId = parseInt(req.query.variance_id as string ?? "");
        const activeState = req.query.active_state as unknown as boolean ?? false;

        misc.changeHumidityVarianceActiveState(varianceId, activeState)
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
    getNotifications: (req: Request, res: Response) => {
        let technicianId = parseInt(req.query.technician_id as string ?? "");

        misc.getNotifications(technicianId)
            .then((result) => {
                res.status(200).json(result)
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error getting technician` });
            });
    },
    createNotification: (req: Request, res: Response) => {
        const title = req.query.title as string;
        const description = req.query.description as string;
        const notifyDate = new Date(req.query.notify_date as any);
        const technicianId = parseInt(req.query.technician_id as any);
        const repeatable = req.query.repeatable as any as boolean;
        const repeatInterval = parseInt(req.query.repeat_interval as any) || null;
        const repeatUnit = req.query.repeat_unit as string || null;

        misc.createNotification(title, description, notifyDate, technicianId, repeatable, repeatInterval, repeatUnit)
            .then(() => { res.status(200).json({ Result: 'Success' }) })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error creating notification` });
            });
    },
    dismissNotification: (req: Request, res: Response) => {
        let notificationId = parseInt(req.query.notification_id as string ?? "");

        misc.getNotification(notificationId)
            .then(notification => {
                if (notification.repeatable) {
                    let updatedNotifyDate = new Date();
                    updatedNotifyDate.setUTCHours(0, 0, 0, 0);
                    switch (notification.repeat_unit) {
                        default:
                            console.error(`Unable to update date with unknown repeat unit: ${notification.repeat_unit}`);
                            res.status(500).json({ error: `Error updating notification date` });
                            break;
                        case 'days':
                            updatedNotifyDate.setDate(updatedNotifyDate.getDate() + notification.repeat_interval);
                            break;
                        case 'months':
                            updatedNotifyDate.setMonth(updatedNotifyDate.getMonth() + notification.repeat_interval);
                            break;
                        case 'years':
                            updatedNotifyDate.setFullYear(updatedNotifyDate.getFullYear() + notification.repeat_interval);
                            break;
                    }
                    misc.updateNotificationDate(notificationId, updatedNotifyDate)
                        .then(() => { res.status(200).json({ Result: 'Success' }) })
                } else {
                    misc.dismissNotification(notificationId)
                        .then(() => { res.status(200).json({ Result: 'Success' }) })
                }
            })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error dismissing notification` });
            });

    },
    getTechnicians: (req: Request, res: Response) => {
        misc.getTechnicians()
            .then(technicians => { res.status(200).json(technicians) })
            .catch((err) => {
                console.error(err);
                return res.status(500).json({ error: `Error getting technicians` });
            });
    },
}
export default miscRoutes;