import { byte } from '../../js/types';

export const assertByte = (b: byte) => {
    expect(b <= 0xff).toEqual(true);
    expect(b >= 0x00).toEqual(true);
};
