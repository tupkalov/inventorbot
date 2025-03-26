
const onlyPhotoPrompt = 
    `Наиболее точно и при этом коротко опиши предмет на фото. 
    - Используй в описании бренд, модель, применимость, описание если оно есть на изображении
    - Описание должно содержать все характеристики, которые можно точно увидеть на фото.
    - В описание добавляй информацию о применении этой вещи о котором тебе известно.
    - Не описывай окружающие предметы и окружение в целом.`
const photoWithEditPrompt = onlyPhotoPrompt + " При описании учитывай следующие изменения: ";

export default class Dialog {
    constructor(urls, { result, edit } = {}) {
        if (typeof urls === "string") urls = [urls];
        this.urls = urls;
        this.startMessage = new HumanMessage({
            content: [{
                type: "text",
                text: !edit ? onlyPhotoPrompt : photoWithEditPrompt + "\n" + edit
            }, ...urls.map(url => ({
                type: "image_url",
                image_url: { url }
            }))]
        });
        this.dialog = [this.startMessage]

        if (result) {
            this.dialog.push(new AIMessage({
                content: result
            }));
        }
    }

    async getImageDescription(requestOptions) {
        const answer = await ai.getImageDescription(this.dialog, requestOptions);
        this.dialog = [
            this.startMessage,
            answer
        ];
        return answer.content;
    }

    async askWith(question) {
        this.dialog = [...this.dialog,
            new HumanMessage({
                content: [{
                    type: "text",
                    text: question
                }]
            })
        ];

        return this.getImageDescription();
    }
}