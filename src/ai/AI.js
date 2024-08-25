import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { getPlaces, emitter } from '../redis/index.js';

function bindResponseFormat (places) {
    return {
        type: "json_schema",
        json_schema: {
            "name": "searchItem",
            "strict": true,
            "schema": {
                "type": "object",
                "properties": {
                    "description": {
                        "type": "string"
                    },
                    "shortName": {
                        "type": "string"
                    },
                    "place": {
                        anyOf: [
                            {
                                "type": "string",
                                "enum": [...places, "Неизвестное местоположение"]
                            }, {
                                "type": "string"
                            }
                        ]
                    }
                },
                "required": [
                    "description",
                    "shortName",
                    "place"
                ],
                "additionalProperties": false,
                "$schema": "http://json-schema.org/draft-07/schema#"
            }
        }
    }
}

/** Модель для общения текстом */

export class AI {
    constructor() {
        getPlaces();

        emitter.on("places", (places) => {
            this.bindModel({ places });
        });
    }

    async bindModel (options = {}) {
        const { places } = options;
        if (!places) throw new Error("places is required");

        this.visionModel = this.constructor.baseModel.bind({
            response_format: bindResponseFormat(places)
        });
    }
 
    static baseModel = new ChatOpenAI({
        model: "gpt-4o-mini",
        maxTokens: 1024,
        temperature: 0,
    })

    async getImageDescription(dialog, requestOptions) {
        return await this.visionModel.invoke(dialog, requestOptions || {});
    }
}
const ai = new AI();

export default ai;

const onlyPhotoPrompt = "Наиболее точно и при этом коротко опиши предмет и все его детали и свойства который главным образом изображён на фото. Для категоризации в приложении учета инвентаря. Не описывай окружающие предметы и окружение в целом.";
const photoWithEditPrompt = onlyPhotoPrompt + " При описании учитывай следующие изменения: ";

export class ImageDescriptionDialog {
    constructor(url, { result, edit } = {}) {
        this.url = url;
        this.startMessage = new HumanMessage({
            content: [{
                type: "text",
                text: !edit ? onlyPhotoPrompt : photoWithEditPrompt + "\n" + edit
            }, {
                type: "image_url",
                image_url: { url }
            }]
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