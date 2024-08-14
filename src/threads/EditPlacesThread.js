import { AbstractThread } from 'telegramthread';
import { redisClient, getPlaces } from '../redis/index.js';


export default class EditPlacesThread extends AbstractThread {
    async processing(startMessage, getNextMessage) {
        const currentPlaces = await getPlaces();
        if (!currentPlaces.length) {
            await this.sendMessage("Местоположения не установлены");
        } else {
            await this.sendMessage("Текущие местоположения:");
            await this.sendMessage(currentPlaces.join("\n"));
        }

        await this.sendMessage("Введите новые местоположения. Каждое местоположение на новой строке. или введите /cancel для отмены");

        const answer = await getNextMessage();
        if (answer.is('/cancel')) {
            await this.sendMessage("Отменено");
            return;
        }

        if (!answer.text) {
            await this.sendMessage("Вы не ввели местоположения");
            return;
        }

        const newPlaces = answer.text.split("\n").map((place) => place.trim());
        await redisClient.DEL("places");
        await redisClient.SADD("places", newPlaces);
        await this.sendMessage("Местоположения обновлены");
    }
}