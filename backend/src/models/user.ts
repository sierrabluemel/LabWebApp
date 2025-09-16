import { executeNonQuery, executeQuery, executeQuerySingleReturn, pool, rollingDataPool } from "../utils/db";

const user = {
    getById: (userId: number) => {
        return executeQuerySingleReturn(pool, `
            SELECT
                *
            FROM
                "user"
            WHERE
                ID = $1
            LIMIT
                1
        `, [userId]);
    },
    getByEmail: (email: string) => {
        return executeQuerySingleReturn(pool, `
            SELECT
                *
            FROM
                "user"
            WHERE
                EMAIL = $1
            LIMIT 1
        `, [email]);
    },
    setVerified: (userId: number, value: boolean) => {
        return executeQuerySingleReturn(pool, `
            UPDATE "user"
            SET
                "isVerified" = $1
            WHERE
                "id" = $2
            RETURNING
                *
        `, [value, userId])
    },
    createUser: (firstName: string, lastName: string, email: string, password: string) => {
        return executeQuerySingleReturn(pool, `
            INSERT INTO
                "user" ("firstName", "lastName", "email", "password")
            VALUES
                ($1, $2, $3, $4)
            RETURNING
                *
        `, [firstName, lastName, email, password]);
    },
    changePassword: (userId: number, password: string) => {
        return executeQuerySingleReturn(pool, `
            UPDATE "user"
            SET
                "password" = $1
            WHERE
                "id" = $2
            RETURNING
                *
        `, [password, userId]);
    }
};

export default user;