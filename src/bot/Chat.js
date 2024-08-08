export default class Chat {
    constructor(chat, { bot }) {
        this.data = chat;
        this.bot = bot;
    }

    get id() {
        return this.data.id;
    }

    is (id) {
        return this.data.id === id;
    }

    static getByMessage (message) {
        if (!this.chats) {
            this.chats = {};
        }
        const chatId = message.data.chat.id;
        if (!this.chats[chatId]) {
            this.chats[chatId] = new Chat(message.data.chat, { bot: message.bot });
        }
        return this.chats[chatId];
    }

    startThread(Thread, startMessage) {
        this.thread?.stop()
        this.thread = new Thread(this);
        this.thread.process(startMessage);

        return this.thread;
    }

    stopThread() {
        if (this.thread) {
            this.thread.stop();
        }
    }

    nextThreadMessage(message) {
        this.thread.process(message);
    }
    async _sendTyping(type) {
        return await this.bot.instance.sendChatAction(this.id, type).catch(error => {
            console.error("Error sending chat action " + type, error);
        });
    }
    startTyping(type = "typing") {
        this.stopTyping();
        this._sendTyping(type);
        const timer = setInterval(() => this._sendTyping(type), 4000);
        return this._stopTyping = () => clearInterval(timer);
    }

    stopTyping() {
        this._stopTyping?.();
    }
}

