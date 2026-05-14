## ADDED Requirements

### Requirement: Кнопка переключения миллисекунд в control bar
Кнопка-toggle SHALL вставляться в control bar плеера после `.ytp-copy-time-btn` и переключать значение флага `showMilliseconds`.

#### Scenario: Кнопка появляется на обычном плеере
- **WHEN** расширение инициализируется на странице видео (не Shorts)
- **THEN** в control bar после кнопки копирования появляется кнопка `.ytp-ms-toggle-btn`

#### Scenario: Кнопка не появляется на Shorts
- **WHEN** расширение инициализируется на странице YouTube Shorts
- **THEN** кнопка не добавляется в DOM

#### Scenario: Клик переключает значение
- **WHEN** пользователь нажимает кнопку
- **THEN** значение `showMilliseconds` в `chrome.storage` инвертируется

### Requirement: Синхронизация с popup
Состояние кнопки в плеере и чекбокса `showMilliseconds` в popup SHALL всегда отражать одно значение из `chrome.storage`.

#### Scenario: Изменение из popup отражается в плеере
- **WHEN** пользователь меняет чекбокс `Show milliseconds` в popup
- **THEN** визуальное состояние кнопки в плеере обновляется через `chrome.storage.onChanged`

#### Scenario: Изменение из плеера отражается в popup
- **WHEN** пользователь нажимает кнопку в плеере
- **THEN** чекбокс в popup (если он открыт) обновляет состояние через тот же listener

### Requirement: Визуальные состояния кнопки
Кнопка SHALL визуально различать состояния «миллисекунды включены» и «миллисекунды отключены».

#### Scenario: Миллисекунды включены — кнопка активна
- **WHEN** `showMilliseconds === true`
- **THEN** кнопка отображается без модификатора `.ytp-ms-toggle-btn--off` (полная непрозрачность)

#### Scenario: Миллисекунды отключены — кнопка приглушена
- **WHEN** `showMilliseconds === false`
- **THEN** кнопка получает модификатор `.ytp-ms-toggle-btn--off` (пониженная непрозрачность)

### Requirement: Доступность
Кнопка SHALL предоставлять `title` и `aria-label`, отражающие текущее действие.

#### Scenario: Подсказка при миллисекундах включённых
- **WHEN** `showMilliseconds === true`
- **THEN** `title` содержит текст вида «Hide milliseconds»

#### Scenario: Подсказка при миллисекундах отключённых
- **WHEN** `showMilliseconds === false`
- **THEN** `title` содержит текст вида «Show milliseconds»

### Requirement: Пересоздание при навигации
При переходе на другое видео кнопка SHALL пересоздаваться вместе с остальными контролами расширения.

#### Scenario: Навигация пересоздаёт кнопку
- **WHEN** срабатывает `handleNavigation()`
- **THEN** прежняя кнопка удаляется и создаётся заново с актуальным состоянием из `chrome.storage`