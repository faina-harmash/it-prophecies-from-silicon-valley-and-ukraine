    const express = require('express');
    const cors = require('cors');
    // Змінено require на динамічний import() для node-fetch, оскільки він є ES Module.
    // Динамічний імпорт повертає Promise, тому використовуємо async/await.
    let fetch;
    import('node-fetch').then(module => {
        fetch = module.default;
    }).catch(error => {
        console.error("Failed to load node-fetch:", error);
        // Додайте обробку помилок або вихід з програми, якщо fetch не завантажується
        process.exit(1);
    });

    require('dotenv').config(); // Для завантаження змінних середовища з файлу .env

    const app = express();
    const PORT = process.env.PORT || 3000;

    // Отримайте дозволений origin зі змінної середовища
    // const allowedOrigin = process.env.FRONTEND_URL; // Більше не використовується для цього тимчасового рішення

    // Middleware для CORS (Cross-Origin Resource Sharing)
    // ТИМЧАСОВО: Дозволяємо всі джерела. Це небезпечно для продакшену, але допомагає діагностувати проблему.
    app.use(cors({
        origin: '*', // Дозволити запити з будь-якого джерела
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Дозволити всі HTTP методи
        allowedHeaders: ['Content-Type', 'Authorization']
    }));
    app.use(express.json()); // Дозволити Express парсити JSON тіла запитів

    // Ендпоінт проксі для Gemini API
    app.post('/api/gemini-proxy', async (req, res) => {
        // Перевіряємо, чи fetch успішно завантажено
        if (!fetch) {
            console.error("node-fetch is not initialized.");
            return res.status(500).json({ error: 'Server error: AI service not ready.' });
        }

        const { prompt, schema } = req.body;
        // Ваш Gemini API ключ, завантажений зі змінних середовища (.env файл)
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            console.error("Gemini API key is not configured on the server.");
            return res.status(500).json({ error: 'Gemini API key not configured on the server.' });
        }

        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

        let payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        };

        if (schema) {
            payload.generationConfig = {
                responseMimeType: "application/json",
                responseSchema: schema
            };
        }

        try {
            const geminiResponse = await fetch(geminiApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!geminiResponse.ok) {
                const errorText = await geminiResponse.text();
                console.error("Gemini API direct error:", errorText);
                return res.status(geminiResponse.status).json({ error: `Gemini API responded with an error: ${errorText}` });
            }

            const geminiResult = await geminiResponse.json();
            res.json(geminiResult); // Відправлення відповіді від Gemini назад фронтенду

        } catch (error) {
            console.error('Error proxying Gemini API request:', error);
            res.status(500).json({ error: 'Failed to communicate with Gemini API.' });
        }
    });

    // Простий кореневий маршрут для перевірки, що сервер працює
    app.get('/', (req, res) => {
        res.send('IT Oracle Backend Proxy is running!');
    });

    // Запуск сервера
    app.listen(PORT, () => {
        console.log(`Proxy server listening on port ${PORT}`);
        console.log(`Access at http://localhost:${PORT}`);
    });
