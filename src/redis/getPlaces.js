import redisClient from './redisClient.js';

export default async function getPlaces() {
    return await redisClient.SMEMBERS("places");
}