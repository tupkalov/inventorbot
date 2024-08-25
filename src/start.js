
import { Bot } from 'telegramthread';
import { NewPhotoThread, SearchThread, EditPlacesThread } from './threads/index.js';

if (!process.env.RESTRICTED_USERS) {
    throw new Error('RESTRICTED_USERS is not defined');
}
const users = process.env.RESTRICTED_USERS.split(',').map(Number);

const bot = global.bot = new Bot();
bot.start();

bot.onMessage(async (message, chat) => {
    if (!users.includes(message.from.id)) {
        return chat.sendText('You are not allowed to use this bot');
    }

    if (message.is('/start')) {
        return chat.sendText('Пришлите фотографию чтобы добавить новый объект или вызовите команду из меню.');
    }
    
    else if (message.isPhoto() && !chat.thread?.isWaitingImage()) {
        return chat.startThread(NewPhotoThread, message);
    } else if (message.is('/search')) {
        return chat.startThread(SearchThread);
        
    } else if (message.is('/editplaces')) {
        return chat.startThread(EditPlacesThread);
    }
});


process.on("SIGTERM", () => {
    process.exit();
});