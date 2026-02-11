import { useEffect, useState } from 'react';

export const useHash = () => {
    const [hash, setHash] = useState(window.location.hash);

    const popstateListener = () => {
        const hash = window.location.hash;
        setHash(hash);
    };

    useEffect(() => {
        window.addEventListener('popstate', popstateListener);
        return () => {
            window.removeEventListener('popstate', popstateListener);
        };
    }, []);

    return hash;
};
