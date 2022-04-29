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
let db;

mongoClient.connect().then(() => {
    db = mongoClient.db('batepapo-uol');
    setInterval(async () => {
        try {
            const participantsColection = await db.collection('participantes');
            let participants = await participantsColection.find().toArray();

            if (participants) {
                participants.forEach(async (e) => {
                    if (Date.now() - e.lastStatus >= 10000) {
                        const currentTime = dayjs().format('HH:mm:ss');
                        await db.collection('mensagens').insertOne({
                            from: e.name,
                            to: 'Todos',
                            text: 'sai da sala...',
                            type: 'status',
                            time: currentTime,
                        });

                        await participantsColection.deleteOne(e);
                    }
                });
            }
        } catch (e) {
            console.log(chalk.bold.red('Error update participants status'), e);
        }
    }, 15000);
});

app.post('/participants', async (req, res) => {
    const { name } = req.body;
    if (!name) res.sendStatus(422);
    try {
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
    } catch (e) {
        console.error(chalk.bold.red('Could not post participants'), e);
        res.sendStatus(500);
    }
});

app.get('/participants', async (req, res) => {
    try {
        const participants = await db
            .collection('participantes')
            .find()
            .toArray();

        res.send(participants);
    } catch (e) {
        console.error(chalk.bold.red('Could not get participants'), e);
        res.sendStatus(500);
    }
});

app.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const user = req.headers.user;
    try {
        const currentTime = dayjs().format('HH:mm:ss');

        await db.collection('mensagens').insertOne({
            from: user,
            to: to,
            text: text,
            type: type,
            time: currentTime,
        });
        res.sendStatus(201);
        console.log(chalk.bold.blue('Posted messages'));
    } catch (e) {
        console.error(chalk.bold.red('Could not get messages'), e);
        res.sendStatus(500);
    }
});

app.get('/messages', async (req, res) => {
    const limit = parseInt(req.query.limit);
    const user = req.headers.user;
    try {
        const allMessagesInDb = await db
            .collection('mensagens')
            .find()
            .toArray();
        const messages = allMessagesInDb.filter((msg) => {
            if (
                msg.type === 'message' ||
                msg.type === 'status' ||
                msg.from === user ||
                msg.to === user
            )
                return true;
        });
        if (limit === undefined) res.send([...allMessagesInDb]);
        else if (messages.length <= limit) res.send([...messages]);
        else
            res.send(
                [...messages].splice(messages.length - limit, messages.length)
            );
    } catch (e) {
        console.error(chalk.bold.red('Could not get messages'), e);
        res.sendStatus(500);
    }
});

app.post('/status', async (req, res) => {
    const user = req.headers.user;
    try {
        const checkUser = await db
            .collection('participantes')
            .findOne({ name: user });
        if (!checkUser) {
            res.sendStatus(404);
            return;
        }

        await db.collection('participantes').updateOne(
            {
                name: user,
            },
            { $set: { lastStatus: Date.now() } }
        );

        res.sendStatus(200);
    } catch (e) {
        console.error(chalk.bold.red('Could not post status'), e);
        res.sendStatus(500);
    }
});

app.listen(5000, () => {
    console.log(chalk.bold.green('Server is listening on port 5000'));
});
