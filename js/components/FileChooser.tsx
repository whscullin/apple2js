import { h, Fragment } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { noAwait } from './util/promises';

export interface FilePickerAcceptType {
    description?: string | undefined;
    accept: Record<string, string | string[]>;
}

const ACCEPT_EVERYTHING_TYPE: FilePickerAcceptType = {
    description: 'Any file',
    accept: { '*/*': [] },
};

export interface FileChooserProps {
    disabled?: boolean;
    onChange: (handles: Array<FileSystemFileHandle>) => void;
    accept?: FilePickerAcceptType[];
    control?: typeof controlDefault;
}

const hasPicker = !!window.showOpenFilePicker;
const controlDefault = hasPicker ? 'picker' : 'input';

interface InputFileChooserProps {
    disabled?: boolean;
    onChange?: (files: FileList) => void;
    accept?: FilePickerAcceptType[];
}

interface ExtraProps {
    accept?: string;
}

const InputFileChooser = ({
    disabled = false,
    onChange = () => { /* do nothing */ },
    accept = [],
}: InputFileChooserProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const filesRef = useRef<FileList>();

    const onChangeInternal = useCallback(() => {
        if (inputRef.current?.files) {
            const newFiles = inputRef.current?.files;
            if (filesRef.current !== newFiles) {
                filesRef.current = newFiles;
                onChange(newFiles);
            }
        }
    }, [onChange]);

    const extraProps = useMemo<ExtraProps>(() => {
        // Accept all of the given MIME types and extensions. An argument
        // could be made to throw out all of the MIME types and just keep
        // the extensions, but this seemed to follow the intent in the
        // spec:
        //
        // https://html.spec.whatwg.org/multipage/input.html#file-upload-state-(type=file)
        //
        // which allows pretty generous interpretations.
        //
        const newAccept = [];
        for (const type of accept) {
            for (const [typeString, suffixes] of Object.entries(type.accept)) {
                newAccept.push(typeString);
                if (Array.isArray(suffixes)) {
                    newAccept.push(...suffixes);
                } else {
                    newAccept.push(suffixes);
                }
            }
        }

        const extraProps: { accept?: string } = {};
        if (newAccept.length > 0) {
            extraProps['accept'] = newAccept.join(',');
        }

        return extraProps;
    }, [accept]);

    return (
        <input type="file" role='button' aria-label='Open file'
            ref={inputRef}
            onChange={onChangeInternal}
            disabled={disabled}
            {...extraProps} />
    );
};

interface FilePickerChooserProps {
    disabled?: boolean;
    onChange?: (files: FileSystemFileHandle[]) => void;
    accept?: FilePickerAcceptType[];
}

const FilePickerChooser = ({
    disabled = false,
    onChange = () => { /* do nothing */ },
    accept = [ACCEPT_EVERYTHING_TYPE]
}: FilePickerChooserProps) => {
    const [busy, setBusy] = useState<boolean>(false);
    const [selectedFilename, setSelectedFilename] = useState<string>();
    const [fileHandles, setFileHandles] = useState<FileSystemFileHandle[]>();

    const onClickInternal = useCallback(async () => {
        if (busy) {
            return;
        }
        setBusy(true);
        try {
            const pickedFiles = await window.showOpenFilePicker({
                multiple: false,
                excludeAcceptAllOption: true,
                types: accept,
            });
            if (fileHandles !== pickedFiles) {
                setFileHandles(pickedFiles);
                onChange(pickedFiles);
            }
        } catch (e: unknown) {
            console.error(e);
        } finally {
            setBusy(false);
        }
    }, [accept, busy, fileHandles, onChange]);

    useEffect(() => {
        setSelectedFilename(
            fileHandles?.length
                ? fileHandles[0].name
                : 'No file selected');
    }, [fileHandles]);

    return (
        <>
            <button onClick={noAwait(onClickInternal)} disabled={disabled || busy}>
                Choose&nbsp;File
            </button>
            &nbsp;
            <span role="label">{selectedFilename}</span>
        </>
    );
};

/**
 * File chooser component displayed as a button followed by the name of the
 * chosen file (if any). When clicked, the button opens a native file chooser.
 * If the browser supports the `window.showOpenFilePicker` function, this
 * component uses it to open the file chooser. Otherwise, the component uses
 * a regular file input element.
 *
 * Using `window.showOpenFilePicker` has the advantage of allowing read/write
 * access to the file, whereas the regular input element only gives read
 * access.
 */
export const FileChooser = ({
    onChange,
    control = controlDefault,
    ...rest
}: FileChooserProps) => {

    const onChangeForInput = useCallback((files: FileList) => {
        const handles: FileSystemFileHandle[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files.item(i);
            if (file === null) {
                continue;
            }
            handles.push({
                kind: 'file',
                name: file.name,
                getFile: () => Promise.resolve(file),
                createWritable: (_options) => Promise.reject('File not writable.'),
                queryPermission: (descriptor) => Promise.resolve(descriptor === 'read' ? 'granted' : 'denied'),
                requestPermission: (descriptor) => Promise.resolve(descriptor === 'read' ? 'granted' : 'denied'),
                isSameEntry: (_unused) => Promise.resolve(false),
                isDirectory: false,
                isFile: true,
            });
        }
        onChange(handles);
    }, [onChange]);

    const onChangeForPicker = useCallback((fileHandles: FileSystemFileHandle[]) => {
        onChange(fileHandles);
    }, [onChange]);

    return control === 'picker'
        ? (
            <FilePickerChooser onChange={onChangeForPicker} {...rest} />
        )
        : (
            <InputFileChooser onChange={onChangeForInput} {...rest} />
        );
};
