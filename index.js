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
            console.log(chalk.bold.blue('Posted partipants'));
        }

        mongoClient.close();
    } catch (e) {
        console.error(chalk.bold.red('Could not post participants'), e);
        res.sendStatus(500);
        mongoClient.close();
    }
});

app.get('/participants', async (req, res) => {
    try {
        await mongoClient.connect();

        let db = mongoClient.db('batepapo-uol');

        const participants = await db
            .collection('participantes')
            .find()
            .toArray();

        res.send(participants);

        mongoClient.close();
    } catch (e) {
        console.error(chalk.bold.red('Could not get participants'), e);
        res.sendStatus(500);
        mongoClient.close();
    }
});

app.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const user = req.headers.user;
    try {
        await mongoClient.connect();
        let db = mongoClient.db('batepapo-uol');
        const currentTime = dayjs().format('HH:mm:ss');

        await db.collection('mensagens').insertOne({
            from: user,
            to: to,
            text: text,
            type: type,
            time: currentTime,
        });
        res.sendStatus(201);
        console.log(chalk.bold.blue('Posted partipants'));

        mongoClient.close();
    } catch (e) {
        console.error(chalk.bold.red('Could not get participants'), e);
        res.sendStatus(500);
        mongoClient.close();
    }
});

app.get('/messages', async (req, res) => {
    const limit = parseInt(req.query.limit);
    const user = req.headers.user;
    try {
        await mongoClient.connect();
        let db = mongoClient.db('batepapo-uol');

        const allMessagesInDb = await db
            .collection('mensagens')
            .find()
            .toArray();
        const messages = allMessagesInDb.filter((msg) => {
            if (msg.type === 'public' || msg.from === user || msg.to === user)
                return true;
        });
        if (limit === undefined) res.send([...allMessagesInDb].reverse());
        else if (messages.length <= limit) res.send([...messages].reverse());
        else res.send([...messages].reverse().splice(0, limit));
        mongoClient.close();
    } catch (e) {
        console.error(chalk.bold.red('Could not get messages'), e);
        res.sendStatus(500);
        mongoClient.close();
    }
});

app.post('/status', async (req, res) => {
    const user = req.headers.user;
    try {
        await mongoClient.connect();
        let db = mongoClient.db('batepapo-uol');
        const checkUser = await db
            .collection('participantes')
            .findOne({ name: user });
        if (!checkUser) {
            res.sendStatus(404);
            mongoClient.close();
            return;
        }

        await db.updateOne(
            {
                lastStatus: Date.now(),
            },
            { $set: req.body }
        );

        res.sendStatus(200);
        mongoClient.close();
    } catch (e) {
        console.error(chalk.bold.red('Could not get messages'), e);
        res.sendStatus(500);
        mongoClient.close();
    }
});

app.listen(5000, () => {
    console.log(chalk.bold.green('Server is listening on port 5000'));
});
