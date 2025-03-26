
import { Message, utils } from 'telegramthread';
import EditSearchItemThread from '../threads/EditSearchItemThread.js';

export default class DescriptionMessage extends Message {
    constructor (searchItem, { chat }) {
        super({ chat: chat.toJSON() }, { searchItem });
        this.searchItem = searchItem;
        this.constructor.lastMessage = this;
    }

    migrateData (message) {
        this.data = message.data;
    }

    get fileId () {
        return this.searchItem.fileId;
    }

    isNew () {
        return this.searchItem.isNew();
    }

    get inEdit () {
        return this.searchItem.inEdit;
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
        if (this.isNew() || this.inEdit) {
            return [[
                { text: "💾 Сохранить", action: async () => {
                    await this.searchItem.save();
                    return "Сохранено";
                }},
                ...(!this.isNew() ? [] :
                    [{ text: "❌ Отменить", action: async () => {
                        await this.searchItem.delete();
                        return "Отменено";
                    }}]
                )
            ]];

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
        if (this.deactivated) return this.inlineKeyboard = [];
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
        return await this.editText(this.data.text, {
            inlineKeyboard: await this.getKeyboard()
        }).catch(error => {
            if (error.message.includes("message is not modified")) return;
            throw error;
        })
    }


    async send () {
        const message = await this.chat.sendText(this.markdownText, {
            inlineKeyboard: await this.getKeyboard()
        });
        this.migrateData(message);
        
        return this;
    }

    async edit() {
        this.chat.startThread(EditSearchItemThread, this.searchItem).finally(() => {
            this.searchItem.updateMessages();
        });
        this.update().catch(error => console.error("Error updating #1 description message", error));
    }
    
    static async deactivateOldMessages () {
        if (this.lastMessage) {
            this.lastMessage.deactivate();
            await this.lastMessage.update();
        }
    }

    deactivate () {
        this.deactivated = true;
    }
}
