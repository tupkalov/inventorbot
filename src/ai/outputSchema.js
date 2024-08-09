import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const imageResponseSchema = z.object({
    description: z.string(),
    place: z.enum(["inside", "outside"])
});


{ 
    "name": "image_response",
    "strict": true,
    "schema": {
        "type": "object",
        "properties": {
            "description": { "type": "string" },
            "place": { "type": "string", "enum": ["inside", "outside"] }
        },
        "required": ["description", "place"],
        "additionalProperties": false
    }
}