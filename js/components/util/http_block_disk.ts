import {
    BlockDisk,
    BlockFormat,
    DiskMetadata,
    ENCODING_BLOCK,
} from 'js/formats/types';

export class HttpBlockDisk implements BlockDisk {
    encoding: typeof ENCODING_BLOCK = ENCODING_BLOCK;
    format: BlockFormat = 'po';
    metadata: DiskMetadata;
    readOnly: boolean = false;

    blocks: Uint8Array[] = [];
    fetchMap: Promise<Response>[] = [];

    constructor(
        name: string,
        private contentLength: number,
        private url: string
    ) {
        this.metadata = { name };
    }

    async blockCount(): Promise<number> {
        return this.contentLength;
    }

    async read(blockNumber: number): Promise<Uint8Array> {
        const blockCount = 5;
        if (!this.blocks[blockNumber]) {
            const fetchBlock = blockNumber >> blockCount;
            const fetchPromise = this.fetchMap[fetchBlock];
            if (fetchPromise !== undefined) {
                const response = await fetchPromise;
                if (!response.ok) {
                    throw new Error(`Error loading: ${response.statusText}`);
                }
                if (!response.body) {
                    throw new Error('Error loading: no body');
                }
            } else {
                const start = 512 * (fetchBlock << blockCount);
                const end = start + (512 << blockCount);
                this.fetchMap[fetchBlock] = fetch(this.url, {
                    headers: { range: `bytes=${start}-${end}` },
                });
                const response = await this.fetchMap[fetchBlock];
                if (!response.ok) {
                    throw new Error(`Error loading: ${response.statusText}`);
                }
                if (!response.body) {
                    throw new Error('Error loading: no body');
                }
                const blob = await response.blob();
                const buffer = await new Response(blob).arrayBuffer();
                const startBlock = fetchBlock << blockCount;
                const endBlock = startBlock + (1 << blockCount);
                let startOffset = 0;
                for (let idx = startBlock; idx < endBlock; idx++) {
                    const endOffset = startOffset + 512;
                    this.blocks[idx] = new Uint8Array(
                        buffer.slice(startOffset, endOffset)
                    );
                    startOffset += 512;
                }
            }
        }
        return this.blocks[blockNumber];
    }

    async write(blockNumber: number, block: Uint8Array) {
        this.blocks[blockNumber] = block;
    }
}
