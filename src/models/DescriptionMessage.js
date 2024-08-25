
import { Message, utils } from 'telegramthread';
import EditSearchItemThread from '../threads/EditSearchItemThread.js';

export default class DescriptionMessage extends Message {
    constructor (data, { searchItem }) {
        super(...arguments);
        this.searchItem = searchItem;
    }

    get fileId () {
        return this.searchItem.fileId;
    }

    get saved () {
        return this.searchItem.saved;
    }

    get place () {
        return this.searchItem.place;
    }

    get text () {
        return this.searchItem.descriptionText;
    }

    get markdownText () {
        return this.searchItem.markdownDescriptionText;
    }

     // Сгенерировать кнопки из списка мест
    async getPlacesButtons () {
        return (await this.searchItem.getPlaces())
            .map((place) => ({
                text: this.place === place ? `📍 ${place}` : place, 
                action: async () => {
                    if (this.place === place) {
                        this.showPlaces = false;
                        await this.update();
                        return;
                    }
                    this.showPlaces = false;
                    await this.searchItem.savePlace(place);
                    return "Местоположение сохранено";
                }
            }));
    }

    get saveDeleteRows () {
        if (!this.saved || this.inEdit) {
            return [[{ text: "💾 Сохранить", action: async () => {
                await this.searchItem.save();
                return "Сохранено";
            } }]];

        } else {
            // Удаление
            return [
                [{ text: "📝 Редактировать", action: async () => {
                    await this.edit();
                    return "Редактирование начато. Отправьте новое описание";
                }},
                { text: "❌ Удалить", action: async () => {
                    await this.searchItem.delete();
                    return "Удалено";
                }}]
            ]
        }
    }

    // Сгенерировать список кнопок
    async getKeyboard () {
        return this.inlineKeyboard = [
            
            ...(this.showPlaces
                // Рисуем список с выбором места
                ? utils.createInlineRows(await this.getPlacesButtons())
                // Или рисуем кнопку для открытия списка мест
                : [[{ text: this.place ? `📍 ${this.place}` : "📍 Место не указано", action: async () => {
                    this.showPlaces = true;
                    await this.update();
                    return "Выберите новое местоположение";
                }}]]
            ),
            ...(this.saveDeleteRows || [])
        ];
    }
    
    
    async update () {
        return await this.editText(this.markdownText, {
            inlineKeyboard: await this.getKeyboard()
        });
    }


    async send () {
        this.data = await this.chat.sendText(this.markdownText, {
            inlineKeyboard: await this.getKeyboard()
        });
    }

    async edit() {
        this.inEdit = true;
        this.chat.startThread(EditSearchItemThread, this.searchItem).finally(() => {
            this.inEdit = false
            this.update().catch(error => console.error("Error updating #2 description message", error));
        });
        this.update().catch(error => console.error("Error updating #1 description message", error));
    }
}
