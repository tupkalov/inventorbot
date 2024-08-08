import { RedisVectorStore } from "@langchain/redis";
import { OpenAIEmbeddings } from "@langchain/openai";
import ReplicateImageEmbeddings from "./ReplicateImageEmbeddings.js";

import { createClient } from "redis";



const client = createClient({
    url: 'redis://redis:6379'
});

client.connect().then(() => {
   console.log("Connected to Redis"); 
}, (error) => {
    console.error(error);
    process.exit(1);
});

export default class VectorStore {
    constructor (indexName, embeddings) {
        this.indexName = indexName;
        this.instance = new RedisVectorStore(embeddings, {
            redisClient: client,
            indexName,
        });
    }

    async saveImage (fileId, description) {
        await this.instance.addDocuments([{
            metadata: { fileId },
            pageContent: description,
        }], {
            keys: [`doc:${this.indexName}:${fileId}`],
        });
    }

    async query (queryText, { count = 3, score } = {}) {
        const results = await this.instance.similaritySearchWithScore(queryText, count);

        return results.reduce((acc, [doc, _score]) => {
            if (_score <= score) {
                acc.push(doc);
            }
            return acc;
        }, []);
    }

    async getByFileIds (fileIds) {
        const keys = fileIds.map((fileId) => `doc:${this.indexName}:${fileId}`);
        const docs = await Promise.all(keys.map(key => client.HGETALL(key)));
        return docs.filter(({ content }) => content).map(({ metadata, content }) => {
            return {
                metadata: JSON.parse(this.instance.unEscapeSpecialChars((metadata ?? "{}"))),
                pageContent: content
            };
            
        });
    }
}

const imageDescriptionEmbeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
export const imageDescriptionVectorStore = new VectorStore("imagesDescription", imageDescriptionEmbeddings);


const imageEmbeddings = new ReplicateImageEmbeddings();
export const imageVectorStore = new VectorStore("images", imageEmbeddings);