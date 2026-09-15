
(function() {

    var reminders = [
        'صلِّ على محمد ﷺ',
        'اللهم صلِّ وسلم على نبينا محمد ﷺ',
        'صلى الله عليه وسلم ﷺ',
        'اللهم صلِّ على محمد وعلى آل محمد ﷺ'
    ];

    function createNotification() {
        if (document.getElementById('islamic-reminder')) return;

        var notification = document.createElement('div');
        notification.id = 'islamic-reminder';
        notification.innerHTML =
            '<div class="reminder-content">' +
                '<div class="reminder-icon">' +
                    '<svg viewBox="0 0 24 24" fill="currentColor">' +
                        '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>' +
                    '</svg>' +
                '</div>' +
                '<div class="reminder-text">' +
                    '<span class="reminder-title">تذكير</span>' +
                    '<span class="reminder-message"></span>' +
                '</div>' +
                '<button class="reminder-close" id="reminder-close-btn">' +
                    '<svg viewBox="0 0 24 24" fill="currentColor">' +
                        '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>' +
                    '</svg>' +
                '</button>' +
            '</div>';
        document.body.appendChild(notification);

        document.getElementById('reminder-close-btn').onclick = function() {
            closeReminder();
        };

        addStyles();
    }

    function addStyles() {
        if (document.getElementById('reminder-styles')) return;

        var styles = document.createElement('style');
        styles.id = 'reminder-styles';
        styles.textContent =
            '#islamic-reminder {' +
                'position: fixed;' +
                'bottom: 24px;' +
                'right: 24px;' +
                'z-index: 10000;' +
                'opacity: 0;' +
                'transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);' +
                'transform: translateX(120%);' +
                'pointer-events: none;' +
            '}' +
            '#islamic-reminder.show {' +
                'transform: translateX(0);' +
                'opacity: 1;' +
                'pointer-events: auto;' +
            '}' +
            '.reminder-content {' +
                'display: flex;' +
                'align-items: center;' +
                'gap: 12px;' +
                'background: linear-gradient(135deg, #10b981 0%, #059669 100%);' +
                'color: white;' +
                'padding: 14px 20px;' +
                'border-radius: 16px;' +
                'box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;' +
                'font-family: "Cairo", sans-serif;' +
                'direction: rtl;' +
                'min-width: 280px;' +
                'max-width: 360px;' +
            '}' +
            '.reminder-icon {' +
                'width: 36px;' +
                'height: 36px;' +
                'background: rgba(255, 255, 255, 0.2);' +
                'border-radius: 50%;' +
                'display: flex;' +
                'align-items: center;' +
                'justify-content: center;' +
                'flex-shrink: 0;' +
                'animation: pulse-icon 2s ease-in-out infinite;' +
            '}' +
            '.reminder-icon svg { width: 20px; height: 20px; }' +
            '@keyframes pulse-icon {' +
                '0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4); }' +
                '50% { transform: scale(1.05); box-shadow: 0 0 0 6px rgba(255, 255, 255, 0); }' +
            '}' +
            '.reminder-text { display: flex; flex-direction: column; flex-grow: 1; }' +
            '.reminder-title { font-size: 10px; font-weight: 600; opacity: 0.9; }' +
            '.reminder-message { font-size: 14px; font-weight: 700; line-height: 1.4; }' +
            '.reminder-close {' +
                'background: rgba(255, 255, 255, 0.2);' +
                'border: none;' +
                'width: 24px;' +
                'height: 24px;' +
                'border-radius: 50%;' +
                'display: flex;' +
                'align-items: center;' +
                'justify-content: center;' +
                'cursor: pointer;' +
                'transition: all 0.3s ease;' +
                'flex-shrink: 0;' +
            '}' +
            '.reminder-close:hover { background: rgba(255, 255, 255, 0.3); transform: scale(1.1); }' +
            '.reminder-close svg { width: 14px; height: 14px; color: white; }' +
            '@media (max-width: 576px) {' +
                '#islamic-reminder { bottom: 16px; left: 16px; right: 16px; transform: translateY(120%); }' +
                '#islamic-reminder.show { transform: translateY(0); }' +
                '.reminder-content { min-width: auto; padding: 12px 16px; gap: 10px; }' +
                '.reminder-icon { width: 32px; height: 32px; }' +
                '.reminder-icon svg { width: 16px; height: 16px; }' +
                '.reminder-message { font-size: 13px; }' +
            '}' +
            '@media print { #islamic-reminder { display: none !important; } }';
        document.head.appendChild(styles);
    }

    var autoHideTimeout = null;

    function showReminder() {
        createNotification();

        var notification = document.getElementById('islamic-reminder');
        var messageEl = notification.querySelector('.reminder-message');

        var randomIndex = Math.floor(Math.random() * reminders.length);
        messageEl.textContent = reminders[randomIndex];

        if (autoHideTimeout) {
            clearTimeout(autoHideTimeout);
        }

        setTimeout(function() {
            notification.classList.add('show');
        }, 100);

        autoHideTimeout = setTimeout(function() {
            closeReminder();
        }, 30000);
    }

    function closeReminder() {
        var notification = document.getElementById('islamic-reminder');
        if (notification) {
            notification.classList.remove('show');
        }
        if (autoHideTimeout) {
            clearTimeout(autoHideTimeout);
            autoHideTimeout = null;
        }
    }

    window.closeReminder = closeReminder;

    function init() {
        console.log('Islamic Reminder initializing...');

        setTimeout(function() {
            showReminder();
        }, 3000);

        setInterval(function() {
            showReminder();
        }, 900000);

        console.log('Islamic Reminder ready!');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
