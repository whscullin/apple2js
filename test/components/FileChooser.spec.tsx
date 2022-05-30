/**
 * @jest-environment ./test/env/jsdom-with-backdoors
 */

import 'jest';
import { h } from 'preact';
import { fireEvent, render, screen, waitFor } from '@testing-library/preact';

import 'test/env/jsdom-with-backdoors';
import { FileChooser, FileChooserProps } from '../../js/components/FileChooser';

type ShowOpenFilePicker = typeof window.showOpenFilePicker;

const FAKE_FILE_HANDLE = {
    kind: 'file',
    name: 'file name',
    createWritable: jest.fn(),
    getFile: jest.fn(),
    isSameEntry: jest.fn(),
    queryPermission: jest.fn(),
    requestPermission: jest.fn(),
    isFile: true,
    isDirectory: false,
} as const;

const NOP = () => { /* do nothing */ };

// eslint-disable-next-line no-undef
const EMPTY_FILE_LIST = backdoors.newFileList();

const FAKE_FILE = new File([], 'fake');

describe('FileChooser', () => {
    describe('input-based chooser', () => {
        it('should be instantiable', () => {
            const { container } = render(<FileChooser control='input' onChange={NOP} />);

            expect(container).not.toBeNull();
        });

        it('should use the file input element', async () => {
            render(<FileChooser control='input' onChange={NOP} />);

            const inputElement = await screen.findByRole('button') as HTMLInputElement;
            expect(inputElement.type).toBe('file');
        });

        it('should fire a callback with empty list when no files are selected', async () => {
            const onChange = jest.fn();
            render(<FileChooser control='input' onChange={onChange} />);
            const inputElement = await screen.findByRole('button') as HTMLInputElement;
            inputElement.files = EMPTY_FILE_LIST;
            fireEvent.change(inputElement);
            await waitFor(() => {
                expect(onChange).toBeCalledWith([]);
            });
        });

        it('should fire a callback with a file handle when a file is selected', async () => {
            const onChange = jest.fn<ReturnType<FileChooserProps['onChange']>, Parameters<FileChooserProps['onChange']>>();
            render(<FileChooser control='input' onChange={onChange} />);
            const inputElement = await screen.findByRole('button') as HTMLInputElement;
            // eslint-disable-next-line no-undef
            inputElement.files = backdoors.newFileList(FAKE_FILE);
            fireEvent.change(inputElement);
            await waitFor(async () => {
                expect(onChange).toHaveBeenCalled();
                const handleList = onChange.mock.calls[0][0];
                expect(handleList).toHaveLength(1);
                const handle = handleList[0];
                expect(handle.kind).toBe('file');
                expect(handle.name).toBe(FAKE_FILE.name);
                expect(handle.isWritable).toBe(false);
                await expect(handle.getFile()).resolves.toBe(FAKE_FILE);
                await expect(handle.createWritable()).rejects.toEqual('File not writable.');
            });
        });
    });

    describe('picker-base chooser', () => {
        const mockFilePicker = jest.fn<ReturnType<ShowOpenFilePicker>, Parameters<ShowOpenFilePicker>>();

        beforeEach(() => {
            expect(window.showOpenFilePicker).not.toBeDefined();
            window.showOpenFilePicker = mockFilePicker as unknown as ShowOpenFilePicker;
            mockFilePicker.mockReset();
        });

        afterEach(() => {
            window.showOpenFilePicker = undefined as unknown as typeof window.showOpenFilePicker;
        });

        it('should be instantiable', () => {
            const { container } = render(<FileChooser control='picker' onChange={NOP} />);

            expect(container).not.toBeNull();
        });

        it('should fire a callback with empty list when no files are selected', async () => {
            mockFilePicker.mockResolvedValueOnce([]);
            const onChange = jest.fn();
            render(<FileChooser control='picker' onChange={onChange} />);

            fireEvent.click(await screen.findByText('Choose File'));

            await waitFor(() => {
                expect(mockFilePicker).toBeCalled();
                expect(onChange).toBeCalledWith([]);
            });
        });

        it('should fire a callback with a file handle when a file is selected', async () => {
            mockFilePicker.mockResolvedValueOnce([FAKE_FILE_HANDLE]);
            const onChange = jest.fn<ReturnType<FileChooserProps['onChange']>, Parameters<FileChooserProps['onChange']>>();
            render(<FileChooser control='picker' onChange={onChange} />);

            fireEvent.click(await screen.findByText('Choose File'));

            await waitFor(() => {
                expect(mockFilePicker).toBeCalled();
                expect(onChange).toHaveBeenCalled();
                const handleList = onChange.mock.calls[0][0];
                expect(handleList).toHaveLength(1);
                const handle = handleList[0];
                expect(handle.kind).toBe(FAKE_FILE_HANDLE.kind);
                expect(handle.name).toBe(FAKE_FILE_HANDLE.name);
                expect(handle.isWritable).toBe(true);
            });
        });
    });
});