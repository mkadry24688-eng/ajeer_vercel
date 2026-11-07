
function checkAuth() {
    const loggedInUser = localStorage.getItem('portal_logged_in_user');
    if (!loggedInUser) {
        const legacyUser = localStorage.getItem('ajeer_logged_in_user');
        if (legacyUser) {
            localStorage.setItem('portal_logged_in_user', legacyUser);
            return JSON.parse(legacyUser);
        }
        window.location.href = '/logout';
        return null;
    }
    return JSON.parse(loggedInUser);
}

function logout() {
    localStorage.removeItem('portal_logged_in_user');
    localStorage.removeItem('ajeer_logged_in_user');
    localStorage.removeItem('health_logged_in_user');
    window.location.href = '/logout';
}

function showUserInfo() {
    const user = checkAuth();
    if (!user) return;

    const navbarBrand = document.querySelector('.navbar-brand');
    const userContainer = document.querySelector('.d-flex.align-items-center.gap-3');

    if (navbarBrand && navbarBrand.parentElement) {

        let userInfo = userContainer;
        if (!userInfo) {
            userInfo = document.createElement('div');
            userInfo.className = 'd-flex align-items-center gap-3 ms-auto';
            navbarBrand.parentElement.appendChild(userInfo);
        }

        userInfo.innerHTML = `
            <span class="text-muted d-none d-md-inline">أهلاً، <strong>${user.full_name || user.username}</strong></span>
            <button onclick="logout()" class="btn btn-sm btn-outline-danger">
                <i class="bi bi-box-arrow-left ms-1"></i>
                خروج
            </button>
        `;
    }
}

if (!window.location.pathname.includes('/login')) {
    const user = checkAuth();
    if (user) {
        window.addEventListener('DOMContentLoaded', showUserInfo);
    }
}
