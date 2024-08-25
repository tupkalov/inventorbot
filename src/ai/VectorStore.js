import { RedisVectorStore } from "@langchain/redis";
import { OpenAIEmbeddings } from "@langchain/openai";
import ReplicateImageEmbeddings from "./ReplicateImageEmbeddings.js";

import { redisClient } from "../redis/index.js";
export default class VectorStore {
    
    constructor (indexName, embeddings) {
        this.userPrefix = process.env.REDIS_PREFIX;

        this.indexName = this.userPrefix 
            ? `${this.userPrefix}${indexName.charAt(0).toUpperCase()}${indexName.slice(1)}`
            : indexName;

        this.instance = new RedisVectorStore(embeddings, {
            redisClient,
            indexName: this.indexName,
        });
    }

    async saveNew (key, { pageContent, metadata }) {
        await this.instance.addDocuments([{
            metadata,
            pageContent: typeof pageContent !== "string" ? JSON.stringify(pageContent) : pageContent,
        }], {
            keys: [`doc:${this.indexName}:${key}`],
        });

        if (metadata.id) await this.setId(metadata.id, key);

        return { pageContent, metadata };
    }

    async setId (id, key) {
        const objectIdPrefix = this.userPrefix ? `${this.userPrefix}Objectid:` : "objectid:";
        const keyPrefix = this.userPrefix ? `${this.userPrefix}Key:` : "key:";

        await redisClient.SET(objectIdPrefix + id, key);
        await redisClient.SET(keyPrefix + key, id.toString());
    }

    async save (key, { metadata, pageContent }) {
        await redisClient.HSET(`doc:${this.indexName}:${key}`, 'metadata', this.instance.escapeSpecialChars(JSON.stringify(metadata)));
        await redisClient.HSET(`doc:${this.indexName}:${key}`, 'content', JSON.stringify(pageContent));
        return;
    }

    async query (queryText, { count = 10 } = {}) {
        let results = await this.instance.similaritySearchWithScore(queryText, count);

        const thresold = .8;
        const maxBelowThresold = 3;
        const filteredResults = results.filter(([ , score ]) => score <= thresold);

        if (filteredResults.length >= maxBelowThresold) {
            results = filteredResults;
        }

        return results.map(([ doc ]) => doc);
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