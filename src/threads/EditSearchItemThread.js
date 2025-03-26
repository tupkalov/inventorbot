import { AbstractThread } from 'telegramthread';
import DescriptionMessage from '../models/DescriptionMessage.js';

export default class EditSearchItemThread extends AbstractThread {
    async processing(searchItem, getNextMessage) {
        const stop = () => {
            searchItem.forget()
            this.stop()
        }

        searchItem.edit();

        this.once('stop', stop);
        searchItem.once('save', stop);
        searchItem.once('delete', stop);

        while (true) {
            const editMessage = await getNextMessage({
                image: true,
                text: true
            });

            DescriptionMessage.deactivateOldMessages().catch(error => {
                console.error("Error deactivating old messages", error)
            });

            searchItem.editByMessage(editMessage).catch(error => {
                console.error("Error in editByMessage", error);
            });
        }
    }
}