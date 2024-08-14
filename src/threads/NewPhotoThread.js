import { AbstractThread } from 'telegramthread';
import { ImageDescriptionDialog } from '../ai/AI.js';
import SearchItem from '../models/SearchItem.js';

export default class NewPhotoThread extends AbstractThread {

    async processing(startMessage, getNextMessage) {
        const fileId = startMessage.getLastPhoto().file_id;
        const url = await this.bot.getFileLink(fileId);
        const aiDialog = new ImageDescriptionDialog(url);
        let imageDescription = await aiDialog.getImageDescription();

        // Главная модель
        const searchItem = new SearchItem(fileId, imageDescription, { saved: false, bot: this.bot });
        searchItem.once('save', () => this.stop());

        await searchItem.sendDescription(startMessage.chat);

        while (true) {
            const editMessage = await getNextMessage(); // getNextMessage выкинет завершение диалога если начнется новый в этом чате
            imageDescription = await aiDialog.askWith(`Поправь описание фото в соответствии со следующими комментариями: \n${editMessage.text}`);

            await searchItem.updateImageDescription(imageDescription);
        }
    }
}