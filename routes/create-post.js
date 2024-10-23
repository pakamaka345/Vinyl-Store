import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
dotenv.config();
const POST_PATH = process.env.POST_DATA_PATH;

router.post('/post', (req, res) => {
    const { title, description } = req.body;
    const userId = req.id;

    if (!title || title.length < 3)
        return res
            .status(400)
            .send(
                'Title is required and should be at least 3 characters long.'
            );

    if (!description || description.length < 10)
        return res
            .status(400)
            .send(
                'Description is required and should be at least 10 characters long.'
            );

    try {
        const post = {
            id: uuidv4(),
            title,
            description,
            date: new Date().toISOString(),
            userId,
        };

        const postReadStream = fs.createReadStream(POST_PATH, {
            encoding: 'utf8',
        });

        let posts = [];

        postReadStream.on('data', (data) => {
            posts.push(data);
        });

        postReadStream.on('end', () => {
            posts = JSON.parse(posts.join(''));
            posts.push(post);

            const postStream = fs.createWriteStream(POST_PATH, {
                flags: 'w',
            });
            postStream.write(JSON.stringify(posts, null, 2));
            postStream.end();

            res.status(201).send('Post created successfully.');
        });

        postReadStream.on('error', (err) => {
            res.status(500).send('An error occurred. Please try again later.');
        });
    } catch (err) {
        res.status(500).send('An error occurred. Please try again later.');
    }
});

export default router;
