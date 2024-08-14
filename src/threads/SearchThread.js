import { AbstractThread } from 'telegramthread';

import { imageDescriptionVectorStore, imageVectorStore } from '../ai/VectorStore.js';
import { SearchItem } from '../models/index.js';

export default class SearchThread extends AbstractThread {
    async processing(startMessage, getNextMessage) {
        await startMessage.reply("Напишите запрос для поиска или загрузите фото");
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
        }

        if (!results.length) {
            return await startMessage.reply("Ничего не найдено");
        }

        await startMessage.reply("Результаты поиска:");
        for (const searchItemData of results) {
            const searchItem = await SearchItem.get(searchItemData);
            await searchItem.sendPhoto(startMessage.chat);
            await searchItem.sendDescription(startMessage.chat);
        }
    }
}