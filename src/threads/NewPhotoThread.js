import AbstractThread from './AbstractThread.js';

import { ImageDescriptionDialog } from '../ai/AI.js';
import { imageDescriptionVectorStore, imageVectorStore } from '../ai/VectorStore.js';

export default class NewPhotoThread extends AbstractThread {

    async saveImage(fileId, imageDescription) {
        await imageDescriptionVectorStore.saveImage(fileId, imageDescription);

        const imageUrl = await this.bot.getFileLink(fileId);
        await imageVectorStore.saveImage(fileId, imageUrl);
        
        await this.message.reply("Фото сохранено");
        this.stop();
    }

    async processing(startMessage, getNextMessage) {
        var descriptionMessage;

        try {
            const fileId = startMessage.getLastPhoto().file_id;
            const url = await this.bot.getFileLink(fileId);
            const aiDialog = new ImageDescriptionDialog(url);
            let imageDescription = await aiDialog.getImageDescription();
            

            const sendOptions = {
                inlineKeyboard: [[
                    { text: "Сохранить", action: () => this.saveImage(fileId, imageDescription) }
                ]]
            };

            while (true) {
                if (!descriptionMessage) {
                    descriptionMessage = await this.message.reply(imageDescription, sendOptions);
                } else {
                    await descriptionMessage.edit(imageDescription);
                }

                const editMessage = await getNextMessage();
                imageDescription = await aiDialog.askWith(`Поправь описание фото в соответствии со следующими комментариями: \n${editMessage.text}`);
            }

        } finally {
            await descriptionMessage?.updateInlineKeyboard([]);
        }
    }
}