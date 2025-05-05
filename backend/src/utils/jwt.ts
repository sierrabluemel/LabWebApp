import jsonwebtoken from "jsonwebtoken"
import config from '../utils/config'

const jwt = {
    generateToken: (payload: any, expiresIn: any) => {
        return jsonwebtoken.sign(payload, config.JWT_SECRET_KEY, {
            expiresIn,
        } as jsonwebtoken.SignOptions);
    },
    decode: (token: any) => {
        return jsonwebtoken.decode(token);
    },
    verify: (token: any, secretKey: any) => {
        return jsonwebtoken.verify(token, secretKey);
    }
}

export default jwt