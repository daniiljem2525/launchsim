import React, { createContext, useContext, useState, useEffect } from 'react';

// Lightweight i18n: language context + shared dictionary for app chrome.
// Landing carries its own copy in both languages (big blocks), components use t().
const RU = {
  'nav.dashboard': 'Панель управления', 'nav.experiments': 'Эксперименты', 'nav.market': 'Аналитика рынка',
  'nav.account': 'Аккаунт', 'nav.admin': 'Админ', 'nav.newProject': '+ Новый проект', 'nav.credits': 'кредиты',
  'nav.brandTag': 'Платформа предзапускного тестирования',
  'auth.login': 'Войти', 'auth.signup': 'Создать аккаунт', 'auth.signout': 'Выйти', 'auth.startFree': 'Начать бесплатно',
  'auth.email': 'Электронная почта', 'auth.password': 'Пароль', 'auth.name': 'Имя',
  'auth.welcomeBack': 'С возвращением', 'auth.signInSub': 'Войдите в своё рабочее пространство LaunchSim.',
  'auth.signInBtn': 'Войти', 'auth.signingIn': 'Вхожу…', 'auth.or': 'или',
  'auth.google': 'Продолжить с Google', 'auth.googleNotConfigured': 'Вход через Google не настроен в этом окружении. Используйте email и пароль.',
  'auth.forgot': 'Забыли пароль?', 'auth.createAccount': 'Создать аккаунт',
  'auth.createTitle': 'Создайте аккаунт', 'auth.createSub': 'Бесплатный план включает 2 кредита — достаточно для первой симуляции.',
  'auth.createBtn': 'Создать аккаунт', 'auth.creating': 'Создаю…', 'auth.min8': 'Минимум 8 символов', 'auth.hasAccount': 'Уже есть аккаунт?',
  'dash.title': 'Панель управления', 'dash.sub1': 'Проверьте гипотезы.', 'dash.sub2': 'Найдите главный риск.', 'dash.welcome': 'С возвращением,',
  'dash.projects': 'Проекты', 'dash.simulations': 'Симуляций запущено', 'dash.readyToTest': 'Готовы к тесту', 'dash.creditsLeft': 'Осталось кредитов',
  'dash.yourProjects': 'Ваши проекты', 'dash.noProjects': 'Пока нет проектов',
  'dash.noProjectsText': 'Создайте первый проект и запустите симуляцию до того, как напишете строку кода.',
  'dash.testIdea': 'Протестировать идею', 'dash.iteration': 'итерация', 'dash.iterations': 'итераций',
  'dash.simulation': 'симуляция', 'dash.simulationsMany': 'симуляций', 'dash.noRealTest': 'Реальный тест пока не запускался',
  'dash.latestRealTest': 'Последний real test:', 'dash.readyForReal': 'Готов к реальному тесту?',
  'dash.readySub': 'Проекты с баллом 71+ стоит проверять небольшим рекламным бюджетом до разработки.',
  'dash.openTestReady': 'Открыть проект, готовый к тесту', 'dash.runAnother': 'Запустить ещё одну симуляцию',
  'wizard.newProject': 'Новый проект', 'wizard.sub': '8 коротких вопросов. Остальное делает LaunchSim.',
  'wizard.back': '← Назад', 'wizard.continue': 'Далее →', 'wizard.start': 'Запустить анализ',
  'wizard.running': 'Запускаю исследование, гипотезы и первую симуляцию… Это займёт несколько секунд.',
  'wizard.creditNote': 'Базовая симуляция — 1 кредит. Стандартная (2) или расширенная (5) доступны позже.',
  'w1.title': 'Что вы строите?', 'w1.nameLabel': 'Название проекта (необязательно — предложим своё)', 'w1.desc': 'Опишите продукт',
  'w1.hint': 'Одного абзаца достаточно. Если можете — упомяните, чем отличаетесь.',
  'w2.title': 'Для кого это?', 'w2.hint': 'Будьте конкретнее — «городские владельцы собак» лучше, чем «все».',
  'w3.title': 'Какую проблему решает?', 'w3.hint': 'Насколько она болезненна сегодня? Как её решают сейчас?',
  'w4.title': 'Как вы будете зарабатывать?', 'w5.title': 'Ожидаемая цена',
  'w5.perMonth': 'В месяц.', 'w5.oneTime': 'Единоразово.', 'w5.primary': 'Основная цена.', 'w5.label': 'Цена, $',
  'w6.title': 'Целевой рынок', 'w6.hint': 'Страна или регион первого запуска.', 'w7.title': 'Бюджет на тест',
  'w7.hint': 'Сумма, которую реально потратить на первый рекламный тест.', 'w8.title': 'Что хотите проверить?',
  'w8.hint': 'Выберите всё важное — гипотезы будут расставлены по приоритетам.',
  'set.title': 'Настройки', 'set.sub': 'Профиль, язык, пароль и выход.',
  'set.profile': 'Профиль', 'set.email': 'Электронная почта', 'set.save': 'Сохранить', 'set.saved': 'Профиль обновлён.',
  'set.language': 'Язык интерфейса', 'set.languageHint': 'Применяется сразу и запоминается.',
  'set.pass': 'Смена пароля', 'set.currentPass': 'Текущий пароль', 'set.newPass': 'Новый пароль', 'set.update': 'Обновить пароль',
  'set.passOk': 'Пароль обновлён. Используйте новый при следующем входе.', 'set.passWrong': 'Текущий пароль неверен.',
  'set.signOut': 'Выйти из аккаунта', 'set.plan': 'Тариф и кредиты', 'set.planLink': 'Тарифы и биллинг →',
  'set.member': 'Аккаунт создан',
};
const EN = {
  'nav.dashboard': 'Dashboard', 'nav.experiments': 'Experiments', 'nav.market': 'Market Intelligence',
  'nav.account': 'Account', 'nav.admin': 'Admin', 'nav.newProject': '+ New Project', 'nav.credits': 'credits',
  'nav.brandTag': 'Pre-Launch Testing Platform',
  'auth.login': 'Sign in', 'auth.signup': 'Sign up', 'auth.signout': 'Sign out', 'auth.startFree': 'Start free',
  'auth.email': 'Email', 'auth.password': 'Password', 'auth.name': 'Name',
  'auth.welcomeBack': 'Welcome back', 'auth.signInSub': 'Sign in to your LaunchSim workspace.',
  'auth.signInBtn': 'Sign in', 'auth.signingIn': 'Signing in…', 'auth.or': 'or',
  'auth.google': 'Continue with Google', 'auth.googleNotConfigured': 'Google sign-in is not configured in this environment. Use email & password instead.',
  'auth.forgot': 'Forgot password?', 'auth.createAccount': 'Create account',
  'auth.createTitle': 'Create your account', 'auth.createSub': 'Free plan includes 2 credits — enough for your first simulation.',
  'auth.createBtn': 'Create account', 'auth.creating': 'Creating…', 'auth.min8': 'Min 8 characters', 'auth.hasAccount': 'Already have an account?',
  'dash.title': 'Dashboard', 'dash.sub1': 'Test your assumptions.', 'dash.sub2': 'Find your biggest risk.', 'dash.welcome': 'Welcome back,',
  'dash.projects': 'Projects', 'dash.simulations': 'Simulations run', 'dash.readyToTest': 'Ready to test', 'dash.creditsLeft': 'Credits left',
  'dash.yourProjects': 'Your projects', 'dash.noProjects': 'No projects yet',
  'dash.noProjectsText': 'Create your first project and run a simulation before writing a line of code.',
  'dash.testIdea': 'Test an idea', 'dash.iteration': 'iteration', 'dash.iterations': 'iterations',
  'dash.simulation': 'simulation', 'dash.simulationsMany': 'simulations', 'dash.noRealTest': 'No real test yet',
  'dash.latestRealTest': 'Latest real test:', 'dash.readyForReal': 'Ready for a real test?',
  'dash.readySub': 'Projects scoring 71+ are worth validating with a small ad budget before you build.',
  'dash.openTestReady': 'Open a test-ready project', 'dash.runAnother': 'Run another simulation',
  'wizard.newProject': 'New project', 'wizard.sub': '8 short questions. LaunchSim does the rest.',
  'wizard.back': '← Back', 'wizard.continue': 'Continue →', 'wizard.start': 'Start analysis',
  'wizard.running': 'Running research, hypotheses and first simulation… This takes a few seconds.',
  'wizard.creditNote': 'Basic simulation uses 1 credit. You can run standard (2) or advanced (5) simulations later.',
  'w1.title': 'What are you building?', 'w1.nameLabel': 'Project name (optional — we’ll suggest one)', 'w1.desc': 'Describe the product',
  'w1.hint': 'One paragraph is enough. Mention what makes it different if you can.',
  'w2.title': 'Who is it for?', 'w2.hint': 'Be as specific as you can — “urban dog owners” beats “everyone”.',
  'w3.title': 'What problem does it solve?', 'w3.hint': 'How painful is it today? How do people solve it now?',
  'w4.title': 'How will you make money?', 'w5.title': 'Expected price',
  'w5.perMonth': 'Per month.', 'w5.oneTime': 'One-time.', 'w5.primary': 'Primary price point.', 'w5.label': 'Price, $',
  'w6.title': 'Target market', 'w6.hint': 'Country or region where you’ll launch first.', 'w7.title': 'Test budget',
  'w7.hint': 'Money you could realistically spend on a first real ad test.', 'w8.title': 'What do you want to validate?',
  'w8.hint': 'Pick everything that matters. We’ll prioritise hypotheses accordingly.',
  'set.title': 'Settings', 'set.sub': 'Profile, language, password and sign out.',
  'set.profile': 'Profile', 'set.email': 'Email', 'set.save': 'Save', 'set.saved': 'Profile updated.',
  'set.language': 'Interface language', 'set.languageHint': 'Applies instantly and is remembered.',
  'set.pass': 'Change password', 'set.currentPass': 'Current password', 'set.newPass': 'New password', 'set.update': 'Update password',
  'set.passOk': 'Password updated. Use the new one next time you sign in.', 'set.passWrong': 'Current password is incorrect.',
  'set.signOut': 'Sign out', 'set.plan': 'Plan & credits', 'set.planLink': 'Plans & billing →',
  'set.member': 'Member since',
};
const DICT = { ru: RU, en: EN };

const LangCtx = createContext(null);
export function useLang() { return useContext(LangCtx); }

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('ls_lang') || 'ru');
  useEffect(() => {
    localStorage.setItem('ls_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);
  const t = (key) => DICT[lang][key] ?? DICT.en[key] ?? key;
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function LangToggle({ light }) {
  const { lang, setLang } = useLang();
  return (
    <button
      className="btn btn-sm btn-ghost"
      style={light ? { color: '#d4d4d8' } : undefined}
      onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
      title="Language / Язык"
    >
      {lang === 'ru' ? 'EN' : 'РУ'}
    </button>
  );
}
