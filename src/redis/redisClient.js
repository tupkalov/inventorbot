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

export default client;