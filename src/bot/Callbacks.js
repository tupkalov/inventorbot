import ObjectId from 'objectid';

export default class Callbacks {
    constructor() {
        this.callbacks = {};
    }

    setCallback(callback) {
        const id = ObjectId();
        this.callbacks[id] = async () => {
            try {
                await callback();
                delete this.callbacks[id];
            } catch (error) {
                console.error("Error in callback " + id, error);
            }
        }
        return id.toString();
    }

    executeCallback(id) {
        this.callbacks[id]?.();
    }
}

export const callbackStore = new Callbacks();