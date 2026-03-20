require('dotenv').config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const { OPENAI_API_KEY } = process.env;

// 1. PREENCHA AQUI COM SEUS DADOS DA Z-API
const MEU_ID_INSTANCIA = "3F068B87720A321E31F9763ED8CCDC79"; 
const MEU_TOKEN_INSTANCIA = "56E66A90324CF5A8A192AC7F";
const MEU_CLIENT_TOKEN = "F9bbdcb6281e64e6b83211233911df38cS"; // O código que você conseguiu agora

app.post("/webhook", async (req, res) => {
    const { isGroup, text, phone } = req.body;
    const message = text?.message;

    if (isGroup === true || !message || !phone) return res.sendStatus(200);

    try {
        console.log("IA processando pergunta de: " + phone);
        
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: message }]
        }, {
            headers: { "Authorization": `Bearer ${OPENAI_API_KEY.trim()}` }
        });

        const aiReply = response.data.choices[0].message.content;

        // 2. ENVIO COM O CLIENT-TOKEN (A CHAVE DA VITÓRIA)
        await axios.post(
            `https://api.z-api.io/instances/${MEU_ID_INSTANCIA}/token/${MEU_TOKEN_INSTANCIA}/send-text`,
            { phone: phone, message: aiReply },
            { 
                headers: { 
                    "client-token": MEU_CLIENT_TOKEN.trim() 
                } 
            }
        );

        console.log("FINALMENTE! Resposta enviada com sucesso.");

    } catch (error) {
        console.error("Erro detalhado:", error.response?.data || error.message);
    }
    res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => console.log("Servidor Ativo!"));
