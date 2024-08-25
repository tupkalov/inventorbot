import { AbstractThread } from 'telegramthread';
import { ImageDescriptionDialog } from '../ai/AI.js';
import SearchItem from '../models/SearchItem.js';

export default class NewPhotoThread extends AbstractThread {

    async processing(photoMessage, getNextMessage) {
        const fileId = photoMessage.getLastPhoto().file_id;
        const url = await this.bot.getFileLink(fileId);

        // Главная модель
        var searchItemData;
        const firstController = new AbortController();

        // Флаг что нужно сохранить после получения данных
        let save = false;
        if (photoMessage.caption) save = true; // Сохраняем сразу если есть описание
        
        searchItemData = await Promise.any([
            // Получение сразу после фото
            (async () => {
                const aiDialog = new ImageDescriptionDialog(url, { edit: photoMessage.caption });
                try {
                    return await aiDialog.getImageDescription({ signal: firstController.signal });
                } catch (e) {
                    if (e.name === "AbortError") throw e;
                    this.stop(error)
                }
            })(),

            // Если пришло еще сообщение то переделываем запрос
            (async () => {
                const nextMessage = await getNextMessage();
                if (searchItemData) return;
                save = true; // Сохраняем после получения данных
                firstController.abort();
                const aiDialog = new ImageDescriptionDialog(url, {
                    edit: [photoMessage.caption, nextMessage.text].filter(Boolean).join("\n")
                });
                return await aiDialog.getImageDescription();
            })()
        ]);
        
        const searchItem = new SearchItem(fileId, searchItemData, { saved: false, bot: this.bot, url });
        if (save) await searchItem.save();
        const descriptionMessage = await searchItem.sendDescriptionTo(this.chat);
        if (!save) return descriptionMessage.edit();
    }
}
