import jsonwebtoken from "jsonwebtoken"

const jwt = {
    generateToken: (payload: any, secretKey: any, expiresIn = "1d") => {
        return jsonwebtoken.sign(payload, secretKey, {
            expiresIn,
        } as jsonwebtoken.SignOptions);
    },
    generateTokens: (payload: any, secretKey: any, expiresIn = "1d") => {
        const accessToken = jwt.generateToken(payload, secretKey, expiresIn);
        const refreshToken = jwt.generateToken(payload, secretKey, "7d");
        return { accessToken, refreshToken };
    },
    decode: (token: any) => {
        try {
            return jsonwebtoken.decode(token);
        } catch (error) {
            console.log('JWT decode error ', error);
        }
    },
    verify: (token: any, secretKey: any) => {
        return jsonwebtoken.verify(token, secretKey);
    }
}

export default jwt