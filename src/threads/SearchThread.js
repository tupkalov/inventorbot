import { AbstractThread, utils } from 'telegramthread';

import { imageDescriptionVectorStore, imageVectorStore } from '../ai/VectorStore.js';
import { SearchItem } from '../models/index.js';

export default class SearchThread extends AbstractThread {
    async processing(getNextMessage) {
        await this.chat.sendText("Напишите запрос для поиска или загрузите фото");
        const queryMessage = await getNextMessage({ image: true, text: true });

        var results;
        if (queryMessage.isPhoto()) {
            const fileId = queryMessage.getLastPhoto().file_id;
            const imageUrl = await this.bot.getFileLink(fileId);
            const imageResults = await imageVectorStore.query(imageUrl);
            const fileIds = imageResults.map((result) => result.metadata.fileId);
            results = await imageDescriptionVectorStore.getByFileIds(fileIds);
        } else {
            results = await imageDescriptionVectorStore.query(queryMessage.text)
                .catch(error => {
                    if (error.message.includes("no such index"))
                        return [];
                    throw error;
                })
        }

        const searchItems = results.map((searchItemData) => SearchItem.builder(searchItemData));
        if (searchItems.length === 0)
            return await this.chat.sendText("Ничего не найдено");

        await this.chat.sendText("Результаты поиска:");

        await this.chat.sendMediaGroup(
            searchItems.map((searchItem, index) => {
                return searchItem.getMediaPhoto({ caption: text => `${index+1}. ${text}` })
            })
        );
        await this.chat.sendText("Выберите результат для просмотра",
            {
                inlineKeyboard: utils.createInlineRows(searchItems.map((searchItem, index) => ({
                    text: `${index+1}. ${searchItem.shortName || ''}`.trim(),
                    action: async () => {
                        await searchItem.sendPhoto(this.chat);
                        await searchItem.sendDescriptionTo(this.chat);
                    }
                })))
            });
    }
}