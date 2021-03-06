import express, { json } from 'express';
import cors from 'cors';

import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, ObjectId } from 'mongodb';
import chalk from 'chalk';
import joi from 'joi';
import dayjs from 'dayjs';
import { stripHtml } from 'string-strip-html';

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
    let { name } = req.body;

    name = stripHtml(name).result.trim();

    const userSchema = joi.object({
        name: joi.string().required(),
    });
    const validation = userSchema.validate({ name }, { abortEarly: true });

    if (validation.error) {
        console.log(validation.error.details);
        res.sendStatus(422);
        return;
    }

    try {
        const checkName = await db
            .collection('participantes')
            .findOne({ name: name });
        if (checkName) {
            res.sendStatus(409);
            return;
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
            res.send({ name: name }).status(201);
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
    let { to, text, type } = req.body;
    let user = req.headers.user;

    to = stripHtml(to).result.trim();
    text = stripHtml(text).result.trim();
    type = stripHtml(type).result.trim();
    user = stripHtml(user).result.trim();

    const userSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.any().valid('message', 'private_message'),
    });

    const validation = userSchema.validate(
        { to, text, type },
        { abortEarly: true }
    );

    if (validation.error) {
        console.log(validation.error.details);
        res.sendStatus(422);
        return;
    }

    try {
        const checkFrom = await db
            .collection('participantes')
            .findOne({ name: user });

        if (!checkFrom) {
            res.sendStatus(422);
            return;
        }

        const currentTime = dayjs().format('HH:mm:ss');

        await db.collection('mensagens').insertOne({
            from: user,
            to: to,
            text: text,
            type: type,
            time: currentTime,
        });
        res.sendStatus(201);
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

app.delete('/messages/:MESSAGE_ID', async (req, res) => {
    const { user } = req.headers;
    const { MESSAGE_ID } = req.params;

    try {
        const checkMessage = await db
            .collection('mensagens')
            .findOne({ _id: new ObjectId(MESSAGE_ID) });
        if (!checkMessage) {
            res.sendStatus(404);
            return;
        }
        if (checkMessage.from !== user) {
            res.sendStatus(401);
            return;
        }
        await db
            .collection('mensagens')
            .deleteOne({ _id: new ObjectId(MESSAGE_ID) });
    } catch (e) {
        console.error(chalk.bold.red('Could not delete message'), e);
        res.sendStatus(500);
    }
});

app.put('/messages/:MESSAGE_ID', async (req, res) => {
    let { to, text, type } = req.body;
    let { user } = req.headers;
    const { MESSAGE_ID } = req.params;

    to = stripHtml(to).result.trim();
    text = stripHtml(text).result.trim();
    type = stripHtml(type).result.trim();
    user = stripHtml(user).result.trim();

    const userSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.any().valid('message', 'private_message'),
    });

    const validation = userSchema.validate(
        { to, text, type },
        { abortEarly: true }
    );

    if (validation.error) {
        console.log(validation.error.details);
        res.sendStatus(422);
        return;
    }

    try {
        const checkFrom = await db
            .collection('participantes')
            .findOne({ name: user });

        if (!checkFrom) {
            res.sendStatus(422);
            return;
        }
        const checkMessage = await db
            .collection('mensagens')
            .findOne({ _id: new ObjectId(MESSAGE_ID) });
        if (!checkMessage) {
            res.sendStatus(404);
            return;
        }
        if (checkMessage.from !== user) {
            res.sendStatus(401);
            return;
        }

        await db.collection('mensagens').updateOne(
            {
                _id: new ObjectId(MESSAGE_ID),
            },
            { $set: { from: user, to: to, text: text, type: type } }
        );
    } catch (e) {
        console.error(chalk.bold.red('Could not update message'), e);
        res.sendStatus(500);
    }
});

app.listen(5000, () => {
    console.log(chalk.bold.green('Server is listening on port 5000'));
});
