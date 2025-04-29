import { Request, Response } from "express";
import { pool } from "../utils/db";
import format from "pg-format";

const client = {
    getQuotes: async (req: Request, res: Response) => {
        // @TODO from ukranian guy - check where its used
        const { user } = req;
        const result = await pool.query(
            `
            SELECT rq.*, json_agg(rqi) AS "requestQuoteItems"
            FROM "request-quote"  rq
            LEFT JOIN "request-quote-item"  rqi ON rq.id = rqi."requestQuoteId"
            WHERE rq."createdById" = $1
            GROUP BY rq.id, rq."createdAt"
            ORDER BY rq."createdAt" desc
        `,
            [user.id]
        );
        res.status(200).json(result.rows);
    },
    insertQuote: async (req: Request, res: Response) => {
        // @TODO from ukranian guy - check where its used
        const { user } = req;
        const { name, email, phone, company, address1, address2, items } = req.body;
        pool.connect(async (error, client, release) => {
            try {
                await client?.query("BEGIN");
                const result = await pool.query(
                    'INSERT INTO "request-quote" ("name", "email", "phone", "company", "address1", "address2", "createdById") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                    [name, email, phone, company, address1, address2, user.id]
                );

                const requestQuoteCreated = result.rows[0];
                const itemsInsertPayload = items.map((data: any) => [
                    data.calibrationType,
                    data.manufacturer,
                    data.modelNo,
                    data.serial,
                    data.calibrationLevel,
                    data.interval,
                    data.qty,
                    data.comment,
                    requestQuoteCreated.id,
                ]);

                const itemsCreated = await client?.query(
                    format(
                        'INSERT INTO "request-quote-item" ("calibrationType", "manufacturer", "modelNo", "serial", "calibrationLevel", "interval", "qty", "comment", "requestQuoteId") VALUES %L RETURNING *',
                        itemsInsertPayload
                    )
                );
                await client?.query("COMMIT");
                res
                    .status(201)
                    .json({ ...requestQuoteCreated, requestQuoteItems: itemsCreated!.rows });
            } catch (error) {
                console.error(error);
                await client?.query("ROLLBACK");
                res.status(500).send(error);
            } finally {
                release();
            }
        });
    },
};

export default client;