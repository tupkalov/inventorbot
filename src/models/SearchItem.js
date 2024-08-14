import DescriptionMessage from "./DescriptionMessage.js";
import { EventEmitter } from 'node:events';
import { imageDescriptionVectorStore, imageVectorStore } from '../ai/VectorStore.js';
import { getPlaces } from '../redis/index.js';

export default class SearchItem extends EventEmitter {
    constructor (fileId, pageContent, { metadata, saved }) {
        super();

        if (typeof saved !== "boolean") throw new Error("options.saved is required");

        this.data = {
            metadata: {
                ...metadata,
                fileId
            },
            pageContent
        };

        Object.assign(this, { saved });
    }

    get bot() {
        return global.bot
    }

    get imageDescription () {
        return this.data.pageContent
    }

    set imageDescription (description) {
        this.data.pageContent = description;
    }

    get metadata () {
        return this.data.metadata;
    }

    get fileId () {
        return this.data.metadata.fileId;
    }

    get place () {
        return this.data.metadata.place;
    }

    set place (place) {
        this.data.metadata.place = place;
    }

    // Получить список всех мест
    static getPlaces = getPlaces

    // Список всех мест даже если нет в базе выбранной
    async getPlaces () {
        const places = new Set();
        if (this.place) {
            places.add(this.place);
        }
        for (let place of await this.constructor.getPlaces()) {
            places.add(place);
        }
        return [...places]
    }

    // Зафетчить актуальную инфу из редиса
    async fetchData () {
        const [ searchItemData ] = await imageDescriptionVectorStore.getByFileIds([this.fileId]);
        if (!searchItemData) {
            throw MessageError(`FileId in imageDescriptionVectorStore not found: ${this.fileId}`, { clientMessage: "Изображение не найдено" });
        }

        this.data = searchItemData;
    }
    
    async savePlace (place) {

        if (this.saved) {
            await this.fetchData();
            this.place = place;
            await imageDescriptionVectorStore.saveMetadataByFileId(this.fileId, this.metadata);
        } else {
            this.place = place;
        }

        await this.updateButtons()
    }


    async updateImageDescription (imageDescription) {
        this.imageDescription = imageDescription;
        for (const descriptionMessage of this.constructor.getDescriptionMessages(this.fileId)) {
            await descriptionMessage.updateText();
        }
    }

    async updateButtons () {
        for (const descriptionMessage of this.constructor.getDescriptionMessages(this.fileId)) {
            await descriptionMessage.updateButtons();
        }
    }

    // Создание нового описани, отправка и сохранение ссылки в кэше
    async sendDescription (chat) {
        const description = DescriptionMessage.createInChat(chat, { text: this.imageDescription, searchItem: this });
        // Список всех описаний для данного файла
        this.descriptionStack = this.constructor.addDescriptionMessage(description);
        await description.send();
    }

    async sendPhoto (chat) {
        await chat.sendPhoto(this.fileId);
    }

    async save () {
        if (this.saved) throw new Error("Already saved");

        await imageDescriptionVectorStore.saveImage(this.fileId, this.imageDescription);

        const imageUrl = await this.bot.getFileLink(this.fileId);
        await imageVectorStore.saveImage(this.fileId, imageUrl);

        this.saved = true;
        this.emit('save');

        for (const descriptionMessage of this.constructor.getDescriptionMessages(this.fileId)) {
            await descriptionMessage.updateButtons();
        }
    }

    async delete () {
        await imageDescriptionVectorStore.deleteByFileId(this.fileId);
        await imageVectorStore.deleteByFileId(this.fileId);
        this.saved = false;

        for (const descriptionMessage of this.constructor.getDescriptionMessages(this.fileId)) {
            await descriptionMessage.updateButtons()
        }
    }
    


    static descriptionMap = new Map();

    // Сохранение в кэш
    static addDescriptionMessage(description) {
        const stack = this.getDescriptionMessages(description.fileId);
        stack.push(description);
        return stack;
    }

    // Получение из кэша
    static getDescriptionMessages(fileId) {
        var stack = this.descriptionMap.get(fileId);
        if (!stack) {
            this.descriptionMap.set(fileId, stack = []);
        }
        return stack;
    }

    static map = new Map();

    static get ({ metadata, pageContent }) {
        const fileId = metadata.fileId;
        var searchItem = this.map.get(fileId);
        if (!searchItem) {
            searchItem = new this(fileId, pageContent, { metadata, saved: true });
            this.map.set(fileId, searchItem);
        }
        return searchItem;
    }
}