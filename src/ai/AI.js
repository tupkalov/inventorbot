import { ChatOpenAI } from "@langchain/openai";
export { HumanMessage, AIMessage } from "@langchain/core/messages";
import { placesController } from '../redis/index.js';

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
        placesController.get()
            .then((places) => this.bindModel(places))
    }

    async bindModel (places) {
        if (!places) throw new Error("places is required");

        this.visionModel = this.constructor.baseModel.bind({
            response_format: bindResponseFormat(places)
        });
    }
 
    static baseModel = new ChatOpenAI({
        model: "gpt-4o-mini",
        maxTokens: 4096,
        temperature: 0,
    })

    async getImageDescription(dialog, requestOptions) {
        return await this.visionModel.invoke(dialog, requestOptions || {});
    }
}
const ai = new AI();

export default ai;
