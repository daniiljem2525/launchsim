import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brand } from '../components/TopNav.jsx';
import { useAuth } from '../auth.jsx';
import { useLang, LangToggle } from '../i18n.jsx';
import { api } from '../api.js';

// Landing copy in both languages. RU is the default.
const C = {
  ru: {
    badge: 'Платформа предзапускного тестирования',
    h1a: 'Протестируйте стартап', h1b: 'за 1–2 дня',
    h1c: 'вместо 2–3 недель разработки MVP',
    sub: 'Симулируйте спрос, проверьте позиционирование, найдите главный риск и решите, что строить — до того, как потратите недели и деньги на MVP.',
    ctaMain: 'Протестировать мою идею', ctaDemo: 'Посмотреть пример',
    flowTitle: 'Как это работает',
    flow: [
      ['ИДЕЯ', 'Опишите идею за 3 минуты'],
      ['ИССЛЕДОВАНИЕ', 'Рынок, конкуренты, цены'],
      ['СИМУЛЯЦИЯ', 'Виртуальный запуск продукта'],
      ['УЛУЧШЕНИЕ', 'Меняйте слабые места'],
      ['REAL TEST', 'Небольшой реальный бюджет'],
      ['РЕШЕНИЕ', 'Строить или нет'],
    ],
    resultTitle: 'Пример результата теста',
    resultNote: 'Так выглядит отчёт через несколько часов после запуска',
    result: {
      audienceLabel: 'Аудитория', audience: 'Фрилансеры-дизайнеры',
      priceLabel: 'Рекомендованная цена', price: '$7.99/мес',
      riskLabel: 'Главный риск', risk: 'Удержание может не окупить стоимость привлечения',
      stepLabel: 'Следующий шаг', step: 'Протестируйте позиционирование на 50 кликах',
      breakdown: 'Разбор оценки — у каждой цифры есть причина',
    },
    statsTitle: 'Что делает LaunchSim за один прогон',
    stats: [
      ['несколько часов', 'вместо 2–3 недель на MVP'],
      ['5 000+', 'виртуальных клиентов в симуляции'],
      ['7+', 'сценариев конкурентов и цены'],
      ['$50', 'минимум на реальный тест'],
    ],
    mechTitle: 'Механика, которой нет у других',
    mech: [
      ['1 · Симуляция', 'Виртуальная версия продукта — лендинг, 5 рекламных углов и тысячи профилей клиентов — проходит через воронку: показы → клики → регистрации → покупки.', 'CTR 2.8% · 235 регистраций · 3–5 покупок (оценки)'],
      ['2 · Real Test', 'Когда сигнал сильный — LaunchSim собирает кампанию: лендинг, креативы, структуру, план трекинга. Вы подключаете рекламный кабинет и запускаете на $50.', 'Budget $50 · Meta Ads · трекинг готов'],
      ['3 · Симуляция vs Реальность', 'Прогон сравнивается с предсказанием построчно. Точность видна по каждой метрике — и растёт с каждым тестом.', 'CTR: симуляция 2.8% → факт 2.5% · точность 92%'],
    ],
    honestTitle: 'Оценки, а не обещания',
    honestText: 'Каждая цифра LaunchSim — оценка симуляции с пометкой источника. Нет реальных данных — мы пишем «недостаточно данных» вместо выдуманной статистики.',
    miniTitle: 'Опишите свою идею',
    miniPlaceholder: 'Например: приложение для поиска проверенных выгулщиков собак за 10 минут…',
    miniBtn: 'Test My Idea',
    miniNote: 'Займёт 3 минуты. Регистрация — в конце.',
    pricingKicker: 'Тарифы', pricingTitle: 'Начните бесплатно. Платите, когда это экономит деньги.',
    pricingSub: 'Один провалившийся MVP стоит дороже года LaunchSim. Все планы используют кредиты.',
    plans: [
      ['Бесплатный', '$0', 'навсегда', ['2 кредита', '1 базовая симуляция', '1 проект'], false],
      ['Test', '$19', 'единоразово', ['10 кредитов', 'Полный цикл проверки', 'Симуляция цены и A/B', 'План реального теста'], true],
      ['Founder', '$39', 'в месяц', ['30 кредитов / месяц', 'Безлимит проектов', 'Глубокое исследование', 'Эксперименты'], false],
      ['Studio', '$299', 'в месяц', ['400 кредитов / месяц', 'Командные пространства*', 'Приоритетное исследование', 'Трекинг точности'], false],
    ],
    pricingFoot: '* Командные функции Studio — в разработке. Оплата работает в демо-режиме — реальные платежи не проводятся.',
    finalTitle: 'Ещё не стройте.',
    finalSub: 'Найдите главный риск первым. Это три минуты — не три недели.',
    demoNote: 'Демо открывает полностью симулированный пример проекта — все данные помечены как пример.',
    footer: '© 2026 LaunchSim — Протестируйте стартап до того, как построите.',
    footerSlogan: 'Симулируйте рынок. Улучшайте идею. Тестируйте по-настоящему.',
    subScores: [['Спрос', 81], ['Готовность платить', 58], ['Конкуренция', 66], ['Отличие', 63], ['Привлечение', 72], ['Удержание', 46]],
  },
  en: {
    badge: 'Pre-Launch Testing Platform',
    h1a: 'Test your startup', h1b: 'in 1–2 days',
    h1c: 'instead of 2–3 weeks building an MVP',
    sub: 'Simulate demand, test your positioning, find your biggest risk and decide what to build — before spending weeks and money on an MVP.',
    ctaMain: 'Test my idea', ctaDemo: 'See an example',
    flowTitle: 'How it works',
    flow: [
      ['IDEA', 'Describe it in 3 minutes'],
      ['RESEARCH', 'Market, competitors, pricing'],
      ['SIMULATION', 'Virtual product launch'],
      ['IMPROVE', 'Fix the weak spots'],
      ['REAL TEST', 'Small real budget'],
      ['DECISION', 'Build or not'],
    ],
    resultTitle: 'Example test result',
    resultNote: 'This is what a report looks like a few hours after launch',
    result: {
      audienceLabel: 'Audience', audience: 'Freelance designers',
      priceLabel: 'Recommended price', price: '$7.99/mo',
      riskLabel: 'Biggest risk', risk: 'Retention may not pay back acquisition cost',
      stepLabel: 'Next step', step: 'Test positioning on 50 clicks',
      breakdown: 'Score breakdown — every number has a reason',
    },
    statsTitle: 'What LaunchSim does in one run',
    stats: [
      ['a few hours', 'instead of 2–3 weeks on an MVP'],
      ['5,000+', 'virtual customers in simulation'],
      ['7+', 'competitor & price scenarios'],
      ['$50', 'minimum for a real test'],
    ],
    mechTitle: 'The mechanics nobody else has',
    mech: [
      ['1 · Simulation', 'A virtual product version — landing page, 5 ad angles and thousands of customer profiles — runs through a funnel: impressions → clicks → signups → purchases.', 'CTR 2.8% · 235 signups · 3–5 purchases (estimates)'],
      ['2 · Real Test', 'When the signal is strong, LaunchSim assembles the campaign: landing, creatives, structure, tracking plan. Connect your ad account and run it on $50.', 'Budget $50 · Meta Ads · tracking ready'],
      ['3 · Simulation vs Reality', 'The run is compared to the prediction line by line. Accuracy is visible per metric — and improves with every test.', 'CTR: simulated 2.8% → actual 2.5% · 92% accuracy'],
    ],
    honestTitle: 'Estimates, not promises',
    honestText: 'Every number LaunchSim produces is a simulation estimate with its source labeled. No real data — we say “not enough evidence” instead of inventing statistics.',
    miniTitle: 'Describe your idea',
    miniPlaceholder: 'E.g.: an app that finds verified dog sitters in 10 minutes…',
    miniBtn: 'Test My Idea',
    miniNote: 'Takes 3 minutes. Sign-up comes last.',
    pricingKicker: 'Pricing', pricingTitle: 'Start free. Pay when it saves you money.',
    pricingSub: 'One failed MVP costs more than a year of LaunchSim. All plans use credits.',
    plans: [
      ['Free', '$0', 'forever', ['2 credits', '1 basic simulation', '1 project'], false],
      ['Test', '$19', 'one-time', ['10 credits', 'Full validation cycle', 'Price + A/B simulation', 'Real test plan'], true],
      ['Founder', '$39', 'per month', ['30 credits / month', 'Unlimited projects', 'Deep research', 'Experiments'], false],
      ['Studio', '$299', 'per month', ['400 credits / month', 'Team workspaces*', 'Priority research', 'Accuracy tracking'], false],
    ],
    pricingFoot: '* Studio team features are on the roadmap. Billing runs in demo mode — no real payment is processed.',
    finalTitle: 'Don’t build yet.',
    finalSub: 'Find your biggest risk first. It takes three minutes — not three weeks.',
    demoNote: 'Demo opens a fully simulated sample project — every number in it is labeled as an example.',
    footer: '© 2026 LaunchSim — Test your startup before you build it.',
    footerSlogan: 'Simulate the market. Improve the idea. Test it for real.',
    subScores: [['Market Demand', 81], ['Willingness to Pay', 58], ['Competition', 66], ['Differentiation', 63], ['Acquisition', 72], ['Retention', 46]],
  },
};

