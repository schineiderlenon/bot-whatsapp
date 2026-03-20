require('dotenv').config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const { OPENAI_API_KEY, ZAPI_TOKEN, ZAPI_INSTANCE } = process.env;

app.get("/", (req, res) => {
    res.send("Assistente Financeiro Online! 🚀");
});

app.post("/webhook", async (req, res) => {
    const isGroup = req.body.isGroup;
    const message = req.body.text?.message;
    const phone = req.body.phone;

    if (isGroup === true || !message || !phone) return res.sendStatus(200);

    try {
        console.log("Processando mensagem de: " + phone);

        // Chamada OpenAI
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "Você é um assistente financeiro curto e grosso." },
                { role: "user", content: message }
            ]
        }, {
            headers: { "Authorization": `Bearer ${OPENAI_API_KEY.trim()}` }
        });

        const aiReply = response.data.choices[0].message.content;
        console.log("IA Respondeu: " + aiReply);

        // ENVIO PARA Z-API (Formatado para evitar erro de token)
        const urlZapi = `https://api.z-api.io/instances/${ZAPI_INSTANCE.trim()}/token/${ZAPI_TOKEN.trim()}/send-text`;
        
        await axios({
            method: 'post',
            url: urlZapi,
            data: {
                phone: phone,
                message: aiReply
            }
        });

        console.log("Sucesso total! Resposta enviada.");

    } catch (error) {
        // Se der erro, vamos ver o que a Z-API respondeu exatamente
        console.error("Erro detalhado:", error.response?.data || error.message);
    }

    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
