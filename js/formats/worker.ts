import { debug } from '../util';
import { jsonDecode } from './format_utils';
import {
    createDisk,
    createDiskFromJsonDisk,
} from './create_disk';
import {
    FormatWorkerMessage,
    Disk,
    DiskProcessedResponse,
    DiskProcessedType,
    ProcessBinaryType,
    ProcessJsonDiskType,
    ProcessJsonType,
} from './types';

debug('Worker loaded');

addEventListener('message', (message: MessageEvent<FormatWorkerMessage>) => {
    debug('Worker started', message.type);
    const data = message.data;
    const { drive } = data.payload;
    let disk: Disk | null = null;

    switch (data.type) {
        case ProcessBinaryType: {
            const { fmt, options } = data.payload;
            disk = createDisk(fmt, options);
        }
            break;

        case ProcessJsonDiskType: {
            const { jsonDisk } = data.payload;
            disk = createDiskFromJsonDisk(jsonDisk);
        }
            break;

        case ProcessJsonType: {
            const { json } = data.payload;
            disk = jsonDecode(json);
        }
            break;
    }

    const response: DiskProcessedResponse = {
        type: DiskProcessedType,
        payload: {
            drive,
            disk
        }
    };

    self.postMessage(response);

    debug('Worker complete', message.type);
});
