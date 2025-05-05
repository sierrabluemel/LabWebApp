import { Request, Response } from "express";
import pdf from "../utils/pdf";
import order from "../models/order";
import { isNullOrEmpty } from "../utils/common";

const orderRoutes = {
    createOrder: (req: Request, res: Response) => {
        let timestamp = req.query.received_timestamp as string ?? new Date();
        let customerOrderNumber = req.query.customer_order_number as string ?? "";
        let customerId = parseInt(req.query.customer_id as string ?? "");
        let expedited = eval(req.query.expedited as string);

        if (
            !timestamp ||
            isNaN(customerId) ||
            (expedited != true && expedited != false) ||
            !customerOrderNumber) {
            res.status(500).json({ error: "Missing arguments" });
            return;
        }

        order.createOrder(timestamp, customerOrderNumber, customerId, expedited)
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "Unable to create order." });
            })
    },
    getOrderById: (req: Request, res: Response) => {
        const orderId = parseInt(req.query.order_id as string ?? "");

        if (isNaN(orderId)) {
            res.status(500).json({ error: `Missing order id` });
            return;
        }
        order.getOrderById(orderId)
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: "Error fetching order" });
            })
    },
    getOrdersToShip: (req: Request, res: Response) => {
        order.getOrdersToShip()
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                res.status(500).json({ error: `Error fetching orders` });
            });
    },
    setOrderShipped: (req: Request, res: Response) => {
        const orderId = parseInt(req.query.order_id as string ?? "");
        const name = req.query.name as string;
        const timestamp = new Date().toISOString()

        if (isNaN(orderId) || isNullOrEmpty(name)) {
            res.status(500).json({ error: `Missing order ID or courier name.` });
            return;
        }

        order.setOrderShipped(orderId, name, timestamp)
            .then((result) => {
                res.json(result);
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: `Error setting order as shipped` });
            });
    },
    setOrderActiveState: (req: Request, res: Response) => {
        const orderId = parseInt(req.query.order_id as string ?? "");
        const activeState = eval(req.query.active_state as string);

        if (isNaN(orderId)) {
            res.status(500).json({ error: `No order ID present.` });
            return;
        }

        order.setOrderActiveState(orderId, activeState)
            .then(() => {
                res.json({ 'Result': `Order ${orderId} active state set to ${activeState}` })
            })
            .catch((err) => {
                res.status(500).json({ error: `Error setting order status.` });
            });
    },
    // @TODO does this work????
    generateReturnRecord: (req: Request, res: Response) => {
        const orderId = parseInt(req.query.order_id as string ?? "");
        const print = eval(req.query.print as string);

        if (isNaN(orderId)) {
            res.status(500).json({ error: `No order ID present.` });
            return;
        }

        order.getOrderDetails(orderId)
            .then((data) => {
                let date = data.shipped_timestamp ? new Date(data.shipped_timestamp) : new Date();

                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');

                const fields = {
                    'date': `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`,
                    'time': `${hours}:${minutes}:${seconds}`,
                    'technician': `${data.first_name} ${data.last_name}`,
                    'clientName': `${data.name}`,
                    'address1': `${data.address_line_1}, ${data.address_line_2}`,
                    'address2': `${data.city}, ${data.state} ${data.zip_code}`,
                    'contactName': `${data.contact_name}`,
                    'email': `${data.contact_email}`,
                    'orderNumber': `${orderId}`,
                    'shipVia': 'N/A',
                    'shipDate': 'N/A',
                    'trackingNumber': 'N/A',
                    'notes': '',
                    'scAddress1': '450 North, Flint Street',
                    'scAddress2': 'Kaysville, Utah 84037'
                } as any

                return pdf.fillForm('returnRecordTemplate.pdf', fields);
            })
            .then(async (bytes) => {
                return pdf.addSensorsToReturnRecord(bytes, await order.getSensorsOnOrder(orderId));
            })
            .then((finishedFormBytes) => {
                if (print) {
                    pdf.printPdf(new Blob([finishedFormBytes]));
                }
                res.setHeader("Content-Disposition", `attachment; filename=returnRecord${orderId}.pdf`);
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(Buffer.from(finishedFormBytes));
            })
            .catch((err) => {
                console.error(err);
            })
    }
};

export default orderRoutes;