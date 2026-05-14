## 1. Состояние и переменные

- [x] 1.1 Добавить в IIFE-scope переменные `intervalStartTime = null` и `intervalEndTime = null`

## 2. CSS-стили

- [x] 2.1 Добавить в `styles.css` стиль `.ytp-interval-btn` (аналог `.ytp-copy-time-btn`, с текстовым содержимым вместо SVG)
- [x] 2.2 Добавить в `styles.css` стиль `.ytp-interval-badge` (position absolute, нижний левый угол, тёмный полупрозрачный фон, моноширинный шрифт, border-radius)
- [x] 2.3 Добавить в `styles.css` стиль `.ytp-interval-marker` (position absolute, тонкая вертикальная полоска на прогресс-баре)
- [x] 2.4 Добавить в `styles.css` стиль `.ytp-interval-segment` (position absolute, полупрозрачная полоса между маркерами A и B)

## 3. Вспомогательные функции

- [x] 3.1 Реализовать `updateProgressMarkers()` — позиционирует маркеры через `left: X%` и задаёт ширину сегмента; скрывает элементы если точки не заданы
- [x] 3.2 Реализовать `updateIntervalUI()` — обновляет текст в бейдже (A, B, Δ), показывает/скрывает бейдж, вызывает `updateProgressMarkers()`
- [x] 3.3 Реализовать `setIntervalPoint(which)` — `which = 'start' | 'end'`; читает `video.currentTime`, сохраняет в нужную переменную, вызывает `updateIntervalUI()`
- [x] 3.4 Реализовать `resetInterval()` — сбрасывает обе переменные в `null`, скрывает бейдж, убирает маркеры
- [x] 3.5 Реализовать `copyIntervalDelta()` — вычисляет Δ, копирует в буфер обмена через `navigator.clipboard` или `fallbackCopy`, показывает feedback (галочка на кнопке)

## 4. Создание UI

- [x] 4.1 Реализовать `setupIntervalControls()` — удаляет старые элементы, проверяет что это не Shorts, вставляет кнопки A/B после `.ytp-copy-time-btn`
- [x] 4.2 В `setupIntervalControls()` создать и вставить бейдж `.ytp-interval-badge` в контейнер видео (`#movie_player` или `.html5-video-container`)
- [x] 4.3 В `setupIntervalControls()` создать маркеры `.ytp-interval-marker` и сегмент `.ytp-interval-segment` внутри `.ytp-progress-bar`
- [x] 4.4 Добавить обработчики событий для кнопок A, B, `[⎘]` и `×` в бейдже

## 5. Клавиатурные шорткаты

- [x] 5.1 Реализовать `setupIntervalKeyboardShortcuts()` — вешает обработчик `keydown` на `document` для клавиш `[` и `]`; игнорирует событие если фокус в `input`, `textarea` или `[contenteditable]`
- [x] 5.2 Вызвать `setupIntervalKeyboardShortcuts()` при инициализации (один раз, не при каждой навигации)

## 6. Интеграция с жизненным циклом

- [x] 6.1 Добавить вызов `setupIntervalControls()` в место где вызывается `setupCopyButton()` (при инициализации и навигации)
- [x] 6.2 В `handleNavigation()` сбросить `intervalStartTime = null`, `intervalEndTime = null` перед пересозданием контролов

## 7. Тесты

- [x] 7.1 Добавить юнит-тест для вычисления Δ: обычный случай (A < B), обратный порядок (B < A), случай с нулевым интервалом
- [x] 7.2 Добавить юнит-тест для `formatVideoTime` с Δ-значениями — проверить форматирование миллисекунд и переход через час
