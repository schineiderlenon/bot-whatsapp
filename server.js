require('dotenv').config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Pega as chaves do ambiente (Render)
const { OPENAI_API_KEY, ZAPI_TOKEN, ZAPI_INSTANCE } = process.env;

// Rota para o navegador não dar "Not Found"
app.get("/", (req, res) => {
    res.send("O Assistente Financeiro está online! 🚀");
});

// Rota que recebe as mensagens do WhatsApp
app.post("/webhook", async (req, res) => {
    const isGroup = req.body.isGroup;
    const message = req.body.text?.message;
    const phone = req.body.phone;

    // IGNORA GRUPOS: Para economizar seus créditos
    if (isGroup === true) {
        console.log("Mensagem de grupo ignorada.");
        return res.sendStatus(200);
    }

    if (!message || !phone) return res.sendStatus(200);

    try {
        console.log("Chegou mensagem de: " + phone);

        // Chamada para a OpenAI com modelo estável e limpeza de espaços (.trim)
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-3.5-turbo", 
            messages: [
                { role: "system", content: "Você é um assistente financeiro pessoal. Responda de forma curta." },
                { role: "user", content: message }
            ]
        }, {
            headers: { 
                "Authorization": `Bearer ${OPENAI_API_KEY.trim()}`,
                "Content-Type": "application/json"
            }
        });

        const aiReply = response.data.choices[0].message.content;

        // Envia a resposta de volta para o WhatsApp via Z-API
        await axios.post(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`, {
            phone: phone,
            message: aiReply
        });

        console.log("Sucesso! Resposta enviada.");

    } catch (error) {
        // Log detalhado para sabermos exatamente o que deu errado
        console.error("Erro no processamento:", error.response?.data || error.message);
    }

    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
