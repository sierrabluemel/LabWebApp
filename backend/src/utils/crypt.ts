import { compare, hash } from "bcrypt";
const sha256 = require('js-sha256');

const crypt = {
    hashAndValidatePassword: async (password: string, saltRounds: number) => {
        return hash(password, saltRounds);
    },
    verify: async (password: string, hashPassword: string) => {
        if (!hashPassword) {
            return false;
        }
        return compare(password, hashPassword);
    },
    hashPassword: async (password: string, hashString: string, preHashSalt = 'hash-password') => {
        return sha256.hmac.create(preHashSalt).update(`${hashString}${preHashSalt}${password}`).hex();
    },
}

export default crypt;