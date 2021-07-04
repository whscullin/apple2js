/* Copyright 2021 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

import { debug } from '../js/util';
import { jsonDecode } from '../js/formats/format_utils';
import {
    createDisk,
    createDiskFromJsonDisk,
} from '../js/formats/create_disk';
import {
    FormatWorkerMessage,
    Disk,
    DiskProcessedResponse,
    DISK_PROCESSED,
    PROCESS_BINARY,
    PROCESS_JSON_DISK,
    PROCESS_JSON,
} from '../js/formats/types';

debug('Worker loaded');

addEventListener('message', (message: MessageEvent<FormatWorkerMessage>) => {
    debug('Worker started', message.type);
    const data = message.data;
    const { drive } = data.payload;
    let disk: Disk | null = null;

    switch (data.type) {
        case PROCESS_BINARY: {
            const { fmt, options } = data.payload;
            disk = createDisk(fmt, options);
        }
            break;

        case PROCESS_JSON_DISK: {
            const { jsonDisk } = data.payload;
            disk = createDiskFromJsonDisk(jsonDisk);
        }
            break;

        case PROCESS_JSON: {
            const { json } = data.payload;
            disk = jsonDecode(json);
        }
            break;
    }

    const response: DiskProcessedResponse = {
        type: DISK_PROCESSED,
        payload: {
            drive,
            disk
        }
    };

    self.postMessage(response);

    debug('Worker complete', message.type);
});
