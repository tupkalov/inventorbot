import redisClient from './redisClient.js';
const KEY = `${process.env.REDIS_PREFIX ? process.env.REDIS_PREFIX + "_" : ""}places_json`;

export async function del() {
    return await redisClient.DEL(KEY);
}

export async function save(places) {
    await redisClient.SET(KEY, JSON.stringify(places));
}

export async function get() {
    const raw_result = await redisClient.GET(KEY);
    return raw_result ? JSON.parse(raw_result) : [];
}

export async function getLastPlace() {
    return (await get()).pop();
}

export async function saveLastPlace(place) {
    const places = await get();
    const setPlaces = new Set(places);
    setPlaces.delete(place);
    return save([...setPlaces, place]);
}