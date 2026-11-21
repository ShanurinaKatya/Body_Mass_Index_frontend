# Лабораторные работы №6–7. Интерфейс пользователя в React. Адаптивность, PWA, развёртывание

Веб-приложение «ИМТ Калькулятор»: SPA на React с менеджером состояний Redux Toolkit,
авторизацией по JWT и взаимодействием с Go-веб-сервисом через кодогенерацию Swagger и Axios.
Лабораторная работа №7 добавляет адаптивность, PWA, развёртывание на GitHub Pages и HTTPS.

## Структура репозитория

```
.
├── backend/    # Go-сервис услуг (Gin, GORM, PostgreSQL, Redis, MinIO, Swagger)
├── frontend/   # React SPA (Vite, TypeScript, React-Bootstrap, Redux Toolkit)
└── readme.md
```


## Стек

- React 19, TypeScript, Vite 8
- React-Bootstrap
- Redux Toolkit, React Redux, Redux Thunk (встроен в Toolkit)
- Axios
- swagger-typescript-api (кодогенерация клиента)
- Go (Gin, GORM, JWT, Redis, MinIO, PostgreSQL)

## Запуск

### 1. Бэкенд

```bash
cd backend

# PostgreSQL, Redis, Adminer (:8081)
docker compose -f db/docker-compose.yml up -d

# MinIO (:9000, консоль :9001)
docker compose -f minio/docker-compose.yml up -d



go run ./cmd/migrate
go run ./cmd/patients_categories    # :8080
```

Swagger UI: http://localhost:8080/swagger/index.html

### 2. Фронтенд

```bash
cd frontend
npm install
npm run generate-api   # генерация src/shared/api/Api.ts из Swagger
npm run dev            # http://localhost:3000
```

Кодогенерация берёт спецификацию из `http://localhost:8080/swagger/doc.json`,
а если сервис не запущен — из `backend/docs/swagger.json`.

### Тестовые данные

После запуска сервиса создайте пользователя и несколько услуг:

```bash
# Регистрация
curl -X POST http://localhost:8080/api/users/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"123456"}'

# Токен
TOKEN=$(curl -s -X POST http://localhost:8080/api/users/auth \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"123456"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# Черновик
curl -X POST http://localhost:8080/api/patients_categories \
  -H "Authorization: Bearer $TOKEN" -F 'name=ИМТ для школьников'

# Публикация (id из ответа предыдущего запроса)
curl -X PUT http://localhost:8080/api/patients_categories/1/publish \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"description":"Расчёт ИМТ для школьников","age":15,"weight":55}'
```

## Обратный прокси (CORS)

В `frontend/vite.config.ts` настроены два маршрута:

| Маршрут | Куда | Назначение |
|---|---|---|
| `/api` | `http://localhost:8080` | методы веб-сервиса |
| `/s3` | `http://localhost:9000/body-mass-index` | изображения и видео из MinIO |

Браузер обращается только к `localhost:3000`, поэтому ограничение CORS не возникает.
Адреса объектов MinIO (`http://localhost:9000/body-mass-index/...`) на фронтенде
переписываются в `/s3/...` функцией `toMediaUrl`.

## Redux Toolkit

`frontend/src/app/store/patients_categories.ts`:

```
store
├── services  (entities/service/model)
│   ├── tiles, feed, draft
│   ├── loading, error, usingMock
│   └── thunks: fetchTiles, fetchFeed, fetchDraft,
│              createService, publishService, deleteService, likeService
├── filter    (features/filter/model)
│   └── age (100 — все услуги, 0–99 — точное совпадение)
└── user      (entities/user/model)
    └── username, isAuthenticated, loading, error
```

- Для методов услуг используются `createAsyncThunk` и сгенерированный клиент `api.*`.
- Авторизация и деавторизация выполняются **вручную через axios**, без кодогенерации
  и thunk: после ответа состояние в Redux устанавливается обычными action.
- Redux DevTools включён (`devTools: true`).

## Авторизация и хранение JWT

- JWT сохраняется в `localStorage` под ключом `patients_categories.jwt`.
- Axios-interceptor подставляет `Authorization: Bearer <token>` во все запросы.
- Redux в память не сохраняется: после F5 интерфейс возвращается в состояние гостя,
  а JWT остаётся в `Application → Local Storage`.
- При выходе JWT удаляется, состояние пользователя очищается, фильтр сбрасывается.

## Mock-данные

Если бэкенд недоступен **и** пользователь не авторизован, thunk'и подставляют
коллекцию `SERVICES_MOCK` (`frontend/src/shared/model/patients_categories.ts`).
Для авторизованного пользователя ошибка выводится на страницу.

## Страница «Добавление» — `/add`

Пошаговая форма создания услуги: сначала черновик с медиа и названием, затем публикация с описанием, возрастом и весом.

**Кнопки и поля:**

