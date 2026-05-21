/**
 * FIXGHAR fixer online presence — heartbeat + offline on tab close / logout
 */
(function () {
    const HEARTBEAT_MS = 25000;

    function getToken() {
        return localStorage.getItem('fixghar_token') || sessionStorage.getItem('fixghar_token');
    }

    function getApiBase() {
        return (
            window.FIXGHAR_CONFIG?.api?.baseURL ||
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:5000/api'
                : 'https://fixghar.onrender.com/api')
        );
    }

    async function sendHeartbeat() {
        const token = getToken();
        if (!token) return;
        try {
            if (window.apiService?.fixerHeartbeat) {
                await window.apiService.fixerHeartbeat();
            } else {
                await fetch(`${getApiBase()}/fixers/presence/heartbeat`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });
            }
        } catch (e) {
            console.warn('[presence] heartbeat failed:', e.message);
        }
    }

    function sendOfflineSync() {
        const token = getToken();
        if (!token) return;
        const url = `${getApiBase()}/fixers/presence/offline`;
        try {
            fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                credentials: 'include',
                keepalive: true,
                body: '{}'
            }).catch(() => {});
        } catch (_) {}
    }

    async function sendOffline() {
        const token = getToken();
        if (!token) return;
        const url = `${getApiBase()}/fixers/presence/offline`;
        try {
            await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                credentials: 'include',
                keepalive: true,
                body: '{}'
            });
        } catch (e) {
            console.warn('[presence] offline failed:', e.message);
        }
    }

    let heartbeatTimer = null;

    function startFixerPresence() {
        const userType =
            localStorage.getItem('fixghar_user_type') ||
            sessionStorage.getItem('fixghar_user_type');
        if (userType !== 'fixer' || !getToken()) return;

        sendHeartbeat();
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS);
    }

    function stopFixerPresence() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    window.startFixerPresence = startFixerPresence;
    window.stopFixerPresence = stopFixerPresence;
    window.fixerGoOfflineNow = sendOffline;

    window.logout = async function logout() {
        if (!confirm('Are you sure you want to logout?')) return;
        stopFixerPresence();
        await sendOffline();
        try {
            if (window.apiService?.logout) await window.apiService.logout();
        } catch (_) {}
        localStorage.removeItem('fixghar_token');
        sessionStorage.removeItem('fixghar_token');
        localStorage.removeItem('fixghar_user_data');
        sessionStorage.removeItem('fixghar_user_data');
        localStorage.removeItem('fixghar_user_type');
        sessionStorage.removeItem('fixghar_user_type');
        localStorage.removeItem('fixer_online');
        window.location.href = '../index.html';
    };

    window.addEventListener('beforeunload', () => {
        sendOfflineSync();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            sendHeartbeat();
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startFixerPresence);
    } else {
        startFixerPresence();
    }
})();
