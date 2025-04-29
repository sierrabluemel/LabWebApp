import mail from "@sendgrid/mail";
import config from './config'
import path from "path";
import fs from 'fs';
import handlebars from 'handlebars'

mail.setApiKey(config.SENDGRID_API_KEY);

async function sendMailVerification(type: string, payload: any) {
    try {
        const { email, token } = payload;
        const frontEndDomain = process.env.FRONT_END_DOMAIN;
        let rootUrl = "";
        let pathFile = "";
        let subject = "";
        let messageLog = "";

        switch (type) {
            case "VERIFICATION_ACCOUNT": {
                rootUrl = `${frontEndDomain}/auth/verify-email`;
                pathFile = "./templates/mail/verification-link-template.hbs";
                subject = "Account verification email";
                messageLog = `Account verification email has been sent to email ${email} successfully`;
                break;
            }

            case "FORGOT_PASSWORD": {
                rootUrl = `${frontEndDomain}/forgot-password/reset`;
                pathFile = "./templates/mail/reset-password-template.hbs";
                subject = "Reset password";
                messageLog = `Reset password email has been sent to email ${email} successfully`;
                break;
            }

            default: {
                console.warn(`Type ${type} no supported`);
                return;
            }
        }

        const url = `${rootUrl}?token=${token}`;
        const filePath = path.join(__dirname, pathFile);
        const source = fs.readFileSync(filePath, "utf-8").toString();
        const template = handlebars.compile(source);
        const replacements = {
            email,
            url,
        };
        const htmlToSend = template(replacements);
        const message = {
            to: email,
            from: {
                name: "Sensorcalibrations",
                email: config.MAIL,
            },
            subject,
            html: htmlToSend,
        };
        const result = await mail.send(message);
        return result;
    } catch (e) {
        console.error(e);
        throw e;
    }
}

export default sendMailVerification