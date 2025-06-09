const express = require('express');
const cors = require('cors'); // Залишаємо cors, якщо потрібно для локального тестування, але Vercel.json обробляє це на деплої

require('dotenv').config(); // Для завантаження змінних середовища з файлу .env

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Middleware (залишаємо, якщо потрібно для локального тестування; для Vercel це обробляється через vercel.json)
// Якщо ви хочете, щоб це працювало локально без .env, можете розкоментувати і налаштувати
app.use(cors({
    origin: '*', // Дозволити запити з будь-якого джерела для локального тестування
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); // Дозволити Express парсити JSON тіла запитів

// Ендпоінт проксі для Gemini API
app.post('/api/gemini-proxy', async (req, res) => {
    // *** Виправлення: Динамічний імпорт node-fetch всередині обробника маршруту ***
    // Це гарантує, що node-fetch імпортується асинхронно, і його дефолтний експорт
    // стає доступним як 'fetch' безпосередньо при виконанні запиту.
    const { default: fetch } = await import('node-fetch');

    const { prompt, schema } = req.body;

    // Перевірка, що prompt не є пустим або неіснуючим
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
        console.error("Received empty or invalid prompt.");
        return res.status(400).json({ error: 'Invalid or empty prompt provided.' });
    }

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
        res.json(geminiResult);

    } catch (error) {
        console.error('Error proxying Gemini API request:', error);
        res.status(500).json({ error: 'Failed to communicate with Gemini API.' });
    }
});

app.get('/', (req, res) => {
    res.send('IT Oracle Backend Proxy is running!');
});

app.listen(PORT, () => {
    console.log(`Proxy server listening on port ${PORT}`);
    console.log(`Access at http://localhost:${PORT}`);
});
