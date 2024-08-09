
import TelegramThread from 'telegramthread';
import { NewPhotoThread, SearchThread } from './threads/index.js';

const users = [
    215640362
]

const bot = new TelegramThread();

bot.onMessage(async (message) => {
    if (!users.includes(message.from.id)) {
        return message.reply('You are not allowed to use this bot');
    }

    if (message.is('/start')) {
        return message.reply('Send a photo!');
    }
    
    else if (message.isPhoto() && !message.chat.thread?.isWaitingImage()) {
        return message.startThread(NewPhotoThread);

    } else if (message.is('/search')) {
        return message.startThread(SearchThread);
    }
});


process.on("SIGTERM", () => {
    bot.stopPolling();
    process.exit();
});