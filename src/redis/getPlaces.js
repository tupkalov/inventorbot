import redisClient from './redisClient.js';
import emitter from './emitter.js';

var lastPlaces = null;

export default async function getPlaces() {

    const newPlaces = await redisClient.SMEMBERS("places");
    if (JSON.stringify(newPlaces) !== JSON.stringify(lastPlaces)) {
        emitter.emit("places", newPlaces);
    }
    
    return lastPlaces = newPlaces;
}