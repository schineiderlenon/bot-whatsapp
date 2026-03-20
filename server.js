require('dotenv').config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Pega as chaves das configurações do Render
const { OPENAI_API_KEY, ZAPI_TOKEN, ZAPI_INSTANCE } = process.env;

// Rota para o navegador (Evita o Not Found)
app.get("/", (req, res) => {
    res.send("O Assistente Financeiro está online! 🚀");
});

// Rota principal do WhatsApp (Webhook)
app.post("/webhook", async (req, res) => {
    console.log("Chegou uma mensagem no Webhook!");
    
    const message = req.body.text?.message;
    const phone = req.body.phone;

    if (!message || !phone) {
        return res.sendStatus(200);
    }

    try {
        // Envia para a OpenAI
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Você é um assistente financeiro pessoal. Responda de forma curta e ajude a organizar gastos." },
                { role: "user", content: message }
            ]
        }, {
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
        });

        const aiReply = response.data.choices[0].message.content;

        // Envia de volta para o WhatsApp via Z-API
        await axios.post(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`, {
            phone: phone,
            message: aiReply
        });

        console.log("Resposta enviada com sucesso!");
    } catch (error) {
        console.error("Erro ao processar:", error.message);
    }

    res.sendStatus(200);
});

// Porta automática do Render (Sempre por último)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
