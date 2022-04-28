import express, { json } from 'express';
import cors from 'cors';

import dotenv from 'dotenv';
dotenv.config();

import { MongoClient } from 'mongodb';
import chalk from 'chalk';

import dayjs from 'dayjs';

const app = express();
app.use(cors());
app.use(json());

const mongoClient = new MongoClient(process.env.MONGO_URL);

app.post('/participants', async (req, res) => {
    const { name } = req.body;
    if (!name) res.sendStatus(422);
    try {
        await mongoClient.connect();
        let db = mongoClient.db('batepapo-uol');

        const checkName = await db
            .collection('participantes')
            .findOne({ name: name });
        console.log(chalk.bold.yellow(checkName));
        if (checkName) {
            res.sendStatus(409);
        } else {
            const currentTime = dayjs().format('HH:mm:ss');
            await db
                .collection('participantes')
                .insertOne({ name: name, lastStatus: Date.now() });
            await db.collection('mensagens').insertOne({
                from: name,
                to: 'Todos',
                text: 'entra na sala...',
                type: 'status',
                time: currentTime,
            });
            res.sendStatus(201);
        }

        mongoClient.close();
    } catch (e) {
        console.error(chalk.bold.red('Could not get participants'), e);
        res.sendStatus(500);
        mongoClient.close();
    }
});

app.listen(5000, () => {
    console.log(chalk.bold.green('Server is listening on port 5000'));
});
