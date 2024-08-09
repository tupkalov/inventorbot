import { AbstractThread } from 'telegramthread';

import { imageDescriptionVectorStore, imageVectorStore } from '../ai/VectorStore.js';

export default class SearchThread extends AbstractThread {
    async processing(startMessage, getNextMessage) {
        await startMessage.reply("Напишите запрос для поиска");
        const queryMessage = await getNextMessage({ image: true, text: true });

        var results;
        if (queryMessage.isPhoto()) {
            const fileId = queryMessage.getLastPhoto().file_id;
            const imageUrl = await this.bot.getFileLink(fileId);
            const imageResults = await imageVectorStore.query(imageUrl, { score: .75 });
            const fileIds = imageResults.map((result) => result.metadata.fileId);
            results = await imageDescriptionVectorStore.getByFileIds(fileIds);
        } else {
            results = await imageDescriptionVectorStore.query(queryMessage.text, { score: .75 })
        }

        await startMessage.reply("Результаты поиска:");
        for (const result of results) {
            await startMessage.replyPhoto(result.metadata.fileId, {
                caption: result.pageContent
            });
        }
    }
}