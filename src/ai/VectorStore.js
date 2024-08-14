import { RedisVectorStore } from "@langchain/redis";
import { OpenAIEmbeddings } from "@langchain/openai";
import ReplicateImageEmbeddings from "./ReplicateImageEmbeddings.js";

import { redisClient } from "../redis/index.js";

export default class VectorStore {
    
    constructor (indexName, embeddings) {
        this.indexName = indexName;
        this.instance = new RedisVectorStore(embeddings, {
            redisClient,
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

    async saveMetadataByFileId (fileId, metadata) {
        return await redisClient.HSET(`doc:${this.indexName}:${fileId}`, 'metadata', this.instance.escapeSpecialChars(JSON.stringify(metadata)));
    }

    async query (queryText, { count = 3, score } = {}) {
        const results = await this.instance.similaritySearchWithScore(queryText, count);

        return results.reduce((acc, [doc, _score]) => {
            if (!score || _score <= score) {
                acc.push(doc);
            }
            return acc;
        }, []);
    }

    async getByFileIds (fileIds) {
        const keys = fileIds.map((fileId) => `doc:${this.indexName}:${fileId}`);
        const docs = await Promise.all(keys.map(key => redisClient.HGETALL(key)));
        return docs.filter(({ content }) => content).map(({ metadata, content }) => {
            return {
                metadata: JSON.parse(this.instance.unEscapeSpecialChars((metadata ?? "{}"))),
                pageContent: content
            };
        });
    }

    async deleteByFileId (fileId) {
        await redisClient.DEL(`doc:${this.indexName}:${fileId}`);
    }
}

const imageDescriptionEmbeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
export const imageDescriptionVectorStore = new VectorStore("imagesDescription", imageDescriptionEmbeddings);


const imageEmbeddings = new ReplicateImageEmbeddings();
export const imageVectorStore = new VectorStore("images", imageEmbeddings);