export default function Landing() {
  const { lang } = useLang();
  const t = C[lang] || C.ru;
  const { user, enterDemo } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [idea, setIdea] = useState('');

  const testIdea = () => { nav(user ? '/app/new' : '/signup?next=/app/new'); };
  const submitIdea = (e) => {
    e.preventDefault();
    if (idea.trim().length < 10) return;
    sessionStorage.setItem('ls_idea_prefill', idea.trim());
    nav(user ? '/app/new' : '/signup?next=/app/new');
  };
  const exploreDemo = async () => {
    setBusy(true); setErr('');
    try {
      const demoProjectId = await enterDemo();
      nav(demoProjectId ? `/app/projects/${demoProjectId}` : '/app');
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ background: '#0a0a0b' }}>
        <div className="container-wide topnav-inner" style={{ borderBottom: '1px solid #26262b' }}>
          <Brand light />
          <div className="nav-cta">
            <LangToggle light />
            {user
              ? <Link to="/app" className="btn btn-light btn-sm">Open app</Link>
              : <>
                  <Link to="/login" className="btn btn-ghost-light btn-sm">Войти / Sign in</Link>
                  <Link to="/signup" className="btn btn-light btn-sm">Начать бесплатно</Link>
                </>}
          </div>
        </div>

        {/* HERO */}
        <section className="hero">
          <div className="hero-inner">
            <span className="hero-eyebrow">{t.badge}</span>
            <h1>{t.h1a} <span style={{ color: '#8b83f7' }}>{t.h1b}</span><br />{t.h1c}</h1>
            <p className="sub">{t.sub}</p>
            <div className="row-wrap" style={{ justifyContent: 'center' }}>
              <button className="btn btn-light btn-lg" onClick={testIdea}>{t.ctaMain}</button>
              <button className="btn btn-ghost-light btn-lg" onClick={exploreDemo} disabled={busy}>{busy ? '…' : t.ctaDemo}</button>
            </div>
            {err && <div className="error-text mt-8">{err}</div>}
          </div>
        </section>
      </div>

      {/* EXAMPLE RESULT — right after hero */}
        <section className="landing-section" style={{ paddingTop: 56 }}>
          <div className="container">
            <div className="grid grid-side" style={{ alignItems: 'center', gap: 40 }}>
              <div>
                <div className="kicker">{t.resultTitle}</div>
                <p className="section-sub">{t.resultNote}</p>
                <div className="mt-24">
                  <div className="row mb-8"><span className="dot-check">✓</span><span className="small">{t.result.audienceLabel}: <b>{t.result.audience}</b></span></div>
                  <div className="row mb-8"><span className="dot-check">✓</span><span className="small">{t.result.priceLabel}: <b>{t.result.price}</b></span></div>
                  <div className="row mb-8"><span className="dot-check">✓</span><span className="small">{t.result.riskLabel}: <b>{t.result.risk}</b></span></div>
                  <div className="row"><span className="dot-check">✓</span><span className="small">{t.result.stepLabel}: <b>{t.result.step}</b></span></div>
                </div>
              </div>
              <div className="card-dark">
                <div className="spread">
                  <div className="tiny" style={{ color: '#a1a1aa', letterSpacing: '.1em' }}>LAUNCH SCORE</div>
                  <div className="tiny" style={{ color: '#52525b' }}>example · не реальные данные</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
                  <span style={{ fontSize: 52, fontWeight: 700, letterSpacing: '-0.03em' }}>78</span>
                  <span style={{ color: '#52525b', fontSize: 15 }}>/ 100</span>
                  <span className="badge badge-test">TEST</span>
                </div>
                <hr style={{ border: 0, borderTop: '1px solid #26262b', margin: '14px 0' }} />
                <div className="tiny mb-8" style={{ color: '#a1a1aa' }}>{t.result.breakdown}</div>
                {t.subScores.map(([k, v]) => (
                  <div key={k} style={{ marginBottom: 8 }}>
                    <div className="spread small"><span style={{ color: '#d4d4d8' }}>{k}</span><b>{v}</b></div>
                    <div className="bar" style={{ background: '#26262b' }}><i style={{ width: v + '%', background: '#fff' }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* MINI-FORM */}
        <section className="landing-section soft" style={{ padding: '48px 0' }}>
          <div className="container" style={{ maxWidth: 680 }}>
            <h2 style={{ textAlign: 'center', fontSize: 24 }}>{t.miniTitle}</h2>
            <form onSubmit={submitIdea} className="row-wrap mt-16" style={{ gap: 10 }}>
              <input className="input grow" style={{ minWidth: 220 }} value={idea} onChange={(e) => setIdea(e.target.value)}
                placeholder={t.miniPlaceholder} />
              <button className="btn btn-primary btn-lg" disabled={idea.trim().length < 10}>{t.miniBtn}</button>
            </form>
            <div className="tiny center mt-8">{t.miniNote}</div>
          </div>
        </section>

        {/* FLOW — six short stages */}
        <section className="landing-section" style={{ paddingTop: 48 }}>
          <div className="container">
            <div className="kicker">{t.flowTitle}</div>
            <div className="grid grid-3 mt-16">
              {t.flow.map(([title, sub], i) => (
                <div className="card-plain card-hover" key={title}>
                  <div className="row">
                    <span className="badge badge-accent">{i + 1}</span>
                    <b className="small" style={{ letterSpacing: '.08em' }}>{title}</b>
                  </div>
                  <div className="small muted mt-8" style={{ marginBottom: 0 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BIG NUMBERS */}
        <section className="landing-section soft" style={{ padding: '44px 0' }}>
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: 24, marginBottom: 26 }}>{t.statsTitle}</h2>
            <div className="grid grid-4">
              {t.stats.map(([num, sub]) => (
                <div className="center" key={num}>
                  <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em' }}>{num}</div>
                  <div className="small muted" style={{ maxWidth: 220, margin: '4px auto 0' }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MECHANICS: Simulation → Real Test → vs Reality */}
        <section className="landing-section">
          <div className="container">
            <div className="kicker">{t.mechTitle}</div>
            <div className="grid grid-3 mt-16">
              {t.mech.map(([title, text, example], i) => (
                <React.Fragment key={title}>
                  {i > 0 && <div className="center" style={{ alignSelf: 'center', fontSize: 24, color: 'var(--ink-3)' }}>→</div>}
                  <div className={'card ' + (i === 1 ? 'card-dark' : 'card-hover')}>
                    <h3>{title}</h3>
                    <p className="muted small" style={{ color: i === 1 ? '#a1a1aa' : undefined }}>{text}</p>
                    <div className="mono tiny" style={{ borderLeft: '2px solid ' + (i === 1 ? '#3f3f46' : 'var(--line-strong)'), paddingLeft: 10 }}>{example}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* HONEST — compact strip */}
        <section className="landing-section soft" style={{ padding: '40px 0' }}>
          <div className="container spread row-wrap" style={{ gap: 24 }}>
            <h3 style={{ margin: 0, fontSize: 20 }}>{t.honestTitle}</h3>
            <p className="muted small grow" style={{ margin: 0, maxWidth: 640 }}>{t.honestText}</p>
          </div>
        </section>

        {/* PRICING */}
        <section className="landing-section">
          <div className="container">
            <div className="kicker">{t.pricingKicker}</div>
            <h2 className="section-title">{t.pricingTitle}</h2>
            <p className="section-sub mb-24">{t.pricingSub}</p>
            <div className="grid grid-4">
              {t.plans.map(([name, price, per, feats, hot]) => (
                <div key={name} className={'card' + (hot ? '' : ' card-plain')} style={hot ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' } : undefined}>
                  {hot && <span className="badge badge-accent mb-8">Popular</span>}
                  <h3>{name}</h3>
                  <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                    <span className="stat-num">{price}</span>
                    <span className="tiny">{per}</span>
                  </div>
                  <hr className="divider" />
                  {feats.map((f) => <div key={f} className="small mb-8">✓ {f}</div>)}
                </div>
              ))}
            </div>
            <div className="tiny mt-16">{t.pricingFoot}</div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="landing-section soft">
          <div className="container center">
            <h2 className="section-title">{t.finalTitle}</h2>
            <p className="section-sub" style={{ margin: '0 auto 26px' }}>{t.finalSub}</p>
            <div className="row-wrap" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary btn-lg" onClick={testIdea}>{t.ctaMain}</button>
              <button className="btn btn-secondary btn-lg" onClick={exploreDemo} disabled={busy}>{busy ? '…' : t.ctaDemo}</button>
            </div>
            <div className="tiny mt-16">{t.demoNote}</div>
          </div>
        </section>

        <footer className="footer">
          <div className="container spread row-wrap">
            <span>{t.footer}</span>
            <span>{t.footerSlogan}</span>
          </div>
        </footer>
    </div>
  );
}
