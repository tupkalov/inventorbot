import DescriptionMessage from "./DescriptionMessage.js";
import { EventEmitter } from 'node:events';
import { imageDescriptionVectorStore, imageVectorStore } from '../ai/VectorStore.js';
import { placesController, redisConnected } from '../redis/index.js';
import { ObjectId, MessageError } from "telegramthread";
import { HumanMessage, AIMessage, default as AI } from "../ai/AI.js";


var lastPlace = null
function saveLastPlace(place) {
    return placesController.saveLastPlace(lastPlace = place);
}

// Загрузка последнего места
redisConnected.then(async () => {
    lastPlace = await placesController.getLastPlace();
});

export default class SearchItem extends EventEmitter {
    constructor (id, pageContent, fileIds) {
        super();
        if (!id) {
            this._tempId = new ObjectId().toString();
            return; // blank models
        }
        this.id = id;

        if (!pageContent) throw new Error("pageContent is required");

        switch (true) {
        case Array.isArray(fileIds):
            this.fileIds = fileIds;
            break;
        case typeof fileIds === "string":
            this.fileIds = [fileIds];
            break;
        default: // blank models
            throw new Error("fileIds is required");
        }

        this.updateByData(pageContent, { fileIds, updateMessages: false })
            .catch(error => {
                console.error("Error in SearchItem constructor", error);
                this.emit('error', error);
            });
    }

    async updateByData (pageContent, { fileIds } = {}) {
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

        await saveLastPlace(this.data.place);

        if (fileIds) this.fileIds = fileIds;
    }

    toJSON () {
        return {
            metadata: this.metadata,
            pageContent: this.data
        };
    }

    isNew () {
        return !this.id;
    }

    get bot() {
        return global.bot
    }

    get metadata () {
        return { fileIds: this.fileIds, id: this._tempId || this.id };
    }

    get place () {
        return this.data.place;
    }

