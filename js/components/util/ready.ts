export class Ready {
    onReady: (value?: unknown) => void;
    promise: Promise<unknown>;

    constructor() {
        this.promise = new Promise((resolve, _reject) => {
            this.onReady = resolve;
        }).catch(console.error);
    }
}