- **Хедер** — заголовок «Новый расчёт ИМТ»;
- **Плейсхолдер «Обложка»** — при создании черновика открывает выбор изображения и показывает превью выбранного файла; на шаге публикации показывает обложку из черновика;
- **Плейсхолдер «Видео»** — аналогично открывает выбор видео и показывает превью; на шаге публикации показывает видео из черновика;
- **Поле «Название расчёта»** — название услуги (`service.name`), без него кнопка «Далее» не отправляет форму;
- **Кнопка «Далее»** — создаёт черновик (`createService`) и открывает форму публикации; блокируется, пока идёт запрос;
- **Название расчёта** — на шаге публикации выводится только для чтения (`draft.name`);
- **Поле «Описание»** — текст описания услуги (`draft.description`), многострочное;
- **Поле «Возраст пациента»** — возраст в годах, минимум 1;
- **Поле «Вес (кг)»** — вес в кг, минимум 0, шаг 0.01;
- **Кнопка «Опубликовать»** — отправляет описание, возраст и вес (`publishService`) и после успеха открывает `/cards`.

Страница доступна только авторизованным: гость перенаправляется на `/login`. При открытии загружается черновик (`GET /api/patients_categories/draft`); если он уже есть, форма создания пропускается. Не выбранные файлы в запрос не передаются; при ошибке загрузки `onError` подставляет `/DefaultImage.jpg` для обложки и `/Default.mp4` для видео. Ошибки запросов выводятся над формой.

## Страница «Лента» — `/feed`

Полноэкранная карточка услуги в формате TikTok: видео на весь фон, текст поверх него.

**Кнопки и поля:**

- **Хедер** — заголовок приложения «ИМТ Калькулятор»;
- **Иконка «Вес»** — вес текущей услуги в кг (`service.weight`);
- **Иконка «Возраст»** — возраст в годах (`service.age`);
- **Иконка «Лайк»** — количество лайков услуги (`service.likes`);
- **Кнопка «Далее»** — показывает следующую услугу из mock-коллекции, список зациклен;
- **Заголовок** — название текущей услуги (`service.name`);
- **Описание** — по умолчанию показывается одна строка;
- **Кнопки «ещё» / «меньше»** — раскрывают описание целиком или сворачивают обратно.

Если у услуги нет видео, подставляется `/Default.mp4`; при ошибке загрузки `onError` заменяет видео на дефолтное.

## Страница «Плитка» — `/cards`

Список услуг сеткой 2 колонки (по 2 карточки в ряду) под белым липким хедером.

**Кнопки и поля:**

- **Хедер** — заголовок «Каталог расчётов» и подзаголовок «Специализированные калькуляторы ИМТ»;
- **Фильтр по возрасту** — ползунок (`range`) со шкалой 0–100 и «пузырьком» текущего значения;
- **Кнопка «Найти»** — применяет фильтр. Значение **100** (по умолчанию) показывает все услуги, значение **0–99** — только те, у которых возраст ровно равен числу; если такого возраста нет, список пуст. Логика повторяет `GetPublishedByAge` из лабораторной работы №1 (`WHERE status = ? AND age = ?`);
- **Карточка услуги** (компонент `ServiceCard`):
  - изображение — при пустом `image_url` подставляется `/DefaultImage.jpg`, при ошибке загрузки то же значение задаёт `onError`;
  - название услуги;
  - количество лайков (иконка сердца);
  - вес в кг и возраст в годах;
- **Клик по карточке** — открывает эту услугу на странице «Лента» (`/feed?id=N`).

## Страница «Вход» — `/login`

Форма входа по логину и паролю; после успешной авторизации открывается лента.

**Кнопки и поля:**

- **Хедер** — заголовок «Вход»;
- **Поле «Логин»** — имя пользователя (`username`);
- **Поле «Пароль»** — пароль (`password`), ввод скрыт;
- **Кнопка «Войти»** — отправляет логин и пароль; блокируется, пока идёт запрос;
- **Предупреждение** — при пустых полях выводится «Заполните логин и пароль», при ошибке сервиса — «Неверный логин или пароль».

Страница доступна только гостям: авторизованный пользователь перенаправляется на `/feed`. Авторизация выполняется вручную через axios (`POST /api/users/auth`), без сгенерированного клиента и thunk: JWT сохраняется в `localStorage` под ключом `patients_categories.jwt`, затем состояние пользователя обновляется в Redux и выполняется переход на ленту. После входа в панели навигации «Вход» заменяется на «Выход».

## Лабораторная работа №7

### Адаптивность (`frontend/src/app/styles/patients_categories.css`)

Сетка плитки и контейнеры страниц масштабируются по ширине экрана.
Минимальная ширина карточки — `300px`, `gap` — `12px`.

