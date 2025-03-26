
import { Bot } from 'telegramthread';
import { EditSearchItemThread, SearchThread } from './threads/index.js';
import SearchItem from './models/SearchItem.js';

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
        const searchItem = new SearchItem();
        searchItem.editByMessage(message).catch(error => {
            console.error("Error in editByMessage", error);
        });
        return chat.startThread(EditSearchItemThread, searchItem);

    } else if (message.is('/search')) {
        return chat.startThread(SearchThread);
        
    }
});

bot.on('callback_query', async ({ key, waitUntil, message: { chat } }) => {
    if (key.startsWith('si_')) {
        waitUntil((async () => {
            const searchItemId = key.slice(3);
            const searchItem = SearchItem.getById(searchItemId) || await SearchItem.fetchById(searchItemId);
            if (searchItem) {
                await searchItem.sendPhotos(chat);
                await searchItem.sendDescription(chat);
            } else {
                return "Объект не найден";
            }
        })());
    }
})


process.on("SIGTERM", () => {
    process.exit();
});