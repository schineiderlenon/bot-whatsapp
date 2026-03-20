require('dotenv').config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const { OPENAI_API_KEY, ZAPI_TOKEN, ZAPI_INSTANCE } = process.env;

app.post("/webhook", async (req, res) => {
    // Log para a gente ver no Render se a mensagem chegou
    console.log("Mensagem recebida do WhatsApp!");

    const message = req.body.text?.message;
    const phone = req.body.phone;

    if (!message || !phone) return res.sendStatus(200);

    try {
        // 1. Pergunta para a IA
        const aiResponse = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Você é um assistente financeiro pessoal. Ajude o usuário a organizar gastos de forma curta e gentil." },
                { role: "user", content: message }
            ]
        }, {
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
        });

        const reply = aiResponse.data.choices[0].message.content;

        // 2. Responde no WhatsApp via Z-API
        await axios.post(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`, {
            phone: phone,
            message: reply
        });

        console.log("Resposta enviada com sucesso!");
    } catch (error) {
        console.error("Erro no processamento:", error?.response?.data || error.message);
    }

    res.sendStatus(200);
});
// Rota para o navegador não dar "Not Found"
app.get("/", (req, res) => {
    res.send("O Assistente Financeiro está online! 🚀");
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor ativo na porta ${PORT}`));
