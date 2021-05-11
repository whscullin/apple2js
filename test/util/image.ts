export const createImageFromImageData = (data: ImageData) => {
    const canvas = document.createElement('canvas');
    canvas.width = data.width;
    canvas.height = data.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(data, 0, 0);
    const url = canvas.toDataURL('image/png');
    return Buffer.from(url.split(',')[1], 'base64');
};
