const user = localStorage.getItem('portal_logged_in_user');
if (!user) {
    window.location.href = '/logout';
}

function logout() {
    localStorage.removeItem('portal_logged_in_user');
    localStorage.removeItem('ajeer_logged_in_user');
    window.location.href = '/logout';
}
