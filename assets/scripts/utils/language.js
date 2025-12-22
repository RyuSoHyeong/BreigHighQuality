export async function loadLanguage() {
    /*
    const userLang = (navigator.language || 'en').split('-')[0];
    const supportedLangs = ['en', 'ru', 'ko', 'zh', 'de', 'fr', 'es', 'ar', 'ja'];
    const lang = supportedLangs.includes(userLang) ? userLang : 'en';
    */
    const lang = 'en';

    try {
        const response = await fetch(`assets/language/${lang}.json`);
        if (!response.ok) {
            console.error(`Language file not found: ${lang}`);
            return;
        }

        const translations = await response.json();

        document.querySelectorAll('[data-lng]').forEach((el) => {
            const key = el.getAttribute('data-lng');
            if (key && Object.prototype.hasOwnProperty.call(translations, key)) {
                el.textContent = translations[key];
            }
        });
    } catch (e) {
        console.error('Translation load error:', e);
    }
}