import { byte } from '../../js/types';

export const assertByte = (b: byte) => {
    expect(b <= 0xFF).toEqual(true);
    expect(b >= 0x00).toEqual(true);
};
