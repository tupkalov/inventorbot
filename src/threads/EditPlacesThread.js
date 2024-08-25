import { AbstractThread } from 'telegramthread';
import { redisClient, getPlaces } from '../redis/index.js';


export default class EditPlacesThread extends AbstractThread {
    async processing(getNextMessage) {
        const currentPlaces = await getPlaces();
        if (!currentPlaces.length) {
            await this.chat.sendText("Местоположения не установлены");
        } else {
            await this.chat.sendText("Текущие местоположения:");
            await this.chat.sendText(currentPlaces.join("\n"));
        }

        await this.chat.sendText("Введите новые местоположения. Каждое местоположение на новой строке. или введите /cancel для отмены");

        const answer = await getNextMessage();
        if (answer.is('/cancel')) {
            await this.chat.sendText("Отменено");
            return;
        }

        if (!answer.text) {
            await this.chat.sendText("Вы не ввели местоположения");
            return;
        }

        const newPlaces = answer.text.split("\n").map((place) => place.trim());
        await redisClient.DEL("places");
        await redisClient.SADD("places", newPlaces);
        await this.chat.sendText("Местоположения обновлены");
    }
}