| Ширина экрана | Колонки карточек | Контейнеры (`.cards-container`, `.page-header`, `.tab-bar`, `.feed-container`, `.add-container`, `.auth-container`) |
|---|---|---|
| `< 768px` | 1: `minmax(300px, 1fr)` | `max-width: 390px` |
| `≥ 768px` | 2: `repeat(2, minmax(300px, 1fr))` | `max-width: 768px` |
| `≥ 1024px` | 3: `repeat(3, minmax(300px, 1fr))` | `max-width: 1000px` |

Конкретные значения для показа (скриншоты 15–17):

- `.cards-grid` (базовый уровень): `grid-template-columns: minmax(300px, 1fr)` — 1 колонка, карточка ≈ 350px при контейнере 390px;
- `@media (min-width: 768px)`: `repeat(2, minmax(300px, 1fr))` — 2 колонки, карточки ≈ 358px ((768 − 40 − 12) / 2);
- `@media (min-width: 1024px)`: `repeat(3, minmax(300px, 1fr))` — 3 колонки, карточки ≈ 312px ((1000 − 40 − 24) / 3).

Адаптив покрывает страницы `/feed`, `/cards`, `/add` (и `/login` — общие контейнеры и липкий хедер с нижней панелью).

### PWA (`vite-plugin-pwa`)

- Плагин `VitePWA` в `frontend/vite.config.ts`: `registerType: 'autoUpdate'`, `devOptions.enabled: true`, собственный `manifest` (name «ИМТ Калькулятор», `start_url`/`scope` = `/Body_Mass_Index_frontend/`, `display: standalone`, иконки 192×192 и 512×512 — `public/icon-192.png`, `public/icon-512.png`);
- Регистрация service worker в `frontend/src/app/patients_categories.tsx`: `registerSW()` из `virtual:pwa-register`;
- Типы `vite-plugin-pwa/info.d.ts` и `vite-plugin-pwa/client.d.ts` добавлены в `tsconfig.app.json`;
- Сборка (`npm run build`) кладёт в `dist/`: `manifest.webmanifest`, `sw.js`, `workbox-*.js` + все файлы из `public/` (в том числе `Default.mp4`, `DefaultImage.jpg`).

На GitHub Pages работает mock: запрос `/api/...` падает → гость получает `SERVICES_MOCK`.

### Развёртывание на GitHub Pages

- `base: '/Body_Mass_Index_frontend/'` в `vite.config.ts`; basename роутера — `import.meta.env.BASE_URL`;
- пути к файлам из `public/` собираются хелпером `publicUrl()` (`shared/lib/media`) — без этого на Pages 404;
- зависимости и скрипт: `gh-pages`, `"deploy": "gh-pages -d dist"`.

Порядок деплоя (push выполняется вручную):

```bash
cd frontend
npm install
npm run build          # bundle в dist/ (фото и видео по умолчанию внутри)
npm run deploy         # публикация dist/ в ветку gh-pages (это push)
# GitHub → Settings → Pages → Source: Deploy from branch → ветка gh-pages → Save
# Приложение: https://ShanurinaKatya.github.io/Body_Mass_Index_frontend/
```

### HTTPS (Node.js реверс-прокси)

Vite dev-сервер — это реверс-прокси (`/api` → `:8080`, `/s3` → `:9000`). Для HTTPS:

```bash
npm install -g mkcert      # генерация файлов сертификата
cd frontend
mkcert create-ca           # ca.crt, ca.key
mkcert create-cert --domains localhost 127.0.0.1 ::1 <IP-ноутбука>   # cert.crt, cert.key
```

- ключи `*.key` / `*.crt` добавлены в `.gitignore` — **не публиковать**;
- `vite.config.ts`: `server.https` (считывает `cert.key`/`cert.crt`), плагин `mkcert()` (`vite-plugin-mkcert`) и `server.host: true` — без `host` сервер слушает только localhost и телефон не подключится;
- доступ с телефона в одной локальной сети: `https://<IP-ноутбука>:3000/Body_Mass_Index_frontend/` → прокси → Go-сервис `:8080`.

Чтобы телефон доверялся сертификату, установите `ca.crt` на устройство (или подтвердите предупреждение браузера).

## Порядок показа (скриншоты, лаба 7)

1. **1–2** — GitHub Pages (mock, гость) на телефоне, установка PWA на главный экран.
2. **3–6** — PWA: применить фильтр по возрасту на `/cards`, перейти «Подробнее» на `/feed`, вернуться — значение фильтра старое (Redux переживает SPA-переход).
3. **7** — адаптивный режим браузера, изменение ширины: 1 → 2 → 3 колонки карточек.
4. **8–12** — телефон по IP-адресу ноутбука (HTTPS), вход, три страницы с бэкендом (`/feed`, `/cards`, `/add`).
5. **13–14** — файлы сертификатов (`ca.crt`, `cert.crt`, `cert.key`) и HTTPS-соединение в браузере.
6. **15–17** — код настроек сетки: `minmax(300px, 1fr)` и media query с конкретными значениями колонок и ширины контейнеров.

## Проверки

```bash
cd frontend
npm run generate-api
npm run lint
npm run build
```
