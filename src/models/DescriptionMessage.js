
import { Message, utils } from 'telegramthread';

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


    // Сгенерировать кнопки из списка мест
    async getPlacesButtons () {
        return (await this.searchItem.getPlaces())
            .map((place) => ({
                text: this.place === place ? `📍 ${place}` : place, 
                action: async () => {
                    if (this.place === place) {
                        this.showPlaces = false;
                        await this.updateButtons();
                        return;
                    }
                    this.showPlaces = false;
                    await this.searchItem.savePlace(place);
                    return "Местоположение сохранено";
                }
            }));
    }

    get saveDeleteRows () {
        if (!this.saved) {
            return [[{ text: "💾 Сохранить", action: async () => {
                await this.searchItem.save();
                return "Сохранено";
            } }]];

        } else {
            // Удаление
            return [[{ text: "❌ Удалить", action: async () => {
                await this.searchItem.delete();
                return "Удалено";
            }}]]
        }
    }

    // Сгенерировать список кнопок
    async getKeyboard () {
        return this.inlineKeyboard = [
            
            ...(this.showPlaces || !this.saved
                // Рисуем список с выбором места
                ? utils.createInlineRows(await this.getPlacesButtons())
                // Или рисуем кнопку для открытия списка мест
                : [[{ text: this.place ? `📍 ${this.place}` : "📍 Место не указано", action: async () => {
                    this.showPlaces = true;
                    await this.updateButtons();
                    return "Выберите новое местоположение";
                }}]]
            ),
            ...(this.saveDeleteRows || [])
        ];
    }
    
    async updateText () {
        return await this.editText(this.searchItem.imageDescription, {
            inlineKeyboard: await this.getKeyboard()
        });
    }

    async updateButtons () {
        return await this.updateInlineKeyboard(await this.getKeyboard());
    }


    async send () {
        this.data = await this.chat.sendText(this.searchItem.imageDescription, {
            inlineKeyboard: await this.getKeyboard()
        });
    }
}
