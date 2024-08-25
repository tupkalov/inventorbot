import { AbstractThread } from 'telegramthread';

export default class EditSearchItemThread extends AbstractThread {
    async processing(searchItem, getNextMessage) {
        searchItem.edit();

        searchItem.once('save', () => {
            this.stop()
        });
        var aiDialog;

        while (true) {
            const editMessage = await getNextMessage(); // getNextMessage выкинет завершение диалога если начнется новый в этом чате
            if (!aiDialog) {
                aiDialog = await searchItem.getImageDescriptionDialog();
            }

            const searchItemData = await aiDialog.askWith(`Внеси изменения в твое описание фото в соответствии со следующими инструкциями: \n${editMessage.text}`);

            await searchItem.updateByData(searchItemData);
        }
    }
}