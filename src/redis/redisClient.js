import { createClient } from "redis";

const client = createClient({
    url: 'redis://redis:6379'
});

export const redisConnected = new Promise((resolve, reject) => {
    client.connect().then(() => {
        console.log("Connected to Redis"); 
        resolve();
    }, (error) => {
        console.error(error);
        reject(error);
        process.exit(1);
    });
});

export default client;