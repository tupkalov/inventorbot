import telegramifyMarkdown from 'telegramify-markdown'
import Chat from './Chat.js';
import { callbackStore } from './Callbacks.js';

export default class Message {
    constructor(msg, { bot }) {
        this.data = msg;
        this.bot = bot;
        this.chat = Chat.getByMessage(this);
    }

    updateData(msg) {
        this.data = msg;
    }
    
    createMessage(text) {
        return new this.constructor({ ...this.data, text }, { bot: this.bot });
    }

    get text() {
        return this.data.text;
    }

    get from() {
        return this.data.from;
    }

    is (text) {
        return this.data.text === text;
    }

    isPhoto() {
        return this.data.photo?.length;
    }

    getLastPhoto() {
        return [...this.data.photo].pop();
    }

    _processOptionsInlineKeyboard(options) {
        if (options?.inlineKeyboard) {
            return { reply_markup: {
                inline_keyboard: this._inlineKeyboard = options.inlineKeyboard.map(row => row.map(({ text, action }) => {
                    return {
                        text,
                        callback_data: callbackStore.setCallback(action)
                    }
                }))
            }};
        } else if (this._inlineKeyboard) {
            return { reply_markup: {
                inline_keyboard: this._inlineKeyboard
            }};
        }
    }

    async reply(data, options) {
        if (typeof data === 'string') {
            const text = telegramifyMarkdown(data, 'escape');
            const message = this.createMessage(text);
            const sendOptions = { 
                parse_mode: 'MarkdownV2',
                ...message._processOptionsInlineKeyboard(options)
            };

            const newData = await this.bot.instance.sendMessage(message.chat.id, message.text, sendOptions);
            message.updateData(newData);
            return message;
        }
        throw new Error('Unsupported data type');
    }

    async edit(text, options) {
        const data = await this.bot.instance.editMessageText(telegramifyMarkdown(text, 'escape'), {
            chat_id: this.data.chat.id,
            message_id: this.data.message_id,
            parse_mode: 'MarkdownV2',
            ...this._processOptionsInlineKeyboard(options)
        });

        this.updateData(data);
        return this;
    }

    async updateInlineKeyboard(inlineKeyboard) {
        const sendOptions = { 
            parse_mode: 'MarkdownV2',
            ...this._processOptionsInlineKeyboard({ inlineKeyboard })
        };

        await this.edit(this.text, sendOptions);
    }

    async replyPhoto(fileId, { caption } = {}) {
        const _caption = telegramifyMarkdown(caption || '', 'escape');
        if (caption && _caption.length > 1024) {
            await this.bot.instance.sendPhoto(this.data.chat.id, fileId);
            await this.reply(caption);
        } else {
            await this.bot.instance.sendPhoto(this.data.chat.id, fileId, { caption: telegramifyMarkdown(caption || '', 'escape'), parse_mode: 'MarkdownV2' });
        }
    }

    startThread(Thread) {
        return this.chat.startThread(Thread, this);
    }
}