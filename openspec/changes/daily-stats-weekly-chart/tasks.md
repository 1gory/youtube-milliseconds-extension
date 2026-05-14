## 1. Background: daily stats tracking

- [x] 1.1 Добавить `getLocalDateString(date)` в `background.js` — возвращает `YYYY-MM-DD` через локальные компоненты даты
- [x] 1.2 В `updateWatchTime()` читать `dailyStats` из хранилища вместе с `totalWatchTime`
- [x] 1.3 В `updateWatchTime()` обновлять `dailyStats[localDate]` и записывать вместе с `totalWatchTime`
- [x] 1.4 В `onInstalled` инициализировать `dailyStats: {}` если ключ отсутствует

## 2. Popup: хелперы

- [x] 2.1 Добавить `getLocalDateString(date)` в `popup.js` (дублируется из background.js — намеренно, согласно design)
- [x] 2.2 Добавить `formatShortTime(seconds)` — компактный формат (`1h 30m`, `45s`) без лет и дней
- [x] 2.3 Добавить `getLast7Days()` — возвращает массив из 7 строк `YYYY-MM-DD` от 6 дней назад до сегодня

## 3. Popup: UI-разметка

- [x] 3.1 В `popup.html` добавить два новых stat-item: «Today» и «Daily avg» между существующим total и settings
- [x] 3.2 В `popup.html` добавить контейнер `.chart-container` для 7-дневного графика

## 4. Popup: логика загрузки и рендеринга

- [x] 4.1 В `loadStats()` читать `dailyStats` из хранилища вместе с `totalWatchTime` и `showMilliseconds`
- [x] 4.2 Заполнять поля «Today» и «Daily avg» через `formatShortTime`; среднее считать только по дням с данными
- [x] 4.3 Реализовать `renderChart(dailyStats)` — строит 7 `div.chart-bar`-колонок с inline-height%, `title` и `.chart-day` лейблом; today-бар получает класс `chart-bar--today`
- [x] 4.4 Вызвать `renderChart` из `loadStats()` после получения данных

## 5. Сброс статистики

- [x] 5.1 В обработчике Reset в `popup.js` сохранять `dailyStats: {}` вместе с `totalWatchTime: 0` и текущими настройками

## 6. Стили

- [x] 6.1 В `popup.css` добавить стили `.chart-container` (flex-row, align-items: flex-end, fixed height 70px, gap)
- [x] 6.2 В `popup.css` добавить стили `.chart-col` (flex column, align-items center), `.chart-bar` (width, background, border-radius-top, min-height) и `.chart-bar--today` (отличный цвет)
- [x] 6.3 В `popup.css` добавить стиль `.chart-day` (font-size, color, margin-top)

## 7. Тесты

- [x] 7.1 Юнит-тесты для `getLocalDateString`: корректный формат, zero-padding
- [x] 7.2 Юнит-тесты для `formatShortTime`: секунды, минуты+секунды, часы+минуты
- [x] 7.3 Юнит-тесты для `accumulateWatchTime` с `dailyStats` (если функция выделена), или интеграционный тест обновления dailyStats

## 8. Скриншоты

- [ ] 8.1 Обновить скриншот попапа в README — показать новый вид с полями Today, Daily avg и 7-дневным графиком
- [ ] 8.2 Обновить скриншоты в Chrome Web Store (в Developer Dashboard) — заменить старые на актуальные с новым UI попапа
