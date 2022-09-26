/**
 * Provide types for the jsdom-with-backdoors testing environment.
 */
export { };

declare global {
    const backdoors: {
        newFileList(...files: File[]): FileList;
    };
}
