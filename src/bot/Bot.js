import TelegramBot from 'node-telegram-bot-api';
import Message from './Message.js';
import AbstractThread from '../threads/AbstractThread.js';
import { callbackStore } from './Callbacks.js';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});


export default class Bot {

    constructor () {
        bot.on("callback_query", async (query) => {
            try {
                await callbackStore.executeCallback(query.data);
                bot.answerCallbackQuery(query.id);
            } catch (error) {
                console.error(`An error occurred on callbackQuery ${query.data}`, error);
                bot.sendMessage(query.message.chat.id, `An error occurred on callbackQuery ${query.data} ${error.message}`);
            }
        });
    }

    onMessage(callback) {
        bot.on("message", async (msg) => {
            try {
                const message = new Message(msg, { bot: this });
                const result = await callback(message)

                // Не обработано
                if (result === undefined) {
                    if (message.chat.thread)
                        return await message.chat.nextThreadMessage(message);
                }

            } catch (error) {
                console.error(error);
                bot.sendMessage(msg.chat.id, "An error occurred " + error.message);
            }
        });
    }

    getFileLink(fileId) {
        return bot.getFileLink(fileId);
    }

    get instance() {
        return bot;
    }
}