    get fileId () {
        throw new Error("Not implemented using FILE_ID");
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

    async getUrls () {
        return this.urls || (this.urls = await Promise.all(this.fileIds.map((fileId) => this.bot.getFileLink(fileId))));
    }

    edit() {
        this.inEdit = true;
    }

    stopEdit() {
        this.inEdit = false;
    }
    forget() {
        this.stopEdit();
        this.dropEdits();
        if (!this.isNew()) this.constructor.map.delete(this.id);
    }

    // Список всех мест даже если нет в базе выбранной
    async getPlaces () {
        const places = new Set();
        if (this.place) {
            places.add(this.place);
        }
        for (let place of await placesController.get()) {
            places.add(place);
        }
        return [...places]
    }

    // Зафетчить актуальную инфу из редиса
    async fetchData () {
        const [ searchItemData ] = await imageDescriptionVectorStore.getByFileIds(this.fileIds);
        if (!searchItemData) {
            throw MessageError(`FileId in imageDescriptionVectorStore not found: ${this.fileIds}`, { 
                info: { fileIds: this.fileIds },
                clientMessage: "Изображение не найдено"
            });
        }

        await this.updateByData(searchItemData.pageContent, searchItemData.metadata);
    }
    
    async savePlace (place) {

        if (!this.isNew()) {
            await this.fetchData();
            this.place = place;
            this.save();
        } else {
            this.place = place;
        }

        await this.updateMessages()
    }

    async sendPhotos (chat) {
        await chat.sendMediaGroup(this.fileIds.map((fileId) => ({
            type: 'photo',
            media: fileId
        })));
    }       

    // Создание нового описани, отправка и сохранение ссылки в кэше
    async sendDescription (chat) {
        await DescriptionMessage.deactivateOldMessages();
        
        const descriptionMessage = this.lastMessage = new DescriptionMessage(this, { chat });

        // Список всех описаний для данного файла
        await descriptionMessage.send();
        return descriptionMessage;
    }

    async save () {
        if (!this._savePromise) {
            this._savePromise = this._save().finally(() => delete this._savePromise);
        }
        return this._savePromise;
    }

    async _save() {
        if (this.isNew()) return this.saveNew();
        
        console.log("Save", this.id);
        await imageDescriptionVectorStore.save(this.id, this.toJSON());

        // Сохранение доп изображений
        if (this._needToSaveFileIds) {
            for (const fileId of this._needToSaveFileIds) {
                console.log("Get fileLink new image", fileId);
                const imageUrl = await this.bot.getFileLink(fileId);
                console.log("Save new image", fileId, imageUrl);
                await imageVectorStore.save(this.id, { pageContent: imageUrl, metadata: { fileId, id: this.id } });
            }
            delete this._needToSaveFileIds;
        }
        
        console.log("Save done", this.id);
        this.emit('save');

        await this.updateMessages();
    }

    async saveNew () {
        if (!this.isNew())
            throw new Error("Already saved");

        console.log("Save new started", this._tempId);
        const newData = await imageDescriptionVectorStore.saveNew(this._tempId, this.toJSON());
        await this.updateByData(newData.pageContent, { metadata: newData.metadata });
        
        for (const fileId of this.fileIds) {
            console.log("Save new image", fileId);
            const imageUrl = await this.bot.getFileLink(fileId);
            await imageVectorStore.saveNew(this._tempId, { pageContent: imageUrl, metadata: { fileId, id: this._tempId } });
        }
        
        this.id = this._tempId;
        delete this._tempId;

        this.emit('save');

        await this.updateMessages();
    }

    async delete () {
        if (!this.isNew()) {
            await imageDescriptionVectorStore.deleteByKey(this.id);
            await imageVectorStore.deleteByKey(this.id);
        }
        this.deleted = true;

        await this.updateMessages();
        this.emit('delete');
    }

    // Получение из кэша
    getDescriptionMessages() {
        return [ this.lastMessage ]
    }

    static map = new Map();

    static builder ({ metadata, pageContent }) {
        const id = metadata.id
        var searchItem = this.map.get(id);
        if (!searchItem) {
            let fileIds;
            if (metadata.fileIds) {
                fileIds = metadata.fileIds;
            } else if (metadata.fileId) {
                fileIds = [metadata.fileId];
            } else throw new Error("metadata.fileId is required");

            searchItem = new this(metadata.id || fileIds[0], pageContent, fileIds);
            this.map.set(id, searchItem);
        }
        
        return searchItem;
    }

    static getById (id) {
        return this.map.get(id);
    }

    static async fetchById (id) {
        const result = await imageDescriptionVectorStore.getByKey(id);
        return this.builder(result);
    }

    updateMessages () {
        return Promise.all(this.getDescriptionMessages().map(
            descriptionMessage => {
                if (this.deleted) descriptionMessage.deactivate()
                return descriptionMessage.update()
            }
        ));
    }

    getMediaPhoto(options) {
        var caption = this.getMediaCaption();
        if (typeof options.caption === 'function') {
            caption = options.caption(caption);
        }

        return {
            type: 'photo',
            media: this.fileIds[0],
            caption
        };
    }


    // На вход сообщение которое запускает генерацию изменений
    async editByMessage(message) {
        try {
            // Добавляем правки для следующего запроса
            if (message.isPhoto()) {
                const fileId = message.getLastPhoto().file_id;
                const url = await this.bot.getFileLink(fileId);
                this.addEditPhoto(fileId, url, message.caption);
            } else if (message.text) {
                this.addEditText(message.text);
            } else {
                throw new Error("Not implemented typeof message");
            }

            // Отправляем и ждем инфы
            await this.generateDescription();

            await this.sendPhotos(message.chat)
            await this.sendDescription(message.chat)
        } catch (error) {
            message.chat.catchError(error);
        }
    }

    addEditPhoto(fileId, url, caption) {
        if (!this.editPhotos) this.editPhotos = [];
        this.editPhotos.push({ fileId, url, caption });
    }

    addEditText(text) {
        if (!this.editTexts) this.editTexts = [];
        this.editTexts.push(text);
    }

    dropEdits() {
        delete this.editPhotos;
        delete this.editTexts;
    }

    get onlyPhotoPrompt() {
        return `Наиболее точно и при этом коротко опиши предмет на фото. 
        - Используй в описании бренд, модель, применимость, описание если оно есть на изображении
        - Описание должно содержать все характеристики, которые можно точно увидеть на фото.
        - В описание добавляй информацию о применении этой вещи о котором тебе известно.
        - Не описывай окружающие предметы и окружение в целом.
        ${lastPlace ? `- Если местоположение явно не указано используй предыдущее: ${lastPlace}` : ''}`;
    }
    
    addEditPrompt = "Измени описание в соответствии с новыми данными:";

    abortSignal() {
        if (this.abortController) this.abortController.abort();
        this.abortController = new AbortController();
        return this.abortController.signal;
    }


    async generateDescription() {
        console.log("generateDescription for", this.id || "new item");

        const getEditMessages = () => {
            return [
                ...(this.editPhotos || []).map(({ url, caption }) => [
                    {
                        type: "image_url",
                        image_url: { url }
                    }, caption && {
                        type: "text",
                        text: caption
                    }
                ]).flat().filter(Boolean),

                ...(this.editTexts || []).map(text => ({
                    type: "text",
                    text
                }))
            ]
        }


        const signal = this.abortSignal();

        const dialog = [];
        var aiMessage;

        if (!this.editPhotos?.length && !this.editTexts?.length) {
            throw new Error("No photo or text to edit");
        }

        // Составляем диалог
        await (async () => {
            // Либо мы этот айтем достали из базы либо он новый
            if (!this.dialog) {
                // Вступительное сообщение
                const newEditMessage = new HumanMessage({
                    content: [
                        { 
                            type: "text",
                            text: this.onlyPhotoPrompt
                        }
                    ]
                });
                dialog.push(newEditMessage);

                // Если новое то просто добавляем правки
                if (this.isNew()) {
                    newEditMessage.content.push(...getEditMessages());
                    // И выходим из генерации диалога т.к. правки добавили
                    return;

                // Если из базы 
                } else {
                    // значит подставляем те фотки которые уже приложены
                    newEditMessage.content.push(
                        ...(await Promise.all(this.fileIds
                                .map(async fileId => this.bot.getFileLink(fileId))))
                                .map(url => ({
                                    type: "image_url",
                                    image_url: { url }
                                })));
                    
                    // И добавляем сгенерированое старое описание
                    dialog.push(new AIMessage({ content: JSON.stringify(this.data) }));
                }
                
            // Если диалог уже есть то добавляем его в начало
            } else {
                dialog.push(...this.dialog);
            }

            // если правки не добавлены то добавляем их с редактируемым сообщением
            dialog.push(
                new HumanMessage({
                    content: [
                        {
                            type: "text",
                            text: this.addEditPrompt
                        },
                        ...getEditMessages()
                    ]
                })
            );
        })();

        aiMessage = await AI.getImageDescription(dialog, { signal });

        this.dialog = [...dialog, aiMessage];

        // Добавление в список на сохранение фото которые не были сохранены
        if (!this._needToSaveFileIds) this._needToSaveFileIds = [];
        this.editPhotos?.forEach(({ fileId }) => {
            if (!this.fileIds?.includes(fileId)) {
                this._needToSaveFileIds.push(fileId);
            }
        });

        await this.updateByData(aiMessage.content, {
            fileIds: [
                ...(this.fileIds || []), 
                ...(this.editPhotos  || []).map(({ fileId }) => fileId)
            ]
        });

        this.dropEdits();
    }
}
