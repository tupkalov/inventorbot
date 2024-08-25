import DescriptionMessage from "./DescriptionMessage.js";
import { EventEmitter } from 'node:events';
import { imageDescriptionVectorStore, imageVectorStore } from '../ai/VectorStore.js';
import { getPlaces } from '../redis/index.js';
import { ToolInputParsingException } from "@langchain/core/tools";
import { ImageDescriptionDialog } from '../ai/AI.js';
import { ObjectId } from "telegramthread";

export default class SearchItem extends EventEmitter {
    constructor (fileId, pageContent, { metadata, saved, url }) {
        super();

        if (typeof saved !== "boolean") throw new Error("options.saved is required");

        this.updateByData(pageContent, { metadata, fileId, updateMessages: false });

        Object.assign(this, { saved, url });
    }

    async updateByData (pageContent, { metadata, fileId, updateMessages = ToolInputParsingException } = {}) {
        if (typeof pageContent === "string") {
            // Пытаемся вынуть JSON из строки
            try {
                this.data = JSON.parse(pageContent);
            } catch (e) {
                this.data = { description: pageContent };
            }
        } else if (typeof pageContent === "object") {
            this.data = pageContent;
        }

        if (metadata?.id) this.id = metadata.id;
        if (!this.id) this.id = new ObjectId().toString();

        if (metadata?.fileId || fileId) this.fileId = metadata?.fileId || fileId;

        if (updateMessages) await this.updateMessages();
    }

    toJSON () {
        return {
            metadata: this.metadata,
            pageContent: this.data
        };
    }

    get bot() {
        return global.bot
    }

    get metadata () {
        return { fileId: this.fileId, id: this.id };
    }

    get place () {
        return this.data.place;
    }

    set place (place) {
        this.data.place = place;
    }

    get shortName () {
        return this.data.shortName;
    }

    get description () {
        return this.data.description;
    }

    get markdownDescriptionText () {
        var text = '';
        if (this.shortName) text += `📦 **${this.shortName}**\n`;
        text += this.description;
        return text;
    }
    
    get descriptionText () {
        var text = '';
        if (this.shortName) text += `📦 ${this.shortName}\n`;
        text += this.description;
        return text;
    }

    getMediaCaption () {
        var { descriptionText } = this;
        if (descriptionText.length > 1024) {
            descriptionText = descriptionText.slice(0, 1020).trim() + '...';
        }
        return descriptionText;
    }

    async getUrl () {
        return this.url || (this.url = await this.bot.getFileLink(this.fileId));
    }

    edit() {
        this.inEdit = true;
    }

    // Список всех мест даже если нет в базе выбранной
    async getPlaces () {
        const places = new Set();
        if (this.place) {
            places.add(this.place);
        }
        for (let place of await getPlaces()) {
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

        this.updateByData(searchItemData.pageContent, searchItemData.metadata);
    }
    
    async savePlace (place) {

        if (this.saved) {
            await this.fetchData();
            this.place = place;
            this.save();
        } else {
            this.place = place;
        }

        await this.updateMessages()
    }

    // Создание нового описани, отправка и сохранение ссылки в кэше
    async sendDescriptionTo (chat) {
        const descriptionMessage = new DescriptionMessage({}, { chat, searchItem: this });

        // Список всех описаний для данного файла
        this.constructor.addDescriptionMessage(descriptionMessage);
        await descriptionMessage.send();
        return descriptionMessage;
    }

    async sendPhoto (chat) {
        await chat.sendPhoto(this.fileId);
    }

    async save () {
        if (!this.saved) return this.saveNew();
        
        await imageDescriptionVectorStore.save(this.fileId, this.toJSON());
        this.emit('save');

        await this.updateMessages();
    }

    async saveNew () {
        if (this.saved) throw new Error("Already saved");

        const newData = await imageDescriptionVectorStore.saveNew(this.fileId, this.toJSON());
        this.updateByData(newData.pageContent, { metadata: newData.metadata });

        const imageUrl = await this.bot.getFileLink(this.fileId);
        await imageVectorStore.saveNew(this.fileId, { pageContent: imageUrl, metadata: { fileId: this.fileId } });


        this.saved = true;
        this.emit('save');

        await this.updateMessages();
    }

    async delete () {
        await imageDescriptionVectorStore.deleteByFileId(this.fileId);
        await imageVectorStore.deleteByFileId(this.fileId);
        this.saved = false;

        await this.updateMessages();
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

    static builder ({ metadata, pageContent }) {
        const fileId = metadata.fileId;
        var searchItem = this.map.get(fileId);
        if (!searchItem) {
            searchItem = new this(fileId, pageContent, { metadata, saved: true });
            this.map.set(fileId, searchItem);
        }
        return searchItem;
    }

    updateMessages () {
        return Promise.all(this.constructor.getDescriptionMessages(this.fileId).map(
            (descriptionMessage) => descriptionMessage.update()
        ));
    }

    async getImageDescriptionDialog() {
        return new ImageDescriptionDialog(await this.getUrl(), { result: JSON.stringify(this.data) });
    }

    getMediaPhoto(options) {
        var caption = this.getMediaCaption();
        if (typeof options.caption === 'function') {
            caption = options.caption(caption);
        }

        return {
            type: 'photo',
            media: this.fileId,
            caption
        };
    }
}