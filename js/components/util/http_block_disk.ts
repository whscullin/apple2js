import { HeaderData, read2MGHeader } from 'js/formats/2mg';
import {
    BlockDisk,
    BlockFormat,
    DiskMetadata,
    ENCODING_BLOCK,
} from 'js/formats/types';

class Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

export class HttpBlockDisk implements BlockDisk {
    encoding: typeof ENCODING_BLOCK = ENCODING_BLOCK;
    format: BlockFormat = 'po';
    metadata: DiskMetadata;
    readOnly: boolean = false;
    headerData: HeaderData | null = null;

    blocks: Uint8Array[] = [];
    fetchMap: Deferred<boolean>[] = [];

    constructor(
        name: string,
        private contentLength: number,
        private url: string
    ) {
        this.metadata = { name };
    }

    private async getHeaderData(): Promise<HeaderData | null> {
        if (this.format === '2mg') {
            if (!this.headerData) {
                const header = await fetch(this.url, {
                    headers: { range: 'bytes=0-63' },
                });
                const headerBody = await header.arrayBuffer();
                this.headerData = read2MGHeader(headerBody);
            }
            return this.headerData;
        }
        return null;
    }

    async blockCount(): Promise<number> {
        const headerData = await this.getHeaderData();
        if (headerData) {
            return headerData.bytes >> 9;
        } else {
            return this.contentLength >> 9;
        }
    }

    async read(blockNumber: number): Promise<Uint8Array> {
        const blockShift = 5;
        if (!this.blocks[blockNumber]) {
            const fetchBlock = blockNumber >> blockShift;
            const deferred = this.fetchMap[fetchBlock];
            if (deferred !== undefined) {
                await deferred.promise;
            } else {
                const deferred = new Deferred<boolean>();
                this.fetchMap[fetchBlock] = deferred;
                const headerData = await this.getHeaderData();
                const headerSize = headerData?.offset ?? 0;
                const start = 512 * (fetchBlock << blockShift) + headerSize;
                const end = start + (512 << blockShift) - 1;
                const response = await fetch(this.url, {
                    headers: { range: `bytes=${start}-${end}` },
                });
                if (!response.ok) {
                    const error = new Error(
                        `Error loading: ${response.statusText}`
                    );
                    deferred.reject(error);
                    throw error;
                }
                if (!response.body) {
                    const error = new Error('Error loading: no body');
                    deferred.reject(error);
                    throw error;
                }
                const buffer = await response.arrayBuffer();
                const startBlock = fetchBlock << blockShift;
                const endBlock = startBlock + (1 << blockShift);
                let startOffset = 0;
                for (let idx = startBlock; idx < endBlock; idx++) {
                    const endOffset = startOffset + 512;
                    this.blocks[idx] = new Uint8Array(
                        buffer.slice(startOffset, endOffset)
                    );
                    startOffset += 512;
                }
                deferred.resolve(true);
            }
        }
        return this.blocks[blockNumber];
    }

    async write(blockNumber: number, block: Uint8Array) {
        this.blocks[blockNumber] = block;
    }
}
