import express from 'express';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

const router = express.Router();
dotenv.config();
const PATH = process.env.USER_DATA_PATH;

router.post('/login', (req, res) => {
    let { email, password } = req.body;

    if (!email || !password)
        return res.status(400).send('All input is required.');

    try {
        const stream = fs.createReadStream(PATH, { encoding: 'utf8' });
        let users = [];

        stream.on('data', (data) => {
            users.push(data);
        });

        stream.on('end', () => {
            users = JSON.parse(users.join(''));

            let user = users.find(
                (u) =>
                    u.email === email &&
                    bcrypt.compareSync(password, u.password)
            );

            if (!user) return res.status(400).send('Invalid credentials.');

            let token = jwt.sign({ id: user.id }, process.env.SECRET_KEY, {
                expiresIn: '24h',
            });

            res.status(200).send({ token });
        });

        stream.on('error', (err) => {
            res.status(500).send(
                'An error occurred. Please try again later.' + err
            );
        });
    } catch (err) {
        res.status(500).send(
            'An error occurred. Please try again later.' + err
        );
    }
});

export default router;
