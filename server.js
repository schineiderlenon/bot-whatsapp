require('dotenv').config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Pega as chaves do Render
const { OPENAI_API_KEY, ZAPI_TOKEN, ZAPI_INSTANCE } = process.env;

app.get("/", (req, res) => {
    res.send("O Assistente Financeiro está online! 🚀");
});

app.post("/webhook", async (req, res) => {
    const isGroup = req.body.isGroup;
    const message = req.body.text?.message;
    const phone = req.body.phone;

    // 1. Trava de segurança para grupos
    if (isGroup === true) {
        console.log("Mensagem de grupo ignorada.");
        return res.sendStatus(200);
    }

    if (!message || !phone) return res.sendStatus(200);

    try {
        console.log("Chegou mensagem de: " + phone);

        // 2. Chamada para a OpenAI (Limpando espaços da chave)
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "Você é um assistente financeiro pessoal. Responda de forma curta e direta." },
                { role: "user", content: message }
            ]
        }, {
            headers: { 
                "Authorization": `Bearer ${OPENAI_API_KEY.trim()}`,
                "Content-Type": "application/json"
            }
        });

        const aiReply = response.data.choices[0].message.content;
        console.log("IA respondeu: " + aiReply);

        // 3. Envio para a Z-API (Limpando espaços do Token e Instância)
        const zInstancia = ZAPI_INSTANCE.trim();
        const zToken = ZAPI_TOKEN.trim();

        await axios.post(`https://api.z-api.io/instances/${zInstancia}/token/${zToken}/send-text`, {
            phone: phone,
            message: aiReply
        });

        console.log("Sucesso! Resposta enviada ao WhatsApp.");

    } catch (error) {
        // Exibe o erro detalhado se algo falhar
        console.error("Erro no processamento:", error.response?.data || error.message);
    }

    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
