import { useEffect } from 'react';

const OAUTH_HASH_MARKERS = [
    'access_token=',
    'refresh_token=',
    'error=',
    'error_code='
];

export const OAuthHashRedirect = () => {
    useEffect(() => {
        const { hash, origin, pathname } = window.location;
        if (!hash || pathname === '/auth/callback') return;

        const hasOAuthHash = OAUTH_HASH_MARKERS.some(marker => hash.includes(marker));
        if (!hasOAuthHash) return;

        window.location.replace(`${origin}/auth/callback${hash}`);
    }, []);

    return null;
};
