import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();
const router = express.Router();
const PATH = process.env.POST_DATA_PATH;

router.delete('post/:id', (req, res) => {
    const id = req.params.id;
    const userId = req.id;
    if (!id) {
        return res.status(400).send('Post ID is required.');
    }

    if (!userId) {
        return res.status(400).send('User ID is required.');
    }

    const readStream = fs.createReadStream(PATH, { encoding: 'utf8' });
    let posts = [];

    readStream.on('data', (data) => {
        posts.push(data);
    });

    readStream.on('end', () => {
        posts = JSON.parse(posts.join(''));

        const post = posts.find((post) => post.id === id && post.userId === userId);
        if (!post) {
            return res.status(404).send('Post not found.');
        }

        posts = posts.filter((post) => post.id !== id && post.userId === userId);

        const writeStream = fs.createWriteStream(PATH, { encoding: 'utf8' });
        writeStream.write(JSON.stringify(posts, null, 2));
        writeStream.end();

        res.status(201).send('Post deleted successfully.');
    });

    readStream.on('error', (err) => {
        res.status(500).send('An error occurred. Please try again later.');
    });
});

export default router;
