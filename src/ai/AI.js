import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

export default class AI {
    static visionModel = new ChatOpenAI({
                            model: "gpt-4o-mini",
                            maxTokens: 1024,
                            temperature: 0,
                        })

    static async getImageDescription(dialog) {
        return await this.visionModel.invoke(dialog);
    }
}

export class ImageDescriptionDialog {
    constructor(url) {
        this.url = url;
        this.startMessage = new HumanMessage({
            content: [{
                type: "text",
                text: "Наиболее точно и при этом коротко опиши предмет и все его детали и свойства который главным образом изображён на фото. Для категоризации в приложении учета инвентаря. Не описывай окружающие предметы и окружение в целом."
            }, {
                type: "image_url",
                image_url: { url }
            }]
        });
        this.dialog = [this.startMessage]
    }

    async getImageDescription() {
        const answer = await AI.getImageDescription(this.dialog);
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